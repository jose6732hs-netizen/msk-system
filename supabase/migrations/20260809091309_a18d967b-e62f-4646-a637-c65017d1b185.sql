
-- 1. Tabelas faltantes (Invoices, Payment Events, Builds, etc.)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id),
  transaction_id uuid REFERENCES public.transactions(id),
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'PAID',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id),
  event text NOT NULL,
  status text NOT NULL,
  amount numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extension_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid REFERENCES public.resellers(id),
  version text NOT NULL DEFAULT '1.0.0',
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  is_official boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  channel_slug text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid REFERENCES public.extension_builds(id),
  reseller_id uuid REFERENCES public.resellers(id),
  user_id uuid,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Ajuste na extension_channels (colunas do contrato)
ALTER TABLE public.extension_channels 
  ADD COLUMN IF NOT EXISTS chrome_extension_id text,
  ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS api_base_url text;

-- 3. Grants e RLS
GRANT ALL ON public.invoices TO service_role;
GRANT SELECT ON public.invoices TO authenticated;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.payment_events TO service_role;
GRANT SELECT ON public.payment_events TO authenticated;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.extension_builds TO service_role;
GRANT SELECT ON public.extension_builds TO authenticated;
ALTER TABLE public.extension_builds ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.downloads TO service_role;
GRANT SELECT ON public.downloads TO authenticated;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

-- 4. Policies Básicas
CREATE POLICY "invoices_own" ON public.invoices FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "builds_read" ON public.extension_builds FOR SELECT TO authenticated USING (true);
CREATE POLICY "downloads_read" ON public.downloads FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
