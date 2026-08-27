create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null unique,
  subject text not null,
  new_whatsapp text not null,
  from_email text,
  status text not null default 'draft' check (status in ('draft','sending','completed','partial','failed')),
  target_count integer not null default 0 check (target_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error text,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists email_campaigns_created_at_idx on public.email_campaigns(created_at desc);
create index if not exists email_campaign_recipients_campaign_status_idx on public.email_campaign_recipients(campaign_id, status);

alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

revoke all on table public.email_campaigns from anon, authenticated;
revoke all on table public.email_campaign_recipients from anon, authenticated;
grant select, insert, update, delete on table public.email_campaigns to service_role;
grant select, insert, update, delete on table public.email_campaign_recipients to service_role;
