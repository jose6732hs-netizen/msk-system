-- MSK LIVE: produto independente, três ofertas e isolamento rígido de licenças.

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
    'MSK LIVE · Oferta 1',
    'Oferta 1 do MSK LIVE. Configure preço e validade antes de ativar.',
    0,
    'BRL',
    '30 dias',
    30,
    30,
    'days',
    false,
    false,
    1,
    '{"product_type":"live","live":true}'::jsonb,
    ARRAY['MSK LIVE'],
    false,
    301
  ),
  (
    'msk-live-oferta-2',
    'MSK LIVE · Oferta 2',
    'Oferta 2 do MSK LIVE. Configure preço e validade antes de ativar.',
    0,
    'BRL',
    '30 dias',
    30,
    30,
    'days',
    false,
    false,
    1,
    '{"product_type":"live","live":true}'::jsonb,
    ARRAY['MSK LIVE'],
    false,
    302
  ),
  (
    'msk-live-oferta-3',
    'MSK LIVE · Oferta 3',
    'Oferta 3 do MSK LIVE. Configure preço e validade antes de ativar.',
    0,
    'BRL',
    '30 dias',
    30,
    30,
    'days',
    false,
    false,
    1,
    '{"product_type":"live","live":true}'::jsonb,
    ARRAY['MSK LIVE'],
    false,
    303
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  currency = EXCLUDED.currency,
  features = COALESCE(current_plan.features, '{}'::jsonb) || EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.offers (
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
  30,
  'DAYS',
  false,
  plan.sort_order
FROM public.products AS product
JOIN public.plans AS plan
  ON plan.slug IN ('msk-live-oferta-1', 'msk-live-oferta-2', 'msk-live-oferta-3')
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

-- Se os slugs já existiam antes desta migração, corrige apenas o vínculo das
-- licenças desses planos para o produto MSK LIVE.
UPDATE public.licenses AS license
SET product_id = product.id
FROM public.products AS product
WHERE product.slug = 'msk-live'
  AND license.plan_id IN (
    SELECT offer.plan_id
    FROM public.offers AS offer
    WHERE offer.product_id = product.id
      AND offer.plan_id IS NOT NULL
  )
  AND license.product_id IS DISTINCT FROM product.id;

CREATE OR REPLACE FUNCTION public.enforce_msk_live_license_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  live_product_id UUID;
  is_live_plan BOOLEAN;
BEGIN
  SELECT id
  INTO live_product_id
  FROM public.products
  WHERE slug = 'msk-live'
  LIMIT 1;

  IF live_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.offers
    WHERE plan_id = NEW.plan_id
      AND product_id = live_product_id
  )
  INTO is_live_plan;

  IF is_live_plan THEN
    IF NEW.product_id IS NULL THEN
      NEW.product_id := live_product_id;
    ELSIF NEW.product_id <> live_product_id THEN
      RAISE EXCEPTION 'MSK LIVE license cannot be linked to another product';
    END IF;
  ELSIF NEW.product_id = live_product_id THEN
    RAISE EXCEPTION 'MSK LIVE license must use an MSK LIVE plan';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS licenses_enforce_msk_live_product ON public.licenses;
CREATE TRIGGER licenses_enforce_msk_live_product
BEFORE INSERT OR UPDATE OF plan_id, product_id ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION public.enforce_msk_live_license_product();
