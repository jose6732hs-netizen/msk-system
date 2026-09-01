# MSK Agente v3.4.59 — Erros Resilientes

Release da extensão alinhada ao motor MSK 3.2.0-observable-reliable.

## Pacote
- Arquivo: `MSK-Agente-v3.4.59-ERROS-RESILIENTES.zip`
- SHA-256: `ce9ff5cea8a8632e720c375960677c58df3fb81a2a7959258239975ae4467712`
- Integrity Root: `aff4947032d7588348a1e625370b78fcf419936a27dbb510d74f431cf0387518`
- Arquivos protegidos pelo manifesto de integridade: 86

## Extensão
- remove o fallback visual `MSK_AGENT_ERROR`;
- exibe código específico, etapa, tentativas automáticas e `error_id`/`last_error_id`;
- mostra `self_correcting` e `no_changes_retry` com número da tentativa;
- falhas de transporte usam `EXTENSION_REQUEST_TIMEOUT` ou `EXTENSION_TRANSPORT_ERROR`;
- falhas internas de configuração preservam códigos seguros específicos sem expor credenciais;
- mensagens de erro continuam sanitizadas para o cliente.

Os patches exatos entre v3.4.58 e v3.4.59 estão em `extension-releases/v3.4.59/`.

## Backend em produção
- `msk-agent`: versão 26 ACTIVE;
- runtime reporta `3.2.0-observable-reliable`;
- lock por repositório+branch;
- retries controlados com backoff;
- erros persistidos em `msk_agent_errors` com código/etapa/contexto sanitizado/stack interno;
- validação pré-commit e revisão semântica;
- verificação do SHA final antes de `completed`;
- falha desconhecida vira `INTERNAL_ERROR` com `error_id`, nunca `MSK_AGENT_ERROR`.

## Banco
Migration: `20260901034516_msk_agent_error_observability_and_locks`

Cria `msk_agent_errors`, `msk_agent_locks` e adiciona `error_code`, `error_stage`, `retry_count`, `last_error_id` em `msk_tasks`. Tabelas operacionais permanecem server-only com RLS.

## Super Admin
A aba `API do Agente` recebe diagnóstico do motor com:
- erros por código;
- erros por etapa;
- taxa de `INTERNAL_ERROR`;
- alerta quando a taxa passa de 5% com volume mínimo;
- detalhe por `error_id` com contexto sanitizado e stack somente para administrador.
