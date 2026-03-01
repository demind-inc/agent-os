export type TaskStatus =
  | "backlog"
  | "ai_working"
  | "needs_human_input"
  | "in_review"
  | "done"
  | "failed";

export type RunStatus = "queued" | "running" | "awaiting_input" | "completed" | "failed";
