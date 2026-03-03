import type { StreamChunk } from "../types/stream-chunk.js";
import { adminSupabase } from "../plugins/supabase.js";
import { runAgentWithTools } from "./agent-executor.js";
import { runCodexAgentWithTools } from "./codex-agent-executor.js";
import { getGitHubIntegrationForWorkspace } from "./github-integration.js";
import { broadcastRunStreamChunk, broadcastRunStreamDone } from "./run-stream-registry.js";

export async function enqueueRun(runId: string) {
  void execute(runId);
}

type BufferedLog = {
  level: string;
  message: string;
  payload: Record<string, unknown>;
};

async function flushLogs(
  runId: string,
  taskId: string,
  logs: BufferedLog[]
): Promise<void> {
  if (logs.length === 0) return;
  await adminSupabase.from("task_logs").insert(
    logs.map((l) => ({
      run_id: runId,
      task_id: taskId,
      level: l.level,
      message: l.message,
      payload: l.payload,
    }))
  );
}

async function upsertExecutionLog(
  taskId: string,
  runId: string,
  content: string,
  chunks?: StreamChunk[]
) {
  const { data: existing } = await adminSupabase
    .from("task_artifacts")
    .select("id")
    .eq("task_id", taskId)
    .eq("run_id", runId)
    .eq("type", "execution_log")
    .maybeSingle();

  const metadata: Record<string, unknown> = {
    source: "runner",
    content,
    preview: content,
  };
  if (Array.isArray(chunks) && chunks.length > 0) {
    metadata.chunks = chunks;
  }

  const payload = {
    task_id: taskId,
    run_id: runId,
    type: "execution_log",
    title: "Execution console",
    url: null,
    metadata,
  };

  if (existing) {
    await adminSupabase
      .from("task_artifacts")
      .update({ metadata: payload.metadata })
      .eq("id", existing.id);
  } else {
    await adminSupabase.from("task_artifacts").insert(payload);
  }
}

async function execute(runId: string) {
  const { data: run } = await adminSupabase
    .from("agent_runs")
    .select("id, task_id, agent_id, triggered_by_user_id, input_snapshot, output_snapshot")
    .eq("id", runId)
    .single();

  if (!run) return;

  const isResume =
    (run.output_snapshot as { pausedState?: unknown })?.pausedState != null &&
    (run.input_snapshot as { userInput?: unknown })?.userInput != null;

  await adminSupabase
    .from("agent_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);
  await adminSupabase.from("tasks").update({ status: "ai_working" }).eq("id", run.task_id);

  const { data: task } = await adminSupabase
    .from("tasks")
    .select("id, title, description, metadata, projects(workspace_id)")
    .eq("id", run.task_id)
    .single();
  const { data: agent } = await adminSupabase
    .from("agents")
    .select("id, backend, model, config")
    .eq("id", run.agent_id)
    .single();

  if (!task) return;

  const logBuffer: BufferedLog[] = [];
  let chunkBufferRef: StreamChunk[] | null = null;
  const broadcastLog = (runId: string) => (level: string, message: string, payload?: Record<string, unknown>) => {
    logBuffer.push({ level, message, payload: payload ?? {} });
    const logChunk: StreamChunk = {
      type: "agent_log",
      level,
      message,
      payload: payload ?? {},
    };
    chunkBufferRef?.push(logChunk);
    broadcastRunStreamChunk(runId, "chunk", JSON.stringify(logChunk));
    if (process.env.NODE_ENV === "development") {
      console.log("[Agent Log]", { level, message, ...(payload ?? {}) });
    }
  };
  const onLog = broadcastLog(run.id);

  let anthropicApiKey: string | null = null;
  let openaiApiKey: string | null = null;
  if (run.triggered_by_user_id) {
    const { data: keyRow } = await adminSupabase
      .from("user_settings")
      .select("value")
      .eq("user_id", run.triggered_by_user_id)
      .eq("key", "provider_api_keys")
      .maybeSingle();
    const keys = (keyRow?.value as { anthropic?: string; openai?: string } | null) ?? null;
    anthropicApiKey = (keys?.anthropic && String(keys.anthropic).trim()) || null;
    openaiApiKey = (keys?.openai && String(keys.openai).trim()) || null;
  }

  const agentConfig = (agent?.config as { skills?: string[] }) ?? {};
  const skills = agentConfig.skills ?? [];

  type PausedState = {
    messages: Array<Record<string, unknown>>;
    pendingToolCallId: string;
  };
  let resumeState: {
    messages: Array<Record<string, unknown>>;
    pendingToolCallId: string;
    userInput: { type: "text"; value?: string };
  } | null = null;

  if (isResume) {
    const output = run.output_snapshot as { pausedState?: PausedState } | null;
    const paused = output?.pausedState;
    const input = run.input_snapshot as { userInput?: { type: string; value?: string } } | null;
    const userInput = input?.userInput;
    if (paused && userInput) {
      resumeState = {
        messages: paused.messages,
        pendingToolCallId: paused.pendingToolCallId,
        userInput: { type: "text", value: userInput.value },
      };
    }
  }

  let completedMessages: unknown[] = [];
  try {
    if (agent?.backend === "claude") {
      const chunkBuffer: StreamChunk[] = [];
      chunkBufferRef = chunkBuffer;
      const onStreamChunk = (chunk: StreamChunk) => {
        chunkBuffer.push(chunk);
        broadcastRunStreamChunk(run.id, "chunk", JSON.stringify(chunk));
      };

      const workspaceId = (task as { projects?: { workspace_id?: string } }).projects?.workspace_id;
      const githubIntegration = workspaceId
        ? await getGitHubIntegrationForWorkspace(workspaceId)
        : null;
      const githubAccessToken = githubIntegration?.access_token ?? null;

      const result = await runAgentWithTools(
        { title: task.title, description: task.description ?? "" },
        { model: agent.model, skills },
        resumeState,
        onLog,
        anthropicApiKey,
        {
          onStreamChunk,
          onStreamPrompt: async (prompt) => {
            onLog("info", prompt.message, {
              kind: prompt.kind,
              message: prompt.message,
            });
          },
          githubAccessToken,
          onArtifactCreated: async (artifact) => {
            await adminSupabase.from("task_artifacts").insert({
              task_id: run.task_id,
              run_id: run.id,
              type: artifact.type,
              title: artifact.title,
              url: artifact.url,
              metadata: { ...artifact.metadata, preview: artifact.url },
            });
          },
        }
      );

      const contentToStore = result.fullText;

      if (result.paused) {
        await adminSupabase
          .from("agent_runs")
          .update({
            status: "awaiting_input",
            output_snapshot: {
              pausedState: {
                messages: result.messages,
                pendingToolCallId: result.pendingToolCallId,
                fullText: result.fullText,
                prompt: result.prompt,
              },
            },
          })
          .eq("id", runId);
        broadcastRunStreamDone(run.id);
        await upsertExecutionLog(run.task_id, run.id, contentToStore, chunkBuffer);
        await flushLogs(run.id, run.task_id, logBuffer);
        return;
      }

      await upsertExecutionLog(run.task_id, run.id, contentToStore, chunkBuffer);
      broadcastRunStreamDone(run.id);
      await flushLogs(run.id, run.task_id, logBuffer);
      completedMessages = result.messages;
    } else if (agent?.backend === "codex") {
      const chunkBuffer: StreamChunk[] = [];
      chunkBufferRef = chunkBuffer;
      const onStreamChunk = (chunk: StreamChunk) => {
        chunkBuffer.push(chunk);
        broadcastRunStreamChunk(run.id, "chunk", JSON.stringify(chunk));
      };

      const workspaceId = (task as { projects?: { workspace_id?: string } }).projects?.workspace_id;
      const githubIntegration = workspaceId
        ? await getGitHubIntegrationForWorkspace(workspaceId)
        : null;
      const githubAccessToken = githubIntegration?.access_token ?? null;

      const result = await runCodexAgentWithTools(
        { title: task.title, description: task.description ?? "" },
        { model: agent.model, skills },
        resumeState,
        onLog,
        openaiApiKey,
        {
          onStreamChunk,
          onStreamPrompt: async (prompt) => {
            onLog("info", prompt.message, {
              kind: prompt.kind,
              message: prompt.message,
            });
          },
          githubAccessToken,
          onArtifactCreated: async (artifact) => {
            await adminSupabase.from("task_artifacts").insert({
              task_id: run.task_id,
              run_id: run.id,
              type: artifact.type,
              title: artifact.title,
              url: artifact.url,
              metadata: { ...artifact.metadata, preview: artifact.url },
            });
          },
        }
      );

      const contentToStore = result.fullText;

      if (result.paused) {
        await adminSupabase
          .from("agent_runs")
          .update({
            status: "awaiting_input",
            output_snapshot: {
              pausedState: {
                messages: result.messages,
                pendingToolCallId: result.pendingToolCallId,
                fullText: result.fullText,
                prompt: result.prompt,
              },
            },
          })
          .eq("id", runId);
        broadcastRunStreamDone(run.id);
        await upsertExecutionLog(run.task_id, run.id, contentToStore, chunkBuffer);
        await flushLogs(run.id, run.task_id, logBuffer);
        return;
      }

      await upsertExecutionLog(run.task_id, run.id, contentToStore, chunkBuffer);
      broadcastRunStreamDone(run.id);
      await flushLogs(run.id, run.task_id, logBuffer);
      completedMessages = result.messages;
    } else {
      onLog("info", "Unsupported agent backend; no model stream.", { source: "runner" });
      await adminSupabase.from("task_artifacts").insert({
        task_id: run.task_id,
        run_id: run.id,
        type: "execution_log",
        title: "Execution console",
        url: null,
        metadata: { source: "runner", content: "", preview: "" },
      });
      await flushLogs(run.id, run.task_id, logBuffer);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onLog("error", message, { source: "runner", error: String(err) });
    await flushLogs(run.id, run.task_id, logBuffer);
    await adminSupabase
      .from("agent_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", runId);
    await adminSupabase.from("tasks").update({ status: "failed" }).eq("id", run.task_id);
    return;
  }

  await adminSupabase
    .from("agent_runs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      output_snapshot: {
        result: "ready_for_review",
        messages: completedMessages,
      },
    })
    .eq("id", runId);
  await adminSupabase.from("tasks").update({ status: "in_review" }).eq("id", run.task_id);
}
