create table if not exists public.msk_agent_errors (
  id uuid primary key default gen_random_uuid(),
  task_id uuid null,
  user_id uuid null,
  lovable_project_id uuid null,
  repository text null,
  branch_name text null,
  stage text not null default 'unknown',
  code text not null,
  message text not null,
  stack text null,
  retryable boolean not null default false,
  attempt integer not null default 0,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.msk_agent_errors enable row level security;
revoke all on table public.msk_agent_errors from anon, authenticated;
grant select, insert, update, delete on table public.msk_agent_errors to service_role;

create index if not exists msk_agent_errors_task_idx
  on public.msk_agent_errors(task_id, created_at desc);
create index if not exists msk_agent_errors_code_idx
  on public.msk_agent_errors(code, created_at desc);

create table if not exists public.msk_agent_locks (
  repo_branch text primary key,
  task_id uuid not null,
  user_id uuid not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.msk_agent_locks enable row level security;
revoke all on table public.msk_agent_locks from anon, authenticated;
grant select, insert, update, delete on table public.msk_agent_locks to service_role;

create index if not exists msk_agent_locks_expires_idx
  on public.msk_agent_locks(expires_at);

alter table public.msk_tasks add column if not exists error_code text;
alter table public.msk_tasks add column if not exists error_stage text;
alter table public.msk_tasks add column if not exists retry_count integer not null default 0;
alter table public.msk_tasks add column if not exists last_error_id uuid null;
