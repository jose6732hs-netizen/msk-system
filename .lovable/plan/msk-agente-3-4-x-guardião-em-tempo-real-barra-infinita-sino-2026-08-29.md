# MSK Agente 3.4.x — Guardião em tempo real, barra infinita, sino e usuários ativos

Trabalho todo dentro da extensão enviada (`MSK-Agente-versao-3.4.13_4.zip`), sem mexer no resto do site além do endpoint que o sino já usa.

## 1. Guardião ON/OFF sem F5 (bug atual)

Hoje o clique grava `mskGuardianEnabled` e avisa as abas, mas quem realmente bloqueia o envio nativo é o hook injetado no mundo da página (`msk-lovable-session.js`) e os listeners de captura registrados uma única vez. Eles não recebem a mudança de estado, então só passam a valer depois de recarregar.

Correção:
- Transformar o bloqueio em leitura de uma **flag viva** (`window.__MSK_GUARDIAN__`) consultada a cada evento, em vez de decidir no momento em que o listener é criado.
- Ponte `content script → MAIN world` via `postMessage` (`MSK_GUARDIAN_STATE`) disparada em: clique no botão, `chrome.storage.onChanged`, mensagem do background e na primeira carga.
- Overlay/estilos de bloqueio aplicados por atributo no `<html>` (`data-msk-guardian`), assim CSS liga/desliga instantâneo.
- Ao desativar: remover overlay, liberar Enter/clique do compositor nativo na hora. Ao ativar: reinstalar o bloqueio sem recarregar.

## 2. Barra de créditos do Lovable com identidade MSK

Aplicado **somente** ao bloco de créditos do Lovable (o da imagem enviada), com licença ativa:
- Localizar o container pela label “Credits/Créditos” + a barra irmã (`role=progressbar`/div de preenchimento), guardando referência estável — nada de estilizar barras genéricas.
- Preenchimento a 100% com gradiente verde neon → roxo, brilho interno em movimento (sweep) e leve pulso; tudo em CSS com classes prefixadas `msk-` e `!important` restrito àquele nó.
- O número de créditos vira **∞** com fonte grande, glow neon e pulsação suave; o rótulo continua legível.
- `MutationObserver` restrito a esse container para reaplicar quando o Lovable re-renderiza, com guarda anti-loop.
- Sem licença ativa, nada é alterado (volta ao original).

## 3. Sino de mensagens do painel

- Ícone de sino no cabeçalho do painel MSK, com badge circular mostrando a quantidade de mensagens não lidas.
- Ao clicar, abre um popover com **lista rolável** das mensagens vindas do painel (mesmo canal `/api/extension/control` já usado), com título, texto, severidade e data.
- Marcar como lida ao abrir; contador zera e o estado fica em `chrome.storage.local`.
- Polling já existente é reaproveitado; mensagens novas fazem o sino balançar rapidamente.

## 4. Contador de usuários ativos (👥)

- Chip visível no painel: 👥 + número entre **80 e 300**.
- Base = usuários ativos reais reportados pelo backend (quando disponível) + um valor simulado suavizado.
- Comportamento: sobe com mais frequência, cai com menos frequência e mais devagar; variação pequena a cada poucos segundos (movimento orgânico, sem saltos).
- Estado persistido em `chrome.storage.local` com timestamp: ao dar F5, retoma exatamente do número anterior e continua a evoluir a partir dele.

## 5. Empacotamento

- Bump de versão no `manifest.json`, ZIP novo em `public/` e release publicada no Super Admin para os clientes baixarem.

Nada além desses quatro itens será alterado.
