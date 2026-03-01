-- Default agents with appropriate skills in config.
-- Research: web-search, synthesis, docs. Planner: breakdown, timeline, api. Writer: docs, copy, readme.

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
    (_workspace_id, 'Research Agent', 'research', 'codex', 'gpt-5', '{"skills": ["web-search", "synthesis", "docs"]}'::jsonb),
    (_workspace_id, 'Planner Agent', 'planner', 'codex', 'gpt-5-codex', '{"skills": ["breakdown", "timeline", "api"]}'::jsonb),
    (_workspace_id, 'Writer Agent', 'writer', 'claude', 'claude-3-7-sonnet', '{"skills": ["docs", "copy", "readme"]}'::jsonb),
    (_workspace_id, 'Image Agent', 'image', 'claude', 'claude-3-5-sonnet', '{"skills": []}'::jsonb),
    (_workspace_id, 'Finance Agent', 'finance', 'codex', 'gpt-5-mini', '{"skills": []}'::jsonb);

  return new;
end;
$$;
