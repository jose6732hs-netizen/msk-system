# MSK Agente v3.4.60 — Prompt mínimo

Release de teste da extensão para o motor MSK Agent v27.

## Backend

- Novo `PromptBuilder` especializado por operação: interpretação, planejamento, edição, self-healing, validação e chat.
- Chamadas novas de edição usam `system` curto e `user` contendo apenas comando e contexto estritamente necessário.
- O treinamento global/prompt legado não é injetado no novo pipeline de edição.
- FAST_EDIT mantém caminho curto e limite de escopo no backend.
- Tarefas complexas recebem planejamento separado apenas quando necessário.
- Localização por IA recebe shortlist ranqueada de até 80 caminhos; a árvore completa permanece somente no backend para fallback.
- Validação de schema, diff, lock, retry, segurança, verificação semântica e verificação de commit continuam fora do prompt.

## Runtime

- Supabase Edge Function `msk-agent`: versão 27 ACTIVE.
- Arquitetura publicada: `minimal-v1`.
- Compatível com erros estruturados, `error_id`, locks e commit verification da v3.4.59.

## Extensão

- Manifest: 3.4.60.
- JavaScript funcional da 3.4.59 preservado; a mudança de prompts é server-side.
- Manifesto de integridade recalculado para 86 arquivos protegidos.
- Root de integridade da build: `c00ba09bd0a556da864576c32bd5681be288458418217795d4c32e87d54a963e`.
- SHA-256 do ZIP de teste: `6dec0d64e6003516ba92006156cd894f971c3033613c8e7eb680f7b826898971`.
