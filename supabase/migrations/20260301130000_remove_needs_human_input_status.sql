-- Remove 'needs_human_input' from task_status enum.
-- Backfill any tasks with that status to 'in_review', then switch to a new enum.

update public.tasks
set status = 'in_review'
where status = 'needs_human_input';

create type public.task_status_new as enum (
  'backlog',
  'ai_working',
  'in_review',
  'done',
  'failed'
);

-- Drop default so the column type can be changed (old default is task_status, not task_status_new).
alter table public.tasks
  alter column status drop default;

alter table public.tasks
  alter column status type public.task_status_new
  using status::text::public.task_status_new;

alter table public.tasks
  alter column status set default 'backlog'::public.task_status_new;

drop type public.task_status;
alter type public.task_status_new rename to task_status;
