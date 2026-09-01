# MSK Agente v3.4.62 — Comando Exato + Pre-flight

Esta release remove o prompt reforçado da extensão e garante que a edição envie ao motor apenas o texto exato digitado pelo cliente.

## Comportamento
- `command`, `original_command` e `client_original_command` recebem a mesma frase original.
- Removidos do payload de edição: `reinforcedPrompt`, `reinforced_command`, histórico e treinamento/skill em texto.
- O card da extensão mostra a mensagem real do cliente, não um prompt técnico expandido.
- Todo `run` passa por `msk-agent-fast`, com pre-flight preventivo antes do executor.
- Regras de segurança, escopo, localização, validação, retries, locks e commit ficam no backend.
- No PromptBuilder do backend, o papel `user` contém exatamente a frase do cliente. Arquivos/candidatos/erros técnicos ficam em contexto separado.

## Backend ativo
- `msk-agent` v28 ACTIVE — arquitetura `minimal-exact-user-v2`.
- `msk-agent-preflight` v1 ACTIVE.
- `msk-agent-fast` v7 ACTIVE.

## Integridade
- Extensão: `3.4.62`
- Arquivos protegidos: `88`
- Integrity root: `1385a0d0f386305f34e781bf68e5e920d3b924678541929ad92a6c481487eeb0`
- ZIP SHA-256: `7bee15e764345af26b0ba872a25109a8f01b5e82ed205863f91f02c4f72d6341`
