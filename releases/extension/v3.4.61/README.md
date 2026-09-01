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
- Em branch protegida, a extensão envia `direct_commit=false`; o gateway rejeita push direto em vez de alterar o corpo assinado, preservando a proteção anti-tamper.

## Backend correspondente
- `msk-agent-preflight` v1 ACTIVE.
- `msk-agent-fast` v7 ACTIVE com pre-flight server-side antes de cada `run`.
- `msk-agent` continua como executor final com locks, retries, erros estruturados, validação semântica e commit verificado.
- Não há Redis/BullMQ no runtime atual; o health informa `task_runtime` baseado nas tarefas do banco em vez de inventar um serviço inexistente.

## Integridade da build
- Versão: `3.4.61`
- Arquivos protegidos: `88`
- Integrity root: `e636939a7138dfe24a3a02b443a96add555e02e12bda0140e7679dd21d49057f`
- ZIP SHA-256: `e343dec29cb1c39e265bed3d49e4368c4a854d1931a0fafea32035edea3478cb`
