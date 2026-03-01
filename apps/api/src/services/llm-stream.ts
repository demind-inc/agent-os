import Anthropic from "@anthropic-ai/sdk";

export type StreamLogCallback = (
  level: string,
  message: string,
  payload?: Record<string, unknown>
) => void | Promise<void>;

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
 * Stream a task through Claude and invoke onLog for each piece of streamed content.
 * Logs come from the model stream (content_block_delta text), not hardcoded messages.
 * Uses the provided apiKey (user's own key from settings); if missing, skips the stream.
 */
export async function streamTaskWithClaude(
  task: { title: string; description: string },
  agent: { model: string },
  onLog: StreamLogCallback,
  apiKey: string | null
): Promise<{ fullText: string }> {
  if (!apiKey || !apiKey.trim()) {
    await onLog("warn", "No Anthropic API key configured. Add your key in Settings → API Keys.", {
      source: "runner",
    });
    return { fullText: "" };
  }

  const client = new Anthropic({ apiKey });
  const model = resolveModel(agent.model);

  const systemPrompt = `You are an AI assistant working on a task. Respond concisely. Describe what you're doing step by step as you work.`;
  const userContent = `Task: ${task.title}\n\n${task.description || "No additional description."}\n\nBriefly outline how you would approach this task (2-4 short steps).`;

  let fullText = "";
  const lineBuffer: string[] = [];
  const flushBuffer = async () => {
    if (lineBuffer.length === 0) return;
    const message = lineBuffer.join("").trim();
    if (message) await onLog("info", message, { source: "model" });
    lineBuffer.length = 0;
  };

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
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i === lines.length - 1 && !text.endsWith("\n")) {
          lineBuffer.push(lines[i]!);
        } else {
          lineBuffer.push(lines[i]!);
          lineBuffer.push("\n");
          void flushBuffer();
        }
      }
    });

    stream
      .finalMessage()
      .then(async () => {
        await flushBuffer();
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
