# MSK Agente v3.4.77 — Commit + Preview Garantido

Correções acumuladas sobre v3.4.76:
- topo alinhado e deduplicado;
- controles sem quebra/overflow;
- etapa visual não marca Finalizado apenas porque o banco retornou completed;
- commit passa por proof independente;
- proof mantém verification_pending até a extensão montar o card final;
- card final exige `Ver Commit` + `Atualizar Preview` no DOM;
- extensão envia `ui-ack` somente depois que o card e o botão de preview existem;
- somente após `ui-ack` o backend marca a tarefa como completed.

Backend: `msk-agent-proof` v4 ACTIVE.

ZIP SHA-256: ff9ef29ef591166b8a2c06cf736f5880fb4a79f059b374b6a7d2a41613d411dc
Integrity Root: e1f6cc869ff5a8ab6eb42016686f874bd52819cc1a8a9c10d15e2dcb58b3b3c9
