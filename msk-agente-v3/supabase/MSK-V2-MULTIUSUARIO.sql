-- MSK Agente v2 — base multiusuário
-- Execute uma única vez no SQL Editor do Supabase central.

create extension if not exists pgcrypto;
create schema if not exists msk_private;
revoke all on schema msk_private from public, anon, authenticated;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  own_model_key_ciphertext bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro')),
  billing_period text not null default 'monthly' check (billing_period in ('daily','weekly','monthly','quarterly')),
  status text not null default 'active' check (status in ('active','expired','suspended','cancelled')),
  monthly_run_limit integer not null default 20 check (monthly_run_limit >= 0),
  monthly_token_limit bigint not null default 200000 check (monthly_token_limit >= 0),
  deploy_limit integer not null default 5 check (deploy_limit >= 0),
  badge_removal_enabled boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lovable_project_id uuid,
  repo_full_name text not null,
  default_branch text not null default 'main',
  active boolean not null default false,
  preview_url text,
  deploy_provider text check (deploy_provider in ('lovable','vercel','netlify','cloudflare')),
  deploy_project_id text,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, repo_full_name)
);

create unique index if not exists projects_one_active_per_user
  on public.projects(user_id) where active;

create table if not exists public.app_user_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connector_id text not null,
  connection_key_ciphertext bytea not null,
  github_login text,
  provider_user_id text,
  scopes text[] not null default '{}',
  revoked_at timestamptz,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, connector_id)
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  action text not null,
  command text,
  status text not null default 'queued' check (status in ('queued','analyzing','editing','building','awaiting_confirmation','completed','failed','rolled_back')),
  branch_name text,
  commit_sha text,
  previous_commit_sha text,
  pull_request_url text,
  preview_url text,
  files_changed jsonb not null default '[]'::jsonb,
  summary text,
  error_status integer,
  error_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.access_log (
  id bigint generated always as identity primary key,
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip inet,
  user_agent text,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_last_opened_idx on public.projects(user_id, last_opened_at desc);
create index if not exists runs_user_created_idx on public.runs(user_id, created_at desc);
create index if not exists usage_user_created_idx on public.usage(user_id, created_at desc);
create index if not exists access_log_user_created_idx on public.access_log(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.projects enable row level security;
alter table public.app_user_connections enable row level security;
alter table public.runs enable row level security;
alter table public.usage enable row level security;
alter table public.access_log enable row level security;

revoke all on public.profiles, public.plans, public.projects, public.app_user_connections, public.runs, public.usage, public.access_log from anon;
grant select, update on public.profiles to authenticated;
grant select on public.plans to authenticated;
grant select on public.projects, public.runs, public.usage, public.access_log to authenticated;
revoke all on public.app_user_connections from authenticated;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists plans_owner_select on public.plans;
create policy plans_owner_select on public.plans for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists projects_owner_select on public.projects;
create policy projects_owner_select on public.projects for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists runs_owner_select on public.runs;
create policy runs_owner_select on public.runs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists usage_owner_select on public.usage;
create policy usage_owner_select on public.usage for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists access_log_owner_select on public.access_log;
create policy access_log_owner_select on public.access_log for select to authenticated using ((select auth.uid()) = user_id);

create or replace function msk_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(user_id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.raw_user_meta_data ->> 'avatar_url')
  on conflict (user_id) do nothing;
  insert into public.plans(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function msk_private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_msk on auth.users;
create trigger on_auth_user_created_msk after insert on auth.users
for each row execute function msk_private.handle_new_user();

-- Também prepara contas que já existiam antes desta migração.
insert into public.profiles(user_id, display_name, avatar_url)
select id, coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1)), raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (user_id) do nothing;

insert into public.plans(user_id)
select id from auth.users
on conflict (user_id) do nothing;
