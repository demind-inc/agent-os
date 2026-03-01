import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { adminSupabase, assertWorkspaceMember, detectSkillsFromDescription, getUserFromBearer } from "../plugins/supabase.js";
import { enqueueRun } from "../services/runner.js";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  assigned_agent_id: z.string().uuid()
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["backlog", "ai_working", "in_review", "done", "failed"]).optional(),
  metadata: z.record(z.any()).optional()
});

function deriveSkillNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    const segment = path.split("/").filter(Boolean).pop() || "imported-skill";
    const base = segment.replace(/\.(md|txt|skill)$/i, "").replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-");
    return base || "imported-skill";
  } catch {
    return "imported-skill";
  }
}

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }));

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health") return;
    const user = await getUserFromBearer(request.headers.authorization);
    if (!user) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }
    (request as any).user = user;
  });

  app.get('/profile', async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as { workspaceId?: string };
    let { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', user.id)
      .single();

    // Create profile if missing (e.g. trigger didn't run, or user created before migration)
    if (profileError || !profile) {
      const fullName = (user.user_metadata?.full_name as string) || (user.email ? user.email.split('@')[0] : null);
      const { error: insertError } = await adminSupabase.from('profiles').insert({
        id: user.id,
        email: user.email ?? '',
        full_name: fullName
      });
      if (insertError) {
        if ((insertError as { code?: string }).code === '23505') {
          const result = await adminSupabase.from('profiles').select('id, email, full_name, avatar_url').eq('id', user.id).single();
          profile = result.data;
          profileError = result.error;
        } else {
          return reply.status(500).send({ error: 'Failed to create profile' });
        }
      } else {
        const result = await adminSupabase.from('profiles').select('id, email, full_name, avatar_url').eq('id', user.id).single();
        profile = result.data;
        profileError = result.error;
      }
    }

    if (profileError || !profile) return reply.status(404).send({ error: 'Profile not found' });

    let role: string | null = null;
    if (query.workspaceId) {
      const { data: member } = await adminSupabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', query.workspaceId)
        .eq('user_id', user.id)
        .maybeSingle();
      role = (member as { role?: string } | null)?.role ?? null;
    }

    return { profile: { ...profile, role } };
  });

  app.patch('/profile', async (request, reply) => {
    const user = (request as any).user;
    const body = z.object({ full_name: z.string().optional(), avatar_url: z.string().url().optional() }).parse(request.body || {});
    const { data, error } = await adminSupabase
      .from('profiles')
      .update(body)
      .eq('id', user.id)
      .select('id, email, full_name, avatar_url')
      .single();

    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to update profile' });
    return data;
  });

  app.delete('/profile', async (request, reply) => {
    const user = (request as any).user;
    const userId = user.id;

    // Clear or reassign references so we can delete the auth user (no CASCADE on these).
    await adminSupabase.from('tasks').update({ assignee_id: null }).eq('assignee_id', userId);

    const { data: projects } = await adminSupabase.from('projects').select('id, workspace_id').eq('created_by', userId);
    if (projects?.length) {
      const workspaceIds = [...new Set(projects.map((p) => p.workspace_id))];
      for (const wid of workspaceIds) {
        const { data: w } = await adminSupabase.from('workspaces').select('owner_id').eq('id', wid).single();
        if (w?.owner_id && w.owner_id !== userId) {
          await adminSupabase.from('projects').update({ created_by: w.owner_id }).eq('workspace_id', wid).eq('created_by', userId);
        }
      }
    }

    await adminSupabase.from('workspace_skills').delete().eq('created_by', userId);
    await adminSupabase.from('integration_sync_jobs').delete().eq('triggered_by', userId);
    await adminSupabase.from('workspace_members').delete().eq('user_id', userId);
    await adminSupabase.from('workspaces').delete().eq('owner_id', userId);
    await adminSupabase.from('user_settings').delete().eq('user_id', userId);
    await adminSupabase.from('profiles').delete().eq('id', userId);

    const { error: authError } = await adminSupabase.auth.admin.deleteUser(userId);
    if (authError) return reply.status(500).send({ error: authError.message });

    return { ok: true };
  });

  app.get('/workspaces', async (request, reply) => {
    const user = (request as any).user;
    const { data, error } = await adminSupabase
      .from('workspace_members')
      .select('workspaces(id,name)')
      .eq('user_id', user.id);

    if (error) return reply.status(400).send({ error: error.message });
    const workspaces = (data || []).map((row: any) => row.workspaces).filter(Boolean);
    return { workspaces };
  });

  app.post('/workspaces', async (request, reply) => {
    const user = (request as any).user;
    const body = z.object({ name: z.string().min(1) }).parse(request.body);

    const { data: workspace, error } = await adminSupabase
      .from('workspaces')
      .insert({ name: body.name, owner_id: user.id })
      .select('id,name')
      .single();

    if (error || !workspace) return reply.status(400).send({ error: error?.message || 'Failed to create workspace' });

    await adminSupabase.from('workspace_members').insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });

    return workspace;
  });

  app.get('/workspaces/:workspaceId', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase.from('workspaces').select('id, name').eq('id', params.workspaceId).single();
    if (error || !data) return reply.status(404).send({ error: 'Workspace not found' });
    return data;
  });

  app.patch('/workspaces/:workspaceId', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const body = z.object({ name: z.string().min(1) }).parse(request.body);

    const { data: workspace } = await adminSupabase.from('workspaces').select('owner_id').eq('id', params.workspaceId).single();
    if (!workspace || workspace.owner_id !== user.id) return reply.status(403).send({ error: 'Only the workspace owner can update the workspace' });

    const { data, error } = await adminSupabase.from('workspaces').update({ name: body.name }).eq('id', params.workspaceId).select('id, name').single();
    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to update workspace' });
    return data;
  });

  app.get('/workspaces/:workspaceId/members', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data: rows, error } = await adminSupabase
      .from('workspace_members')
      .select('id, user_id, role')
      .eq('workspace_id', params.workspaceId);

    if (error) return reply.status(400).send({ error: error.message });
    if (!rows?.length) return { members: [] };

    const userIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];
    const { data: profiles } = await adminSupabase.from('profiles').select('id, email, full_name, avatar_url').in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: { id: string }) => [p.id, p]));

    const members = rows.map((row: { id: string; user_id: string; role: string }) => {
      const p = profileMap.get(row.user_id);
      return {
        id: row.id,
        user_id: row.user_id,
        role: row.role,
        email: p?.email ?? '',
        full_name: p?.full_name ?? null,
        avatar_url: p?.avatar_url ?? null
      };
    });
    return { members };
  });

  app.get('/workspaces/:workspaceId/integrations', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase.from('integrations').select('id, provider, status').eq('workspace_id', params.workspaceId);
    if (error) return reply.status(400).send({ error: error.message });
    return { integrations: data || [] };
  });

  app.get('/workspaces/:workspaceId/projects', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase.from('projects').select('*').eq('workspace_id', params.workspaceId).order('created_at', { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { projects: data || [] };
  });

  app.post('/workspaces/:workspaceId/projects', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const body = z.object({ name: z.string().min(1) }).parse(request.body);
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from('projects')
      .insert({ workspace_id: params.workspaceId, name: body.name, created_by: user.id })
      .select('*')
      .single();

    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to create project' });
    return data;
  });

  app.get('/projects/:projectId/tasks', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { projectId: string };

    const { data: project } = await adminSupabase.from('projects').select('workspace_id').eq('id', params.projectId).single();
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    await assertWorkspaceMember(user.id, project.workspace_id);

    const { data, error } = await adminSupabase.from('tasks').select('*').eq('project_id', params.projectId).order('created_at', { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { tasks: data || [] };
  });

  app.post('/projects/:projectId/tasks', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { projectId: string };
    const body = createTaskSchema.parse(request.body);

    const { data: project } = await adminSupabase.from('projects').select('workspace_id').eq('id', params.projectId).single();
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    await assertWorkspaceMember(user.id, project.workspace_id);

    const { data: agent } = await adminSupabase.from('agents').select('id').eq('id', body.assigned_agent_id).eq('workspace_id', project.workspace_id).maybeSingle();
    if (!agent) return reply.status(400).send({ error: 'Invalid or inaccessible agent' });

    const detectedSkills = await detectSkillsFromDescription(body.description);

    const { data, error } = await adminSupabase
      .from('tasks')
      .insert({
        project_id: params.projectId,
        title: body.title,
        description: body.description,
        assigned_agent_id: body.assigned_agent_id,
        metadata: { detectedSkills }
      })
      .select('*')
      .single();

    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to create task' });
    return data;
  });

  app.patch('/tasks/:taskId', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };
    const body = updateTaskSchema.parse(request.body);

    const { data: task } = await adminSupabase
      .from('tasks')
      .select('id,status,project_id,projects(workspace_id)')
      .eq('id', params.taskId)
      .single();

    if (!task) return reply.status(404).send({ error: 'Task not found' });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    if (task.status === 'in_review' && body.status && body.status !== 'done' && body.status !== 'failed') {
      return reply.status(400).send({ error: 'Task in review can only move to done/failed via review actions' });
    }

    const next = { ...body } as any;
    if (body.description) {
      next.metadata = { ...(next.metadata || {}), detectedSkills: await detectSkillsFromDescription(body.description) };
    }

    const { data, error } = await adminSupabase.from('tasks').update(next).eq('id', params.taskId).select('*').single();
    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to update task' });
    return data;
  });

  app.delete('/tasks/:taskId', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };

    const { data: task } = await adminSupabase
      .from('tasks')
      .select('id, project_id, projects(workspace_id)')
      .eq('id', params.taskId)
      .single();

    if (!task) return reply.status(404).send({ error: 'Task not found' });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    const { error } = await adminSupabase.from('tasks').delete().eq('id', params.taskId);
    if (error) return reply.status(400).send({ error: error.message });
    return { ok: true };
  });

  app.get('/projects/:projectId/runs', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { projectId: string };

    const { data: project } = await adminSupabase.from('projects').select('workspace_id').eq('id', params.projectId).single();
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    await assertWorkspaceMember(user.id, project.workspace_id);

    const { data: tasks } = await adminSupabase.from('tasks').select('id').eq('project_id', params.projectId);
    const taskIds = (tasks || []).map((task) => task.id);
    if (!taskIds.length) return { runs: [] };

    const { data, error } = await adminSupabase.from('agent_runs').select('*').in('task_id', taskIds).order('created_at', { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { runs: data || [] };
  });

  app.post('/tasks/:taskId/run', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };
    const body = z.object({ agentId: z.string().optional(), model: z.string().optional() }).parse(request.body || {});

    const { data: task } = await adminSupabase
      .from('tasks')
      .select('status, project_id, projects(workspace_id)')
      .eq('id', params.taskId)
      .single();
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    const workspaceId = (task as any).projects.workspace_id as string;
    await assertWorkspaceMember(user.id, workspaceId);
    if (task.status !== 'backlog' && task.status !== 'in_review') {
      return reply.status(400).send({ error: 'Task can only be run when in Backlog or In Review' });
    }

    let agentId = body.agentId;
    if (!agentId) {
      const { data: firstAgent } = await adminSupabase.from('agents').select('id').eq('workspace_id', workspaceId).order('created_at').limit(1).maybeSingle();
      if (!firstAgent) return reply.status(400).send({ error: 'No agents configured' });
      agentId = firstAgent.id;
    }

    const { data: run, error } = await adminSupabase
      .from('agent_runs')
      .insert({
        task_id: params.taskId,
        agent_id: agentId,
        status: 'queued',
        input_snapshot: { requestedModel: body.model || null }
      })
      .select('*')
      .single();

    if (error || !run) return reply.status(400).send({ error: error?.message || 'Failed to create run' });
    await enqueueRun(run.id);
    return run;
  });

  app.get('/tasks/:taskId/logs', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };

    const { data: task } = await adminSupabase.from('tasks').select('project_id, projects(workspace_id)').eq('id', params.taskId).single();
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    const { data, error } = await adminSupabase.from('task_logs').select('*').eq('task_id', params.taskId).order('created_at', { ascending: false }).limit(100);
    if (error) return reply.status(400).send({ error: error.message });
    return { logs: data || [] };
  });

  app.get('/tasks/:taskId/artifacts', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };

    const { data: task } = await adminSupabase.from('tasks').select('project_id, projects(workspace_id)').eq('id', params.taskId).single();
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    const { data, error } = await adminSupabase.from('task_artifacts').select('*').eq('task_id', params.taskId).order('created_at', { ascending: false });
    if (error) return reply.status(400).send({ error: error.message });
    return { artifacts: data || [] };
  });

  app.post('/tasks/:taskId/review', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { taskId: string };
    const body = z.object({ action: z.enum(['approve', 'reject']) }).parse(request.body);

    const { data: task } = await adminSupabase.from('tasks').select('status, projects(workspace_id)').eq('id', params.taskId).single();
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    await assertWorkspaceMember(user.id, (task as any).projects.workspace_id);

    if (task.status !== 'in_review') {
      return reply.status(400).send({ error: 'Only in_review tasks can be reviewed' });
    }

    const status = body.action === 'approve' ? 'done' : 'backlog';
    const { data, error } = await adminSupabase.from('tasks').update({ status }).eq('id', params.taskId).select('*').single();
    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to review task' });

    await adminSupabase.from('task_logs').insert({
      task_id: params.taskId,
      run_id: null,
      level: body.action === 'approve' ? 'info' : 'warn',
      message: body.action === 'approve' ? 'Human reviewer approved output' : 'Human reviewer requested changes',
      payload: { action: body.action }
    });

    return data;
  });

  app.get('/workspaces/:workspaceId/agents', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase.from('agents').select('*').eq('workspace_id', params.workspaceId);
    if (error) return reply.status(400).send({ error: error.message });
    return { agents: data || [] };
  });

  app.post('/workspaces/:workspaceId/agents', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const body = z.object({
      name: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-_]+$/),
      backend: z.enum(['claude', 'codex']),
      model: z.string().min(1),
      config: z.object({ skills: z.array(z.string()).optional() }).optional()
    }).parse(request.body);

    const { data, error } = await adminSupabase
      .from('agents')
      .insert({
        workspace_id: params.workspaceId,
        name: body.name,
        slug: body.slug,
        backend: body.backend,
        model: body.model,
        config: { skills: body.config?.skills ?? [] }
      })
      .select('*')
      .single();

    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to create agent' });
    return data;
  });

  app.patch('/workspaces/:workspaceId/agents/:agentId', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string; agentId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const body = z.object({
      name: z.string().min(1).optional(),
      slug: z.string().min(1).regex(/^[a-z0-9-_]+$/).optional(),
      backend: z.enum(['claude', 'codex']).optional(),
      model: z.string().min(1).optional(),
      config: z.object({ skills: z.array(z.string()).optional() }).optional()
    }).parse(request.body);

    const updatePayload: Record<string, unknown> = {};
    if (body.name != null) updatePayload.name = body.name;
    if (body.slug != null) updatePayload.slug = body.slug;
    if (body.backend != null) updatePayload.backend = body.backend;
    if (body.model != null) updatePayload.model = body.model;
    if (body.config != null) updatePayload.config = body.config;

    const { data, error } = await adminSupabase
      .from('agents')
      .update(updatePayload)
      .eq('id', params.agentId)
      .eq('workspace_id', params.workspaceId)
      .select('*')
      .single();

    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to update agent' });
    return data;
  });

  app.get('/workspaces/:workspaceId/suggest-skills', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const query = request.query as { description?: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const description = query.description ?? '';
    const suggestedSkills = await detectSkillsFromDescription(description);
    return { suggestedSkills };
  });

  app.post('/integrations/oauth/start', async (request, reply) => {
    const user = (request as any).user;
    const body = z.object({ provider: z.string().min(1), workspaceId: z.string().uuid() }).parse(request.body);
    await assertWorkspaceMember(user.id, body.workspaceId);

    const oauthState = crypto.randomUUID();
    const { data, error } = await adminSupabase
      .from('integrations')
      .upsert({ workspace_id: body.workspaceId, provider: body.provider, oauth_state: oauthState, status: 'awaiting_oauth' }, { onConflict: 'workspace_id,provider' })
      .select('*')
      .single();

    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to start oauth' });

    return {
      integration: data,
      redirectUrl: `/integrations/oauth/callback?provider=${encodeURIComponent(body.provider)}&state=${oauthState}`
    };
  });

  app.get('/integrations/oauth/callback', async (request) => {
    const query = request.query as { provider?: string; state?: string; code?: string };
    return {
      ok: true,
      provider: query.provider,
      state: query.state,
      code: query.code || null,
      note: 'OAuth callback placeholder. Exchange code with provider in production.'
    };
  });

  app.post('/integrations/:integrationId/sync', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { integrationId: string };

    const { data: integration } = await adminSupabase.from('integrations').select('*').eq('id', params.integrationId).single();
    if (!integration) return reply.status(404).send({ error: 'Integration not found' });
    await assertWorkspaceMember(user.id, integration.workspace_id);

    const { error } = await adminSupabase.from('integration_sync_jobs').insert({
      integration_id: integration.id,
      triggered_by: user.id,
      status: 'queued',
      direction: 'bidirectional'
    });

    if (error) return reply.status(400).send({ error: error.message });
    return { ok: true };
  });

  app.get('/workspaces/:workspaceId/skills', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from('workspace_skills')
      .select('id, name, created_at')
      .eq('workspace_id', params.workspaceId)
      .order('created_at', { ascending: false });

    if (error) return reply.status(400).send({ error: error.message });
    return { skills: data || [] };
  });

  app.post('/workspaces/:workspaceId/skills', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const body = z.object({ name: z.string().min(1), content: z.string().min(1) }).parse(request.body);

    await assertWorkspaceMember(user.id, params.workspaceId);

    const { data, error } = await adminSupabase
      .from('workspace_skills')
      .insert({ workspace_id: params.workspaceId, name: body.name, content: body.content, created_by: user.id })
      .select('*')
      .single();

    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to import skill' });
    return data;
  });

  app.post('/workspaces/:workspaceId/skills/import-from-url', async (request, reply) => {
    const user = (request as any).user;
    const params = request.params as { workspaceId: string };
    const body = z.object({
      url: z.string().url(),
      name: z.string().min(1).optional()
    }).parse(request.body);

    await assertWorkspaceMember(user.id, params.workspaceId);

    const res = await fetch(body.url, {
      headers: { Accept: 'text/plain,text/markdown,application/octet-stream,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      return reply.status(400).send({ error: `Failed to fetch URL: ${res.status}` });
    }
    const content = await res.text();
    if (content.length > 500_000) {
      return reply.status(400).send({ error: 'Skill content too large (max 500KB)' });
    }

    const name = body.name?.trim() || deriveSkillNameFromUrl(body.url);

    const { data, error } = await adminSupabase
      .from('workspace_skills')
      .insert({ workspace_id: params.workspaceId, name, content, created_by: user.id })
      .select('id, name')
      .single();

    if (error || !data) return reply.status(400).send({ error: error?.message || 'Failed to save imported skill' });
    return data;
  });

  app.get('/user/settings', async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as { key?: string };
    let q = adminSupabase.from('user_settings').select('key, value').eq('user_id', user.id);
    if (query.key) q = q.eq('key', query.key);
    const { data, error } = await q;
    if (error) return reply.status(400).send({ error: error.message });
    if (query.key) return { key: query.key, value: (data?.[0] as { value?: unknown })?.value ?? null };
    const settings = Object.fromEntries((data || []).map((row: { key: string; value: unknown }) => [row.key, row.value]));
    return { settings };
  });

  app.patch('/user/settings', async (request, reply) => {
    const user = (request as any).user;
    const body = z.object({ key: z.string().min(1), value: z.any() }).parse(request.body);
    const { error } = await adminSupabase.from('user_settings').upsert(
      { user_id: user.id, key: body.key, value: body.value },
      { onConflict: 'user_id,key' }
    );
    if (error) return reply.status(400).send({ error: error.message });
    return { key: body.key, value: body.value };
  });
}
