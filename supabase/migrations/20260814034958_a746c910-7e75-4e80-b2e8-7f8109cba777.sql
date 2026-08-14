ALTER TABLE public.affiliates ALTER COLUMN commission_rate SET DEFAULT 30;
UPDATE public.affiliates SET commission_rate = 30 WHERE commission_rate IS DISTINCT FROM 30;
ALTER TABLE public.plans ALTER COLUMN affiliate_commission_rate SET DEFAULT 30;
UPDATE public.plans SET affiliate_commission_rate = 30 WHERE affiliate_commission_rate IS DISTINCT FROM 30;