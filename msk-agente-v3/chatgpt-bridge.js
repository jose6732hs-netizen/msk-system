(() => {
  if (window.__MSK_CHATGPT_BRIDGE__) return;
  window.__MSK_CHATGPT_BRIDGE__ = true;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitForDocument = async (timeout=30000) => {
    const limit = Date.now() + timeout;
    while (Date.now() < limit) {
      if (document.documentElement && document.body) return true;
      await sleep(50);
    }
    return !!document.documentElement;
  };
  let activeProjectId = "";
  let activeOriginTabId = null;
  let sending = false;
  const queue = [];
  const approvalRegistry = new Map();
  let lastApprovalSignature = "";
  let lastApprovalAt = 0;
  let lastLimitSignature = "";
  let lastLimitAt = 0;
  let lastDiagnosticSignature = "";
  let lastDiagnosticAt = 0;

  const visible = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  // Em aba inativa o Chrome pode não produzir retângulos de layout de forma
  // consistente, embora o elemento esteja montado e utilizável. Aceita nesses
  // casos elementos conectados que não estejam ocultos por CSS.
  const usableInBackground = el => {
    if (!el) return false;
    if (visible(el)) return true;
    if (!document.hidden || !el.isConnected) return false;
    try {
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    } catch {
      return true;
    }
  };
  const composer = () => {
    const candidates = [
      document.querySelector('#prompt-textarea'),
      document.querySelector('textarea[placeholder]'),
      ...document.querySelectorAll('[contenteditable="true"][role="textbox"], div[contenteditable="true"]')
    ].filter(Boolean);
    return candidates.find(usableInBackground) || candidates[0] || null;
  };
  const sendButton = () => {
    const candidates = [
      document.querySelector('button[data-testid="send-button"]'),
      ...document.querySelectorAll('button')
    ].filter(Boolean);
    return candidates.find(el => usableInBackground(el) && el.getAttribute('data-testid') === 'send-button')
      || candidates.find(el => usableInBackground(el) && /send|enviar/i.test(`${el.getAttribute('aria-label')||''} ${el.title||''}`))
      || null;
  };
  const stopButtonVisible = () => [...document.querySelectorAll('button')].some(el => usableInBackground(el) && /stop|parar/i.test(`${el.getAttribute('aria-label')||''} ${el.innerText||''}`));
  const assistantNodes = () => [...document.querySelectorAll('[data-message-author-role="assistant"]')].filter(usableInBackground);
  const userNodes = () => [...document.querySelectorAll('[data-message-author-role="user"]')].filter(usableInBackground);
  const normalizedPrompt = value => String(value || '').replace(/\s+/g,' ').trim();
  const integrationMarkerStart = /<MSK_INTEGRATION_REQUEST>/i;
  const integrationMarkerFull = /<MSK_INTEGRATION_REQUEST>([\s\S]*?)<\/MSK_INTEGRATION_REQUEST>/i;
  const integrationRequestSignatures = new Set();
  const assistantRawText = node => {
    if (!node) return '';
    return [...node.childNodes]
      .filter(child => !(child instanceof Element && child.classList.contains('msk-integration-answer-card')))
      .map(child => child.textContent || '')
      .join('')
      .trim();
  };
  const renderIntegrationAnswerCard = (node, rawText) => {
    const raw = String(rawText || '');
    if (!node || !integrationMarkerStart.test(raw)) return false;
    const assistantRoot = node.closest?.('[data-message-author-role="assistant"]') || node;
    ensureMskSentCardStyle();
    node = assistantRoot;
    node.classList.add('msk-integration-answer');
    let visual = node.querySelector(':scope > .msk-integration-answer-card');
    if (!visual) { visual=document.createElement('section'); visual.className='msk-integration-answer-card'; node.appendChild(visual); }
    const full = raw.match(integrationMarkerFull);
    const clean = raw.replace(integrationMarkerFull,'').replace(/<MSK_INTEGRATION_REQUEST>[\s\S]*$/i,'').trim();
    let data = null;
    if (full) { try { data=JSON.parse(full[1].trim()); } catch {} }
    const fields = Array.isArray(data?.fields) ? data.fields.slice(0,12).map(field => String(field?.label || field?.key || 'Campo').replace(/\s+/g,' ').trim()).filter(Boolean) : [];
    if (data && Array.isArray(data.fields) && data.fields.length) { const signature=JSON.stringify(data); if(!integrationRequestSignatures.has(signature)){ integrationRequestSignatures.add(signature); chrome.runtime.sendMessage({type:'MSK_CHATGPT_INTEGRATION_REQUEST',payload:{projectId:activeProjectId,originTabId:activeOriginTabId,request:data}}).catch(()=>{}); } }
    const title = String(data?.title || (data?.service ? `Credenciais para ${data.service}` : 'Credenciais solicitadas'));
    visual.innerHTML='';
    const head=document.createElement('div'); head.className='msk-integration-answer-card__head';
    const icon=document.createElement('div'); icon.className='msk-integration-answer-card__icon'; icon.textContent='🔐';
    const copy=document.createElement('div'); const strong=document.createElement('strong'); strong.textContent=title; const tag=document.createElement('span'); tag.textContent='Cofre MSK'; copy.append(strong,tag); head.append(icon,copy); visual.append(head);
    if (clean) { const note=document.createElement('div'); note.className='msk-integration-answer-card__note'; note.textContent=clean; visual.append(note); }
    const list=document.createElement('div'); list.className='msk-integration-answer-card__fields';
    (fields.length ? fields : ['Preparando campos protegidos…']).forEach(label => { const chip=document.createElement('span'); chip.textContent=label; list.append(chip); });
    visual.append(list);
    const foot=document.createElement('div'); foot.className='msk-integration-answer-card__foot'; foot.textContent='Preencha as credenciais somente no pop-up da extensão MSK. Nenhum valor secreto é exibido nesta conversa.'; visual.append(foot);
    return true;
  };

  // Fallback independente do ciclo de envio: captura o marcador mesmo se o
  // ChatGPT terminar de renderizar a resposta depois do watcher principal.
  const scanIntegrationMarkers = () => {
    const candidates = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    for (const root of candidates) {
      const text = String(root.innerText || root.textContent || '');
      if (!integrationMarkerStart.test(text)) continue;
      renderIntegrationAnswerCard(root, text);
    }
  };


  // Card visual das mensagens enviadas pela extensão MSK dentro do ChatGPT.
  // O conteúdo original continua no DOM para não interferir no React, mas fica
  // visualmente substituído por um card compacto e expansível.
  const MSK_SENT_STYLE_ID = 'msk-chatgpt-sent-card-style';
  const MSK_SENT_STORAGE_KEY = 'mskChatgptSentPromptsV1';
  const sentPromptCache = new Map();
  let sentObserver = null;
  let sentRestoreScheduled = false;

  const mskPromptHash = value => {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };

  const ensureMskSentCardStyle = () => {
    if (document.getElementById(MSK_SENT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MSK_SENT_STYLE_ID;
    style.textContent = `
      @property --msk-edge-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
      [data-message-author-role="user"].msk-sent-message > .msk-sent-original { display: none !important; }
      [data-message-author-role="user"].msk-sent-message { background: transparent !important; }
      .msk-sent-card {
        --msk-edge-angle: 0deg;
        position: relative; isolation: isolate; display: block; width: fit-content;
        min-width: 210px; max-width: min(560px, 84vw); margin-left: auto;
        border-radius: 18px; color: #f7f7f8; background: transparent;
        box-shadow: 0 10px 30px rgba(0,0,0,.16); overflow: visible;
      }
      .msk-sent-card::before, .msk-sent-card::after {
        content: ''; position: absolute; pointer-events: none; border-radius: 19px;
        background: conic-gradient(from var(--msk-edge-angle),
          rgba(97,255,104,.12) 0deg, rgba(97,255,104,.88) 55deg,
          rgba(255,88,198,.78) 145deg, rgba(156,92,255,.82) 235deg,
          rgba(97,255,104,.12) 360deg);
        animation: msk-edge-orbit 8.5s linear infinite;
      }
      .msk-sent-card::before {
        inset: -1px; padding: 1px; z-index: -1;
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
        opacity: .78;
      }
      .msk-sent-card::after {
        inset: -4px; padding: 3px; z-index: -2; opacity: .16; filter: blur(8px);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
      }
      .msk-sent-card__surface {
        position: relative; z-index: 1; overflow: hidden; border-radius: 18px;
        background: rgba(18,19,22,.97); border: 1px solid rgba(255,255,255,.055);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      }
      .msk-sent-card__head {
        width: 100%; border: 0; background: transparent; color: inherit; cursor: pointer;
        display: flex; align-items: center; gap: 10px; padding: 10px 12px; text-align: left;
        font: inherit;
      }
      .msk-sent-card__logo {
        width: 25px; height: 25px; object-fit: contain; flex: 0 0 25px;
        filter: drop-shadow(0 0 7px rgba(129,255,126,.16));
      }
      .msk-sent-card__copy { min-width: 0; flex: 1; display: grid; gap: 1px; }
      .msk-sent-card__title { font-size: 13px; font-weight: 700; line-height: 1.25; letter-spacing: .01em; }
      .msk-sent-card__hint { font-size: 10.5px; line-height: 1.2; color: rgba(255,255,255,.48); }
      .msk-sent-card__chevron {
        width: 16px; height: 16px; flex: 0 0 16px; opacity: .55; transition: transform .28s ease, opacity .28s ease;
      }
      .msk-sent-card.is-open .msk-sent-card__chevron { transform: rotate(180deg); opacity: .8; }
      .msk-sent-card__details {
        max-height: 0; opacity: 0; overflow: hidden; padding: 0 12px;
        border-top: 1px solid transparent; transition: max-height .34s ease, opacity .24s ease, padding .34s ease, border-color .34s ease;
        white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.5; color: rgba(255,255,255,.76);
      }
      .msk-sent-card.is-open .msk-sent-card__details {
        max-height: min(42vh, 420px); opacity: 1; overflow: auto; padding: 10px 12px 12px;
        border-top-color: rgba(255,255,255,.065);
      }
      @keyframes msk-edge-orbit { to { --msk-edge-angle: 360deg; } }
      .msk-integration-answer > :not(.msk-integration-answer-card) { display:none !important; }
      .msk-integration-answer-card { max-width:620px; margin:10px 0; border:1px solid rgba(62,255,145,.28); border-radius:16px; padding:14px; background:linear-gradient(145deg,rgba(10,24,17,.96),rgba(14,14,22,.97)); box-shadow:0 12px 34px rgba(0,0,0,.2),0 0 24px rgba(59,255,128,.07); color:var(--text-primary,#f7f7f8); }
      .msk-integration-answer-card__head { display:flex;align-items:center;gap:10px;margin-bottom:8px; }
      .msk-integration-answer-card__icon { width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(57,255,139,.11);border:1px solid rgba(57,255,139,.25);font-size:18px; }
      .msk-integration-answer-card__head div { display:grid;gap:1px; }
      .msk-integration-answer-card__head strong { font-size:13px; }
      .msk-integration-answer-card__head span { font-size:10px;color:#78f7ad;font-weight:700;letter-spacing:.04em;text-transform:uppercase; }
      .msk-integration-answer-card__note { margin:8px 0 10px;font-size:12px;line-height:1.45;color:rgba(255,255,255,.72);white-space:pre-wrap; }
      .msk-integration-answer-card__fields { display:flex;flex-wrap:wrap;gap:6px; }
      .msk-integration-answer-card__fields span { padding:6px 8px;border-radius:999px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);font-size:10px; }
      .msk-integration-answer-card__foot { margin-top:10px;font-size:10px;color:rgba(255,255,255,.52); }
      @media (prefers-reduced-motion: reduce) {
        .msk-sent-card::before, .msk-sent-card::after { animation: none !important; --msk-edge-angle: 80deg; }
        .msk-sent-card__chevron, .msk-sent-card__details { transition: none !important; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const sentNodePromptText = node => {
    const key = String(node?.dataset?.mskPromptKey || '');
    const cached = key ? sentPromptCache.get(key) : null;
    return cached?.fullText || String(node?.innerText || '');
  };

  const rememberMskSentPrompt = async (fullText, displayText, projectId='') => {
    const cleanFull = String(fullText || '').trim();
    if (!cleanFull) return null;
    const key = `p-${mskPromptHash(normalizedPrompt(cleanFull))}`;
    const record = {
      key, fullText: cleanFull, displayText: String(displayText || cleanFull).trim(),
      projectId: String(projectId || ''), createdAt: Date.now()
    };
    sentPromptCache.set(key, record);
    try {
      const stored = await chrome.storage.local.get(MSK_SENT_STORAGE_KEY);
      const list = Array.isArray(stored?.[MSK_SENT_STORAGE_KEY]) ? stored[MSK_SENT_STORAGE_KEY] : [];
      const next = [record, ...list.filter(item => item?.key !== key)].slice(0, 30);
      await chrome.storage.local.set({ [MSK_SENT_STORAGE_KEY]: next });
    } catch {}
    return record;
  };

  const decorateMskSentNode = (node, record) => {
    if (!node || !record) return false;
    ensureMskSentCardStyle();
    node.classList.add('msk-sent-message');
    node.dataset.mskPromptKey = record.key;
    [...node.children].forEach(child => {
      if (!child.classList.contains('msk-sent-card')) child.classList.add('msk-sent-original');
    });
    let card = [...node.children].find(child => child.classList?.contains('msk-sent-card'));
    if (!card) {
      card = document.createElement('section');
      card.className = 'msk-sent-card';
      card.setAttribute('data-msk-sent-card', '1');
      const surface = document.createElement('div');
      surface.className = 'msk-sent-card__surface';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'msk-sent-card__head';
      head.setAttribute('aria-expanded', 'false');
      const logo = document.createElement('img');
      logo.className = 'msk-sent-card__logo';
      logo.alt = 'MSK';
      logo.src = chrome.runtime.getURL('assets/msk-agente-logo.png');
      const copy = document.createElement('span');
      copy.className = 'msk-sent-card__copy';
      const title = document.createElement('span');
      title.className = 'msk-sent-card__title';
      title.textContent = 'Enviado por MSK';
      const hint = document.createElement('span');
      hint.className = 'msk-sent-card__hint';
      hint.textContent = 'Clique para ver o comando';
      copy.append(title, hint);
      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('viewBox', '0 0 24 24');
      chevron.setAttribute('fill', 'none');
      chevron.setAttribute('stroke', 'currentColor');
      chevron.setAttribute('stroke-width', '2');
      chevron.classList.add('msk-sent-card__chevron');
      chevron.innerHTML = '<path d="m6 9 6 6 6-6"/>';
      const details = document.createElement('div');
      details.className = 'msk-sent-card__details';
      details.textContent = record.displayText || record.fullText;
      head.append(logo, copy, chevron);
      head.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const open = card.classList.toggle('is-open');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      surface.append(head, details);
      card.appendChild(surface);
      node.appendChild(card);
    } else {
      const details = card.querySelector('.msk-sent-card__details');
      if (details && details.textContent !== (record.displayText || record.fullText)) details.textContent = record.displayText || record.fullText;
    }
    return true;
  };

  const restoreMskSentCards = () => {
    if (!sentPromptCache.size) return;
    const records = [...sentPromptCache.values()];
    for (const node of userNodes()) {
      const existingKey = String(node?.dataset?.mskPromptKey || '');
      if (existingKey && sentPromptCache.has(existingKey)) {
        decorateMskSentNode(node, sentPromptCache.get(existingKey));
        continue;
      }
      const raw = normalizedPrompt(String(node?.innerText || ''));
      if (!raw) continue;
      const record = records.find(item => normalizedPrompt(item.fullText) === raw);
      if (record) decorateMskSentNode(node, record);
    }
  };

  const scheduleMskSentRestore = () => {
    if (sentRestoreScheduled) return;
    sentRestoreScheduled = true;
    setTimeout(() => { sentRestoreScheduled = false; restoreMskSentCards(); }, 90);
  };

  const initializeMskSentCards = async () => {
    await waitForDocument(30000);
    ensureMskSentCardStyle();
    try {
      const stored = await chrome.storage.local.get(MSK_SENT_STORAGE_KEY);
      const list = Array.isArray(stored?.[MSK_SENT_STORAGE_KEY]) ? stored[MSK_SENT_STORAGE_KEY] : [];
      for (const item of list) if (item?.key && item?.fullText) sentPromptCache.set(item.key, item);
    } catch {}
    restoreMskSentCards();
    if (!sentObserver && document.documentElement) {
      sentObserver = new MutationObserver(scheduleMskSentRestore);
      sentObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  };

  const composerText = el => {
    if (!el) return '';
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return String(el.value || '');
    return String(el.innerText || el.textContent || '');
  };
  const latestUserText = () => normalizedPrompt(sentNodePromptText(userNodes().at(-1)));

  const cleanLabel = el => String(el?.innerText || el?.getAttribute?.('aria-label') || el?.title || '').replace(/\s+/g, ' ').trim();
  const APPROVAL_UI_EXCLUDE = 'nav,aside,[data-testid*="sidebar" i],[aria-label*="sidebar" i],[data-testid*="history" i],[aria-label*="history" i]';
  const strongApprovalLabel = text => /(allow|permit|authorize|confirm|continue|connect|approve|run|enable|accept|yes|deny|cancel|reject|not now|always|once|permitir|autorizar|confirmar|continuar|conectar|aprovar|executar|ativar|aceitar|sim|negar|cancelar|rejeitar|agora não|uma vez|sempre)/i.test(text);
  const approvalButton = el => {
    if (!usableInBackground(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.closest?.(APPROVAL_UI_EXCLUDE)) return false;
    const text = cleanLabel(el);
    if (!text || text.length > 90) return false;
    if (/send|enviar|stop|parar|copy|copiar|share|compartilhar|regenerate|tentar novamente|voice|voz|microfone|sidebar|barra lateral|menu|profile|perfil|history|histórico|library|biblioteca|new chat|novo chat|conversation options|opções de conversa|pin|fixar/i.test(text)) return false;
    // "Abrir/Open" sozinho é navegação da interface e nunca deve virar permissão.
    if (/^(open|abrir)\b/i.test(text)) return false;
    return strongApprovalLabel(text);
  };
  const approvalContainers = () => {
    const explicit = [...document.querySelectorAll('[role="dialog"], [data-radix-dialog-content], [data-testid*="permission" i], [data-testid*="approval" i], [data-testid*="confirm" i]')]
      .filter(el => usableInBackground(el) && !el.closest?.(APPROVAL_UI_EXCLUDE));
    const latest = assistantNodes().at(-1);
    if (latest && !latest.closest?.(APPROVAL_UI_EXCLUDE)) explicit.push(latest);
    return [...new Set(explicit)];
  };
  const clearApprovalRegistry = (reason='resolved') => {
    if (!approvalRegistry.size) return;
    const requestIds = [...approvalRegistry.keys()];
    approvalRegistry.clear();
    lastApprovalSignature = '';
    emit('MSK_CHATGPT_APPROVAL_CLEAR', { requestIds, reason, url:location.href });
  };
  let suppressApprovalUntil = 0;
  const detectApproval = () => {
    if (Date.now() < suppressApprovalUntil) return false;
    for (const container of approvalContainers()) {
      const buttons = [...container.querySelectorAll('button,[role="button"]')].filter(approvalButton);
      if (!buttons.length) continue;
      const labels = buttons.map(cleanLabel).filter(Boolean).slice(0, 6);
      const context = String(container.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      const isDialog = container.getAttribute?.('role') === 'dialog' || container.matches?.('[data-radix-dialog-content]');
      const permissionContext = /(permission required|requires? (?:your )?(?:permission|approval|confirmation)|needs? (?:your )?(?:permission|approval|confirmation)|allow this|authorize this|confirm (?:this|to continue)|permissão necessária|requer (?:sua )?(?:permissão|aprovação|confirmação)|precisa (?:da sua )?(?:permissão|aprovação|confirmação)|autorize|confirme para continuar)/i.test(context);
      const hasDecisionPair = labels.some(label => /(allow|authorize|confirm|continue|approve|accept|yes|permitir|autorizar|confirmar|continuar|aprovar|aceitar|sim)/i.test(label))
        && labels.some(label => /(deny|cancel|reject|not now|no|negar|cancelar|rejeitar|agora não|não)/i.test(label));
      // Um menu comum do ChatGPT nunca deve ser interpretado como aprovação.
      if (!permissionContext && !hasDecisionPair && !(isDialog && labels.some(strongApprovalLabel) && context.length < 420)) continue;
      const signature = `${location.pathname}|${context}|${labels.join('|')}`;
      if (signature === lastApprovalSignature && Date.now() - lastApprovalAt < 15000) return true;
      const requestId = `msk-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const choices = buttons.slice(0, 6).map((button, index) => ({ choiceId:`${requestId}:${index}`, label:cleanLabel(button) || `Opção ${index + 1}` }));
      approvalRegistry.clear();
      approvalRegistry.set(requestId, { buttons:buttons.slice(0, 6), createdAt:Date.now() });
      lastApprovalSignature = signature; lastApprovalAt = Date.now();
      emit('MSK_CHATGPT_APPROVAL', { requestId, title:'Permissão necessária', description:context || 'O ChatGPT precisa da sua confirmação para continuar esta ação.', choices, url:location.href });
      return true;
    }
    clearApprovalRegistry('not-visible');
    return false;
  };

  const limitNoticeCandidates = () => {
    const selectors = [
      '[role="alert"]', '[role="dialog"]', '[data-testid*="toast" i]',
      '[class*="toast" i]', '[class*="notice" i]', '[class*="banner" i]'
    ];
    const nodes = selectors.flatMap(selector => [...document.querySelectorAll(selector)]).filter(usableInBackground);
    const latestAssistant = assistantNodes().at(-1);
    if (latestAssistant) nodes.push(latestAssistant);
    return [...new Set(nodes)];
  };
  const detectLimitState = () => {
    const conversationPattern = /(maximum (?:length|messages?).{0,60}(?:conversation|chat)|conversation.{0,50}(?:too long|maximum length|limit).{0,80}(?:new chat|new conversation)|start (?:a )?new (?:chat|conversation).{0,80}(?:continue|conversation)|conversa.{0,60}(?:muito longa|comprimento máximo|limite).{0,80}(?:nova conversa|novo chat)|inicie (?:uma )?nova conversa.{0,80}continu)/i;
    const usagePattern = /(free plan limit|usage limit|you(?:'|’)ve reached.{0,40}(?:plan|usage|message) limit|limit resets|try again (?:after|later)|limite (?:do plano|de uso|de mensagens)|atingiu.{0,40}limite.{0,40}(?:plano|uso)|limite.{0,60}(?:redefine|renova|restaura))/i;
    for (const node of limitNoticeCandidates()) {
      const text = String(node?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1400);
      if (!text) continue;
      const kind = conversationPattern.test(text) ? 'conversation_length' : usagePattern.test(text) ? 'account_usage' : '';
      if (!kind) continue;
      const signature = `${kind}|${text.slice(0, 400)}`;
      if (signature === lastLimitSignature && Date.now() - lastLimitAt < 30000) return kind;
      lastLimitSignature = signature; lastLimitAt = Date.now();
      const message = kind === 'conversation_length'
        ? 'Esta conversa atingiu o limite. Você pode criar uma nova conversa e continuar do ponto em que parou.'
        : 'O limite de uso da conta do ChatGPT foi atingido. Uma nova conversa não remove esse limite; aguarde a liberação indicada pela sua conta.';
      emit('MSK_CHATGPT_LIMIT', { kind, message, sourceText:text, url:location.href });
      emitDiagnostic({
        category: kind === 'conversation_length' ? 'chatgpt_conversation_length' : 'chatgpt_account_usage',
        title: kind === 'conversation_length' ? 'Limite desta conversa' : 'Limite real da conta ChatGPT',
        source:'chatgpt-ui', sourceLabel:'Interface do ChatGPT', severity:'error',
        message, evidence:text.slice(0,700),
        action: kind === 'conversation_length'
          ? 'Use “Criar nova conversa e continuar” para recuperar o contexto.'
          : 'Aguarde a liberação indicada pela própria conta; abrir outro chat não remove esse limite.'
      });
      return kind;
    }
    return '';
  };


  const runtimeRequest = (message, timeout=30000) => new Promise(resolve => {
    let done=false;
    const timer=setTimeout(() => { if(done) return; done=true; resolve({ok:false,error:"A operação de arquivo demorou demais."}); }, timeout);
    chrome.runtime.sendMessage(message, response => { if(done) return; done=true; clearTimeout(timer); resolve(response || {ok:false,error:chrome.runtime.lastError?.message || "Sem resposta da extensão."}); });
  });
  const base64ToBytes = data => {
    const binary=atob(String(data || "")); const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i); return bytes;
  };
  const fileInput = () => [...document.querySelectorAll('input[type="file"]')].find(el => !el.disabled) || null;
  const attachmentTrigger = () => [...document.querySelectorAll('button,[role="button"]')].find(el => {
    if(!visible(el)) return false;
    const label=`${el.getAttribute?.('aria-label')||''} ${el.title||''} ${el.innerText||''}`.replace(/\s+/g,' ').trim();
    return /(attach|upload|add (?:photos|files)|photos? & files|anexar|carregar|adicionar (?:foto|arquivo)|arquivos)/i.test(label) && !/send|enviar/i.test(label);
  }) || null;
  const ensureFileInput = async () => {
    let input=fileInput(); if(input) return input;
    const trigger=attachmentTrigger(); if(trigger) { try { trigger.click(); } catch {} }
    const limit=Date.now()+7000;
    while(!input && Date.now()<limit) { await sleep(200); input=fileInput(); }
    return input;
  };
  const stagedFile = async descriptor => {
    const uploadId=String(descriptor?.uploadId || '');
    const metaResult=await runtimeRequest({type:'MSK_FILE_STAGE_GET_META',payload:{uploadId}},15000);
    if(!metaResult?.ok || !metaResult.meta) throw new Error(metaResult?.error || `Anexo ${descriptor?.name || ''} não encontrado.`);
    const meta=metaResult.meta; const parts=[];
    for(let index=0;index<Number(meta.chunks || 0);index++) {
      const chunk=await runtimeRequest({type:'MSK_FILE_STAGE_GET_CHUNK',payload:{uploadId,index}},30000);
      if(!chunk?.ok) throw new Error(chunk?.error || `Falha ao ler ${meta.name}.`);
      parts.push(base64ToBytes(chunk.data));
    }
    return { file:new File(parts,meta.name,{type:meta.type || 'application/octet-stream',lastModified:Number(meta.lastModified || Date.now())}), uploadId };
  };
  const attachmentVisible = name => {
    const safe=String(name || '').trim(); if(!safe) return false;
    return [...document.querySelectorAll('[data-testid],button,div,span')].some(el => visible(el) && String(el.innerText || '').includes(safe));
  };
  const attachFiles = async descriptors => {
    const list=Array.isArray(descriptors) ? descriptors.filter(x => x?.uploadId) : [];
    if(!list.length) return [];
    const attached=[];
    for(const descriptor of list) {
      emit('MSK_CHATGPT_STATUS',{status:'uploading',file:descriptor.name || 'arquivo',url:location.href});
      const {file,uploadId}=await stagedFile(descriptor);
      const input=await ensureFileInput();
      if(!input) throw new Error('O campo de anexos do ChatGPT não foi encontrado. Abra a conversa e tente novamente.');
      const dt=new DataTransfer(); dt.items.add(file);
      try { input.files=dt.files; } catch {
        const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files')?.set;
        setter?.call(input,dt.files);
      }
      input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
      // Não espera o upload visual do ChatGPT terminar. Assim como no composer nativo,
      // o MSK já prepara texto + clique de envio enquanto o anexo continua carregando.
      // Uma confirmação curta evita apenas a corrida do DOM logo após o change.
      const attachUiLimit=Date.now()+1200;
      while(Date.now()<attachUiLimit && !attachmentVisible(file.name)) await sleep(60);
      attached.push(file.name);
      await runtimeRequest({type:'MSK_FILE_STAGE_DISCARD',payload:{uploadId}},12000);
      await sleep(40);
    }
    return attached;
  };

  const setComposerText = async text => {
    const limit = Date.now() + 30000;
    let el = composer();
    while (!el && Date.now() < limit) { await sleep(300); el = composer(); }
    if (!el) throw new Error('Campo de mensagem do ChatGPT não encontrado.');
    try { el.focus({ preventScroll:true }); } catch { try { el.focus(); } catch {} }
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter ? setter.call(el, text) : (el.value = text);
      el.dispatchEvent(new Event('input', { bubbles:true }));
      el.dispatchEvent(new Event('change', { bubbles:true }));
    } else {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel?.removeAllRanges(); sel?.addRange(range);
      document.execCommand('insertText', false, text);
      if (!(el.innerText || '').trim()) el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:text }));
    }
    // requestAnimationFrame pode ficar suspenso em abas de segundo plano.
    // O MSK precisa despachar mesmo quando o usuário continua no Lovable, então
    // a sincronização do composer usa timer/microtask e nunca depende da aba visível.
    await Promise.resolve();
    await sleep(90);
    return el;
  };

  const emit = (type, payload={}) => chrome.runtime.sendMessage({ type, payload: { projectId: activeProjectId, originTabId: activeOriginTabId, ...payload } }).catch?.(()=>{});

  // Espelha somente estados VISÍVEIS da interface do ChatGPT. Nunca tenta ler
  // raciocínio interno oculto: apenas textos que o próprio ChatGPT renderiza.
  let lastVisiblePhaseSignature = "";
  let lastVisiblePhaseAt = 0;
  let phaseScanTimer = 0;
  const phasePatterns = [
    { key:"applying", label:"Aplicando…", priority:60, re:/\b(aplicando|applying|editando|editing|alterando|updating|atualizando|writing|escrevendo)\b/i },
    { key:"validating", label:"Verificando…", priority:50, re:/\b(verificando|validando|checando|checking|validating|reviewing|revisando)\b/i },
    { key:"locating", label:"Localizando…", priority:40, re:/\b(localizando|procurando|buscando|pesquisando|locating|searching|looking for)\b/i },
    { key:"reading", label:"Abrindo arquivo…", priority:30, re:/\b(lendo|abrindo|reading|opening)\b.{0,24}\b(arquivo|file|c[oó]digo|code)\b/i },
    { key:"thinking", label:"Pensando…", priority:20, re:/\b(pensando|thinking|raciocinando|reasoning)\b/i }
  ];
  const cleanPhaseText = value => String(value || '').replace(/\s+/g,' ').trim();
  const phaseFromText = text => {
    const clean = cleanPhaseText(text);
    if (!clean || clean.length > 110) return null;
    const hit = phasePatterns.find(item => item.re.test(clean));
    return hit ? { ...hit, raw:clean } : null;
  };
  const visiblePhaseCandidates = () => {
    const out = [];
    const selectors = [
      '[role="status"]', '[aria-live="polite"]', '[aria-live="assertive"]',
      '[data-testid*="thought"]', '[data-testid*="thinking"]', '[data-testid*="tool"]',
      'button', 'span'
    ].join(',');
    const nodes = [...document.querySelectorAll(selectors)].slice(-1400);
    for (const el of nodes) {
      if (!usableInBackground(el)) continue;
      const text = cleanPhaseText(el.innerText || el.textContent || '');
      const phase = phaseFromText(text);
      if (phase) out.push(phase);
    }
    return out;
  };
  const emitVisiblePhase = (phase, detail='') => {
    if (!activeProjectId || !phase) return;
    const signature = `${phase.key}|${phase.label}|${detail}`;
    if (signature === lastVisiblePhaseSignature && Date.now() - lastVisiblePhaseAt < 1200) return;
    lastVisiblePhaseSignature = signature;
    lastVisiblePhaseAt = Date.now();
    emit('MSK_CHATGPT_PHASE', { phase:phase.key, label:phase.label, detail, visible:true, url:location.href, at:Date.now() });
  };
  const scanVisibleChatGPTPhase = () => {
    phaseScanTimer = 0;
    const candidates = visiblePhaseCandidates().sort((a,b) => b.priority - a.priority);
    let top = candidates[0] || null;
    if (!top && stopButtonVisible()) top = { key:'thinking', label:'Pensando…', priority:20, raw:'Pensando' };
    if (!top) return;
    const thinking = candidates.find(item => item.key === 'thinking');
    const detail = top.key !== 'thinking' && thinking ? 'Pensando' : '';
    emitVisiblePhase(top, detail);
  };
  const schedulePhaseScan = () => {
    if (phaseScanTimer) return;
    phaseScanTimer = window.setTimeout(scanVisibleChatGPTPhase, 120);
  };
  const phaseObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      const target = mutation.target?.nodeType === Node.TEXT_NODE ? mutation.target.parentElement : mutation.target;
      const text = cleanPhaseText(target?.textContent || '');
      if (text && text.length <= 180 && phasePatterns.some(item => item.re.test(text))) {
        schedulePhaseScan();
        return;
      }
      for (const node of mutation.addedNodes || []) {
        const value = cleanPhaseText(node?.textContent || '');
        if (value && value.length <= 180 && phasePatterns.some(item => item.re.test(value))) {
          schedulePhaseScan();
          return;
        }
      }
    }
    if (stopButtonVisible()) schedulePhaseScan();
  });
  const startPhaseObserver = () => {
    if (!document.documentElement) return;
    phaseObserver.observe(document.documentElement, { subtree:true, childList:true, characterData:true });
    schedulePhaseScan();
  };

  const renderDiagnosticOverlay = diagnostic => {
    let card = document.querySelector("#msk-chatgpt-diagnostic");
    if (!card) {
      card = document.createElement("aside");
      card.id = "msk-chatgpt-diagnostic";
      Object.assign(card.style, {
        position:"fixed", top:"14px", right:"14px", zIndex:"2147483647", width:"min(340px,calc(100vw - 28px))",
        padding:"11px 12px", borderRadius:"12px", background:"rgba(10,12,16,.96)", color:"#f5f7fa",
        border:"1px solid rgba(125,255,0,.42)", boxShadow:"0 12px 35px rgba(0,0,0,.38)",
        fontFamily:"Arial,Helvetica,sans-serif", fontSize:"12px", lineHeight:"1.4"
      });
      card.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><strong style="color:#9cff72;flex:1">MSK · Diagnóstico real</strong><button type="button" data-msk-close style="border:0;background:transparent;color:#aaa;cursor:pointer;font-size:16px">×</button></div><div data-msk-body style="margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere"></div>`;
      card.querySelector("[data-msk-close]")?.addEventListener("click", () => card.remove());
      document.documentElement.appendChild(card);
    }
    const body = card.querySelector("[data-msk-body]");
    if (body) body.textContent = [
      diagnostic.title ? `Problema: ${diagnostic.title}` : "",
      diagnostic.message ? `Diagnóstico: ${diagnostic.message}` : "",
      diagnostic.evidence ? `Evidência: ${diagnostic.evidence}` : "",
      diagnostic.action ? `Ação: ${diagnostic.action}` : ""
    ].filter(Boolean).join("\n");
  };

  const classifyObservedIssue = text => {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return null;
    const evidence = raw.slice(0, 700);

    if (/(repository|reposit[oó]rio).{0,80}(not (?:found|connected|linked)|n[aã]o (?:encontrado|conectado|vinculado)|missing|ausente)/i.test(raw)) {
      return { category:"repository_not_connected", title:"Repositório não conectado", source:"chatgpt", sourceLabel:"ChatGPT", severity:"error",
        message:"A resposta informa que o repositório necessário não está conectado ou não foi encontrado.",
        evidence, action:"Confirme o repositório salvo para este project_id e reconecte o GitHub somente se o repositório realmente estiver ausente." };
    }
    if (/(permission denied|write access|write permission|read-only|read only|cannot (?:write|push|commit)|can't (?:write|push|commit)|precis[oa].{0,80}(?:acesso|permiss[aã]o).{0,50}(?:escrita|gravar|write|push|commit)|(?:acesso|permiss[aã]o).{0,50}(?:de |para )?(?:escrita|gravar|write|push|commit).{0,80}(?:necess[aá]ri|precis)|sem permiss[aã]o.{0,40}(?:escrita|gravar|push|commit)|permiss[aã]o.{0,40}(?:negada|insuficiente)|403|forbidden)/i.test(raw) && /(github|repository|reposit[oó]rio|commit|push)/i.test(raw)) {
      return { category:"github_write_permission", title:"GitHub precisa de autorização para edição", source:"chatgpt", sourceLabel:"ChatGPT", severity:"error",
        message:"A resposta confirma que falta acesso de escrita para editar ou enviar alterações ao repositório.",
        evidence, action:"Conecte/autorize o GitHub para edição pelo Codex e retome automaticamente o comando pendente.", actionType:"connect_github_write" };
    }
    if (/(github).{0,180}(not available|unavailable|not connected|not authorized|unauthorized|did not become available|not showing|does not appear|n[aã]o dispon[ií]vel|n[aã]o conectado|n[aã]o autorizado|n[aã]o (?:ficou|ficaram|est[aá]|est[aã]o).{0,35}dispon[ií]ve(?:l|is)|n[aã]o aparece)|(?:tool|tools|connector|connectors|ferramenta|ferramentas|conector|conectores).{0,180}(github).{0,180}(not available|unavailable|not showing|does not appear|n[aã]o dispon[ií]vel|n[aã]o (?:ficou|ficaram|est[aá]|est[aã]o).{0,35}dispon[ií]ve(?:l|is)|n[aã]o aparece)|(?:connector|conector).{0,100}(?:does not appear|not showing|n[aã]o aparece).{0,100}(?:tool|tools|ferramenta|ferramentas)/i.test(raw)) {
      return { category:"github_tool_unavailable", title:"GitHub precisa ser ativado nesta conversa", source:"chatgpt", sourceLabel:"ChatGPT", severity:"error",
        message:"O GitHub pode estar instalado na conta, mas a ferramenta ainda não está disponível nesta conversa para editar o repositório.",
        evidence, action:"Abra Plugins/Conectores desta conversa, selecione GitHub e conclua a autorização oficial. A MSK retoma o comando depois da confirmação.", actionType:"connect_github_write" };
    }
    if (/(sign in|log in|authenticate|authentication required|oauth|fa[cç]a login|entre na conta|autentica[cç][aã]o necess[aá]ria)/i.test(raw) && /(github|codex|tool|connector|ferramenta|conector)/i.test(raw)) {
      return { category:"external_auth_required", title:"Autenticação GitHub/Codex necessária", source:"chatgpt", sourceLabel:"ChatGPT", severity:"error",
        message:"Uma ferramenta GitHub/Codex exige autenticação real antes de continuar.",
        evidence, action:"Abra a autorização oficial, conclua o login e retome a tarefa pela extensão.", actionType:"connect_github_write" };
    }
    if (/(lovable|workspace).{0,100}(credits?|cr[eé]ditos?|out of credits|sem cr[eé]dito|no credits)|(?:credits?|cr[eé]ditos?).{0,100}(lovable|workspace)/i.test(raw)) {
      return { category:"lovable_workspace_credits", title:"Créditos do Lovable mencionados", source:"chatgpt", sourceLabel:"ChatGPT", severity:"warning",
        message:"A resposta mencionou créditos do workspace Lovable. Isso pode limitar agente/preview/publicação do Lovable, mas não comprova bloqueio de edição direta no GitHub.",
        evidence, action:"Continuar via GitHub direto e verificar separadamente se há ferramenta/permissão real de escrita. Só relatar preview limitado no final." };
    }
    return null;
  };

  const emitDiagnostic = diagnostic => {
    if (!diagnostic) return;
    const signature = `${diagnostic.category}|${diagnostic.evidence || diagnostic.message || ""}`.slice(0, 900);
    if (signature === lastDiagnosticSignature && Date.now() - lastDiagnosticAt < 15000) return;
    lastDiagnosticSignature = signature;
    lastDiagnosticAt = Date.now();
    renderDiagnosticOverlay(diagnostic);
    emit("MSK_CHATGPT_DIAGNOSTIC", diagnostic);
  };

  const watchAnswer = async beforeCount => {
    let last = "";
    let stableSince = Date.now();
    const timeout = Date.now() + 180000;
    let sawNew = false;
    while (Date.now() < timeout) {
      const nodes = assistantNodes();
      const node = nodes.length > beforeCount ? nodes.at(-1) : null;
      const text = assistantRawText(node) || String(node?.innerText || '').trim();
      if (text) {
        renderIntegrationAnswerCard(node, text);
        sawNew = true;
        if (text !== last) {
          last = text;
          stableSince = Date.now();
          emit('MSK_CHATGPT_STREAM', { text, done:false, url:location.href });
        }
      }
      detectApproval();
      const limitKind = detectLimitState();
      if (limitKind && !stopButtonVisible()) return { text:last, limitKind };
      const generating = stopButtonVisible();
      if (sawNew && last && !generating && Date.now() - stableSince > 1400) {
        return { text:last, limitKind:"" };
      }
      await sleep(350);
    }
    return { text:last, limitKind:"", timedOut:true };
  };

  const waitUntilComposerStable = async (timeout=30000, stableMs=180) => {
    const limit = Date.now() + timeout;
    let last = null;
    let stableAt = 0;
    while (Date.now() < limit) {
      const el = composer();
      if (el && usableInBackground(el)) {
        if (el === last) {
          if (!stableAt) stableAt = Date.now();
          if (Date.now() - stableAt >= stableMs) return el;
        } else {
          last = el;
          stableAt = Date.now();
        }
      } else {
        last = null;
        stableAt = 0;
      }
      await sleep(100);
    }
    return composer();
  };

  const waitUntilGenerationStops = async (timeout=90000) => {
    const limit = Date.now() + timeout;
    while (stopButtonVisible() && Date.now() < limit) await sleep(250);
    return !stopButtonVisible();
  };

  const promptMatches = (actual, expected) => {
    const a = normalizedPrompt(actual);
    const e = normalizedPrompt(expected);
    if (!e) return !!a;
    if (a === e) return true;
    const probe = e.slice(0, Math.min(e.length, 220));
    return probe.length >= 12 && a.includes(probe);
  };

  const confirmPromptDispatched = async (text, beforeUsers, timeout=12000) => {
    // Confirmação REAL: só existe sucesso quando o ChatGPT renderiza uma mensagem
    // de usuário na conversa. Campo vazio não conta, pois a hidratação pode limpá-lo.
    const expected = normalizedPrompt(text);
    const limit = Date.now() + timeout;
    while (Date.now() < limit) {
      const users = userNodes();
      const latest = normalizedPrompt(users.at(-1)?.innerText || '');
      if (users.length > beforeUsers && (!expected || promptMatches(latest, expected))) return true;
      // Em troca de rota a contagem pode reiniciar; ainda assim a última bolha
      // com o texto esperado é prova suficiente de despacho.
      if (expected && latest && promptMatches(latest, expected)) return true;
      await sleep(120);
    }
    return false;
  };

  const submit = async (text, attachments=[], onSent=null, options={}) => {
    await waitForDocument(30000);
    const cleanText = String(text || '').trim();
    const before = assistantNodes().length;
    const beforeUsers = userNodes().length;

    // Evita duplicar uma mensagem se a página recarregou exatamente após o envio.
    if (cleanText && latestUserText() === normalizedPrompt(cleanText)) {
      onSent?.({ deduped:true });
      return watchAnswer(before);
    }

    await waitUntilGenerationStops();
    const attached = await attachFiles(attachments);
    let el = await waitUntilComposerStable(attached.length ? 8000 : 30000);
    if (cleanText) {
      let attempts = 0;
      while (attempts < 3) {
        attempts += 1;
        el = await setComposerText(cleanText);
        await sleep(110);
        if (normalizedPrompt(composerText(el)).includes(normalizedPrompt(cleanText).slice(0, 160))) break;
        await sleep(300);
      }
    } else if (!el) {
      throw new Error('Campo de mensagem do ChatGPT não encontrado.');
    }

    let dispatched = false;
    for (let attempt = 0; attempt < 5 && !dispatched; attempt++) {
      let btn = sendButton();
      const limit = Date.now() + (attached.length ? 20000 : 10000);
      while ((!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') && Date.now() < limit) {
        if (cleanText && attempt > 0) await setComposerText(cleanText).catch(()=>{});
        await sleep(100);
        btn = sendButton();
      }

      if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
        btn.click();
      } else if (attached.length && !cleanText) {
        throw new Error('O ChatGPT ainda não liberou o envio dos anexos.');
      } else if (el) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', code:'Enter', bubbles:true, cancelable:true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key:'Enter', code:'Enter', bubbles:true, cancelable:true }));
      }

      dispatched = await confirmPromptDispatched(cleanText, beforeUsers, 10000);
      if (!dispatched && cleanText) {
        el = await waitUntilComposerStable(12000);
        if (el) await setComposerText(cleanText).catch(()=>{});
      }
    }

    if (!dispatched) throw new Error('O ChatGPT não confirmou a mensagem na conversa. O MSK tentou novamente automaticamente sem exigir atualização da página.');
    if (cleanText) {
      const record = await rememberMskSentPrompt(cleanText, options?.displayText || cleanText, activeProjectId);
      const latestNode = userNodes().at(-1);
      if (record && latestNode) decorateMskSentNode(latestNode, record);
    }
    emit('MSK_CHATGPT_STATUS', { status:'sent', attachments:attached, url:location.href });
    onSent?.({ sent:true });
    // INIT só prepara o contexto da conversa. Não deve ocupar a fila esperando
    // a resposta de confirmação nem aparecer como se fosse a resposta ao comando
    // real do usuário. O próximo comando aguardará a geração parar antes de enviar.
    if (options?.waitForAnswer === false) return { text:'', initialized:true };
    return watchAnswer(before);
  };

  const directGithubDiagnosticPrompt = original => `MSK DIAGNÓSTICO AUTOMÁTICO — NÃO use o agente/chat do Lovable e NÃO interrompa a tarefa apenas porque o workspace Lovable está sem créditos.

Pedido original do cliente:
${String(original || '').slice(0, 5000)}

Faça agora:
1. Verifique se esta conversa possui uma ferramenta REAL de escrita para o repositório GitHub vinculado (GitHub/Codex ou equivalente).
2. Se possuir, continue a alteração diretamente no GitHub e valide commit/push.
3. Se NÃO possuir, diga a causa exata observada: repositório ausente, ferramenta GitHub indisponível, falta de autorização, falta de permissão de escrita ou outro erro real.
4. Créditos do Lovable podem afetar somente agente/preview/publicação do Lovable. Não use isso como justificativa para não editar o GitHub.
5. Não invente. Retorne uma resposta curta com o diagnóstico comprovado e continue a execução quando tecnicamente possível.`;

  const connectorControls = () => [...document.querySelectorAll('button,a,[role="button"],[role="menuitem"],[role="option"]')]
    .filter(el => usableInBackground(el) && !el.closest('[data-message-author-role]'));

  const controlLabel = el => String(`${cleanLabel(el)} ${el?.getAttribute?.('aria-label') || ''} ${el?.getAttribute?.('title') || ''} ${el?.getAttribute?.('data-testid') || ''}`)
    .replace(/\s+/g,' ').trim();

  const conversationBaseUrl = () => {
    const match = location.pathname.match(/^(\/c\/[^/?#]+)/i);
    return match ? `${location.origin}${match[1]}` : '';
  };

  const findGithubConnectorControl = () => connectorControls().find(el => {
    const label = controlLabel(el);
    return /github/i.test(label) && !/(copy|copiar|thumb|feedback)/i.test(label);
  }) || null;

  const findConnectorMenuButton = () => {
    const controls = connectorControls();
    const exact = controls.find(el => /^(plugins?|conectores?|connectors?|apps?|aplicativos?|ferramentas?|tools?)$/i.test(cleanLabel(el)));
    if (exact) return exact;
    return controls.find(el => {
      const label = controlLabel(el);
      return /(plugin|connector|conector|apps?|aplicativo|tools?|ferramenta)/i.test(label) && !/github/i.test(label) && label.length < 160;
    }) || null;
  };

  const findGithubAuthorizeButton = githubControl => {
    const scopes = [];
    if (githubControl) {
      let parent = githubControl.parentElement;
      for (let i=0; parent && i<5; i+=1, parent=parent.parentElement) scopes.push(parent);
    }
    scopes.push(document);
    for (const scope of scopes) {
      const controls = [...scope.querySelectorAll('button,a,[role="button"],[role="menuitem"]')].filter(usableInBackground);
      const button = controls.find(el => {
        const label = controlLabel(el);
        return /(connect|conectar|authorize|autorizar|continue|continuar|install|instalar|enable|ativar|setup|configurar)/i.test(label) && (scope === document ? /github/i.test(label) : true);
      });
      if (button) return button;
    }
    return null;
  };

  const tryConversationGithubSetup = async () => {
    await waitForDocument(15000);
    for (let attempt=0; attempt<3; attempt+=1) {
      let github = findGithubConnectorControl();
      if (github) {
        const auth = findGithubAuthorizeButton(github);
        if (auth && auth !== github) {
          const label = controlLabel(auth);
          auth.click();
          return { ok:true, clicked:true, label, destination:'github-auth', via:'conversation-plugins' };
        }
        const label = controlLabel(github);
        github.click();
        await sleep(650);
        const after = findGithubAuthorizeButton(github);
        if (after && after !== github) {
          const authLabel = controlLabel(after);
          after.click();
          return { ok:true, clicked:true, label:authLabel, destination:'github-auth', via:'conversation-plugins' };
        }
        return { ok:true, opened:true, label, destination:'github-connector', via:'conversation-plugins' };
      }

      const menu = findConnectorMenuButton();
      if (menu) {
        menu.click();
        await sleep(500);
        const pluginEntry = connectorControls().find(el => /^(plugins?|conectores?|connectors?|apps?|aplicativos?)$/i.test(cleanLabel(el)));
        if (pluginEntry && pluginEntry !== menu) { pluginEntry.click(); await sleep(500); }
        continue;
      }
      await sleep(300);
    }
    return { ok:false, code:'PLUGIN_UI_NOT_FOUND' };
  };

  const writeSetupButton = () => {
    const controls = connectorControls();
    const exact = controls.find(el => /^(connect github|conectar github|continue with github|continuar com github|authorize github|autorizar github)$/i.test(cleanLabel(el)));
    if (exact) return exact;
    return controls.find(el => {
      const label = controlLabel(el);
      if (!label || label.length > 160) return false;
      return /(github)/i.test(label) && /(connect|conectar|authorize|autorizar|continue|continuar|install|instalar|enable|ativar|setup|configurar)/i.test(label);
    }) || null;
  };

  const openGithubWriteSetup = async () => {
    const base = conversationBaseUrl();
    if (base && !/\/plugins(?:\/|$)/i.test(location.pathname)) {
      const ui = await tryConversationGithubSetup();
      if (ui?.ok) return ui;
      location.assign(`${base}/plugins`);
      return { ok:true, navigating:true, destination:'conversation-plugins', destinationUrl:`${base}/plugins` };
    }

    if (/\/plugins(?:\/|$)/i.test(location.pathname)) {
      const ui = await tryConversationGithubSetup();
      if (ui?.ok) return ui;
      location.assign('https://chatgpt.com/codex');
      return { ok:true, navigating:true, destination:'codex', fallbackFrom:'conversation-plugins' };
    }

    if (!/^\/codex(?:\/|$)/i.test(location.pathname)) {
      location.assign('https://chatgpt.com/codex');
      return { ok:true, navigating:true, destination:'codex' };
    }
    const timeout = Date.now() + 12000;
    while (Date.now() < timeout) {
      const button = writeSetupButton();
      if (button) {
        const label = controlLabel(button);
        button.click();
        return { ok:true, clicked:true, label, destination:'github-auth', via:'codex' };
      }
      const body = String(document.body?.innerText || '').replace(/\s+/g,' ').slice(0,6000);
      if (/(github).{0,120}(connected|conectado|authorized|autorizado)|(?:connected|conectado|authorized|autorizado).{0,120}(github)/i.test(body)) {
        return { ok:true, connected:true, destination:'codex' };
      }
      await sleep(250);
    }
    return { ok:true, manual:true, destination:'codex', message:'A interface oficial de conexão GitHub foi aberta. Conclua a autorização; a MSK continuará acompanhando e retomará o comando.' };
  };

  const drain = async () => {
    if (sending) return;
    sending = true;
    try {
      while (queue.length) {
        const job = queue.shift();
        activeProjectId = job.projectId || activeProjectId;
        activeOriginTabId = job.originTabId ?? activeOriginTabId;
        try {
          let acknowledged = false;
          const acknowledge = extra => {
            if (acknowledged) return;
            acknowledged = true;
            try { job.respond?.({ ok:true, sent:true, deliveryId:job.deliveryId || '', ...(extra || {}) }); } catch {}
          };
          const isInit = job.kind === 'init';
          const result = await submit(job.text, job.attachments || [], acknowledge, {
            waitForAnswer:!isInit,
            displayText:job.displayText || (isInit ? 'Contexto do projeto enviado pela MSK.' : job.text)
          });
          acknowledge();
          if (isInit) continue;
          const finalText = String(result?.text || '').trim();
          if (result?.limitKind) continue;

          const issue = classifyObservedIssue(finalText);
          if (issue) emitDiagnostic(issue);

          if (issue?.category === 'lovable_workspace_credits' && !job.diagnosticRetry) {
            emit('MSK_CHATGPT_STREAM', {
              text:'Créditos do Lovable foram mencionados. Isso não encerra a edição: verificando agora o acesso real ao GitHub e continuando por lá…',
              done:false, url:location.href
            });
            queue.unshift({
              text:directGithubDiagnosticPrompt(job.text),
              attachments:[],
              projectId:job.projectId,
              originTabId:job.originTabId,
              diagnosticRetry:true
            });
            continue;
          }

          if (finalText) {
            emit('MSK_CHATGPT_PHASE', { phase:'done', label:'Concluído', detail:'', visible:true, url:location.href, at:Date.now() });
            const error = !!issue && ['repository_not_connected','github_write_permission','github_tool_unavailable','external_auth_required'].includes(issue.category);
            emit('MSK_CHATGPT_STREAM', { text:finalText, done:true, error, url:location.href });
            emit('MSK_CHATGPT_BOUND', { url:location.href });
          } else if (result?.timedOut) {
            const diag = {
              category:'chatgpt_response_timeout', title:'Resposta não confirmada', source:'chatgpt-ui', sourceLabel:'Interface do ChatGPT', severity:'error',
              message:'A extensão não conseguiu confirmar uma resposta final dentro do tempo de observação.',
              evidence:'Nenhuma resposta final estável foi detectada na conversa aberta.',
              action:'Mantenha a aba do ChatGPT aberta e tente novamente. Se houver mensagem visível no ChatGPT, ela será usada como evidência no próximo diagnóstico.'
            };
            emitDiagnostic(diag);
            emit('MSK_CHATGPT_PHASE', { phase:'error', label:'Falha', detail:'', visible:true, url:location.href, at:Date.now() });
            emit('MSK_CHATGPT_STREAM', { text:diag.message, done:true, error:true, url:location.href });
          }
        } catch (error) {
          try { job.respond?.({ ok:false, sent:false, deliveryId:job.deliveryId || '', error:error?.message || 'Falha ao enviar para o ChatGPT.' }); } catch {}
          const diag = {
            category:'bridge_error', title:'Falha na ponte com ChatGPT', source:'extension', sourceLabel:'Extensão MSK', severity:'error',
            message:error?.message || 'Falha na interface do ChatGPT.',
            evidence:error?.message || 'Erro sem mensagem adicional.',
            action:'Verifique se a conversa do ChatGPT continua aberta e autenticada; depois tente novamente.'
          };
          emitDiagnostic(diag);
          emit('MSK_CHATGPT_PHASE', { phase:'error', label:'Falha', detail:'', visible:true, url:location.href, at:Date.now() });
          emit('MSK_CHATGPT_STREAM', { text:`Não consegui enviar a mensagem ao ChatGPT: ${diag.message}`, done:true, error:true, url:location.href });
        }
      }
    } finally { sending = false; }
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!['MSK_CHATGPT_PING','MSK_CHATGPT_INIT','MSK_CHATGPT_PROMPT','MSK_CHATGPT_APPROVAL_DECISION','MSK_CHATGPT_SHOW_DIAGNOSTIC','MSK_CHATGPT_OPEN_GITHUB_WRITE'].includes(message?.type)) return;
    if (message.type === 'MSK_CHATGPT_PING') { sendResponse({ok:true,ready:true,url:location.href}); return; }
    const p = message.payload || {};
    if (message.type === 'MSK_CHATGPT_SHOW_DIAGNOSTIC') {
      renderDiagnosticOverlay(p);
      sendResponse({ok:true});
      return;
    }
    if (message.type === 'MSK_CHATGPT_OPEN_GITHUB_WRITE') {
      openGithubWriteSetup().then(sendResponse).catch(error => sendResponse({ok:false,error:error?.message || 'Falha ao abrir autorização GitHub/Codex.'}));
      return true;
    }
    if (message.type === 'MSK_CHATGPT_APPROVAL_DECISION') {
      const requestId = String(p.requestId || '');
      const choiceId = String(p.choiceId || '');
      const entry = approvalRegistry.get(requestId);
      const index = Number(choiceId.split(':').at(-1));
      const button = entry?.buttons?.[index];
      if (!button || !document.contains(button) || !visible(button)) {
        sendResponse({ok:false,error:'Essa permissão não está mais disponível. Aguarde a próxima solicitação.'});
        return;
      }
      const clickedLabel = cleanLabel(button);
      button.click();
      approvalRegistry.delete(requestId);
      lastApprovalSignature = '';
      suppressApprovalUntil = Date.now() + 2200;
      emit('MSK_CHATGPT_APPROVAL_CLEAR', { requestIds:[requestId], reason:'answered', url:location.href });
      sendResponse({ok:true,clicked:true,label:clickedLabel});
      setTimeout(detectApproval, 2400);
      return;
    }
    activeProjectId = String(p.projectId || activeProjectId || '');
    activeOriginTabId = p.originTabId ?? activeOriginTabId;
    let text = String(p.text || '').trim();
    if (message.type === 'MSK_CHATGPT_INIT') {
      const repo = String(p.repo || '').replace('https://github.com/','');
      text = String(p.text || '').trim() || `MSK Agente conectado. Trabalhe SOMENTE no projeto Lovable ID ${activeProjectId}${repo ? `, repositório GitHub ${repo}` : ''}. A extensão é apenas interface: NUNCA envie prompts ao agente/chat do Lovable para implementar mudanças. Faça alterações diretamente no GitHub usando GitHub/Codex ou outra ferramenta real de escrita disponível. Toda edição deve ser escrita de verdade no GitHub conectado e depois sincronizada no projeto Lovable correspondente para que o preview reflita o commit; não considere concluído se ficar apenas no chat ou em patch local. Falta de créditos do Lovable não bloqueia edição GitHub; pode limitar apenas preview/publicação, e nesse caso informe que o preview não pôde ser confirmado. Se não houver escrita no GitHub, informe a causa exata observada (repo ausente, ferramenta indisponível, autorização ou permissão de escrita), sem inventar. Execute rápido quando o pedido estiver claro, não altere nada fora do pedido e valide antes de declarar sucesso. Para tarefas demoradas use estados curtos. Não revele segredos. Não altere nada agora; apenas confirme projeto e repositório e fique pronto.`;
    }
    const attachments = Array.isArray(p.attachments) ? p.attachments : [];
    if (!text && !attachments.length) { sendResponse({ok:false,error:'Mensagem vazia.'}); return; }
    queue.push({
      text,
      displayText:String(p.displayText || '').trim(),
      attachments,
      projectId:activeProjectId,
      originTabId:activeOriginTabId,
      deliveryId:String(p.deliveryId || ''),
      kind:message.type === 'MSK_CHATGPT_INIT' ? 'init' : 'prompt',
      respond:sendResponse
    });
    // Só responde sucesso depois que o ChatGPT confirmar o despacho real.
    drain();
    return true;
  });

  initializeMskSentCards();
  startPhaseObserver();
  // Captura tardia/streaming: garante que o JSON nunca fique exposto e que o Cofre seja acionado.
  setInterval(scanIntegrationMarkers, 450);
  setTimeout(scanIntegrationMarkers, 900);

  setInterval(() => {
    detectApproval();
    detectLimitState();
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [key, value] of approvalRegistry) if ((value?.createdAt || 0) < cutoff) approvalRegistry.delete(key);
  }, 650);

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (activeProjectId) emit('MSK_CHATGPT_BOUND', { url:lastUrl });
    }
  }, 800);
})();
