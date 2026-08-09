
-- 1. Tabelas de suporte faltantes (contrato MSK)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 20),
  affiliate_code TEXT,
  reseller_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id)
);

CREATE TABLE IF NOT EXISTS public.reseller_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  email text,
  device_hash text,
  installation_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extension_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  channel_number text,
  channel_type text DEFAULT 'public',
  active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Colunas extras para satisfazer o código
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS splits jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Grants e RLS
GRANT ALL ON public.app_settings TO service_role;
GRANT SELECT ON public.app_settings TO authenticated;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.cart_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.reseller_deposits TO service_role;
GRANT SELECT ON public.reseller_deposits TO authenticated;
ALTER TABLE public.reseller_deposits ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.trials TO service_role;
GRANT SELECT ON public.trials TO authenticated;
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.extension_channels TO service_role;
GRANT SELECT ON public.extension_channels TO authenticated;
ALTER TABLE public.extension_channels ENABLE ROW LEVEL SECURITY;

-- 4. Policies Básicas
CREATE POLICY "settings_read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "cart_own" ON public.cart_items FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "deposits_own" ON public.reseller_deposits FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = reseller_id AND r.user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "trials_own" ON public.trials FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "channels_read" ON public.extension_channels FOR SELECT TO authenticated USING (active = true);
