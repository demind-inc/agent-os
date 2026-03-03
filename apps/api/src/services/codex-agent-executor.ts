/**
 * Codex (OpenAI) agent execution with interactive tools.
 * Mirrors agent-executor for Claude; uses OpenAI API with same streaming chunk interface.
 */

import OpenAI from "openai";
import type { StreamChunk } from "../types/stream-chunk.js";
import { executeGitHubTool, type GitHubToolName } from "./github-tools.js";

export type StreamLogCallback = (
  level: string,
  message: string,
  payload?: Record<string, unknown>
) => void | Promise<void>;

export type StreamChunkCallback = (chunk: StreamChunk) => void | Promise<void>;

export type StreamPromptCallback = (prompt: {
  kind: "user_prompt";
  message: string;
}) => void | Promise<void>;

export type PausedResult = {
  paused: true;
  fullText: string;
  prompt: { kind: "user_prompt"; message: string };
  messages: unknown[];
  pendingToolCallId: string;
};

export type CompletedResult = {
  paused: false;
  fullText: string;
  messages: unknown[];
};

function resolveModel(slug: string): string {
  const map: Record<string, string> = {
    "gpt-5-codex": "gpt-4o",
    "gpt-5": "gpt-4o",
    "gpt-5-mini": "gpt-4o-mini",
  };
  return map[slug] ?? slug;
}

const GITHUB_TOOL_NAMES = new Set<GitHubToolName>([
  "github_search_repositories",
  "github_get_file",
  "github_list_issues",
  "github_list_repos",
  "github_list_branches",
  "github_list_commits",
  "github_create_pull_request",
]);

function slugifyForBranch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "changes";
}

function getOpenAITools(
  githubAccessToken: string | null
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "request_user_input",
        description:
          "Call this when you need the user to provide input (answer a question, confirm something, provide data). The execution will pause and show a text input in the console.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Question or prompt to show the user",
            },
          },
          required: ["message"],
        },
      },
    },
  ];

  if (githubAccessToken) {
    tools.push(
      {
        type: "function",
        function: {
          name: "github_search_repositories",
          description:
            "Search GitHub repositories. Use when you need to find repos by topic, name, or keyword.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              limit: {
                type: "number",
                description: "Max results (default 10)",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "github_get_file",
          description: "Get file contents from a GitHub repository.",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner" },
              repo: { type: "string", description: "Repository name" },
              path: { type: "string", description: "File path" },
              ref: {
                type: "string",
                description: "Optional branch/tag/commit",
              },
            },
            required: ["owner", "repo", "path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "github_list_issues",
          description: "List issues for a GitHub repository.",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              state: { type: "string", description: "open, closed, or all" },
              limit: { type: "number" },
            },
            required: ["owner", "repo"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "github_list_repos",
          description: "List repositories for the authenticated user.",
          parameters: {
            type: "object",
            properties: { limit: { type: "number" } },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "github_list_branches",
          description:
            "List branches for a repository. Use to see available branches before creating a PR.",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner" },
              repo: { type: "string", description: "Repository name" },
              limit: { type: "number", description: "Max results (default 30)" },
            },
            required: ["owner", "repo"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "github_list_commits",
          description:
            "List commits for a repository. Use sha (branch name) to filter by branch.",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner" },
              repo: { type: "string", description: "Repository name" },
              sha: {
                type: "string",
                description: "Branch name or commit SHA to list commits from",
              },
              limit: { type: "number", description: "Max results (default 20)" },
            },
            required: ["owner", "repo"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "github_create_pull_request",
          description:
            "Create a pull request. Title and head (branch) are auto-assigned from the task if omitted.",
          parameters: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              title: {
                type: "string",
                description: "PR title (auto from task if empty)",
              },
              head: {
                type: "string",
                description: "Branch with changes (auto from task if empty)",
              },
              base: {
                type: "string",
                description: "Target branch (default main)",
              },
              body: { type: "string" },
            },
            required: ["owner", "repo"],
          },
        },
      }
    );
  }

  return tools;
}

/**
 * Parse LLM text into structured chunks (sections, text, command blocks) and emit via callback.
 */
function emitTextAsChunks(
  text: string,
  onChunk: (chunk: StreamChunk) => void | Promise<void>
): void {
  if (!text.trim()) return;

  const sectionRe = /^##\s+(.+)$/gm;
  const codeBlockRe = /```(\w*)\n([\s\S]*?)```/g;
  const sectionStarts = [...text.matchAll(sectionRe)];
  const sectionIndices = sectionStarts.map((m) => m.index!);

  const emit = (chunk: StreamChunk) => {
    void Promise.resolve(onChunk(chunk)).catch(() => {});
  };

  if (sectionIndices.length === 0) {
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    codeBlockRe.lastIndex = 0;
    while ((match = codeBlockRe.exec(text)) !== null) {
      const before = text.slice(lastEnd, match.index);
      if (before.trim()) emit({ type: "text", content: before.trim() });
      const content = match[2]!.trimEnd();
      const cmd = content.split("\n")[0] ?? content;
      emit({ type: "command", command: cmd, output: content, status: "done" });
      lastEnd = codeBlockRe.lastIndex;
    }
    if (lastEnd < text.length) {
      const rest = text.slice(lastEnd).trim();
      if (rest) emit({ type: "text", content: rest });
    }
    return;
  }

  for (let i = 0; i < sectionIndices.length; i++) {
    const start = sectionIndices[i]!;
    const end = sectionIndices[i + 1] ?? text.length;
    const raw = text.slice(start, end);
    const firstNewline = raw.indexOf("\n");
    const title = (firstNewline >= 0 ? raw.slice(0, firstNewline) : raw)
      .replace(/^##\s+/, "")
      .trim();
    const body = firstNewline >= 0 ? raw.slice(firstNewline + 1) : "";

    emit({ type: "section", title });

    let lastEnd = 0;
    let match: RegExpExecArray | null;
    codeBlockRe.lastIndex = 0;
    while ((match = codeBlockRe.exec(body)) !== null) {
      const before = body.slice(lastEnd, match.index);
      if (before.trim()) emit({ type: "text", content: before.trim() });
      const content = match[2]!.trimEnd();
      const lines = content.split("\n");
      const cmd = lines[0] ?? content;
      emit({ type: "command", command: cmd, output: content, status: "done" });
      lastEnd = codeBlockRe.lastIndex;
    }
    if (lastEnd < body.length) {
      const rest = body.slice(lastEnd).trim();
      if (rest) emit({ type: "text", content: rest });
    }
  }
}

function convertToOpenAIMessages(
  messages: Array<Record<string, unknown>>
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  for (const m of messages) {
    const role = m.role as string;
    if (role === "user") {
      const content = m.content;
      if (Array.isArray(content)) {
        const toolResults = content.filter(
          (c) => (c as { type?: string }).type === "tool_result"
        ) as Array<{ tool_use_id?: string; content?: string }>;
        if (toolResults.length > 0) {
          for (const tr of toolResults) {
            out.push({
              role: "tool",
              tool_call_id: tr.tool_use_id ?? "",
              content: tr.content ?? "",
            });
          }
          continue;
        }
      }
      const textContent =
        typeof content === "string"
          ? content
          : Array.isArray(content)
          ? ""
          : String(content ?? "");
      out.push({
        role: "user",
        content: textContent || "User provided input.",
      });
    } else if (role === "assistant") {
      const content = m.content as Array<{
        type?: string;
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
      }>;
      const text =
        content
          ?.filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join("") ?? "";
      const toolCalls = content?.filter((c) => c.type === "tool_use") ?? [];
      if (toolCalls.length > 0) {
        out.push({
          role: "assistant",
          content: text || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id ?? "",
            type: "function" as const,
            function: {
              name: tc.name ?? "",
              arguments: JSON.stringify(tc.input ?? {}),
            },
          })),
        });
      } else {
        out.push({ role: "assistant", content: text || "" });
      }
    }
  }

  return out;
}

export async function runCodexAgentWithTools(
  task: { title: string; description: string },
  agent: { model: string; skills?: string[] },
  resumeState: {
    messages: unknown[];
    pendingToolCallId: string;
    userInput: { type: "text"; value?: string };
  } | null,
  onLog: StreamLogCallback,
  apiKey: string | null,
  options: {
    onStreamChunk?: StreamChunkCallback;
    onStreamPrompt?: StreamPromptCallback;
    githubAccessToken?: string | null;
    onArtifactCreated?: (artifact: {
      type: string;
      title: string;
      url: string;
      metadata?: Record<string, unknown>;
    }) => void | Promise<void>;
  } = {}
): Promise<PausedResult | CompletedResult> {
  if (!apiKey || !apiKey.trim()) {
    await onLog(
      "warn",
      "No OpenAI API key configured. Add your key in Settings → API Keys.",
      { source: "runner" }
    );
    return { paused: false, fullText: "", messages: [] };
  }

  const client = new OpenAI({ apiKey });
  const model = resolveModel(agent.model);
  const githubAccessToken = options.githubAccessToken ?? null;
  const tools = getOpenAITools(githubAccessToken);

  const systemPrompt = `You are an AI assistant working on a task. Structure your response so the execution console can show clear sections.

Rules:
- Start each major step or action with a section heading on its own line: ## <short action title>
- For any commands you describe or run, wrap them in a fenced code block with \`\`\`bash or \`\`\` (command on lines after the opener, then \`\`\` to close).
- Describe what you're doing concisely.
- GitHub and other integrations are connected by the user in Settings → Integrations. When GitHub is connected, you can use github_search_repositories, github_get_file, github_list_issues, github_list_repos, github_list_branches, github_list_commits, and github_create_pull_request. Use github_list_branches and github_list_commits to verify branches and commits before creating a PR.
- If you need to ask the user a question, get confirmation, or have them provide data, call request_user_input with a clear message.
- IMPORTANT: Do not consider the task complete until you have fulfilled ALL requirements. When GitHub is connected, create a PR whenever it makes sense—e.g. when you've analyzed or modified repo content and the task would benefit from a pull request. If the task asks for a PR, you MUST call github_create_pull_request before finishing. Do not stop after fetching files, analyzing code, or making local changes—finish only after the PR is created (or you have explicitly asked the user for input).`;

  const userContent = `Task: ${task.title}\n\n${
    task.description || "No additional description."
  }\n\nWork through this task. Start with a ## section title for your first step.`;

  let messages: Array<Record<string, unknown>> = resumeState
    ? ([
        ...resumeState.messages,
        {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: resumeState.pendingToolCallId,
              content: resumeState.userInput.value ?? "User provided input.",
            },
          ],
        },
      ] as Array<Record<string, unknown>>)
    : [{ role: "user" as const, content: userContent }];

  let fullText = "";

  await onLog("info", resumeState ? "Resuming agent…" : "Starting agent…", {
    source: "runner",
    model,
  });
  // if (process.env.NODE_ENV === "development") {
  console.log("[Codex] Start", resumeState ? "resume" : "fresh", {
    model,
    task: task.title,
  });
  // }

  const MAX_TOOL_ROUNDS = 30;
  let round = 0;
  let lastAssistantContent: Array<Record<string, unknown>> = [];

  while (round < MAX_TOOL_ROUNDS) {
    round++;
    // if (process.env.NODE_ENV === "development") {
    console.log("[Codex] Round", round, "messages:", messages.length);
    // }

    const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        { role: "system", content: systemPrompt },
        ...convertToOpenAIMessages(messages),
      ];

    const response = await client.chat.completions.create({
      model,
      max_tokens: 16384,
      messages: openAIMessages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
    });

    const choice = response.choices[0];
    if (!choice?.message) {
      await onLog("warn", "Empty response from model", { source: "runner" });
      return { paused: false, fullText, messages: [] };
    }

    const msg = choice.message;
    const content = msg.content ?? "";
    const toolCalls = msg.tool_calls ?? [];

    // if (process.env.NODE_ENV === "development") {
    console.log("[Codex] Response:", {
      round,
      contentLength: (content as string).length,
      toolCallsCount: toolCalls.length,
      finish_reason: choice.finish_reason,
      toolNames: toolCalls.map((tc) => {
        const fn =
          "function" in tc
            ? (tc as { function?: { name?: string } }).function
            : undefined;
        return fn?.name ?? "?";
      }),
    });
    // }

    fullText += content;
    if (options.onStreamChunk && content) {
      emitTextAsChunks(content, options.onStreamChunk);
    }

    const assistantContent: Array<Record<string, unknown>> = [];

    if (content) {
      assistantContent.push({ type: "text", text: content });
    }

    for (const tc of toolCalls) {
      const fn =
        "function" in tc
          ? (tc as { function?: { name?: string; arguments?: string } })
              .function
          : undefined;
      assistantContent.push({
        type: "tool_use",
        id: tc.id,
        name: fn?.name ?? "",
        input: JSON.parse(fn?.arguments ?? "{}"),
      });
    }

    lastAssistantContent = assistantContent;

    if (toolCalls.length === 0) {
      const finishReason = choice.finish_reason;
      const wasTruncated = finishReason === "length";

      if (wasTruncated) {
        await onLog("warn", "Response truncated (token limit); continuing…", {
          source: "runner",
          finish_reason: finishReason,
        });
        if (options.onStreamChunk) {
          void Promise.resolve(
            options.onStreamChunk({
              type: "text",
              content: "\n\n_[Response was truncated; continuing…]_",
            })
          ).catch(() => {});
        }
        fullText += "\n\n_[Response was truncated; continuing…]_";
        // if (process.env.NODE_ENV === "development") {
        console.log("[Codex] Truncated, continuing…");
        // }
        messages = [
          ...messages,
          { role: "assistant" as const, content: assistantContent },
          {
            role: "user" as const,
            content:
              "Please continue from where you left off. Do not repeat what you already said.",
          },
        ];
        continue;
      }

      // Task completion check: if task mentions PR but we haven't created one, nudge to continue
      const taskText = `${task.title} ${task.description}`.toLowerCase();
      const taskMentionsPR =
        /pr\b|pull request|create pr|create pull request|open pr|open pull request/i.test(
          taskText
        );
      const hasCreatedPR = messages.some((m) => {
        if (m.role !== "assistant") return false;
        const c = m.content;
        if (!Array.isArray(c)) return false;
        return (c as Array<{ type?: string; name?: string }>).some(
          (x) =>
            x.type === "tool_use" && x.name === "github_create_pull_request"
        );
      });

      // if (process.env.NODE_ENV === "development") {
      const lastText = (content as string)?.slice?.(0, 300) ?? "";
      console.log(
        "[Agent Debug] Model returned with no tool calls, considering done:",
        {
          round,
          finish_reason: finishReason,
          toolCallsCount: toolCalls.length,
          taskMentionsPR,
          hasCreatedPR,
          willNudge:
            taskMentionsPR &&
            !hasCreatedPR &&
            !!githubAccessToken &&
            round < MAX_TOOL_ROUNDS - 1,
          lastContentPreview: lastText + (lastText.length >= 300 ? "…" : ""),
        }
      );
      // }

      if (
        taskMentionsPR &&
        !hasCreatedPR &&
        githubAccessToken &&
        round < MAX_TOOL_ROUNDS - 1
      ) {
        await onLog(
          "info",
          "Task mentions PR but no PR created yet; nudging agent to continue.",
          {
            source: "runner",
          }
        );
        // if (process.env.NODE_ENV === "development") {
        console.log("[Codex] PR nudge: injecting continuation");
        // }
        if (options.onStreamChunk) {
          void Promise.resolve(
            options.onStreamChunk({
              type: "text",
              content:
                "\n\n_[Task requires a PR; prompting agent to create it…]_",
            })
          ).catch(() => {});
        }
        fullText += "\n\n_[Task requires a PR; prompting agent to create it…]_";
        messages = [
          ...messages,
          { role: "assistant" as const, content: assistantContent },
          {
            role: "user" as const,
            content:
              "You have not yet completed the task. The task requires creating a pull request. You MUST call github_create_pull_request now. Do not stop with text only—call the tool.",
          },
        ];
        continue;
      }

      // When finish_reason is "stop" with no tool calls, pause for user input instead of marking done
      if (finishReason === "stop") {
        const syntheticId = `synthetic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const agentText = (content as string).trim();
        const seemsToAskForInput =
          /would you|could you|please provide|should i |can you provide|i need (to|your)|would you like to|or should i |confirm|locating|having difficulty/i.test(
            agentText
          ) || agentText.includes("?");
        const promptMessage =
          seemsToAskForInput && agentText.length > 0
            ? agentText.slice(-1200)
            : "The agent has finished its response. Please review and confirm—type 'done' to complete, or provide feedback to continue.";
        const assistantWithToolUse: Array<Record<string, unknown>> = [
          ...assistantContent,
          {
            type: "tool_use" as const,
            id: syntheticId,
            name: "request_user_input",
            input: { message: promptMessage },
          },
        ];
        const prompt = { kind: "user_prompt" as const, message: promptMessage };

        await onLog("info", "Agent stopped with no tool calls; pausing for user input.", {
          source: "runner",
          finish_reason: finishReason,
        });
        options.onStreamPrompt?.(prompt);
        options.onStreamChunk?.({ type: "user_prompt", message: promptMessage });

        return {
          paused: true,
          fullText,
          prompt,
          messages: [
            ...messages,
            { role: "assistant" as const, content: assistantWithToolUse },
          ],
          pendingToolCallId: syntheticId,
        };
      }

      await onLog("info", "Agent finished.", {
        source: "runner",
        finish_reason: finishReason ?? "stop",
      });
      return {
        paused: false,
        fullText,
        messages: [
          ...messages,
          { role: "assistant" as const, content: assistantContent },
        ] as Array<Record<string, unknown>>,
      };
    }

    const toolCall = toolCalls[0]!;
    const fn =
      "function" in toolCall
        ? (toolCall as { function?: { name?: string; arguments?: string } })
            .function
        : undefined;
    const name = fn?.name ?? "";
    const id = toolCall.id ?? "";
    const input = JSON.parse(fn?.arguments ?? "{}") as Record<string, unknown>;

    await onLog("info", `Tool use: ${name}`, {
      source: "runner",
      tool: name,
    });
    // if (process.env.NODE_ENV === "development") {
    console.log("[Codex] Tool call:", name, input);
    // }

    if (name === "request_user_input") {
      const message = (input.message as string) ?? "Please provide your input.";
      const prompt = { kind: "user_prompt" as const, message };

      await onLog("info", "Agent needs user input", {
        source: "runner",
        ...prompt,
      });
      options.onStreamPrompt?.(prompt);
      options.onStreamChunk?.({ type: "user_prompt", message });

      //if (process.env.NODE_ENV === "development") {
      console.log("[Codex] Returning paused (request_user_input)");
      // }
      return {
        paused: true,
        fullText,
        prompt,
        messages: [
          ...messages,
          { role: "assistant" as const, content: assistantContent },
        ],
        pendingToolCallId: id,
      };
    }

    if (GITHUB_TOOL_NAMES.has(name as GitHubToolName) && githubAccessToken) {
      let toolInput = { ...input };
      if (name === "github_create_pull_request") {
        const title = String(input.title ?? "").trim();
        const head = String(input.head ?? "").trim();
        if (!title) toolInput = { ...toolInput, title: task.title };
        if (!head) {
          const slug = slugifyForBranch(task.title);
          const suffix = Date.now().toString(36).slice(-6);
          toolInput = { ...toolInput, head: `agent/${slug}-${suffix}` };
        }
      }
      const result = await executeGitHubTool(
        name as GitHubToolName,
        githubAccessToken,
        toolInput
      );
      await onLog("info", `GitHub tool: ${name}`, {
        source: "runner",
        tool: name,
      });

      if (name === "github_get_file" && !result.startsWith("Error:")) {
        const owner = String(input.owner ?? "").trim();
        const repo = String(input.repo ?? "").trim();
        const path = String(input.path ?? "").trim();
        const fullPath = [owner, repo, path].filter(Boolean).join("/") || path;
        const tokens = Math.ceil(result.length / 4);
        options.onStreamChunk?.({
          type: "read_file",
          path: fullPath || "/",
          summary: result.slice(0, 200) + (result.length > 200 ? "…" : ""),
          tokens,
        });
      }

      if (
        name === "github_create_pull_request" &&
        !result.startsWith("Error:")
      ) {
        try {
          const pr = JSON.parse(result) as {
            html_url?: string;
            number?: number;
            title?: string;
          };
          if (pr.html_url) {
            await options.onArtifactCreated?.({
              type: "pull_request",
              title: pr.title ?? `PR #${pr.number ?? ""}`,
              url: pr.html_url,
              metadata: { number: pr.number, html_url: pr.html_url },
            });
          }
        } catch {
          // ignore
        }
      }

      messages = [
        ...messages,
        { role: "assistant" as const, content: assistantContent },
        {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: id,
              content: result,
            },
          ],
        },
      ];
      continue;
    }

    await onLog("warn", `Unknown tool: ${name}`, { source: "runner" });
    messages = [
      ...messages,
      { role: "assistant" as const, content: assistantContent },
      {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: id,
            content: `Unknown or unsupported tool: ${name}`,
          },
        ],
      },
    ];
  }

  await onLog("info", "Agent finished (max tool rounds reached).", {
    source: "runner",
  });
  //if (process.env.NODE_ENV === "development") {
  console.log(
    "[Codex] Returning done (max rounds reached:",
    MAX_TOOL_ROUNDS,
    ")"
  );
  // }
  const finalMessages = [
    ...messages,
    { role: "assistant" as const, content: lastAssistantContent },
  ] as Array<Record<string, unknown>>;
  return { paused: false, fullText, messages: finalMessages };
}
