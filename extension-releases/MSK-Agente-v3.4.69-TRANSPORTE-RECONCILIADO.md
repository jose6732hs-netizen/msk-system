# MSK Agente v3.4.69 — Transporte Reconciliado

Correção do falso `EXTENSION_TRANSPORT_ERROR` quando o backend conclui a edição/commit, mas a resposta HTTP final se perde ou excede a janela da extensão.

## Mudanças

- FAST_EDIT: timeout de transporte aumentado de 48s para 90s.
- Tarefas maiores: janela aumentada para 165s.
- Em qualquer erro de transporte após `run`, a extensão consulta `task-status` usando o mesmo `task_id` antes de mostrar falha.
- Se o estado persistido for `completed`, a UI exibe sucesso recuperado e encerra a etapa de validação.
- Se o estado persistido for `failed`, `awaiting_input` ou `awaiting_approval`, a UI mostra o estado real em vez do erro de transporte.
- Mantida a exigência de estado final autenticado; não há sucesso inventado quando a tarefa não existe ou ainda não chegou a estado terminal.

## Caso confirmado

A tarefa `82f14aea-d666-4e7f-b5d2-8f868161be1d` do `clean-license-manager` terminou como `completed` e o commit confirmado foi `67f5617547e4`, apesar de a extensão v3.4.68 ter mostrado `EXTENSION_TRANSPORT_ERROR`.

## Build

- Extensão: 3.4.69
- Arquivos protegidos: 88
- Integrity root: `bc880654319cd0ef6a2d46968ca34d128652adbe7361d17c323c11160aba66a1`
- ZIP SHA-256: `c3d8602796015e589d5bcf1b9d23fe6556b27468ecf2eab7776cd8cdd0ae5389`
