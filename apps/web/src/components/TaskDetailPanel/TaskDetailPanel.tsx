"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
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

/** Structured payload for "action" entries (e.g. Read file, tool use). */
type ActionPayload = {
  kind: "action";
  tool?: string;
  path?: string;
  result?: string;
  summary?: string;
  [key: string]: unknown;
};

/** Structured payload for "command" entries (run command with terminal output). */
type CommandPayload = {
  kind: "command";
  command?: string;
  output?: string;
  status?: "done" | "running" | "error";
  [key: string]: unknown;
};

function isActionPayload(
  p: Record<string, unknown> | null
): p is ActionPayload {
  return p != null && p.kind === "action";
}
function isCommandPayload(
  p: Record<string, unknown> | null
): p is CommandPayload {
  return p != null && p.kind === "command";
}

type Artifact = {
  id: string;
  type: string;
  title: string;
  url: string | null;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

type TaskDetailPanelProps = {
  task: Task;
  logs: TaskLog[];
  artifacts: Artifact[];
  onRun: (taskId: string) => void;
  isRunning?: boolean;
  onClose: () => void;
  onReview: (taskId: string, action: "approve" | "reject") => void;
  onDelete: (taskId: string) => void | Promise<void>;
  onTaskUpdate: (updatedTask: Task) => void;
  assignedAgentBackend?: "claude" | "codex" | null;
  providerApiKeysConfigured?: { anthropic?: boolean; openai?: boolean };
};

export function TaskDetailPanel({
  task,
  logs,
  artifacts,
  onRun,
  isRunning = false,
  onClose,
  onReview,
  onDelete,
  onTaskUpdate,
  assignedAgentBackend = null,
  providerApiKeysConfigured = {},
}: TaskDetailPanelProps) {
  const hasApiKeyForAgent =
    !assignedAgentBackend ||
    (assignedAgentBackend === "claude" &&
      providerApiKeysConfigured.anthropic) ||
    (assignedAgentBackend === "codex" && providerApiKeysConfigured.openai);
  const apiKeyError =
    task.status === "backlog" &&
    assignedAgentBackend &&
    !hasApiKeyForAgent &&
    (assignedAgentBackend === "claude"
      ? !providerApiKeysConfigured.anthropic
      : !providerApiKeysConfigured.openai);
  const apiKeyErrorMessage =
    assignedAgentBackend === "claude"
      ? "Connect your Anthropic API key in Settings → API Keys to run this task."
      : "Connect your OpenAI API key in Settings → API Keys to run this task.";
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(task.title);
  const [editDescriptionValue, setEditDescriptionValue] = useState(
    task.description ?? ""
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null
  );
  const [previewCopied, setPreviewCopied] = useState(false);
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

  useEffect(() => {
    setPreviewCopied(false);
  }, [selectedArtifact?.id]);

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
        body: JSON.stringify({ title: trimmed }),
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
        body: JSON.stringify({ description: value }),
      });
      onTaskUpdate(updated);
    } catch {
      setEditDescriptionValue(task.description ?? "");
    }
  }

  return (
    <>
      <div
        className="taskDetailPanel__backdrop"
        onClick={onClose}
        aria-hidden
      />
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
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
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
          <div className="taskDetailPanel__headerActions">
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
                <span
                  className="taskDetailPanel__icon"
                  data-icon="trash"
                  aria-hidden
                />
              )}
            </button>
            <button
              type="button"
              className="taskDetailPanel__iconBtn taskDetailPanel__close"
              onClick={onClose}
              aria-label="Close panel"
            >
              <span
                className="taskDetailPanel__icon"
                data-icon="x"
                aria-hidden
              />
            </button>
          </div>
        </div>
        <div className="taskDetailPanel__statusRow">
          <span className="badge badge--muted">
            {task.status.replace(/_/g, " ")}
          </span>
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
                onKeyDown={(e) =>
                  e.key === "Enter" && setEditingDescription(true)
                }
              >
                {task.description || "No description."}
              </p>
            )}
          </div>
          <div className="taskDetailPanel__section">
            <h4>Execution Console</h4>
            <div className="taskDetailPanel__console column">
              {logs.length === 0 ? (
                <p className="taskDetailPanel__consoleEmpty">No logs yet.</p>
              ) : (
                logs.map((log) => {
                  const timeStr = new Date(log.created_at).toLocaleTimeString();
                  const payload = log.payload as Record<string, unknown> | null;

                  if (isActionPayload(payload)) {
                    const toolLabel =
                      payload.tool === "read_file"
                        ? "Read file"
                        : (payload.tool as string)?.replace(/_/g, " ") ??
                          "Action";
                    return (
                      <div
                        key={log.id}
                        className="taskDetailPanel__consoleEntry taskDetailPanel__consoleAction"
                      >
                        <div className="taskDetailPanel__consoleMeta">
                          <span className="taskDetailPanel__consoleTime">
                            {timeStr}
                          </span>
                        </div>
                        <div className="taskDetailPanel__consoleActionCard">
                          <div className="taskDetailPanel__consoleActionTitle">
                            {toolLabel}
                          </div>
                          {payload.path != null && (
                            <div className="taskDetailPanel__consoleActionPath">
                              {String(payload.path)}
                            </div>
                          )}
                          {(payload.result != null ||
                            payload.summary != null) && (
                            <div className="taskDetailPanel__consoleActionResult">
                              {String(payload.result ?? payload.summary ?? "")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (isCommandPayload(payload)) {
                    const isStreaming = payload.status === "running";
                    const status =
                      payload.status === "done"
                        ? "Done"
                        : payload.status === "error"
                        ? "Error"
                        : isStreaming
                        ? "Running"
                        : null;
                    const output = payload.output != null ? String(payload.output) : "";
                    const showOutput = isStreaming || output !== "";
                    return (
                      <div
                        key={log.id}
                        className={`taskDetailPanel__consoleEntry taskDetailPanel__consoleCommand ${isStreaming ? "taskDetailPanel__consoleCommand--streaming" : ""}`}
                      >
                        <div className="taskDetailPanel__consoleMeta">
                          <span className="taskDetailPanel__consoleTime">
                            {timeStr}
                          </span>
                          {status && (
                            <span
                              className={`taskDetailPanel__consoleCommandStatus taskDetailPanel__consoleCommandStatus--${payload.status}`}
                            >
                              • {status}
                            </span>
                          )}
                        </div>
                        <div className="taskDetailPanel__consoleCommandBlock">
                          <div className="taskDetailPanel__consoleCommandLabel">
                            &gt;_ Run command
                          </div>
                          <div className="taskDetailPanel__consoleCommandTerminal">
                            <code className="taskDetailPanel__consoleCommandLine">
                              $ {payload.command ?? log.message}
                            </code>
                            {showOutput && (
                              <>
                                <div className="taskDetailPanel__consoleCommandOutputLabel">
                                  # Output
                                </div>
                                <pre className="taskDetailPanel__consoleCommandOutput">
                                  {output}
                                  {isStreaming && (
                                    <span className="taskDetailPanel__consoleCommandCursor" aria-hidden />
                                  )}
                                </pre>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={log.id}
                      className="taskDetailPanel__consoleEntry taskDetailPanel__consoleText"
                    >
                      <div className="taskDetailPanel__consoleMeta">
                        <span className="taskDetailPanel__consoleLevel">
                          {log.level}
                        </span>
                        <span className="taskDetailPanel__consoleTime">
                          {timeStr}
                        </span>
                      </div>
                      <div className="taskDetailPanel__consoleTextMessage">
                        {log.message}
                      </div>
                      {payload &&
                        Object.keys(payload).length > 0 &&
                        payload.kind !== "action" &&
                        payload.kind !== "command" && (
                          <pre className="taskDetailPanel__consolePayload">
                            {JSON.stringify(payload, null, 2)}
                          </pre>
                        )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="taskDetailPanel__section">
            <h4>Artifacts ({artifacts.length})</h4>
            <div className="column">
              {artifacts.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  No artifacts yet.
                </p>
              ) : (
                artifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    type="button"
                    className="taskDetailPanel__artifactItem"
                    onClick={() => setSelectedArtifact(artifact)}
                  >
                    <div>
                      <strong>{artifact.type}</strong> — {artifact.title}
                    </div>
                    {artifact.url && (
                      <span className="taskDetailPanel__artifactItemUrl">
                        {artifact.url}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="taskDetailPanel__footer">
          {apiKeyError && (
            <div className="taskDetailPanel__apiKeyError" role="alert">
              {apiKeyErrorMessage}{" "}
              <Link
                href="/settings"
                className="taskDetailPanel__apiKeyErrorLink"
              >
                Settings → API Keys
              </Link>
            </div>
          )}
          <div className="taskDetailPanel__footerActions">
            {task.status === "backlog" && (
              <button
                type="button"
                className="taskDetailPanel__btn taskDetailPanel__btnPrimary"
                onClick={() => onRun(task.id)}
                disabled={isRunning || !hasApiKeyForAgent}
              >
                {isRunning ? "AI working..." : "Let AI work"}
              </button>
            )}
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
                  Approve & complete
                </button>
              </>
            )}
          </div>
        </div>
      </section>
      {selectedArtifact && (
        <div
          className="taskDetailPanel__artifactModalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="artifactModalTitle"
          onClick={() => setSelectedArtifact(null)}
        >
          <div
            className="taskDetailPanel__artifactModal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="taskDetailPanel__artifactModalHeader">
              <h3
                id="artifactModalTitle"
                className="taskDetailPanel__artifactModalTitle"
              >
                Artifact details
              </h3>
              <button
                type="button"
                className="taskDetailPanel__artifactModalClose"
                onClick={() => setSelectedArtifact(null)}
                aria-label="Close"
              >
                <span
                  className="taskDetailPanel__icon"
                  data-icon="x"
                  aria-hidden
                />
              </button>
            </div>
            <div className="taskDetailPanel__artifactModalBody">
              <dl className="taskDetailPanel__artifactDetailList">
                <div className="taskDetailPanel__artifactDetailRow">
                  <dt>Type</dt>
                  <dd>{selectedArtifact.type}</dd>
                </div>
                <div className="taskDetailPanel__artifactDetailRow">
                  <dt>Title</dt>
                  <dd>{selectedArtifact.title}</dd>
                </div>
                {selectedArtifact.url && (
                  <div className="taskDetailPanel__artifactDetailRow">
                    <dt>URL</dt>
                    <dd>
                      <a
                        href={selectedArtifact.url}
                        target="_blank"
                        rel="noreferrer"
                        className="taskDetailPanel__artifactDetailLink"
                      >
                        {selectedArtifact.url}
                      </a>
                    </dd>
                  </div>
                )}
                {selectedArtifact.created_at && (
                  <div className="taskDetailPanel__artifactDetailRow">
                    <dt>Created</dt>
                    <dd>
                      {new Date(selectedArtifact.created_at).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
              {selectedArtifact.metadata &&
                typeof selectedArtifact.metadata.preview === "string" &&
                selectedArtifact.metadata.preview.length > 0 && (
                  <div className="taskDetailPanel__artifactPreview">
                    <div className="taskDetailPanel__artifactPreviewHeader">
                      <h4>Preview</h4>
                      <button
                        type="button"
                        className="taskDetailPanel__artifactPreviewCopy"
                        onClick={async () => {
                          const text =
                            selectedArtifact.metadata?.preview;
                          if (typeof text !== "string") return;
                          try {
                            await navigator.clipboard.writeText(text);
                            setPreviewCopied(true);
                            setTimeout(() => setPreviewCopied(false), 2000);
                          } catch {
                            // ignore
                          }
                        }}
                        aria-label={previewCopied ? "Copied" : "Copy preview"}
                      >
                        {previewCopied ? (
                          "Copied!"
                        ) : (
                          <span
                            className="taskDetailPanel__icon"
                            data-icon="copy"
                            aria-hidden
                          />
                        )}
                      </button>
                    </div>
                    <pre className="taskDetailPanel__artifactPreviewPre">
                      {selectedArtifact.metadata.preview}
                    </pre>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
