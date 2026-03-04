/**
 * Agent execution with interactive tools. When the agent needs user input,
 * it calls request_user_input and pauses. The execution console shows the prompt;
 * the user responds; we resume with the tool result.
 * GitHub and other integrations are connected from Settings → Integrations.
 * The agent can access GitHub via tools when the workspace has a connected integration.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Message, MessageParam } from "@anthropic-ai/sdk/resources";
import type { StreamChunk } from "../types/stream-chunk.js";
import { executeGitHubTool, type GitHubToolName } from "./github-tools.js";

/** Tool definition for Messages API (avoids relying on SDK namespace export). */
type MessageTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
};

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
    "claude-3-7-sonnet": "claude-sonnet-4-20250514",
    "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
    "claude-3-opus": "claude-3-opus-20240229",
  };
  return map[slug] ?? slug;
}

const BASE_TOOLS: MessageTool[] = [
  {
    name: "request_user_input",
    description:
      "Call this when you need the user to provide input (answer a question, confirm something, provide data). The execution will pause and show a text input in the console.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string" as const,
          description: "Question or prompt to show the user",
        },
      },
      required: ["message"],
    },
  },
];

const GITHUB_TOOLS: MessageTool[] = [
  {
    name: "github_search_repositories",
    description:
      "Search GitHub repositories. Use when you need to find repos by topic, name, or keyword. Requires GitHub integration connected in Settings.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description: "Search query (e.g. 'react hooks', 'user:octocat')",
        },
        limit: {
          type: "number" as const,
          description: "Max results (default 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "github_get_file",
    description:
      "Get file contents from a GitHub repository. Use owner/repo for the repo and path for the file path.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: {
          type: "string" as const,
          description: "Repository owner (e.g. octocat)",
        },
        repo: { type: "string" as const, description: "Repository name" },
        path: {
          type: "string" as const,
          description: "File path (e.g. README.md, src/index.ts)",
        },
        ref: {
          type: "string" as const,
          description: "Optional branch/tag/commit",
        },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "github_list_issues",
    description: "List issues for a GitHub repository.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" as const, description: "Repository owner" },
        repo: { type: "string" as const, description: "Repository name" },
        state: {
          type: "string" as const,
          description: "open, closed, or all (default open)",
        },
        limit: {
          type: "number" as const,
          description: "Max results (default 20)",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "github_list_repos",
    description:
      "List repositories for the authenticated user (the one who connected GitHub in Settings).",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number" as const,
          description: "Max results (default 30)",
        },
      },
    },
  },
  {
    name: "github_list_branches",
    description:
      "List branches for a repository. Use to see available branches before creating a PR.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" as const, description: "Repository owner" },
        repo: { type: "string" as const, description: "Repository name" },
        limit: {
          type: "number" as const,
          description: "Max results (default 30)",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "github_list_commits",
    description:
      "List commits for a repository. Use sha (branch name) to filter by branch.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" as const, description: "Repository owner" },
        repo: { type: "string" as const, description: "Repository name" },
        sha: {
          type: "string" as const,
          description: "Branch name or commit SHA to list commits from",
        },
        limit: {
          type: "number" as const,
          description: "Max results (default 20)",
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "github_create_pull_request",
    description:
      "Create a pull request. Title and head (branch) are auto-assigned from the task if omitted.",
    input_schema: {
      type: "object" as const,
      properties: {
        owner: { type: "string" as const, description: "Repository owner" },
        repo: { type: "string" as const, description: "Repository name" },
        title: {
          type: "string" as const,
          description: "PR title (auto from task if empty)",
        },
        head: {
          type: "string" as const,
          description: "Branch with changes (auto from task if empty)",
        },
        base: {
          type: "string" as const,
          description: "Target branch (default main)",
        },
        body: {
          type: "string" as const,
          description: "Optional PR description",
        },
      },
      required: ["owner", "repo"],
    },
  },
];

function getTools(githubAccessToken: string | null): MessageTool[] {
  return githubAccessToken ? [...BASE_TOOLS, ...GITHUB_TOOLS] : BASE_TOOLS;
}

function slugifyForBranch(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "changes"
  );
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
    // No sections: parse inline code blocks or emit as text
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

export async function runAgentWithTools(
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
    /** Called when a tool produces an artifact (e.g. PR created); runner creates task_artifacts row. */
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
      "No Anthropic API key configured. Add your key in Settings → API Keys.",
      {
        source: "runner",
      }
    );
    return { paused: false, fullText: "", messages: [] };
  }

  const client = new Anthropic({ apiKey });
  const model = resolveModel(agent.model);
  const githubAccessToken = options.githubAccessToken ?? null;
  const tools = getTools(githubAccessToken);

  const systemPrompt = `You are an AI assistant working on a task. Structure your response so the execution console can show clear sections.

Rules:
- Start each major step or action with a section heading on its own line: ## <short action title>
- For any commands you describe or run, wrap them in a fenced code block with \`\`\`bash or \`\`\` (command on lines after the opener, then \`\`\` to close).
- Describe what you're doing concisely.
- GitHub and other integrations are connected by the user in Settings → Integrations. When GitHub is connected, you can use github_search_repositories, github_get_file, github_list_issues, github_list_repos, github_list_branches, github_list_commits, and github_create_pull_request. Use github_list_branches and github_list_commits to verify branches and commits before creating a PR. Use github_create_pull_request when the task asks you to open a PR—the PR link will appear in artifacts.
- If you need to ask the user a question, get confirmation, or have them provide data, call request_user_input with a clear message.
- IMPORTANT: Do not consider the task complete until you have fulfilled ALL requirements. If the task asks you to create a PR, you MUST call github_create_pull_request before finishing—do not stop after fetching files, analyzing code, or making local changes. Only finish after the PR is created (or you have explicitly asked the user for input).`;

  const userContent = `Task: ${task.title}\n\n${
    task.description || "No additional description."
  }\n\nWork through this task. Start with a ## section title for your first step.`;

  let messages: unknown[] = resumeState
    ? [
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
      ]
    : [{ role: "user" as const, content: userContent }];

  let fullText = "";

  await onLog("info", resumeState ? "Resuming agent…" : "Starting agent…", {
    source: "runner",
    model,
  });

  const MAX_TOOL_ROUNDS = 10;
  let round = 0;
  let lastResponse!: Message;

  while (round < MAX_TOOL_ROUNDS) {
    round++;
    const response = await client.messages.create({
      model,
      max_tokens: 20000,
      system: systemPrompt,
      messages: messages as MessageParam[],
      tools,
    });
    lastResponse = response;

    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const stopReason = (response as { stop_reason?: string }).stop_reason;

    for (const block of textBlocks) {
      if (block.type === "text") {
        fullText += block.text;
        if (options.onStreamChunk) {
          emitTextAsChunks(block.text, options.onStreamChunk);
        }
      }
    }

    if (toolUseBlocks.length === 0) {
      // Response was truncated (hit token limit) — continue the conversation instead of finishing
      const wasTruncated =
        stopReason === "max_tokens" ||
        stopReason === "model_context_window_exceeded";
      if (wasTruncated) {
        await onLog("warn", "Response truncated (token limit); continuing…", {
          source: "runner",
          stop_reason: stopReason,
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
        messages = [
          ...messages,
          { role: "assistant" as const, content: response.content },
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
        const msg = m as { role?: string; content?: unknown };
        if (msg.role !== "assistant") return false;
        const c = msg.content;
        if (!Array.isArray(c)) return false;
        return (c as Array<{ type?: string; name?: string }>).some(
          (x) =>
            x.type === "tool_use" && x.name === "github_create_pull_request"
        );
      });

      if (process.env.NODE_ENV === "development") {
        const lastText =
          (response.content as Array<{ type?: string; text?: string }>)
            ?.filter((b) => b.type === "text")
            .map((b) => b.text ?? "")
            .join("")
            .slice(0, 300) ?? "";
        console.log(
          "[Agent Debug] Model returned with no tool calls, considering done:",
          {
            round,
            stop_reason: stopReason,
            toolUseBlocksCount: toolUseBlocks.length,
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
      }

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
          { role: "assistant" as const, content: response.content },
          {
            role: "user" as const,
            content:
              "You have not yet completed the task. The task requires creating a pull request. You MUST call github_create_pull_request now. Do not stop with text only—call the tool.",
          },
        ];
        continue;
      }

      // When stop_reason is "end_turn" with no tool calls, pause for user input instead of marking done
      if (stopReason === "end_turn") {
        const syntheticId = `synthetic-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;
        const agentText = (
          response.content as Array<{ type?: string; text?: string }>
        )
          ?.filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("")
          .trim();
        const seemsToAskForInput =
          /would you|could you|please provide|should i |can you provide|i need (to|your)|would you like to|or should i |confirm|locating|having difficulty/i.test(
            agentText
          ) || agentText.includes("?");
        const promptMessage =
          seemsToAskForInput && agentText.length > 0
            ? agentText.slice(-1200)
            : "The agent has finished its response. Please review and confirm—type 'done' to complete, or provide feedback to continue.";
        const assistantWithToolUse = [
          ...(response.content as unknown as Array<Record<string, unknown>>),
          {
            type: "tool_use" as const,
            id: syntheticId,
            name: "request_user_input",
            input: { message: promptMessage },
          },
        ];
        const prompt = { kind: "user_prompt" as const, message: promptMessage };

        await onLog(
          "info",
          "Agent stopped with no tool calls; pausing for user input.",
          {
            source: "runner",
            stop_reason: stopReason,
          }
        );
        options.onStreamPrompt?.(prompt);
        options.onStreamChunk?.({
          type: "user_prompt",
          message: promptMessage,
        });

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
        stop_reason: stopReason ?? "end_turn",
      });
      return {
        paused: false,
        fullText,
        messages: [
          ...messages,
          { role: "assistant" as const, content: response.content },
        ] as Array<Record<string, unknown>>,
      };
    }

    const toolUse = toolUseBlocks[0];
    if (toolUse.type !== "tool_use") {
      return { paused: false, fullText, messages: [] };
    }

    const { name, id, input } = toolUse;

    await onLog("info", `Tool use: ${name}`, {
      source: "runner",
      tool: name,
      stop_reason: stopReason,
    });

    if (name === "request_user_input") {
      const message =
        (input as { message?: string })?.message ??
        "Please provide your input.";
      const prompt = { kind: "user_prompt" as const, message };

      await onLog("info", "Agent needs user input", {
        source: "runner",
        ...prompt,
      });
      options.onStreamPrompt?.(prompt);
      options.onStreamChunk?.({ type: "user_prompt", message });

      return {
        paused: true,
        fullText,
        prompt,
        messages: [
          ...messages,
          { role: "assistant" as const, content: response.content },
        ],
        pendingToolCallId: id,
      };
    }

    if (GITHUB_TOOL_NAMES.has(name as GitHubToolName) && githubAccessToken) {
      let toolInput = { ...((input as Record<string, unknown>) ?? {}) };
      if (name === "github_create_pull_request") {
        const title = String(toolInput.title ?? "").trim();
        const head = String(toolInput.head ?? "").trim();
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
        const owner = String(toolInput.owner ?? "").trim();
        const repo = String(toolInput.repo ?? "").trim();
        const path = String(toolInput.path ?? "").trim();
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
          // ignore parse errors
        }
      }

      messages = [
        ...messages,
        { role: "assistant" as const, content: response.content },
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
      { role: "assistant" as const, content: response.content },
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
  const finalMessages = [
    ...messages,
    { role: "assistant" as const, content: lastResponse.content },
  ] as Array<Record<string, unknown>>;
  return { paused: false, fullText, messages: finalMessages };
}
