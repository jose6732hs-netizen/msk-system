-- Mantém o schema de payment_events alinhado ao recordPaymentEvent usado pelo backend.
-- Campos são opcionais e a migration é idempotente.
alter table public.payment_events
  add column if not exists external_id text null;

alter table public.payment_events
  add column if not exists webhook_event_id uuid null;

create index if not exists idx_payment_events_external_id
  on public.payment_events (external_id)
  where external_id is not null;
