"use client";

import type { Task } from "@/types/domain";
import { apiFetch } from "@/lib/api/client";
import "./TaskDetailPanel.scss";

type TaskLog = {
  id: string;
  level: string;
  message: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};

type Artifact = { id: string; type: string; title: string; url: string | null };

type TaskDetailPanelProps = {
  task: Task;
  logs: TaskLog[];
  artifacts: Artifact[];
  workspaceId: string;
  onClose: () => void;
  onReview: (taskId: string, action: "approve" | "reject") => void;
};

export function TaskDetailPanel({
  task,
  logs,
  artifacts,
  workspaceId,
  onClose,
  onReview
}: TaskDetailPanelProps) {
  return (
    <section className="taskDetailPanel card">
      <div className="taskDetailPanel__header">
        <strong>{task.title}</strong>
        <button type="button" className="taskDetailPanel__close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="taskDetailPanel__section">
        <h4>Overview</h4>
        <p>{task.description}</p>
        <p>
          Status: <strong>{task.status}</strong>
        </p>
      </div>

      <div className="taskDetailPanel__section">
        <h4>Integrations</h4>
        <div className="taskDetailPanel__integration">
          <strong>GitHub</strong>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <span>Connected via OAuth</span>
            <button
              type="button"
              className="taskDetailPanel__btn taskDetailPanel__btnSecondary"
              onClick={() =>
                apiFetch("/integrations/oauth/start", {
                  method: "POST",
                  body: JSON.stringify({ provider: "github", workspaceId })
                })
              }
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      <div className="taskDetailPanel__section">
        <h4>Execution Console</h4>
        <div className="column">
          {logs.map((log) => (
            <div key={log.id} className="taskDetailPanel__logItem">
              <div className="taskDetailPanel__logMeta">
                <span>{log.level}</span>
                <small>{new Date(log.created_at).toLocaleTimeString()}</small>
              </div>
              <div>{log.message}</div>
              {log.payload && (
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12 }}>
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="taskDetailPanel__section">
        <h4>Artifacts ({artifacts.length})</h4>
        <div className="column">
          {artifacts.map((artifact) => (
            <div key={artifact.id} className="taskDetailPanel__artifactItem">
              <div>
                <strong>{artifact.type}</strong> — {artifact.title}
              </div>
              {artifact.url && (
                <a href={artifact.url} target="_blank" rel="noreferrer">
                  {artifact.url}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {task.status === "in_review" && (
        <div className="taskDetailPanel__reviewActions">
          <button
            type="button"
            className="taskDetailPanel__btn taskDetailPanel__btnSecondary"
            onClick={() => onReview(task.id, "reject")}
          >
            Request changes
          </button>
          <button
            type="button"
            className="taskDetailPanel__btn taskDetailPanel__btnPrimary"
            onClick={() => onReview(task.id, "approve")}
          >
            Approve & continue
          </button>
        </div>
      )}
    </section>
  );
}
