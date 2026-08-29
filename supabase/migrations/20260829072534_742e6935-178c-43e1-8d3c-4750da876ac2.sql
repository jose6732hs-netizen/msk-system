alter table public.extension_installations
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists last_url text;

alter table public.extension_events
  add column if not exists ip_address text;

alter table public.extension_errors
  add column if not exists ip_address text;

alter table public.extension_remote_commands
  drop constraint if exists extension_remote_commands_type_check;

alter table public.extension_remote_commands
  add constraint extension_remote_commands_type_check
  check (command_type in ('message','block','unblock','refresh','update_notice','revalidate_license','clear_cache','diagnostic'));

create table if not exists public.extension_replies (
  id uuid primary key default gen_random_uuid(),
  command_id uuid references public.extension_remote_commands(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null,
  kind text not null default 'reply',
  body text,
  payload jsonb not null default '{}'::jsonb,
  ip_address text,
  extension_version text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint extension_replies_kind_check check (kind in ('reply','diagnostic')),
  constraint extension_replies_body_len check (body is null or char_length(body) <= 2000),
  constraint extension_replies_payload_size check (octet_length(payload::text) <= 20000)
);

create index if not exists extension_replies_user_idx on public.extension_replies(user_id, created_at desc);
create index if not exists extension_replies_command_idx on public.extension_replies(command_id);
create index if not exists extension_replies_unread_idx on public.extension_replies(read_at, created_at desc);

grant select, insert, update, delete on public.extension_replies to authenticated;
grant all on public.extension_replies to service_role;

alter table public.extension_replies enable row level security;

drop policy if exists extension_replies_admin_all on public.extension_replies;
create policy extension_replies_admin_all
  on public.extension_replies
  for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'extension_replies'
  ) then
    alter publication supabase_realtime add table public.extension_replies;
  end if;
end $$;