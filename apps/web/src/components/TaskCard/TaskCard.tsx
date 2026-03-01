"use client";

import type { Task, TaskStatus } from "@/types/domain";
import "./TaskCard.scss";

type TaskCardProps = {
  task: Task;
  statusColumns: { key: TaskStatus; label: string }[];
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onRun: (taskId: string) => void;
  onOpen: (taskId: string) => void;
};

export function TaskCard({
  task,
  statusColumns,
  onUpdateStatus,
  onDelete,
  onRun,
  onOpen
}: TaskCardProps) {
  const skills = Array.isArray(task.metadata?.detectedSkills)
    ? (task.metadata.detectedSkills as string[])
    : [];

  return (
    <div className="taskCard column">
      <div className="taskCard__header">
        <strong className="taskCard__title">{task.title}</strong>
        <button type="button" className="taskCard__btn" onClick={() => onDelete(task.id)}>
          Delete
        </button>
      </div>
      <span className="taskCard__desc">{task.description || "No description"}</span>
      {skills.length > 0 && (
        <div className="taskCard__skills">
          {skills.map((skill) => (
            <span key={skill} className="taskCard__skill">
              {skill}
            </span>
          ))}
        </div>
      )}
      <div className="taskCard__actions">
        {statusColumns
          .filter((c) => c.key !== task.status)
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
        <button type="button" className="taskCard__btn" onClick={() => onOpen(task.id)}>
          Open
        </button>
      </div>
    </div>
  );
}
