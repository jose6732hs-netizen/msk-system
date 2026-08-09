
-- 1. Tabelas de suporte faltantes ou ajustadas (MSK Contract)
CREATE TABLE IF NOT EXISTS public.extension_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  channel_number integer NOT NULL DEFAULT 1,
  channel_type text NOT NULL DEFAULT 'public',
  chrome_extension_id text,
  enabled boolean NOT NULL DEFAULT true,
  version text NOT NULL DEFAULT '1.0.0',
  message text NOT NULL DEFAULT '',
  api_base_url text NOT NULL DEFAULT '',
  active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Colunas extras na resellers (contrato código)
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS api_public_key text UNIQUE,
  ADD COLUMN IF NOT EXISTS api_secret_hash text;

-- 3. Colunas faltantes em transactions (contrato checkout)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS external_id text;

-- 4. Grants e RLS
GRANT ALL ON public.extension_channels TO service_role;
GRANT SELECT ON public.extension_channels TO authenticated;
GRANT SELECT ON public.extension_channels TO anon;
ALTER TABLE public.extension_channels ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "channels_read_public" ON public.extension_channels FOR SELECT TO anon, authenticated USING (active = true);

-- 6. REFRESH TYPES
SELECT 1;
