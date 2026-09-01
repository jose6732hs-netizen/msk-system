# MSK Agente v3.4.67 — Pre-flight sem INSERT

Correção definitiva do bloqueio de banco no pre-flight.

## Alterações
- O pre-flight não executa mais INSERT temporário em `msk_tasks`.
- A verificação de banco agora confirma propriedade do projeto, existência de `msk_tasks` e colunas obrigatórias.
- A persistência real fica exclusivamente no executor `msk-agent`, usando `SERVICE_ROLE_KEY` e autorização manual do usuário/projeto/repositório.
- Falhas reais de persistência continuam retornando códigos específicos de banco.
- `pgcrypto` permanece habilitado.
- GitHub App, sessão MSK, branch e IA continuam sendo validados antes de liberar o chat.
- A build mantém o comando exato do cliente e o painel pre-flight dentro do popup iOS.

## Backend
Migration: `20260901054500_make_task_persistence_preflight_schema_only.sql`
Commit principal: `d30a8d557780735c633eb803bfc1883015825e28`

## Build
- Extensão: 3.4.67
- Arquivos protegidos: 88
- Integrity root: `84aeeb8d6543d59c55acf09a49659b554b36a71df150fca6de3a2cf63a3f6a78`
- ZIP SHA-256: `77d6deaac62a69b73b0516ca0ef25bb3c52e3a937650fe5aa2aefbe56470eff9`
