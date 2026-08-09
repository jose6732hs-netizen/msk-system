-- ============ PLANOS: duração flexível + revenda + antifraude ============
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'days',
  ADD COLUMN IF NOT EXISTS duration_value integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reseller_price numeric,
  ADD COLUMN IF NOT EXISTS affiliate_commission_rate numeric NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS max_activations integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS allow_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_reset boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_limit integer;

UPDATE public.plans SET duration_unit = CASE WHEN is_lifetime THEN 'lifetime' ELSE 'days' END,
  duration_value = COALESCE(duration_days, 30) WHERE duration_value = 30;

-- ============ LICENÇAS / DISPOSITIVOS: antifraude ============
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS activation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_activations integer NOT NULL DEFAULT 3;

ALTER TABLE public.license_devices
  ADD COLUMN IF NOT EXISTS installation_id text,
  ADD COLUMN IF NOT EXISTS activation_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_validation timestamptz;

-- ============ REVENDEDOR: página pública ============
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name text;

-- ============ CUSTOMERS ============
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
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_own" ON public.customers FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- ============ INVOICES ============
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  external_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  method text,
  status text NOT NULL DEFAULT 'PAID',
  due_date timestamptz,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_own" ON public.invoices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- ============ PAYMENT EVENTS ============
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  webhook_event_id uuid REFERENCES public.webhook_events(id) ON DELETE SET NULL,
  external_id text,
  event text NOT NULL,
  status text NOT NULL,
  amount numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_events_admin" ON public.payment_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.payment_events TO authenticated;

-- ============ RESELLER TIERS + PRICES ============
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
GRANT SELECT ON public.reseller_tiers TO anon, authenticated;
GRANT ALL ON public.reseller_tiers TO service_role;
ALTER TABLE public.reseller_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiers_read" ON public.reseller_tiers FOR SELECT USING (active);

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
GRANT SELECT ON public.reseller_prices TO anon, authenticated;
GRANT ALL ON public.reseller_prices TO service_role;
ALTER TABLE public.reseller_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reseller_prices_read" ON public.reseller_prices FOR SELECT USING (active);

-- ============ RESELLER SALES ============
CREATE TABLE IF NOT EXISTS public.reseller_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  price_id uuid REFERENCES public.reseller_prices(id) ON DELETE SET NULL,
  cost numeric NOT NULL,
  sale_price numeric,
  profit numeric,
  duration_label text,
  status text NOT NULL DEFAULT 'COMPLETED',
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reseller_sales TO authenticated;
GRANT ALL ON public.reseller_sales TO service_role;
ALTER TABLE public.reseller_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reseller_sales_own" ON public.reseller_sales FOR SELECT TO authenticated
  USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- ============ TRIALS ============
CREATE TABLE IF NOT EXISTS public.trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  email text,
  device_hash text,
  installation_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trials_device_idx ON public.trials (device_hash);
CREATE INDEX IF NOT EXISTS trials_email_idx ON public.trials (lower(email));
GRANT SELECT ON public.trials TO authenticated;
GRANT ALL ON public.trials TO service_role;
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trials_own" ON public.trials FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- ============ TRANSACTIONS: splits/externo ============
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS splits jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS due_date timestamptz;

-- ============ WEBHOOK EVENTS: campos do contrato ============
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'PENDING';

-- ============ SEED: níveis e preços de revenda (editáveis) ============
INSERT INTO public.reseller_tiers (slug, name, min_deposit, trials_granted, discount_rate, commission_rate, sort_order)
VALUES
  ('comum', 'Comum', 0, 10, 0, 0.10, 1),
  ('pro', 'Pro', 200, 50, 0.10, 0.15, 2),
  ('elite', 'Elite', 1000, 100, 0.20, 0.20, 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.reseller_prices (tier_slug, duration_label, duration_unit, duration_value, price, sort_order)
VALUES
  ('comum', '7 dias', 'days', 7, 10.90, 1),
  ('comum', '15 dias', 'days', 15, 14.90, 2),
  ('comum', '30 dias', 'days', 30, 19.90, 3),
  ('comum', 'Vitalício', 'lifetime', 0, 54.90, 4),
  ('pro', '7 dias', 'days', 7, 23.90, 1),
  ('pro', '15 dias', 'days', 15, 28.90, 2),
  ('pro', '30 dias', 'days', 30, 36.90, 3),
  ('pro', 'Vitalício', 'lifetime', 0, 54.90, 4),
  ('elite', '7 dias', 'days', 7, 19.90, 1),
  ('elite', '15 dias', 'days', 15, 24.90, 2),
  ('elite', '30 dias', 'days', 30, 32.90, 3),
  ('elite', 'Vitalício', 'lifetime', 0, 49.90, 4)
ON CONFLICT DO NOTHING;

-- backfill slug dos revendedores existentes
UPDATE public.resellers SET slug = lower(code) WHERE slug IS NULL;