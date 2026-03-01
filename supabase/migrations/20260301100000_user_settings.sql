-- User settings / preferences for the Settings screen and account-level options

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists idx_user_settings_user_id on public.user_settings(user_id);

alter table public.user_settings enable row level security;

create policy "user_settings_self_select" on public.user_settings for select using (auth.uid() = user_id);
create policy "user_settings_self_insert" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "user_settings_self_update" on public.user_settings for update using (auth.uid() = user_id);
create policy "user_settings_self_delete" on public.user_settings for delete using (auth.uid() = user_id);

create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.handle_updated_at();
