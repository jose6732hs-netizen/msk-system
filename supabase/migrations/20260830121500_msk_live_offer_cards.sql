-- MSK LIVE: quatro cards comerciais prontos para o admin definir preço e publicar.
-- Mantém preços/estado já editados em ofertas existentes; novos cards nascem com preço 0 e inativos.

INSERT INTO public.products (
  name,
  slug,
  description,
  active,
  sort_order
)
VALUES (
  'MSK LIVE',
  'msk-live',
  'Produto MSK para TikTok Live.',
  true,
  30
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO public.plans AS current_plan (
  slug,
  name,
  description,
  price,
  currency,
  duration_label,
  duration_days,
  duration_value,
  duration_unit,
  is_lifetime,
  auto_renew,
  max_devices,
  features,
  highlights,
  active,
  sort_order
)
VALUES
  (
    'msk-live-oferta-1',
    'MSK LIVE · 1 Semana',
    'Acesso ao MSK LIVE por 1 semana em 1 dispositivo.',
    0,
    'BRL',
    '1 semana',
    7,
    1,
    'weeks',
    false,
    false,
    1,
    '{"product_type":"live","live":true,"period":"1_week","device_limit":1}'::jsonb,
    ARRAY['1 semana', '1 dispositivo', 'MSK LIVE'],
    false,
    301
  ),
  (
    'msk-live-oferta-2',
    'MSK LIVE · 1 Mês',
    'Acesso ao MSK LIVE por 1 mês em 1 dispositivo.',
    0,
    'BRL',
    '1 mês',
    30,
    1,
    'months',
    false,
    false,
    1,
    '{"product_type":"live","live":true,"period":"1_month","device_limit":1}'::jsonb,
    ARRAY['1 mês', '1 dispositivo', 'MSK LIVE'],
    false,
    302
  ),
  (
    'msk-live-oferta-3',
    'MSK LIVE · 2 Meses',
    'Acesso ao MSK LIVE por 2 meses em até 2 dispositivos.',
    0,
    'BRL',
    '2 meses',
    60,
    2,
    'months',
    false,
    false,
    2,
    '{"product_type":"live","live":true,"period":"2_months","device_limit":2}'::jsonb,
    ARRAY['2 meses', '2 dispositivos', 'MSK LIVE'],
    false,
    303
  ),
  (
    'msk-live-oferta-4',
    'MSK LIVE · 3 Meses',
    'Acesso ao MSK LIVE por 3 meses em até 4 dispositivos.',
    0,
    'BRL',
    '3 meses',
    90,
    3,
    'months',
    false,
    false,
    4,
    '{"product_type":"live","live":true,"period":"3_months","device_limit":4}'::jsonb,
    ARRAY['3 meses', '4 dispositivos', 'MSK LIVE'],
    false,
    304
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  currency = EXCLUDED.currency,
  duration_label = EXCLUDED.duration_label,
  duration_days = EXCLUDED.duration_days,
  duration_value = EXCLUDED.duration_value,
  duration_unit = EXCLUDED.duration_unit,
  is_lifetime = EXCLUDED.is_lifetime,
  auto_renew = EXCLUDED.auto_renew,
  max_devices = EXCLUDED.max_devices,
  features = COALESCE(current_plan.features, '{}'::jsonb) || EXCLUDED.features,
  highlights = EXCLUDED.highlights,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.offers AS current_offer (
  product_id,
  plan_id,
  name,
  slug,
  price,
  currency,
  recurring,
  periodicity,
  periodicity_type,
  active,
  sort_order
)
SELECT
  product.id,
  plan.id,
  plan.name,
  plan.slug,
  0,
  'BRL',
  false,
  CASE plan.slug
    WHEN 'msk-live-oferta-1' THEN 7
    WHEN 'msk-live-oferta-2' THEN 30
    WHEN 'msk-live-oferta-3' THEN 60
    WHEN 'msk-live-oferta-4' THEN 90
    ELSE 30
  END,
  'DAYS',
  false,
  plan.sort_order
FROM public.products AS product
JOIN public.plans AS plan
  ON plan.slug IN (
    'msk-live-oferta-1',
    'msk-live-oferta-2',
    'msk-live-oferta-3',
    'msk-live-oferta-4'
  )
WHERE product.slug = 'msk-live'
ON CONFLICT (slug) DO UPDATE
SET
  product_id = EXCLUDED.product_id,
  plan_id = EXCLUDED.plan_id,
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  recurring = EXCLUDED.recurring,
  periodicity = EXCLUDED.periodicity,
  periodicity_type = EXCLUDED.periodicity_type,
  sort_order = EXCLUDED.sort_order;

-- Garante o vínculo de qualquer licença desses planos ao produto MSK LIVE.
UPDATE public.licenses AS license
SET product_id = product.id
FROM public.products AS product
JOIN public.offers AS offer
  ON offer.product_id = product.id
WHERE product.slug = 'msk-live'
  AND offer.plan_id = license.plan_id
  AND offer.slug IN (
    'msk-live-oferta-1',
    'msk-live-oferta-2',
    'msk-live-oferta-3',
    'msk-live-oferta-4'
  )
  AND license.product_id IS DISTINCT FROM product.id;
