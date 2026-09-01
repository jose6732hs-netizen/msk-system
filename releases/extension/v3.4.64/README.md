# MSK Agente v3.4.64 — GitHub Pre-flight Fix

Correção focada no bug de conexão/validação do pre-flight.

## Corrigido
- GitHub não fica mais verde apenas porque o repositório foi detectado na página do Lovable.
- O pre-flight representa a conexão do projeto atual, não apenas a disponibilidade global da API do GitHub.
- Escrita é validada pelas permissões reais da GitHub App (`contents: write`) e não por `repo.permissions.push`.
- Token da instalação, acesso ao repositório, branch e sessão MSK são verificados antes de liberar o chat.
- Branch protegida usa PR quando `pull_requests: write` estiver disponível.
- O background recupera silenciosamente a sessão MSK via `status` antes de rodar o pre-flight.
- Pre-flight usa duas tentativas de transporte para reduzir falhas transitórias de `Failed to fetch`.
- Enquanto verifica, estados antigos são limpos para não manter indicadores verdes falsos.
- O chat só é liberado quando `ready=true`.
- Após retorno do OAuth do GitHub, a conexão e o pre-flight são rechecados automaticamente.
- O painel continua restrito ao popup iOS operacional.

## Backend
- `msk-agent-preflight` v2 ACTIVE no Supabase.
- Código versionado em `supabase/functions/msk-agent-preflight/index.ts`.

## Build
- Extensão: 3.4.64
- Arquivos protegidos: 88
