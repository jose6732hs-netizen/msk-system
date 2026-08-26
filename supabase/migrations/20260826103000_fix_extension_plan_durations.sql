-- Corrige os períodos comerciais da extensão principal.
-- Não altera licenças pagas históricas: elas usam snapshots congelados na compra.
UPDATE public.plans
SET duration_value = 7,
    duration_unit = 'days',
    duration_days = 7,
    updated_at = now()
WHERE slug = 'weekly' AND active = true;

UPDATE public.plans
SET duration_value = 90,
    duration_unit = 'days',
    duration_days = 90,
    updated_at = now()
WHERE slug = 'quarterly' AND active = true;
