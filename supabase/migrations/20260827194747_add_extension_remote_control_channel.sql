create table if not exists public.extension_remote_controls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id text null,
  blocked boolean not null default false,
  block_reason text null,
  block_message text null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extension_remote_controls_installation_len check (installation_id is null or char_length(installation_id) between 16 and 80),
  constraint extension_remote_controls_reason_len check (block_reason is null or char_length(block_reason) <= 300),
  constraint extension_remote_controls_message_len check (block_message is null or char_length(block_message) <= 1000)
);

create unique index if not exists extension_remote_controls_user_global_uidx
  on public.extension_remote_controls(user_id)
  where installation_id is null;
create unique index if not exists extension_remote_controls_user_installation_uidx
  on public.extension_remote_controls(user_id, installation_id)
  where installation_id is not null;
create index if not exists extension_remote_controls_blocked_idx
  on public.extension_remote_controls(blocked, updated_at desc);

create table if not exists public.extension_remote_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id text null,
  command_type text not null,
  title text null,
  message text null,
  severity text not null default 'info',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  delivered_at timestamptz null,
  acknowledged_at timestamptz null,
  last_delivery_at timestamptz null,
  delivery_count integer not null default 0,
  constraint extension_remote_commands_installation_len check (installation_id is null or char_length(installation_id) between 16 and 80),
  constraint extension_remote_commands_type_check check (command_type in ('message','block','unblock','refresh','update_notice')),
  constraint extension_remote_commands_severity_check check (severity in ('info','success','warning','critical')),
  constraint extension_remote_commands_status_check check (status in ('pending','delivered','acknowledged','cancelled')),
  constraint extension_remote_commands_title_len check (title is null or char_length(title) <= 180),
  constraint extension_remote_commands_message_len check (message is null or char_length(message) <= 2000),
  constraint extension_remote_commands_payload_size check (octet_length(payload::text) <= 12000),
  constraint extension_remote_commands_delivery_count check (delivery_count between 0 and 1000),
  constraint extension_remote_commands_expiry check (expires_at > created_at)
);

create index if not exists extension_remote_commands_target_pending_idx
  on public.extension_remote_commands(user_id, status, created_at desc);
create index if not exists extension_remote_commands_installation_idx
  on public.extension_remote_commands(installation_id, status, created_at desc);
create index if not exists extension_remote_commands_expiry_idx
  on public.extension_remote_commands(expires_at);

alter table public.extension_remote_controls enable row level security;
alter table public.extension_remote_commands enable row level security;

drop policy if exists extension_remote_controls_admin_all on public.extension_remote_controls;
create policy extension_remote_controls_admin_all
  on public.extension_remote_controls
  for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

drop policy if exists extension_remote_commands_admin_all on public.extension_remote_commands;
create policy extension_remote_commands_admin_all
  on public.extension_remote_commands
  for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'extension_remote_controls'
  ) then
    alter publication supabase_realtime add table public.extension_remote_controls;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'extension_remote_commands'
  ) then
    alter publication supabase_realtime add table public.extension_remote_commands;
  end if;
end $$;