"use client";

import type { AgentRun } from "@/types/domain";
import type { Task } from "@/types/domain";
import "./ActiveAgentsSidebar.scss";

type ActiveAgentsSidebarProps = {
  runs: AgentRun[];
  tasks: Task[];
};

export function ActiveAgentsSidebar({ runs, tasks }: ActiveAgentsSidebarProps) {
  const activeRuns = runs.filter((run) =>
    ["queued", "running", "awaiting_input"].includes(run.status)
  );

  return (
    <aside className="activeAgentsSidebar">
      <h3 className="activeAgentsSidebar__title">Active Agents</h3>
      <div className="activeAgentsSidebar__list">
        {activeRuns.length === 0 ? (
          <span className="activeAgentsSidebar__taskTitle">No active runs</span>
        ) : (
          activeRuns.map((run) => (
            <div key={run.id} className="activeAgentsSidebar__item">
              <div className="activeAgentsSidebar__agentName">{run.agent_id}</div>
              <div className="activeAgentsSidebar__taskTitle">
                {tasks.find((t) => t.id === run.task_id)?.title ?? "Unknown task"}
              </div>
              <span className="activeAgentsSidebar__status">{run.status}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
