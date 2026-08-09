-- Add security and payment columns to affiliates
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS withdrawal_password_hash text,
ADD COLUMN IF NOT EXISTS pix_key text,
ADD COLUMN IF NOT EXISTS pix_key_type text;

-- Re-grant access to affiliates table to ensure new columns are accessible
GRANT SELECT, UPDATE ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
