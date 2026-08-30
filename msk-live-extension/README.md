# MSK Live 4.1 — integração de licença

Esta pasta registra a camada de proteção aplicada ao pacote MSK Live 4.0.0 fornecido pelo cliente.

## Contrato

- SaaS: `https://msksystem.online`
- Produto obrigatório: `msk-live`
- Validar: `/api/public/live/license/validate`
- Heartbeat: `/api/public/live/license/heartbeat`
- Painel do cliente: `/painel`
- Renovação/ofertas: `/planos?produto=msk-live`

## Comportamento obrigatório

1. `injector.js` e `content.js` não são content scripts declarativos. Eles só são injetados pelo service worker depois de uma validação positiva.
2. O TikTok recebe `license-guard.js` em `document_start`, mantendo a ferramenta bloqueada até a licença estar liberada.
3. O service worker revalida periodicamente a licença e injeta as ferramentas apenas quando o backend confirma produto, plano e oferta ativos.
4. Ao perder acesso, abas do TikTok são recarregadas para remover hooks já injetados e o Video Engine volta ao painel de licença.
5. `video-engine.js` funciona como gate e só carrega o motor original (`video-engine-core.js`) depois de uma nova validação.
6. A interface `start.html/start.js` do build 4.1 contém ativação por e-mail + licença, dashboard, validade/contagem regressiva, atualização de status, painel do SaaS e renovação.

O build instalável completo é gerado a partir do pacote original preservando `background.js`, `content.js`, `injector.js`, assets e motor de vídeo, com a camada de licença acima adicionada por cima.
