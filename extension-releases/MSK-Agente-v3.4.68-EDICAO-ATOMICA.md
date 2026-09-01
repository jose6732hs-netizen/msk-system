# MSK Agente v3.4.68 — Edição Atômica

ZIP: `MSK-Agente-v3.4.68-EDICAO-ATOMICA.zip`
SHA-256: `7563591cecffaadf6a48d447f60b497ee1a5ced3c97232167f12661aa2715b5d`
Integridade: `923cec2e3016a1feb74a57188e33e53871a3a3d6ae4fe49a5e547768837274b5`
Arquivos protegidos: 88

## Correção de NO_CHANGES_APPLIED

- Motor `msk-agent` v30 / `3.3.4-atomic-edits` ativo no Supabase.
- Pedidos exclusivamente visuais não viram alto risco apenas porque o texto-alvo contém palavras como `Pix`.
- Tolera erros ortográficos simples de intenção visual, incluindo `texti` e `asul`.
- Para mudanças pequenas, a IA pode retornar `{ path, find, replace }` em vez do arquivo inteiro.
- O backend só aceita `find` exato e com ocorrência única, aplica a substituição ao conteúdo completo, valida semanticamente e só então permite commit.
- O campo `user` enviado à IA continua contendo exatamente o comando digitado pelo cliente.
- Pre-flight permanece schema-only, sem INSERT temporário.

## Caso que originou a correção

O alvo `Libere seu acesso com Pix confirmado automaticamente` existe em `clean-license-manager/src/routes/index.tsx`; a tarefa anterior falhou porque a resposta da IA não se convertia em `changes` válidas após três tentativas. A arquitetura atômica elimina a exigência de a IA reemitir o arquivo inteiro para uma simples troca visual.
