-- Garante que toda licença de plano MSK LIVE pertença ao produto MSK LIVE.
-- Idempotente e seguro para licenças antigas e futuras.

CREATE OR REPLACE FUNCTION public.enforce_msk_live_license_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  live_product_id uuid;
  selected_plan_slug text;
BEGIN
  SELECT id INTO live_product_id
  FROM public.products
  WHERE slug = 'msk-live'
  LIMIT 1;

  SELECT slug INTO selected_plan_slug
  FROM public.plans
  WHERE id = NEW.plan_id
  LIMIT 1;

  IF selected_plan_slug = 'msk-live' OR selected_plan_slug LIKE 'msk-live-%' THEN
    IF live_product_id IS NULL THEN
      RAISE EXCEPTION 'Produto MSK LIVE não encontrado';
    END IF;

    NEW.product_id := live_product_id;
  ELSIF live_product_id IS NOT NULL AND NEW.product_id = live_product_id THEN
    RAISE EXCEPTION 'Produto MSK LIVE só pode ser vinculado a planos MSK LIVE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_msk_live_license_product ON public.licenses;
CREATE TRIGGER trg_enforce_msk_live_license_product
BEFORE INSERT OR UPDATE ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION public.enforce_msk_live_license_product();

UPDATE public.licenses l
SET product_id = p_live.id
FROM public.plans p, public.products p_live
WHERE l.plan_id = p.id
  AND p_live.slug = 'msk-live'
  AND (p.slug = 'msk-live' OR p.slug LIKE 'msk-live-%')
  AND l.product_id IS DISTINCT FROM p_live.id;
