-- MSK Agente: trial próprio para não reutilizar planos/ofertas da extensão antiga.
insert into public.plans (
  slug,
  name,
  description,
  price,
  currency,
  duration_days,
  duration_label,
  duration_unit,
  duration_value,
  is_lifetime,
  auto_renew,
  max_devices,
  features,
  active,
  sort_order,
  allow_trial
)
values (
  'msk-agent-free-test',
  'MSK Agente — Teste grátis',
  'Teste gratuito do MSK Agente por 15 minutos.',
  0,
  'BRL',
  null,
  '15 minutos',
  'minutes',
  15,
  false,
  false,
  1,
  jsonb_build_object(
    'agent', true,
    'msk_agent', true,
    'chrome_extension', true,
    'chat', true,
    'projects', true,
    'download', true,
    'background_tools', true,
    'product_type', 'agent',
    'product_label', 'MSK Agente',
    'license_role', 'agent',
    'priority_support', false
  ),
  true,
  0,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  duration_label = excluded.duration_label,
  duration_unit = excluded.duration_unit,
  duration_value = excluded.duration_value,
  is_lifetime = excluded.is_lifetime,
  auto_renew = excluded.auto_renew,
  max_devices = excluded.max_devices,
  features = excluded.features,
  active = excluded.active,
  allow_trial = excluded.allow_trial;

-- Corrige apenas trials historicamente marcados como MSK Agente que ficaram
-- associados a um plano legado (ex.: Diário). Não reinicia nem estende o tempo.
with agent_plan as (
  select id, features
  from public.plans
  where slug = 'msk-agent-free-test'
  limit 1
)
update public.licenses as l
set
  plan_id = agent_plan.id,
  metadata = coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
    'license_role', 'agent',
    'plan_name_snapshot', 'MSK Agente — Teste grátis',
    'plan_slug_snapshot', 'msk-agent-free-test',
    'plan_price_snapshot', 0,
    'plan_list_price_snapshot', 0,
    'plan_currency_snapshot', 'BRL',
    'plan_duration_label_snapshot', '15 minutos',
    'plan_duration_value_snapshot', 15,
    'plan_duration_unit_snapshot', 'minutes',
    'plan_is_lifetime_snapshot', false,
    'plan_max_devices_snapshot', 1,
    'features_snapshot', agent_plan.features,
    'item_label', 'MSK Agente — Teste grátis',
    'pending_duration_ms', 900000,
    'trial_duration_minutes', 15
  )
from agent_plan
where l.type in ('trial', 'test')
  and l.metadata ->> 'source' = 'msk_agent'
  and l.metadata ->> 'purpose' = 'assistant_virtual_test';
