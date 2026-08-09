-- 1. Afiliados: colunas extras
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS goal_amount numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS total_clicks integer NOT NULL DEFAULT 0;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS affiliate_commission_fixed numeric NOT NULL DEFAULT 0;

-- 2. Cliques em links de afiliado
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
CREATE INDEX IF NOT EXISTS affiliate_clicks_aff_idx ON public.affiliate_clicks(affiliate_id, created_at DESC);
GRANT SELECT ON public.affiliate_clicks TO authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clicks_own" ON public.affiliate_clicks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
         OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 3. Indicações (visitante -> cadastro -> cliente)
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
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_referrals_visitor_key ON public.affiliate_referrals(affiliate_id, visitor_id);
CREATE INDEX IF NOT EXISTS affiliate_referrals_user_idx ON public.affiliate_referrals(user_id);
GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own" ON public.affiliate_referrals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
         OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 4. Comissão personalizada por afiliado/plano
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
CREATE UNIQUE INDEX IF NOT EXISTS aff_override_key ON public.affiliate_commission_overrides(affiliate_id, COALESCE(plan_id,'00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT ON public.affiliate_commission_overrides TO authenticated;
GRANT ALL ON public.affiliate_commission_overrides TO service_role;
ALTER TABLE public.affiliate_commission_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overrides_read" ON public.affiliate_commission_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
         OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 5. Histórico de saldo do afiliado
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
CREATE INDEX IF NOT EXISTS aff_ledger_idx ON public.affiliate_balance_ledger(affiliate_id, created_at DESC);
GRANT SELECT ON public.affiliate_balance_ledger TO authenticated;
GRANT ALL ON public.affiliate_balance_ledger TO service_role;
ALTER TABLE public.affiliate_balance_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_own" ON public.affiliate_balance_ledger FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
         OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 6. Comissões: vincular plano e afiliado ao registro
ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS base_amount numeric,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS aff_commission_tx_key ON public.affiliate_commissions(transaction_id);

-- 7. Configurações padrão (domínio + metas)
INSERT INTO public.app_settings(key, value) VALUES
  ('app_url', '{"url":""}'::jsonb),
  ('affiliate_goals', '{"balance":1000,"commission":0,"sales":0,"referrals":0,"monthly":0}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 8. Primeiro usuário cadastrado vira super admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_first boolean;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin')
  ) INTO is_first;

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;