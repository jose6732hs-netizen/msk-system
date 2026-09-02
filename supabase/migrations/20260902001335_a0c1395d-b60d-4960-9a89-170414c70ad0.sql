create extension if not exists pgcrypto;

create table if not exists public.msk_projects (
  lovable_project_id uuid primary key,
  user_id uuid,
  project_name text,
  published_url text,
  github_installation_id bigint,
  github_owner text,
  github_repo text,
  github_default_branch text default 'main',
  supabase_project_ref text,
  session_token_hash text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists msk_projects_user_id_idx on public.msk_projects(user_id);

create table if not exists public.msk_tasks (
  id uuid primary key default gen_random_uuid(),
  lovable_project_id uuid not null,
  user_id uuid,
  command text not null,
  original_command text,
  pending_command text,
  status text not null default 'queued',
  stage text,
  intent jsonb,
  attachments jsonb,
  credential_request jsonb,
  question jsonb,
  answer text,
  repository text,
  installation_id bigint,
  branch_name text,
  pull_request_url text,
  commit_sha text,
  commit_url text,
  files_changed jsonb,
  diff_summary text,
  provider text,
  model text,
  summary text,
  error text,
  error_code text,
  error_stage text,
  retry_count integer not null default 0,
  last_error_id uuid,
  openai_response_id text,
  idempotency_key text,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists msk_tasks_project_created_idx on public.msk_tasks(lovable_project_id, created_at desc);
create index if not exists msk_tasks_user_idx on public.msk_tasks(user_id, created_at desc);
create index if not exists msk_tasks_status_idx on public.msk_tasks(status);

create table if not exists public.msk_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.msk_tasks(id) on delete cascade,
  user_id uuid,
  lovable_project_id uuid,
  stage text not null,
  status text,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists msk_task_events_task_idx on public.msk_task_events(task_id, created_at desc);

create table if not exists public.msk_github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  installation_id bigint not null unique,
  account_login text,
  account_type text,
  revoked_at timestamptz,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists msk_github_installations_user_id_idx on public.msk_github_installations(user_id);

create table if not exists public.msk_agent_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lovable_project_id uuid not null,
  key_name text not null,
  provider text,
  field_type text default 'secret',
  encrypted_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lovable_project_id, key_name)
);
create index if not exists msk_agent_secrets_scope_idx on public.msk_agent_secrets(user_id, lovable_project_id);

create table if not exists public.msk_agent_errors (
  id uuid primary key default gen_random_uuid(),
  task_id uuid,
  user_id uuid,
  lovable_project_id uuid,
  repository text,
  branch_name text,
  stage text,
  code text,
  message text,
  stack text,
  retryable boolean not null default false,
  attempt integer not null default 0,
  context jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists msk_agent_errors_created_idx on public.msk_agent_errors(created_at desc);
create index if not exists msk_agent_errors_task_idx on public.msk_agent_errors(task_id);

create table if not exists public.msk_agent_locks (
  repo_branch text primary key,
  task_id uuid not null,
  user_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.msk_projects enable row level security;
alter table public.msk_tasks enable row level security;
alter table public.msk_task_events enable row level security;
alter table public.msk_github_installations enable row level security;
alter table public.msk_agent_secrets enable row level security;
alter table public.msk_agent_errors enable row level security;
alter table public.msk_agent_locks enable row level security;

revoke all on table public.msk_projects from anon, authenticated;
revoke all on table public.msk_tasks from anon, authenticated;
revoke all on table public.msk_task_events from anon, authenticated;
revoke all on table public.msk_github_installations from anon, authenticated;
revoke all on table public.msk_agent_secrets from anon, authenticated;
revoke all on table public.msk_agent_errors from anon, authenticated;
revoke all on table public.msk_agent_locks from anon, authenticated;

grant all on table public.msk_projects to service_role;
grant all on table public.msk_tasks to service_role;
grant all on table public.msk_task_events to service_role;
grant all on table public.msk_github_installations to service_role;
grant all on table public.msk_agent_secrets to service_role;
grant all on table public.msk_agent_errors to service_role;
grant all on table public.msk_agent_locks to service_role;

create or replace function public.msk_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists msk_projects_touch on public.msk_projects;
create trigger msk_projects_touch before update on public.msk_projects
for each row execute function public.msk_touch_updated_at();

drop trigger if exists msk_tasks_touch on public.msk_tasks;
create trigger msk_tasks_touch before update on public.msk_tasks
for each row execute function public.msk_touch_updated_at();

drop trigger if exists msk_agent_secrets_touch on public.msk_agent_secrets;
create trigger msk_agent_secrets_touch before update on public.msk_agent_secrets
for each row execute function public.msk_touch_updated_at();

create or replace function public.msk_task_persistence_probe(p_project_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_id uuid;
begin
  select user_id into v_owner from public.msk_projects where lovable_project_id = p_project_id;
  if v_owner is not null and p_user_id is not null and v_owner <> p_user_id then
    return jsonb_build_object('ok', false, 'code', 'PROJECT_OWNERSHIP_MISMATCH');
  end if;

  begin
    insert into public.msk_tasks (lovable_project_id, user_id, command, status)
    values (p_project_id, p_user_id, '__msk_write_probe__', 'probe')
    returning id into v_id;
    delete from public.msk_tasks where id = v_id;
  exception when others then
    return jsonb_build_object('ok', false, 'code', SQLSTATE, 'detail', left(SQLERRM, 300));
  end;

  return jsonb_build_object('ok', true, 'code', 'DATABASE_WRITE_READY');
end;
$$;

alter publication supabase_realtime add table public.msk_tasks;
alter publication supabase_realtime add table public.msk_task_events;
alter table public.msk_tasks replica identity full;
alter table public.msk_task_events replica identity full;