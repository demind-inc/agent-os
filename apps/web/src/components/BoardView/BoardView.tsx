"use client";

import type { Task, TaskStatus } from "@/types/domain";
import { StatusColumn } from "@/components/StatusColumn/StatusColumn";
import "./BoardView.scss";

const COLUMNS: { key: TaskStatus; label: string; className?: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "ai_working", label: "AI Working" },
  { key: "in_review", label: "In Review" },
  { key: "done", label: "Done" },
  { key: "failed", label: "Failed" }
];

type BoardViewProps = {
  tasks: Task[];
  projectName: string;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onRun: (taskId: string) => void;
  onOpen: (taskId: string) => void;
};

export function BoardView({
  tasks,
  projectName,
  onUpdateStatus,
  onDelete,
  onRun,
  onOpen
}: BoardViewProps) {
  return (
    <div className="boardView">
      {COLUMNS.map((col) => (
        <StatusColumn
          key={col.key}
          statusKey={col.key}
          label={col.label}
          className={col.className ?? ""}
          tasks={tasks.filter((t) => t.status === col.key)}
          projectName={projectName}
          statusColumns={COLUMNS}
          onUpdateStatus={onUpdateStatus}
          onDelete={onDelete}
          onRun={onRun}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
