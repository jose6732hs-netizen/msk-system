alter table public.msk_projects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists msk_projects_user_id_idx
  on public.msk_projects(user_id);

alter table public.msk_tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists msk_tasks_user_id_idx
  on public.msk_tasks(user_id);

create table if not exists public.msk_github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null unique,
  account_login text,
  account_type text,
  revoked_at timestamptz,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists msk_github_installations_user_id_idx
  on public.msk_github_installations(user_id);

alter table public.msk_github_installations enable row level security;
revoke all on table public.msk_github_installations from anon, authenticated;
