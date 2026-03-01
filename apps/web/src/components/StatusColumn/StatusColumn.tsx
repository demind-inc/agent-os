"use client";

import type { Task, TaskStatus } from "@/types/domain";
import { TaskCard } from "@/components/TaskCard/TaskCard";
import "./StatusColumn.scss";

type StatusColumnProps = {
  statusKey: TaskStatus;
  label: string;
  className?: string;
  tasks: Task[];
  projectName: string;
  statusColumns: { key: TaskStatus; label: string }[];
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onRun: (taskId: string) => void;
  onOpen: (taskId: string) => void;
};

export function StatusColumn({
  statusKey,
  label,
  className = "",
  tasks,
  projectName,
  statusColumns,
  onUpdateStatus,
  onDelete,
  onRun,
  onOpen
}: StatusColumnProps) {
  const title = label.toUpperCase().replace(/_/g, " ");
  const isBacklog = statusKey === "backlog";
  const showDot =
    statusKey === "ai_working" ||
    statusKey === "needs_human_input" ||
    statusKey === "failed";

  return (
    <div className={`statusColumn ${className}`} data-status={statusKey}>
      <div className="statusColumn__header">
        {showDot && <span className="statusColumn__dot" aria-hidden />}
        {isBacklog && (
          <span className="statusColumn__plus" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </span>
        )}
        <h3 className="statusColumn__title">{title}</h3>
        <span className="statusColumn__count">{tasks.length}</span>
      </div>
      <div className="statusColumn__list column">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            projectName={projectName}
            statusColumns={statusColumns}
            onUpdateStatus={onUpdateStatus}
            onDelete={onDelete}
            onRun={onRun}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}
