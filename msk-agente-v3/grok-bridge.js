(() => {
  if (globalThis.__MSK_GROK_BRIDGE__) return;
  globalThis.__MSK_GROK_BRIDGE__ = true;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clean = value => String(value || "").replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect?.();
    const style = getComputedStyle(el);
    return !!rect && rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };

  let binding = { projectId:"", originTabId:null };
  let lastAssistantText = "";
  let lastEmittedText = "";
  let streamTimer = 0;
  const seenDeliveries = new Map();

  const emit = (type, payload = {}) => {
    try {
      chrome.runtime.sendMessage({ type, payload:{ ...payload, projectId:binding.projectId, originTabId:binding.originTabId, url:location.href } });
    } catch {}
  };


  const waitForDocument = async (timeout=30000) => {
    const until=Date.now()+timeout;
    while(Date.now()<until) { if(document.documentElement && document.body) return true; await sleep(60); }
    return !!document.documentElement;
  };
  const normalizedPrompt = value => String(value || '').replace(/\s+/g,' ').trim();
  const MSK_SENT_STYLE_ID = 'msk-grok-sent-card-style';
  const MSK_SENT_STORAGE_KEY = 'mskGrokSentPromptsV1';
  const sentPromptCache = new Map();
  let sentObserver = null;
  let sentRestoreScheduled = false;
  let lastLimitSignature = '';
  let lastLimitAt = 0;

  const mskPromptHash = value => {
    let hash=2166136261; const text=String(value || '');
    for(let i=0;i<text.length;i++){ hash^=text.charCodeAt(i); hash=Math.imul(hash,16777619); }
    return (hash>>>0).toString(36);
  };

  const ensureMskSentCardStyle = () => {
    if(document.getElementById(MSK_SENT_STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=MSK_SENT_STYLE_ID;
    style.textContent=`
      @property --msk-edge-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
      .msk-grok-sent-message > .msk-sent-original { display:none !important; }
      .msk-grok-sent-message { background:transparent !important; }
      .msk-sent-card{--msk-edge-angle:0deg;position:relative;isolation:isolate;display:block;width:fit-content;min-width:210px;max-width:min(560px,84vw);margin-left:auto;border-radius:18px;color:#f7f7f8;background:transparent;box-shadow:0 10px 30px rgba(0,0,0,.16);overflow:visible}
      .msk-sent-card::before,.msk-sent-card::after{content:'';position:absolute;pointer-events:none;border-radius:19px;background:conic-gradient(from var(--msk-edge-angle),rgba(97,255,104,.12) 0deg,rgba(97,255,104,.88) 55deg,rgba(255,88,198,.78) 145deg,rgba(156,92,255,.82) 235deg,rgba(97,255,104,.12) 360deg);animation:msk-grok-edge-orbit 8.5s linear infinite}
      .msk-sent-card::before{inset:-1px;padding:1px;z-index:-1;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.78}
      .msk-sent-card::after{inset:-4px;padding:3px;z-index:-2;opacity:.16;filter:blur(8px);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
      .msk-sent-card__surface{position:relative;z-index:1;overflow:hidden;border-radius:18px;background:rgba(18,19,22,.97);border:1px solid rgba(255,255,255,.055);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
      .msk-sent-card__head{width:100%;border:0;background:transparent;color:inherit;cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;text-align:left;font:inherit}
      .msk-sent-card__logo{width:25px;height:25px;object-fit:contain;flex:0 0 25px;filter:drop-shadow(0 0 7px rgba(129,255,126,.16))}
      .msk-sent-card__copy{min-width:0;flex:1;display:grid;gap:1px}.msk-sent-card__title{font-size:13px;font-weight:700;line-height:1.25;letter-spacing:.01em}.msk-sent-card__hint{font-size:10.5px;line-height:1.2;color:rgba(255,255,255,.48)}
      .msk-sent-card__chevron{width:16px;height:16px;flex:0 0 16px;opacity:.55;transition:transform .28s ease,opacity .28s ease}.msk-sent-card.is-open .msk-sent-card__chevron{transform:rotate(180deg);opacity:.8}
      .msk-sent-card__details{max-height:0;opacity:0;overflow:hidden;padding:0 12px;border-top:1px solid transparent;transition:max-height .34s ease,opacity .24s ease,padding .34s ease,border-color .34s ease;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;color:rgba(255,255,255,.76)}
      .msk-sent-card.is-open .msk-sent-card__details{max-height:min(42vh,420px);opacity:1;overflow:auto;padding:10px 12px 12px;border-top-color:rgba(255,255,255,.065)}
      @keyframes msk-grok-edge-orbit{to{--msk-edge-angle:360deg}}
      @media (prefers-reduced-motion:reduce){.msk-sent-card::before,.msk-sent-card::after{animation:none!important;--msk-edge-angle:80deg}.msk-sent-card__chevron,.msk-sent-card__details{transition:none!important}}
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const grokUserNodes = () => {
    const selectors=['[data-message-author-role="user"]','[data-testid*="user-message" i]','[data-testid*="message" i]','main article','main [class*="message" i]'];
    const nodes=selectors.flatMap(sel=>[...document.querySelectorAll(sel)]).filter(node=>node?.isConnected && !node.closest('nav,aside,form'));
    return [...new Set(nodes)];
  };

  const rememberMskSentPrompt = async (fullText, displayText, projectId='') => {
    const cleanFull=String(fullText || '').trim(); if(!cleanFull) return null;
    const key=`p-${mskPromptHash(normalizedPrompt(cleanFull))}`;
    const record={key,fullText:cleanFull,displayText:String(displayText || cleanFull).trim(),projectId:String(projectId || ''),createdAt:Date.now()};
    sentPromptCache.set(key,record);
    try{
      const stored=await chrome.storage.local.get(MSK_SENT_STORAGE_KEY);
      const list=Array.isArray(stored?.[MSK_SENT_STORAGE_KEY])?stored[MSK_SENT_STORAGE_KEY]:[];
      await chrome.storage.local.set({[MSK_SENT_STORAGE_KEY]:[record,...list.filter(item=>item?.key!==key)].slice(0,30)});
    }catch{}
    return record;
  };

  const decorateMskSentNode = (node, record) => {
    if(!node || !record) return false;
    ensureMskSentCardStyle();
    node.classList.add('msk-grok-sent-message'); node.dataset.mskPromptKey=record.key;
    [...node.children].forEach(child=>{ if(!child.classList.contains('msk-sent-card')) child.classList.add('msk-sent-original'); });
    let card=[...node.children].find(child=>child.classList?.contains('msk-sent-card'));
    if(!card){
      card=document.createElement('section'); card.className='msk-sent-card'; card.setAttribute('data-msk-sent-card','1');
      const surface=document.createElement('div'); surface.className='msk-sent-card__surface';
      const head=document.createElement('button'); head.type='button'; head.className='msk-sent-card__head'; head.setAttribute('aria-expanded','false');
      const logo=document.createElement('img'); logo.className='msk-sent-card__logo'; logo.alt='MSK'; logo.src=chrome.runtime.getURL('assets/msk-agente-logo.png');
      const copy=document.createElement('span'); copy.className='msk-sent-card__copy';
      const title=document.createElement('span'); title.className='msk-sent-card__title'; title.textContent='Enviado por MSK';
      const hint=document.createElement('span'); hint.className='msk-sent-card__hint'; hint.textContent='Clique para ver o comando'; copy.append(title,hint);
      const chevron=document.createElementNS('http://www.w3.org/2000/svg','svg'); chevron.setAttribute('viewBox','0 0 24 24'); chevron.setAttribute('fill','none'); chevron.setAttribute('stroke','currentColor'); chevron.setAttribute('stroke-width','2'); chevron.classList.add('msk-sent-card__chevron'); chevron.innerHTML='<path d="m6 9 6 6 6-6"/>';
      const details=document.createElement('div'); details.className='msk-sent-card__details'; details.textContent=record.displayText || record.fullText;
      head.append(logo,copy,chevron); head.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const open=card.classList.toggle('is-open');head.setAttribute('aria-expanded',open?'true':'false')});
      surface.append(head,details); card.appendChild(surface); node.appendChild(card);
    }else{
      const details=card.querySelector('.msk-sent-card__details'); if(details) details.textContent=record.displayText || record.fullText;
    }
    return true;
  };

  const restoreMskSentCards = () => {
    if(!sentPromptCache.size) return;
    const records=[...sentPromptCache.values()];
    for(const node of grokUserNodes()){
      const existingKey=String(node?.dataset?.mskPromptKey || '');
      if(existingKey && sentPromptCache.has(existingKey)){decorateMskSentNode(node,sentPromptCache.get(existingKey));continue;}
      const raw=normalizedPrompt(String(node?.innerText || node?.textContent || '')); if(!raw) continue;
      const record=records.find(item=>normalizedPrompt(item.fullText)===raw);
      if(record) decorateMskSentNode(node,record);
    }
  };
  const scheduleMskSentRestore = () => { if(sentRestoreScheduled) return; sentRestoreScheduled=true; setTimeout(()=>{sentRestoreScheduled=false;restoreMskSentCards()},100); };
  const initializeMskSentCards = async () => {
    await waitForDocument(); ensureMskSentCardStyle();
    try{const stored=await chrome.storage.local.get(MSK_SENT_STORAGE_KEY);const list=Array.isArray(stored?.[MSK_SENT_STORAGE_KEY])?stored[MSK_SENT_STORAGE_KEY]:[];for(const item of list) if(item?.key&&item?.fullText) sentPromptCache.set(item.key,item);}catch{}
    restoreMskSentCards();
    if(!sentObserver && document.documentElement){sentObserver=new MutationObserver(scheduleMskSentRestore);sentObserver.observe(document.documentElement,{childList:true,subtree:true});}
  };

  const detectLimitState = () => {
    const nodes=[...document.querySelectorAll('[role="alert"],[role="status"],[data-testid*="limit" i],[class*="toast" i],[class*="banner" i],[class*="notice" i],[class*="alert" i]')].filter(node=>node?.isConnected);
    const conversationPattern=/(conversation|chat|context).{0,80}(too long|maximum|limit)|(?:start|open).{0,30}new (?:chat|conversation).{0,60}(continue|limit)|conversa.{0,60}(muito longa|limite)|novo chat.{0,60}continu/i;
    const usagePattern=/(usage limit|rate limit|message limit|you(?:'|’)ve reached.{0,50}limit|limit resets|try again later|too many requests|limite (?:de uso|de mensagens)|atingiu.{0,40}limite)/i;
    for(const node of nodes){
      const text=clean(node.innerText || node.textContent || ''); if(!text || text.length>1400) continue;
      const kind=conversationPattern.test(text)?'conversation_length':usagePattern.test(text)?'account_usage':''; if(!kind) continue;
      const signature=`${kind}:${text.slice(0,180)}`; if(signature===lastLimitSignature && Date.now()-lastLimitAt<30000) return kind;
      lastLimitSignature=signature; lastLimitAt=Date.now();
      const message=kind==='conversation_length'?'Esta conversa do Grok atingiu o limite. Abra uma nova conversa para continuar com o projeto.':'O limite de uso do Grok foi atingido. Aguarde a liberação indicada pela sua conta e tente novamente.';
      emit('MSK_GROK_LIMIT',{kind,message,sourceText:text}); return kind;
    }
    return '';
  };

  const composerCandidates = () => [
    ...document.querySelectorAll('div.ql-editor[contenteditable="true"]'),
    ...document.querySelectorAll('[contenteditable="true"].ProseMirror'),
    ...document.querySelectorAll('[contenteditable="true"][role="textbox"]'),
    ...document.querySelectorAll('textarea'),
    ...document.querySelectorAll('input[type="text"]')
  ].filter(visible).filter(el => !el.closest('[aria-hidden="true"]'));

  const composer = () => {
    const list = composerCandidates();
    return list.find(el => /prompt|message|mensagem|pergunte|ask|chat/i.test(`${el.getAttribute?.('aria-label') || ''} ${el.getAttribute?.('data-placeholder') || ''} ${el.getAttribute?.('placeholder') || ''}`)) || list.at(-1) || null;
  };

  const sendButton = () => {
    const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(visible).filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true');
    return buttons.find(el => /^(send|enviar)(\s|$)|send message|enviar mensagem/i.test(clean(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-tooltip') || ''} ${el.title || ''} ${el.innerText || ''}`)))
      || buttons.find(el => /send-button|send_button/i.test(`${el.getAttribute('data-test-id') || ''} ${el.className || ''}`))
      || null;
  };

  const setComposerText = async text => {
    const limit = Date.now() + 30000;
    let el = composer();
    while (!el && Date.now() < limit) { await sleep(250); el = composer(); }
    if (!el) throw new Error('Campo de mensagem do Grok não encontrado. Abra o Grok e tente novamente.');
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter ? setter.call(el, text) : (el.value = text);
      el.dispatchEvent(new Event('input', {bubbles:true}));
      el.dispatchEvent(new Event('change', {bubbles:true}));
    } else {
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
      } catch {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', {bubbles:true, inputType:'insertText', data:text}));
      }
      if (!clean(el.innerText || el.textContent).includes(clean(text).slice(0, 50))) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', {bubbles:true, inputType:'insertText', data:text}));
      }
    }
    await sleep(150);
    return el;
  };

  const runtimeRequest = (message, timeout=30000) => new Promise(resolve => {
    let done=false;
    const timer=setTimeout(() => { if(done) return; done=true; resolve({ok:false,error:'A operação de arquivo demorou demais.'}); }, timeout);
    chrome.runtime.sendMessage(message, response => {
      if(done) return; done=true; clearTimeout(timer);
      resolve(response || {ok:false,error:chrome.runtime.lastError?.message || 'Sem resposta da extensão.'});
    });
  });
  const base64ToBytes = data => {
    const binary=atob(String(data || '')); const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return bytes;
  };
  const fileInput = () => [...document.querySelectorAll('input[type="file"]')].find(el => !el.disabled) || null;
  const attachmentTrigger = () => [...document.querySelectorAll('button,[role="button"]')].find(el => {
    if(!visible(el)) return false;
    const label=clean(`${el.getAttribute?.('aria-label')||''} ${el.title||''} ${el.innerText||''}`);
    return /(attach|upload|add file|add files|anexar|carregar|adicionar arquivo|arquivo)/i.test(label) && !/(send|enviar)/i.test(label);
  }) || null;
  const ensureFileInput = async () => {
    let input=fileInput(); if(input) return input;
    const trigger=attachmentTrigger(); if(trigger) { try { trigger.click(); } catch {} }
    const limit=Date.now()+7000;
    while(!input && Date.now()<limit) { await sleep(200); input=fileInput(); }
    return input;
  };
  const attachFiles = async descriptors => {
    const list=Array.isArray(descriptors) ? descriptors.filter(x => x?.uploadId) : [];
    const attached=[];
    for(const descriptor of list) {
      emit('MSK_GROK_STATUS',{status:'uploading',file:descriptor.name || 'arquivo'});
      const uploadId=String(descriptor.uploadId || '');
      const metaResult=await runtimeRequest({type:'MSK_FILE_STAGE_GET_META',payload:{uploadId}},15000);
      if(!metaResult?.ok || !metaResult.meta) throw new Error(metaResult?.error || `Anexo ${descriptor?.name || ''} não encontrado.`);
      const meta=metaResult.meta; const parts=[];
      for(let index=0;index<Number(meta.chunks || 0);index++) {
        const chunk=await runtimeRequest({type:'MSK_FILE_STAGE_GET_CHUNK',payload:{uploadId,index}},30000);
        if(!chunk?.ok) throw new Error(chunk?.error || `Falha ao ler ${meta.name}.`);
        parts.push(base64ToBytes(chunk.data));
      }
      const file=new File(parts,meta.name,{type:meta.type || 'application/octet-stream',lastModified:Number(meta.lastModified || Date.now())});
      const input=await ensureFileInput();
      if(!input) throw new Error('O campo de anexos do Grok não foi encontrado.');
      const dt=new DataTransfer(); dt.items.add(file);
      try { input.files=dt.files; } catch {
        const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files')?.set;
        setter?.call(input,dt.files);
      }
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      attached.push(file.name);
      await sleep(500);
      await runtimeRequest({type:'MSK_FILE_STAGE_DISCARD',payload:{uploadId}},12000);
    }
    return attached;
  };

  const GROK_INTEGRATION_STYLE_ID='msk-grok-integration-style';
  const integrationMarkerStart=/<MSK_INTEGRATION_REQUEST>/i;
  const integrationMarkerFull=/<MSK_INTEGRATION_REQUEST>([\s\S]*?)<\/MSK_INTEGRATION_REQUEST>/i;
  const integrationRequestSignatures=new Set();
  const ensureIntegrationStyle=()=>{
    if(document.getElementById(GROK_INTEGRATION_STYLE_ID)) return;
    const style=document.createElement('style'); style.id=GROK_INTEGRATION_STYLE_ID; style.textContent=`
      .msk-grok-integration-answer > :not(.msk-grok-integration-card){display:none!important}
      .msk-grok-integration-card{margin:10px 0;padding:14px;border:1px solid rgba(62,255,145,.28);border-radius:16px;background:linear-gradient(145deg,rgba(10,24,17,.96),rgba(14,14,22,.97));box-shadow:0 12px 34px rgba(0,0,0,.2);color:inherit}
      .msk-grok-integration-card strong{display:block;font-size:13px}.msk-grok-integration-card b{display:block;margin-top:2px;font-size:10px;color:#78f7ad;text-transform:uppercase}.msk-grok-integration-card p{font-size:12px;line-height:1.45;white-space:pre-wrap}.msk-grok-integration-fields{display:flex;flex-wrap:wrap;gap:6px}.msk-grok-integration-fields span{padding:6px 8px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.055);font-size:10px}.msk-grok-integration-foot{margin-top:10px;font-size:10px;opacity:.64}`;
    document.documentElement.appendChild(style);
  };
  const grokRawText=node=>node ? [...node.childNodes].filter(child=>!(child instanceof Element && child.classList.contains('msk-grok-integration-card'))).map(child=>child.textContent||'').join('').trim() : '';
  const renderIntegrationCard=(node,rawText)=>{
    const raw=String(rawText||''); if(!node || !integrationMarkerStart.test(raw)) return false; ensureIntegrationStyle(); node.classList.add('msk-grok-integration-answer');
    let card=node.querySelector(':scope > .msk-grok-integration-card'); if(!card){card=document.createElement('section');card.className='msk-grok-integration-card';node.appendChild(card)}
    const full=raw.match(integrationMarkerFull); let data=null; if(full){try{data=JSON.parse(full[1].trim())}catch{}}
    if(data && Array.isArray(data.fields) && data.fields.length){const signature=JSON.stringify(data);if(!integrationRequestSignatures.has(signature)){integrationRequestSignatures.add(signature);emit('MSK_GROK_INTEGRATION_REQUEST',{request:data});}}
    const clean=raw.replace(integrationMarkerFull,'').replace(/<MSK_INTEGRATION_REQUEST>[\s\S]*$/i,'').trim(); const fields=Array.isArray(data?.fields)?data.fields.slice(0,12).map(f=>String(f?.label||f?.key||'Campo')).filter(Boolean):[];
    card.innerHTML=''; const title=document.createElement('strong'); title.textContent=String(data?.title||'Credenciais solicitadas'); const tag=document.createElement('b'); tag.textContent='🔐 Cofre MSK'; card.append(title,tag); if(clean){const note=document.createElement('p');note.textContent=clean;card.append(note)} const list=document.createElement('div');list.className='msk-grok-integration-fields';(fields.length?fields:['Preparando campos protegidos…']).forEach(label=>{const chip=document.createElement('span');chip.textContent=label;list.append(chip)});card.append(list);const foot=document.createElement('div');foot.className='msk-grok-integration-foot';foot.textContent='Preencha os valores somente no pop-up da extensão MSK.';card.append(foot);return true;
  };

  const assistantNodes = () => {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant" i]',
      '[data-testid*="response" i]',
      '[class*="assistant" i] [class*="prose" i]',
      '[class*="assistant" i]',
      'article .prose',
      'main article [class*="prose" i]',
      'main [class*="response" i]',
    ];
    const nodes = selectors.flatMap(selector => [...document.querySelectorAll(selector)]).filter(visible);
    return [...new Set(nodes)].filter(node => !node.closest('form') && !node.closest('[contenteditable="true"]') && !node.closest('nav') && !node.closest('aside'));
  };

  const latestAssistant = () => {
    const nodes = assistantNodes();
    for (let i=nodes.length-1; i>=0; i--) {
      const text = grokRawText(nodes[i]) || String(nodes[i].innerText || nodes[i].textContent || '').trim();
      if (text && text.length > 1) { renderIntegrationCard(nodes[i],text); return { node:nodes[i], text }; }
    }
    return { node:null, text:'' };
  };

  const isGenerating = () => [...document.querySelectorAll('button,[role="button"]')].some(el => {
    if(!visible(el)) return false;
    const label=clean(`${el.getAttribute('aria-label') || ''} ${el.title || ''} ${el.innerText || ''}`);
    return /(stop|parar|cancel response|interromper resposta)/i.test(label);
  });

  const emitLatest = () => {
    const {text} = latestAssistant();
    if (!text || text === lastEmittedText) return;
    lastAssistantText = text;
    lastEmittedText = text;
    emit('MSK_GROK_STREAM', { text, done:!isGenerating() });
  };

  const scheduleEmit = () => {
    clearTimeout(streamTimer);
    streamTimer = setTimeout(emitLatest, 180);
  };
  const scanIntegrationMarkers = () => {
    for (const root of assistantNodes()) {
      const text = String(root.innerText || root.textContent || '');
      if (integrationMarkerStart.test(text)) renderIntegrationCard(root, text);
    }
  };
  new MutationObserver(() => { scheduleEmit(); scanIntegrationMarkers(); scheduleMskSentRestore(); detectLimitState(); }).observe(document.documentElement, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','disabled']});
  setInterval(scanIntegrationMarkers, 500);
  setTimeout(scanIntegrationMarkers, 900);

  const waitForNewResponse = async before => {
    const limit=Date.now()+120000;
    let last=''; let stableAt=0;
    while(Date.now()<limit) {
      const {text}=latestAssistant();
      if(text && text !== before) {
        if(text !== last) { last=text; stableAt=Date.now(); emit('MSK_GROK_STREAM',{text,done:false}); }
        const generating=isGenerating();
        if(!generating && Date.now()-stableAt>900) {
          lastAssistantText=text; lastEmittedText=text;
          emit('MSK_GROK_STREAM',{text,done:true});
          return;
        }
      }
      await sleep(350);
    }
    if(last) emit('MSK_GROK_STREAM',{text:last,done:true});
  };

  const submit = async ({text,displayText='',attachments=[],deliveryId=''}) => {
    const normalized=String(text || '').trim();
    if(!normalized && !(Array.isArray(attachments) && attachments.length)) throw new Error('Mensagem vazia.');
    if(deliveryId && seenDeliveries.has(deliveryId)) return {ok:true,accepted:true,deduplicated:true};
    if(deliveryId) {
      seenDeliveries.set(deliveryId,Date.now());
      if(seenDeliveries.size>80) [...seenDeliveries.entries()].sort((a,b)=>a[1]-b[1]).slice(0,20).forEach(([key])=>seenDeliveries.delete(key));
    }
    const before=latestAssistant().text;
    await rememberMskSentPrompt(normalized, displayText || normalized, binding.projectId);
    if(attachments?.length) await attachFiles(attachments);
    if(normalized) await setComposerText(normalized);
    let button=sendButton();
    const limit=Date.now()+10000;
    while(!button && Date.now()<limit) { await sleep(200); button=sendButton(); }
    if(button) button.click();
    else {
      const el=composer();
      if(!el) throw new Error('Não encontrei o botão de enviar do Grok.');
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
      el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
    }
    emit('MSK_GROK_STATUS',{status:'sent'});
    setTimeout(scheduleMskSentRestore, 250);
    waitForNewResponse(before).catch(() => {});
    return {ok:true,accepted:true,url:location.href};
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message?.type === 'MSK_GROK_PING') { sendResponse({ok:true,url:location.href}); return; }
    if(message?.type === 'MSK_GROK_INIT') {
      (async () => {
        try {
          const payload=message.payload || {};
          binding={projectId:String(payload.projectId || ''),originTabId:payload.originTabId || null};
          emit('MSK_GROK_BOUND',{url:location.href});
          const result=await submit({text:String(payload.text || ''),displayText:String(payload.displayText || 'Contexto do projeto enviado pela MSK.'),attachments:[],deliveryId:String(payload.deliveryId || `msk-grok-init-${binding.projectId}`)});
          sendResponse(result);
        } catch(error) {
          const msg=error?.message || 'Falha ao iniciar a conversa do Grok.';
          emit('MSK_GROK_STREAM',{text:msg,done:true,error:true});
          sendResponse({ok:false,error:msg});
        }
      })();
      return true;
    }
    if(message?.type === 'MSK_GROK_PROMPT') {
      (async () => {
        try {
          const payload=message.payload || {};
          if(payload.projectId) binding.projectId=String(payload.projectId);
          if(payload.originTabId) binding.originTabId=payload.originTabId;
          const result=await submit({text:String(payload.text || ''),displayText:String(payload.displayText || payload.text || ''),attachments:Array.isArray(payload.attachments)?payload.attachments:[],deliveryId:String(payload.deliveryId || '')});
          sendResponse(result);
        } catch(error) {
          const msg=error?.message || 'Falha ao enviar para o Grok.';
          emit('MSK_GROK_STREAM',{text:msg,done:true,error:true});
          sendResponse({ok:false,error:msg});
        }
      })();
      return true;
    }
  });

  initializeMskSentCards().catch(() => {});
  setInterval(detectLimitState, 1400);
  try { chrome.runtime.sendMessage({type:'MSK_GROK_BRIDGE_HELLO'}); } catch {}
})();
