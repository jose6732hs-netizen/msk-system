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
- O repositório atual do Lovable tem prioridade sobre cache local antigo.
- Se o repositório salvo no banco estiver desatualizado, o pre-flight valida o repositório atual pela mesma instalação GitHub e corrige o vínculo antes de liberar o chat.

## Backend
- `msk-agent-preflight` v3 ACTIVE no Supabase.
- Código versionado em `supabase/functions/msk-agent-preflight/index.ts`.
- Verificação de escrita usa `contents: write` da GitHub App.
- Verificação de PR usa `pull_requests: write` quando a branch é protegida.

## Build
- Extensão: 3.4.64
- Arquivos protegidos: 88
- Integrity root: `3845b29ce09856c38592d1f7478dd63d26888c7bb59a8363319230bccc2b77c4`
- ZIP SHA-256: `4a02e672c691a3b6553e142b4e673f36c14098f2987f6fb516f85b130bc0d425`
