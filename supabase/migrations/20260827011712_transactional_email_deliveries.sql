create table if not exists public.transactional_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  subject text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  provider_message_id text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists transactional_email_deliveries_user_kind_idx
  on public.transactional_email_deliveries(user_id, kind, created_at desc);

alter table public.transactional_email_deliveries enable row level security;
revoke all on table public.transactional_email_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.transactional_email_deliveries to service_role;
