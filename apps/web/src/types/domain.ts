export type TaskStatus =
  | "backlog"
  | "ai_working"
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
  assigned_agent_id?: string | null;
  metadata: Record<string, unknown>;
}

export interface AgentRun {
  id: string;
  task_id: string;
  agent_id: string;
  status: RunStatus;
  created_at: string;
  /** Source of run: null for app-triggered, or codex/claude/openclaw for external agents. */
  source?: string | null;
}

export type AgentBackend = "claude" | "codex";

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  backend: AgentBackend;
  model: string;
  config: { skills?: string[] };
  created_at: string;
}
