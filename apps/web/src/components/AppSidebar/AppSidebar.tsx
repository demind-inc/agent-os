"use client";

import type { AgentRun, Task } from "@/types/domain";
import "./AppSidebar.scss";

const AGENT_AVATAR_COLORS = ["#8B5CF6", "#14B8A6", "#3B82F6", "#F59E0B", "#10B981"];

type AppSidebarProps = {
  projectTitle?: string;
  view: "board" | "list" | "newtask";
  onViewChange: (view: "board" | "list" | "newtask") => void;
  onNewTaskClick: () => void;
  runs: AgentRun[];
  tasks: Task[];
  userInitials?: string;
};

export function AppSidebar({
  projectTitle = "[untitled]",
  view,
  onViewChange,
  onNewTaskClick,
  runs,
  tasks,
  userInitials = "JD"
}: AppSidebarProps) {
  const activeRuns = runs.filter((run) =>
    ["queued", "running", "awaiting_input"].includes(run.status)
  );

  return (
    <aside className="appSidebar">
      <div className="appSidebar__header">
        <div className="appSidebar__logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4zm-4 6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8z" />
          </svg>
        </div>
        <span className="appSidebar__title">{projectTitle}</span>
      </div>
      <nav className="appSidebar__nav">
        <button
          type="button"
          className={`appSidebar__navItem ${view === "board" ? "appSidebar__navItem--active" : ""}`}
          onClick={() => onViewChange("board")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
          </svg>
          Board View
        </button>
        <button
          type="button"
          className={`appSidebar__navItem ${view === "list" ? "appSidebar__navItem--active" : ""}`}
          onClick={() => onViewChange("list")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
          </svg>
          List View
        </button>
        <button
          type="button"
          className={`appSidebar__navItem appSidebar__navItem--primary ${view === "newtask" ? "appSidebar__navItem--active" : ""}`}
          onClick={onNewTaskClick}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          New Task
        </button>
      </nav>
      <div className="appSidebar__agents">
        <h3 className="appSidebar__agentsTitle">ACTIVE AGENTS</h3>
        <div className="appSidebar__agentsList">
          {activeRuns.length === 0 ? (
            <span className="appSidebar__agentsEmpty">No active runs</span>
          ) : (
            activeRuns.map((run, i) => (
              <div key={run.id} className="appSidebar__agentItem">
                <div
                  className="appSidebar__agentAvatar"
                  style={{ backgroundColor: AGENT_AVATAR_COLORS[i % AGENT_AVATAR_COLORS.length] }}
                >
                  {(run.agent_id || "A").slice(0, 2).toUpperCase()}
                </div>
                <div className="appSidebar__agentInfo">
                  <span className="appSidebar__agentName">{run.agent_id || "Agent"}</span>
                  <span className="appSidebar__agentTask">
                    {tasks.find((t) => t.id === run.task_id)?.title ?? "Unknown task"}
                  </span>
                  <span className={`appSidebar__agentStatus appSidebar__agentStatus--${run.status}`}>
                    {run.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
