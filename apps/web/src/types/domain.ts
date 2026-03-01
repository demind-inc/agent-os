export type TaskStatus =
  | "backlog"
  | "ai_working"
  | "needs_human_input"
  | "in_review"
  | "done"
  | "failed";

export type RunStatus = "queued" | "running" | "awaiting_input" | "completed" | "failed";

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  metadata: Record<string, unknown>;
}

export interface AgentRun {
  id: string;
  task_id: string;
  agent_id: string;
  status: RunStatus;
  created_at: string;
}
