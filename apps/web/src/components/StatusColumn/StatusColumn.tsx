"use client";

import type { Task, TaskStatus } from "@/types/domain";
import { TaskCard } from "@/components/TaskCard/TaskCard";
import "./StatusColumn.scss";

type StatusColumnProps = {
  statusKey: TaskStatus;
  label: string;
  className?: string;
  tasks: Task[];
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
  statusColumns,
  onUpdateStatus,
  onDelete,
  onRun,
  onOpen
}: StatusColumnProps) {
  return (
    <div className={`statusColumn ${className}`}>
      <div className="statusColumn__header">
        <strong>{label}</strong>
        <span className="statusColumn__count">{tasks.length}</span>
      </div>
      <div className="statusColumn__list column">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
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
