ALTER TABLE public.extension_builds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
GRANT ALL ON public.extension_builds TO authenticated;
GRANT ALL ON public.extension_builds TO service_role;