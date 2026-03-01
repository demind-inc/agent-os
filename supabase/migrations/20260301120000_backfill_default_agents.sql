-- Backfill default agents for existing workspaces that have no agents.
-- Default agents are normally created by handle_new_user() on signup; this ensures
-- workspaces created before that trigger or with no agents also get them.

insert into public.agents (workspace_id, name, slug, backend, model, config)
select
  w.id,
  def.name,
  def.slug,
  def.backend,
  def.model,
  def.config
from public.workspaces w
cross join lateral (
  values
    ('Planner Agent', 'planner', 'codex', 'gpt-5-codex', '{"skills": ["breakdown", "timeline", "api"]}'::jsonb),
    ('Writer Agent', 'writer', 'claude', 'claude-3-7-sonnet', '{"skills": ["docs", "copy", "readme"]}'::jsonb),
    ('Researcher Agent', 'researcher', 'codex', 'gpt-5', '{"skills": ["web-search", "synthesis", "docs"]}'::jsonb),
    ('Developer Agent', 'developer', 'codex', 'gpt-5-codex', '{"skills": ["api", "github", "docs", "ui"]}'::jsonb)
) as def(name, slug, backend, model, config)
where not exists (
  select 1 from public.agents a where a.workspace_id = w.id
);
