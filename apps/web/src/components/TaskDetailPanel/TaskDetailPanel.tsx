"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Task } from "@/types/domain";
import type { StreamChunk } from "@/types/stream-chunk";
import { apiFetch } from "@/lib/api/client";
import {
  useRunStream,
  type StreamChunkEntry,
} from "@/components/RunStreamProvider/RunStreamProvider";
import { parseConsoleSections } from "./parseConsoleSections";
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

type AwaitingInputRun = {
  id: string;
  task_id: string;
  status: string;
};

type TaskDetailPanelProps = {
  task: Task;
  logs: TaskLog[];
  artifacts: Artifact[];
  onRun: (taskId: string) => void;
  isRunning?: boolean;
  /** Run awaiting user input (OAuth, chat response). Shows interactive prompt in console. */
  awaitingInputRun?: AwaitingInputRun | null;
  workspaceId?: string;
  /** Called when user submits input (OAuth completed, chat message) so parent can refetch. */
  onInputSubmitted?: () => void;
  onClose: () => void;
  onReview: (taskId: string, action: "approve" | "reject") => void;
  onDelete: (taskId: string) => void | Promise<void>;
  onTaskUpdate: (updatedTask: Task) => void;
  assignedAgentBackend?: "claude" | "codex" | null;
  providerApiKeysConfigured?: { anthropic?: boolean; openai?: boolean };
  /** Agent display name for chunk headers (e.g. "Writer Agent"). */
  assignedAgentName?: string;
};

/** Payload for interactive prompts from agent (user question). */
function isUserPromptPayload(
  p: Record<string, unknown> | null
): p is { kind?: string; message?: string } {
  return p != null && p.kind === "user_prompt";
}

export function TaskDetailPanel({
  task,
  logs,
  artifacts,
  onRun,
  isRunning = false,
  awaitingInputRun = null,
  workspaceId = "",
  onInputSubmitted,
  onClose,
  onReview,
  onDelete,
  onTaskUpdate,
  assignedAgentBackend = null,
  providerApiKeysConfigured = {},
  assignedAgentName = "Agent",
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
  const [userInputValue, setUserInputValue] = useState("");
  const [isSubmittingInput, setIsSubmittingInput] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const consoleScrollRef = useRef<HTMLDivElement>(null);

  const { streamedChunks } = useRunStream();

  // Auto-scroll console to bottom when streaming so new content is visible
  useEffect(() => {
    if (!isRunning || streamedChunks.length === 0) return;
    consoleScrollRef.current?.scrollTo({
      top: consoleScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isRunning, streamedChunks]);

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

  const promptLog = logs.find((l) =>
    isUserPromptPayload(l.payload as Record<string, unknown> | null)
  );

  async function handleSubmitUserInput(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = userInputValue.trim();
    if (!trimmed || !awaitingInputRun || isSubmittingInput) return;
    setIsSubmittingInput(true);
    try {
      await apiFetch(`/runs/${awaitingInputRun.id}/input`, {
        method: "POST",
        body: JSON.stringify({ type: "text", value: trimmed }),
      });
      setUserInputValue("");
      onInputSubmitted?.();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingInput(false);
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
          {task.status !== "backlog" && (
          <div className="taskDetailPanel__section">
            <h4>Agent Log</h4>
            <div
              ref={consoleScrollRef}
              className="taskDetailPanel__chunkList column"
            >
                {(() => {
                  const executionLogArtifact = artifacts.find(
                    (a) => a.type === "execution_log"
                  );
                  const storedChunks = (executionLogArtifact?.metadata?.chunks as
                    | StreamChunk[]
                    | undefined);
                  const storedContent =
                    (executionLogArtifact?.metadata?.content as string) ?? "";

                  // During streaming: use streamedChunks (with timestamps). When done: use stored chunks or legacy content
                  const entriesToRender: StreamChunkEntry[] = isRunning
                    ? streamedChunks
                    : Array.isArray(storedChunks) && storedChunks.length > 0
                      ? storedChunks.map((chunk) => ({
                          chunk,
                          timestamp: "",
                        }))
                      : [];

                  const hasLegacyContent =
                    !isRunning &&
                    entriesToRender.length === 0 &&
                    storedContent.trim();

                  if (
                    entriesToRender.length === 0 &&
                    !hasLegacyContent &&
                    (isRunning || logs.length === 0)
                  ) {
                    return (
                      <p className="taskDetailPanel__consoleEmpty">
                        {isRunning ? "Streaming…" : "No logs yet."}
                      </p>
                    );
                  }

                  if (entriesToRender.length > 0) {
                    const renderChunk = (chunk: StreamChunk, partIdx: number) => {
                      if (chunk.type === "text") {
                        return (
                          <div
                            key={partIdx}
                            className="taskDetailPanel__consoleTextMessage"
                          >
                            {chunk.content}
                          </div>
                        );
                      }
                      if (chunk.type === "command") {
                        const isStreaming = chunk.status === "running";
                        const showOutput =
                          isStreaming ||
                          (chunk.output != null && chunk.output !== "");
                        return (
                          <div
                            key={partIdx}
                            className={`taskDetailPanel__consoleEntry taskDetailPanel__consoleCommand ${isStreaming ? "taskDetailPanel__consoleCommand--streaming" : ""}`}
                          >
                            <div className="taskDetailPanel__consoleCommandBlock">
                              <div className="taskDetailPanel__consoleCommandLabel">
                                &gt;_ Run command
                              </div>
                              <div className="taskDetailPanel__consoleCommandTerminal">
                                <code className="taskDetailPanel__consoleCommandLine">
                                  $ {chunk.command}
                                </code>
                                {showOutput && (
                                  <>
                                    <div className="taskDetailPanel__consoleCommandOutputLabel">
                                      # Output
                                    </div>
                                    <pre className="taskDetailPanel__consoleCommandOutput">
                                      {chunk.output ?? ""}
                                      {isStreaming && (
                                        <span
                                          className="taskDetailPanel__consoleCommandCursor"
                                          aria-hidden
                                        />
                                      )}
                                    </pre>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (chunk.type === "read_file") {
                        return (
                          <div
                            key={partIdx}
                            className="taskDetailPanel__consoleEntry taskDetailPanel__consoleAction"
                          >
                            <div className="taskDetailPanel__consoleActionCard">
                              <div className="taskDetailPanel__consoleActionTitle">
                                Read file
                              </div>
                              <div className="taskDetailPanel__consoleActionPath">
                                {chunk.path}
                              </div>
                              {(chunk.summary != null ||
                                chunk.tokens != null) && (
                                <div className="taskDetailPanel__consoleActionResult">
                                  {chunk.tokens != null
                                    ? `✓ ${chunk.tokens.toLocaleString()} tokens loaded`
                                    : chunk.summary ?? ""}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (chunk.type === "agent_log") {
                        return (
                          <div
                            key={partIdx}
                            className="taskDetailPanel__consoleAgentLog"
                            data-level={chunk.level}
                          >
                            {chunk.message}
                            {chunk.payload &&
                              Object.keys(chunk.payload).length > 0 && (
                                <span className="taskDetailPanel__consoleAgentLogPayload">
                                  {" "}
                                  {JSON.stringify(chunk.payload)}
                                </span>
                              )}
                          </div>
                        );
                      }
                      if (chunk.type === "user_prompt") {
                        return (
                          <div
                            key={partIdx}
                            className="taskDetailPanel__consoleUserPrompt"
                          >
                            <div className="taskDetailPanel__consoleUserPromptLabel">
                              Agent requested input
                            </div>
                            <p className="taskDetailPanel__consoleUserPromptMessage">
                              {chunk.message}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    };

                    const grouped: {
                      section: StreamChunk;
                      body: StreamChunk[];
                      timestamp: string;
                    }[] = [];
                    let current: {
                      section: StreamChunk;
                      body: StreamChunk[];
                      timestamp: string;
                    } | null = null;
                    for (const { chunk, timestamp } of entriesToRender) {
                      if (chunk.type === "section") {
                        current = { section: chunk, body: [], timestamp };
                        grouped.push(current);
                      } else if (current) {
                        current.body.push(chunk);
                      } else {
                        grouped.push({
                          section: { type: "section", title: "Output" },
                          body: [chunk],
                          timestamp,
                        });
                        current = grouped[grouped.length - 1]!;
                      }
                    }

                    return (
                      <>
                        {grouped.map((g, gIdx) => {
                          const description =
                            g.section.type === "section"
                              ? g.section.content ?? g.section.title
                              : "";
                          const bodyText = g.body
                            .filter((c): c is Extract<StreamChunk, { type: "text" }> =>
                              c.type === "text"
                            )
                            .map((c) => c.content)
                            .join(" ");
                          const sectionTitle =
                            g.section.type === "section"
                              ? g.section.title
                              : "Output";
                          const displayDescription =
                            description && bodyText
                              ? `${description} ${bodyText}`.trim()
                              : description || bodyText || sectionTitle;

                          return (
                            <div
                              key={gIdx}
                              className="taskDetailPanel__chunkCard"
                            >
                              <div className="taskDetailPanel__chunkHeader">
                                <div
                                  className="taskDetailPanel__chunkAvatar"
                                  aria-hidden
                                />
                                <div className="taskDetailPanel__chunkMeta">
                                  <span className="taskDetailPanel__chunkTitle">
                                    {assignedAgentName}
                                  </span>
                                  {g.timestamp && (
                                    <span className="taskDetailPanel__chunkTimestamp">
                                      {g.timestamp}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {displayDescription && (
                                <p className="taskDetailPanel__chunkDescription">
                                  {displayDescription}
                                </p>
                              )}
                              <div className="taskDetailPanel__chunkBody">
                                {g.body
                                  .filter((c) => c.type !== "text")
                                  .map((c, i) => renderChunk(c, i))}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  }

                  if (hasLegacyContent) {
                    const sections = parseConsoleSections(storedContent);
                    return (
                      <>
                        {sections.map((section, idx) => {
                          const textParts = section.parts.filter(
                            (p): p is string => typeof p === "string"
                          );
                          const codeParts = section.parts.filter(
                            (p): p is { type: "code"; content: string } =>
                              typeof p !== "string"
                          );
                          const description = [
                            section.title,
                            ...textParts.map((t) => t.trim()).filter(Boolean),
                          ]
                            .join(" ")
                            .trim();
                          return (
                            <div
                              key={idx}
                              className="taskDetailPanel__chunkCard"
                            >
                              <div className="taskDetailPanel__chunkHeader">
                                <div
                                  className="taskDetailPanel__chunkAvatar"
                                  aria-hidden
                                />
                                <div className="taskDetailPanel__chunkMeta">
                                  <span className="taskDetailPanel__chunkTitle">
                                    {assignedAgentName}
                                  </span>
                                </div>
                              </div>
                              {description && (
                                <p className="taskDetailPanel__chunkDescription">
                                  {description}
                                </p>
                              )}
                              <div className="taskDetailPanel__chunkBody">
                                {codeParts.map((part, partIdx) => (
                                  <div
                                    key={partIdx}
                                    className="taskDetailPanel__consoleEntry taskDetailPanel__consoleCommand"
                                  >
                                    <div className="taskDetailPanel__consoleCommandBlock">
                                      <div className="taskDetailPanel__consoleCommandLabel">
                                        &gt;_ Run command
                                      </div>
                                      <div className="taskDetailPanel__consoleCommandTerminal">
                                        <pre className="taskDetailPanel__consoleCommandOutput">
                                          {part.content}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  }

                  return logs.map((log) => {
                    const payload = log.payload as Record<string, unknown> | null;
                    const timestamp = log.created_at
                      ? new Date(log.created_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "";

                    if (isActionPayload(payload)) {
                      const toolLabel =
                        payload.tool === "read_file"
                          ? "Read file"
                          : (payload.tool as string)?.replace(/_/g, " ") ??
                            "Action";
                      return (
                        <div
                          key={log.id}
                          className="taskDetailPanel__chunkCard"
                        >
                          <div className="taskDetailPanel__chunkHeader">
                            <div
                              className="taskDetailPanel__chunkAvatar"
                              aria-hidden
                            />
                            <div className="taskDetailPanel__chunkMeta">
                              <span className="taskDetailPanel__chunkTitle">
                                {assignedAgentName}
                              </span>
                              {timestamp && (
                                <span className="taskDetailPanel__chunkTimestamp">
                                  {timestamp}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="taskDetailPanel__chunkBody">
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
                        </div>
                      );
                    }

                    if (isCommandPayload(payload)) {
                      const isStreaming = payload.status === "running";
                      const output =
                        payload.output != null ? String(payload.output) : "";
                      const showOutput = isStreaming || output !== "";
                      return (
                        <div
                          key={log.id}
                          className="taskDetailPanel__chunkCard"
                        >
                          <div className="taskDetailPanel__chunkHeader">
                            <div
                              className="taskDetailPanel__chunkAvatar"
                              aria-hidden
                            />
                            <div className="taskDetailPanel__chunkMeta">
                              <span className="taskDetailPanel__chunkTitle">
                                {assignedAgentName}
                              </span>
                              {timestamp && (
                                <span className="taskDetailPanel__chunkTimestamp">
                                  {timestamp}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="taskDetailPanel__chunkBody">
                            <div
                              className={`taskDetailPanel__consoleEntry taskDetailPanel__consoleCommand ${isStreaming ? "taskDetailPanel__consoleCommand--streaming" : ""}`}
                            >
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
                                          <span
                                            className="taskDetailPanel__consoleCommandCursor"
                                            aria-hidden
                                          />
                                        )}
                                      </pre>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={log.id}
                        className="taskDetailPanel__chunkCard"
                      >
                        <div className="taskDetailPanel__chunkHeader">
                          <div
                            className="taskDetailPanel__chunkAvatar"
                            aria-hidden
                          />
                          <div className="taskDetailPanel__chunkMeta">
                            <span className="taskDetailPanel__chunkTitle">
                              {assignedAgentName}
                            </span>
                            {timestamp && (
                              <span className="taskDetailPanel__chunkTimestamp">
                                {timestamp}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="taskDetailPanel__chunkDescription">
                          {log.message}
                        </p>
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
                  });
                })()}
                {awaitingInputRun && (
                  <div className="taskDetailPanel__consolePrompt">
                    <div className="taskDetailPanel__consolePromptLabel">
                      Agent needs your input
                    </div>
                    {(promptLog ||
                      streamedChunks.find((c) => c.chunk.type === "user_prompt")) && (
                      <div className="taskDetailPanel__consolePromptCard">
                        <p className="taskDetailPanel__consolePromptMessage">
                          {(streamedChunks.find((c) => c.chunk.type === "user_prompt")
                            ?.chunk as { message?: string } | undefined)?.message ??
                            (promptLog?.payload as { message?: string })
                              ?.message ??
                            "The agent needs your input."}
                        </p>
                      </div>
                    )}
                    <form
                      className="taskDetailPanel__consolePromptForm"
                      onSubmit={handleSubmitUserInput}
                    >
                      <input
                        type="text"
                        className="taskDetailPanel__consolePromptInput"
                        placeholder="Type your response…"
                        value={userInputValue}
                        onChange={(e) => setUserInputValue(e.target.value)}
                        disabled={isSubmittingInput || !awaitingInputRun}
                        aria-label="User response"
                      />
                      <button
                        type="submit"
                        className="taskDetailPanel__btn taskDetailPanel__btnPrimary taskDetailPanel__consolePromptSubmit"
                        disabled={
                          !userInputValue.trim() ||
                          isSubmittingInput ||
                          !awaitingInputRun
                        }
                      >
                        {isSubmittingInput ? "Sending…" : "Send"}
                      </button>
                    </form>
                  </div>
                )}
            </div>
          </div>
          )}
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
                (() => {
                  const previewText =
                    typeof selectedArtifact.metadata.preview === "string"
                      ? selectedArtifact.metadata.preview
                      : typeof selectedArtifact.metadata.content === "string"
                        ? selectedArtifact.metadata.content
                        : "";
                  if (previewText.length === 0) return null;
                  return (
                    <div className="taskDetailPanel__artifactPreview">
                      <div className="taskDetailPanel__artifactPreviewHeader">
                        <h4>Preview</h4>
                        <button
                          type="button"
                          className="taskDetailPanel__artifactPreviewCopy"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(previewText);
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
                        {previewText}
                      </pre>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
