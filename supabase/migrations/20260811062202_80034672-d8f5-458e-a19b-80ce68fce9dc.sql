ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Reafirmar permissões para garantir que o PostgREST veja a nova coluna
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
GRANT SELECT ON public.plans TO anon;

-- Forçar recarregamento do cache do esquema
NOTIFY pgrst, 'reload schema';