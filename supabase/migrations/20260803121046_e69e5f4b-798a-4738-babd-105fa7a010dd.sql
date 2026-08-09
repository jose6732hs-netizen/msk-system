-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
$$;

-- ============ payment_settings (server-only) ============
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE DEFAULT 'amplopay',
  active boolean NOT NULL DEFAULT false,
  api_base_url text NOT NULL DEFAULT 'https://app.amplopay.com/api/v1',
  public_key_encrypted text,
  secret_key_encrypted text,
  webhook_secret_encrypted text,
  public_key_last4 text,
  secret_key_last4 text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
-- sem policies: acesso exclusivo do backend (service role)

-- ============ app_settings (trial, comissões, níveis) ============
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_auth" ON public.app_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_settings(key, value) VALUES
  ('trial', '{"duration_minutes":15,"cooldown_hours":24,"max_per_user":1}'::jsonb),
  ('commissions', '{"affiliate":30,"reseller":20,"platform":50,"split_mode":"automatic"}'::jsonb),
  ('reseller_tiers', '[{"slug":"comum","name":"Comum","trials":10,"min_deposit":0,"discount":0},{"slug":"pro","name":"Pro","trials":50,"min_deposit":200,"discount":10},{"slug":"elite","name":"Elite","trials":100,"min_deposit":1000,"discount":20}]'::jsonb);

-- ============ products ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  image_url text,
  type text NOT NULL DEFAULT 'digital',
  active boolean NOT NULL DEFAULT true,
  affiliate_commission_rate numeric(5,2) NOT NULL DEFAULT 30,
  reseller_commission_rate numeric(5,2) NOT NULL DEFAULT 20,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "products_admin_all" ON public.products FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ offers ============
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  recurring boolean NOT NULL DEFAULT false,
  periodicity_type text NOT NULL DEFAULT 'MONTHS',
  periodicity int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  affiliate_commission_rate numeric(5,2),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offers TO anon, authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers_public_read" ON public.offers FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "offers_admin_all" ON public.offers FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ affiliates ============
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  commission_rate numeric(5,2) NOT NULL DEFAULT 30,
  total_sales int NOT NULL DEFAULT 0,
  total_commission numeric(12,2) NOT NULL DEFAULT 0,
  available_balance numeric(12,2) NOT NULL DEFAULT 0,
  pending_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliates_own_read" ON public.affiliates FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ============ resellers ============
CREATE TABLE public.resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'comum',
  status text NOT NULL DEFAULT 'active',
  available_balance numeric(12,2) NOT NULL DEFAULT 0,
  pending_balance numeric(12,2) NOT NULL DEFAULT 0,
  total_deposited numeric(12,2) NOT NULL DEFAULT 0,
  trials_available int NOT NULL DEFAULT 10,
  trials_used int NOT NULL DEFAULT 0,
  discount_rate numeric(5,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL DEFAULT 20,
  api_public_key text UNIQUE,
  api_secret_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resellers TO authenticated;
GRANT ALL ON public.resellers TO service_role;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resellers_own_read" ON public.resellers FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ============ transactions ============
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'amplopay',
  provider_transaction_id text,
  user_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'purchase',
  method text NOT NULL DEFAULT 'PIX',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'PENDING',
  pix_code text,
  pix_qrcode text,
  checkout_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX transactions_provider_txid_idx ON public.transactions(provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX transactions_user_idx ON public.transactions(user_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_own_read" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ============ affiliate_commissions ============
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  rate numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, affiliate_id)
);
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions_own_read" ON public.affiliate_commissions FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

-- ============ reseller_deposits ============
CREATE TABLE public.reseller_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reseller_deposits TO authenticated;
GRANT ALL ON public.reseller_deposits TO service_role;
ALTER TABLE public.reseller_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposits_own_read" ON public.reseller_deposits FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = reseller_id AND r.user_id = auth.uid()));

-- ============ withdrawals ============
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  pix_key_type text NOT NULL,
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  provider_transfer_id text,
  error text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals_own_read" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ============ splits ============
CREATE TABLE public.splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  producer_id text NOT NULL,
  beneficiary_type text NOT NULL DEFAULT 'affiliate',
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.splits TO service_role;
ALTER TABLE public.splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "splits_admin_read" ON public.splits FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
GRANT SELECT ON public.splits TO authenticated;

-- ============ extension_branding ============
CREATE TABLE public.extension_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL UNIQUE REFERENCES public.resellers(id) ON DELETE CASCADE,
  extension_name text NOT NULL DEFAULT 'MSK Extension',
  description text NOT NULL DEFAULT 'Extensão premium',
  icon_url text,
  primary_color text NOT NULL DEFAULT '#39FF88',
  title_color text NOT NULL DEFAULT '#FFFFFF',
  store_url text,
  support_url text,
  changelog text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.extension_branding TO anon, authenticated;
GRANT ALL ON public.extension_branding TO service_role;
ALTER TABLE public.extension_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branding_public_read" ON public.extension_branding FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "branding_own_write" ON public.extension_branding FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = reseller_id AND r.user_id = auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = reseller_id AND r.user_id = auth.uid()));

-- ============ extension_builds / downloads ============
CREATE TABLE public.extension_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT '1.0.0',
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.extension_builds TO authenticated;
GRANT ALL ON public.extension_builds TO service_role;
ALTER TABLE public.extension_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "builds_own_read" ON public.extension_builds FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = reseller_id AND r.user_id = auth.uid()));

CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  user_id uuid,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.downloads TO service_role;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.downloads TO authenticated;
CREATE POLICY "downloads_admin_read" ON public.downloads FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ============ audit_logs ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  resource text,
  resource_id text,
  ip_hash text,
  user_agent text,
  result text NOT NULL DEFAULT 'success',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs(created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ============ colunas extras em licenses ============
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'paid';
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS starts_at timestamptz NOT NULL DEFAULT now();

-- webhook_events: suporte a transactionId
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS transaction_id text;

-- produto e ofertas iniciais
INSERT INTO public.products (slug, name, description, type)
VALUES ('extensao-msk', 'Extensão MSK', 'Extensão premium Lovable MSK', 'digital')
ON CONFLICT (slug) DO NOTHING;