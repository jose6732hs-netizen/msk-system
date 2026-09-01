# MSK Agente v3.4.58 — Chat Realtime

Release da extensão com fluxo interativo da tarefa dentro do chat.

## SHA-256 do pacote
`a477c6994e85bae71526d792fd6604a1cb42cde51ee6d76cf8ce84c01dc342b6`

## Arquivos alterados no pacote
- `msk-direct-agent.js`
- `background-direct-agent.js`
- `manifest.json`
- `README.md`
- `integrity.json`
- `INTEGRITY-ROOT.txt`
- `supabase/functions/msk-agent-fast/index.ts`

## Comportamento
- acknowledge imediato: “Entendendo seu pedido...”;
- progresso por estados do backend;
- suporte a `locating_files`, `analyzing`, `editing`, `validating`, `committing`, `verifying`, `self_correcting`, `no_changes_retry`, `awaiting_input` e `completed`;
- pergunta única com opções clicáveis;
- resposta continua o mesmo `task_id` e leva contexto do pedido/pergunta;
- resumo final com arquivos, evidências de execução, commit, branch, repositório e link;
- a extensão recusa falso sucesso quando não há prova suficiente de commit;
- integridade do pacote recalculada para a versão `3.4.58`.

## Backend
A Edge Function `msk-agent-fast` está registrada no repositório como proxy seguro para o motor principal e foi publicada no Supabase para preservar o endpoint rápido sem duplicar lógica crítica.
