# MSK Agente v3.4.78 FINAL

Base: v3.4.77 preservada.

## Correções incluídas

- GitHub, Lovable, Supabase e Lovable Cloud preservados.
- Commit + prova + card final de preview preservados da v3.4.77.
- `Finalizado` continua condicionado à evidência de execução e card com `Ver Commit` + `Atualizar Preview`.
- Bolinhas Chat / GitHub / Supabase / Lovable Cloud em coluna vertical alinhada fora da lateral do mockup.
- Controle remoto em baixa latência para bloqueio/revogação/integridade e card de extensão bloqueada.
- Mensagens administrativas entregues no sino com badge e ACK.
- `AI_RATE_LIMIT`, timeout e indisponibilidade temporária passam por espera/retry usando a mesma `task_id`, com estado `queued_waiting_ai` e fila persistente.
- Supabase OAuth oficial mantido pelo `msk-database-connections`; quando o OAuth App do MSK não estiver configurado, permanece o fallback manual seguro.
- Lovable Cloud mantém vínculo automático do projeto Lovable atual sem inventar OAuth incompatível.

## Produção

- `msk-agent-fast` v10 ACTIVE.
- `msk-agent-public` v14 ACTIVE.
- Migration `msk_ai_resilience_v3478` aplicada.

## Pacote

- Versão: 3.4.78
- Arquivos protegidos: 97
- JavaScript validado por `node --check`: 35 arquivos
- Integrity root: `c6daf747c38cd6c770c618c5a28de15bce41ba4e66c028602a2ee401c525450f`
- ZIP SHA-256: `32b5e23dca5aa4ceee86dbb4f4cbd282f3e443f89732579d3a77b894f957ea20`

Validação desta release: sintaxe JavaScript, hashes individuais, integrity root e `unzip -t`. Não representa teste end-to-end em um Chrome real.