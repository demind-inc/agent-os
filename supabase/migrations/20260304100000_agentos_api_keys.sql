-- AgentOS API keys for CLI and skills (no OAuth). One key = one user + one project.

create table if not exists public.agentos_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null,
  key_prefix text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_agentos_api_keys_key_hash on public.agentos_api_keys(key_hash);
create index if not exists idx_agentos_api_keys_user_id on public.agentos_api_keys(user_id);

alter table public.agentos_api_keys enable row level security;

create policy "agentos_api_keys_self_select" on public.agentos_api_keys for select using (auth.uid() = user_id);
create policy "agentos_api_keys_self_insert" on public.agentos_api_keys for insert with check (auth.uid() = user_id);
create policy "agentos_api_keys_self_delete" on public.agentos_api_keys for delete using (auth.uid() = user_id);

-- Service role will look up by key_hash for API key auth (no RLS on that path; we use service role and validate in app).
