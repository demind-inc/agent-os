-- AgentOS core schema

create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'editor', 'viewer');
create type public.task_status as enum ('backlog', 'ai_working', 'needs_human_input', 'in_review', 'done', 'failed');
create type public.run_status as enum ('queued', 'running', 'awaiting_input', 'completed', 'failed');
create type public.integration_status as enum ('connected', 'awaiting_oauth', 'failed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'editor',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  backend text not null,
  model text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  status public.task_status not null default 'backlog',
  assignee_id uuid references auth.users(id),
  assigned_agent_id uuid references public.agents(id),
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  agent_id uuid not null references public.agents(id),
  status public.run_status not null default 'queued',
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  level text not null,
  message text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.task_artifacts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  type text not null,
  title text not null,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  status public.integration_status not null default 'awaiting_oauth',
  oauth_state text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists public.integration_sync_mapping (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  external_id text not null,
  last_synced_at timestamptz,
  unique (integration_id, external_id)
);

create table if not exists public.integration_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  triggered_by uuid not null references auth.users(id),
  status text not null default 'queued',
  direction text not null default 'bidirectional',
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  content text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_workspace_member(_user_id uuid, _workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = _workspace_id and user_id = _user_id
  );
$$;

create or replace function public.workspace_for_project(_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.projects where id = _project_id;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.agent_runs enable row level security;
alter table public.task_logs enable row level security;
alter table public.task_artifacts enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_sync_mapping enable row level security;
alter table public.integration_sync_jobs enable row level security;
alter table public.workspace_skills enable row level security;

create policy "profile_self_select" on public.profiles for select using (auth.uid() = id);
create policy "profile_self_update" on public.profiles for update using (auth.uid() = id);

create policy "workspace_member_select" on public.workspaces for select using (public.is_workspace_member(auth.uid(), id));
create policy "workspace_owner_update" on public.workspaces for update using (owner_id = auth.uid());

create policy "workspace_member_view_members" on public.workspace_members for select using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "workspace_owner_manage_members" on public.workspace_members for all using (
  exists (
    select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()
  )
);

create policy "workspace_member_projects_select" on public.projects for select using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "workspace_member_projects_insert" on public.projects for insert with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy "workspace_member_projects_update" on public.projects for update using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "workspace_member_agents_select" on public.agents for select using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "workspace_member_agents_insert" on public.agents for insert with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy "workspace_member_agents_update" on public.agents for update using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "workspace_member_tasks_select" on public.tasks for select using (public.is_workspace_member(auth.uid(), public.workspace_for_project(project_id)));
create policy "workspace_member_tasks_insert" on public.tasks for insert with check (public.is_workspace_member(auth.uid(), public.workspace_for_project(project_id)));
create policy "workspace_member_tasks_update" on public.tasks for update using (public.is_workspace_member(auth.uid(), public.workspace_for_project(project_id)));
create policy "workspace_member_tasks_delete" on public.tasks for delete using (public.is_workspace_member(auth.uid(), public.workspace_for_project(project_id)));

create policy "workspace_member_runs_select" on public.agent_runs for select using (
  exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.id = task_id and public.is_workspace_member(auth.uid(), p.workspace_id)
  )
);
create policy "workspace_member_runs_insert" on public.agent_runs for insert with check (
  exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.id = task_id and public.is_workspace_member(auth.uid(), p.workspace_id)
  )
);
create policy "workspace_member_runs_update" on public.agent_runs for update using (
  exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.id = task_id and public.is_workspace_member(auth.uid(), p.workspace_id)
  )
);

create policy "workspace_member_logs_select" on public.task_logs for select using (
  exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
    where t.id = task_id and public.is_workspace_member(auth.uid(), p.workspace_id)
  )
);
create policy "workspace_member_logs_insert" on public.task_logs for insert with check (
  exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
    where t.id = task_id and public.is_workspace_member(auth.uid(), p.workspace_id)
  )
);

create policy "workspace_member_artifacts_select" on public.task_artifacts for select using (
  exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
    where t.id = task_id and public.is_workspace_member(auth.uid(), p.workspace_id)
  )
);
create policy "workspace_member_artifacts_insert" on public.task_artifacts for insert with check (
  exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
    where t.id = task_id and public.is_workspace_member(auth.uid(), p.workspace_id)
  )
);

create policy "workspace_member_integrations_select" on public.integrations for select using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "workspace_member_integrations_manage" on public.integrations for all using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "workspace_member_sync_mapping" on public.integration_sync_mapping for all using (
  exists (
    select 1 from public.integrations i where i.id = integration_id and public.is_workspace_member(auth.uid(), i.workspace_id)
  )
);

create policy "workspace_member_sync_jobs" on public.integration_sync_jobs for all using (
  exists (
    select 1 from public.integrations i where i.id = integration_id and public.is_workspace_member(auth.uid(), i.workspace_id)
  )
);

create policy "workspace_member_skills" on public.workspace_skills for all using (public.is_workspace_member(auth.uid(), workspace_id));

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _workspace_id uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (name, owner_id)
  values (coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s Workspace', new.id)
  returning id into _workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (_workspace_id, new.id, 'owner');

  insert into public.projects (workspace_id, name, created_by)
  values (_workspace_id, 'Q4 Launch', new.id);

  insert into public.agents (workspace_id, name, slug, backend, model, config)
  values
    (_workspace_id, 'Planner Agent', 'planner', 'codex', 'gpt-5-codex', '{}'::jsonb),
    (_workspace_id, 'Writer Agent', 'writer', 'claude', 'claude-3-7-sonnet', '{}'::jsonb),
    (_workspace_id, 'Research Agent', 'research', 'codex', 'gpt-5', '{}'::jsonb),
    (_workspace_id, 'Image Agent', 'image', 'claude', 'claude-3-5-sonnet', '{}'::jsonb),
    (_workspace_id, 'Finance Agent', 'finance', 'codex', 'gpt-5-mini', '{}'::jsonb);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.handle_updated_at();

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at before update on public.workspaces for each row execute function public.handle_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks for each row execute function public.handle_updated_at();

drop trigger if exists trg_integrations_updated_at on public.integrations;
create trigger trg_integrations_updated_at before update on public.integrations for each row execute function public.handle_updated_at();

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.task_logs;
