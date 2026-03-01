"use client";

import { useState, useRef, useEffect } from "react";
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
  onClose: () => void;
  onReview: (taskId: string, action: "approve" | "reject") => void;
  onDelete: (taskId: string) => void | Promise<void>;
  onTaskUpdate: (updatedTask: Task) => void;
};

export function TaskDetailPanel({
  task,
  logs,
  artifacts,
  onClose,
  onReview,
  onDelete,
  onTaskUpdate
}: TaskDetailPanelProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(task.title);
  const [editDescriptionValue, setEditDescriptionValue] = useState(task.description ?? "");
  const [isDeleting, setIsDeleting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(task.id));
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    setEditTitleValue(task.title);
    setEditDescriptionValue(task.description ?? "");
  }, [task.id, task.title, task.description]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);
  useEffect(() => {
    if (editingDescription) descriptionInputRef.current?.focus();
  }, [editingDescription]);

  async function saveTitle() {
    setEditingTitle(false);
    const trimmed = editTitleValue.trim();
    if (trimmed === task.title || !trimmed) {
      setEditTitleValue(task.title);
      return;
    }
    try {
      const updated = await apiFetch<Task>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed })
      });
      onTaskUpdate(updated);
    } catch {
      setEditTitleValue(task.title);
    }
  }

  async function saveDescription() {
    setEditingDescription(false);
    const value = editDescriptionValue;
    if (value === (task.description ?? "")) {
      setEditDescriptionValue(task.description ?? "");
      return;
    }
    try {
      const updated = await apiFetch<Task>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: value })
      });
      onTaskUpdate(updated);
    } catch {
      setEditDescriptionValue(task.description ?? "");
    }
  }

  return (
    <section className="taskDetailPanel">
      <div className="taskDetailPanel__header">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            className="taskDetailPanel__titleInput"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Task title"
          />
        ) : (
          <h2
            className="taskDetailPanel__title taskDetailPanel__titleEditable"
            onClick={() => setEditingTitle(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setEditingTitle(true)}
          >
            {task.title}
          </h2>
        )}
        <button
          type="button"
          className="taskDetailPanel__iconBtn taskDetailPanel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <span className="taskDetailPanel__icon" data-icon="x" aria-hidden />
        </button>
      </div>
      <div className="taskDetailPanel__statusRow">
        <span className="badge badge--muted">{task.status.replace(/_/g, " ")}</span>
      </div>
      <div className="taskDetailPanel__body">
        <div className="taskDetailPanel__section">
          <h4>Overview</h4>
          {editingDescription ? (
            <textarea
              ref={descriptionInputRef}
              className="taskDetailPanel__descriptionInput"
              value={editDescriptionValue}
              onChange={(e) => setEditDescriptionValue(e.target.value)}
              onBlur={saveDescription}
              placeholder="No description."
              aria-label="Task description"
            />
          ) : (
            <p
              className="taskDetailPanel__descriptionEditable"
              onClick={() => setEditingDescription(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setEditingDescription(true)}
            >
              {task.description || "No description."}
            </p>
          )}
        </div>
        <div className="taskDetailPanel__section">
          <h4>Execution Console</h4>
          <div className="column">
            {logs.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No logs yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="taskDetailPanel__logItem">
                  <div className="taskDetailPanel__logMeta">
                    <span>{log.level}</span>
                    <small>{new Date(log.created_at).toLocaleTimeString()}</small>
                  </div>
                  <div>{log.message}</div>
                  {log.payload && (
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        marginTop: 8,
                        fontSize: 12,
                        overflow: "auto"
                      }}
                    >
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="taskDetailPanel__section">
          <h4>Artifacts ({artifacts.length})</h4>
          <div className="column">
            {artifacts.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No artifacts yet.</p>
            ) : (
              artifacts.map((artifact) => (
                <div key={artifact.id} className="taskDetailPanel__artifactItem">
                  <div>
                    <strong>{artifact.type}</strong> — {artifact.title}
                  </div>
                  {artifact.url && (
                    <a href={artifact.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      {artifact.url}
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="taskDetailPanel__footer">
        <button
          type="button"
          className="taskDetailPanel__iconBtn taskDetailPanel__btn taskDetailPanel__btnDanger"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Delete task"
        >
          {isDeleting ? (
            <span className="taskDetailPanel__spinner" aria-hidden />
          ) : (
            <span className="taskDetailPanel__icon" data-icon="trash" aria-hidden />
          )}
        </button>
        <div className="taskDetailPanel__footerActions">
          {task.status === "in_review" && (
            <>
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
