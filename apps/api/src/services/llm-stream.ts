import Anthropic from "@anthropic-ai/sdk";

export type StreamLogCallback = (
  level: string,
  message: string,
  payload?: Record<string, unknown>
) => void | Promise<void>;

/** Called with each streamed text chunk; not persisted to DB until stream ends. */
export type StreamChunkCallback = (text: string) => void | Promise<void>;

/** Map app model slugs to Anthropic API model IDs when needed. */
function resolveModel(slug: string): string {
  const map: Record<string, string> = {
    "claude-3-7-sonnet": "claude-sonnet-4-20250514",
    "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
    "claude-3-opus": "claude-3-opus-20240229",
  };
  return map[slug] ?? slug;
}

/**
 * Stream a task through Claude. Streamed text is sent via onStreamChunk only (not stored in DB).
 * Control messages (start/finish) go to onLog. When stream ends, fullText is returned for the
 * runner to store as one row in log or artifact.
 * Use ## Section title for each major step and ``` for command blocks so the UI can render sections.
 */
export async function streamTaskWithClaude(
  task: { title: string; description: string },
  agent: { model: string },
  onLog: StreamLogCallback,
  apiKey: string | null,
  onStreamChunk?: StreamChunkCallback
): Promise<{ fullText: string }> {
  if (!apiKey || !apiKey.trim()) {
    await onLog("warn", "No Anthropic API key configured. Add your key in Settings → API Keys.", {
      source: "runner",
    });
    return { fullText: "" };
  }

  const client = new Anthropic({ apiKey });
  const model = resolveModel(agent.model);

  const systemPrompt = `You are an AI assistant working on a task. Structure your response so the execution console can show clear sections.

Rules:
- Start each major step or action with a section heading on its own line: ## <short action title>
- For any commands you describe or run, wrap them in a fenced code block with \`\`\`bash or \`\`\` (command on lines after the opener, then \`\`\` to close). If there is output, add it after the command block or in a second block.
- Describe what you're doing concisely. Use 2–5 sections for a typical task.`;

  const userContent = `Task: ${task.title}\n\n${task.description || "No additional description."}\n\nWork through this task. Start with a ## section title for your first step, then describe and use \`\`\` blocks for any commands.`;

  let fullText = "";

  await onLog("info", "Starting model stream…", { source: "runner", model });

  const stream = client.messages.stream({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  return new Promise((resolve, reject) => {
    stream.on("text", (text: string) => {
      fullText += text;
      if (onStreamChunk) {
        void Promise.resolve(onStreamChunk(text)).catch(() => {});
      }
    });

    stream
      .finalMessage()
      .then(async () => {
        await onLog("info", "Model stream finished.", { source: "runner" });
        resolve({ fullText });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        void onLog("error", msg, { source: "model", error: String(err) });
        reject(err);
      });
  });
}
