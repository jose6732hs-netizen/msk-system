-- Central de observabilidade do MSK Agente.
-- Migration já aplicada em produção sob a mesma versão 20260827182828.

create table if not exists public.extension_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null unique,
  license_id uuid references public.licenses(id) on delete set null,
  version text not null,
  browser text,
  os text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint extension_installations_installation_id_chk check (char_length(installation_id) between 16 and 80 and installation_id ~ '^[A-Za-z0-9_-]+$'),
  constraint extension_installations_version_chk check (char_length(version) between 1 and 64),
  constraint extension_installations_browser_chk check (browser is null or char_length(browser) <= 120),
  constraint extension_installations_os_chk check (os is null or char_length(os) <= 120),
  constraint extension_installations_metadata_chk check (octet_length(metadata::text) <= 16384)
);

create table if not exists public.extension_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null references public.extension_installations(installation_id) on delete cascade,
  lovable_project_id text,
  project_name text,
  repository text,
  github_status text not null default 'unknown',
  branch text,
  provider text,
  workspace_url text,
  preview_url text,
  publish_status text not null default 'draft',
  last_activity_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_commit_sha text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extension_projects_provider_chk check (provider is null or provider in ('chatgpt','grok','blackbox','gemini','lovable','github','other')),
  constraint extension_projects_github_status_chk check (github_status in ('unknown','connected','disconnected','connecting','error')),
  constraint extension_projects_publish_status_chk check (publish_status in ('draft','published','unknown')),
  constraint extension_projects_repo_chk check (repository is null or (char_length(repository) <= 300 and repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')),
  constraint extension_projects_name_chk check (project_name is null or char_length(project_name) <= 180),
  constraint extension_projects_branch_chk check (branch is null or char_length(branch) <= 180),
  constraint extension_projects_urls_chk check ((workspace_url is null or char_length(workspace_url) <= 1000) and (preview_url is null or char_length(preview_url) <= 1000)),
  constraint extension_projects_commit_chk check (last_commit_sha is null or char_length(last_commit_sha) <= 80)
);
create unique index if not exists extension_projects_identity_uq on public.extension_projects(user_id, installation_id, lovable_project_id) where lovable_project_id is not null;

create table if not exists public.extension_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null references public.extension_installations(installation_id) on delete cascade,
  extension_version text not null,
  project_id text,
  repository text,
  provider text,
  action text not null,
  status text not null default 'success',
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint extension_events_provider_chk check (provider is null or provider in ('chatgpt','grok','blackbox','gemini','lovable','github','other')),
  constraint extension_events_status_chk check (status in ('started','success','failed','cancelled','pending','info')),
  constraint extension_events_duration_chk check (duration_ms is null or duration_ms between 0 and 3600000),
  constraint extension_events_action_chk check (char_length(action) between 2 and 80 and action ~ '^[a-z0-9_]+$'),
  constraint extension_events_project_chk check (project_id is null or char_length(project_id) <= 180),
  constraint extension_events_repo_chk check (repository is null or (char_length(repository) <= 300 and repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')),
  constraint extension_events_version_chk check (char_length(extension_version) between 1 and 64),
  constraint extension_events_metadata_chk check (octet_length(metadata::text) <= 16384)
);

create table if not exists public.extension_errors (
  id uuid primary key default gen_random_uuid(),
  error_id uuid not null unique default gen_random_uuid(),
  error_code text not null,
  severity text not null default 'error',
  title text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null references public.extension_installations(installation_id) on delete cascade,
  project_id text,
  repository text,
  provider text,
  extension_version text not null,
  browser text,
  action text,
  user_message text not null,
  technical_message text,
  stack_summary text,
  metadata jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint extension_errors_code_chk check (char_length(error_code) between 2 and 100 and error_code ~ '^[A-Z0-9_]+$'),
  constraint extension_errors_severity_chk check (severity in ('info','warning','error','critical')),
  constraint extension_errors_provider_chk check (provider is null or provider in ('chatgpt','grok','blackbox','gemini','lovable','github','other')),
  constraint extension_errors_repo_chk check (repository is null or (char_length(repository) <= 300 and repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')),
  constraint extension_errors_message_chk check (char_length(user_message) <= 800 and (technical_message is null or char_length(technical_message) <= 8000) and (stack_summary is null or char_length(stack_summary) <= 8000)),
  constraint extension_errors_metadata_chk check (octet_length(metadata::text) <= 16384)
);

create table if not exists public.extension_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  title text not null,
  changelog text not null default '',
  download_url text,
  mandatory boolean not null default false,
  minimum_version text,
  status text not null default 'draft',
  released_at timestamptz,
  build_id uuid references public.extension_builds(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extension_releases_version_chk check (version ~ '^[0-9]+(\.[0-9]+){1,3}([+-][A-Za-z0-9.-]+)?$'),
  constraint extension_releases_min_version_chk check (minimum_version is null or minimum_version ~ '^[0-9]+(\.[0-9]+){1,3}([+-][A-Za-z0-9.-]+)?$'),
  constraint extension_releases_status_chk check (status in ('draft','testing','released','deprecated')),
  constraint extension_releases_title_chk check (char_length(title) between 1 and 180),
  constraint extension_releases_changelog_chk check (char_length(changelog) <= 20000),
  constraint extension_releases_url_chk check (download_url is null or char_length(download_url) <= 1200)
);

create table if not exists public.extension_error_catalog (
  error_code text primary key,
  severity text not null default 'error',
  title text not null,
  user_message text not null,
  recovery_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extension_error_catalog_severity_chk check (severity in ('info','warning','error','critical')),
  constraint extension_error_catalog_code_chk check (error_code ~ '^[A-Z0-9_]+$')
);

create table if not exists public.extension_incidents (
  id uuid primary key default gen_random_uuid(),
  error_code text not null,
  status text not null default 'open',
  severity text not null default 'error',
  affected_users integer not null default 0,
  affected_installations integer not null default 0,
  dominant_version text,
  dominant_browser text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extension_incidents_status_chk check (status in ('open','monitoring','resolved')),
  constraint extension_incidents_severity_chk check (severity in ('info','warning','error','critical')),
  constraint extension_incidents_metadata_chk check (octet_length(metadata::text) <= 16384)
);
create unique index if not exists extension_incidents_open_code_uq on public.extension_incidents(error_code) where status in ('open','monitoring');

create table if not exists public.extension_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  severity text not null default 'warning',
  title text not null,
  message text not null,
  incident_id uuid references public.extension_incidents(id) on delete set null,
  acknowledged boolean not null default false,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint extension_alerts_severity_chk check (severity in ('info','warning','error','critical')),
  constraint extension_alerts_type_chk check (char_length(alert_type) between 2 and 80 and alert_type ~ '^[a-z0-9_]+$'),
  constraint extension_alerts_metadata_chk check (octet_length(metadata::text) <= 16384)
);

create table if not exists public.extension_daily_metrics (
  day date not null,
  extension_version text not null default 'unknown',
  provider text not null default 'none',
  browser text not null default 'unknown',
  events_count bigint not null default 0,
  success_count bigint not null default 0,
  error_count bigint not null default 0,
  unique_users bigint not null default 0,
  unique_installations bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(day, extension_version, provider, browser)
);

create index if not exists extension_installations_user_seen_idx on public.extension_installations(user_id,last_seen_at desc);
create index if not exists extension_installations_version_idx on public.extension_installations(version,last_seen_at desc);
create index if not exists extension_projects_user_activity_idx on public.extension_projects(user_id,last_activity_at desc);
create index if not exists extension_projects_repo_idx on public.extension_projects(repository) where repository is not null;
create index if not exists extension_events_created_idx on public.extension_events(created_at desc);
create index if not exists extension_events_user_created_idx on public.extension_events(user_id,created_at desc);
create index if not exists extension_events_action_status_idx on public.extension_events(action,status,created_at desc);
create index if not exists extension_events_provider_idx on public.extension_events(provider,created_at desc) where provider is not null;
create index if not exists extension_events_version_idx on public.extension_events(extension_version,created_at desc);
create index if not exists extension_errors_created_idx on public.extension_errors(created_at desc);
create index if not exists extension_errors_code_idx on public.extension_errors(error_code,created_at desc);
create index if not exists extension_errors_unresolved_idx on public.extension_errors(severity,created_at desc) where resolved=false;
create index if not exists extension_errors_user_idx on public.extension_errors(user_id,created_at desc);
create index if not exists extension_releases_status_idx on public.extension_releases(status,released_at desc);

alter table public.extension_installations enable row level security;
alter table public.extension_projects enable row level security;
alter table public.extension_events enable row level security;
alter table public.extension_errors enable row level security;
alter table public.extension_releases enable row level security;
alter table public.extension_error_catalog enable row level security;
alter table public.extension_incidents enable row level security;
alter table public.extension_alerts enable row level security;
alter table public.extension_daily_metrics enable row level security;

create policy "extension_installations_select_own_or_admin" on public.extension_installations for select to authenticated using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "extension_installations_insert_own" on public.extension_installations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "extension_installations_update_own_or_admin" on public.extension_installations for update to authenticated using ((select auth.uid()) = user_id or public.is_admin((select auth.uid()))) with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "extension_projects_select_own_or_admin" on public.extension_projects for select to authenticated using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "extension_projects_insert_own" on public.extension_projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "extension_projects_update_own_or_admin" on public.extension_projects for update to authenticated using ((select auth.uid()) = user_id or public.is_admin((select auth.uid()))) with check ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "extension_events_select_own_or_admin" on public.extension_events for select to authenticated using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "extension_events_insert_own" on public.extension_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "extension_errors_select_own_or_admin" on public.extension_errors for select to authenticated using ((select auth.uid()) = user_id or public.is_admin((select auth.uid())));
create policy "extension_errors_insert_own" on public.extension_errors for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "extension_errors_admin_update" on public.extension_errors for update to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "extension_releases_authenticated_read" on public.extension_releases for select to authenticated using (true);
create policy "extension_releases_admin_insert" on public.extension_releases for insert to authenticated with check (public.is_admin((select auth.uid())));
create policy "extension_releases_admin_update" on public.extension_releases for update to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "extension_releases_admin_delete" on public.extension_releases for delete to authenticated using (public.is_admin((select auth.uid())));
create policy "extension_error_catalog_authenticated_read" on public.extension_error_catalog for select to authenticated using (true);
create policy "extension_error_catalog_admin_write" on public.extension_error_catalog for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "extension_incidents_admin_only" on public.extension_incidents for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "extension_alerts_admin_only" on public.extension_alerts for all to authenticated using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "extension_daily_metrics_admin_only" on public.extension_daily_metrics for select to authenticated using (public.is_admin((select auth.uid())));

revoke all on public.extension_installations, public.extension_projects, public.extension_events, public.extension_errors, public.extension_releases, public.extension_error_catalog, public.extension_incidents, public.extension_alerts, public.extension_daily_metrics from anon;
grant select,insert,update on public.extension_installations, public.extension_projects to authenticated;
grant select,insert on public.extension_events to authenticated;
grant select,insert,update on public.extension_errors to authenticated;
grant select,insert,update,delete on public.extension_releases, public.extension_error_catalog, public.extension_incidents, public.extension_alerts to authenticated;
grant select on public.extension_daily_metrics to authenticated;
grant all on public.extension_installations, public.extension_projects, public.extension_events, public.extension_errors, public.extension_releases, public.extension_error_catalog, public.extension_incidents, public.extension_alerts, public.extension_daily_metrics to service_role;

insert into public.extension_error_catalog(error_code,severity,title,user_message,recovery_action) values
('GITHUB_WRITE_PERMISSION_DENIED','error','Permissão do GitHub insuficiente','Não consegui editar este projeto no GitHub. Reconecte sua conta e tente novamente.','reconnect_github'),
('AI_BRIDGE_TIMEOUT','warning','IA demorou para responder','A IA demorou mais que o esperado para responder. Tente novamente em alguns segundos.','retry'),
('GROK_BRIDGE_TIMEOUT','warning','Grok demorou para responder','O Grok demorou mais que o esperado para responder. Tente novamente em alguns segundos.','retry'),
('CHATGPT_BRIDGE_TIMEOUT','warning','ChatGPT demorou para responder','O ChatGPT demorou mais que o esperado para responder. Tente novamente em alguns segundos.','retry'),
('BLACKBOX_BRIDGE_TIMEOUT','warning','BLACKBOX demorou para responder','A BLACKBOX demorou mais que o esperado para responder. Tente novamente em alguns segundos.','retry'),
('LOVABLE_SYNC_FAILED','error','Sincronização não concluída','Não consegui sincronizar o projeto agora. Tente novamente.','retry'),
('PREVIEW_CONFIRMATION_FAILED','warning','Preview não confirmado','A alteração foi aplicada, mas não consegui confirmar o preview. Atualize o projeto e tente novamente.','retry'),
('LICENSE_EXPIRED','warning','Licença expirada','Sua licença expirou. Insira uma nova licença para continuar.','open_license')
on conflict (error_code) do nothing;

create or replace function public.extension_prune_telemetry()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_events bigint := 0;
  deleted_errors bigint := 0;
begin
  with grouped as (
    select created_at::date as day,
           extension_version,
           coalesce(provider,'none') as provider,
           coalesce(nullif(metadata->>'browser',''),'unknown') as browser,
           count(*) as events_count,
           count(*) filter (where status='success') as success_count,
           count(*) filter (where status='failed') as error_count,
           count(distinct user_id) as unique_users,
           count(distinct installation_id) as unique_installations
    from public.extension_events
    where created_at < now() - interval '90 days'
    group by 1,2,3,4
  )
  insert into public.extension_daily_metrics(day,extension_version,provider,browser,events_count,success_count,error_count,unique_users,unique_installations,updated_at)
  select day,extension_version,provider,browser,events_count,success_count,error_count,unique_users,unique_installations,now() from grouped
  on conflict(day,extension_version,provider,browser) do update set
    events_count=excluded.events_count,
    success_count=excluded.success_count,
    error_count=excluded.error_count,
    unique_users=excluded.unique_users,
    unique_installations=excluded.unique_installations,
    updated_at=now();

  delete from public.extension_events where created_at < now() - interval '90 days';
  get diagnostics deleted_events = row_count;
  delete from public.extension_errors where created_at < now() - interval '180 days' and severity <> 'critical';
  get diagnostics deleted_errors = row_count;
  return jsonb_build_object('deleted_events',deleted_events,'deleted_errors',deleted_errors);
end;
$$;
revoke all on function public.extension_prune_telemetry() from public, anon, authenticated;
grant execute on function public.extension_prune_telemetry() to service_role;
