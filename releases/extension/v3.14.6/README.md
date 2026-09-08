# MSK Agente v3.14.6 — Oficial

Build estável registrada no canal oficial do MSK System.

- **Build ID:** `msk-agent-3.14.6-official-integrity-selfheal-c2ecd43f83d9a6f9`
- **Integrity root:** `c2ecd43f83d9a6f93784481e3bed7f34f7088bf5582a9304e9da695760ca89d3`
- **Guardian manifest SHA-256:** `29714049ddcf7035382db64710da45984e619d5ac4a896d3188c271651f221de`
- **ZIP SHA-256:** `c8bdd94bd146c8ba2c9081412c9cda7bd829a8deb09e130ec1d3658affe652ce`

## Correções

- falso positivo de clone por mudança do `chrome.runtime.id` corrigido no gateway oficial;
- gateway valida `build_id`, versão e `integrity_root` antes de aceitar rotação do ID da extensão;
- expiração local agendada exatamente pelo `expires_at`, com retorno para a tela oficial de Key;
- fluxo legado de licença/trial local removido;
- FAST_EDIT v1.1 para substituições literais seguras de texto, botão e pares de URL;
- `preview_error` dispara uma tentativa automática de reparo cirúrgico e nova sincronização;
- mantém as rotas resilientes para prompts grandes e fallback de modelos já existentes.

O motor rápido evita alteração quando o alvo é ambíguo e entrega o caso ao agente completo em vez de modificar múltiplas ocorrências por engano.
