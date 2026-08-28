alter table public.email_campaigns
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists audience text not null default 'all',
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete set null;

alter table public.email_campaigns alter column new_whatsapp set default '';

grant select, insert, update, delete on table public.email_campaigns to service_role;
grant select, insert, update, delete on table public.email_campaign_recipients to service_role;

alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

notify pgrst, 'reload schema';
