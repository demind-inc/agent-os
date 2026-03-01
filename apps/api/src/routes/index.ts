import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { adminSupabase, assertWorkspaceMember, detectSkillsFromDescription, getUserFromBearer } from "../plugins/supabase.js";
import { enqueueRun } from "../services/runner.js";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default("")
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["backlog", "ai_working", "needs_human_input", "in_review", "done", "failed"]).optional(),
  metadata: z.record(z.any()).optional()
});

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

    const detectedSkills = await detectSkillsFromDescription(body.description);

    const { data, error } = await adminSupabase
      .from('tasks')
      .insert({
        project_id: params.projectId,
        title: body.title,
        description: body.description,
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

    const { data: task } = await adminSupabase.from('tasks').select('project_id, projects(workspace_id)').eq('id', params.taskId).single();
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    const workspaceId = (task as any).projects.workspace_id as string;
    await assertWorkspaceMember(user.id, workspaceId);

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
}
