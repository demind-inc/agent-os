"use client";

import type { Agent, AgentRun, Task } from "@/types/domain";
import "./ActiveAgentsSidebar.scss";

type ActiveAgentsSidebarProps = {
  runs: AgentRun[];
  tasks: Task[];
  agents?: Agent[];
};

export function ActiveAgentsSidebar({ runs, tasks, agents = [] }: ActiveAgentsSidebarProps) {
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
          activeRuns.map((run) => {
            const agent = agents.find((a) => a.id === run.agent_id);
            const agentName = agent?.name ?? "Agent";
            return (
            <div key={run.id} className="activeAgentsSidebar__item">
              <div className="activeAgentsSidebar__agentName">{agentName}</div>
              <div className="activeAgentsSidebar__taskTitle">
                {tasks.find((t) => t.id === run.task_id)?.title ?? "Unknown task"}
              </div>
              <span className="activeAgentsSidebar__status">{run.status}</span>
            </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
