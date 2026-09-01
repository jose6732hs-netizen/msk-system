# MSK Agente v3.4.65 — Persistência Protegida

Build instalável compatível com o backend atual do agente.

## Runtime
- `msk-agent` v29 ACTIVE
- `msk-agent-fast` v9 ACTIVE
- `msk-agent-preflight` v4 ACTIVE

## Proteções
- Pre-flight testa capacidade real de persistir tarefa antes de liberar envio.
- Payload é validado antes da persistência.
- Erros de banco são classificados por código (`RLS_VIOLATION`, `NOT_NULL_VIOLATION`, `TABLE_NOT_FOUND`, `DATABASE_SCHEMA_MISMATCH`, `FOREIGN_KEY_VIOLATION`, `DATABASE_TEMPORARILY_UNAVAILABLE`, entre outros).
- Mantém comando exato do cliente.
- Mantém validação real de escrita da GitHub App.
- Mantém painel de pre-flight apenas dentro do popup iOS.
- Chat exibe código, etapa e `error_id` quando fornecidos pelo backend.

## Build
- Extensão: 3.4.65
- Arquivos protegidos: 88
- Integrity root: `524c195912833f34c5e7e7d033b72bc4e838bd3c8bc126efce05d5b7cd605375`
- ZIP SHA-256: `eab1e49192c90de17a6b902c54254bbf54d1e0620787d1b7d4f036936eefb541`
