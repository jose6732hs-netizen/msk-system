# MSK Agente v3.4.70 — Credential Vault

## Backend
- Nova Edge Function `msk-agent-vault` com ações `analyze`, `submit`, `status`, `list` e `delete`.
- AES-256-GCM com chave derivada no servidor; valores descriptografados nunca são retornados em APIs de leitura.
- Isolamento obrigatório por `user_id` + `lovable_project_id` e sessão MSK válida.
- Análise determinística do repositório para detectar referências de ambiente e nomes de credenciais sem enviar valores à IA.
- Tabela `msk_agent_secrets` com RLS forçado; `anon` e `authenticated` sem acesso direto; operações internas via `service_role` após autorização manual.
- `msk_tasks.credential_request` armazena somente metadados do card, nunca valores.
- Novos estados: `awaiting_credentials` e `saving_credentials`.
- Após salvar, `.env.example` pode receber somente nomes das variáveis, sem valores reais.

## Extensão
- Detecção local de intenção de troca/configuração de credenciais antes da chamada de edição por IA.
- Card seguro dentro do popup com inputs mascarados, revelar/ocultar e botão `Salvar com segurança`.
- Transporte dedicado para `msk-agent-vault` usando a licença e a sessão MSK/GitHub já autorizadas.
- Valores são apagados dos inputs/objeto local após a resposta do backend.
- Se o cliente colar um segredo no próprio comando, o histórico visível mascara o conteúdo como `[SEGREDO OCULTO]`.
- Fluxo visual: `awaiting_credentials` → `saving_credentials` → `completed`.

## Segurança
O Cofre não injeta automaticamente valores secretos no ambiente de deploy sem um canal autorizado de secrets do runtime. Se o repositório contém segredo hardcoded, o backend sinaliza o caso e não grava o novo segredo no código. Isso evita quebrar o runtime ou expor credenciais.

## Produção
- `msk-agent-vault` v1: ACTIVE
- Migration aplicada: `20260901062316_msk_agent_credential_vault`
- GitHub vault service: `3bf5bf90483a25b27f6a6f28e142af0698c919fa`
- GitHub migration: `e6c32859245b9f85002d5565fcdd69e16872b44d`
- GitHub tests: `db98d0c43e4ddca6e9bc73fe5e0f5f10295339d2`

## Build
- Extensão: `3.4.70`
- Arquivos protegidos: `91`
- Integrity root: `5b9ee99c3526d4992ac9a9331b0d4ae71bb144e27bb732f224cdbf1c045f181a`
- ZIP SHA-256: `9a99328c0003e473d34adc475738ce66d57b251687370b8605522cc5743fa663`
- ZIP: `MSK-Agente-v3.4.70-CREDENTIAL-VAULT.zip`
