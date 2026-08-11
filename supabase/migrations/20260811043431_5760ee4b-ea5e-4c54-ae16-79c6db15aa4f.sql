
-- 1. Redefine commissions structure for manual wallet control
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.affiliate_wallets(id);
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS gross_amount numeric(15,2);
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS commission_percentage numeric(5,2);

-- 2. Ensure user_id link in transactions for recompra and attribution
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS commission_registered boolean DEFAULT false;

-- 3. Configuration table setup
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

-- Initialize default settings
INSERT INTO public.app_settings (key, value)
VALUES 
    ('affiliate_config', '{"commission_hold_days": 0, "minimum_withdrawal_amount": 50}')
ON CONFLICT (key) DO NOTHING;

-- 4. Fix potential security definer issues (Search Path)
ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) SET search_path = public;
ALTER FUNCTION public.create_affiliate_wallet_on_affiliate_creation() SET search_path = public;
