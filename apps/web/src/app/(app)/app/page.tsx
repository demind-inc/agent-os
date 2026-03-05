"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskStatus, AgentRun, Agent } from "@/types/domain";
import { AppSidebar } from "@/components/AppSidebar/AppSidebar";
import { TopBar } from "@/components/TopBar/TopBar";
import { BoardView } from "@/components/BoardView/BoardView";
import { NewTaskPanel } from "@/components/NewTaskPanel/NewTaskPanel";
import { ListView } from "@/components/ListView/ListView";
import { TaskDetailPanel } from "@/components/TaskDetailPanel/TaskDetailPanel";
import { RunStreamProvider } from "@/components/RunStreamProvider/RunStreamProvider";
import { BottomInputBar } from "@/components/BottomInputBar/BottomInputBar";
import "./app-board.scss";

type TaskLog = {
  id: string;
  level: string;
  message: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};
type Artifact = {
  id: string;
  type: string;
  title: string;
  url: string | null;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

const SOURCE_LABELS: Record<string, string> = {
  codex: "Codex",
  claude: "Claude",
  openclaw: "OpenClaw",
};

function getSourceLabel(source?: string | null): string | null {
  if (!source) return null;
  return (
    SOURCE_LABELS[source] ??
    source.charAt(0).toUpperCase() + source.slice(1)
  );
}

export default function AppBoardPage() {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [newTaskPanelOpen, setNewTaskPanelOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectName, setProjectName] = useState("[untitled]");
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [userInitials, setUserInitials] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [providerApiKeysConfigured, setProviderApiKeysConfigured] = useState<{
    anthropic?: boolean;
    openai?: boolean;
  }>({});
  /** Run id from POST /run response so we connect to stream before load() completes. */
  const [pendingStreamRunId, setPendingStreamRunId] = useState<string | null>(
    null
  );
  const [pendingStreamTaskId, setPendingStreamTaskId] = useState<string | null>(
    null
  );
  /** True when TaskDetailPanel has an active WebSocket stream; skip logs/artifacts poll. */
  const [isStreaming, setIsStreaming] = useState(false);

  const projectId = useMemo(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem("agentos_project_id") || ""
        : "",
    []
  );
  const workspaceId = useMemo(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem("agentos_workspace_id") || ""
        : "",
    []
  );

  const load = useCallback(async () => {
    if (!projectId || !workspaceId) return;
    const [
      tasksData,
      runsData,
      projectsData,
      profileData,
      agentsData,
      apiKeysData,
    ] = await Promise.all([
      apiFetch<{ tasks: Task[] }>(`/projects/${projectId}/tasks`),
      apiFetch<{ runs: AgentRun[] }>(`/projects/${projectId}/runs`),
      apiFetch<{ projects: { id: string; name: string }[] }>(
        `/workspaces/${workspaceId}/projects`
      ),
      apiFetch<{ profile: { full_name: string | null; email: string } }>(
        `/profile?workspaceId=${workspaceId}`
      ).catch(() => null),
      apiFetch<{ agents: Agent[] }>(`/workspaces/${workspaceId}/agents`).catch(
        () => ({
          agents: [] as Agent[],
        })
      ),
      apiFetch<{
        key: string;
        value: {
          anthropic?: { configured: boolean };
          openai?: { configured: boolean };
        } | null;
      }>("/user/settings?key=provider_api_keys").catch(() => ({
        key: "provider_api_keys",
        value: null,
      })),
    ]);

    const currentProject = projectsData.projects.find(
      (project) => project.id === projectId
    );
    setTasks(tasksData.tasks);
    setRuns(runsData.runs);
    setProjectName(currentProject?.name || "[untitled]");
    setAgents(agentsData.agents ?? []);
    setProviderApiKeysConfigured({
      anthropic: apiKeysData.value?.anthropic?.configured ?? false,
      openai: apiKeysData.value?.openai?.configured ?? false,
    });
    if (profileData?.profile) {
      const { full_name, email } = profileData.profile;
      if (full_name?.trim()) {
        const parts = full_name.trim().split(/\s+/);
        setUserInitials(
          parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : full_name.slice(0, 2).toUpperCase()
        );
      } else setUserInitials(email?.slice(0, 2).toUpperCase() || "?");
    }
  }, [projectId, workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      router.replace("/workspace");
      return;
    }

    if (!projectId) {
      router.replace("/project");
      return;
    }

    load().catch(console.error);
  }, [load, projectId, router, workspaceId]);

  // Restore pending run from localStorage (for refresh during active execution).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pendingStreamRunId || pendingStreamTaskId) return;
    const storedRunId = localStorage.getItem("agentos_active_run_id");
    const storedTaskId = localStorage.getItem("agentos_active_task_id");
    if (storedRunId && storedTaskId) {
      setPendingStreamRunId(storedRunId);
      setPendingStreamTaskId(storedTaskId);
    }
  }, [pendingStreamRunId, pendingStreamTaskId]);

  useEffect(() => {
    if (!projectId) return;

    const supabase = createClient();
    const channel = supabase
      .channel("agentos-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [load, projectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!projectId || !workspaceId) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        load().catch(console.error);
      }
    };
    const handleFocus = () => {
      load().catch(console.error);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load, projectId, workspaceId]);

  // Subscribe to task_logs only when NOT streaming. During streaming, execution log
  // comes from polling; logs are stored in DB only when the run finishes.
  useEffect(() => {
    if (!activeTaskId || isStreaming) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`task-logs-${activeTaskId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_logs",
          filter: `task_id=eq.${activeTaskId}`,
        },
        (payload: { new: TaskLog }) => {
          setLogs((prev) => [...prev, payload.new]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "task_logs",
          filter: `task_id=eq.${activeTaskId}`,
        },
        (payload: { new: TaskLog }) => {
          setLogs((prev) =>
            prev.map((log) => (log.id === payload.new.id ? payload.new : log))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [activeTaskId, isStreaming]);

  const filteredTasks = tasks.filter((task) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      task.title.toLowerCase().includes(q) ||
      task.description.toLowerCase().includes(q)
    );
  });

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;
  const activeRun = activeTask
    ? runs.find(
        (r) =>
          r.task_id === activeTask.id &&
          (r.status === "queued" || r.status === "running")
      )
    : null;
  const latestRunForTask = activeTask
    ? runs.find((r) => r.task_id === activeTask.id) ?? null
    : null;
  const agentSourceLabel = getSourceLabel(
    activeRun?.source ?? latestRunForTask?.source ?? null
  );
  /** Run awaiting user input (e.g. OAuth, chat response) — shown in execution console. */
  const awaitingInputRun = activeTask
    ? runs.find(
        (r) =>
          r.task_id === activeTask.id && r.status === "awaiting_input"
      ) ?? null
    : null;

  const isActiveTaskRunning = Boolean(
    activeRun ||
      (activeTaskId === pendingStreamTaskId && pendingStreamRunId)
  );
  const activeRunId =
    activeRun?.id ??
    (activeTaskId === pendingStreamTaskId ? pendingStreamRunId : null);

  useEffect(() => {
    if (activeRun?.id === pendingStreamRunId) {
      setPendingStreamRunId(null);
      setPendingStreamTaskId(null);
    }
    if (activeTaskId !== pendingStreamTaskId) {
      setPendingStreamTaskId(null);
      setPendingStreamRunId(null);
    }
  }, [activeRun?.id, activeTaskId, pendingStreamRunId, pendingStreamTaskId]);

  const loadTaskDetails = useCallback(async (taskId: string) => {
    const [logsData, artifactsData] = await Promise.all([
      apiFetch<{ logs: TaskLog[] }>(`/tasks/${taskId}/logs`),
      apiFetch<{ artifacts: Artifact[] }>(`/tasks/${taskId}/artifacts`),
    ]);
    setLogs(logsData.logs);
    setArtifacts(artifactsData.artifacts);
  }, []);

  const loadAgents = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await apiFetch<{ agents: Agent[] }>(
        `/workspaces/${workspaceId}/agents`
      );
      const list = data.agents ?? [];
      setAgents(list);
      setSelectedAgentId((prev) =>
        prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? ""
      );
    } catch (e) {
      console.error(e);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (newTaskPanelOpen && workspaceId) loadAgents();
  }, [newTaskPanelOpen, workspaceId, loadAgents]);

  useEffect(() => {
    if (!workspaceId || !newDescription.trim()) {
      setSuggestedSkills([]);
      return;
    }
    const t = setTimeout(() => {
      apiFetch<{ suggestedSkills: string[] }>(
        `/workspaces/${workspaceId}/suggest-skills?description=${encodeURIComponent(
          newDescription
        )}`
      )
        .then((data) => setSuggestedSkills(data.suggestedSkills ?? []))
        .catch(() => setSuggestedSkills([]));
    }, 400);
    return () => clearTimeout(t);
  }, [workspaceId, newDescription]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreatingTask || !projectId || !newTitle || !selectedAgentId) return;
    setIsCreatingTask(true);
    try {
      await apiFetch(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          assigned_agent_id: selectedAgentId,
        }),
      });
      setNewTitle("");
      setNewDescription("");
      setSelectedAgentId(agents[0]?.id ?? "");
      setNewTaskPanelOpen(false);
      await load();
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    await apiFetch(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function deleteTask(taskId: string) {
    await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
    if (activeTaskId === taskId) setActiveTaskId(null);
    await load();
  }

  async function runTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    const run = await apiFetch<{ id: string }>(`/tasks/${taskId}/run`, {
      method: "POST",
      body: JSON.stringify({ agentId: task?.assigned_agent_id ?? undefined }),
    });
    setPendingStreamRunId(run.id);
    setPendingStreamTaskId(taskId);
    if (typeof window !== "undefined") {
      localStorage.setItem("agentos_active_run_id", run.id);
      localStorage.setItem("agentos_active_task_id", taskId);
    }
    load().catch(console.error);
  }

  async function openTask(taskId: string) {
    setActiveTaskId(taskId);
    await loadTaskDetails(taskId);
  }

  async function review(taskId: string, action: "approve" | "reject") {
    await apiFetch(`/tasks/${taskId}/review`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    await load();
  }

  function handleTaskUpdate(updatedTask: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setSnackbarMessage("Task updated");
  }

  useEffect(() => {
    if (!snackbarMessage) return;
    const t = setTimeout(() => setSnackbarMessage(null), 3000);
    return () => clearTimeout(t);
  }, [snackbarMessage]);

  // Poll logs/artifacts only when task is ai_working and NOT streaming or awaiting input.
  // During streaming, polling provides live content; onStreamDone refetches when done.
  // When awaiting input, we already have the content; onInputSubmitted refetches after.
  useEffect(() => {
    if (!activeTaskId || activeTask?.status !== "ai_working") return;
    if (isStreaming || isActiveTaskRunning || awaitingInputRun) return;

    const interval = setInterval(() => {
      loadTaskDetails(activeTaskId).catch(console.error);
    }, 2500);

    return () => clearInterval(interval);
  }, [activeTask?.status, activeTaskId, isStreaming, isActiveTaskRunning, awaitingInputRun, loadTaskDetails]);

  return (
    <RunStreamProvider
      activeRunId={activeRunId}
      isRunning={isActiveTaskRunning}
      taskId={activeTaskId}
      onStreamDone={() =>
        activeTaskId &&
        loadTaskDetails(activeTaskId).then(() => {
          setPendingStreamRunId(null);
          setPendingStreamTaskId(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("agentos_active_run_id");
            localStorage.removeItem("agentos_active_task_id");
          }
        })
      }
      onStreamConnect={() => setIsStreaming(true)}
      onStreamDisconnect={() => setIsStreaming(false)}
    >
    <div className="appBoard">
      <AppSidebar
        projectTitle={projectName}
        view={view}
        onViewChange={setView}
        onNewTaskClick={() => setNewTaskPanelOpen(true)}
        runs={runs}
        tasks={tasks}
        agents={agents}
        onTaskClick={openTask}
      />
      <div className="appBoard__main">
        <TopBar
          view={view}
          onViewChange={setView}
          search={search}
          onSearchChange={setSearch}
          onNewTaskClick={() => setNewTaskPanelOpen(true)}
          userInitials={userInitials || "?"}
        />
        <section className="appBoard__content">
          {view === "board" ? (
            <BoardView
              tasks={filteredTasks}
              projectName={projectName}
              onUpdateStatus={updateStatus}
              onDelete={deleteTask}
              onRun={runTask}
              onOpen={openTask}
            />
          ) : (
            <ListView
              tasks={filteredTasks}
              projectName={projectName}
              onOpen={openTask}
              onRun={runTask}
            />
          )}
        </section>
        <BottomInputBar />
      </div>
      {newTaskPanelOpen && (
        <NewTaskPanel
          title={newTitle}
          description={newDescription}
          onTitleChange={setNewTitle}
          onDescriptionChange={setNewDescription}
          agents={agents}
          selectedAgentId={selectedAgentId}
          onAgentChange={setSelectedAgentId}
          suggestedSkills={suggestedSkills}
          onSubmit={createTask}
          isSubmitting={isCreatingTask}
          onClose={() => {
            setNewTaskPanelOpen(false);
            setNewTitle("");
            setNewDescription("");
            setSuggestedSkills([]);
          }}
        />
      )}
      {activeTask && (
        <TaskDetailPanel
          task={activeTask}
          logs={logs}
          artifacts={artifacts}
          onRun={runTask}
          isRunning={isActiveTaskRunning}
          awaitingInputRun={awaitingInputRun}
          workspaceId={workspaceId}
          onClose={() => {
            setActiveTaskId(null);
            setIsStreaming(false);
          }}
          onReview={review}
          onDelete={async (taskId) => {
            await deleteTask(taskId);
            setActiveTaskId(null);
          }}
          onTaskUpdate={handleTaskUpdate}
          onInputSubmitted={async () => {
            if (!activeTaskId || !projectId) return;
            await loadTaskDetails(activeTaskId);
            const runsData = await apiFetch<{ runs: AgentRun[] }>(
              `/projects/${projectId}/runs`
            );
            setRuns(runsData.runs);
          }}
          assignedAgentBackend={
            activeTask.assigned_agent_id
              ? agents.find((a) => a.id === activeTask.assigned_agent_id)
                  ?.backend ?? null
              : null
          }
          assignedAgentName={
            agentSourceLabel ??
            (activeTask.assigned_agent_id
              ? agents.find((a) => a.id === activeTask.assigned_agent_id)
                  ?.name ?? "Agent"
              : "Agent")
          }
          providerApiKeysConfigured={providerApiKeysConfigured}
        />
      )}
      {snackbarMessage && (
        <div className="appBoard__snackbar" role="status" aria-live="polite">
          {snackbarMessage}
        </div>
      )}
    </div>
    </RunStreamProvider>
  );
}
