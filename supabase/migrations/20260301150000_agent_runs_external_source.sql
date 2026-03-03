-- Add source column for external agent runs (codex, claude, openclaw)
alter table public.agent_runs
  add column if not exists source text;

comment on column public.agent_runs.source is 'Source of the run: null for internal (app-triggered), or codex/claude/openclaw for external agents.';
