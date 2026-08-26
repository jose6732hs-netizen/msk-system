begin;

-- O teste gratuito é um produto próprio e não pode herdar a duração de planos pagos.
update public.plans
set
  active = true,
  price = 0,
  allow_trial = true,
  is_lifetime = false,
  max_devices = 1,
  duration_label = '15 minutos',
  duration_days = null,
  duration_value = 15,
  duration_unit = 'minutes'
where slug = 'free-test';

-- Mantém as demais regras atuais de trial e fixa somente a duração em 15 minutos.
insert into public.app_settings (key, value, updated_at)
values (
  'trial',
  '{"duration_minutes":15,"cooldown_hours":24,"max_per_user":1}'::jsonb,
  now()
)
on conflict (key) do update
set
  value = coalesce(public.app_settings.value, '{}'::jsonb) || '{"duration_minutes":15}'::jsonb,
  updated_at = now();

create or replace function public.enforce_trial_15_minutes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_plan_id uuid;
begin
  if lower(coalesce(new.type, '')) in ('trial', 'test') then
    select id
      into v_test_plan_id
    from public.plans
    where slug = 'free-test'
    order by created_at asc
    limit 1;

    if v_test_plan_id is not null then
      new.plan_id := v_test_plan_id;
    end if;

    new.max_devices := 1;
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'pending_duration_ms', 900000,
      'plan_duration_label_snapshot', '15 minutos',
      'plan_duration_value_snapshot', 15,
      'plan_duration_unit_snapshot', 'minutes',
      'plan_duration_snapshot', null,
      'plan_is_lifetime_snapshot', false,
      'plan_max_devices_snapshot', 1,
      'plan_slug_snapshot', 'free-test',
      'plan_name_snapshot', 'LICENÇA FREE — TESTE',
      'plan_price_snapshot', 0,
      'plan_list_price_snapshot', 0,
      'item_unit_price', 0
    );

    -- O cronômetro começa somente na primeira ativação válida.
    if new.activated_at is null then
      new.expires_at := null;
      if new.status::text = 'active' then
        new.status := 'inactive';
      end if;
    else
      new.expires_at := new.activated_at + interval '15 minutes';
      if new.expires_at <= now() and new.status::text in ('active', 'inactive') then
        new.status := 'expired';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_trial_15_minutes on public.licenses;
create trigger trg_enforce_trial_15_minutes
before insert or update on public.licenses
for each row
execute function public.enforce_trial_15_minutes();

-- Mantém a tabela auxiliar de trials alinhada com a janela real da licença.
create or replace function public.sync_trial_window_from_license()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.type, '')) in ('trial', 'test') then
    update public.trials
    set
      started_at = coalesce(new.activated_at, started_at),
      expires_at = coalesce(new.expires_at, expires_at),
      used = new.activated_at is not null,
      status = case
        when new.status::text = 'expired' then 'expired'
        when new.status::text = 'active' then 'running'
        else 'pending'
      end,
      updated_at = now()
    where license_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_trial_window_from_license on public.licenses;
create trigger trg_sync_trial_window_from_license
after update of status, activated_at, expires_at on public.licenses
for each row
execute function public.sync_trial_window_from_license();

-- Corrige os trials existentes que foram associados ao plano diário por fluxo legado.
-- O trigger acima recalcula expires_at a partir de activated_at + 15 minutos.
update public.licenses
set
  plan_id = (select id from public.plans where slug = 'free-test' order by created_at asc limit 1),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'pending_duration_ms', 900000,
    'plan_duration_label_snapshot', '15 minutos',
    'plan_duration_value_snapshot', 15,
    'plan_duration_unit_snapshot', 'minutes',
    'plan_duration_snapshot', null,
    'plan_is_lifetime_snapshot', false,
    'plan_max_devices_snapshot', 1,
    'plan_slug_snapshot', 'free-test',
    'plan_name_snapshot', 'LICENÇA FREE — TESTE',
    'plan_price_snapshot', 0,
    'plan_list_price_snapshot', 0,
    'item_unit_price', 0,
    'trial_15m_enforced_at', now()
  )
where lower(coalesce(type, '')) in ('trial', 'test');

-- Sincroniza imediatamente a tabela auxiliar após o backfill.
update public.trials t
set
  started_at = coalesce(l.activated_at, t.started_at),
  expires_at = coalesce(l.expires_at, t.expires_at),
  used = l.activated_at is not null,
  status = case
    when l.status::text = 'expired' then 'expired'
    when l.status::text = 'active' then 'running'
    else 'pending'
  end,
  updated_at = now()
from public.licenses l
where l.id = t.license_id
  and lower(coalesce(l.type, '')) in ('trial', 'test');

commit;
