-- MSK Security Center — schema central de integridade, sessões, bloqueios e auditoria.
-- Migração aditiva: não remove nem renomeia objetos existentes.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.security_builds (
  build_id text primary key,
  version text not null,
  manifest_hash text,
  build_fingerprint text,
  integrity_manifest jsonb not null default '{}'::jsonb,
  public_signing_key_id text,
  active boolean not null default true,
  minimum_supported_version text,
  blocked_at timestamptz,
  block_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_builds_has_proof check (manifest_hash is not null or build_fingerprint is not null)
);

create table if not exists public.security_installations (
  id uuid primary key default gen_random_uuid(),
  installation_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  license_id uuid references public.licenses(id) on delete set null,
  build_id text references public.security_builds(build_id) on delete set null,
  extension_id text,
  extension_version text,
  browser_name text,
  browser_version text,
  os_family text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_ip text,
  trust_status text not null default 'PENDING',
  integrity_status text not null default 'UNKNOWN',
  integrity_manifest_version text,
  last_integrity_check timestamptz,
  last_validation timestamptz,
  authorized_devices integer not null default 0,
  session_required boolean not null default false,
  blocked_at timestamptz,
  blocked_by uuid references auth.users(id) on delete set null,
  block_reason text,
  incident_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_installations_trust_status_check check (
    trust_status in ('PENDING','ACTIVE','SUSPICIOUS','TAMPERED','CLONED','REVOKED','BLOCKED','LICENSE_EXPIRED')
  ),
  constraint security_installations_integrity_status_check check (
    integrity_status in ('UNKNOWN','PENDING','VERIFIED','FAILED')
  )
);

create table if not exists public.security_integrity_events (
  id uuid primary key default gen_random_uuid(),
  installation_id text not null references public.security_installations(installation_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  license_id uuid references public.licenses(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  expected_build text,
  received_build text,
  affected_file text,
  expected_hash text,
  received_hash text,
  ip_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_integrity_events_severity_check check (severity in ('info','low','medium','high','critical'))
);

create table if not exists public.security_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  installation_id text not null references public.security_installations(installation_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  license_id uuid references public.licenses(id) on delete set null,
  build_id text references public.security_builds(build_id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  ip text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.security_blocks (
  id uuid primary key default gen_random_uuid(),
  installation_id text references public.security_installations(installation_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  license_id uuid references public.licenses(id) on delete set null,
  build_id text references public.security_builds(build_id) on delete set null,
  block_type text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  released_at timestamptz,
  released_by uuid references auth.users(id) on delete set null,
  constraint security_blocks_type_check check (block_type in ('INSTALLATION','LICENSE','USER','VERSION','BUILD'))
);

create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'system',
  actor_id uuid,
  installation_id text,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_audit_actor_check check (actor_type in ('system','admin','super_admin','extension','api'))
);

create table if not exists public.security_nonces (
  id uuid primary key default gen_random_uuid(),
  installation_id text not null,
  purpose text not null default 'handshake',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  used_at timestamptz,
  ip text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.security_installation_ips (
  id uuid primary key default gen_random_uuid(),
  installation_id text not null references public.security_installations(installation_id) on delete cascade,
  ip text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  country text,
  region text,
  metadata jsonb not null default '{}'::jsonb,
  unique (installation_id, ip)
);

create index if not exists security_installations_user_idx on public.security_installations(user_id);
create index if not exists security_installations_license_idx on public.security_installations(license_id);
create index if not exists security_installations_trust_idx on public.security_installations(trust_status, last_seen_at desc);
create index if not exists security_integrity_events_installation_idx on public.security_integrity_events(installation_id, created_at desc);
create index if not exists security_integrity_events_severity_idx on public.security_integrity_events(severity, created_at desc);
create index if not exists security_sessions_installation_idx on public.security_sessions(installation_id, expires_at desc);
create index if not exists security_sessions_active_idx on public.security_sessions(installation_id, revoked_at, expires_at);
create index if not exists security_blocks_installation_idx on public.security_blocks(installation_id, released_at, expires_at);
create index if not exists security_audit_installation_idx on public.security_audit_log(installation_id, created_at desc);
create index if not exists security_nonces_lookup_idx on public.security_nonces(installation_id, expires_at, used_at);

create or replace function public.security_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists security_builds_touch_updated_at on public.security_builds;
create trigger security_builds_touch_updated_at
before update on public.security_builds
for each row execute function public.security_touch_updated_at();

drop trigger if exists security_installations_touch_updated_at on public.security_installations;
create trigger security_installations_touch_updated_at
before update on public.security_installations
for each row execute function public.security_touch_updated_at();

-- Builds já conhecidos pelo gate atual. O fingerprint continua validado pelo gate legado;
-- só associamos aqui provas que já estavam explicitamente aprovadas no código existente.
insert into public.security_builds (build_id, version, manifest_hash, integrity_manifest, active)
values
  ('msk-agent-3.4.48-ad36dc98', '3.4.48', 'ad36dc984a7b88a776fc2ed0fc1ae47671a84cadc74cd7e6b15c3e1ca0da2403', '{"source":"legacy-integrity-gate"}'::jsonb, true),
  ('msk-agent-3.4.49-7ebc665b', '3.4.49', '7ebc665b750e8b7988f433e806819e45a9c7e47a3e378befa636f3d71305f2c2', '{"source":"legacy-integrity-gate"}'::jsonb, true),
  ('msk-agent-3.4.49-5a7f0926', '3.4.49', '5a7f0926ca36e3145dcba6e5c90777621fee1a228899376cd29d5c0992d1d559', '{"source":"legacy-integrity-gate"}'::jsonb, true),
  ('msk-agent-3.4.49-aed924f6', '3.4.49', 'aed924f67beb41470b6b23d85957f2978ede55a28096d63f4f33e3e671534bd7', '{"source":"legacy-integrity-gate"}'::jsonb, true)
on conflict (build_id) do nothing;

-- Backfill não destrutivo do inventário que já existe.
insert into public.security_installations (
  installation_id, user_id, license_id, extension_id, extension_version,
  browser_name, os_family, first_seen_at, last_seen_at, last_ip,
  trust_status, integrity_status, integrity_manifest_version,
  last_integrity_check, last_validation, authorized_devices, session_required,
  blocked_at, block_reason, incident_code, metadata
)
select
  ei.installation_id,
  ei.user_id,
  ei.license_id,
  ei.extension_id,
  ei.version,
  ei.browser,
  ei.os,
  coalesce(ei.created_at, ei.last_seen_at, now()),
  coalesce(ei.last_seen_at, now()),
  ei.ip_address,
  case
    when ei.blocked then 'BLOCKED'
    when l.status::text = 'revoked' then 'REVOKED'
    when l.expires_at is not null and l.expires_at <= now() then 'LICENSE_EXPIRED'
    when ei.suspicious then 'SUSPICIOUS'
    else 'ACTIVE'
  end,
  case
    when ei.integrity_required and ei.integrity_root is not null then 'VERIFIED'
    when ei.suspicious then 'FAILED'
    else 'UNKNOWN'
  end,
  ei.integrity_version,
  ei.integrity_updated_at,
  l.last_validation,
  coalesce((select count(*)::int from public.license_devices ld where ld.license_id = ei.license_id and ld.status::text = 'active'), 0),
  false,
  case when ei.blocked then coalesce(ei.last_activity_at, now()) else null end,
  ei.block_reason,
  case when ei.blocked then 'MSK_INSTALLATION_BLOCKED' when ei.suspicious then 'MSK_LEGACY_SUSPICIOUS' else null end,
  jsonb_build_object('source','extension_installations_backfill','legacy_metadata',coalesce(ei.metadata,'{}'::jsonb),'suspicion_reason',ei.suspicion_reason)
from public.extension_installations ei
left join public.licenses l on l.id = ei.license_id
where ei.installation_id is not null
on conflict (installation_id) do update set
  user_id = excluded.user_id,
  license_id = excluded.license_id,
  extension_id = coalesce(excluded.extension_id, public.security_installations.extension_id),
  extension_version = coalesce(excluded.extension_version, public.security_installations.extension_version),
  browser_name = coalesce(excluded.browser_name, public.security_installations.browser_name),
  os_family = coalesce(excluded.os_family, public.security_installations.os_family),
  last_seen_at = greatest(public.security_installations.last_seen_at, excluded.last_seen_at),
  last_ip = coalesce(excluded.last_ip, public.security_installations.last_ip),
  trust_status = case
    when public.security_installations.trust_status in ('TAMPERED','CLONED','REVOKED','BLOCKED') then public.security_installations.trust_status
    else excluded.trust_status
  end,
  block_reason = coalesce(excluded.block_reason, public.security_installations.block_reason),
  incident_code = coalesce(excluded.incident_code, public.security_installations.incident_code);

insert into public.security_installation_ips (installation_id, ip, first_seen_at, last_seen_at, metadata)
select installation_id, last_ip, first_seen_at, last_seen_at, '{"source":"backfill"}'::jsonb
from public.security_installations
where last_ip is not null and length(trim(last_ip)) > 0
on conflict (installation_id, ip) do update set last_seen_at = greatest(public.security_installation_ips.last_seen_at, excluded.last_seen_at);

insert into public.security_blocks (installation_id, user_id, license_id, block_type, reason, evidence, created_at)
select si.installation_id, si.user_id, si.license_id, 'INSTALLATION', coalesce(si.block_reason,'Bloqueio importado do controle existente.'),
       jsonb_build_object('source','extension_installations_backfill'), coalesce(si.blocked_at, now())
from public.security_installations si
where si.trust_status = 'BLOCKED'
  and not exists (
    select 1 from public.security_blocks sb
    where sb.installation_id = si.installation_id and sb.block_type = 'INSTALLATION' and sb.released_at is null
  );

-- RLS: leitura limitada ao dono quando útil; mutações críticas somente por RPC SECURITY DEFINER.
alter table public.security_builds enable row level security;
alter table public.security_installations enable row level security;
alter table public.security_integrity_events enable row level security;
alter table public.security_sessions enable row level security;
alter table public.security_blocks enable row level security;
alter table public.security_audit_log enable row level security;
alter table public.security_nonces enable row level security;
alter table public.security_installation_ips enable row level security;

revoke all on public.security_builds from anon, authenticated;
revoke all on public.security_installations from anon, authenticated;
revoke all on public.security_integrity_events from anon, authenticated;
revoke all on public.security_sessions from anon, authenticated;
revoke all on public.security_blocks from anon, authenticated;
revoke all on public.security_audit_log from anon, authenticated;
revoke all on public.security_nonces from anon, authenticated;
revoke all on public.security_installation_ips from anon, authenticated;

grant select on public.security_builds to authenticated;
grant select on public.security_installations to authenticated;
grant select on public.security_integrity_events to authenticated;
grant select on public.security_sessions to authenticated;
grant select on public.security_blocks to authenticated;
grant select on public.security_audit_log to authenticated;
grant select on public.security_installation_ips to authenticated;

drop policy if exists "security builds admin read" on public.security_builds;
create policy "security builds admin read" on public.security_builds for select to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "security installations own or admin read" on public.security_installations;
create policy "security installations own or admin read" on public.security_installations for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "security events own or admin read" on public.security_integrity_events;
create policy "security events own or admin read" on public.security_integrity_events for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "security sessions own or admin read" on public.security_sessions;
create policy "security sessions own or admin read" on public.security_sessions for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "security blocks admin read" on public.security_blocks;
create policy "security blocks admin read" on public.security_blocks for select to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "security audit admin read" on public.security_audit_log;
create policy "security audit admin read" on public.security_audit_log for select to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "security ips own or admin read" on public.security_installation_ips;
create policy "security ips own or admin read" on public.security_installation_ips for select to authenticated
using (
  public.is_admin(auth.uid()) or exists (
    select 1 from public.security_installations si
    where si.installation_id = security_installation_ips.installation_id and si.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
