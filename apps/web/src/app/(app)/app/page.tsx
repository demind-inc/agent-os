"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskStatus, AgentRun } from "@/types/domain";
import { AppSidebar } from "@/components/AppSidebar/AppSidebar";
import { TopBar } from "@/components/TopBar/TopBar";
import { NewTaskForm } from "@/components/NewTaskForm/NewTaskForm";
import { BoardView } from "@/components/BoardView/BoardView";
import { ListView } from "@/components/ListView/ListView";
import { TaskDetailPanel } from "@/components/TaskDetailPanel/TaskDetailPanel";
import { BottomInputBar } from "@/components/BottomInputBar/BottomInputBar";
import "./app-board.scss";

type TaskLog = {
  id: string;
  level: string;
  message: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};
type Artifact = { id: string; type: string; title: string; url: string | null };

export default function AppBoardPage() {
  const [view, setView] = useState<"board" | "list" | "newtask">("board");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const projectId = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("agentos_project_id") || "" : ""),
    []
  );
  const workspaceId = useMemo(
    () =>
      typeof window !== "undefined" ? localStorage.getItem("agentos_workspace_id") || "" : "",
    []
  );

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
    return (
      task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q)
    );
  });

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !newTitle) return;
    await apiFetch(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title: newTitle, description: newDescription })
    });
    setNewTitle("");
    setNewDescription("");
    setView("board");
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
    <div className="appBoard">
      <AppSidebar
        projectTitle="[untitled]"
        view={view}
        onViewChange={setView}
        onNewTaskClick={() => setView("newtask")}
        runs={runs}
        tasks={tasks}
      />
      <div className="appBoard__main">
        {view !== "newtask" && (
          <TopBar
            view={view}
            onViewChange={(v) => setView(v)}
            search={search}
            onSearchChange={setSearch}
            onNewTaskClick={() => setView("newtask")}
          />
        )}
        <section className={`appBoard__content ${view === "newtask" ? "appBoard__content--newTask" : ""}`}>
          {view === "newtask" ? (
            <div className="appBoard__newTaskWrap">
              <NewTaskForm
                title={newTitle}
                description={newDescription}
                onTitleChange={setNewTitle}
                onDescriptionChange={setNewDescription}
                onSubmit={createTask}
              />
            </div>
          ) : (
            <>
              <NewTaskForm
                title={newTitle}
                description={newDescription}
                onTitleChange={setNewTitle}
                onDescriptionChange={setNewDescription}
                onSubmit={createTask}
              />
              {view === "board" ? (
                <BoardView
                  tasks={filteredTasks}
                  onUpdateStatus={updateStatus}
                  onDelete={deleteTask}
                  onRun={runTask}
                  onOpen={openTask}
                />
              ) : (
                <ListView
                  tasks={filteredTasks}
                  onOpen={openTask}
                  onRun={runTask}
                />
              )}
            </>
          )}
        </section>
        {view !== "newtask" && <BottomInputBar />}
      </div>
      {activeTask && (
        <TaskDetailPanel
          task={activeTask}
          logs={logs}
          artifacts={artifacts}
          workspaceId={workspaceId}
          onClose={() => setActiveTaskId(null)}
          onReview={review}
        />
      )}
    </div>
  );
}
