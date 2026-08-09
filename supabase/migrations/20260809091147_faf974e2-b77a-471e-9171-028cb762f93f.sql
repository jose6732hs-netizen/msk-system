
-- 1. Tabelas essenciais que faltaram (products, offers, etc.)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  image_url text,
  type text NOT NULL DEFAULT 'digital',
  active boolean NOT NULL DEFAULT true,
  affiliate_commission_rate numeric(5,2) NOT NULL DEFAULT 30,
  reseller_commission_rate numeric(5,2) NOT NULL DEFAULT 20,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  recurring boolean NOT NULL DEFAULT false,
  periodicity_type text NOT NULL DEFAULT 'MONTHS',
  periodicity int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  affiliate_commission_rate numeric(5,2),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Adicionar os alters e o resto
ALTER TABLE public.licenses 
  ADD COLUMN IF NOT EXISTS token_encrypted text,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS starts_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS activation_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_code text,
  ADD COLUMN IF NOT EXISTS pix_qrcode text,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raw jsonb,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'PIX',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';

-- 3. Grants e RLS Básicos
GRANT ALL ON public.products TO service_role;
GRANT SELECT ON public.products TO authenticated;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.offers TO service_role;
GRANT SELECT ON public.offers TO authenticated;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
