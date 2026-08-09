
-- 1. Tabelas de Revenda e Clientes faltantes
CREATE TABLE IF NOT EXISTS public.reseller_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  min_deposit numeric NOT NULL DEFAULT 0,
  trials_granted integer NOT NULL DEFAULT 10,
  discount_rate numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reseller_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_slug text NOT NULL REFERENCES public.reseller_tiers(slug) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  duration_label text NOT NULL,
  duration_unit text NOT NULL DEFAULT 'days',
  duration_value integer NOT NULL DEFAULT 30,
  price numeric NOT NULL,
  suggested_price numeric,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reseller_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  customer_id uuid,
  license_id uuid,
  transaction_id uuid,
  price_id uuid REFERENCES public.reseller_prices(id) ON DELETE SET NULL,
  cost numeric NOT NULL,
  sale_price numeric,
  profit numeric,
  duration_label text,
  status text NOT NULL DEFAULT 'COMPLETED',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  document text,
  document_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Colunas extras na resellers
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS display_name text;

-- 3. Grants e RLS
GRANT ALL ON public.reseller_tiers TO service_role;
GRANT SELECT ON public.reseller_tiers TO authenticated;
GRANT SELECT ON public.reseller_tiers TO anon;
ALTER TABLE public.reseller_tiers ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.reseller_prices TO service_role;
GRANT SELECT ON public.reseller_prices TO authenticated;
GRANT SELECT ON public.reseller_prices TO anon;
ALTER TABLE public.reseller_prices ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.reseller_sales TO service_role;
GRANT SELECT ON public.reseller_sales TO authenticated;
ALTER TABLE public.reseller_sales ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "tiers_read" ON public.reseller_tiers FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "prices_read" ON public.reseller_prices FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "sales_own" ON public.reseller_sales FOR SELECT TO authenticated USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "customers_own" ON public.customers FOR SELECT TO authenticated USING (user_id = auth.uid() OR reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid()) OR public.is_admin(auth.uid()));

-- 5. Seed Tiers (contrato código)
INSERT INTO public.reseller_tiers (slug, name, min_deposit, trials_granted, discount_rate, commission_rate, sort_order)
VALUES
  ('comum', 'Comum', 0, 10, 0, 0.10, 1),
  ('pro', 'Pro', 200, 50, 0.10, 0.15, 2),
  ('elite', 'Elite', 1000, 100, 0.20, 0.20, 3)
ON CONFLICT (slug) DO NOTHING;
