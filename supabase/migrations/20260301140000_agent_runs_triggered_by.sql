-- Store which user triggered the run so we can use their API keys.
alter table public.agent_runs
  add column if not exists triggered_by_user_id uuid references auth.users(id) on delete set null;

comment on column public.agent_runs.triggered_by_user_id is 'User who started the run; their provider API keys are used for the model.';
