# MSK Agente v3.4.63 — Pre-flight iOS Fix

Correções aplicadas sobre a v3.4.62:

- Corrigido `Failed to fetch` do pre-flight: o `manifest.json` agora autoriza explicitamente `https://iybjfmhqbblrppqoodyf.supabase.co/*` para o service worker.
- O painel `PRE-FLIGHT MSK` só é criado quando existe o popup operacional `#msk-root:not(.msk-gate-root) .msk-panel`.
- O pre-flight não aparece durante a tela/gate de licença e remove qualquer painel residual fora do mockup.
- Após a validação da extensão e criação do painel iOS, a checagem é disparada automaticamente.
- `chrome.runtime.lastError` agora é tratado de forma explícita no transporte do pre-flight.
- Mantido o fluxo: content script → `chrome.runtime` → service worker → `msk-agent-preflight`.
- Mantido o comando exato do cliente sem prompt gigante.

Build ZIP: `MSK-Agente-v3.4.63-PREFLIGHT-IOS-FIX.zip`

Integrity root: `23caf3e61a995a7e3a5f720b442f94c85c253e006fcee9bc86f0bb3d11fa96f9`

ZIP SHA-256: `4635c2ebb6596449e82b88b4fa712ae95d0fe64cb76488a9cc0b627c990f4240`
