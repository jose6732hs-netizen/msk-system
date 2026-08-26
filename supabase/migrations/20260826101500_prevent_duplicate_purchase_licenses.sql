-- Uma compra pode ter várias licenças do mesmo plano (item_index 1,2,3...),
-- mas o MESMO índice nunca pode ser emitido duas vezes para o mesmo pedido.
-- Isso torna a liquidação idempotente mesmo com webhooks concorrentes.
CREATE UNIQUE INDEX IF NOT EXISTS licenses_transaction_plan_item_index_unique
ON public.licenses (
  transaction_id,
  plan_id,
  ((metadata->>'item_index')::integer)
)
WHERE transaction_id IS NOT NULL
  AND plan_id IS NOT NULL
  AND metadata ? 'item_index'
  AND (metadata->>'item_index') ~ '^[0-9]+$';
