# MSK Agente v3.4.77 — Commit + Preview Garantido

Correções acumuladas sobre v3.4.76:
- topo alinhado e deduplicado;
- controles sem quebra/overflow;
- etapa visual não marca Finalizado apenas porque o banco retornou completed;
- commit passa por proof independente;
- proof mantém `verification_pending` até a extensão montar o card final;
- card final exige `Ver Commit` + `Atualizar Preview` no DOM;
- extensão envia `ui-ack` somente depois que o card e o botão de preview existem;
- somente após `ui-ack` o backend marca a tarefa como `completed`;
- compatibilidade preservada: versões antigas que não declaram `ui_ack_capable` continuam no fluxo legado e não ficam presas em `verification_pending`.

Backend: `msk-agent-proof` v5 ACTIVE.

ZIP SHA-256: e53427ce042c4b56250945f3d8e319222468a1b2ef3b997db3c1d128d8f77aaa
Integrity Root: e27d55fcc9a8f85bfccf1890257d19553425eba02f5bf58a65575226159ebb1e
