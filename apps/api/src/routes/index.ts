import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  adminSupabase,
  assertWorkspaceMember,
  detectSkillsFromDescription,
  getUserFromBearer,
  hashApiKey,
} from "../plugins/supabase.js";
import { randomBytes } from "crypto";
import { enqueueRun } from "../services/runner.js";
import {
  broadcastRunStreamChunk,
  broadcastRunStreamDone,
  registerRunStream,
  unregisterRunStream,
  type RunStreamSender,
} from "../services/run-stream-registry.js";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  assigned_agent_id: z.string().uuid(),
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z
    .enum(["backlog", "ai_working", "in_review", "done", "failed"])
    .optional(),
  metadata: z.record(z.any()).optional(),
});

function deriveSkillNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    const segment = path.split("/").filter(Boolean).pop() || "imported-skill";
    const base = segment
      .replace(/\.(md|txt|skill)$/i, "")
      .replace(/[^a-z0-9-_]/gi, "-")
      .replace(/-+/g, "-");
    return base || "imported-skill";
  } catch {
    return "imported-skill";
  }
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health") return;
    const authHeader =
      request.headers.authorization ??
      (typeof (request.query as { token?: string })?.token === "string"
        ? `Bearer ${(request.query as { token: string }).token}`
        : undefined);
    const user = await getUserFromBearer(authHeader);
    if (!user) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }
    (request as any).user = user;
  });

  app.get("/profile", async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as { workspaceId?: string };
    let { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .eq("id", user.id)
      .single();

    // Create profile if missing (e.g. trigger didn't run, or user created before migration)
    if (profileError || !profile) {
      const fullName =
        (user.user_metadata?.full_name as string) ||
        (user.email ? user.email.split("@")[0] : null);
      const { error: insertError } = await adminSupabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email ?? "",
          full_name: fullName,
        });
      if (insertError) {
        if ((insertError as { code?: string }).code === "23505") {
          const result = await adminSupabase
            .from("profiles")
            .select("id, email, full_name, avatar_url")
            .eq("id", user.id)
            .single();
          profile = result.data;
          profileError = result.error;
        } else {
          return reply.status(500).send({ error: "Failed to create profile" });
        }
      } else {
        const result = await adminSupabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .eq("id", user.id)
          .single();
        profile = result.data;
        profileError = result.error;
      }
    }

    if (profileError || !profile)
      return reply.status(404).send({ error: "Profile not found" });

    let role: string | null = null;
    if (query.workspaceId) {
      const { data: member } = await adminSupabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", query.workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();
      role = (member as { role?: string } | null)?.role ?? null;
    }

    return { profile: { ...profile, role } };
  });

  app.patch("/profile", async (request, reply) => {
    const user = (request as any).user;
    const body = z
      .object({
        full_name: z.string().optional(),
        avatar_url: z.string().url().optional(),
      })
      .parse(request.body || {});
    const { data, error } = await adminSupabase
      .from("profiles")
      .update(body)
      .eq("id", user.id)
      .select("id, email, full_name, avatar_url")
      .single();

    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to update profile" });
    return data;
  });

  app.delete("/profile", async (request, reply) => {
    const user = (request as any).user;
    const userId = user.id;

    // Clear or reassign references so we can delete the auth user (no CASCADE on these).
    await adminSupabase
      .from("tasks")
      .update({ assignee_id: null })
      .eq("assignee_id", userId);

    const { data: projects } = await adminSupabase
      .from("projects")
      .select("id, workspace_id")
      .eq("created_by", userId);
    if (projects?.length) {
      const workspaceIds = [...new Set(projects.map((p) => p.workspace_id))];
      for (const wid of workspaceIds) {
        const { data: w } = await adminSupabase
          .from("workspaces")
          .select("owner_id")
          .eq("id", wid)
          .single();
        if (w?.owner_id && w.owner_id !== userId) {
          await adminSupabase
            .from("projects")
            .update({ created_by: w.owner_id })
            .eq("workspace_id", wid)
            .eq("created_by", userId);
        }
      }
    }

    await adminSupabase
      .from("workspace_skills")
      .delete()
      .eq("created_by", userId);
    await adminSupabase
      .from("integration_sync_jobs")
      .delete()
      .eq("triggered_by", userId);
    await adminSupabase
      .from("workspace_members")
      .delete()
      .eq("user_id", userId);
    await adminSupabase.from("workspaces").delete().eq("owner_id", userId);
    await adminSupabase.from("user_settings").delete().eq("user_id", userId);
    await adminSupabase.from("profiles").delete().eq("id", userId);

    const { error: authError } = await adminSupabase.auth.admin.deleteUser(
      userId
    );
    if (authError) return reply.status(500).send({ error: authError.message });

    return { ok: true };
  });

  app.get("/workspaces", async (request, reply) => {
    const user = (request as any).user;
    const { data, error } = await adminSupabase
      .from("workspace_members")
      .select("workspaces(id,name)")
      .eq("user_id", user.id);

    if (error) return reply.status(400).send({ error: error.message });
    const workspaces = (data || [])
      .map((row: any) => row.workspaces)
      .filter(Boolean);
    return { workspaces };
  });

  app.post("/workspaces", async (request, reply) => {
    const user = (request as any).user;
    const body = z.object({ name: z.string().min(1) }).parse(request.body);

    const { data: workspace, error } = await adminSupabase
      .from("workspaces")
      .insert({ name: body.name, owner_id: user.id })
      .select("id,name")
      .single();

    if (error || !workspace)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to create workspace" });

    await adminSupabase
      .from("workspace_members")
      .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

    return workspace;
  });

  app.get("/workspaces/:workspaceId", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from("workspaces")
      .select("id, name")
      .eq("id", params.workspaceId)
      .single();
    if (error || !data)
      return reply.status(404).send({ error: "Workspace not found" });
    return data;
  });

  app.patch("/workspaces/:workspaceId", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const body = z.object({ name: z.string().min(1) }).parse(request.body);

    const { data: workspace } = await adminSupabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", params.workspaceId)
      .single();
    if (!workspace || workspace.owner_id !== user.id)
      return reply
        .status(403)
        .send({ error: "Only the workspace owner can update the workspace" });

    const { data, error } = await adminSupabase
      .from("workspaces")
      .update({ name: body.name })
      .eq("id", params.workspaceId)
      .select("id, name")
      .single();
    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to update workspace" });
    return data;
  });

  app.get("/workspaces/:workspaceId/members", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data: rows, error } = await adminSupabase
      .from("workspace_members")
      .select("id, user_id, role")
      .eq("workspace_id", params.workspaceId);

    if (error) return reply.status(400).send({ error: error.message });
    if (!rows?.length) return { members: [] };

    const userIds = [
      ...new Set(rows.map((r: { user_id: string }) => r.user_id)),
    ];
    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .in("id", userIds);
    const profileMap = new Map(
      (profiles || []).map(
        (p: {
          id: string;
          email?: string;
          full_name?: string;
          avatar_url?: string;
        }) => [p.id, p]
      )
    );

    const members = rows.map(
      (row: { id: string; user_id: string; role: string }) => {
        const p = profileMap.get(row.user_id);
        return {
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          email: p?.email ?? "",
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      }
    );
    return { members };
  });

  app.get("/workspaces/:workspaceId/integrations", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from("integrations")
      .select("id, provider, status")
      .eq("workspace_id", params.workspaceId);
    if (error) return reply.status(400).send({ error: error.message });
    return { integrations: data || [] };
  });

  app.get("/workspaces/:workspaceId/projects", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from("projects")
      .select("*")
      .eq("workspace_id", params.workspaceId)
      .order("created_at", { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { projects: data || [] };
  });

  app.post("/workspaces/:workspaceId/projects", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const body = z.object({ name: z.string().min(1) }).parse(request.body);
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from("projects")
      .insert({
        workspace_id: params.workspaceId,
        name: body.name,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to create project" });
    return data;
  });

  app.get("/projects/:projectId/tasks", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { projectId: string };

    const { data: project } = await adminSupabase
      .from("projects")
      .select("workspace_id")
      .eq("id", params.projectId)
      .single();
    if (!project) return reply.status(404).send({ error: "Project not found" });
    await assertWorkspaceMember(user.id, project.workspace_id);

    const { data, error } = await adminSupabase
      .from("tasks")
      .select("*")
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { tasks: data || [] };
  });

  app.post("/projects/:projectId/tasks", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { projectId: string };
    const body = createTaskSchema.parse(request.body);

    const { data: project } = await adminSupabase
      .from("projects")
      .select("workspace_id")
      .eq("id", params.projectId)
      .single();
    if (!project) return reply.status(404).send({ error: "Project not found" });
    await assertWorkspaceMember(user.id, project.workspace_id);

    const { data: agent } = await adminSupabase
      .from("agents")
      .select("id")
      .eq("id", body.assigned_agent_id)
      .eq("workspace_id", project.workspace_id)
      .maybeSingle();
    if (!agent)
      return reply.status(400).send({ error: "Invalid or inaccessible agent" });

    const detectedSkills = await detectSkillsFromDescription(body.description);

    const { data, error } = await adminSupabase
      .from("tasks")
      .insert({
        project_id: params.projectId,
        title: body.title,
        description: body.description,
        assigned_agent_id: body.assigned_agent_id,
        metadata: { detectedSkills },
      })
      .select("*")
      .single();

    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to create task" });
    return data;
  });

  app.patch("/tasks/:taskId", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };
    const body = updateTaskSchema.parse(request.body);

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("id,status,project_id,projects(workspace_id)")
      .eq("id", params.taskId)
      .single();

    if (!task) return reply.status(404).send({ error: "Task not found" });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    if (
      task.status === "in_review" &&
      body.status &&
      body.status !== "done" &&
      body.status !== "failed"
    ) {
      return reply
        .status(400)
        .send({
          error:
            "Task in review can only move to done/failed via review actions",
        });
    }

    const next = { ...body } as any;
    if (body.description) {
      next.metadata = {
        ...(next.metadata || {}),
        detectedSkills: await detectSkillsFromDescription(body.description),
      };
    }

    const { data, error } = await adminSupabase
      .from("tasks")
      .update(next)
      .eq("id", params.taskId)
      .select("*")
      .single();
    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to update task" });
    return data;
  });

  app.delete("/tasks/:taskId", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("id, project_id, projects(workspace_id)")
      .eq("id", params.taskId)
      .single();

    if (!task) return reply.status(404).send({ error: "Task not found" });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    const { error } = await adminSupabase
      .from("tasks")
      .delete()
      .eq("id", params.taskId);
    if (error) return reply.status(400).send({ error: error.message });
    return { ok: true };
  });

  app.get("/projects/:projectId/runs", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { projectId: string };

    const { data: project } = await adminSupabase
      .from("projects")
      .select("workspace_id")
      .eq("id", params.projectId)
      .single();
    if (!project) return reply.status(404).send({ error: "Project not found" });
    await assertWorkspaceMember(user.id, project.workspace_id);

    const { data: tasks } = await adminSupabase
      .from("tasks")
      .select("id")
      .eq("project_id", params.projectId);
    const taskIds = (tasks || []).map((task) => task.id);
    if (!taskIds.length) return { runs: [] };

    const { data, error } = await adminSupabase
      .from("agent_runs")
      .select("*")
      .in("task_id", taskIds)
      .order("created_at", { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { runs: data || [] };
  });

  app.post("/tasks/:taskId/run", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };
    const body = z
      .object({ agentId: z.string().optional(), model: z.string().optional() })
      .parse(request.body || {});

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("status, project_id, projects(workspace_id)")
      .eq("id", params.taskId)
      .single();
    if (!task) return reply.status(404).send({ error: "Task not found" });
    const workspaceId = (task as any).projects.workspace_id as string;
    await assertWorkspaceMember(user.id, workspaceId);
    if (task.status !== "backlog" && task.status !== "in_review") {
      return reply
        .status(400)
        .send({ error: "Task can only be run when in Backlog or In Review" });
    }

    let agentId = body.agentId;
    if (!agentId) {
      const { data: firstAgent } = await adminSupabase
        .from("agents")
        .select("id")
        .eq("workspace_id", workspaceId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!firstAgent)
        return reply.status(400).send({ error: "No agents configured" });
      agentId = firstAgent.id;
    }

    const { data: run, error } = await adminSupabase
      .from("agent_runs")
      .insert({
        task_id: params.taskId,
        agent_id: agentId,
        status: "queued",
        triggered_by_user_id: user.id,
        input_snapshot: { requestedModel: body.model || null },
      })
      .select("*")
      .single();

    if (error || !run)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to create run" });
    await enqueueRun(run.id);
    return run;
  });

  app.post("/runs/external", async (request, reply) => {
    const user = (request as any).user;
    const apiKeyProjectId = (user as { apiKeyProjectId?: string })
      .apiKeyProjectId;
    const body = z
      .object({
        taskId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        source: z.enum(["codex", "claude", "cursor", "openclaw"]),
        agentId: z.string().uuid().optional(),
        title: z.string().optional(),
      })
      .refine(
        (b) =>
          b.taskId != null || b.projectId != null || apiKeyProjectId != null,
        {
          message:
            "Either taskId or projectId is required, or use an API key scoped to a project",
        }
      )
      .parse(request.body);

    let taskId: string;
    let workspaceId: string;

    if (body.taskId) {
      const { data: task } = await adminSupabase
        .from("tasks")
        .select("id, project_id, projects(workspace_id)")
        .eq("id", body.taskId)
        .single();
      if (!task) return reply.status(404).send({ error: "Task not found" });
      workspaceId = (task as any).projects?.workspace_id as string;
      taskId = task.id;
      await assertWorkspaceMember(user.id, workspaceId);
    } else {
      const projectId = body.projectId ?? apiKeyProjectId!;
      const { data: project } = await adminSupabase
        .from("projects")
        .select("workspace_id")
        .eq("id", projectId)
        .single();
      if (!project)
        return reply.status(404).send({ error: "Project not found" });
      workspaceId = project.workspace_id;
      await assertWorkspaceMember(user.id, workspaceId);

      const { data: firstAgent } = await adminSupabase
        .from("agents")
        .select("id")
        .eq("workspace_id", workspaceId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!firstAgent)
        return reply.status(400).send({ error: "No agents configured" });

      const taskTitle = body.title ?? `External sync from ${body.source}`;
      const { data: newTask, error: taskError } = await adminSupabase
        .from("tasks")
        .insert({
          project_id: projectId,
          title: taskTitle,
          description: "",
          status: "ai_working",
          assigned_agent_id: firstAgent.id,
          metadata: {},
        })
        .select("id")
        .single();
      if (taskError || !newTask)
        return reply
          .status(400)
          .send({ error: taskError?.message || "Failed to create task" });
      taskId = newTask.id;
    }

    let agentId = body.agentId;
    if (!agentId) {
      const { data: firstAgent } = await adminSupabase
        .from("agents")
        .select("id")
        .eq("workspace_id", workspaceId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!firstAgent)
        return reply.status(400).send({ error: "No agents configured" });
      agentId = firstAgent.id;
    }

    const { data: run, error } = await adminSupabase
      .from("agent_runs")
      .insert({
        task_id: taskId,
        agent_id: agentId!,
        status: "running",
        source: body.source,
        triggered_by_user_id: user.id,
        started_at: new Date().toISOString(),
        input_snapshot: { source: body.source },
      })
      .select("id, task_id, status")
      .single();

    if (error || !run)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to create run" });

    await adminSupabase
      .from("tasks")
      .update({ status: "ai_working" })
      .eq("id", taskId);

    return { runId: run.id, taskId: run.task_id, status: run.status };
  });

  app.post("/runs/:runId/input", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { runId: string };
    const body = z
      .object({
        type: z.literal("text"),
        value: z.string().optional(),
      })
      .parse(request.body);

    const { data: run } = await adminSupabase
      .from("agent_runs")
      .select("id, task_id, status, input_snapshot")
      .eq("id", params.runId)
      .single();

    if (!run) return reply.status(404).send({ error: "Run not found" });
    if (run.status !== "awaiting_input") {
      return reply.status(400).send({ error: "Run is not awaiting input" });
    }

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("id, project_id, metadata, projects(workspace_id)")
      .eq("id", run.task_id)
      .single();

    if (!task) return reply.status(404).send({ error: "Task not found" });
    const workspaceId = (task as any).projects?.workspace_id as
      | string
      | undefined;
    if (!workspaceId)
      return reply.status(400).send({ error: "Task has no workspace" });
    await assertWorkspaceMember(user.id, workspaceId);

    await adminSupabase
      .from("agent_runs")
      .update({
        status: "queued",
        input_snapshot: {
          ...((run as any).input_snapshot ?? {}),
          userInput: { type: body.type, value: body.value },
        },
      })
      .eq("id", params.runId);

    await enqueueRun(params.runId);
    return { ok: true };
  });

  const streamChunkSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), content: z.string() }),
    z.object({
      type: z.literal("section"),
      title: z.string(),
      content: z.string().optional(),
    }),
    z.object({
      type: z.literal("command"),
      command: z.string(),
      output: z.string().optional(),
      status: z.enum(["running", "done", "error"]).optional(),
    }),
    z.object({
      type: z.literal("read_file"),
      path: z.string(),
      summary: z.string().optional(),
      tokens: z.number().optional(),
    }),
    z.object({ type: z.literal("user_prompt"), message: z.string() }),
    z.object({
      type: z.literal("agent_log"),
      level: z.string(),
      message: z.string(),
      payload: z.record(z.unknown()).optional(),
    }),
  ]);

  app.post("/runs/:runId/chunks", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { runId: string };
    const body = z.object({ chunk: streamChunkSchema }).parse(request.body);

    const { data: run } = await adminSupabase
      .from("agent_runs")
      .select("id, task_id")
      .eq("id", params.runId)
      .single();
    if (!run) return reply.status(404).send({ error: "Run not found" });

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("project_id, projects(workspace_id)")
      .eq("id", run.task_id)
      .single();
    if (!task) return reply.status(404).send({ error: "Task not found" });
    const workspaceId = (task as any).projects?.workspace_id as string;
    await assertWorkspaceMember(user.id, workspaceId);

    broadcastRunStreamChunk(params.runId, "chunk", JSON.stringify(body.chunk));
    return reply.status(204).send();
  });

  app.post("/runs/:runId/done", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { runId: string };
    const body = z
      .object({
        result: z.string().optional(),
        chunks: z.array(streamChunkSchema).optional(),
      })
      .parse(request.body ?? {});

    const { data: run } = await adminSupabase
      .from("agent_runs")
      .select("id, task_id, status")
      .eq("id", params.runId)
      .single();
    if (!run) return reply.status(404).send({ error: "Run not found" });
    if (
      (run as any).status === "completed" ||
      (run as any).status === "failed"
    ) {
      return reply.status(400).send({ error: "Run already finished" });
    }

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("project_id, projects(workspace_id)")
      .eq("id", run.task_id)
      .single();
    if (!task) return reply.status(404).send({ error: "Task not found" });
    const workspaceId = (task as any).projects?.workspace_id as string;
    await assertWorkspaceMember(user.id, workspaceId);

    await adminSupabase
      .from("agent_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        output_snapshot: {
          result: body.result ?? "ready_for_review",
          messages: [],
        },
      })
      .eq("id", params.runId);

    const { data: existing } = await adminSupabase
      .from("task_artifacts")
      .select("id")
      .eq("task_id", run.task_id)
      .eq("run_id", params.runId)
      .eq("type", "execution_log")
      .maybeSingle();

    const metadata: Record<string, unknown> = {
      source: "external",
      content: body.result ?? "",
      preview: body.result ?? "",
    };
    if (Array.isArray(body.chunks) && body.chunks.length > 0) {
      metadata.chunks = body.chunks;
    }

    if (existing) {
      await adminSupabase
        .from("task_artifacts")
        .update({ metadata })
        .eq("id", existing.id);
    } else {
      await adminSupabase.from("task_artifacts").insert({
        task_id: run.task_id,
        run_id: params.runId,
        type: "execution_log",
        title: "Execution console",
        url: null,
        metadata,
      });
    }

    await adminSupabase
      .from("tasks")
      .update({ status: "in_review" })
      .eq("id", run.task_id);
    broadcastRunStreamDone(params.runId);
    return { ok: true };
  });

  app.get("/runs/:runId/stream", { websocket: true }, (socket, request) => {
    const user = (request as any).user;
    const params = request.params as { runId: string };
    const runId = params.runId;

    void (async () => {
      const { data: run } = await adminSupabase
        .from("agent_runs")
        .select("id, task_id")
        .eq("id", runId)
        .single();
      if (!run) {
        socket.close(1008, "Run not found");
        return;
      }
      const { data: task } = await adminSupabase
        .from("tasks")
        .select("project_id, projects(workspace_id)")
        .eq("id", run.task_id)
        .single();
      if (!task) {
        socket.close(1008, "Run task not found");
        return;
      }
      const workspaceId = (task as any).projects?.workspace_id as
        | string
        | undefined;
      if (!workspaceId) {
        socket.close(1008, "Task project not found");
        return;
      }
      try {
        await assertWorkspaceMember(user.id, workspaceId);
      } catch {
        socket.close(1008, "Access denied");
        return;
      }

      const send: RunStreamSender = (event, data) => {
        try {
          if (socket.readyState !== 1 /* OPEN */) return;
          socket.send(JSON.stringify({ event, data }));
          if (event === "done") {
            socket.close();
            unregisterRunStream(runId, send);
          }
        } catch (_) {
          unregisterRunStream(runId, send);
        }
      };
      registerRunStream(runId, send);
      socket.on("close", () => unregisterRunStream(runId, send));
    })();
  });

  app.get("/tasks/:taskId/logs", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("project_id, projects(workspace_id)")
      .eq("id", params.taskId)
      .single();
    if (!task) return reply.status(404).send({ error: "Task not found" });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    const { data, error } = await adminSupabase
      .from("task_logs")
      .select("*")
      .eq("task_id", params.taskId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) return reply.status(400).send({ error: error.message });
    return { logs: data || [] };
  });

  app.get("/tasks/:taskId/artifacts", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("project_id, projects(workspace_id)")
      .eq("id", params.taskId)
      .single();
    if (!task) return reply.status(404).send({ error: "Task not found" });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    const { data, error } = await adminSupabase
      .from("task_artifacts")
      .select("*")
      .eq("task_id", params.taskId)
      .order("created_at", { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { artifacts: data || [] };
  });

  app.post("/tasks/:taskId/review", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };
    const body = z
      .object({ action: z.enum(["approve", "reject"]) })
      .parse(request.body);

    const { data: task } = await adminSupabase
      .from("tasks")
      .select("status, projects(workspace_id)")
      .eq("id", params.taskId)
      .single();
    if (!task) return reply.status(404).send({ error: "Task not found" });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    if (task.status !== "in_review") {
      return reply
        .status(400)
        .send({ error: "Only in_review tasks can be reviewed" });
    }

    const status = body.action === "approve" ? "done" : "backlog";
    const { data, error } = await adminSupabase
      .from("tasks")
      .update({ status })
      .eq("id", params.taskId)
      .select("*")
      .single();
    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to review task" });

    await adminSupabase.from("task_logs").insert({
      task_id: params.taskId,
      run_id: null,
      level: body.action === "approve" ? "info" : "warn",
      message:
        body.action === "approve"
          ? "Human reviewer approved output"
          : "Human reviewer requested changes",
      payload: { action: body.action },
    });

    return data;
  });

  app.get("/workspaces/:workspaceId/agents", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from("agents")
      .select("*")
      .eq("workspace_id", params.workspaceId);
    if (error) return reply.status(400).send({ error: error.message });
    return { agents: data || [] };
  });

  app.post("/workspaces/:workspaceId/agents", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const body = z
      .object({
        name: z.string().min(1),
        slug: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-_]+$/),
        backend: z.enum(["claude", "codex"]),
        model: z.string().min(1),
        config: z.object({ skills: z.array(z.string()).optional() }).optional(),
      })
      .parse(request.body);

    const { data, error } = await adminSupabase
      .from("agents")
      .insert({
        workspace_id: params.workspaceId,
        name: body.name,
        slug: body.slug,
        backend: body.backend,
        model: body.model,
        config: { skills: body.config?.skills ?? [] },
      })
      .select("*")
      .single();

    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to create agent" });
    return data;
  });

  app.patch(
    "/workspaces/:workspaceId/agents/:agentId",
    async (request, reply) => {
      const user = (request as any).user;
      const params = request.params as { workspaceId: string; agentId: string };
      await assertWorkspaceMember(user.id, params.workspaceId);

      const body = z
        .object({
          name: z.string().min(1).optional(),
          slug: z
            .string()
            .min(1)
            .regex(/^[a-z0-9-_]+$/)
            .optional(),
          backend: z.enum(["claude", "codex"]).optional(),
          model: z.string().min(1).optional(),
          config: z
            .object({ skills: z.array(z.string()).optional() })
            .optional(),
        })
        .parse(request.body);

      const updatePayload: Record<string, unknown> = {};
      if (body.name != null) updatePayload.name = body.name;
      if (body.slug != null) updatePayload.slug = body.slug;
      if (body.backend != null) updatePayload.backend = body.backend;
      if (body.model != null) updatePayload.model = body.model;
      if (body.config != null) updatePayload.config = body.config;

      const { data, error } = await adminSupabase
        .from("agents")
        .update(updatePayload)
        .eq("id", params.agentId)
        .eq("workspace_id", params.workspaceId)
        .select("*")
        .single();

      if (error || !data)
        return reply
          .status(400)
          .send({ error: error?.message || "Failed to update agent" });
      return data;
    }
  );

  app.get("/workspaces/:workspaceId/suggest-skills", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const query = request.query as { description?: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const description = query.description ?? "";
    const suggestedSkills = await detectSkillsFromDescription(description);
    return { suggestedSkills };
  });

  app.post("/integrations/oauth/start", async (request, reply) => {
    const user = (request as any).user;
    const body = z
      .object({
        provider: z.string().min(1),
        workspaceId: z.string().uuid(),
      })
      .parse(request.body);
    await assertWorkspaceMember(user.id, body.workspaceId);

    const oauthState = crypto.randomUUID();
    const stateParam = `${oauthState}::${body.provider}`;
    const { data, error } = await adminSupabase
      .from("integrations")
      .upsert(
        {
          workspace_id: body.workspaceId,
          provider: body.provider,
          oauth_state: oauthState,
          status: "awaiting_oauth",
        },
        { onConflict: "workspace_id,provider" }
      )
      .select("*")
      .single();

    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to start oauth" });

    const appBaseUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    const callbackUri = `${appBaseUrl}/integrations/oauth/callback`;
    const redirectUrl = `/integrations/oauth/callback`;

    let providerAuthUrl: string | null = null;
    if (body.provider === "github") {
      const clientId = process.env.GITHUB_CLIENT_ID;
      if (clientId) {
        providerAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
          clientId
        )}&redirect_uri=${encodeURIComponent(
          callbackUri
        )}&scope=repo&state=${encodeURIComponent(stateParam)}`;
      }
    }

    return {
      integration: data,
      redirectUrl,
      providerAuthUrl,
    };
  });

  app.post("/integrations/oauth/callback", async (request, reply) => {
    const user = (request as any).user;
    const body = z
      .object({
        provider: z.string().min(1),
        code: z.string().min(1),
        state: z.string().min(1),
      })
      .parse(request.body);

    const parts = body.state.split(":");
    const oauthState = parts[0] ?? body.state;
    const runId = parts[1] || null;

    const { data: integration } = await adminSupabase
      .from("integrations")
      .select("id, workspace_id, oauth_state")
      .eq("provider", body.provider)
      .eq("oauth_state", oauthState)
      .maybeSingle();

    if (!integration || integration.oauth_state !== oauthState) {
      return reply.status(400).send({ error: "Invalid OAuth state" });
    }
    await assertWorkspaceMember(user.id, integration.workspace_id);

    if (body.provider === "github") {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      const appBaseUrl = (
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000"
      ).replace(/\/$/, "");
      const redirectUri = `${appBaseUrl}/integrations/oauth/callback`;

      if (clientId && clientSecret) {
        const tokenRes = await fetch(
          "https://github.com/login/oauth/access_token",
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              code: body.code,
              redirect_uri: redirectUri,
            }),
          }
        );
        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
          error?: string;
        };
        if (tokenData.error) {
          return reply.status(400).send({ error: tokenData.error });
        }
        if (tokenData.access_token) {
          await adminSupabase
            .from("integrations")
            .update({
              access_token: tokenData.access_token,
              status: "connected",
              oauth_state: null,
            })
            .eq("id", integration.id);
        }
      }
    }

    return { ok: true, runId: runId || null };
  });

  app.post("/integrations/:integrationId/sync", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { integrationId: string };

    const { data: integration } = await adminSupabase
      .from("integrations")
      .select("*")
      .eq("id", params.integrationId)
      .single();
    if (!integration)
      return reply.status(404).send({ error: "Integration not found" });
    await assertWorkspaceMember(user.id, integration.workspace_id);

    const { error } = await adminSupabase.from("integration_sync_jobs").insert({
      integration_id: integration.id,
      triggered_by: user.id,
      status: "queued",
      direction: "bidirectional",
    });

    if (error) return reply.status(400).send({ error: error.message });
    return { ok: true };
  });

  app.get("/workspaces/:workspaceId/skills", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from("workspace_skills")
      .select("id, name, created_at")
      .eq("workspace_id", params.workspaceId)
      .order("created_at", { ascending: false });

    if (error) return reply.status(400).send({ error: error.message });
    return { skills: data || [] };
  });

  app.post("/workspaces/:workspaceId/skills", async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const body = z
      .object({ name: z.string().min(1), content: z.string().min(1) })
      .parse(request.body);

    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from("workspace_skills")
      .insert({
        workspace_id: params.workspaceId,
        name: body.name,
        content: body.content,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error || !data)
      return reply
        .status(400)
        .send({ error: error?.message || "Failed to import skill" });
    return data;
  });

  app.post(
    "/workspaces/:workspaceId/skills/import-from-url",
    async (request, reply) => {
      const user = (request as any).user;
      const params = request.params as { workspaceId: string };
      const body = z
        .object({
          url: z.string().url(),
          name: z.string().min(1).optional(),
        })
        .parse(request.body);

      await assertWorkspaceMember(user.id, params.workspaceId);

      const res = await fetch(body.url, {
        headers: {
          Accept: "text/plain,text/markdown,application/octet-stream,*/*",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return reply
          .status(400)
          .send({ error: `Failed to fetch URL: ${res.status}` });
      }
      const content = await res.text();
      if (content.length > 500_000) {
        return reply
          .status(400)
          .send({ error: "Skill content too large (max 500KB)" });
      }

      const name = body.name?.trim() || deriveSkillNameFromUrl(body.url);

      const { data, error } = await adminSupabase
        .from("workspace_skills")
        .insert({
          workspace_id: params.workspaceId,
          name,
          content,
          created_by: user.id,
        })
        .select("id, name")
        .single();

      if (error || !data)
        return reply
          .status(400)
          .send({ error: error?.message || "Failed to save imported skill" });
      return data;
    }
  );

  const PROVIDER_API_KEYS_KEY = "provider_api_keys";

  /** Mask provider API keys so the client never receives raw secrets. */
  function maskProviderApiKeys(value: unknown): {
    anthropic?: { configured: boolean };
    openai?: { configured: boolean };
  } {
    if (!value || typeof value !== "object") return {};
    const v = value as Record<string, unknown>;
    return {
      ...(v.anthropic != null &&
        String(v.anthropic).length > 0 && { anthropic: { configured: true } }),
      ...(v.openai != null &&
        String(v.openai).length > 0 && { openai: { configured: true } }),
    };
  }

  app.get("/user/settings", async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as { key?: string };
    let q = adminSupabase
      .from("user_settings")
      .select("key, value")
      .eq("user_id", user.id);
    if (query.key) q = q.eq("key", query.key);
    const { data, error } = await q;
    if (error) return reply.status(400).send({ error: error.message });
    if (query.key) {
      const row = data?.[0] as { key: string; value?: unknown } | undefined;
      let value = row?.value ?? null;
      if (query.key === PROVIDER_API_KEYS_KEY && value != null) {
        value = maskProviderApiKeys(value);
      }
      return { key: query.key, value };
    }
    const settings = Object.fromEntries(
      (data || []).map((row: { key: string; value: unknown }) => {
        let val = row.value;
        if (row.key === PROVIDER_API_KEYS_KEY) val = maskProviderApiKeys(val);
        return [row.key, val];
      })
    );
    return { settings };
  });

  app.patch("/user/settings", async (request, reply) => {
    const user = (request as any).user;
    const body = z
      .object({ key: z.string().min(1), value: z.any() })
      .parse(request.body);
    let value = body.value;
    if (
      body.key === PROVIDER_API_KEYS_KEY &&
      value &&
      typeof value === "object"
    ) {
      const { data: existing } = await adminSupabase
        .from("user_settings")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", PROVIDER_API_KEYS_KEY)
        .maybeSingle();
      const existingObj = (existing?.value as Record<string, unknown>) ?? {};
      value = { ...existingObj, ...value };
    }
    const { error } = await adminSupabase
      .from("user_settings")
      .upsert(
        { user_id: user.id, key: body.key, value },
        { onConflict: "user_id,key" }
      );
    if (error) return reply.status(400).send({ error: error.message });
    const outValue =
      body.key === PROVIDER_API_KEYS_KEY ? maskProviderApiKeys(value) : value;
    return { key: body.key, value: outValue };
  });

  const AGENTOS_KEY_PREFIX = "ag_";
  app.post("/user/api-keys", async (request, reply) => {
    const user = (request as any).user;
    if ((user as { apiKeyProjectId?: string }).apiKeyProjectId) {
      return reply
        .status(403)
        .send({ error: "Use session auth to create API keys" });
    }
    const body = z
      .object({ projectId: z.string().uuid(), name: z.string().optional() })
      .parse(request.body);
    const { data: project } = await adminSupabase
      .from("projects")
      .select("workspace_id")
      .eq("id", body.projectId)
      .single();
    if (!project) return reply.status(404).send({ error: "Project not found" });
    await assertWorkspaceMember(user.id, project.workspace_id);
    const rawKey = AGENTOS_KEY_PREFIX + randomBytes(24).toString("hex");
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 11);
    const { data: row, error } = await adminSupabase
      .from("agentos_api_keys")
      .insert({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        project_id: body.projectId,
        name: body.name ?? null,
      })
      .select("id")
      .single();
    if (error) return reply.status(400).send({ error: error.message });
    return { id: row.id, apiKey: rawKey };
  });

  app.get("/user/api-keys", async (request, reply) => {
    const user = (request as any).user;
    if ((user as { apiKeyProjectId?: string }).apiKeyProjectId) {
      return reply
        .status(403)
        .send({ error: "Use session auth to list API keys" });
    }
    const { data, error } = await adminSupabase
      .from("agentos_api_keys")
      .select("id, key_prefix, project_id, name, created_at, projects(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    const apiKeys = (data ?? []).map((row: any) => ({
      id: row.id,
      key_prefix: row.key_prefix,
      project_id: row.project_id,
      project_name: row.projects?.name ?? null,
      name: row.name,
      created_at: row.created_at,
    }));
    return { apiKeys };
  });

  app.delete("/user/api-keys/:id", async (request, reply) => {
    const user = (request as any).user;
    if ((user as { apiKeyProjectId?: string }).apiKeyProjectId) {
      return reply
        .status(403)
        .send({ error: "Use session auth to revoke API keys" });
    }
    const params = request.params as { id: string };
    const { error } = await adminSupabase
      .from("agentos_api_keys")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);
    if (error) return reply.status(400).send({ error: error.message });
    return { ok: true };
  });
}
