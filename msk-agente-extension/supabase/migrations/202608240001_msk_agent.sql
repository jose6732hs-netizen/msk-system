create extension if not exists pgcrypto;

create table if not exists public.msk_projects (
  lovable_project_id uuid primary key,
  project_name text,
  published_url text,
  github_installation_id bigint,
  github_owner text,
  github_repo text,
  github_default_branch text default 'main',
  supabase_project_ref text,
  session_token_hash text,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.msk_tasks (
  id uuid primary key default gen_random_uuid(),
  lovable_project_id uuid not null references public.msk_projects(lovable_project_id) on delete cascade,
  command text not null,
  status text not null default 'queued' check (status in ('queued','analyzing','editing','awaiting_approval','completed','failed')),
  branch_name text,
  pull_request_url text,
  summary text,
  error text,
  openai_response_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.msk_projects enable row level security;
alter table public.msk_tasks enable row level security;
revoke all on public.msk_projects from anon, authenticated;
revoke all on public.msk_tasks from anon, authenticated;

create index if not exists msk_tasks_project_created_idx
  on public.msk_tasks(lovable_project_id, created_at desc);
