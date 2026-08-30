ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON public.transactions(product_id);

-- Backfill: vincula transações existentes ao produto da oferta/plano quando possível
UPDATE public.transactions t
SET product_id = o.product_id
FROM public.offers o
WHERE t.offer_id = o.id AND t.product_id IS NULL AND o.product_id IS NOT NULL;