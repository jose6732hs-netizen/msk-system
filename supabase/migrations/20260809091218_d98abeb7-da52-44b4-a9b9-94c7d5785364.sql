
-- 1. Criar helper is_admin (se não existir)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
$$;

-- 2. Duração flexível e campos de revenda nos planos
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'days',
  ADD COLUMN IF NOT EXISTS duration_value integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reseller_price numeric,
  ADD COLUMN IF NOT EXISTS affiliate_commission_rate numeric NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS affiliate_commission_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_activations integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS allow_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_reset boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_limit integer;

-- 3. Campos extras em comissões
ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS base_amount numeric,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 4. Campos extras em saques
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS provider_transfer_id text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS raw jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 5. Tabelas Financeiras de Afiliados
CREATE TABLE IF NOT EXISTS public.affiliate_balance_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  visitor_id text,
  landing_path text,
  referer text,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'visitor',
  landing_path text,
  ip_hash text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  signed_up_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_commission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  rate numeric NOT NULL DEFAULT 0,
  fixed_amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
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

-- 7. Grants
GRANT ALL ON public.affiliate_balance_ledger TO service_role;
GRANT SELECT ON public.affiliate_balance_ledger TO authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;
GRANT SELECT ON public.affiliate_clicks TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;
GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_commission_overrides TO service_role;
GRANT SELECT ON public.affiliate_commission_overrides TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT SELECT ON public.audit_logs TO authenticated;

-- 8. RLS e Policies
ALTER TABLE public.affiliate_balance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_read" ON public.affiliate_balance_ledger FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "clicks_read" ON public.affiliate_clicks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "referrals_read" ON public.affiliate_referrals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "overrides_read" ON public.affiliate_commission_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "audit_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
