"use client";

import type { Task } from "@/types/domain";
import "./ListView.scss";

const STATUS_PILL_CLASS: Record<string, string> = {
  backlog: "listView__statusPill--muted",
  ai_working: "listView__statusPill--success",
  needs_human_input: "listView__statusPill--warn",
  in_review: "listView__statusPill--muted",
  done: "listView__statusPill--muted",
  failed: "listView__statusPill--danger"
};

type ListViewProps = {
  tasks: Task[];
  projectName: string;
  onOpen: (taskId: string) => void;
  onRun: (taskId: string) => void;
};

export function ListView({ tasks, projectName, onOpen, onRun }: ListViewProps) {
  return (
    <div className="listView">
      <table className="listView__table">
        <thead className="listView__header">
          <tr>
            <th className="listView__headerCell">Task</th>
            <th className="listView__headerCell">Status</th>
            <th className="listView__headerCell">Agent</th>
            <th className="listView__headerCell">Project</th>
            <th className="listView__headerCell">Progress</th>
            <th className="listView__headerCell listView__headerCell--actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              className="listView__row"
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
              <td className="listView__cell listView__cellTitle">{task.title}</td>
              <td className="listView__cell">
                <span className={`listView__statusPill ${STATUS_PILL_CLASS[task.status] ?? "listView__statusPill--muted"}`}>
                  {task.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="listView__cell listView__cellMuted">{projectName}</td>
              <td className="listView__cell listView__cellMuted">—</td>
              <td className="listView__cell listView__cellMuted">—</td>
              <td className="listView__cell" onClick={(e) => e.stopPropagation()}>
                <div className="listView__actions">
                  <button type="button" className="listView__btn" onClick={() => onOpen(task.id)}>
                    Open
                  </button>
                  {task.status === "backlog" && (
                    <button
                      type="button"
                      className="listView__btn listView__btn--primary"
                      onClick={() => onRun(task.id)}
                    >
                      Run
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
