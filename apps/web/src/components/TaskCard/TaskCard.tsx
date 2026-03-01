"use client";

import type { Task, TaskStatus } from "@/types/domain";
import "./TaskCard.scss";

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  ai_working: "Working",
  needs_human_input: "Needs input",
  in_review: "In review",
  done: "Done",
  failed: "Failed"
};

type TaskCardProps = {
  task: Task;
  projectName: string;
  statusColumns: { key: TaskStatus; label: string }[];
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onRun: (taskId: string) => void;
  onOpen: (taskId: string) => void;
};

export function TaskCard({
  task,
  projectName,
  statusColumns,
  onUpdateStatus,
  onDelete,
  onRun,
  onOpen
}: TaskCardProps) {
  const statusLabel = STATUS_LABELS[task.status] ?? task.status;

  return (
    <div
      className="taskCard"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task.id);
        }
      }}
    >
      <div className="taskCard__header">
        <div className="taskCard__icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 2l5 5h-5V4zM8 12h8v2H8v-2zm0 4h5v2H8v-2z" />
          </svg>
        </div>
        <span className={`taskCard__statusBadge taskCard__statusBadge--${task.status}`}>
          {statusLabel}
        </span>
      </div>
      <h4 className="taskCard__title">{task.title}</h4>
      {task.description && (
        <p className="taskCard__desc">{task.description}</p>
      )}
      <div className="taskCard__footer">
        <span className="taskCard__projectBadge">{projectName}</span>
        <div className="taskCard__assignee" title="Assignee">—</div>
      </div>
      <div className="taskCard__actions" onClick={(e) => e.stopPropagation()}>
        {statusColumns
          .filter((c) => c.key !== task.status)
          .slice(0, 3)
          .map((c) => (
            <button
              key={c.key}
              type="button"
              className="taskCard__btn"
              onClick={() => onUpdateStatus(task.id, c.key)}
            >
              {c.label}
            </button>
          ))}
        <button type="button" className="taskCard__btn" onClick={() => onRun(task.id)}>
          Run
        </button>
      </div>
    </div>
  );
}
