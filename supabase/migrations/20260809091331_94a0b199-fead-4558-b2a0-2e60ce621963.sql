
-- 1. Tabelas de suporte faltantes (Payment Settings, Branding, etc.)
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE DEFAULT 'amplopay',
  active boolean NOT NULL DEFAULT false,
  api_base_url text NOT NULL DEFAULT 'https://app.amplopay.com/api/v1',
  public_key_encrypted text,
  secret_key_encrypted text,
  webhook_secret_encrypted text,
  public_key_last4 text,
  secret_key_last4 text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extension_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL UNIQUE REFERENCES public.resellers(id) ON DELETE CASCADE,
  extension_name text NOT NULL DEFAULT 'MSK Extension',
  description text NOT NULL DEFAULT 'Extensão premium',
  icon_url text,
  primary_color text NOT NULL DEFAULT '#39FF88',
  title_color text NOT NULL DEFAULT '#FFFFFF',
  store_url text,
  support_url text,
  changelog text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants e RLS
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.extension_branding TO service_role;
GRANT SELECT ON public.extension_branding TO authenticated;
GRANT SELECT ON public.extension_branding TO anon;
ALTER TABLE public.extension_branding ENABLE ROW LEVEL SECURITY;

-- 3. Policies Básicas
CREATE POLICY "branding_read" ON public.extension_branding FOR SELECT TO anon, authenticated USING (true);

-- 4. REFRESH TYPES
SELECT 1;
