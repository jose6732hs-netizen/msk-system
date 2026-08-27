create or replace function public.enforce_trial_license_15m()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_start timestamptz;
  fixed_expiry timestamptz;
begin
  if new.type = 'trial' then
    base_start := coalesce(
      case when tg_op = 'UPDATE' then old.starts_at else null end,
      new.starts_at,
      case when tg_op = 'UPDATE' then old.activated_at else null end,
      new.activated_at,
      now()
    );
    fixed_expiry := base_start + interval '15 minutes';

    if tg_op = 'UPDATE'
       and new.expires_at is not null
       and new.expires_at > fixed_expiry + interval '1 second' then
      raise exception 'trial_expiry_extension_not_allowed' using errcode = '23514';
    end if;

    new.starts_at := base_start;
    new.expires_at := fixed_expiry;
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'trial_duration_minutes', 15,
      'plan_duration_value_snapshot', 15,
      'plan_duration_unit_snapshot', 'minutes',
      'plan_duration_label_snapshot', '15 minutos'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_trial_license_15m on public.licenses;
create trigger trg_enforce_trial_license_15m
before insert or update on public.licenses
for each row
execute function public.enforce_trial_license_15m();

create or replace function public.enforce_trial_record_15m()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_start timestamptz;
begin
  base_start := coalesce(
    case when tg_op = 'UPDATE' then old.started_at else null end,
    new.started_at,
    now()
  );
  new.started_at := base_start;
  new.expires_at := base_start + interval '15 minutes';
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('trial_duration_minutes', 15);
  return new;
end;
$$;

drop trigger if exists trg_enforce_trial_record_15m on public.trials;
create trigger trg_enforce_trial_record_15m
before insert or update on public.trials
for each row
execute function public.enforce_trial_record_15m();

insert into public.plans (
  name, slug, description, price, currency, duration_label, duration_days,
  is_lifetime, auto_renew, max_devices, features, highlights, active, sort_order,
  duration_value, duration_unit, allow_trial, max_activations,
  allow_transfer, allow_reset
)
select
  'Teste grátis — 15 minutos',
  'free-test',
  'Teste gratuito da Extensão MSK por 15 minutos.',
  0,
  'BRL',
  '15 minutos',
  null,
  false,
  false,
  1,
  '{"projects":true,"download":true,"chrome_extension":true,"background_tools":true,"chat":true,"priority_support":false}'::jsonb,
  array['15 minutos grátis','1 dispositivo','Acesso à Extensão MSK']::text[],
  true,
  0,
  15,
  'minutes',
  true,
  1,
  false,
  false
where not exists (select 1 from public.plans where slug = 'free-test');

update public.plans
set
  name = 'Teste grátis — 15 minutos',
  description = 'Teste gratuito da Extensão MSK por 15 minutos.',
  price = 0,
  currency = 'BRL',
  duration_label = '15 minutos',
  duration_days = null,
  is_lifetime = false,
  auto_renew = false,
  max_devices = 1,
  features = '{"projects":true,"download":true,"chrome_extension":true,"background_tools":true,"chat":true,"priority_support":false}'::jsonb,
  highlights = array['15 minutos grátis','1 dispositivo','Acesso à Extensão MSK']::text[],
  active = true,
  sort_order = 0,
  duration_value = 15,
  duration_unit = 'minutes',
  allow_trial = true,
  max_activations = 1,
  allow_transfer = false,
  allow_reset = false,
  updated_at = now()
where slug = 'free-test';

update public.extension_channels
set
  api_base_url = 'https://msksystem.online/api/public',
  updated_at = now();