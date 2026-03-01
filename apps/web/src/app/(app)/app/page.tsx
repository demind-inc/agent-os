"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskStatus, AgentRun } from "@/types/domain";

const COLUMNS: { key: TaskStatus; label: string; className?: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "ai_working", label: "AI Working" },
  { key: "needs_human_input", label: "Needs Human Input", className: "needs-human" },
  { key: "in_review", label: "In Review" },
  { key: "done", label: "Done" },
  { key: "failed", label: "Failed" }
];

type Artifact = { id: string; type: string; title: string; url: string | null };
type TaskLog = { id: string; level: string; message: string; created_at: string; payload: Record<string, unknown> | null };

export default function AppBoardPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const projectId = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("agentos_project_id") || "" : ""), []);
  const workspaceId = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("agentos_workspace_id") || "" : ""), []);

  async function load() {
    if (!projectId) return;
    const [tasksData, runsData] = await Promise.all([
      apiFetch<{ tasks: Task[] }>(`/projects/${projectId}/tasks`),
      apiFetch<{ runs: AgentRun[] }>(`/projects/${projectId}/runs`)
    ]);
    setTasks(tasksData.tasks);
    setRuns(runsData.runs);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [projectId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("agentos-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [projectId]);

  const filteredTasks = tasks.filter((task) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q);
  });

  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !newTitle) return;

    await apiFetch(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title: newTitle, description: newDescription })
    });

    setNewTitle("");
    setNewDescription("");
    await load();
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    await apiFetch(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await load();
  }

  async function deleteTask(taskId: string) {
    await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
    if (activeTaskId === taskId) setActiveTaskId(null);
    await load();
  }

  async function runTask(taskId: string) {
    const agentId = prompt("Agent id (optional):") || "";
    const model = prompt("Model override (optional):") || "";
    await apiFetch(`/tasks/${taskId}/run`, {
      method: "POST",
      body: JSON.stringify({ agentId: agentId || undefined, model: model || undefined })
    });
    await load();
  }

  async function openTask(taskId: string) {
    setActiveTaskId(taskId);
    const [logsData, artifactsData] = await Promise.all([
      apiFetch<{ logs: TaskLog[] }>(`/tasks/${taskId}/logs`),
      apiFetch<{ artifacts: Artifact[] }>(`/tasks/${taskId}/artifacts`)
    ]);
    setLogs(logsData.logs);
    setArtifacts(artifactsData.artifacts);
  }

  async function review(taskId: string, action: "approve" | "reject") {
    await apiFetch(`/tasks/${taskId}/review`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    await load();
  }

  return (
    <main>
      <header className="topbar">
        <div className="row">
          <strong>[untitled]</strong>
          <button onClick={() => setView("board")}>Board View</button>
          <button onClick={() => setView("list")}>List View</button>
          <button onClick={() => document.getElementById("new-task")?.scrollIntoView({ behavior: "smooth" })}>+ New Task</button>
        </div>
        <div className="row">
          <input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="badge">JD</div>
        </div>
      </header>

      <section className="page">
        <form id="new-task" className="card column" onSubmit={createTask}>
          <strong>Create task</strong>
          <input required placeholder="Task title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <textarea placeholder="Task description (supports skill detection)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <button type="submit">Create task</button>
        </form>

        {view === "board" ? (
          <div className="board" style={{ marginTop: 12 }}>
            {COLUMNS.map((column) => (
              <div key={column.key} className={`status-col ${column.className || ""}`}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{column.label}</strong>
                  <span className="badge">{filteredTasks.filter((task) => task.status === column.key).length}</span>
                </div>
                <div className="column" style={{ marginTop: 10 }}>
                  {filteredTasks
                    .filter((task) => task.status === column.key)
                    .map((task) => (
                      <div key={task.id} className="task-card column">
                        <div className="row" style={{ justifyContent: "space-between" }}>
                          <strong>{task.title}</strong>
                          <button onClick={() => deleteTask(task.id)}>Delete</button>
                        </div>
                        <span>{task.description || "No description"}</span>
                        {Array.isArray(task.metadata?.detectedSkills) &&
                          (task.metadata.detectedSkills as string[]).map((skill) => <span key={skill} className="badge">{skill}</span>)}
                        <div className="row" style={{ flexWrap: "wrap" }}>
                          {COLUMNS.filter((c) => c.key !== task.status).map((c) => (
                            <button key={c.key} onClick={() => updateStatus(task.id, c.key)}>{c.label}</button>
                          ))}
                          <button onClick={() => runTask(task.id)}>Run</button>
                          <button onClick={() => openTask(task.id)}>Open</button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            <aside className="sidebar">
              <strong>ACTIVE AGENTS</strong>
              <div className="column" style={{ marginTop: 12 }}>
                {runs.filter((run) => ["queued", "running", "awaiting_input"].includes(run.status)).map((run) => (
                  <div className="task-card" key={run.id}>
                    <strong>{run.agent_id}</strong>
                    <div>{tasks.find((task) => task.id === run.task_id)?.title || "Unknown task"}</div>
                    <span className="badge">{run.status}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 12 }}>
            {filteredTasks.map((task) => (
              <div key={task.id} className="row" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
                <div>
                  <strong>{task.title}</strong>
                  <div>{task.status}</div>
                </div>
                <div className="row">
                  <button onClick={() => openTask(task.id)}>Open</button>
                  <button onClick={() => runTask(task.id)}>Run</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {activeTask && (
        <section className="card" style={{ position: "fixed", top: 70, right: 16, width: 420, maxHeight: "80vh", overflow: "auto", zIndex: 30 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{activeTask.title}</strong>
            <button onClick={() => setActiveTaskId(null)}>Close</button>
          </div>

          <h4>Overview</h4>
          <p>{activeTask.description}</p>
          <p>Status: <strong>{activeTask.status}</strong></p>

          <h4>Integrations</h4>
          <div className="task-card">
            <strong>GitHub</strong>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Connected via OAuth</span>
              <button onClick={() => apiFetch('/integrations/oauth/start', { method: 'POST', body: JSON.stringify({ provider: 'github', workspaceId }) })}>Configure</button>
            </div>
          </div>

          <h4>Execution Console</h4>
          <div className="column">
            {logs.map((log) => (
              <div key={log.id} className="task-card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span>{log.level}</span>
                  <small>{new Date(log.created_at).toLocaleTimeString()}</small>
                </div>
                <div>{log.message}</div>
                {log.payload && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(log.payload, null, 2)}</pre>}
              </div>
            ))}
          </div>

          <h4>Artifacts ({artifacts.length})</h4>
          <div className="column">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="task-card">
                <div><strong>{artifact.type}</strong> — {artifact.title}</div>
                {artifact.url && <a href={artifact.url} target="_blank">{artifact.url}</a>}
              </div>
            ))}
          </div>

          {activeTask.status === "in_review" && (
            <div className="row">
              <button onClick={() => review(activeTask.id, "reject")}>Request changes</button>
              <button onClick={() => review(activeTask.id, "approve")}>Approve & continue</button>
            </div>
          )}
        </section>
      )}

      <div className="bottom-input">
        <span>Type to assign AI or record a decision...</span>
      </div>
    </main>
  );
}
