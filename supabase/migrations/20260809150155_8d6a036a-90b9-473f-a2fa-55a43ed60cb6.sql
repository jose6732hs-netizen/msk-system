-- 1. Enhance affiliate_clicks table
ALTER TABLE public.affiliate_clicks 
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS utm_content text,
ADD COLUMN IF NOT EXISTS utm_term text,
ADD COLUMN IF NOT EXISTS device_type text;

-- 2. Seed default settings if not present
INSERT INTO public.app_settings (key, value)
VALUES 
  ('affiliate_goals', '{"balance": 1000, "commission": 500, "sales": 10, "referrals": 50, "monthly": 2000}'::jsonb),
  ('commissions', '{"affiliate": 30}'::jsonb),
  ('trial', '{"duration_minutes": 15, "cooldown_hours": 24, "max_per_user": 1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Update RLS policies (as service_role/owner via tool)
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_balance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view their own record" ON public.affiliates;
CREATE POLICY "Affiliates can view their own record" ON public.affiliates
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Affiliates can view their own clicks" ON public.affiliate_clicks;
CREATE POLICY "Affiliates can view their own clicks" ON public.affiliate_clicks
FOR SELECT TO authenticated USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Affiliates can view their own referrals" ON public.affiliate_referrals;
CREATE POLICY "Affiliates can view their own referrals" ON public.affiliate_referrals
FOR SELECT TO authenticated USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Affiliates can view their own commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliates can view their own commissions" ON public.affiliate_commissions
FOR SELECT TO authenticated USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Affiliates can view their own ledger" ON public.affiliate_balance_ledger;
CREATE POLICY "Affiliates can view their own ledger" ON public.affiliate_balance_ledger
FOR SELECT TO authenticated USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage everything on affiliates" ON public.affiliates;
CREATE POLICY "Admins can manage everything on affiliates" ON public.affiliates
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage clicks" ON public.affiliate_clicks;
CREATE POLICY "Admins can manage clicks" ON public.affiliate_clicks
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage referrals" ON public.affiliate_referrals;
CREATE POLICY "Admins can manage referrals" ON public.affiliate_referrals
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage commissions" ON public.affiliate_commissions;
CREATE POLICY "Admins can manage commissions" ON public.affiliate_commissions
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Grant access
GRANT SELECT ON public.affiliates TO authenticated;
GRANT SELECT ON public.affiliate_clicks TO authenticated;
GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT SELECT ON public.affiliate_balance_ledger TO authenticated;
GRANT SELECT ON public.affiliate_documents TO authenticated;
