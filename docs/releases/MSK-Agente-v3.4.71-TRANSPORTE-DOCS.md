# MSK Agente v3.4.71 — Transporte resiliente + documentação complexa

## Runtime
- `msk-agent-public` v11 ACTIVE.
- Valida a assinatura anti-tamper do corpo original antes de transformar documentação/anexos.
- Anexos e documentação longa são compactados via `msk-attachment-analyze` antes do `msk-agent`.
- O corpo encaminhado não inclui histórico, skill ou `reinforced_command`.
- `RUN` não recebe retry cego; em perda de resposta a extensão reconcilia a mesma `task_id`.

## Extensão
- FAST_EDIT: timeout de transporte 120s.
- COMPLEX_EDIT: timeout de transporte 240s.
- Retry 3 tentativas apenas para operações idempotentes: preflight, health, status, task-status e leitura do vault (backoff 1s/3s).
- Reconciliation por `task_id` por aproximadamente 149s após resposta perdida.
- Com anexos ou documentação colada > 9000 caracteres, usa `msk-agent-public` v11.
- Texto de anexos tem padrões óbvios de segredo redigidos antes de sair da extensão.
- Comandos visuais normais continuam no caminho rápido.

## Build
- ZIP: `MSK-Agente-v3.4.71-TRANSPORTE-DOCS-COMPLEXOS.zip`
- SHA-256: `7fe57943471d6d34ded2a8d7fb293f883c8c1b5aa7e664bb96c247ac0857a2ff`
- Integrity Root: `7f59f00212aeb0b8dfe141f252cb98036d62275c00da3ff0aea76ec8c9db803a`
- Arquivos protegidos: 91

## Validação executada
- `node --check` em todos os JavaScript da extensão: OK.
- `unzip -t`: OK.
- Manifest dentro do ZIP: 3.4.71.
- `msk-agent-public` v11 compilado e publicado como ACTIVE no Supabase.
- Teste estático de roteamento: FAST visual continua em `msk-agent-fast`; anexos/documentação longa usam `msk-agent-public`.
