ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document text, ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.extension_channels ADD COLUMN IF NOT EXISTS public_zip text;
ALTER TABLE public.extension_builds ADD COLUMN IF NOT EXISTS channel_slug text;
UPDATE public.extension_channels SET public_zip = '/m3k-extension.zip' WHERE slug = 'm3k-principal' AND public_zip IS NULL;
UPDATE public.extension_channels SET public_zip = '/lvbup-extension.zip' WHERE slug IN ('lvbup-reserva-01','infinity-reserva-02') AND public_zip IS NULL;