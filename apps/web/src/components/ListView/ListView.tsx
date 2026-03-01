"use client";

import type { Task } from "@/types/domain";
import "./ListView.scss";

type ListViewProps = {
  tasks: Task[];
  onOpen: (taskId: string) => void;
  onRun: (taskId: string) => void;
};

export function ListView({ tasks, onOpen, onRun }: ListViewProps) {
  return (
    <div className="card listView">
      {tasks.map((task) => (
        <div key={task.id} className="listView__row">
          <div className="listView__cell">
            <strong>{task.title}</strong>
            <div>{task.status}</div>
          </div>
          <div className="listView__actions">
            <button type="button" className="listView__btn" onClick={() => onOpen(task.id)}>
              Open
            </button>
            <button type="button" className="listView__btn" onClick={() => onRun(task.id)}>
              Run
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
