# MSK Agente v3.4.61 — Pre-flight Preventivo

Release de teste da extensão ligada ao backend `msk-agent-preflight`.

## Alterações da extensão
- Novo `msk-preflight.js` carregado antes de `msk-direct-agent.js`.
- Pre-flight automático ao abrir e antes de cada envio.
- Cache de 30 segundos para status já confirmado; o envio força uma nova checagem.
- Input e botão de envio ficam bloqueados durante a checagem e quando existem blockers.
- Painel mostra Banco, GitHub, MSK IA e Runtime de tarefas.
- Blockers exibem ação de reconexão/retry.
- `background-direct-agent.js` roteia `preflight`/`health` para `msk-agent-preflight`.
- Todo `run` da extensão passa pelo `msk-agent-fast`, que agora funciona como gateway preventivo antes de encaminhar ao motor principal.
- O antigo fallback de HTTP 409 para `msk-agent-public` foi removido para não contornar blockers do pre-flight.
- Branch protegida força `direct_commit=false`, usando branch/PR.

## Backend correspondente
- `msk-agent-preflight` v1 ACTIVE.
- `msk-agent-fast` v6 ACTIVE com pre-flight server-side antes de cada `run`.
- `msk-agent` continua como executor final com locks, retries, erros estruturados, validação semântica e commit verificado.
- Não há Redis/BullMQ no runtime atual; o health informa `task_runtime` baseado nas tarefas do banco em vez de inventar um serviço inexistente.

## Integridade da build
- Versão: `3.4.61`
- Arquivos protegidos: `88`
- Integrity root: `67b9c96573d4f11e42935cc17a66a5c6790b7e0d361934d513c040e9f2f22c90`
- ZIP SHA-256: `eca00cf376cbe5514caebdafa898667a277fa6ce79ee4fb1f4dd2837e69c6c0f`
