"use client";

import type { Agent } from "@/types/domain";

type AgentsTabProps = {
  agentsList: Agent[];
  agentsLoading: boolean;
  onEditAgent: (agent: Agent) => void;
};

export function AgentsTab({
  agentsList,
  agentsLoading,
  onEditAgent,
}: AgentsTabProps) {
  return (
    <div className="settingsPage__list">
      {agentsLoading ? (
        <div className="settingsPage__loadingWrap">
          <div className="settingsPage__spinner" aria-label="Loading agents" />
        </div>
      ) : (
        agentsList.map((agent) => (
          <div key={agent.id} className="settingsPage__agentCard">
            <div className="settingsPage__agentAvatar settingsPage__agentAvatar--purple">
              {agent.name.charAt(0)}
            </div>
            <div className="settingsPage__agentInfo">
              <span className="settingsPage__agentName">
                {agent.name}
              </span>
              <span className="settingsPage__agentDesc">
                {agent.backend} · {agent.model}
                {agent.config?.skills?.length
                  ? ` · ${agent.config.skills.join(", ")}`
                  : ""}
              </span>
            </div>
            <div className="settingsPage__rowActions">
              <button
                type="button"
                className="settingsPage__iconBtn"
                aria-label="Edit agent"
                onClick={() => onEditAgent(agent)}
              >
                <span
                  className="settingsPage__icon"
                  data-icon="pencil"
                  aria-hidden
                />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
