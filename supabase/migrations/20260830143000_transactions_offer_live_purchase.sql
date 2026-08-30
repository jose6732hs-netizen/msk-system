-- Compatibilidade do checkout com ofertas e rastreio profissional da compra.
-- Resolve clientes/deploys que já enviam offer_id e mantém plan_id como fonte
-- de verdade do licenciamento.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_offer_id
  ON public.transactions(offer_id);

CREATE OR REPLACE FUNCTION public.transactions_resolve_offer_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.offer_id IS NULL AND NEW.plan_id IS NOT NULL THEN
    SELECT offer.id
      INTO NEW.offer_id
    FROM public.offers AS offer
    WHERE offer.plan_id = NEW.plan_id
    ORDER BY (offer.active IS TRUE) DESC, offer.sort_order ASC, offer.id ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_resolve_offer_id ON public.transactions;
CREATE TRIGGER transactions_resolve_offer_id
BEFORE INSERT OR UPDATE OF plan_id, offer_id ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.transactions_resolve_offer_id();

-- Preenche pedidos antigos que já possuem plan_id, sem alterar pagamento/status.
UPDATE public.transactions AS transaction
SET offer_id = (
  SELECT offer.id
  FROM public.offers AS offer
  WHERE offer.plan_id = transaction.plan_id
  ORDER BY (offer.active IS TRUE) DESC, offer.sort_order ASC, offer.id ASC
  LIMIT 1
)
WHERE transaction.offer_id IS NULL
  AND transaction.plan_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.offers AS offer
    WHERE offer.plan_id = transaction.plan_id
  );
