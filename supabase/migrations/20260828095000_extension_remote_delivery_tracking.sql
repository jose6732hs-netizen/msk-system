-- Mantém o schema alinhado ao canal remoto já usado pelo MSK Agente.
-- Sem esta coluna, a atualização de status do comando falha por inteiro e
-- mensagens permanecem como "pending" mesmo quando a extensão está online.
alter table public.extension_remote_commands
  add column if not exists last_delivery_at timestamptz;
