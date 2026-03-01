"use client";

import type { Agent } from "@/types/domain";
import "./NewTaskPanel.scss";

type NewTaskPanelProps = {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  agents: Agent[];
  selectedAgentId: string;
  onAgentChange: (agentId: string) => void;
  suggestedSkills: string[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  onClose: () => void;
};

export function NewTaskPanel({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  agents,
  selectedAgentId,
  onAgentChange,
  suggestedSkills,
  onSubmit,
  isSubmitting = false,
  onClose
}: NewTaskPanelProps) {
  return (
    <aside className="newTaskPanel">
      <div className="newTaskPanel__header">
        <div className="newTaskPanel__headerLeft">
          <div className="newTaskPanel__icon" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </div>
          <h2 className="newTaskPanel__title">Create New Task</h2>
        </div>
        <button
          type="button"
          className="newTaskPanel__close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
          </svg>
        </button>
      </div>
      <form id="newTaskPanelForm" className="newTaskPanel__body" onSubmit={onSubmit}>
        <div className="newTaskPanel__field">
          <label className="newTaskPanel__label" htmlFor="new-task-title">
            Task title
          </label>
          <input
            id="new-task-title"
            className="newTaskPanel__input"
            required
            placeholder="Enter task title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>
        <div className="newTaskPanel__field">
          <label className="newTaskPanel__label" htmlFor="new-task-desc">
            Description (optional)
          </label>
          <textarea
            id="new-task-desc"
            className="newTaskPanel__textarea"
            placeholder="Add a description..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={4}
          />
        </div>
        <div className="newTaskPanel__field">
          <label className="newTaskPanel__label">Project</label>
          <div className="newTaskPanel__input newTaskPanel__input--readonly">Current project</div>
        </div>
        <div className="newTaskPanel__field">
          <label className="newTaskPanel__label" htmlFor="new-task-agent">
            Assign AI Agent <span className="newTaskPanel__required">*</span>
          </label>
          {agents.length === 0 ? (
            <p className="newTaskPanel__noAgents">No agents yet. Add one in Settings → AI Agents.</p>
          ) : (
            <select
              id="new-task-agent"
              className="newTaskPanel__input newTaskPanel__select"
              value={selectedAgentId}
              onChange={(e) => onAgentChange(e.target.value)}
              required
              aria-required
            >
              <option value="">Select an agent…</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.backend} · {agent.model})
                </option>
              ))}
            </select>
          )}
        </div>
        {suggestedSkills.length > 0 && (
          <div className="newTaskPanel__field">
            <span className="newTaskPanel__label">Suggested skills for this task</span>
            <div className="newTaskPanel__suggestedSkills">
              {suggestedSkills.map((skill) => (
                <span key={skill} className="newTaskPanel__skillChip">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </form>
      <div className="newTaskPanel__footer">
        <button type="button" className="newTaskPanel__btn newTaskPanel__btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="submit"
          form="newTaskPanelForm"
          className="newTaskPanel__btn newTaskPanel__btn--primary"
          disabled={agents.length === 0 || isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <span className="newTaskPanel__spinner" aria-hidden />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM7 16l1 3 2-2 2 2 1-3-2-2 2-2-3-1-2 2-2-2-3 1 2 2-2 2 1 3z" />
            </svg>
          )}
          {isSubmitting ? "Creating…" : "Create Task"}
        </button>
      </div>
    </aside>
  );
}
