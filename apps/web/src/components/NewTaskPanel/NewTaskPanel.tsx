"use client";

import "./NewTaskPanel.scss";

type NewTaskPanelProps = {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function NewTaskPanel({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSubmit,
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
          <label className="newTaskPanel__label">Assign AI Agent</label>
          <div className="newTaskPanel__agentList">
            <span className="newTaskPanel__agentPlaceholder">Select an agent (optional)</span>
          </div>
        </div>
      </form>
      <div className="newTaskPanel__footer">
        <button type="button" className="newTaskPanel__btn newTaskPanel__btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" form="newTaskPanelForm" className="newTaskPanel__btn newTaskPanel__btn--primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM7 16l1 3 2-2 2 2 1-3-2-2 2-2-3-1-2 2-2-2-3 1 2 2-2 2 1 3z" />
          </svg>
          Create Task
        </button>
      </div>
    </aside>
  );
}
