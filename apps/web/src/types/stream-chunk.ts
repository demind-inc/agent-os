/**
 * Structured stream chunk types for execution console.
 * Received over WebSocket; matches backend StreamChunk.
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
  | {
      type: "write_file";
      path: string;
      /** Optional snippet, diff, or summary of changes made. */
      content?: string;
    }
  | { type: "user_prompt"; message: string }
  | {
      type: "agent_log";
      level: string;
      message: string;
      payload?: Record<string, unknown>;
    };
