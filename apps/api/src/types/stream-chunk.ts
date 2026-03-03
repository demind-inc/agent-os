/**
 * Structured stream chunk types for execution console.
 * Emitted over WebSocket; no DB storage during stream.
 */

export type StreamChunk =
  | { type: "text"; content: string }
  | { type: "section"; title: string; content?: string }
  | {
      type: "command";
      command: string;
      output?: string;
      status?: "running" | "done" | "error";
    }
  | {
      type: "read_file";
      path: string;
      summary?: string;
      tokens?: number;
    }
  | { type: "user_prompt"; message: string }
  | {
      type: "agent_log";
      level: string;
      message: string;
      payload?: Record<string, unknown>;
    };
