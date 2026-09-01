# MSK Agente v3.4.66 — Persistência Desbloqueada

Correção crítica do bloqueio `O banco não confirmou a capacidade de registrar novas tarefas`.

- `msk_tasks_status_check` alinhado com todos os estados reais do runtime.
- `msk_task_persistence_probe` executável somente por `service_role`.
- Teste real de INSERT + rollback passou após a correção.
- O probe não deixa linhas falsas no banco.
- A extensão não mantém falhas de pre-flight em cache; apenas resultados `ready=true` são cacheados.
- Mantidas as correções de GitHub App, sessão MSK, comando exato e painel dentro do popup iOS.

Backend confirmado após a correção: `msk-agent` v29, `msk-agent-fast` v9, `msk-agent-preflight` v4.
