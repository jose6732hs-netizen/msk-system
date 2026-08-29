(() => {
  if (document.querySelector("#msk-root")) return;
  const asset = name => chrome.runtime.getURL(`assets/${name}`);
  const root = document.createElement("div");
  root.id = "msk-root";
  root.innerHTML = `
    <section class="msk-panel" aria-label="Chat do Guardião MSK">
      <div class="msk-head"><div class="msk-brand"><img class="msk-avatar" src="${asset("msk-agente-logo.png")}" alt="MSK Agente"><div><div class="msk-title">MSK AGENTE</div><div class="msk-subtitle">GUARDIÃO DO LOVABLE</div></div></div><div class="msk-head-actions"><a class="msk-youtube-link" href="https://www.youtube.com/@Msksistens" target="_blank" rel="noopener noreferrer" title="MSK Systems no YouTube" aria-label="Abrir canal MSK Systems no YouTube"><img src="${asset("youtube.svg")}" alt="YouTube"></a><button type="button" class="msk-guardian-toggle" aria-pressed="true" title="Proteção do chat nativo do Lovable"><img class="msk-guardian-icon" src="${asset("skill-icons/guardian.png")}" alt=""><b>Guardião</b></button><span class="msk-badge">ATIVO</span></div></div>
      <div class="msk-account-card"><div><strong class="msk-account-name">Conta MSK</strong><span class="msk-account-email">Verificando sessão…</span></div><div><b class="msk-account-plan">—</b><small class="msk-account-time"></small></div><button class="msk-account-login" hidden>Entrar</button></div>
      <div class="msk-update-card" hidden><div class="msk-update-copy"><strong class="msk-update-title">Nova versão da MSK disponível</strong><span class="msk-update-text">Uma atualização está pronta.</span><small class="msk-update-status"></small></div><div class="msk-update-actions"><button type="button" class="msk-update-now">Baixar atualização</button><button type="button" class="msk-update-verify">Verificar instalação</button></div></div>
      <div class="msk-stage"><span class="msk-stage-dot"></span><strong>Pronto</strong><span>Chat MSK em tempo real</span></div>
      <div class="msk-project"><span class="msk-project-label">ID do projeto</span><code class="msk-project-id">—</code><button class="msk-project-copy" title="Copiar ID">⧉</button></div>
      <div class="msk-sync"><span data-sync="lovable">Lovable: identificando…</span><span data-sync="github">GitHub: verificando…</span><span data-sync="database" hidden>Banco: opcional</span></div>
      <div class="msk-auto"><div class="msk-auto-actions"><button class="msk-auto-run msk-one-connect">Conectar este projeto</button><button class="msk-manual-github" hidden>✓ Já conectei</button></div><div class="msk-manual-note" hidden>Se o GitHub já foi conectado e o MSK não identificou, confirme manualmente aqui.</div><div class="msk-pub-state" data-state="unknown">Status atualizado em tempo real</div><ol class="msk-auto-steps"><li data-step="lovable">Identificar projeto Lovable</li><li data-step="github">Confirmar GitHub</li><li data-step="db" hidden>Banco opcional</li><li data-step="agent">Escolher IA / MSK</li></ol></div>
      <div class="msk-onboarding"><strong>Abra um projeto para começar</strong><span>Entre no editor de um projeto Lovable. O MSK identificará o projeto e guiará a conexão.</span><button class="msk-open-project">Abrir Lovable</button></div>
      <div class="msk-tabs"><button data-tab="chat" class="active">Chat</button><button data-tab="skills">Skills</button><button data-tab="history">Projetos</button></div>
      <div class="msk-skills" hidden>
        <div class="msk-section-label msk-section-actions">Ações do Lovable <small>PRINCIPAIS</small></div>
        <button class="msk-skill-card msk-skill-action msk-skill-watermark" data-lovable-action="badge"><img class="msk-skill-icon" src="${asset("skill-icons/watermark-heart.png")}" alt=""><span>Remover marca d'água</span></button>
        <button class="msk-skill-card msk-skill-action" data-lovable-action="publish"><img class="msk-skill-icon" src="${asset("skill-icons/deploy.png")}" alt=""><span>Publicar / atualizar</span></button>
        <button class="msk-skill-card msk-skill-action" data-lovable-action="github"><img class="msk-skill-icon" src="${asset("skill-icons/github-send.png")}" alt=""><span>Verificar GitHub</span></button>
        <div class="msk-section-label msk-section-edits">Skills de edição</div>
        <button class="msk-skill-card" data-skill="Analise o projeto, encontre a causa dos erros atuais e corrija sem alterar o que já funciona."><img class="msk-skill-icon" src="${asset("skill-icons/analysis.png")}" alt=""><span>Corrigir problemas</span></button>
        <button class="msk-skill-card" data-skill="Melhore o projeto profissionalmente, preservando identidade, conteúdo e funcionalidades existentes."><img class="msk-skill-icon" src="${asset("skill-icons/edit-code.png")}" alt=""><span>Melhorar projeto</span></button>
        <button class="msk-skill-card" data-skill="Revise e aprimore toda a experiência mobile, corrigindo cortes, sobreposições e responsividade."><img class="msk-skill-icon" src="${asset("skill-icons/preview.png")}" alt=""><span>Otimizar mobile</span></button>
        <button class="msk-skill-card" data-skill="Faça uma revisão de segurança, autenticação, permissões e dados sensíveis; corrija somente problemas confirmados."><img class="msk-skill-icon" src="${asset("skill-icons/guardian.png")}" alt=""><span>Revisar segurança</span></button>
        <button class="msk-skill-card" data-skill="Implemente a funcionalidade que vou descrever, integre ao projeto existente e preserve tudo que já funciona: "><img class="msk-skill-icon" src="${asset("skill-icons/rocket.png")}" alt=""><span>Criar funcionalidade</span></button>
      </div>
      <div class="msk-history" hidden><div class="msk-history-empty">As alterações concluídas aparecerão aqui.</div></div>
      <div class="msk-chat"><div class="msk-msg agent">Guardião ativado. Escolha ChatGPT ou Grok para este projeto; comandos e respostas aparecerão aqui em tempo real.</div></div>
      <div class="msk-attachment-tray" hidden></div>
      <div class="msk-recorder" hidden>
        <div class="msk-recorder-top"><span class="msk-rec-dot"></span><strong>Transcrevendo áudio</strong><time class="msk-rec-time">00:00</time></div>
        <div class="msk-wave" aria-label="Onda sonora da gravação"></div>
        <div class="msk-rec-text">Fale normalmente. A transcrição aparecerá aqui.</div>
        <div class="msk-rec-actions"><button type="button" class="msk-rec-cancel">Cancelar</button><button type="button" class="msk-rec-use">Usar transcrição</button></div>
      </div>
      <div class="msk-compose"><button class="msk-icon msk-attach" title="Anexar arquivos">📎</button><button class="msk-icon msk-mic" title="Gravar e transcrever áudio">🎙</button><input class="msk-input" placeholder="Enviar para sua IA"><button class="msk-icon msk-send" title="Enviar à IA escolhida">➤</button><input class="msk-file-input" type="file" multiple accept="*/*" hidden></div>
      <button class="msk-apply-update" hidden>Aplicar alteração e atualizar site</button>
      <div class="msk-foot"><span class="msk-preview">● Lovable conectado</span><span class="msk-guardian-foot">Proteção contra envio ao agente Lovable</span></div>
    </section>
    <nav class="msk-quick" aria-label="Conectores MSK">
      <div class="msk-connect-wrap">
        <button class="msk-connect msk-agent" data-action="agent" data-label="Chat MSK"><img src="${asset("msk-agente-logo.png")}" alt="MSK"></button>
      </div>
      <div class="msk-connect-wrap">
        <button class="msk-connect msk-gpt" data-action="connect-project" data-label="Conectar com ChatGPT"><img src="${asset("gpt-openai.png")}" alt="ChatGPT"></button>
      </div>
      <div class="msk-connect-wrap">
        <button class="msk-connect msk-grok" data-action="connect-grok" data-label="Conectar com Grok"><img src="${asset("grok.svg")}" alt="Grok"></button>
      </div>
    </nav>
      <button class="msk-orb" aria-label="Abrir MSK Agente"><img draggable="false" src="${asset("msk-agente-logo.png")}" alt="MSK Agente"></button>`;
  document.documentElement.appendChild(root);

  // Sessão Lovable usada apenas por ações diretas do próprio projeto, como remover a marca d'água.
  window.addEventListener("message", event => {
    if (event.source !== window || !event.data || event.data.type !== "MSK_LOVABLE_SESSION_FOUND") return;
    const token = String(event.data.token || "").replace(/^Bearer\s+/i, "").trim();
    const id = String(event.data.projectId || "").trim();
    if (!token) return;
    const values = { mskLovableToken: token, mskLovableTokenCapturedAt: Date.now() };
    if (id) values.mskLovableProjectId = id;
    chrome.storage.local.set(values).catch(() => {});
  });
  try { window.postMessage({ type: "MSK_LOVABLE_SESSION_REQUEST" }, "*"); } catch {}

  const panel = root.querySelector(".msk-panel");
  const orb = root.querySelector(".msk-orb");
  const chat = root.querySelector(".msk-chat");
  const input = root.querySelector(".msk-input");
  const fileInput = root.querySelector(".msk-file-input");
  const attachmentTray = root.querySelector(".msk-attachment-tray");
  const recorderEl = root.querySelector(".msk-recorder");
  const waveEl = root.querySelector(".msk-wave");
  const recorderText = root.querySelector(".msk-rec-text");
  const recorderTime = root.querySelector(".msk-rec-time");
  const stage = root.querySelector(".msk-stage");
  const guardianToggle = root.querySelector(".msk-guardian-toggle");
  let guardianEnabled = true;
  let guardianStateInitialized = false;
  // Aplica a mudança do Guardião imediatamente, sem depender de recarregar a página.
  const setGuardianEnabled = (enabled, { persist = false } = {}) => {
    guardianEnabled = enabled !== false;
    guardianStateInitialized = true;
    // Estado vivo no <html>: o CSS liga/desliga o bloqueio no mesmo instante,
    // sem esperar timers, MutationObserver ou recarregar a página.
    try {
      document.documentElement.setAttribute("data-msk-guardian", guardianEnabled ? "on" : "off");
      window.__MSK_GUARDIAN__ = guardianEnabled;
      window.postMessage({ type: "MSK_GUARDIAN_STATE", enabled: guardianEnabled }, "*");
    } catch {}
    // Ao desligar, o overlay some na hora; ao ligar, é recriado no próximo apply.
    if (!guardianEnabled && overlayEl) {
      try { overlayEl.remove(); } catch {}
      overlayEl = null;
    }
    applyGuardianMode();
    // Executa uma segunda passagem no próximo frame para acompanhar re-renderizações do Lovable.
    requestAnimationFrame(() => applyGuardianMode());
    if (persist) chrome.storage.local.set({ mskGuardianEnabled: guardianEnabled }).catch(() => {});
  };
  const updateButton = root.querySelector(".msk-apply-update");
  const extensionUpdateCard = root.querySelector(".msk-update-card");
  const extensionUpdateTitle = root.querySelector(".msk-update-title");
  const extensionUpdateText = root.querySelector(".msk-update-text");
  const extensionUpdateStatus = root.querySelector(".msk-update-status");
  const extensionUpdateNow = root.querySelector(".msk-update-now");
  const extensionUpdateVerify = root.querySelector(".msk-update-verify");
  const syncGithub = root.querySelector('[data-sync="github"]');
  const manualGithubBtn = root.querySelector(".msk-manual-github");
  const manualGithubNote = root.querySelector(".msk-manual-note");
  const syncDatabase = root.querySelector('[data-sync="database"]');
  const syncLovable = root.querySelector('[data-sync="lovable"]');
  let dragging = false, moved = false, dx = 0, dy = 0;
  let agentActive = false;
  let v2State = null;
  let connectedContext = { projectId: "", repo: "", db: "" };
  let activeProvider = "";
  let pendingAttachments = [];
  let mediaRecorder = null, mediaStream = null, audioContext = null, analyser = null, waveFrame = 0, recordingStartedAt = 0, recordingTimer = 0;
  let speechRecognition = null, speechFinal = "", speechInterim = "", recordedChunks = [];
  let lastTaskId = "", lastTaskStatus = "";
  let lastTaskCommand = "";
  let pendingPublishCount = 0;
  const pendingPublishCache = new Map();
  const pendingEditQueues = new Map();
  const pendingPublishKey = id => `mskPendingPublish:${id}`;
  const pendingEditKey = (id, provider) => `${String(id || "")}::${String(provider || "")}`;
  const likelyEditCommand = value => {
    const text = String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
    if (!text) return false;
    if (/^(como|por que|porque|qual|quais|o que|onde|quando|quem|explique|me explique|analise sem alterar|só analise|apenas analise)\b/.test(text)) return false;
    return /\b(mud(?:e|ar)|alter(?:e|ar)|troc(?:e|ar)|ajust(?:e|ar)|corrij(?:a|ir)|cri(?:e|ar)|adicion(?:e|ar)|inclu(?:a|ir)|remov(?:a|er)|exclu(?:a|ir)|implement(?:e|ar)|melhor(?:e|ar)|otimiz(?:e|ar)|edit(?:e|ar)|atualiz(?:e|ar)|substitu(?:a|ir)|arrum(?:e|ar)|repar(?:e|ar)|coloc(?:a|ar|que)|deix(?:e|ar)|faç(?:a|er)|change|update|fix|add|remove|create|implement|improve|optimize|edit|replace|adjust)\b/i.test(text);
  };
  const deepInspectionRequest = value => {
    const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!text) return false;
    return /\b(analise|analisar|analisa|inspecione|inspecionar|inspeciona|audite|auditar|auditoria|varredura|varrer|investigue|investigar|diagnostique|diagnosticar|revise a seguranca|revisar seguranca|verifique a seguranca|seguranca do projeto|projeto inteiro|codigo inteiro|repositorio inteiro|arquitetura inteira|encontre problemas|procure problemas|ache vulnerabilidades|vulnerabilidades)\b/i.test(text);
  };
  const integrationEditRequest = value => {
    const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!text) return false;
    return /\b(api|gateway|pagamento|pix|checkout|webhook|stripe|mercado pago|mercadopago|asaas|sigilopay|atomopay|amplo pay|integracao|integrar|credencial|client id|secret|token)\b/i.test(text)
      && /\b(mud|troc|alter|configur|conect|integr|implement|cri|adicion|substitu|atualiz|coloc)\w*/i.test(text);
  };
  const integrationIntentKey = (id, provider) => `mskIntegrationIntent:${String(id || "")}::${String(provider || "")}`;

  const queueEditIntent = (id, provider, command) => {
    const key = pendingEditKey(id, provider);
    const queue = pendingEditQueues.get(key) || [];
    queue.push({ edit: likelyEditCommand(command), at: Date.now() });
    while (queue.length > 8) queue.shift();
    pendingEditQueues.set(key, queue);
  };
  const dropLatestEditIntent = (id, provider) => {
    const key = pendingEditKey(id, provider);
    const queue = pendingEditQueues.get(key) || [];
    queue.pop();
    if (queue.length) pendingEditQueues.set(key, queue); else pendingEditQueues.delete(key);
  };
  const renderPendingPublishCount = (id = projectId()) => {
    if (!id || id !== projectId()) return;
    const count = Math.max(0, Number(pendingPublishCount || 0));
    const button = root.querySelector(".msk-auto-run");
    if (button?.dataset.mode === "publish") {
      const label = button.querySelector(".msk-primary-label");
      const badge = button.querySelector(".msk-publish-count");
      const published = button.dataset.published === "true";
      if (label) label.textContent = published ? "Atualizar projeto" : "Publicar projeto";
      if (badge) {
        badge.hidden = !published || count < 1;
        badge.textContent = count > 99 ? "99+" : String(count);
      }
      button.title = published && count > 0
        ? `${count} atualiza${count === 1 ? "ção" : "ções"} para publicar`
        : published ? "Projeto sem atualizações pendentes" : "Publicar projeto";
    }
    const skill = root.querySelector('[data-lovable-action="publish"]');
    if (skill) {
      let badge = skill.querySelector(".msk-skill-publish-count");
      if (!badge) {
        badge = document.createElement("b");
        badge.className = "msk-skill-publish-count";
        skill.appendChild(badge);
      }
      badge.hidden = count < 1;
      badge.textContent = count > 99 ? "99+" : String(count);
      skill.title = count > 0 ? `${count} atualiza${count === 1 ? "ção" : "ções"} para publicar` : "Publicar ou atualizar projeto";
    }
    const pub = root.querySelector(".msk-pub-state");
    if (pub && isPublished()) {
      pub.textContent = count > 0
        ? `Site publicado · ${count} atualiza${count === 1 ? "ção" : "ções"} para publicar`
        : "Site publicado · tudo em dia";
    }
  };
  const loadPendingPublishCount = async id => {
    if (!id) return 0;
    if (pendingPublishCache.has(id)) {
      const value = pendingPublishCache.get(id) || 0;
      if (id === projectId()) { pendingPublishCount = value; renderPendingPublishCount(id); }
      return value;
    }
    const stored = await chrome.storage.local.get(pendingPublishKey(id));
    const value = Math.max(0, Number(stored[pendingPublishKey(id)] || 0));
    pendingPublishCache.set(id, value);
    if (id === projectId()) { pendingPublishCount = value; renderPendingPublishCount(id); }
    return value;
  };
  const setPendingPublishCount = async (id, value) => {
    if (!id) return 0;
    const count = Math.max(0, Math.min(999, Number(value || 0)));
    pendingPublishCache.set(id, count);
    await chrome.storage.local.set({ [pendingPublishKey(id)]: count });
    if (id === projectId()) { pendingPublishCount = count; renderPendingPublishCount(id); }
    return count;
  };
  const incrementPendingPublishCount = async id => {
    const current = await loadPendingPublishCount(id);
    return setPendingPublishCount(id, current + 1);
  };
  const resetPendingPublishCount = async id => setPendingPublishCount(id, 0);
  const consumeEditIntent = async (id, provider, success) => {
    const key = pendingEditKey(id, provider);
    const queue = pendingEditQueues.get(key) || [];
    const intent = queue.shift();
    if (queue.length) pendingEditQueues.set(key, queue); else pendingEditQueues.delete(key);
    if (success && intent?.edit) await incrementPendingPublishCount(id);
  };
  const historyEl = root.querySelector(".msk-history");
  const historyKey = id => `mskHistory:${id}`;
  const knownProjectsKey = "mskKnownProjects";
  const pendingProjectOpenKey = "mskPendingProjectOpen";
  const lovableWorkspaceUrl = id => `https://lovable.dev/projects/${encodeURIComponent(String(id || "").trim())}`;
  const chatHistoryKey = id => `mskChatHistory:${id}`;
  const cleanProjectName = value => {
    const raw = String(value || "").replace(/\s+/g, " ").trim();
    if (!raw || /^(lovable|projeto|project|abrir|open)$/i.test(raw)) return "";
    return raw.slice(0, 90);
  };
  const projectIdFromHref = href => {
    try {
      const url = new URL(String(href || ""), location.origin);
      const match = url.pathname.match(/\/(?:projects?|p)\/([^/?#]+)/i);
      return match?.[1] || "";
    } catch { return ""; }
  };
  const readKnownProjects = async () => (await chrome.storage.local.get(knownProjectsKey))[knownProjectsKey] || {};
  const writeKnownProject = async patch => {
    const id = String(patch?.id || "").trim();
    if (!id) return null;
    const projects = await readKnownProjects();
    const previous = projects[id] || {};
    const nextName = cleanProjectName(patch.name) || cleanProjectName(previous.name) || `Projeto ${id.slice(0, 8)}`;
    projects[id] = {
      ...previous, ...patch, id, name:nextName,
      url: lovableWorkspaceUrl(id),
      firstSeenAt: previous.firstSeenAt || Date.now(),
      lastSeenAt: patch.lastSeenAt || Date.now()
    };
    await chrome.storage.local.set({ [knownProjectsKey]: projects });
    return projects[id];
  };
  const nameFromProjectLink = link => {
    const preferred = [
      link.getAttribute("data-project-name"), link.getAttribute("aria-label"), link.getAttribute("title"),
      link.querySelector?.('[data-testid*="project-name" i]')?.textContent,
      link.querySelector?.('[class*="project-name" i]')?.textContent
    ].map(cleanProjectName).find(Boolean);
    if (preferred) return preferred;
    const lines = String(link.textContent || "").split(/\n+/).map(cleanProjectName).filter(Boolean);
    return lines.find(line => line.length >= 2 && line.length <= 90 && !/^(editar|edit|abrir|open|publicado|published|há \d|\d+ min)/i.test(line)) || "";
  };
  const discoverKnownProjectsFromPage = async () => {
    const found = new Map();
    document.querySelectorAll('a[href*="/projects/"],a[href*="/project/"],a[href*="/p/"]').forEach(link => {
      const id = projectIdFromHref(link.href);
      if (!id) return;
      const current = found.get(id) || {};
      found.set(id, { id, name:nameFromProjectLink(link) || current.name || "", url:lovableWorkspaceUrl(id), lastSeenAt:Date.now() });
    });
    for (const item of found.values()) await writeKnownProject(item);
    return readKnownProjects();
  };
  const diagnosticLogKey = id => `mskDiagnostics:${id}`;
  const readDiagnostics = async id => (await chrome.storage.local.get(diagnosticLogKey(id)))[diagnosticLogKey(id)] || [];
  const saveDiagnostic = async (id, diagnostic) => {
    if (!id || !diagnostic) return;
    const key = diagnosticLogKey(id);
    const items = await readDiagnostics(id);
    items.unshift({ ...diagnostic, at: diagnostic.at || Date.now() });
    await chrome.storage.local.set({ [key]: items.slice(0, 60) });
  };
  const friendlyClientError = (code, message = "") => {
    const key = String(code || "").toUpperCase();
    const exact = {
      CHATGPT_BRIDGE_TIMEOUT:"O ChatGPT demorou para responder. Aguarde alguns segundos e tente novamente.",
      CHATGPT_TAB_CLOSED:"A conversa do ChatGPT foi fechada. Conecte o ChatGPT novamente e tente outra vez.",
      GROK_BRIDGE_TIMEOUT:"O Grok demorou para responder. Aguarde alguns segundos e tente novamente.",
      GITHUB_WRITE_PERMISSION_DENIED:"O GitHub ainda não permitiu editar este projeto. Reconecte sua conta e tente novamente.",
      GITHUB_WRITE_PERMISSION_MISSING:"Falta permissão para editar este projeto no GitHub. Reconecte sua conta e tente novamente.",
      GITHUB_AUTH_REQUIRED:"O GitHub precisa ser conectado novamente antes de continuar.",
      REPOSITORY_MISSING:"Ainda não encontrei o repositório deste projeto. Conecte o GitHub antes de continuar.",
      PROJECT_REQUIRED:"Abra o projeto que deseja editar e tente novamente.",
      PROJECT_MISMATCH:"O projeto aberto não é o mesmo que você escolheu. Abra o projeto correto e tente novamente.",
      NETWORK_TIMEOUT:"A conexão demorou mais que o normal. Tente novamente em alguns segundos.",
      NETWORK_ERROR:"Não consegui falar com o servidor agora. Confira sua internet e tente novamente."
    };
    if (exact[key]) return exact[key];
    const raw = String(message || "").replace(/\s+/g, " ").trim();
    if (/permission|permiss[aã]o|forbidden|403/i.test(raw) && /github|repo/i.test(raw)) return exact.GITHUB_WRITE_PERMISSION_DENIED;
    if (/unauthori[sz]ed|401/i.test(raw) && /github|repo/i.test(raw)) return exact.GITHUB_AUTH_REQUIRED;
    if (/timeout|tempo limite|demorou/i.test(raw)) return exact.NETWORK_TIMEOUT;
    if (/network|fetch|rede|offline/i.test(raw)) return exact.NETWORK_ERROR;
    if (/reposit[oó]rio.*n[aã]o|repository.*missing|repo.*not found/i.test(raw)) return exact.REPOSITORY_MISSING;
    if (/publica|deploy|build/i.test(raw) && /falh|fail|erro|error/i.test(raw)) return "O site não conseguiu publicar agora. Tente publicar novamente.";
    return raw ? (raw.length > 220 ? `${raw.slice(0,219)}…` : raw) : "Não consegui concluir esta etapa. Tente novamente; se continuar, o suporte MSK receberá o diagnóstico técnico.";
  };
  const friendlyClientAction = diagnostic => {
    const code = String(diagnostic?.code || diagnostic?.category || "").toUpperCase();
    if (/GITHUB.*AUTH|WRITE_PERMISSION/.test(code)) return "Clique em reconectar GitHub e tente novamente.";
    if (/REPOSITORY/.test(code)) return "Conecte o GitHub deste projeto e tente novamente.";
    if (/PROJECT/.test(code)) return "Abra o projeto correto e repita a ação.";
    if (/BRIDGE|CHATGPT|GROK/.test(code)) return "Aguarde alguns segundos. Se continuar, reconecte a IA escolhida.";
    if (/PUBLISH|DEPLOY|BUILD/.test(code)) return "Tente publicar novamente. Nenhum outro projeto será alterado.";
    return "Tente novamente. Se continuar acontecendo, o suporte MSK terá o diagnóstico técnico para analisar.";
  };
  const diagnosticText = diagnostic => {
    const d = diagnostic || {};
    return [
      `O que aconteceu: ${friendlyClientError(d.code || d.category, d.message || d.title)}`,
      `O que fazer: ${friendlyClientAction(d)}`
    ].join("\n");
  };
  const readChatHistory = async id => (await chrome.storage.local.get(chatHistoryKey(id)))[chatHistoryKey(id)] || [];
  const saveChatMessage = async (id, role, content, meta = {}) => {
    if (!id || !content) return;
    const key = chatHistoryKey(id);
    const items = await readChatHistory(id);
    items.push({ role, content: String(content).slice(0, 16000), ...meta, at: Date.now() });
    await chrome.storage.local.set({ [key]: items.slice(-80) });
  };
  const compactText = (text, max = 165) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
  };
  let discreetNoticeTimer = 0;
  const showDiscreetNotice = (message, kind = "warn", code = "") => {
    let notice = root.querySelector(".msk-discreet-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "msk-discreet-notice";
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");
      root.appendChild(notice);
    }
    const safeMessage = kind === "ok" ? String(message || "") : friendlyClientError(code, message || "O MSK encontrou um problema temporário.");
    const clean = compactText(safeMessage, 220);
    notice.dataset.kind = kind || "warn";
    // Código técnico fica somente nos logs; o cliente recebe uma frase simples.
    notice.textContent = clean;
    notice.classList.add("show");
    clearTimeout(discreetNoticeTimer);
    discreetNoticeTimer = window.setTimeout(() => notice.classList.remove("show"), 6500);
  };
  const logDiscreetIssue = async (diagnostic) => {
    const id = projectId();
    if (id && diagnostic) await saveDiagnostic(id, diagnostic).catch(() => {});
    chrome.runtime.sendMessage({
      type:"MSK_DIAGNOSTIC_LOG",
      payload:{
        level:diagnostic?.severity === "error" ? "error" : "warn",
        code:diagnostic?.code || diagnostic?.category || "CLIENT_NOTICE",
        message:diagnostic?.message || diagnostic?.title || "Problema detectado.",
        context:{ projectId:id || "", source:diagnostic?.source || "extension" }
      }
    }).catch(() => {});
  };
  const createCompactSummaryCard = (fullText, options = {}) => {
    const full = String(fullText || "").trim();
    const card = document.createElement("article");
    card.className = "msk-chat-summary";
    const head = document.createElement("button");
    head.type = "button";
    head.className = "msk-chat-summary-head";
    head.setAttribute("aria-expanded", "false");
    const top = document.createElement("span");
    top.className = "msk-chat-summary-top";
    const title = document.createElement("strong");
    title.textContent = options.title || "Resumo da execução";
    const state = document.createElement("small");
    state.textContent = options.state || "Concluído";
    top.append(title, state);
    const preview = document.createElement("span");
    preview.className = "msk-chat-summary-preview";
    preview.textContent = compactText(options.preview || full) || "Execução concluída.";
    const chevron = document.createElement("i");
    chevron.textContent = "⌄";
    head.append(top, preview, chevron);
    const detail = document.createElement("div");
    detail.className = "msk-chat-summary-detail";
    detail.hidden = true;
    detail.textContent = full || "Execução concluída.";
    head.addEventListener("click", () => {
      const open = detail.hidden;
      detail.hidden = !open;
      card.classList.toggle("expanded", open);
      head.setAttribute("aria-expanded", String(open));
      chevron.textContent = open ? "⌃" : "⌄";
      window.setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 0);
    });
    card.append(head, detail);
    return card;
  };
  const showDiagnostic = async diagnostic => {
    const id = projectId();
    const full = diagnosticText(diagnostic);
    openChat();
    chat.appendChild(createCompactSummaryCard(full, {
      title: "O que aconteceu",
      state: diagnostic?.severity === "error" ? "Precisa de atenção" : "Verificado",
      preview: friendlyClientError(diagnostic?.code || diagnostic?.category, diagnostic?.message || diagnostic?.title)
    }));
    chat.scrollTop = chat.scrollHeight;
    addGithubWriteActionCard(diagnostic);
    if (id) {
      await saveDiagnostic(id, diagnostic);
      await saveChatMessage(id, "assistant", full, {
        kind:"summary",
        title:"O que aconteceu",
        state:diagnostic?.severity === "error" ? "Precisa de atenção" : "Verificado",
        preview:compactText(friendlyClientError(diagnostic?.code || diagnostic?.category, diagnostic?.message || diagnostic?.title))
      });
    }
  };
  const addGithubWriteActionCard = diagnostic => {
    if (!diagnostic || diagnostic.actionType !== 'connect_github_write') return;
    if (chat.querySelector('.msk-github-write-action')) return;
    const card = document.createElement('section');
    card.className = 'msk-github-write-action';
    const title = document.createElement('strong');
    title.textContent = 'Permissão para iniciar a automação';
    const copy = document.createElement('p');
    copy.textContent = 'O GitHub pode estar instalado na conta, mas ainda não está ativo para edição nesta conversa. A MSK abre Plugins/Conectores, leva até o GitHub e retoma o último comando após a autorização. Isso não usa créditos do Lovable.';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary';
    button.textContent = 'Permitir e conectar GitHub';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Abrindo Plugins…';
      setStage('Conectando GitHub/Codex', 'running');
      const id = projectId();
      const cached = id ? await getCachedProjectLinks(id) : {};
      const repo = repoUrl() || cached?.repo || connectedContext.repo || '';
      const result = await runtimeMessage({ type:'MSK_CHATGPT_CONNECT_GITHUB_WRITE', payload:{ projectId:id, repo } }, 20000);
      if (!result?.ok) {
        button.disabled = false;
        button.textContent = 'Tentar abrir novamente';
        add(friendlyClientError(result?.code || 'GITHUB_AUTH_REQUIRED', result?.error || 'Não consegui abrir a autorização GitHub/Codex.'), 'agent', 'error');
        setStage('Autorização necessária', 'error');
        return;
      }
      card.remove();
      add('Conexão GitHub aberta no ChatGPT. Confirme o acesso oficial; a MSK acompanha o retorno e retoma o último comando automaticamente.', 'agent', 'running');
      setStage('Aguardando confirmação do GitHub', 'running');
    });
    card.append(title, copy, button);
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
  };

  const showLocalDiagnosticAndMirror = async diagnostic => {
    await showDiagnostic(diagnostic);
    const id = projectId();
    if (id) {
      runtimeMessage({
        type:"MSK_CHATGPT_SHOW_DIAGNOSTIC",
        payload:{ projectId:id, diagnostic }
      }, 6000).catch?.(() => {});
    }
  };
  const renderChatHistory = async id => {
    if (!id) return;
    const items = await readChatHistory(id);
    chat.replaceChildren();
    if (!items.length) {
      const welcome = document.createElement("div"); welcome.className = "msk-msg agent"; welcome.textContent = "Guardião ativado. Envie uma mensagem; o chat funciona mesmo enquanto o GitHub está sendo identificado."; chat.appendChild(welcome);
    } else {
      items.forEach(item => {
        if (item.role !== "user" && item.kind === "summary") {
          chat.appendChild(createCompactSummaryCard(item.content, { title:item.title || "Resumo da execução", state:item.state || "Concluído", preview:item.preview || item.content }));
          return;
        }
        const el = document.createElement("div");
        el.className = `msk-msg ${item.role === "user" ? "user sent" : "agent done"}`;
        el.textContent = item.content;
        chat.appendChild(el);
      });
    }
    chat.scrollTop = chat.scrollHeight;
  };
  const manualGithubKey = id => `mskManualGithub:${id}`;
  const setManualGithub = async (id, value) => chrome.storage.local.set({ [manualGithubKey(id)]: !!value });
  const getManualGithub = async id => !!(await chrome.storage.local.get(manualGithubKey(id)))[manualGithubKey(id)];
  const getCachedProjectLinks = async id => {
    if (!id) return { repo: "", db: "" };
    const cached = await runtimeMessage({ type: "MSK_GET_LINKS", projectId: id });
    const links = cached?.links || {};
    return {
      repo: links.repo ? `https://github.com/${String(links.repo).replace("https://github.com/", "")}` : "",
      db: links.db || ""
    };
  };
  const showManualGithubFallback = show => { if (manualGithubBtn) manualGithubBtn.hidden = !show; if (manualGithubNote) manualGithubNote.hidden = !show; };
  const readHistory = async id => {
    const targetId = id || projectId();
    if (!targetId) return [];
    return (await chrome.storage.local.get(historyKey(targetId)))[historyKey(targetId)] || [];
  };
  const celebrateHistoryProjectCard = card => {
    if (!(card instanceof HTMLElement) || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    card.querySelector(".msk-project-switch-confetti")?.remove();
    const burst = document.createElement("span");
    burst.className = "msk-project-switch-confetti";
    burst.setAttribute("aria-hidden", "true");
    const colors = ["#ffffff", "#70ff00", "#a65cff", "#ffe56b"];
    const pieces = 12;
    for (let i = 0; i < pieces; i += 1) {
      const piece = document.createElement("i");
      const angle = ((Math.PI * 2) / pieces) * i + (Math.random() - 0.5) * 0.24;
      const distance = 24 + Math.random() * 22;
      piece.style.setProperty("--msk-project-dx", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--msk-project-dy", `${Math.sin(angle) * distance}px`);
      piece.style.setProperty("--msk-project-delay", `${Math.random() * 0.06}s`);
      piece.style.setProperty("--msk-project-rotate", `${120 + Math.random() * 260}deg`);
      piece.style.background = colors[i % colors.length];
      burst.appendChild(piece);
    }
    card.appendChild(burst);
    card.classList.add("celebrating");
    window.setTimeout(() => card.classList.remove("celebrating"), 700);
    window.setTimeout(() => burst.remove(), 950);
  };
  const renderHistory = async () => {
    await discoverKnownProjectsFromPage().catch(() => {});
    const currentId = projectId();
    const projectsMap = await readKnownProjects();
    const projects = Object.values(projectsMap).sort((a,b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0));
    const entries = await readHistory(currentId);
    historyEl.replaceChildren();

    const projectsSection = document.createElement("section");
    projectsSection.className = "msk-history-projects";
    const projectsTitle = document.createElement("div");
    projectsTitle.className = "msk-history-section-title";
    const projectsLabel = document.createElement("strong");
    projectsLabel.textContent = "Projetos identificados";
    const projectsCount = document.createElement("span");
    projectsCount.textContent = String(projects.length);
    projectsTitle.append(projectsLabel, projectsCount);
    const projectList = document.createElement("div");
    projectList.className = "msk-history-project-list";
    if (!projects.length) {
      const emptyProjects = document.createElement("div");
      emptyProjects.className = "msk-history-empty compact";
      emptyProjects.textContent = "Abra o dashboard ou um projeto do Lovable para o MSK registrar os nomes aqui.";
      projectList.appendChild(emptyProjects);
    } else {
      projects.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "msk-history-project-btn";
        if (item.id === currentId) button.classList.add("active");
        const name = document.createElement("strong");
        name.textContent = item.name || `Projeto ${String(item.id).slice(0,8)}`;
        const meta = document.createElement("small");
        const repo = String(item.repo || "").replace("https://github.com/", "");
        meta.textContent = item.id === currentId ? "ABERTO AGORA" : (repo ? `GitHub · ${repo}` : `ID · ${String(item.id).slice(0,8)}`);
        const brand = document.createElement("span");
        brand.className = "msk-history-project-brand";
        brand.textContent = "Editado por MSK";
        button.append(name, meta, brand);
        button.addEventListener("click", async () => {
          celebrateHistoryProjectCard(button);
          const targetUrl = lovableWorkspaceUrl(item.id);
          const currentPath = location.pathname.replace(/\/+$/, "");
          const targetPath = new URL(targetUrl).pathname.replace(/\/+$/, "");
          if (item.id === projectId() && currentPath === targetPath) {
            window.setTimeout(() => root.querySelector('[data-tab="chat"]')?.click(), 300);
            return;
          }
          button.disabled = true;
          button.classList.add("loading");
          meta.textContent = "ABRINDO…";
          await chrome.storage.local.set({
            [pendingProjectOpenKey]: { projectId:String(item.id), targetUrl, source:"history", requestedAt:Date.now() }
          }).catch(() => {});
          await writeKnownProject({ ...item, url:targetUrl, lastSeenAt:Date.now() }).catch(() => {});
          window.setTimeout(() => location.assign(targetUrl), 420);
        });
        projectList.appendChild(button);
      });
    }
    projectsSection.append(projectsTitle, projectList);
    historyEl.appendChild(projectsSection);

    const changesTitle = document.createElement("div");
    changesTitle.className = "msk-history-section-title changes";
    const currentProject = currentId ? projectsMap[currentId] : null;
    const changesLabel = document.createElement("strong");
    changesLabel.textContent = `Alterações · ${currentProject?.name || (currentId ? projectName() : "Nenhum projeto aberto")}`;
    const changesCount = document.createElement("span");
    changesCount.textContent = String(entries.length);
    changesTitle.append(changesLabel, changesCount);
    historyEl.appendChild(changesTitle);

    if (!currentId) {
      const empty = document.createElement("div"); empty.className = "msk-history-empty"; empty.textContent = "Escolha um projeto acima para ver as alterações dele."; historyEl.appendChild(empty); return;
    }
    if (!entries.length) {
      const empty = document.createElement("div"); empty.className = "msk-history-empty"; empty.textContent = "Ainda não há alterações concluídas neste projeto."; historyEl.appendChild(empty); return;
    }
    entries.forEach(entry => {
      const card = document.createElement("article"); card.className = "msk-history-card";
      const head = document.createElement("button"); head.className = "msk-history-head";
      const title = document.createElement("strong"); title.textContent = entry.command || "Alteração no projeto";
      const meta = document.createElement("span"); meta.textContent = `${entry.status === "completed" ? "Aplicado" : "Preparado"} · ${new Date(entry.at).toLocaleString("pt-BR")}`;
      head.append(title, meta);
      const detail = document.createElement("div"); detail.className = "msk-history-detail"; detail.hidden = true; detail.textContent = entry.summary || "Alteração preparada com sucesso.";
      head.addEventListener("click", () => { detail.hidden = !detail.hidden; });
      card.append(head, detail); historyEl.appendChild(card);
    });
  };
  const saveHistory = async entry => {
    const key = historyKey(projectId());
    const items = await readHistory();
    const existing = items.find(item => item.taskId === entry.taskId);
    if (existing) Object.assign(existing, entry); else items.unshift(entry);
    await chrome.storage.local.set({ [key]: items.slice(0, 40) });
    renderHistory();
  };
  const addSummaryCard = entry => {
    const card = document.createElement("button"); card.className = "msk-summary-card";
    card.innerHTML = `<strong>Alteração pronta</strong><span>Ver resumo em Projetos →</span>`;
    card.addEventListener("click", () => root.querySelector('[data-tab="history"]').click());
    chat.appendChild(card); chat.scrollTop = chat.scrollHeight;
  };
  const addApprovalCard = ({ title, description, permissions = [], onConfirm, confirmLabel = "Confirmar e continuar", cancelLabel = "Agora não", pendingLabel = "Iniciando…", cancelMessage = "Conexão cancelada. Nenhuma permissão foi concedida.", cancelStage = "Conexão cancelada", onCancel }) => {
    chat.querySelectorAll(".msk-approval-card").forEach(card => card.remove());
    const card = document.createElement("section"); card.className = "msk-approval-card";
    const heading = document.createElement("strong"); heading.textContent = title;
    const copy = document.createElement("p"); copy.textContent = description;
    const list = document.createElement("ul");
    permissions.forEach(text => { const item = document.createElement("li"); item.textContent = text; list.appendChild(item); });
    const actions = document.createElement("div"); actions.className = "msk-approval-actions";
    const cancel = document.createElement("button"); cancel.className = "secondary"; cancel.textContent = cancelLabel;
    const confirm = document.createElement("button"); confirm.className = "primary"; confirm.textContent = confirmLabel;
    cancel.addEventListener("click", async () => {
      card.remove();
      if (typeof onCancel === "function") await onCancel();
      else { if (cancelMessage) add(cancelMessage, "agent"); if (cancelStage) setStage(cancelStage, "ready"); }
    });
    confirm.addEventListener("click", async () => { confirm.disabled = true; cancel.disabled = true; confirm.textContent = pendingLabel; await onConfirm(); card.remove(); });
    actions.append(cancel, confirm); card.append(heading, copy, list, actions); chat.appendChild(card); chat.scrollTop = chat.scrollHeight;
  };
  const integrationMarkerRegex = /<MSK_INTEGRATION_REQUEST>([\s\S]*?)<\/MSK_INTEGRATION_REQUEST>/i;
  const integrationFieldSensitive = field => {
    if (field?.secret === true) return true;
    if (field?.secret === false) return false;
    const sample = `${field?.key || ""} ${field?.label || ""}`.toLowerCase();
    if (/base[_\s-]?url|endpoint|callback[_\s-]?url|webhook[_\s-]?url/.test(sample)) return false;
    return /(api[_\s-]?key|token|secret|password|client[_\s-]?id|client[_\s-]?secret|cpf|cnpj|merchant[_\s-]?id|access[_\s-]?key|private)/i.test(sample);
  };
  const parseIntegrationRequest = text => {
    const raw = String(text || "");
    const match = raw.match(integrationMarkerRegex);
    if (!match) return { text:raw, request:null };
    let request = null;
    try { request = JSON.parse(match[1].trim()); } catch {}
    const cleanText = raw.replace(integrationMarkerRegex, "").replace(/\n{3,}/g,"\n\n").trim();
    if (!request || typeof request !== "object") return { text:cleanText, request:null };
    const fields = (Array.isArray(request.fields) ? request.fields : []).slice(0,12).map((field, index) => ({
      key:String(field?.key || `campo_${index+1}`).replace(/[^a-zA-Z0-9_.-]+/g,"_").slice(0,80),
      label:String(field?.label || field?.key || `Campo ${index+1}`).replace(/\s+/g," ").trim().slice(0,100),
      placeholder:String(field?.placeholder || `Cole ${field?.label || field?.key || "o valor"} aqui`).replace(/\s+/g," ").trim().slice(0,180),
      help:String(field?.help || "").replace(/\s+/g," ").trim().slice(0,220),
      required:field?.required !== false,
      secret:integrationFieldSensitive(field),
      type:String(field?.type || "text").toLowerCase()
    }));
    const mode = ["new","update"].includes(String(request.mode || "").toLowerCase()) ? String(request.mode).toLowerCase() : "update";
    const scope = ["all","selected"].includes(String(request.scope || "").toLowerCase()) ? String(request.scope).toLowerCase() : (mode === "update" ? "selected" : "all");
    return { text:cleanText, request:{ service:String(request.service || request.provider || "Integração").replace(/\s+/g," ").trim().slice(0,100), title:String(request.title || `${mode === "update" ? "Atualizar" : "Conectar"} ${request.service || "integração"}`).replace(/\s+/g," ").trim().slice(0,120), mode, scope, fields } };
  };
  const integrationStreamText = text => {
    const raw = String(text || "");
    const start = raw.search(/<MSK_INTEGRATION_REQUEST>/i);
    if (start < 0) return raw;
    const before = raw.slice(0,start).trim();
    return `${before ? `${before}\n\n` : ""}🔐 Cofre MSK · preparando os campos protegidos…`;
  };
  const addIntegrationVaultCard = request => {
    if (!request?.fields?.length) return;
    const currentProvider = activeProvider || "chatgpt";
    chrome.storage.session.remove(integrationIntentKey(projectId(), currentProvider)).catch(() => {});
    openChat();
    root.classList.add("msk-panel-open");
    panel.querySelectorAll('.msk-integration-vault-overlay').forEach(overlay => overlay.remove());
    const overlay = document.createElement('div'); overlay.className='msk-integration-vault-overlay'; overlay.setAttribute('role','presentation');
    const card = document.createElement('section'); card.className='msk-integration-vault-card'; card.setAttribute('role','dialog'); card.setAttribute('aria-modal','true');
    const head = document.createElement('div'); head.className='msk-integration-vault-head';
    const logo = document.createElement('img'); logo.src=asset('msk-agente-logo.png'); logo.alt='MSK';
    const headText = document.createElement('div');
    const title = document.createElement('strong'); title.textContent=request.title || `Conectar ${request.service}`;
    const subtitle = document.createElement('span'); subtitle.textContent='Cofre de Integrações MSK';
    const close = document.createElement('button'); close.type='button'; close.className='msk-integration-vault-close'; close.textContent='×'; close.title='Fechar'; close.setAttribute('aria-label','Fechar'); close.addEventListener('click',()=>overlay.remove());
    headText.append(title,subtitle); head.append(logo,headText,close);
    const intro=document.createElement('p'); intro.className='msk-integration-vault-intro'; intro.textContent=request.mode === 'update' ? 'Preencha somente a chave ou os campos que deseja trocar. Ao confirmar, a MSK envia somente o que estiver preenchido.' : 'Preencha os dados necessários para concluir a nova integração. Campos protegidos ficam mascarados e não entram no chat nem nos logs.';
    const form=document.createElement('div'); form.className='msk-integration-vault-fields';
    const controls=[];
    request.fields.forEach(field=>{
      const row=document.createElement('label'); row.className='msk-integration-vault-field';
      const label=document.createElement('span'); label.className='msk-integration-vault-label'; label.textContent=`${field.label}${request.mode !== 'update' && field.required ? ' *' : ''}`;
      const wrap=document.createElement('div'); wrap.className='msk-integration-vault-input-wrap';
      const inputEl=document.createElement('input');
      inputEl.type=field.secret ? 'password' : (field.type === 'url' ? 'url' : 'text');
      inputEl.autocomplete='off'; inputEl.spellcheck=false; inputEl.placeholder=field.placeholder; inputEl.dataset.key=field.key; inputEl.dataset.secret=field.secret ? 'true':'false';
      if (field.secret) {
        const eye=document.createElement('button'); eye.type='button'; eye.className='msk-integration-vault-eye'; eye.textContent='👁'; eye.title='Mostrar valor'; eye.setAttribute('aria-label','Mostrar valor');
        eye.addEventListener('click',()=>{ const showing=inputEl.type==='text'; inputEl.type=showing?'password':'text'; eye.classList.toggle('active',!showing); eye.title=showing?'Mostrar valor':'Ocultar valor'; eye.setAttribute('aria-label',eye.title); });
        wrap.append(inputEl,eye);
      } else wrap.append(inputEl);
      const help=document.createElement('small'); help.textContent=field.help || (field.secret ? 'Protegido • o valor fica oculto' : 'Valor de configuração');
      row.append(label,wrap,help); form.append(row); controls.push({ field,input:inputEl,row });
    });
    const status=document.createElement('div'); status.className='msk-integration-vault-status';
    const actions=document.createElement('div'); actions.className='msk-integration-vault-actions';
    const cancel=document.createElement('button'); cancel.type='button'; cancel.className='secondary'; cancel.textContent='Agora não'; cancel.addEventListener('click',()=>overlay.remove());
    const save=document.createElement('button'); save.type='button'; save.className='primary'; save.textContent='Confirmar e continuar';
    save.addEventListener('click',async()=>{
      const updateSelected = request.mode === 'update' || request.scope === 'selected';
      let invalid=false;
      controls.forEach(({field,input,row})=>{
        const hasValue=!!String(input.value || '').trim();
        const missing=!updateSelected && field.required && !hasValue;
        row.classList.toggle('invalid',missing);
        invalid ||= missing;
      });
      if (invalid) { status.textContent='Preencha os campos obrigatórios desta nova integração.'; status.className='msk-integration-vault-status error'; return; }
      const values=controls
        .map(({field,input})=>({ key:field.key,label:field.label,secret:field.secret,value:String(input.value || '').trim() }))
        .filter(item=>item.value);
      if (!values.length) { status.textContent='Preencha pelo menos o campo que deseja alterar.'; status.className='msk-integration-vault-status error'; return; }
      save.disabled=true; cancel.disabled=true; save.textContent='Protegendo…'; status.textContent=`Protegendo ${values.length} ${values.length === 1 ? 'campo preenchido' : 'campos preenchidos'}…`; status.className='msk-integration-vault-status';
      const result=await runtimeMessage({ type:'MSK_INTEGRATION_VAULT_SAVE', payload:{ projectId:projectId(), service:request.service, fields:values } },12000);
      if (!result?.ok) { save.disabled=false; cancel.disabled=false; save.textContent='Confirmar e continuar'; status.textContent=friendlyClientError(result?.code || '', result?.error || 'Não consegui proteger os dados.'); status.className='msk-integration-vault-status error'; return; }
      controls.forEach(({input})=>{ input.value=''; });
      status.textContent=`${values.length === 1 ? 'Campo protegido' : 'Campos protegidos'} com sucesso nesta sessão.`; status.className='msk-integration-vault-status ok';
      const provider=activeProvider || await readSelectedProvider(projectId());
      const publicFields=values.filter(item=>!item.secret).map(item=>`${item.label}: ${item.value}`);
      const protectedNames=values.filter(item=>item.secret).map(item=>item.label);
      const submittedNames=values.map(item=>item.label);
      const continuation=`Cofre MSK preenchido para ${request.service}. O cliente forneceu SOMENTE estes campos: ${submittedNames.join(', ')}. Continue a integração alterando somente esses campos e preserve as demais credenciais/configurações existentes. Não peça nem repita segredos no chat. Campos protegidos disponíveis no Cofre: ${protectedNames.join(', ') || 'nenhum'}.${publicFields.length ? ` Configurações públicas: ${publicFields.join(' | ')}.` : ''} Não exponha credenciais em arquivos versionados.`;
      window.setTimeout(()=>overlay.remove(),700);
      add(`🔐 ${request.service}: ${values.length} ${values.length === 1 ? 'campo protegido' : 'campos protegidos'}. Continuando…`,'agent','running');
      if (provider) runtimeMessage({ type:providerMessageType(provider), payload:{ projectId:projectId(), text:continuation, attachments:[] } },125000).catch(()=>{});
    });
    actions.append(cancel,save); card.append(head,intro,form,status,actions); overlay.append(card); panel.append(overlay); card.querySelector('input')?.focus();
    setStage(`${request.mode === 'update' ? 'Atualizar' : 'Conectar'} ${request.service}`,'running');
  };
  const addChatGPTApprovalCard = payload => {
    const requestId = String(payload?.requestId || "");
    if (!requestId || chat.querySelector(`[data-msk-request-id="${CSS.escape(requestId)}"]`)) return;
    openChat();
    chat.querySelectorAll(".msk-chatgpt-approval").forEach(card => card.remove());
    const card = document.createElement("section");
    card.className = "msk-approval-card msk-chatgpt-approval";
    card.dataset.mskRequestId = requestId;
    const heading = document.createElement("strong");
    heading.textContent = payload?.title || "Permissão necessária";
    const copy = document.createElement("p");
    copy.textContent = String(payload?.description || "O ChatGPT precisa da sua confirmação para continuar.").slice(0, 900);
    const actions = document.createElement("div");
    actions.className = "msk-approval-actions msk-dynamic-approval-actions";
    const choices = Array.isArray(payload?.choices) ? payload.choices : [];
    choices.forEach(choice => {
      const button = document.createElement("button");
      const label = String(choice?.label || "Continuar");
      button.textContent = label;
      button.className = /(cancel|deny|reject|not now|negar|cancelar|rejeitar|agora não|não)$/i.test(label) ? "secondary" : "primary";
      button.addEventListener("click", async () => {
        [...actions.querySelectorAll("button")].forEach(item => item.disabled = true);
        // Some imediatamente ao toque para nunca bloquear/tampar o chat.
        card.remove();
        setStage("Confirmando permissão", "running");
        const result = await runtimeMessage({ type:"MSK_CHATGPT_APPROVAL_DECISION", payload:{ projectId:projectId(), requestId, choiceId:String(choice?.choiceId || "") } }, 12000);
        if (!result?.ok) {
          add(friendlyClientError(result?.code || "", result?.error || "Essa permissão não está mais disponível. Continue pelo chat."), "agent", "error");
          setStage("ChatGPT conectado", "done");
          return;
        }
        const message = `Permissão confirmada: ${label}. Continuando…`;
        add(message, "agent", "running");
        if (projectId()) saveChatMessage(projectId(), "assistant", message);
        setStage("Continuando alteração", "running");
      });
      actions.appendChild(button);
    });
    if (!choices.length) {
      const wait = document.createElement("p"); wait.textContent = "Aguardando opções do ChatGPT…"; card.append(heading, copy, wait);
    } else card.append(heading, copy, actions);
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
    setStage("Sua permissão é necessária", "running");
  };
  const addChatGPTLimitCard = payload => {
    openChat();
    chat.querySelectorAll(".msk-chatgpt-limit").forEach(card => card.remove());
    const card = document.createElement("section");
    card.className = "msk-approval-card msk-chatgpt-limit";
    const heading = document.createElement("strong");
    const kind = String(payload?.kind || "");
    heading.textContent = kind === "conversation_length" ? "Limite desta conversa" : "Limite da conta ChatGPT";
    const copy = document.createElement("p");
    copy.textContent = String(payload?.message || "O ChatGPT informou um limite.").slice(0, 700);
    const actions = document.createElement("div");
    actions.className = "msk-approval-actions";
    if (kind === "conversation_length") {
      const continueBtn = document.createElement("button");
      continueBtn.className = "primary";
      continueBtn.textContent = "Criar nova conversa e continuar";
      continueBtn.addEventListener("click", async () => {
        continueBtn.disabled = true;
        continueBtn.textContent = "Recuperando contexto…";
        const id = projectId();
        const cached = await getCachedProjectLinks(id);
        const history = (await readChatHistory(id)).slice(-14).map(item => ({ role:item.role, content:String(item.content || "").slice(0, 1800) }));
        setStage("Continuando em nova conversa", "running");
        const result = await runtimeMessage({
          type:"MSK_CHATGPT_NEW_CONVERSATION",
          payload:{ projectId:id, repo:cached.repo || connectedContext.repo || "", projectName:projectName(), history }
        }, 15000);
        if (!result?.ok) {
          continueBtn.disabled = false;
          continueBtn.textContent = "Criar nova conversa e continuar";
          add(friendlyClientError(result?.code || "", result?.error || "Não consegui iniciar a nova conversa."), "agent", "error");
          setStage("Continuação pendente", "error");
          return;
        }
        card.remove();
        const msg = "Nova conversa criada. Recuperando o contexto e continuando do ponto anterior…";
        add(msg, "agent", "running");
        if (id) saveChatMessage(id, "assistant", msg);
        agentActive = true;
        setStage("Contexto sendo recuperado", "running");
      });
      actions.appendChild(continueBtn);
    } else {
      const openBtn = document.createElement("button");
      openBtn.className = "secondary";
      openBtn.textContent = "Ver limite no ChatGPT";
      openBtn.addEventListener("click", () => window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer"));
      actions.appendChild(openBtn);
    }
    card.append(heading, copy, actions);
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
    setStage(kind === "conversation_length" ? "Conversa atingiu o limite" : "Limite da conta atingido", "error");
  };
  const addGrokLimitCard = payload => {
    openChat();
    chat.querySelectorAll(".msk-grok-limit").forEach(card => card.remove());
    const card = document.createElement("section");
    card.className = "msk-approval-card msk-grok-limit";
    const heading = document.createElement("strong");
    const kind = String(payload?.kind || "");
    heading.textContent = kind === "conversation_length" ? "Limite desta conversa no Grok" : "Limite do Grok atingido";
    const copy = document.createElement("p");
    copy.textContent = String(payload?.message || "O Grok informou que o limite atual foi atingido.").slice(0, 700);
    const actions = document.createElement("div");
    actions.className = "msk-approval-actions";
    const openBtn = document.createElement("button");
    openBtn.className = "secondary";
    openBtn.textContent = "Ver no Grok";
    openBtn.addEventListener("click", () => window.open("https://grok.com/", "_blank", "noopener,noreferrer"));
    actions.appendChild(openBtn);
    card.append(heading, copy, actions);
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
    setStage(kind === "conversation_length" ? "Conversa do Grok atingiu o limite" : "Limite do Grok atingido", "error");
  };
  const accountCard = root.querySelector(".msk-account-card");
  const formatRemaining = seconds => {
    if (seconds === null || seconds === undefined) return "Sem vencimento definido";
    if (seconds <= 0) return "Acesso expirado";
    const days = Math.floor(seconds / 86400), hours = Math.floor((seconds % 86400) / 3600);
    return days ? `${days}d ${hours}h restantes` : `${hours}h restantes`;
  };
  let licenseInfo = null;
  let licenseTick = 0;
  const licenseRemaining = lic => {
    if (!lic?.expires_at) return "Sem vencimento";
    const ms = Date.parse(lic.expires_at) - Date.now();
    if (!(ms > 0)) return "Licença expirada";
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    const p = n => String(n).padStart(2, "0");
    return `${d > 0 ? d + "d " : ""}${p(h)}:${p(m)}:${p(s)}`;
  };
  const renderAccount = (auth, state) => {
    const loginBtn = accountCard.querySelector(".msk-account-login");
    const licensed = !!licenseInfo;
    accountCard.querySelector(".msk-account-name").textContent = state?.profile?.display_name || auth?.user?.email?.split("@")[0] || licenseInfo?.email?.split("@")[0] || "Conta MSK";
    accountCard.querySelector(".msk-account-email").textContent = auth?.user?.email || licenseInfo?.email || "Entre para ativar sua licença";
    accountCard.querySelector(".msk-account-plan").textContent = state?.plan
      ? `${String(state.plan.tier).toUpperCase()} · ${state.plan.billing_period || "mensal"}`
      : licensed ? (licenseInfo.plan_name || licenseInfo.plan || "Licença ativa") : "Não conectado";
    accountCard.querySelector(".msk-account-time").textContent = state?.plan
      ? formatRemaining(state.plan.remainingSeconds)
      : licensed ? licenseRemaining(licenseInfo) : "";
    const connected = !!auth?.ok || licensed;
    loginBtn.hidden = false;
    loginBtn.textContent = connected ? "Sair" : "Entrar";
    loginBtn.dataset.mode = connected ? "logout" : "login";
    accountCard.dataset.state = state?.plan?.status || (connected ? "active" : "login");
  };
  accountCard.querySelector(".msk-account-login").addEventListener("click", async event => {
    const btn = event.currentTarget;
    if (btn.dataset.mode !== "logout") return chrome.runtime.openOptionsPage();
    btn.disabled = true;
    btn.textContent = "Saindo…";
    await chrome.runtime.sendMessage({ type: "MSK_LICENSE_LOGOUT" }).catch(() => {});
    await chrome.runtime.sendMessage({ type: "MSK_AUTH_LOGOUT" }).catch(() => {});
    location.reload();
  });
  (async () => {
    const st = await chrome.runtime.sendMessage({ type: "MSK_LICENSE_STATUS" }).catch(() => null);
    licenseInfo = st?.ok ? { email: st.license?.email, ...st.license } : null;
    renderAccount(null, null);
    if (licenseInfo?.expires_at) {
      if (licenseTick) clearInterval(licenseTick);
      licenseTick = setInterval(() => {
        accountCard.querySelector(".msk-account-time").textContent = licenseRemaining(licenseInfo);
      }, 1000);
    }
  })();

  const returnedSession = new URLSearchParams(location.hash.replace(/^#/, "")).get("msk_session");
  if (returnedSession) {
    const returnedProjectId = location.pathname.match(/(?:projects|p)\/([0-9a-f-]{8,})/i)?.[1] || "";
    chrome.storage.local.get(["mskSessions", "mskPendingProjects"]).then(({ mskSessions = {}, mskPendingProjects = {} }) => {
      if (returnedProjectId) {
        mskSessions[returnedProjectId] = returnedSession;
        mskPendingProjects[returnedProjectId] = true;
        chrome.storage.local.set({ mskSessions, mskPendingProjects });
      }
    });
    history.replaceState(null, "", location.pathname + location.search);
  }

  const visible = el => el instanceof HTMLElement && el.offsetParent !== null;
  const nativeTextareas = () => [...document.querySelectorAll("textarea")].filter(el => !root.contains(el) && visible(el));
  const nativeTextarea = () => nativeTextareas().at(-1);
  const projectName = () => document.title.replace(/\s*[|–-]\s*Lovable.*$/i, "").trim() || "Projeto atual";
  const add = (text, who = "agent", status = "") => {
    const clean = String(text || "").trim();
    if (!clean) return;
    const el = document.createElement("div");
    el.className = `msk-msg ${who}${status ? ` ${status}` : ""}`;
    el.textContent = clean;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  };
  const openChat = () => {
    root.classList.add("msk-menu-open", "msk-panel-open");
    placePanel();
    root.querySelector('[data-tab="chat"]')?.click();
  };
  const providerStorageKey = id => `mskAIProvider:${id}`;
  const providerNames = { chatgpt:"ChatGPT", grok:"Grok" };
  const providerPrefixes = { chatgpt:"CHATGPT", grok:"GROK" };
  const providerName = provider => providerNames[provider] || "IA";
  const providerMessageType = provider => `MSK_${providerPrefixes[provider] || "CHATGPT"}_SEND`;
  const providerConnectType = provider => `MSK_${providerPrefixes[provider] || "CHATGPT"}_CONNECT_UI`;
  const providerStatusType = provider => `MSK_${providerPrefixes[provider] || "CHATGPT"}_CONNECTION_STATUS`;
  const readSelectedProvider = async id => {
    if (!id) return "";
    const stored = await chrome.storage.local.get(providerStorageKey(id));
    return ["chatgpt","grok"].includes(stored[providerStorageKey(id)]) ? stored[providerStorageKey(id)] : "";
  };
  const saveSelectedProvider = async (id, provider) => {
    if (!id || !["chatgpt","grok"].includes(provider)) return;
    activeProvider = provider;
    await chrome.storage.local.set({ [providerStorageKey(id)]:provider });
    root.querySelector(".msk-gpt")?.classList.toggle("msk-connected", provider === "chatgpt");
    root.querySelector(".msk-grok")?.classList.toggle("msk-connected", provider === "grok");
    input.placeholder = `Enviar para o ${providerName(provider)}`;
    root.querySelector(".msk-send")?.setAttribute("title", `Enviar ao ${providerName(provider)}`);
  };
  const removeProviderChooser = () => chat.querySelectorAll(".msk-provider-choice").forEach(card => card.remove());
  const showProviderChooser = (id, repository = "") => {
    if (!id) return;
    removeProviderChooser();
    openChat();
    const card = document.createElement("div");
    card.className = "msk-approval-card msk-provider-choice";
    const title = document.createElement("strong");
    title.textContent = "Qual IA deseja usar neste projeto?";
    const copy = document.createElement("p");
    copy.textContent = repository
      ? `Projeto e repositório identificados. Escolha quem vai receber os comandos da extensão MSK.`
      : "Projeto identificado. Escolha quem vai receber os comandos da extensão MSK.";
    const actions = document.createElement("div");
    actions.className = "msk-provider-actions";
    const makeButton = (provider, image, label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `msk-provider-btn ${provider}`;
      button.innerHTML = `<img src="${asset(image)}" alt=""><span>${label}</span>`;
      button.addEventListener("click", async () => {
        button.disabled = true;
        await connectAIProvider(provider);
        button.disabled = false;
      });
      return button;
    };
    actions.append(makeButton("chatgpt","gpt-openai.png","ChatGPT"), makeButton("grok","grok.svg","Grok"));
    card.append(title, copy, actions);
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
  };
  const reportChatAction = async (text, status = "done", persist = true) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    openChat();
    add(clean, "agent", status);
    const id = typeof projectId === "function" ? projectId() : "";
    if (persist && id) await saveChatMessage(id, "assistant", clean);
  };
  const setStage = (label, state = "ready") => {
    stage.className = `msk-stage ${state}`;
    stage.querySelector("strong").textContent = label;
    const executing = state === "running";
    root.classList.toggle("msk-chat-running", executing);
    const badge = root.querySelector(".msk-badge");
    if (badge) {
      badge.textContent = executing ? "EXECUTANDO" : "ATIVO";
      badge.dataset.state = executing ? "running" : state;
    }
  };
  const setChatGPTPhase = payload => {
    let el = chat.querySelector(".msk-chatgpt-phase");
    const phase = String(payload?.phase || "");
    if (!el) {
      el = document.createElement("div");
      el.className = "msk-chatgpt-phase";
      el.innerHTML = '<span class="msk-chatgpt-phase-dot"></span><div><strong></strong><small></small></div><time></time>';
      chat.appendChild(el);
    }
    el.dataset.phase = phase || "thinking";
    el.querySelector("strong").textContent = String(payload?.label || "ChatGPT trabalhando…");
    const detail = String(payload?.detail || "");
    const small = el.querySelector("small");
    small.textContent = detail;
    small.hidden = !detail;
    el.querySelector("time").textContent = new Date(Number(payload?.at || Date.now())).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    el.classList.toggle("done", phase === "done");
    el.classList.toggle("error", phase === "error");
    chat.scrollTop = chat.scrollHeight;
    if (phase === "done" || phase === "error") window.setTimeout(() => el?.remove(), phase === "done" ? 2400 : 5000);
  };
  const celebrateUpdateCard = (element, signature = "") => {
    if (!(element instanceof HTMLElement)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    if (signature && element.dataset.mskBurstSignature === signature) return;
    if (signature) element.dataset.mskBurstSignature = signature;
    element.querySelector(":scope > .msk-update-confetti")?.remove();
    const burst = document.createElement("div");
    burst.className = "msk-update-confetti";
    burst.setAttribute("aria-hidden", "true");
    const colors = ["#ffffff", "#6dff4b", "#b95cff", "#ffe56b", "#ff8bc7", "#49d7ff"];
    const pieces = 20;
    for (let i = 0; i < pieces; i += 1) {
      const piece = document.createElement("i");
      const angle = ((Math.PI * 2) / pieces) * i + (Math.random() - 0.5) * 0.34;
      const distance = 38 + Math.random() * 42;
      piece.style.setProperty("--msk-confetti-dx", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--msk-confetti-dy", `${Math.sin(angle) * distance}px`);
      piece.style.setProperty("--msk-confetti-delay", `${Math.random() * 0.06}s`);
      piece.style.setProperty("--msk-confetti-duration", `${0.78 + Math.random() * 0.28}s`);
      piece.style.setProperty("--msk-confetti-rotate", `${140 + Math.random() * 320}deg`);
      piece.style.setProperty("--msk-confetti-scale", `${0.9 + Math.random() * 0.8}`);
      piece.style.background = colors[i % colors.length];
      burst.append(piece);
    }
    element.append(burst);
    window.setTimeout(() => burst.remove(), 1350);
  };

  const runtimeMessage = (message, timeout = 7000) => new Promise(resolve => {
    let finished = false;
    const timer = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      resolve({ ok: false, error: "A verificação demorou demais. Tente conectar o projeto novamente." });
    }, timeout);
    chrome.runtime.sendMessage(message, response => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      resolve(response || { ok: false, error: chrome.runtime.lastError?.message || "Sem resposta da extensão." });
    });
  });

  const refreshExtensionUpdateCard = async ({ force = false, verify = false } = {}) => {
    if (!extensionUpdateCard) return;
    const type = verify ? "MSK_UPDATE_VERIFY" : force ? "MSK_UPDATE_CHECK" : "MSK_UPDATE_STATUS";
    const response = await runtimeMessage({ type }, 12000).catch(() => null);
    const state = response?.state || null;
    if (!state?.available) {
      extensionUpdateCard.hidden = true;
      return;
    }
    const wasHidden = extensionUpdateCard.hidden;
    const previousPhase = extensionUpdateCard.dataset.phase || "";
    extensionUpdateCard.hidden = false;
    extensionUpdateCard.dataset.mandatory = state.mandatory ? "true" : "false";
    extensionUpdateCard.dataset.phase = state.phase || "available";
    const pending = state.pendingVersion || state.latestVersion || "nova";
    const burstSignature = `${state.phase || "available"}|${state.currentVersion || ""}|${pending}|${state.licenseVerified ? "1" : "0"}`;
    if (extensionUpdateTitle) extensionUpdateTitle.textContent = state.title || (state.phase === "verify" ? "Confirme sua atualização MSK" : `MSK ${pending} disponível`);
    if (state.phase === "verify") {
      extensionUpdateText.textContent = state.message || `A versão ${state.currentVersion} já está instalada. Falta confirmar sua licença e e-mail para concluir.`;
      extensionUpdateStatus.textContent = "Este aviso só some após a confirmação da conta.";
      extensionUpdateNow.hidden = true;
      extensionUpdateVerify.hidden = false;
      extensionUpdateVerify.textContent = "Confirmar licença e versão";
    } else if (state.phase === "downloading") {
      extensionUpdateText.textContent = `Baixando a versão ${pending}. Aguarde o navegador concluir o arquivo.`;
      extensionUpdateStatus.textContent = "Depois do download, ainda será necessário instalar/recarregar a extensão.";
      extensionUpdateNow.hidden = false;
      extensionUpdateNow.disabled = true;
      extensionUpdateNow.textContent = "Download em andamento…";
      extensionUpdateVerify.hidden = false;
      extensionUpdateVerify.textContent = "Verificar";
    } else if (state.downloaded) {
      extensionUpdateText.textContent = state.message || `O arquivo da versão ${pending} foi baixado. Agora instale/recarregue a extensão.`;
      extensionUpdateStatus.textContent = "Baixar não conclui a atualização. O aviso continuará até a nova versão estar rodando.";
      extensionUpdateNow.hidden = false;
      extensionUpdateNow.disabled = false;
      extensionUpdateNow.textContent = "Baixar novamente";
      extensionUpdateVerify.hidden = false;
      extensionUpdateVerify.textContent = "Já instalei • Verificar";
    } else {
      extensionUpdateText.textContent = state.message || (state.mandatory
        ? `Atualização necessária: ${state.currentVersion} → ${pending}.`
        : `Sua versão é ${state.currentVersion}. Atualize para ${pending}.`);
      extensionUpdateStatus.textContent = "O aviso só será removido quando a versão nova + sua licença/e-mail forem confirmados.";
      extensionUpdateNow.hidden = false;
      extensionUpdateNow.disabled = false;
      extensionUpdateNow.textContent = state.mandatory ? "Baixar atualização" : "Baixar agora";
      extensionUpdateVerify.hidden = false;
      extensionUpdateVerify.textContent = "Verificar";
    }
    extensionUpdateNow.onclick = async () => {
      extensionUpdateNow.disabled = true;
      const original = extensionUpdateNow.textContent;
      extensionUpdateNow.textContent = "Preparando download…";
      const result = await runtimeMessage({ type:"MSK_UPDATE_DOWNLOAD" }, 12000).catch(() => null);
      extensionUpdateNow.disabled = false;
      extensionUpdateNow.textContent = original;
      if (!result?.ok) {
        extensionUpdateStatus.textContent = result?.message || "Não consegui iniciar o download. Tente novamente.";
        return;
      }
      extensionUpdateStatus.textContent = "Download iniciado. Depois de instalar/recarregar, clique em Verificar.";
      window.setTimeout(() => refreshExtensionUpdateCard({ force:true }).catch(() => {}), 1200);
    };
    extensionUpdateVerify.onclick = async () => {
      extensionUpdateVerify.disabled = true;
      const original = extensionUpdateVerify.textContent;
      extensionUpdateVerify.textContent = "Verificando…";
      await refreshExtensionUpdateCard({ verify:true }).catch(() => {});
      extensionUpdateVerify.disabled = false;
      extensionUpdateVerify.textContent = original;
    };
    if (wasHidden || previousPhase !== (state.phase || "available") || (state.phase === "verify")) {
      celebrateUpdateCard(extensionUpdateCard, burstSignature);
    }
  };
  const setNativeStatus = (form, text, state = "running") => {
    const top = form?.previousElementSibling?.classList.contains("msk-native-top") ? form.previousElementSibling : null;
    const bottom = form?.nextElementSibling?.classList.contains("msk-native-bottom") ? form.nextElementSibling : null;
    if (!top || !bottom) return;
    top.className = `msk-native-top ${state}`;
    top.querySelector(".msk-native-status").textContent = text;
    bottom.querySelector("[data-msk-state]").textContent = state === "done" ? "Enviado e concluído" : state === "error" ? "Falha detectada" : "Executando no Lovable";
    form.classList.toggle("msk-native-running", state === "running");
  };
  const decorateNative = textarea => {
    const form = textarea.closest("form") || textarea.parentElement?.parentElement;
    if (!form || root.contains(form)) return;
    if (form.dataset.mskDecorated === "true" && form.previousElementSibling?.classList.contains("msk-native-top")) return;
    form.dataset.mskDecorated = "true";
    form.classList.add("msk-native-composer");
    const top = document.createElement("div");
    top.className = "msk-native-top ready";
    top.innerHTML = `<span class="msk-native-brand"><img src="${asset("icon-32.png")}" alt="">Guardião MSK</span><span class="msk-native-stage"><i></i><b class="msk-native-status">Pronto</b></span><span class="msk-native-meta">${projectName()}</span>`;
    const bottom = document.createElement("div");
    bottom.className = "msk-native-bottom";
    bottom.innerHTML = `<span data-msk-state>Chat sincronizado</span><span>Uso real da conta</span><span>Preview ativo</span>`;
    form.parentElement?.insertBefore(top, form);
    form.insertAdjacentElement("afterend", bottom);
  };

  const ensureGuardianLock = form => {
    if (!form) return null;
    let lock = form.querySelector(":scope > .msk-guardian-lock");
    if (!lock) {
      lock = document.createElement("button");
      lock.type = "button";
      lock.className = "msk-guardian-lock";
      lock.innerHTML = `<img src="${asset("msk-agente-logo.png")}" alt="MSK Agente"><span><strong>MODO MSK ATIVO</strong><small>Guardião ativado · use o chat MSK. O agente do Lovable não receberá prompts.</small></span>`;
      lock.addEventListener("click", () => { openChat(); input.focus(); });
      form.appendChild(lock);
    }
    return lock;
  };
  // ---- Overlay fixo que cobre exatamente a caixa do chat nativo ----
  const composerBox = el => {
    let node = el;
    let best = null;
    for (let i = 0; i < 6 && node && node !== document.body; i++) {
      const r = node.getBoundingClientRect();
      if (r.width >= 220 && r.height >= 48) { best = node; break; }
      node = node.parentElement;
    }
    return best || el.closest("form") || el.parentElement;
  };
  const nativeComposers = () => [
    ...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""]')
  ].filter(el => !root.contains(el) && visible(el));
  let overlayEl = null;
  const ensureOverlay = () => {
    if (overlayEl && document.body.contains(overlayEl)) return overlayEl;
    overlayEl = document.createElement("button");
    overlayEl.type = "button";
    overlayEl.className = "msk-guardian-lock msk-guardian-overlay";
    overlayEl.innerHTML = `<img src="${asset("msk-agente-logo.png")}" alt="MSK Agente"><span><strong>MODO MSK ATIVO</strong><small>Guardião ativado · use o chat MSK.</small></span>`;
    overlayEl.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); });
    overlayEl.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); openChat(); input.focus(); });
    document.body.appendChild(overlayEl);
    return overlayEl;
  };
  const positionOverlay = () => {
    if (!guardianEnabled) { if (overlayEl) overlayEl.style.display = "none"; return; }
    const target = nativeComposers().at(-1);
    if (!target) { if (overlayEl) overlayEl.style.display = "none"; return; }
    const box = composerBox(target);
    if (!box) return;
    const r = box.getBoundingClientRect();
    if (r.width < 80 || r.height < 24) { if (overlayEl) overlayEl.style.display = "none"; return; }
    const ov = ensureOverlay();
    const cs = getComputedStyle(box);
    ov.style.display = "flex";
    ov.style.position = "fixed";
    ov.style.left = `${r.left}px`;
    ov.style.top = `${r.top}px`;
    ov.style.width = `${r.width}px`;
    ov.style.height = `${r.height}px`;
    ov.style.borderRadius = cs.borderRadius && cs.borderRadius !== "0px" ? cs.borderRadius : "14px";
  };
  const applyGuardianMode = () => {
    nativeTextareas().forEach(textarea => {
      decorateNative(textarea);
      const form = textarea.closest("form") || textarea.parentElement?.parentElement;
      if (!form) return;
      form.classList.toggle("msk-guardian-hard", false);
      const top = form.previousElementSibling?.classList.contains("msk-native-top") ? form.previousElementSibling : null;
      if (top) {
        top.querySelector(".msk-native-status").textContent = guardianEnabled ? "Guardião ativado" : "Interceptação ativa";
        top.classList.toggle("guardian-on", guardianEnabled);
      }
    });
    positionOverlay();
    guardianToggle?.setAttribute("aria-pressed", String(guardianEnabled));
    guardianToggle?.classList.toggle("active", guardianEnabled);
    const label = guardianToggle?.querySelector("b");
    if (label) label.textContent = guardianEnabled ? "Guardião ON" : "Guardião OFF";
  };
  window.addEventListener("scroll", positionOverlay, true);
  window.addEventListener("resize", positionOverlay, true);
  setInterval(positionOverlay, 600);

  let guardianApplyTimer = 0;
  const applyGuardian = () => {
    clearTimeout(guardianApplyTimer);
    guardianApplyTimer = window.setTimeout(applyGuardianMode, 60);
  };
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.addedNodes?.length || mutation.removedNodes?.length)) applyGuardian();
    scheduleProjectRefresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  (async () => {
    const stored = await chrome.storage.local.get("mskGuardianEnabled");
    // Não sobrescreve uma alteração feita pelo usuário enquanto a leitura inicial estava pendente.
    if (!guardianStateInitialized) setGuardianEnabled(stored.mskGuardianEnabled !== false);
  })();

  // Sincronização em tempo real: qualquer mudança do Guardião é aplicada imediatamente
  // nesta aba e nas demais abas Lovable abertas, sem F5.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.mskGuardianEnabled) return;
    setGuardianEnabled(changes.mskGuardianEnabled.newValue !== false);
  });

  guardianToggle?.addEventListener("click", () => {
    const next = !guardianEnabled;
    // A aba atual muda no mesmo clique; as demais recebem a mesma alteração por mensagem.
    setGuardianEnabled(next, { persist: false });
    chrome.runtime.sendMessage({ type: "MSK_SET_GUARDIAN_STATE", enabled: next }).catch(() => {
      chrome.storage.local.set({ mskGuardianEnabled: next }).catch(() => {});
    });
    reportChatAction(
      next
        ? "🛡 Guardião ativado. Somente o chat nativo do Lovable está bloqueado. O chat MSK continua enviando normalmente ao GPT."
        : "🛡 Guardião desativado. O chat nativo do Lovable foi liberado; o chat MSK continua independente.",
      "done"
    ).catch(() => {});
  });

  // Guardião deve proteger SOMENTE o composer nativo do Lovable.
  // Ele nunca encaminha, altera ou participa do envio do chat MSK -> ChatGPT.
  const isLovableNativeComposerTarget = target => {
    if (!(target instanceof Element) || root.contains(target)) return false;
    const editable = target.matches?.('textarea,[contenteditable="true"],[contenteditable=""]')
      ? target
      : target.closest?.('textarea,[contenteditable="true"],[contenteditable=""]');
    return !!editable && !root.contains(editable);
  };
  const blockLovableNativeSend = event => {
    if (!guardianEnabled) return false;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    openChat();
    input?.focus();
    setStage("Guardião protegendo Lovable", "ready");
    return true;
  };
  document.addEventListener("keydown", event => {
    if (!guardianEnabled || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    if (isLovableNativeComposerTarget(event.target)) blockLovableNativeSend(event);
  }, true);
  document.addEventListener("submit", event => {
    if (!guardianEnabled) return;
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || root.contains(form)) return;
    const editable = form.querySelector('textarea,[contenteditable="true"],[contenteditable=""]');
    if (editable && !root.contains(editable)) blockLovableNativeSend(event);
  }, true);
  document.addEventListener("click", event => {
    if (!guardianEnabled) return;
    const button = event.target?.closest?.("button");
    if (!button || root.contains(button)) return;
    const form = button.closest?.("form");
    const editable = form?.querySelector?.('textarea,[contenteditable="true"],[contenteditable=""]');
    if (!editable || root.contains(editable)) return;
    const label = `${button.getAttribute("aria-label") || ""} ${button.title || ""} ${button.textContent || ""}`;
    if (button.type === "submit" || /send|submit|enviar|construir/i.test(label)) blockLovableNativeSend(event);
  }, true);

  const pushToLovable = command => {
    // Proteção permanente: nenhum prompt da extensão pode ser enviado ao agente/chat do Lovable.
    console.warn("[MSK Guardião] envio ao agente Lovable bloqueado", String(command || "").slice(0, 120));
    return false;
  };
  const taskLabels = {
    queued: "Comando recebido",
    analyzing: "Analisando o projeto",
    editing: "Construindo e refinando",
    awaiting_approval: "Últimos detalhes concluídos",
    completed: "Atualização aplicada",
    failed: "Não foi possível concluir"
  };
  const watchTask = (taskId, command) => {
    lastTaskStatus = "";
    const timer = setInterval(() => {
      chrome.runtime.sendMessage({ type: "MSK_TASK_STATUS", payload: { lovable_project_id: projectId(), task_id: taskId } }, result => {
        if (!result?.ok || !result.task?.status) return;
        const status = result.task.status;
        if (status !== lastTaskStatus) {
          lastTaskStatus = status;
          const label = taskLabels[status] || "Executando alterações";
          setStage(label, status === "failed" ? "error" : status === "completed" || status === "awaiting_approval" ? "done" : "running");
          add(label, "agent", status === "failed" ? "error" : status === "completed" || status === "awaiting_approval" ? "done" : "running");
          saveChatMessage(projectId(), "assistant", label);
        }
        if (["awaiting_approval", "completed", "failed"].includes(status)) {
          clearInterval(timer);
          if (status === "awaiting_approval" || status === "completed") {
            const entry = { taskId, command, summary: result.task.summary || result.task.message || "Alterações concluídas no repositório.", status, at: Date.now() };
            saveHistory(entry);
            addSummaryCard(entry);
          }
          if (status === "awaiting_approval") {
            lastTaskId = taskId;
            updateButton.hidden = false;
          }
        }
      });
    }, 1800);
    return timer;
  };
  const readMessageContext = async () => {
    const id = refreshProjectId();
    if (!id) return { ok: false, error: "Abra um projeto no editor do Lovable antes de usar o chat." };
    const cached = await getCachedProjectLinks(id);
    const visibleRepo = repoUrl();
    const repo = visibleRepo || cached.repo || connectedContext.repo || "";
    const manualConnected = await getManualGithub(id);
    if (visibleRepo) {
      await runtimeMessage({ type: "MSK_CACHE_LINKS", projectId: id, links: { repo: visibleRepo.replace("https://github.com/", "") } });
    }
    connectedContext = { projectId: id, repo, db: "" };
    return { ok: true, manualConnected, ...connectedContext };
  };

  const removeLiveChatMessage = () => chat.querySelector(".msk-chatgpt-live")?.remove();
  const setLiveChatMessage = (text, status = "running") => {
    const clean = String(text || "").trim();
    if (!clean) return;
    let el = chat.querySelector(".msk-chatgpt-live");
    if (!el) {
      el = document.createElement("div");
      el.className = "msk-msg agent running msk-chatgpt-live";
      chat.appendChild(el);
    }
    el.className = `msk-msg agent ${status} msk-chatgpt-live`;
    const visibleText = status === "running" && clean.length > 1200 ? `…${clean.slice(-1200)}` : clean;
    el.textContent = visibleText;
    chat.scrollTop = chat.scrollHeight;
  };


  const formatFileSize = bytes => {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
  };
  const bufferToBase64 = buffer => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  const attachmentKind = item => {
    const type = String(item?.type || "").toLowerCase();
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("audio/")) return "audio";
    if (type.startsWith("video/")) return "video";
    return "file";
  };
  const attachmentDefaultName = file => {
    if (String(file?.name || "").trim()) return String(file.name).trim();
    const kind = attachmentKind(file);
    const type = String(file?.type || "").toLowerCase();
    const ext = type.includes("png") ? "png" : type.includes("jpeg") || type.includes("jpg") ? "jpg" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : type.includes("mpeg") ? "mp3" : type.includes("wav") ? "wav" : type.includes("ogg") ? "ogg" : type.includes("mp4") ? "mp4" : "bin";
    const label = kind === "image" ? "imagem-colada" : kind === "audio" ? "audio" : kind === "video" ? "video" : "arquivo";
    return `${label}-${Date.now()}.${ext}`;
  };
  let attachmentToastTimer = 0;
  const closeAttachmentToast = () => {
    const toast = root.querySelector(".msk-attachment-toast");
    if (!toast) return;
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 220);
  };
  const attachmentSuccessMessage = entries => {
    const counts = { image:0, audio:0, video:0, file:0 };
    entries.forEach(item => { counts[attachmentKind(item)] += 1; });
    const labels = [];
    if (counts.image) labels.push(`${counts.image} ${counts.image === 1 ? "imagem" : "imagens"}`);
    if (counts.audio) labels.push(`${counts.audio} ${counts.audio === 1 ? "áudio" : "áudios"}`);
    if (counts.video) labels.push(`${counts.video} ${counts.video === 1 ? "vídeo" : "vídeos"}`);
    if (counts.file) labels.push(`${counts.file} ${counts.file === 1 ? "arquivo" : "arquivos"}`);
    const total = entries.length;
    if (labels.length === 1) {
      const kind = attachmentKind(entries[0]);
      const singular = total === 1;
      const title = kind === "image" ? (singular ? "Imagem adicionada" : "Imagens adicionadas") : kind === "audio" ? (singular ? "Áudio adicionado" : "Áudios adicionados") : kind === "video" ? (singular ? "Vídeo adicionado" : "Vídeos adicionados") : (singular ? "Arquivo adicionado" : "Arquivos adicionados");
      return { title, detail:`${total} ${total === 1 ? "item pronto" : "itens prontos"} para enviar.` };
    }
    return { title:"Anexos adicionados", detail:`${labels.join(" · ")} prontos para enviar.` };
  };
  const showAttachmentToast = entries => {
    const ready = Array.from(entries || []).filter(Boolean);
    if (!ready.length) return;
    root.querySelector(".msk-attachment-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "msk-attachment-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    const logo = document.createElement("img");
    logo.src = asset("msk-agente-logo.png");
    logo.alt = "MSK";
    const copy = document.createElement("div");
    const { title, detail } = attachmentSuccessMessage(ready);
    const strong = document.createElement("strong"); strong.textContent = title;
    const span = document.createElement("span"); span.textContent = detail;
    copy.append(strong, span);
    const close = document.createElement("button");
    close.type = "button"; close.className = "msk-attachment-toast-close"; close.setAttribute("aria-label", "Fechar aviso"); close.title = "Fechar"; close.textContent = "×";
    close.addEventListener("click", () => { clearTimeout(attachmentToastTimer); closeAttachmentToast(); });
    toast.append(logo, copy, close);
    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(attachmentToastTimer);
    attachmentToastTimer = window.setTimeout(closeAttachmentToast, 4200);
  };
  const revokeAttachmentPreview = item => {
    if (!item?.previewUrl) return;
    try { URL.revokeObjectURL(item.previewUrl); } catch {}
    item.previewUrl = "";
  };

  const renderAttachmentTray = () => {
    attachmentTray.replaceChildren();
    attachmentTray.hidden = !pendingAttachments.length;
    pendingAttachments.forEach(item => {
      const chip = document.createElement("div");
      chip.className = `msk-file-chip ${item.status || "ready"}`;
      const icon = document.createElement("span");
      icon.className = "msk-file-icon";
      if (item.previewUrl && attachmentKind(item) === "image") {
        const preview = document.createElement("img");
        preview.src = item.previewUrl;
        preview.alt = "Prévia da imagem";
        icon.appendChild(preview);
        icon.classList.add("has-preview");
      } else {
        icon.textContent = item.type?.startsWith("audio/") ? "♪" : item.type?.startsWith("video/") ? "▶" : /zip|compressed|archive/i.test(item.type || item.name) ? "ZIP" : "FILE";
      }
      const info = document.createElement("span");
      info.className = "msk-file-info";
      const name = document.createElement("strong"); name.textContent = item.name;
      const meta = document.createElement("small"); meta.textContent = item.status === "uploading" ? `Preparando ${Math.round(item.progress || 0)}%` : item.status === "error" ? "Falha ao preparar" : formatFileSize(item.size);
      info.append(name, meta);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "msk-file-remove"; remove.title = "Remover anexo"; remove.textContent = "×";
      remove.addEventListener("click", async () => {
        pendingAttachments = pendingAttachments.filter(x => x.localId !== item.localId);
        revokeAttachmentPreview(item);
        renderAttachmentTray();
        if (item.uploadId) await runtimeMessage({ type:"MSK_FILE_STAGE_DISCARD", payload:{ uploadId:item.uploadId } }, 8000);
      });
      chip.append(icon, info, remove);
      attachmentTray.appendChild(chip);
    });
    placePanel();
  };
  const stageOneFile = async file => {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const type = file.type || "application/octet-stream";
    const entry = { localId, name:attachmentDefaultName(file), type, size:file.size || 0, status:"uploading", progress:0, uploadId:"", previewUrl:"" };
    if (type.startsWith("image/")) {
      try { entry.previewUrl = URL.createObjectURL(file); } catch {}
    }
    pendingAttachments.push(entry); renderAttachmentTray();
    const init = await runtimeMessage({ type:"MSK_FILE_STAGE_INIT", payload:{ projectId:projectId() || "", name:entry.name, type:entry.type, size:entry.size, lastModified:file.lastModified || Date.now() } }, 15000);
    if (!init?.ok || !init.uploadId) { entry.status="error"; renderAttachmentTray(); throw new Error(init?.error || `Não consegui preparar ${entry.name}.`); }
    entry.uploadId = init.uploadId;
    const chunkSize = Number(init.chunkSize || 524288);
    const total = Math.max(1, Math.ceil(file.size / chunkSize));
    try {
      for (let index = 0, offset = 0; offset < file.size || (file.size === 0 && index === 0); index++, offset += chunkSize) {
        const blob = file.size === 0 ? new Blob([]) : file.slice(offset, Math.min(file.size, offset + chunkSize));
        const data = bufferToBase64(await blob.arrayBuffer());
        const result = await runtimeMessage({ type:"MSK_FILE_STAGE_CHUNK", payload:{ uploadId:entry.uploadId, index, data } }, 30000);
        if (!result?.ok) throw new Error(result?.error || `Falha ao preparar ${entry.name}.`);
        entry.progress = Math.min(100, ((index + 1) / total) * 100); renderAttachmentTray();
        if (file.size === 0) break;
      }
      const done = await runtimeMessage({ type:"MSK_FILE_STAGE_FINISH", payload:{ uploadId:entry.uploadId, chunks:total } }, 15000);
      if (!done?.ok) throw new Error(done?.error || `Falha ao finalizar ${entry.name}.`);
      entry.status="ready"; entry.progress=100; renderAttachmentTray();
      return entry;
    } catch (error) {
      entry.status="error"; renderAttachmentTray();
      await runtimeMessage({ type:"MSK_FILE_STAGE_DISCARD", payload:{ uploadId:entry.uploadId } }, 8000);
      throw error;
    }
  };
  const stageSelectedFiles = async files => {
    const list = [...(files || [])].filter(file => file instanceof File || (file && typeof file.arrayBuffer === "function"));
    if (!list.length) return;
    openChat(); setStage("Preparando anexos", "running");
    const settled = await Promise.allSettled(list.map(file => stageOneFile(file)));
    const added = [];
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") added.push(result.value);
      else {
        const file = list[index];
        const error = result.reason || {};
        add(friendlyClientError(error?.code || "", error?.message || `Não consegui preparar ${file?.name || "o arquivo"}.`), "agent", "error");
      }
    });
    const ready = pendingAttachments.filter(item => item.status === "ready").length;
    setStage(ready ? `${ready} anexo${ready > 1 ? "s" : ""} pronto${ready > 1 ? "s" : ""}` : "Pronto", ready ? "done" : "ready");
    if (added.length) showAttachmentToast(added);
    fileInput.value = "";
  };
  const stopAudioSession = async ({ useTranscript = false, cancelled = false } = {}) => {
    window.clearInterval(recordingTimer); recordingTimer = 0;
    if (waveFrame) cancelAnimationFrame(waveFrame); waveFrame = 0;
    try { if (speechRecognition) speechRecognition.stop(); } catch {}
    speechRecognition = null;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      await new Promise(resolve => { const old = mediaRecorder.onstop; mediaRecorder.onstop = e => { try { old?.(e); } catch {} resolve(); }; mediaRecorder.stop(); });
    }
    mediaRecorder = null;
    mediaStream?.getTracks?.().forEach(track => track.stop()); mediaStream = null;
    try { await audioContext?.close?.(); } catch {} audioContext = null; analyser = null;
    recorderEl.hidden = true; root.querySelector(".msk-mic")?.classList.remove("listening");
    if (!cancelled && useTranscript) {
      const transcript = `${speechFinal} ${speechInterim}`.replace(/\s+/g," ").trim();
      if (transcript) {
        input.value = transcript;
        input.dispatchEvent(new Event("input", { bubbles:true }));
        add(`Transcrição pronta: “${compactText(transcript, 120)}”`, "agent", "done");
        setStage("Transcrição pronta", "done");
      } else {
        add("Não consegui gerar a transcrição automática. Você ainda pode anexar um arquivo de áudio pelo clipe.", "agent", "error");
        setStage("Transcrição indisponível", "error");
      }
      input.focus();
    } else setStage("Pronto", "ready");
    speechFinal=""; speechInterim=""; recordedChunks=[];
    placePanel();
  };
  const updateWave = () => {
    if (!analyser || recorderEl.hidden) return;
    const bars = [...waveEl.children];
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.max(1, Math.floor(data.length / Math.max(1, bars.length)));
    bars.forEach((bar, index) => {
      let sum = 0; const start = index * step; const end = Math.min(data.length, start + step);
      for (let i = start; i < end; i++) sum += data[i];
      const avg = end > start ? sum / (end - start) : 0;
      const height = Math.max(5, Math.min(34, 5 + (avg / 255) * 31));
      bar.style.height = `${height}px`;
    });
    waveFrame = requestAnimationFrame(updateWave);
  };
  const startAudioTranscription = async () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") return stopAudioSession({ useTranscript:true });
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return add("Este navegador não liberou gravação de áudio para a extensão.", "agent", "error");
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } });
      recordedChunks=[]; speechFinal=""; speechInterim="";
      const preferred = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported?.(type));
      mediaRecorder = new MediaRecorder(mediaStream, preferred ? { mimeType:preferred } : undefined);
      mediaRecorder.ondataavailable = event => { if (event.data?.size) recordedChunks.push(event.data); };
      mediaRecorder.start(500);
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(mediaStream);
      analyser = audioContext.createAnalyser(); analyser.fftSize=256; analyser.smoothingTimeConstant=.72; source.connect(analyser);
      waveEl.replaceChildren(...Array.from({length:34}, () => { const bar=document.createElement("i"); bar.style.height="5px"; return bar; }));
      recorderEl.hidden=false; root.querySelector(".msk-mic")?.classList.add("listening"); recordingStartedAt=Date.now(); recorderText.textContent="Fale normalmente. A transcrição aparecerá aqui.";
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (Recognition) {
        speechRecognition = new Recognition(); speechRecognition.lang="pt-BR"; speechRecognition.continuous=true; speechRecognition.interimResults=true;
        speechRecognition.onresult = event => {
          let interim="";
          for (let i=event.resultIndex;i<event.results.length;i++) {
            const part=event.results[i][0]?.transcript || "";
            if (event.results[i].isFinal) speechFinal += `${part} `; else interim += part;
          }
          speechInterim=interim;
          recorderText.textContent = `${speechFinal} ${speechInterim}`.replace(/\s+/g," ").trim() || "Fale normalmente. A transcrição aparecerá aqui.";
        };
        speechRecognition.onerror = () => {};
        try { speechRecognition.start(); } catch {}
      } else recorderText.textContent="Gravando áudio… A transcrição automática não está disponível neste navegador.";
      recordingTimer=window.setInterval(() => { const sec=Math.floor((Date.now()-recordingStartedAt)/1000); recorderTime.textContent=`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; },250);
      setStage("Transcrevendo áudio", "running"); updateWave(); placePanel();
    } catch (error) {
      await stopAudioSession({cancelled:true});
      add(error?.name === "NotAllowedError" ? "Permita o uso do microfone para gravar e transcrever." : `Não consegui iniciar o microfone: ${error?.message || "erro de áudio"}.`, "agent", "error");
      setStage("Microfone bloqueado", "error");
    }
  };

  let mskSendInFlight = false;
  const waitForAttachmentPreparation = async (timeoutMs = 90000) => {
    const startedAt = Date.now();
    while (pendingAttachments.some(item => item.status === "uploading")) {
      if (Date.now() - startedAt > timeoutMs) return { ok:false, code:"ATTACHMENT_PREP_TIMEOUT" };
      await new Promise(resolve => window.setTimeout(resolve, 60));
    }
    const failed = pendingAttachments.filter(item => item.status === "error");
    if (failed.length) return { ok:false, code:"ATTACHMENT_PREP_FAILED", failed };
    return { ok:true };
  };
  const setSendPendingUi = pending => {
    const button = root.querySelector(".msk-send");
    if (!button) return;
    button.disabled = !!pending;
    button.classList.toggle("msk-send-waiting", !!pending);
    button.setAttribute("aria-busy", pending ? "true" : "false");
    button.title = pending ? "Comando registrado · aguardando apenas o anexo" : `Enviar ao ${providerName(activeProvider)}`;
  };
  const restoreQueuedCommand = command => {
    if (!command || String(input.value || "").trim()) return;
    input.value = command;
    input.dispatchEvent(new Event("input", { bubbles:true }));
  };
  const markQueuedFailure = (bubble, command) => {
    if (bubble) {
      bubble.classList.remove("queued", "sent");
      bubble.classList.add("error");
      bubble.title = "Não enviado — revise o anexo e tente novamente";
    }
    restoreQueuedCommand(command);
  };
  const sendToMsk = async (commandValue, nativeInput = null) => {
    if (mskSendInFlight) return;
    const command = String(commandValue ?? input.value).trim();
    const activeItemsAtClick = pendingAttachments.filter(item => item.status !== "error");
    if (!command && !activeItemsAtClick.length) return;

    // Resolve alvo antes de consumir o texto. Se faltar projeto/provedor, nada some do campo.
    const id = refreshProjectId();
    if (!id) {
      add("Abra um projeto no editor do Lovable antes de usar o chat.", "agent", "error");
      setStage("Projeto necessário", "error");
      return;
    }
    const provider = activeProvider || await readSelectedProvider(id);
    if (!provider) {
      showProviderChooser(id, connectedContext.repo || repoUrl());
      setStage("Escolha ChatGPT ou Grok", "ready");
      return;
    }

    mskSendInFlight = true;
    setSendPendingUi(true);
    const aiName = providerName(provider);
    const deepInspection = deepInspectionRequest(command);
    const clickAttachmentNames = activeItemsAtClick.map(item => item.name);
    const userDisplay = [command, clickAttachmentNames.length ? `📎 ${clickAttachmentNames.join(", ")}` : ""].filter(Boolean).join("\n");

    // O clique é reconhecido imediatamente, igual ao composer do ChatGPT: o usuário
    // não precisa esperar a imagem terminar para saber que o envio foi aceito.
    openChat();
    const queuedBubble = add(userDisplay, "user", activeItemsAtClick.some(item => item.status === "uploading") ? "queued" : "sent");
    if (nativeInput && "value" in nativeInput) nativeInput.value = "";
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles:true }));

    const hadBusyAttachments = activeItemsAtClick.some(item => item.status === "uploading");
    if (hadBusyAttachments) {
      const busyImages = activeItemsAtClick.filter(item => item.status === "uploading" && attachmentKind(item) === "image").length;
      const label = busyImages
        ? (busyImages === 1 ? "Comando registrado · imagem carregando…" : `Comando registrado · ${busyImages} imagens carregando…`)
        : "Comando registrado · anexo carregando…";
      setStage("Envio agendado", "running");
      setLiveChatMessage(label, "running");
    } else {
      setLiveChatMessage(deepInspection ? `${aiName} · inspeção solicitada…` : "FAST EDIT · localizando apenas o alvo…", "running");
      setStage(deepInspection ? "Inspeção solicitada" : "Edição rápida", "running");
    }

    try {
      if (hadBusyAttachments) {
        const prepared = await waitForAttachmentPreparation();
        if (!prepared.ok) {
          removeLiveChatMessage();
          markQueuedFailure(queuedBubble, command);
          if (prepared.code === "ATTACHMENT_PREP_TIMEOUT") {
            add("A imagem/arquivo não terminou de preparar. O comando foi preservado e não foi enviado sem o anexo.", "agent", "error");
            setStage("Anexo não finalizado", "error");
          } else {
            const failedImages = (prepared.failed || []).filter(item => attachmentKind(item) === "image").length;
            add(failedImages ? "A imagem falhou ao preparar. O comando voltou para o campo para você tentar novamente." : "Um anexo falhou ao preparar. O comando voltou para o campo para você tentar novamente.", "agent", "error");
            setStage("Falha ao preparar anexo", "error");
          }
          return;
        }
      }

      const readyAttachments = activeItemsAtClick
        .map(clicked => pendingAttachments.find(item => item.localId === clicked.localId))
        .filter(item => item?.status === "ready" && item.uploadId);
      const failedAttachments = activeItemsAtClick
        .map(clicked => pendingAttachments.find(item => item.localId === clicked.localId))
        .filter(item => item?.status === "error");
      if (failedAttachments.length) {
        removeLiveChatMessage();
        markQueuedFailure(queuedBubble, command);
        add("Existe um anexo com falha. O MSK não enviou o texto sozinho; remova ou adicione o arquivo novamente.", "agent", "error");
        setStage("Revise o anexo", "error");
        return;
      }
      if (!command && !readyAttachments.length) {
        markQueuedFailure(queuedBubble, command);
        return;
      }

      queuedBubble?.classList.remove("queued");
      queuedBubble?.classList.add("sent");
      saveChatMessage(id, "user", userDisplay, clickAttachmentNames.length ? { attachments:clickAttachmentNames, provider } : { provider }).catch(()=>{});
      removeLiveChatMessage();
      setLiveChatMessage(readyAttachments.length
        ? (deepInspection ? `Anexo pronto · ${aiName} inspecionando…` : "Anexo pronto · FAST EDIT em andamento…")
        : (deepInspection ? `${aiName} · inspeção solicitada…` : "FAST EDIT · editando somente o alvo…"), "running");
      setStage(deepInspection ? "Inspeção solicitada" : "Edição rápida", "running");
      queueEditIntent(id, provider, command);
      if (integrationEditRequest(command)) {
        const key = integrationIntentKey(id, provider);
        await chrome.storage.session.set({ [key]: { command, at:Date.now(), retries:0 } }).catch(() => {});
      }

      const result = await runtimeMessage({
        type:providerMessageType(provider),
        payload:{
          projectId:id,
          text:command,
          attachments:readyAttachments.map(item => ({ uploadId:item.uploadId, name:item.name, type:item.type, size:item.size }))
        }
      }, 125000);
      if (!result?.ok) {
        dropLatestEditIntent(id, provider);
        removeLiveChatMessage();
        restoreQueuedCommand(command);
        const prefix = providerPrefixes[provider] || "CHATGPT";
        const recoverableCodes = [`${prefix}_NOT_CONNECTED`, `${prefix}_OPEN_FAILED`, `${prefix}_BRIDGE_LOADING`, `${prefix}_LOGIN_OR_READY_REQUIRED`];
        const diagnostic = recoverableCodes.includes(result?.code)
          ? {
              category:`${provider}_connection_recovery`, title:`Conexão do ${aiName} precisa de atenção`, source:"extension", sourceLabel:"Extensão MSK", severity:"error",
              message:result?.error || `O MSK tentou reconstruir a ponte do ${aiName} automaticamente.`,
              evidence:`Código: ${result?.code || "não informado"}`,
              action:`Confirme que você está logado no ${aiName} e tente enviar novamente. Não é necessário atualizar a página.`
            }
          : {
              category:"bridge_send_error", title:"Falha ao enviar comando", source:"extension", sourceLabel:"Extensão MSK", severity:"error",
              message:result?.error || "A ponte não conseguiu enviar a mensagem.",
              evidence:`Código: ${result?.code || "não informado"}`,
              action:`O MSK não atribuirá esse erro a créditos do Lovable sem evidência. Verifique a conversa do ${aiName} e tente novamente.`
            };
        diagnostic.code = result?.code || `${provider.toUpperCase()}_SEND_FAILED`;
        await logDiscreetIssue(diagnostic);
        showDiscreetNotice(diagnostic.message || `O ${aiName} não respondeu agora. O MSK tentou reconectar automaticamente.`, "error", diagnostic.code);
        setStage("Conexão temporariamente indisponível", "error");
        return;
      }
      setLiveChatMessage(deepInspection ? `Mensagem enviada. ${aiName} inspecionando…` : "FAST EDIT enviado · alteração em execução…", "running");
      setStage(deepInspection ? `${aiName} inspecionando` : "Aplicando alteração", "running");
      readyAttachments.forEach(revokeAttachmentPreview);
      pendingAttachments = pendingAttachments.filter(item => !readyAttachments.some(sent => sent.uploadId === item.uploadId));
      renderAttachmentTray();
    } finally {
      mskSendInFlight = false;
      setSendPendingUi(false);
    }
  };
  root.querySelector(".msk-send").addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    sendToMsk();
  });
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    sendToMsk();
  });
  root.querySelector(".msk-attach").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => stageSelectedFiles(fileInput.files));
  const eventHasFiles = event => Array.from(event?.dataTransfer?.types || []).includes("Files");
  panel.addEventListener("dragenter", event => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    panel.classList.add("msk-drag-files");
  });
  panel.addEventListener("dragover", event => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    panel.classList.add("msk-drag-files");
  });
  panel.addEventListener("dragleave", event => {
    if (event.relatedTarget && panel.contains(event.relatedTarget)) return;
    panel.classList.remove("msk-drag-files");
  });
  panel.addEventListener("drop", event => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    panel.classList.remove("msk-drag-files");
    stageSelectedFiles(event.dataTransfer?.files || []);
  });
  panel.addEventListener("paste", event => {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    stageSelectedFiles(files);
  });
  root.querySelectorAll(".msk-tabs button").forEach(button => button.addEventListener("click", () => {
    root.querySelectorAll(".msk-tabs button").forEach(item => item.classList.toggle("active", item === button));
    root.querySelector(".msk-skills").hidden = button.dataset.tab !== "skills";
    historyEl.hidden = button.dataset.tab !== "history";
    chat.hidden = button.dataset.tab !== "chat";
    root.querySelector(".msk-compose").hidden = button.dataset.tab !== "chat";
    if (button.dataset.tab === "history") renderHistory();
  }));
  root.querySelectorAll("[data-skill]").forEach(button => button.addEventListener("click", () => {
    input.value = button.dataset.skill || "";
    root.querySelector('[data-tab="chat"]').click();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }));
  root.querySelector(".msk-open-project").addEventListener("click", event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Abrindo…";
    chrome.runtime.sendMessage({ type: "MSK_CONNECT", provider: "lovable" }, () => {
      window.setTimeout(() => { button.disabled = false; button.textContent = "Abrir Lovable"; }, 900);
    });
  });
  updateButton.addEventListener("click", async () => {
    openChat();
    updateButton.disabled = true;
    updateButton.textContent = "Atualizando preview…";
    setStage("Atualizando preview/site", "running");
    await reportChatAction("Alteração já deve estar no GitHub. Atualizando somente o preview/publicação do Lovable…", "running");
    try {
      await publishUpdateOnly();
    } finally {
      updateButton.disabled = false;
      updateButton.textContent = "Atualizar preview / site";
    }
  });

  root.querySelector(".msk-mic").addEventListener("click", () => startAudioTranscription());
  root.querySelector(".msk-rec-cancel").addEventListener("click", () => stopAudioSession({ cancelled:true }));
  root.querySelector(".msk-rec-use").addEventListener("click", () => stopAudioSession({ useTranscript:true }));

  const placePanel = () => {
    if (!root.classList.contains("msk-panel-open")) return;
    requestAnimationFrame(() => {
      const margin = 8, gap = 12, orbRect = orb.getBoundingClientRect(), rect = panel.getBoundingClientRect();
      const width = Math.min(rect.width || 380, innerWidth - margin * 2), height = Math.min(rect.height || 540, innerHeight - margin * 2);
      let left = orbRect.left - width - gap;
      if (left < margin) left = orbRect.right + gap;
      if (left + width > innerWidth - margin) left = Math.max(margin, (innerWidth - width) / 2);
      panel.style.left = `${Math.round(left)}px`; panel.style.top = `${Math.round(Math.max(margin, Math.min(orbRect.bottom - height, innerHeight - height - margin)))}px`;
    });
  };
  addEventListener("resize", placePanel);
  orb.addEventListener("dragstart", e => e.preventDefault());
  orb.addEventListener("pointerdown", e => { e.preventDefault(); dragging = true; moved = false; dx = e.clientX - root.getBoundingClientRect().left; dy = e.clientY - root.getBoundingClientRect().top; orb.setPointerCapture(e.pointerId); });
  orb.addEventListener("pointermove", e => { if (!dragging) return; moved = true; root.style.left = Math.max(8, Math.min(innerWidth - 70, e.clientX - dx)) + "px"; root.style.top = Math.max(8, Math.min(innerHeight - 70, e.clientY - dy)) + "px"; root.style.right = "auto"; root.style.bottom = "auto"; placePanel(); });
  orb.addEventListener("pointerup", () => { dragging = false; if (!moved) { root.classList.toggle("msk-menu-open"); if (!root.classList.contains("msk-menu-open")) root.classList.remove("msk-panel-open"); placePanel(); } });
  root.querySelector("[data-action='agent']").addEventListener("click", () => { root.classList.toggle("msk-panel-open"); placePanel(); input.focus(); });
  const setProjectPending = async (id, pending) => {
    const { mskPendingProjects = {} } = await chrome.storage.local.get("mskPendingProjects");
    mskPendingProjects[id] = pending;
    await chrome.storage.local.set({ mskPendingProjects });
  };
  const connectProject = async (knownRepo = "") => {
    const id = refreshProjectId();
    openChat();
    if (!id) return add("Abra um projeto no editor do Lovable antes de conectar.", "agent", "error");
    markStep("lovable", "done");
    setStage("Projeto identificado", "done");
    setPrimaryConnectionLabel("Projeto identificado", "done");
    await reportChatAction(`Projeto ${id} identificado.`, "running");
    const hintedRepo = (typeof knownRepo === "string" && knownRepo) || "";
    if (!hintedRepo) {
      await sleep(140);
      markStep("github", "running");
      setStage("Procurando repositório", "running");
      setPrimaryConnectionLabel("Procurando repositório…", "running");
    }
    const cached = await getCachedProjectLinks(id);
    const nativeRepo = hintedRepo || repoUrl() || cached.repo || "";
    if (!nativeRepo) {
      const manual = await getManualGithub(id);
      if (manual) {
        markStep("github", "done");
        syncGithub.textContent = "GitHub: conectado (confirmado)";
        syncGithub.dataset.state = "connected";
        setStage("Projeto conectado", "done");
        setPrimaryConnectionLabel("GitHub confirmado", "done");
        updatePrimaryProjectButton(true);
        showManualGithubFallback(false);
        await reportChatAction("✅ Projeto conectado. GitHub confirmado manualmente. Agora escolha ChatGPT ou Grok para este projeto.", "done");
        showProviderChooser(id, "");
        return true;
      }
      if (!(await requirePublishBeforeGithub(id, () => connectProject()))) return false;
      setStage("Abrindo conexão GitHub", "running");
      setPrimaryConnectionLabel("Aguardando confirmação…", "waiting");
      await startGitGuide(id);
      return false;
    }
    setStage("Repositório identificado", "running");
    setPrimaryConnectionLabel("Repositório identificado", "done");
    await reportChatAction(`✅ Repositório identificado: ${nativeRepo.replace("https://github.com/", "")}.`, "done");
    await setManualGithub(id, true);
    await setProjectPending(id, false);
    connectedContext = { projectId:id, repo:nativeRepo, db:"" };
    await runtimeMessage({ type:"MSK_CACHE_LINKS", projectId:id, links:{ repo:nativeRepo.replace("https://github.com/", "") } });
    markStep("github", "done");
    markStep("db", "skip");
    markStep("agent", "idle");
    syncGithub.textContent = `GitHub: conectado · ${nativeRepo.replace("https://github.com/", "")}`;
    syncGithub.dataset.state = "connected";
    showManualGithubFallback(false);
    setStage("Projeto conectado", "done");
    updatePrimaryProjectButton(true);
    await reportChatAction(`✅ Projeto conectado. Repositório salvo: ${nativeRepo.replace("https://github.com/", "")}. Agora escolha ChatGPT ou Grok.`, "done");
    showProviderChooser(id, nativeRepo);
    await finishGitGuide(id);
    return true;
  };
  const requestProjectConnection = () => {
    root.classList.add("msk-menu-open", "msk-panel-open"); placePanel();
    root.querySelector('[data-tab="chat"]').click();
    setStage("Confirmação necessária", "running");
    addApprovalCard({
      title: "Autorizar MSK neste projeto?",
      description: "A extensão identifica e salva o projeto/repositório. Depois você escolhe ChatGPT ou Grok para receber os comandos.",
      permissions: ["Identificar o projeto Lovable aberto", "Salvar localmente o repositório deste projeto", "Abrir a conversa do ChatGPT ou Grok quando solicitado", "Mostrar respostas e status no chat da extensão"],
      onConfirm: connectProject
    });
  };
  const activateVisibleProject = async () => connectProject(repoUrl());
  const showProjectPicker = async () => {
    const id = refreshProjectId();
    if (!id) return add("Abra um projeto do Lovable primeiro.", "agent", "error");
    await reportChatAction("Abra a área GitHub deste projeto para o MSK identificar o repositório automaticamente, ou use “Já conectei”.", "pending");
    return startGitGuide(id);
  };
  const loadV2State = async () => {
    const id = projectId();
    if (!id) { agentActive = false; activeProvider = ""; setStage("Abra um projeto", "ready"); return null; }
    const cached = await getCachedProjectLinks(id);
    const visibleRepository = repoUrl();
    const manualConfirmed = await getManualGithub(id);
    const repository = visibleRepository || cached.repo || "";
    if (visibleRepository) await runtimeMessage({ type:"MSK_CACHE_LINKS", projectId:id, links:{ repo:visibleRepository.replace("https://github.com/", "") } });
    if (repository || manualConfirmed) {
      markStep("github", "done");
      syncGithub.textContent = repository ? `GitHub: conectado · ${repository.replace("https://github.com/", "")}` : "GitHub: conectado (confirmado)";
      syncGithub.dataset.state = "connected";
      showManualGithubFallback(false);
    } else {
      markStep("github", "idle");
      syncGithub.textContent = "GitHub: aguardando";
      syncGithub.dataset.state = "pending";
    }
    const selected = await readSelectedProvider(id);
    const [gptState, grokState] = await Promise.all([
      runtimeMessage({ type:"MSK_CHATGPT_CONNECTION_STATUS", payload:{ projectId:id } }, 5000),
      runtimeMessage({ type:"MSK_GROK_CONNECTION_STATUS", payload:{ projectId:id } }, 5000)
    ]);
    const states = { chatgpt:gptState, grok:grokState };
    let provider = selected;
    if (provider && !states[provider]?.connected) provider = ["chatgpt","grok"].find(name => states[name]?.connected) || provider;
    if (!provider) provider = ["chatgpt","grok"].find(name => states[name]?.connected) || "";
    const providerConnected = !!(provider && states[provider]?.connected);
    agentActive = providerConnected;
    if (provider) await saveSelectedProvider(id, provider);
    else {
      activeProvider = "";
      root.querySelector(".msk-gpt")?.classList.remove("msk-connected");
      root.querySelector(".msk-grok")?.classList.remove("msk-connected");
      input.placeholder = "Enviar para sua IA";
    }
    markStep("agent", agentActive ? "done" : "idle");
    const stageLabel = agentActive
      ? `${providerName(provider)} conectado`
      : (repository || manualConfirmed ? "Escolha ChatGPT ou Grok" : "GitHub aguardando confirmação");
    setStage(stageLabel, agentActive || repository || manualConfirmed ? "done" : "ready");
    connectedContext = { projectId:id, repo:repository, db:"" };
    if ((repository || manualConfirmed) && !agentActive && !chat.querySelector(".msk-provider-choice")) showProviderChooser(id, repository);
    return { authorized:!!(repository || manualConfirmed), activeProjectId:id, repository, chatConnected:agentActive, provider, gptConnected:!!gptState?.connected, grokConnected:!!grokState?.connected };
  };
  const connectProjectV2 = async () => connectProject();
  const pollProjectStatus = async () => loadV2State();
  setTimeout(loadV2State, 700);

  /* ============ ID DO PROJETO SINCRONIZADO ============ */
  const idEl = root.querySelector(".msk-project-id");
  const validProjectId = value => {
    const clean = String(value || "").trim();
    return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(clean) || /^[a-z0-9][a-z0-9_-]{7,}$/i.test(clean) ? clean : "";
  };
  const projectId = () => {
    const url = new URL(location.href);
    const segments = url.pathname.split("/").filter(Boolean);
    const routeIndex = segments.findIndex(segment => /^(projects?|p)$/i.test(segment));
    const routeId = routeIndex >= 0 ? validProjectId(segments[routeIndex + 1]) : "";
    if (routeId) return routeId;
    for (const key of ["projectId", "project_id", "project", "id"]) {
      const queryId = validProjectId(url.searchParams.get(key));
      if (queryId) return queryId;
    }
    const pageLinks = [...document.querySelectorAll('a[href*="/projects/"],a[href*="/project/"],a[href*="/p/"]')]
      .map(link => projectIdFromHref(link.href)).map(validProjectId).filter(Boolean);
    const uniquePageLinks = [...new Set(pageLinks)];
    const singlePageProject = uniquePageLinks.length === 1 ? uniquePageLinks[0] : "";
    return singlePageProject || validProjectId(location.hostname.match(/([0-9a-f]{8}-[0-9a-f-]{27,})/i)?.[1]);
  };
  let currentProjectId = "";
  let projectRefreshTimer = 0;
  const activateRequestedProject = async id => {
    if (!id) return false;
    const pending = (await chrome.storage.local.get(pendingProjectOpenKey))[pendingProjectOpenKey] || null;
    if (!pending?.projectId) return false;
    if (Date.now() - Number(pending.requestedAt || 0) > 120000) {
      await chrome.storage.local.remove(pendingProjectOpenKey);
      return false;
    }
    if (String(pending.projectId) !== String(id)) return false;
    await chrome.storage.local.remove(pendingProjectOpenKey);
    root.classList.add("msk-menu-open", "msk-panel-open");
    placePanel();
    root.querySelector('[data-tab="chat"]')?.click();
    setStage(`Projeto iniciado · ${projectName()}`, "done");
    window.setTimeout(() => loadV2State().catch(() => {}), 80);
    showDiscreetNotice(`Projeto ${projectName()} aberto e iniciado pelo MSK.`, "ok", "PROJETO");
    return true;
  };
  const scheduleProjectRefresh = () => {
    clearTimeout(projectRefreshTimer);
    projectRefreshTimer = window.setTimeout(() => {
      refreshProjectId();
      refreshSyncCards();
    }, 180);
  };
  const refreshProjectId = () => {
    const id = projectId();
    idEl.textContent = id || "sem projeto aberto";
    idEl.classList.toggle("msk-project-empty", !id);
    document.querySelectorAll(".msk-native-meta").forEach(el => {
      el.textContent = id ? `${projectName()} \u00b7 ID ${id}` : projectName();
    });
    root.querySelector(".msk-onboarding").hidden = !!id;
    root.querySelector(".msk-auto").hidden = !id;
    root.querySelector(".msk-compose").classList.toggle("disabled", !id);
    if (id && id !== currentProjectId) {
      currentProjectId = id;
      writeKnownProject({ id, name:projectName(), url:lovableWorkspaceUrl(id), lastSeenAt:Date.now() }).catch(() => {});
      activateRequestedProject(id).catch(() => {});
      discoverKnownProjectsFromPage().catch(() => {});
      agentActive = false;
      connectedContext = { projectId: id, repo: "", db: "" };
      renderChatHistory(id);
      Promise.all([getManualGithub(id), getCachedProjectLinks(id)]).then(([manual, cached]) => {
        if (currentProjectId !== id) return;
        if (cached.repo) {
          writeKnownProject({ id, name:projectName(), repo:cached.repo, url:lovableWorkspaceUrl(id), lastSeenAt:Date.now() }).catch(() => {});
          agentActive = false;
          connectedContext = { projectId: id, repo: cached.repo, db: cached.db || "" };
          syncGithub.textContent = `GitHub: conectado · ${cached.repo.replace("https://github.com/", "")}`;
          syncGithub.dataset.state = "connected";
          markStep("github", "done");
          showManualGithubFallback(false);
          return;
        }
        if (manual) {
          agentActive = false;
          syncGithub.textContent = "GitHub: conectado (confirmado)";
          syncGithub.dataset.state = "connected";
          markStep("github", "done");
          showManualGithubFallback(false);
        }
        loadV2State().catch(() => {});
      });
      syncLovable.textContent = `Lovable: ${id}`;
      syncLovable.dataset.state = "connected";
      chrome.runtime.sendMessage({ type:"MSK_DIAGNOSTIC_LOG", payload:{ level:"info", code:"PROJECT_IDENTIFIED", message:"Projeto Lovable identificado.", context:{ projectId:id } } }).catch(() => {});
      setStage("Projeto identificado", "done");
      window.setTimeout(() => showEnvironmentDoctor().catch(() => {}), 1100);
    }
    return id;
  };
  root.querySelector(".msk-project-copy").addEventListener("click", () => {
    const id = projectId();
    if (!id) return add("Nenhum projeto aberto para copiar o ID.", "agent", "error");
    navigator.clipboard?.writeText(id);
    add(`ID copiado: ${id}`, "agent", "sent");
  });
  refreshProjectId();
  discoverKnownProjectsFromPage().catch(() => {});
  window.setTimeout(() => discoverKnownProjectsFromPage().catch(() => {}), 1400);
  window.setTimeout(() => discoverKnownProjectsFromPage().catch(() => {}), 4200);
  let routeRefreshTimer = 0;
  const scheduleRouteRefresh = () => {
    clearTimeout(routeRefreshTimer);
    routeRefreshTimer = window.setTimeout(() => { refreshProjectId(); refreshSyncCards(); discoverKnownProjectsFromPage().catch(() => {}); }, 120);
  };
  addEventListener("popstate", scheduleRouteRefresh);
  addEventListener("hashchange", scheduleRouteRefresh);
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = (...args) => { const result = originalPushState(...args); scheduleRouteRefresh(); return result; };
  history.replaceState = (...args) => { const result = originalReplaceState(...args); scheduleRouteRefresh(); return result; };

  const requestLovableSession = async id => {
    let stored = await chrome.storage.local.get(["mskLovableToken", "mskLovableProjectId"]);
    let token = String(stored.mskLovableToken || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      try { window.postMessage({ type: "MSK_LOVABLE_SESSION_REQUEST" }, "*"); } catch {}
      await sleep(650);
      stored = await chrome.storage.local.get(["mskLovableToken", "mskLovableProjectId"]);
      token = String(stored.mskLovableToken || "").replace(/^Bearer\s+/i, "").trim();
    }
    if (!token) throw new Error("Sessão do Lovable não encontrada. Faça uma ação no editor e tente novamente.");
    return { token, projectId: id || String(stored.mskLovableProjectId || "").trim() };
  };

  const lovableFilePath = file => String(file?.path || file?.name || file?.file_path || "").replace(/^\//, "");
  const lovableFileContent = file => file?.content ?? file?.contents ?? file?.text ?? null;
  const findLovableGlobalCss = files => {
    const list = Array.isArray(files) ? files : [];
    const known = ["src/styles.css", "src/index.css", "src/App.css", "src/global.css", "src/globals.css", "app/globals.css", "styles/globals.css"];
    for (const wanted of known) {
      const hit = list.find(file => lovableFilePath(file) === wanted && typeof lovableFileContent(file) === "string");
      if (hit) return { path: lovableFilePath(hit), css: lovableFileContent(hit) };
    }
    const fallback = list.find(file => {
      const path = lovableFilePath(file);
      const css = lovableFileContent(file);
      return /\.css$/i.test(path) && !/node_modules/i.test(path) && typeof css === "string" && (/@tailwind|@import\s+["']tailwindcss/i.test(css) || /:root\s*\{/i.test(css));
    });
    if (fallback) return { path: lovableFilePath(fallback), css: lovableFileContent(fallback) };
    throw new Error("CSS global do projeto não encontrado.");
  };

  const ensureLovableBadgeHidden = css => {
    const source = String(css || "");
    if (/#lovable-badge[^{}]*\{[^}]*display\s*:\s*none(?:\s*!important)?/i.test(source)) return { changed: false, css: source };
    const rule = "#lovable-badge {\n  display: none !important;\n}";
    return { changed: true, css: `${source.replace(/\s+$/, "")}${source.trim() ? "\n\n" : ""}${rule}\n` };
  };

  const removeLovableWatermarkDirect = async id => {
    const session = await requestLovableSession(id);
    const source = await runtimeMessage({ type: "MSK_LOVABLE_SOURCE_CODE", projectId: id, token: session.token }, 25000);
    if (!source?.ok || !Array.isArray(source.files)) throw new Error(source?.error || "Falha ao carregar os arquivos do projeto.");
    const current = findLovableGlobalCss(source.files);
    const updated = ensureLovableBadgeHidden(current.css);
    if (!updated.changed) return { ok: true, alreadyRemoved: true, path: current.path };
    const saved = await runtimeMessage({ type: "MSK_LOVABLE_EDIT_CODE", projectId: id, token: session.token, path: current.path, content: updated.css }, 25000);
    if (!saved?.ok) throw new Error(saved?.error || "Falha ao salvar a remoção da marca d'água.");
    return { ok: true, alreadyRemoved: false, path: current.path };
  };

  /* ============ AUTOMACAO COMPLETA ============ */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clickables = () => [...document.querySelectorAll('button,[role="button"],[role="menuitem"],[role="tab"],a')]
    .filter(el => !root.contains(el) && visible(el) && !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true");
  const label = el => `${el.innerText || ""} ${el.getAttribute("aria-label") || ""} ${el.title || ""}`.replace(/\s+/g, " ").trim();
  const findByText = re => clickables().find(el => re.test(label(el)));
  const waitFor = async (fn, timeout = 45000, every = 700) => {
    const limit = Date.now() + timeout;
    while (Date.now() < limit) {
      let hit = null;
      try { hit = fn(); } catch { hit = null; }
      if (hit) return hit;
      await sleep(every);
    }
    return null;
  };
  const clickEl = async el => {
    if (!el) return false;
    try {
      el.scrollIntoView({ block: "center" });
      el.click();
      await sleep(800);
      return true;
    } catch { return false; }
  };
  const clickText = async (re, timeout = 10000) => clickEl(await waitFor(() => findByText(re), timeout));
  const actionKey = id => `mskLovableAction:${id}`;
  const startLovableAction = async type => {
    const id = refreshProjectId();
    openChat();
    if (!id) return reportChatAction("Abra um projeto Lovable antes de usar esta ação.", "error");
    if (type === "publish") return publishUpdateOnly();
    if (type === "github") {
      await reportChatAction("Verificando o GitHub deste projeto…", "running");
      return runConnectPipeline();
    }
    if (type !== "badge") return reportChatAction("Esta ação não é necessária para editar o projeto.", "done");
    await reportChatAction("Removendo marca d'água diretamente no projeto…", "running", false);
    setStage("Removendo marca d'água", "running");
    try {
      const result = await removeLovableWatermarkDirect(id);
      const message = result.alreadyRemoved
        ? "✅ A marca d'água já estava removida. Nenhuma regra foi duplicada."
        : "✅ Marca d'água removida automaticamente. Atualize a prévia do projeto para visualizar.";
      await reportChatAction(message, "done");
      setStage("Marca d'água removida", "done");
    } catch (error) {
      const message = `Não foi possível remover a marca d'água: ${error?.message || error}`;
      await reportChatAction(message, "error");
      setStage("Falha na remoção", "error");
    }
  };
  const finishLovableAction = async (id, state, message, kind = "done") => {
    await chrome.storage.local.set({ [`mskActionResult:${id}`]: { message, kind, at: Date.now() } });
    await chrome.storage.local.remove(actionKey(id));
    if (state.returnUrl && state.returnUrl !== location.href) location.assign(state.returnUrl);
    else { await reportChatAction(message, kind); setStage(kind === "done" ? "Ação concluída" : "Ação com pendência", kind); }
  };
  const resumeLovableAction = async () => {
    const id = refreshProjectId(); if (!id) return;
    const stored = await chrome.storage.local.get([actionKey(id), `mskActionResult:${id}`]);
    const result = stored[`mskActionResult:${id}`];
    if (result) {
      await reportChatAction(result.message, result.kind || "done");
      setStage(result.kind === "error" ? "Ação com pendência" : "Ação concluída", result.kind || "done");
      await chrome.storage.local.remove(`mskActionResult:${id}`);
    }
    const state = stored[actionKey(id)]; if (!state) return;
    if (state.type === "database") {
      await finishLovableAction(id, state, "Área de Cloud/banco aberta. A conexão usa somente os controles oficiais do Lovable e do Supabase.", "done");
      return;
    }
    if (state.type === "badge") {
      await chrome.storage.local.remove(actionKey(id));
      return;
    }
  };
  root.querySelectorAll("[data-lovable-action]").forEach(button => button.addEventListener("click", () => startLovableAction(button.dataset.lovableAction)));
  const closeOverlays = async () => {
    const close = findByText(/^(close|fechar|cancel|cancelar)$/i);
    if (close) await clickEl(close);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(400);
  };
  const publishedUrl = () => [...document.querySelectorAll("a[href*='lovable.app'], a[href*='lovableproject.com']")]
    .map(a => a.href)
    .find(h => /^https?:\/\/[^/]+\.(lovable\.app|lovableproject\.com)/.test(h) && !/id-preview|-dev\./.test(h)) || "";
  const isPublished = () => !!publishedUrl() || !!findByText(/(republish|republicar|publicar atualiza|update deployment|manage (site|domain))/i)
    || !!document.body.innerText.match(/\b(published|publicado|no ar|live at)\b/i);

  const steps = [...root.querySelectorAll(".msk-auto-steps li")];
  const markStep = (name, state) => { const li = steps.find(el => el.dataset.step === name); if (li) li.dataset.state = state; };
  const pubState = root.querySelector(".msk-pub-state");
  const refreshPublishState = () => {
    const url = publishedUrl();
    const pub = isPublished();
    pubState.dataset.state = pub ? "published" : "draft";
    pubState.textContent = pub
      ? (pendingPublishCount > 0 ? `Site publicado · ${pendingPublishCount} atualiza${pendingPublishCount === 1 ? "ção" : "ções"} para publicar` : "Site publicado · tudo em dia")
      : "Site em rascunho · status em tempo real";
    return { published: pub, url };
  };
  refreshPublishState();
  setInterval(refreshPublishState, 4000);

  let running = false;

  const publishRegex = /^(publish|publicar|update|atualizar|republish|republicar)(\b|\s|$)/i;
  const publishConfirmRegex = /^(publish|publicar|update|atualizar|republish|republicar)(\b|\s|$)/i;
  const publishControl = () => clickables().find(el => publishRegex.test(label(el))) || null;
  const dialogPublishControl = () => {
    const dialog = document.querySelector('[role="dialog"], [data-radix-dialog-content], [aria-modal="true"]');
    if (!dialog) return null;
    return [...dialog.querySelectorAll('button,[role="button"]')]
      .filter(el => visible(el) && !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true")
      .find(el => publishConfirmRegex.test(label(el))) || null;
  };
  const openPublishDialog = async () => {
    const existingDialogConfirm = dialogPublishControl();
    if (existingDialogConfirm) return { opened: true, direct: false, control: existingDialogConfirm };
    const control = publishControl();
    if (!control) return { opened: false, direct: false, control: null };
    const beforeLabel = label(control);
    const clicked = await clickEl(control);
    if (!clicked) return { opened: false, direct: false, control: null };
    // Lovable may start publishing immediately instead of opening a confirmation dialog.
    const outcome = await waitFor(() => {
      const confirm = dialogPublishControl();
      if (confirm) return { kind: "dialog", control: confirm };
      if (publishBusy() || publishSuccessSignal()) return { kind: "direct", control: null };
      return null;
    }, 7000, 250);
    if (outcome?.kind === "dialog") return { opened: true, direct: false, control: outcome.control, beforeLabel };
    if (outcome?.kind === "direct") return { opened: true, direct: true, control: null, beforeLabel };
    // Some Lovable builds render the confirm action without a dialog role.
    const fallback = findByText(publishConfirmRegex);
    if (fallback && fallback !== control) return { opened: true, direct: false, control: fallback, beforeLabel };
    // If the same control changed to a busy/disabled state, the first click already started the update.
    const current = publishControl();
    if ((current && (current.disabled || current.getAttribute("aria-busy") === "true" || current.getAttribute("aria-disabled") === "true")) || publishBusy()) {
      return { opened: true, direct: true, control: null, beforeLabel };
    }
    return { opened: true, direct: false, control: fallback || null, beforeLabel };
  };
  const publishBusy = () => {
    const body = document.body.innerText || "";
    if (/\b(publishing|publicando|updating|atualizando|deploying|implantando|building|compilando|processing|processando)\b/i.test(body)) return true;
    const control = publishControl();
    if (!control) return false;
    const text = label(control);
    return control.disabled || control.getAttribute("aria-disabled") === "true" || control.getAttribute("aria-busy") === "true" || /publishing|publicando|updating|atualizando|deploying|building|processing|processando/i.test(text);
  };
  const publishSuccessSignal = () => {
    const text = document.body.innerText || "";
    return /\b(published successfully|successfully published|updated successfully|deployment complete|site updated|publicado com sucesso|atualizado com sucesso|publicação concluída|site atualizado)\b/i.test(text);
  };
  const visibleLovableIssue = () => {
    const text = String(document.body.innerText || "").replace(/\s+/g, " ").trim();
    const excerptAround = re => {
      const m = re.exec(text);
      if (!m) return "";
      const start = Math.max(0, m.index - 160);
      return text.slice(start, Math.min(text.length, m.index + m[0].length + 240));
    };
    const creditRe = /(out of credits|no credits|workspace.{0,80}(?:credits?|cr[eé]ditos?)|(?:credits?|cr[eé]ditos?).{0,80}(?:workspace|lovable)|sem cr[eé]ditos?|cr[eé]ditos? esgotados?)/i;
    const buildRe = /(deployment failed|build failed|publish failed|failed to deploy|falha.{0,30}(?:deploy|publica[cç][aã]o|build|compila[cç][aã]o)|erro.{0,30}(?:deploy|publica[cç][aã]o|build|compila[cç][aã]o))/i;
    const authRe = /(sign in|log in|authentication required|unauthorized|fa[cç]a login|autentica[cç][aã]o necess[aá]ria|n[aã]o autorizado)/i;
    if (creditRe.test(text)) return {
      category:"lovable_preview_credits", title:"Preview/publicação limitado por créditos do Lovable", source:"lovable-ui", sourceLabel:"Lovable", severity:"warning",
      message:"O próprio Lovable exibiu uma limitação de créditos. A edição no GitHub não deve ser interrompida; somente preview/build/publicação do Lovable ficou sem confirmação.",
      evidence:excerptAround(creditRe), action:"Mantenha a alteração no GitHub como resultado válido. Tente preview/publicação novamente quando o workspace permitir ou use um deploy Git-based já configurado, se existir."
    };
    if (buildRe.test(text)) return {
      category:"lovable_publish_failure", title:"Falha real de build/publicação", source:"lovable-ui", sourceLabel:"Lovable", severity:"error",
      message:"O Lovable exibiu uma falha de build/deploy durante a atualização.",
      evidence:excerptAround(buildRe), action:"A edição no GitHub permanece separada. Revise o erro de build mostrado e corrija somente a causa confirmada."
    };
    if (authRe.test(text)) return {
      category:"lovable_auth_required", title:"Lovable exige autenticação", source:"lovable-ui", sourceLabel:"Lovable", severity:"error",
      message:"A página do Lovable exige autenticação/autorização para concluir essa ação.",
      evidence:excerptAround(authRe), action:"Conclua o login/autorização oficial e tente atualizar o preview novamente."
    };
    return null;
  };
  const reportPublishFailure = async fallback => {
    const diagnostic = visibleLovableIssue();
    if (diagnostic) {
      await showLocalDiagnosticAndMirror(diagnostic);
      await reportChatAction(diagnostic.message, diagnostic.severity === "error" ? "error" : "pending");
      return diagnostic;
    }
    await reportChatAction(fallback, "error");
    return null;
  };

  const doPublish = async (mode) => {
    markStep("publish", "running");
    const successBefore = publishSuccessSignal();
    const opened = await openPublishDialog();
    if (!opened?.opened) {
      await reportPublishFailure("Não encontrei o controle de publicação nesta tela.");
      markStep("publish", "error");
      return null;
    }
    // Em algumas versões do Lovable, o primeiro clique já inicia o deploy.
    if (opened.direct) {
      markStep("publish", "running");
      return { mode, startedAt: Date.now(), beforeText: opened.beforeLabel || "", successBefore, direct: true };
    }
    const wanted = mode === "update"
      ? /^(update|atualizar|republish|republicar|publish|publicar)(\b|\s|$)/i
      : /^(publish|publicar)(\b|\s|$)/i;
    const confirm = opened.control || await waitFor(() => dialogPublishControl() || findByText(wanted), 9000, 250);
    if (!confirm) {
      // Não falha imediatamente: se o clique anterior já iniciou processamento, aceite o ciclo.
      if (publishBusy() || (!successBefore && publishSuccessSignal())) {
        return { mode, startedAt: Date.now(), beforeText: opened.beforeLabel || "", successBefore, direct: true };
      }
      await reportPublishFailure("O Lovable não exibiu uma segunda confirmação. Verifiquei o estado da publicação e ela não iniciou.");
      markStep("publish", "error");
      return null;
    }
    const beforeText = label(confirm);
    await clickEl(confirm);
    markStep("publish", "running");
    return { mode, startedAt: Date.now(), beforeText, successBefore, direct: false };
  };

  const waitPublished = async tx => {
    if (!tx) return false;
    markStep("wait", "running");
    await reportChatAction("Atualizando projeto…", "running");

    // Não aceita a URL pública antiga como confirmação. Primeiro precisa existir
    // evidência de que este NOVO ciclo de publicação realmente começou.
    const started = await waitFor(() => publishBusy() ? "busy" : (!tx.successBefore && publishSuccessSignal() ? "success" : null), 20000, 500);
    if (!started) {
      await reportPublishFailure("Não consegui confirmar que o Lovable iniciou a atualização. Status: não confirmado.");
      markStep("publish", "error"); markStep("wait", "error");
      await closeOverlays(); refreshPublishState();
      return false;
    }

    await reportChatAction("Confirmando atualização…", "running");
    const finished = await waitFor(() => {
      if (publishBusy()) return null;
      if (publishSuccessSignal()) return "success";
      const control = publishControl();
      if (control && !control.disabled && control.getAttribute("aria-disabled") !== "true" && control.getAttribute("aria-busy") !== "true") return "ready";
      return null;
    }, 180000, 1000);

    if (!finished) {
      await reportPublishFailure("A atualização não foi confirmada pelo Lovable. Status: erro ou processamento excedido.");
      markStep("publish", "error"); markStep("wait", "error");
      await closeOverlays(); refreshPublishState();
      return false;
    }

    // Pequena janela de estabilidade para evitar concluir durante uma troca visual do botão.
    await sleep(1800);
    if (publishBusy()) {
      await reportPublishFailure("A atualização ainda está sendo processada pelo Lovable. Status: aguardando.");
      markStep("wait", "error");
      return false;
    }
    markStep("publish", "done"); markStep("wait", "done");
    await resetPendingPublishCount(projectId());
    await reportChatAction("✅ Projeto atualizado. Status: confirmado.", "done");
    await closeOverlays(); refreshPublishState();
    return true;
  };

  const alreadyConnected = re => new RegExp(re).test(document.body.innerText || "");

  const connectGithub = async (id) => {
    markStep("github", "running");
    if (alreadyConnected(/(github\.com\/[\w.-]+\/[\w.-]+|repositório conectado|repository connected)/i)) {
      add("GitHub já está conectado a este projeto — nada a refazer.", "agent", "done");
      markStep("github", "skip");
      return true;
    }
    // abre menu/painel do GitHub dentro do Lovable (permissões reais são concedidas pela própria janela do GitHub)
    (await clickText(/^(github|conectar github|connect to github)$/i, 5000)) || (await clickText(/github/i, 5000));
    const flow = await clickText(/(create repository|criar repositório|connect (to )?github|conectar (ao )?github|transfer|install|instalar)/i, 10000);
    if (flow) {
      await clickText(/^(authorize|autorizar|confirm|confirmar|continue|continuar|create|criar|connect|conectar)\b/i, 9000);
      const ok = await waitFor(() => (alreadyConnected(/(github\.com\/[\w.-]+\/[\w.-]+|conectado|connected|sync)/i) ? "ok" : null), 15000, 1000);
      if (ok) {
        add("GitHub conectado e repositório sincronizado.", "agent", "done");
        markStep("github", "done");
        await closeOverlays();
        return true;
      }
      add("A autorização do GitHub precisa da sua confirmação na janela aberta (permissão real da conta). Assim que autorizar, clique novamente na automação.", "agent", "pending");
      markStep("github", "pending");
      await closeOverlays();
      return false;
    }
    add("O fluxo nativo do GitHub não abriu. O MSK não enviará mensagens ao agente do Lovable. Abra a configuração GitHub oficial ou use “Já conectei”.", "agent", "pending");
    markStep("github", "pending");
    await closeOverlays();
    return false;
  };

  const connectSupabase = async (id) => {
    markStep("db", "running");
    if (alreadyConnected(/(supabase\.com\/dashboard\/project|cloud (ativo|enabled)|banco conectado|database connected)/i)) {
      add(`Banco (Lovable Cloud/Supabase) já conectado ao projeto ${id}.`, "agent", "done");
      markStep("db", "skip");
      return true;
    }
    // tenta abrir o painel nativo de Cloud/Supabase do projeto identificado
    (await clickText(/^(cloud|supabase|banco de dados|database)$/i, 5000)) || (await clickText(/(supabase|lovable cloud|banco de dados|database)/i, 5000));
    const flow = await clickText(/(enable|ativar|connect (to )?supabase|conectar (ao )?supabase|create (project|database)|criar (projeto|banco))/i, 9000);
    if (flow) {
      await clickText(/^(authorize|autorizar|confirm|confirmar|continue|continuar|enable|ativar|connect|conectar)\b/i, 9000);
      const ok = await waitFor(() => (alreadyConnected(/(supabase\.com\/dashboard\/project|conectado|connected|cloud ativo)/i) ? "ok" : null), 12000, 1000);
      if (ok) {
        add(`Supabase conectado ao projeto ${id}.`, "agent", "done");
        markStep("db", "done");
        await closeOverlays();
        return true;
      }
      add("A autorização do Supabase precisa da sua confirmação na janela oficial (permissão real da conta). Depois disso, clique de novo no botão Supabase.", "agent", "pending");
      markStep("db", "pending");
      await closeOverlays();
      return false;
    }
    await closeOverlays();
    add("O painel nativo do banco não abriu. A extensão não enviará esse pedido ao agente do Lovable. Faça o pedido no chat MSK/ChatGPT para usar as integrações disponíveis sem consumir créditos do Lovable.", "agent", "pending");
    markStep("db", "pending");
    return false;
  };

  const connectDatabase = async (id) => {
    markStep("db", "skip");
    add(`Banco não é requisito para ativar o MSK no projeto ${id}. Quando solicitado, a integração deve ser executada pelas ferramentas disponíveis no ChatGPT/GitHub, nunca pelo agente do Lovable.`, "agent", "done");
    return true;
  };

  const handoff = async (id) => {
    markStep("agent", "done");
    add(`Projeto ${id} pronto. Nenhum comando foi enviado ao agente do Lovable; o ChatGPT/MSK usa o repositório salvo diretamente.`, "agent", "done");
    return true;
  };

  const runAutomation = async (opts = {}) => {
    if (running) return;
    running = true;
    const runBtn = root.querySelector(".msk-auto-run");
    const updBtn = root.querySelector(".msk-auto-update");
    const restore = () => {
      running = false;
      runBtn.disabled = false; updBtn.disabled = false;
      runBtn.textContent = "\u25b6 Automa\u00e7\u00e3o completa";
      updBtn.textContent = "\u21bb Publicar atualiza\u00e7\u00e3o";
    };
    runBtn.disabled = true; updBtn.disabled = true;
    runBtn.textContent = "\u23f3 Executando\u2026";
    steps.forEach(li => (li.dataset.state = "idle"));
    root.classList.add("msk-menu-open", "msk-panel-open"); placePanel();

    try {
      const id = refreshProjectId();
      if (!id) {
        add("Abra um projeto do Lovable para rodar a automação.", "agent", "error");
        setStage("Sem projeto aberto", "error");
        return;
      }
      setStage("Automação", "running");
      const state = refreshPublishState();

      if (state.published && !opts.forceUpdate) {
        add(`Projeto já publicado${state.url ? ` em ${state.url}` : ""} — pulando publicação e seguindo para as conexões.`, "agent", "done");
        markStep("publish", "skip");
        markStep("wait", "skip");
      } else {
        const publishTx = await doPublish(state.published ? "update" : "first");
        if (publishTx) await waitPublished(publishTx);
        else markStep("wait", "error");
      }

      const gh = await connectGithub(id);
      markStep("db", "skip");
      const done = await handoff(id);
      const pending = !gh && !repoUrl() && !(await getManualGithub(id));
      setStage(done && !pending ? "Automação concluída" : pending ? "Aguardando confirmação do GitHub" : "Automação com pendências", done && !pending ? "done" : "error");
      if (pending) await reportChatAction("Único passo pendente: confirmar o GitHub. Banco de dados não é necessário para ativar o MSK.", "pending");
    } catch (err) {
      const message = err?.message || String(err || "Falha na automação.");
      showDiscreetNotice(message, "error", "AUTOMATION");
      logDiscreetIssue({ category:"automation", code:"AUTOMATION", severity:"error", source:"extension", message }).catch(() => {});
      setStage("Falha na automação", "error");
    } finally {
      restore();
      refreshPublishState();
    }
  };

  const publishUpdateOnly = async () => {
    if (running) return;
    running = true;
    const runBtn = root.querySelector(".msk-auto-run");
    const publishBtn = root.querySelector(".msk-auto-update") || runBtn;
    runBtn.disabled = true;
    if (publishBtn) { publishBtn.disabled = true; publishBtn.textContent = "⏳ Atualizando…"; }
    openChat();
    try {
      steps.forEach(li => (li.dataset.state = "idle"));
      setStage("Atualizando projeto", "running");
      const publishTx = await doPublish(isPublished() ? "update" : "first");
      const confirmed = publishTx ? await waitPublished(publishTx) : false;
      setStage(confirmed ? "Projeto atualizado" : "Atualização não confirmada", confirmed ? "done" : "error");
    } catch (err) {
      await reportChatAction("Não foi possível concluir a atualização. Status: erro.", "error");
      setStage("Falha ao atualizar", "error");
    } finally {
      running = false;
      runBtn.disabled = false;
      if (publishBtn) publishBtn.disabled = false;
      refreshPublishState();
      updatePrimaryProjectButton(true);
    }
  };

  const setPrimaryConnectionLabel = (label, state = "running") => {
    const button = root.querySelector(".msk-auto-run");
    if (!button || button.dataset.mode === "publish") return;
    button.dataset.connectionState = state;
    button.classList.toggle("msk-primary-connecting", state === "running");
    button.innerHTML = `<span class="msk-primary-label">${String(label || "Conectar este projeto")}</span>`;
    button.setAttribute("aria-label", String(label || "Conectar este projeto"));
  };

  const requirePublishBeforeGithub = async (id, continueAfter) => {
    if (!id || isPublished()) return true;
    openChat();
    root.classList.add("msk-menu-open", "msk-panel-open");
    placePanel();
    setStage("Publicação necessária", "running");
    setPrimaryConnectionLabel("Publicação necessária", "waiting");
    await reportChatAction("Este projeto ainda nunca foi publicado. Publique o site antes de criar ou conectar o repositório GitHub.", "pending");
    addApprovalCard({
      title: "Publique o projeto antes do GitHub",
      description: "Este projeto ainda está em rascunho. Para criar/conectar o repositório, o MSK precisa primeiro colocar o site no ar pelo fluxo oficial de publicação do Lovable.",
      permissions: [
        "Clicar no controle oficial de Publicar do Lovable",
        "Confirmar que o site entrou no ar",
        "Continuar automaticamente para a criação/conexão do GitHub"
      ],
      confirmLabel: "🚀 Publicar agora",
      pendingLabel: "⏳ Publicando…",
      cancelLabel: "Agora não",
      cancelMessage: "Publicação cancelada. O MSK não tentou criar o repositório enquanto o projeto continua em rascunho.",
      cancelStage: "Projeto ainda em rascunho",
      onConfirm: async () => {
        markStep("publish", "running");
        setStage("Publicando projeto", "running");
        setPrimaryConnectionLabel("Publicando projeto…", "running");
        const tx = await doPublish("first");
        const confirmed = tx ? await waitPublished(tx) : false;
        const live = confirmed || isPublished();
        if (!live) {
          markStep("publish", "error");
          setStage("Publicação não confirmada", "error");
          setPrimaryConnectionLabel("Publicação não confirmada", "waiting");
          await reportChatAction("Não consegui confirmar que o site entrou no ar. O repositório não foi criado. Tente publicar novamente.", "error");
          return;
        }
        markStep("publish", "done");
        setStage("Site publicado", "done");
        setPrimaryConnectionLabel("Projeto publicado", "done");
        await reportChatAction("✅ Site publicado. Continuando agora para o GitHub…", "done");
        if (typeof continueAfter === "function") {
          window.setTimeout(() => { Promise.resolve(continueAfter()).catch(() => {}); }, 250);
        }
      }
    });
    return false;
  };

  /* ============ ASSISTENTE PERSISTENTE POR PROJETO ============ */
  const wizardKey = id => `msk:setup:${id}`;
  const readWizard = async id => (await chrome.storage.local.get(wizardKey(id)))[wizardKey(id)] || null;
  const writeWizard = async (id, value) => chrome.storage.local.set({ [wizardKey(id)]: { ...value, id, updatedAt: Date.now() } });
  const normalizeRepoUrl = value => {
    const match = String(value || "").match(/https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#\s]|$)/i);
    return match ? `https://github.com/${match[1].replace(/\.git$/i, "")}` : "";
  };
  const repoUrl = () => {
    const candidates = [
      ...[...document.querySelectorAll('a[href*="github.com/"]')].map(a => a.href),
      ...[...document.querySelectorAll('input,textarea')].map(el => el.value),
      ...[...document.querySelectorAll('code,[data-testid*="repository" i],[class*="repository" i]')].map(el => el.textContent)
    ];
    for (const candidate of candidates) {
      const found = normalizeRepoUrl(candidate);
      if (found && !/login|settings\/installations/i.test(found)) return found;
    }
    return normalizeRepoUrl(document.body.innerText || "");
  };
  const gitGuideKey = id => `msk:git-guide:${id}`;
  const removeGitGuide = () => root.querySelector(".msk-git-guide")?.remove();
  const finishGitGuide = async id => {
    const key = gitGuideKey(id);
    const state = (await chrome.storage.local.get(key))[key];
    if (!state) return;
    await chrome.storage.local.remove(key);
    removeGitGuide();
    if (state.returnUrl && state.returnUrl !== location.href) location.assign(state.returnUrl);
  };
  const startGitGuide = async id => {
    if (!(await requirePublishBeforeGithub(id, () => startGitGuide(id)))) return false;
    const key = gitGuideKey(id);
    const current = (await chrome.storage.local.get(key))[key];
    const projectHome = `https://lovable.dev/projects/${id}`;
    await chrome.storage.local.set({ [key]: current || { returnUrl: projectHome, startedAt: Date.now() } });
    const target = `https://lovable.dev/projects/${id}/settings/git/github`;
    if (!location.pathname.includes(`/projects/${id}/settings/git/github`)) location.assign(target);
    else renderGitGuide();
  };
  let guideBusy = false;
  const renderGitGuide = async () => {
    const id = projectId(); if (!id || guideBusy) return;
    const key = gitGuideKey(id); const state = (await chrome.storage.local.get(key))[key];
    if (!state) { removeGitGuide(); return; }
    const repo = repoUrl();
    if (repo) {
      if (state.validating) return;
      await chrome.storage.local.set({ [key]: { ...state, validating:true } });
      root.classList.add("msk-menu-open", "msk-panel-open"); placePanel();
      setStage("Repositório identificado", "running");
      setPrimaryConnectionLabel("Repositório identificado", "done");
      await connectProject(repo);
      return;
    }
    if (!location.pathname.includes(`/projects/${id}/settings/git/github`)) return;
    guideBusy = true;
    try {
      removeGitGuide();
      const connect = findByText(/^(connect|conectar|authorize|autorizar)$/i) || findByText(/connect github|conectar github|authorize github|autorizar github/i);
      if (connect) {
        highlightApproval(connect, "o GitHub no Lovable");
        setStage("Aguardando sua confirmação", "running");
        setPrimaryConnectionLabel("Aguardando confirmação…", "waiting");
        showManualGithubFallback(true);
        const stateNow = (await chrome.storage.local.get(key))[key] || {};
        if (!stateNow.notifiedGithub) {
          add("Confirme o botão oficial destacado do GitHub. Assim que o repositório aparecer, o MSK salva e volta automaticamente ao projeto.", "agent", "pending");
          await chrome.storage.local.set({ [key]:{ ...stateNow, notifiedGithub:true } });
        }
      } else {
        setStage("Aguardando confirmação do GitHub", "running");
        setPrimaryConnectionLabel("Aguardando confirmação…", "waiting");
        showManualGithubFallback(true);
      }
    } finally { guideBusy = false; }
  };
  const supabaseRef = () => [...document.querySelectorAll('a[href*="supabase.com/dashboard/project/"]')]
    .map(a => a.href.match(/\/project\/([a-z0-9-]+)/i)?.[1]).find(Boolean) || "";
  const updatePrimaryProjectButton = connected => {
    const button = root.querySelector(".msk-auto-run");
    if (!button || button.disabled) return;
    const publishMode = !!connected;
    button.classList.remove("msk-primary-connecting");
    delete button.dataset.connectionState;
    const published = publishMode && isPublished();
    button.dataset.mode = publishMode ? "publish" : "connect";
    button.dataset.published = published ? "true" : "false";
    button.classList.toggle("msk-primary-publish", publishMode);
    if (publishMode) {
      button.innerHTML = `<span class="msk-primary-label">${published ? "Atualizar projeto" : "Publicar projeto"}</span><span class="msk-publish-count" hidden></span>`;
      button.setAttribute("aria-label", published ? "Atualizar este projeto" : "Publicar este projeto");
      loadPendingPublishCount(projectId()).catch(() => {});
      renderPendingPublishCount(projectId());
    } else {
      button.textContent = "Conectar este projeto";
      button.setAttribute("aria-label", "Conectar este projeto");
    }
  };
  const refreshSyncCards = async () => {
    const id = projectId();
    const visibleRepo = repoUrl();
    const cached = id ? await getCachedProjectLinks(id) : { repo: "", db: "" };
    const repo = visibleRepo || cached.repo || (connectedContext.projectId === id ? connectedContext.repo : "");
    const db = supabaseRef() || cached.db || (connectedContext.projectId === id ? connectedContext.db : "");
    const manual = id ? await getManualGithub(id) : false;
    if (id && visibleRepo && visibleRepo !== cached.repo) {
      await runtimeMessage({ type: "MSK_CACHE_LINKS", projectId: id, links: { repo: visibleRepo.replace("https://github.com/", ""), db } });
    }
    if (id && repo) connectedContext = { projectId: id, repo, db: "" };
    const selectedProvider = id ? (activeProvider || await readSelectedProvider(id)) : "";
    const aiState = id && selectedProvider
      ? await runtimeMessage({ type:providerStatusType(selectedProvider), payload:{ projectId:id } }, 3500)
      : null;
    agentActive = !!aiState?.connected;
    syncLovable.textContent = id ? `Lovable: ${id}` : "Lovable: abra um projeto";
    syncLovable.dataset.state = id ? "connected" : "pending";
    const githubConnected = !!repo || manual;
    syncGithub.textContent = repo ? `GitHub: conectado · ${repo.replace("https://github.com/", "")}` : githubConnected ? "GitHub: conectado (confirmado)" : "GitHub: aguardando confirmação";
    syncGithub.dataset.state = githubConnected ? "connected" : "pending";
    updatePrimaryProjectButton(!!id && githubConnected);
    if (id && !githubConnected) {
      const guideState = (await chrome.storage.local.get(gitGuideKey(id)))[gitGuideKey(id)] || null;
      if (guideState) setPrimaryConnectionLabel(guideState.validating ? "Confirmando repositório…" : "Aguardando confirmação…", "waiting");
    }
    showManualGithubFallback(!!id && !githubConnected && !pipelineRunning);
    if (syncDatabase) { syncDatabase.textContent = "Banco: opcional"; syncDatabase.dataset.state = "connected"; syncDatabase.hidden = true; }
    return { repo, db };
  };
  const highlightApproval = (button, provider) => {
    if (!button) return false;
    button.style.setProperty("outline", "3px solid #7dff00", "important");
    button.style.setProperty("box-shadow", "0 0 22px #7dff00, 0 0 32px #9e38ff", "important");
    button.scrollIntoView({ block: "center", behavior: "smooth" });
    setStage(`Confirme ${provider}`, "running");
    return true;
  };
  let wizardBusy = false;
  const resumeWizard = async () => {
    if (wizardBusy) return;
    const id = refreshProjectId();
    if (!id) return;
    const state = await readWizard(id);
    if (!state || state.phase === "done" || state.phase === "stopped") {
      refreshSyncCards();
      return;
    }
    wizardBusy = true;
    try {
      root.classList.add("msk-menu-open", "msk-panel-open");
      placePanel();
      const base = `https://lovable.dev/projects/${id}`;
      if (state.phase === "github_settings") {
        markStep("github", "running");
        setStage("Abrindo configuração GitHub", "running");
        if (!location.pathname.includes("/settings/git/github")) {
          location.assign(`${base}/settings/git/github`);
          return;
        }
        await writeWizard(id, { ...state, phase: "github_wait" });
        return;
      }
      if (state.phase === "github_create" || state.phase === "github_wait") {
        markStep("github", "running");
        const repo = repoUrl();
        if (repo || /repository (connected|created)|repositório (conectado|criado)|sync enabled/i.test(document.body.innerText || "")) {
          markStep("github", "done");
          syncGithub.textContent = repo ? `GitHub: ${repo.replace("https://github.com/", "")}` : "GitHub: conectado";
          syncGithub.dataset.state = "connected";
          if (repo) await runtimeMessage({ type:"MSK_CACHE_LINKS", projectId:id, links:{ repo:repo.replace("https://github.com/", "") } });
          await setManualGithub(id, true);
          add("✅ GitHub identificado e salvo. Projeto pronto para escolher ChatGPT ou Grok.", "agent", "done");
          await writeWizard(id, { ...state, phase: "done", repo:repo || "" });
          location.assign(base);
          return;
        }
        if (!location.pathname.includes("/settings/git/github")) {
          location.assign(`${base}/settings/git/github`);
          return;
        }
        const connect = findByText(/^(connect|conectar)$/i) || findByText(/connect github|conectar github/i);
        if (highlightApproval(connect, "a conta GitHub")) {
          markStep("github", "pending");
          syncGithub.textContent = "GitHub: confirme o botão destacado";
          syncGithub.dataset.state = "pending";
          if (!state.notifiedGithub) {
            add("Confirme o botão destacado do GitHub. Essa autorização oficial precisa do seu clique; depois a automação continua sozinha.", "agent", "pending");
            await writeWizard(id, { ...state, phase: "github_wait", notifiedGithub: true });
          }
        }
        return;
      }
      if (state.phase === "database" || state.phase === "database_wait") {
        markStep("db", "skip");
        markStep("agent", "done");
        if (syncDatabase) syncDatabase.hidden = true;
        setStage("Projeto sincronizado", "done");
        await reportChatAction(`✅ Configuração concluída para o projeto ${id}. GitHub confirmado; banco de dados não é requisito para usar o MSK.`, "done");
        await writeWizard(id, { ...state, phase: "done", repo: repoUrl(), databaseRef: "optional" });
        return;
      }
    } finally {
      wizardBusy = false;
    }
  };
  const startSetupWizard = async () => {
    const id = refreshProjectId();
    if (!id) return add("Abra o projeto do Lovable antes de iniciar.", "agent", "error");
    root.classList.add("msk-menu-open", "msk-panel-open");
    placePanel();
    steps.forEach(li => (li.dataset.state = "idle"));
    setStage("Preparando projeto", "running");
    await writeWizard(id, { phase: "publishing", startedAt: Date.now() });
    const state = refreshPublishState();
    let published = state.published;
    if (!published) {
      markStep("publish", "running");
      const publishTx = await doPublish("first");
      published = publishTx ? await waitPublished(publishTx) : false;
    } else {
      markStep("publish", "skip");
      markStep("wait", "skip");
    }
    if (!published && !isPublished()) {
      setStage("Publicação pendente", "error");
      await writeWizard(id, { phase: "stopped", reason: "publish" });
      return;
    }
    await writeWizard(id, { phase: "github_settings", publishedUrl: publishedUrl() });
    add("Publicação confirmada. Abrindo a conexão GitHub…", "agent", "done");
    location.assign(`https://lovable.dev/projects/${id}/settings/git/github`);
  };

  /* ============ PIPELINE ÚNICO DO BOTÃO "CONECTAR" ============ */
  /* 1) identifica o projeto → 2) descobre/confirmar GitHub pelo ID (DOM, cache, API do Lovable
     ou aba auxiliar) → 3) se o repo já existe, não repete OAuth → 4) ativa o chat MSK.
     Banco de dados é opcional e não bloqueia a conexão. */
  const resolveProjectLinks = async (id, deep = false) => {
    const domRepo = repoUrl();
    const domDb = supabaseRef() || (/cloud (ativo|enabled)|backend connected/i.test(document.body.innerText || "") ? "lovable-cloud" : "");
    if (domRepo) {
      await runtimeMessage({ type: "MSK_CACHE_LINKS", projectId: id, links: { repo: domRepo.replace("https://github.com/", ""), db: domDb } });
      return { repo: domRepo, db: domDb, source: "tela" };
    }
    const cached = await getCachedProjectLinks(id);
    if (cached.repo) return { repo: cached.repo, db: domDb || cached.db || "", source: "cache-persistente" };
    const probe = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_PROBE_PROJECT", projectId: id, deep }, resolve));
    const repo = probe?.repo ? `https://github.com/${String(probe.repo).replace("https://github.com/", "")}` : "";
    if (repo) await runtimeMessage({ type: "MSK_CACHE_LINKS", projectId: id, links: { repo: repo.replace("https://github.com/", ""), db: domDb || probe?.db || "" } });
    return { repo, db: domDb || probe?.db || "", source: probe?.source || "none" };
  };

  let pipelineRunning = false;
  const runConnectPipeline = async () => {
    if (pipelineRunning) {
      setStage("Conexão já em andamento", "running");
      return;
    }
    pipelineRunning = true;
    const runBtn = root.querySelector(".msk-auto-run");
    const originalLabel = runBtn.textContent;
    runBtn.disabled = true;
    runBtn.textContent = "⏳ Conectando…";
    root.classList.add("msk-menu-open", "msk-panel-open");
    placePanel();
    try {
      const id = refreshProjectId();
      if (!id) {
        setStage("Sem projeto aberto", "error");
        add("Abra um projeto no editor do Lovable antes de conectar.", "agent", "error");
        return;
      }
      setStage("Conectando projeto", "running");
      await reportChatAction(`Conectando ao projeto ${id}…`, "running");
      markStep("lovable", "done");
      markStep("github", "running");
      setStage("Procurando repositório", "running");
      add(`Projeto ${id} identificado. Procurando o repositório GitHub…`, "agent", "running");

      let links = await resolveProjectLinks(id, true);
      if (links.repo) {
        await setManualGithub(id, true);
        setStage("Repositório encontrado", "running");
        syncGithub.textContent = `GitHub: conectado · ${links.repo.replace("https://github.com/", "")}`;
        syncGithub.dataset.state = "connected";
        markStep("github", "done");
        await reportChatAction(`✅ GitHub confirmado: ${links.repo.replace("https://github.com/", "")}. O repositório foi identificado pelo projeto e nenhuma nova autorização será pedida.`, "done");
      } else {
        if (!(await requirePublishBeforeGithub(id, runConnectPipeline))) return;
        add("Nenhum repositório vinculado a este projeto. Iniciando a conexão oficial do GitHub dentro do Lovable…", "agent", "running");
        const connected = await connectGithub(id);
        links = await resolveProjectLinks(id, false);
        if (!links.repo && !connected) {
          markStep("github", "pending");
          setStage("Aguardando GitHub", "running");
          showManualGithubFallback(true);
          await startGitGuide(id);
          return;
        }
      }

      markStep("db", "skip");
      if (syncDatabase) syncDatabase.hidden = true;
      setStage("Ativando MSK Agente", "running");
      await connectProject(links.repo || "");
      connectedContext = { projectId: id, repo: links.repo || repoUrl(), db: links.db || supabaseRef() };
      await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_CACHE_LINKS", projectId: id, links: { repo: links.repo.replace("https://github.com/", ""), db: links.db } }, resolve));
      refreshSyncCards();
    } catch (error) {
      const message = error?.message || String(error || "Falha na conexão.");
      showDiscreetNotice(message, "error", "PROJECT_CONNECT");
      logDiscreetIssue({ category:"project_connect", code:"PROJECT_CONNECT", severity:"error", source:"extension", message }).catch(() => {});
      setStage("Falha na conexão", "error");
    } finally {
      pipelineRunning = false;
      runBtn.disabled = false;
      await refreshSyncCards().catch(() => {});
      if (runBtn.dataset.mode !== "publish") runBtn.textContent = originalLabel;
    }
  };

  const requestFullConnection = async () => {
    root.classList.add("msk-menu-open", "msk-panel-open");
    placePanel();
    root.querySelector('[data-tab="chat"]').click();
    setStage("Identificando projeto", "running");
    setPrimaryConnectionLabel("Identificando projeto…", "running");
    const id = refreshProjectId();
    if (!id) {
      setStage("Sem projeto aberto", "error");
      setPrimaryConnectionLabel("Conectar este projeto", "ready");
      return add("Abra um projeto no Lovable antes de conectar.", "agent", "error");
    }
    markStep("lovable", "done");
    setStage("Projeto identificado", "done");
    setPrimaryConnectionLabel("Projeto identificado", "done");
    await reportChatAction(`Projeto ${id} identificado.`, "running");
    await sleep(140);

    markStep("github", "running");
    setStage("Procurando repositório", "running");
    setPrimaryConnectionLabel("Procurando repositório…", "running");
    const links = await resolveProjectLinks(id, true);

    if (links?.repo) {
      setStage("Repositório identificado", "done");
      setPrimaryConnectionLabel("Repositório identificado", "done");
      await reportChatAction(`✅ Repositório identificado: ${links.repo.replace("https://github.com/", "")}.`, "done");
      await connectProject(links.repo);
      return true;
    }

    if (await getManualGithub(id)) {
      markStep("github", "done");
      syncGithub.textContent = "GitHub: conectado (confirmado)";
      syncGithub.dataset.state = "connected";
      showManualGithubFallback(false);
      setStage("GitHub confirmado", "done");
      setPrimaryConnectionLabel("GitHub confirmado", "done");
      updatePrimaryProjectButton(true);
      await reportChatAction("✅ Projeto conectado. GitHub já foi confirmado. Agora escolha ChatGPT ou Grok.", "done");
      showProviderChooser(id, links?.repo || "");
      return true;
    }

    if (!(await requirePublishBeforeGithub(id, requestFullConnection))) return false;

    setStage("Aguardando sua confirmação", "running");
    setPrimaryConnectionLabel("Aguardando confirmação…", "waiting");
    addApprovalCard({
      title:"Autorizar conexão GitHub?",
      description:"O MSK vai abrir a configuração GitHub deste projeto no Lovable, identificar o repositório e voltar automaticamente quando estiver confirmado.",
      permissions:["Abrir a configuração GitHub do projeto", "Salvar o repositório por project_id", "Voltar ao projeto após a confirmação"],
      onConfirm:async () => {
        setStage("Abrindo conexão GitHub", "running");
        setPrimaryConnectionLabel("Aguardando confirmação…", "waiting");
        await reportChatAction("Abrindo GitHub do projeto…", "running");
        await startGitGuide(id);
      }
    });
    showManualGithubFallback(true);
    return false;
  };
  setInterval(refreshSyncCards, 5000);
  let lastObservedUrl = location.href;
  setInterval(() => {
    if (location.href === lastObservedUrl) return;
    lastObservedUrl = location.href;
    scheduleProjectRefresh();
  }, 500);
  setTimeout(refreshSyncCards, 500);
  setInterval(() => {
    const id = projectId();
    if (!pipelineRunning && (!agentActive || connectedContext.projectId !== id)) renderGitGuide();
  }, 4000);
  setTimeout(renderGitGuide, 700);
  setTimeout(resumeLovableAction, 900);

  manualGithubBtn?.addEventListener("click", async () => {
    const id = refreshProjectId();
    if (!id) return add("Abra um projeto no Lovable antes de confirmar a conexão.", "agent", "error");
    manualGithubBtn.disabled = true;
    manualGithubBtn.textContent = "Confirmando…";
    setStage("Confirmando GitHub", "running");
    try {
      const cached = await getCachedProjectLinks(id);
      const repo = repoUrl() || cached.repo || connectedContext.repo || "";
      await setManualGithub(id, true);
      connectedContext = { projectId:id, repo, db:"" };
      if (repo) await runtimeMessage({ type:"MSK_CACHE_LINKS", projectId:id, links:{ repo:repo.replace("https://github.com/", "") } });
      markStep("github", "done"); markStep("db", "skip");
      syncGithub.textContent = repo ? `GitHub: conectado · ${repo.replace("https://github.com/", "")}` : "GitHub: conectado (confirmado)";
      syncGithub.dataset.state = "connected";
      showManualGithubFallback(false);
      setStage("Projeto conectado", "done");
      setPrimaryConnectionLabel("GitHub confirmado", "done");
      updatePrimaryProjectButton(true);
      await reportChatAction(repo ? `✅ Projeto conectado. GitHub confirmado e salvo: ${repo.replace("https://github.com/", "")}. Agora escolha ChatGPT ou Grok.` : "✅ Projeto conectado. GitHub confirmado manualmente. Agora escolha ChatGPT ou Grok.", "done");
      showProviderChooser(id, repo);
      await finishGitGuide(id);
    } catch {
      await setManualGithub(id, true);
      markStep("github", "done");
      syncGithub.textContent = "GitHub: conectado (confirmado)";
      syncGithub.dataset.state = "connected";
      showManualGithubFallback(false);
      setStage("Projeto conectado", "done");
      setPrimaryConnectionLabel("GitHub confirmado", "done");
      updatePrimaryProjectButton(true);
      await reportChatAction("✅ Projeto conectado. GitHub confirmado manualmente. Agora escolha ChatGPT ou Grok.", "done");
      showProviderChooser(id, "");
      await finishGitGuide(id);
    } finally {
      manualGithubBtn.disabled = false;
      manualGithubBtn.textContent = "✓ Já conectei";
    }
  });

  const showEnvironmentDoctor = async ({ force = false } = {}) => {
    const id = projectId();
    if (!id) return;
    const version = chrome.runtime.getManifest().version;
    const readyKey = `mskDoctorReady:${version}:${id}`;
    if (!force) {
      const ready = (await chrome.storage.local.get(readyKey))[readyKey];
      if (ready) return;
    }
    const diag = await runtimeMessage({ type:"MSK_ENV_DIAGNOSTIC", projectId:id }, 15000);
    if (!diag?.ok) return;

    // Sincroniza a UI com recuperações feitas pelo background.
    if (diag.github?.repo) {
      connectedContext = { projectId:id, repo:diag.github.repo, db:"" };
      syncGithub.textContent = `GitHub: conectado · ${diag.github.repo.replace("https://github.com/", "")}`;
      syncGithub.dataset.state = "connected";
      markStep("github", "done");
      updatePrimaryProjectButton(true);
    }
    const selectedProvider = await readSelectedProvider(id);
    const selectedState = selectedProvider
      ? (selectedProvider === "chatgpt"
          ? diag.chatgpt
          : await runtimeMessage({ type:providerStatusType(selectedProvider), payload:{ projectId:id } }, 5000))
      : null;
    const selectedReady = !!(selectedState?.connected && (selectedProvider !== "chatgpt" || selectedState?.bridgeReady));
    if (selectedProvider && selectedReady) {
      agentActive = true;
      activeProvider = selectedProvider;
      markStep("agent", "done");
    }

    // O diagnóstico só reativa o provedor que o usuário já escolheu.
    // Sem escolha, a extensão mantém a tela neutra entre os três provedores.
    const needsProvider = !!(selectedProvider && !selectedReady);
    const needsPermission = diag.permissions?.ok === false;
    if (!needsProvider && !needsPermission) {
      await chrome.storage.local.set({ [readyKey]: true });
      return;
    }

    openChat();
    chat.querySelectorAll(".msk-environment-doctor").forEach(el => el.remove());
    const card = document.createElement("section");
    card.className = "msk-approval-card msk-environment-doctor";
    const title = document.createElement("strong");
    title.textContent = "Preparar este computador";
    const copy = document.createElement("p");
    const pending = [];
    if (needsProvider) pending.push(`ponte com ${providerName(selectedProvider)}`);
    if (needsPermission) pending.push("permissões do navegador");
    copy.textContent = `O MSK é multiusuário. Esta instalação não depende de IP ou do seu outro computador. Falta configurar: ${pending.join(", ")}.`;
    const actions = document.createElement("div");
    actions.className = "msk-approval-actions";

    if (needsProvider) {
      const providerButton = document.createElement("button");
      providerButton.className = "primary";
      providerButton.textContent = `Reativar ${providerName(selectedProvider)}`;
      providerButton.addEventListener("click", async () => {
        card.remove();
        await connectAIProvider(selectedProvider);
      });
      actions.appendChild(providerButton);
    }
    if (needsPermission) {
      const info = document.createElement("button");
      info.className = "secondary";
      info.textContent = "Recarregar extensão";
      info.addEventListener("click", () => location.reload());
      actions.appendChild(info);
    }
    card.append(title, copy, actions);
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
  };

  const connectAIProvider = async provider => {
    const id = refreshProjectId();
    openChat();
    const aiName = providerName(provider);
    if (!id) {
      setStage("Sem projeto aberto", "error");
      return add(`Abra um projeto no editor do Lovable antes de conectar o ${aiName}.`, "agent", "error");
    }

    const cached = await getCachedProjectLinks(id);
    const repository = repoUrl() || cached.repo || connectedContext.repo || "";
    if (repository) {
      await runtimeMessage({ type:"MSK_CACHE_LINKS", projectId:id, links:{ repo:repository.replace("https://github.com/", "") } });
      syncGithub.textContent = `GitHub: identificado · ${repository.replace("https://github.com/", "")}`;
      syncGithub.dataset.state = "connected";
      markStep("github", "done");
    } else {
      syncGithub.textContent = "GitHub: será solicitado somente se necessário";
      syncGithub.dataset.state = "pending";
    }

    markStep("lovable", "done");
    markStep("agent", "running");
    setStage(`Abrindo ${aiName}`, "running");
    await reportChatAction(`Conectando com o ${aiName}…`, "running");
    const result = await runtimeMessage({ type:providerConnectType(provider), payload:{ projectId:id, repo:repository, projectName:projectName() } }, provider === "chatgpt" ? 70000 : 55000);
    if (!result?.ok) {
      markStep("agent", "error");
      setStage(`Falha ao abrir ${aiName}`, "error");
      return reportChatAction(friendlyClientError(result?.code || "", result?.error || `Não consegui abrir a conversa do ${aiName}.`), "error");
    }
    await saveSelectedProvider(id, provider);
    removeProviderChooser();
    agentActive = true;
    connectedContext = { projectId:id, repo:repository, db:"" };
    markStep("agent", "done");
    setStage(`${aiName} conectado`, "done");
    await reportChatAction(repository
      ? `${aiName} conectado à conversa deste projeto. Repositório identificado: ${repository.replace("https://github.com/", "")}. O acesso de escrita GitHub da IA é verificado separadamente e só será marcado como disponível quando houver sinal real.`
      : `${aiName} conectado à conversa deste projeto. Nenhum repositório foi identificado ainda; o MSK não marcará GitHub como conectado sem evidência real.`, "done");
    refreshSyncCards();
  };
  const connectChatGPTOnly = async () => connectAIProvider("chatgpt");

  root.querySelector(".msk-auto-run").addEventListener("click", async event => {
    const button = event.currentTarget;
    if (button?.dataset.mode === "publish") return publishUpdateOnly();
    return requestFullConnection();
  });
  root.querySelector("[data-action='connect-project']").addEventListener("click", connectChatGPTOnly);
  root.querySelector("[data-action='connect-grok']")?.addEventListener("click", () => connectAIProvider("grok"));
  window.setTimeout(() => showEnvironmentDoctor().catch(() => {}), 1800);
  root.querySelector(".msk-auto-update")?.addEventListener("click", publishUpdateOnly);

  const maybeRepairIntegrationProtocol = async (provider, rawText, parsedRequest) => {
    const id = projectId();
    if (!id || parsedRequest) return false;
    const key = integrationIntentKey(id, provider);
    const pending = (await chrome.storage.session.get(key).catch(() => ({})))[key];
    if (!pending || Date.now() - Number(pending.at || 0) > 10 * 60_000) return false;
    const text = String(rawText || "");
    // Se a IA respondeu como chat puro (ex.: mandando usar secrets do Lovable),
    // corrige automaticamente o protocolo uma única vez, sem pedir nova ação ao cliente.
    const asksCredentialScope = /\?|deseja.{0,80}(todas|todos|uma|espec[ií]fic)|apenas.{0,60}(uma|alguma)|qual.{0,40}(chave|credencial|campo)|quais.{0,40}(chaves|credenciais|campos)/i.test(text);
    if (asksCredentialScope) return false;
    const looksLikePlainSecretAdvice = /(secret|chave|api key|credencial|webhook|lovable|env|process\.env|nao posso|não posso|não tenho ferramenta)/i.test(text);
    if (!looksLikePlainSecretAdvice || Number(pending.retries || 0) >= 1) return false;
    pending.retries = Number(pending.retries || 0) + 1;
    await chrome.storage.session.set({ [key]:pending }).catch(() => {});
    setLiveChatMessage("Cofre MSK · identificando somente os campos necessários…", "running");
    const correction = `PROTOCOLO MSK OBRIGATÓRIO. O pedido do cliente é uma integração e a extensão possui um Cofre próprio. NÃO mande o cliente para Lovable secrets, .env manual ou outro painel e NÃO peça valores de credenciais no chat. Se o cliente indicou UMA ou ALGUMAS chaves específicas, retorne somente esses campos. Se o pedido é amplo e existem várias credenciais que poderiam ser trocadas, faça UMA pergunta curta perguntando se deseja trocar todas ou quais específicas; nesse caso NÃO gere marcador ainda. Quando o escopo estiver claro, retorne APENAS o marcador <MSK_INTEGRATION_REQUEST> com JSON contendo service, title, mode (new|update), scope (all|selected) e os campos EXATOS necessários (key/label/placeholder/secret/required), sem valores reais.`;
    const result = await runtimeMessage({ type:providerMessageType(provider), payload:{ projectId:id, text:correction, attachments:[] } },125000).catch(() => null);
    if (!result?.ok) return false;
    return true;
  };

  chrome.runtime.onMessage.addListener(message => {
    // Atualização imediata do Guardião enviada pelo background para todas as abas Lovable.
    // Não depende de MutationObserver, storage.onChanged nem de recarregar a página.
    if (message?.type === "MSK_GUARDIAN_STATE") {
      const enabled = message.enabled !== false;
      setGuardianEnabled(enabled, { persist: false });
      return;
    }
    if (message?.type === "MSK_SHOW_NOTICE") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      showDiscreetNotice(payload.message || "O MSK encontrou um problema temporário.", payload.kind || "warn", payload.code || "");
      return;
    }
    if (["MSK_CHATGPT_INTEGRATION_REQUEST","MSK_GROK_INTEGRATION_REQUEST"].includes(message?.type)) {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      const raw = `<MSK_INTEGRATION_REQUEST>${JSON.stringify(payload.request || {})}</MSK_INTEGRATION_REQUEST>`;
      const parsed = parseIntegrationRequest(raw);
      if (parsed.request) addIntegrationVaultCard(parsed.request);
      return;
    }
    const externalProvider = message?.type?.startsWith("MSK_GROK_") ? "grok" : "";
    if (externalProvider && message?.type === `MSK_${providerPrefixes[externalProvider]}_STATUS`) {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      if (payload.status === "uploading") setStage(`Enviando anexo ao ${providerName(externalProvider)}`, "running");
      return;
    }
    if (externalProvider && message?.type === `MSK_${providerPrefixes[externalProvider]}_STREAM`) {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      const aiName = providerName(externalProvider);
      openChat();
      saveSelectedProvider(projectId(), externalProvider).catch(() => {});
      const visibleProviderText = payload.error ? friendlyClientError(payload.code || "", payload.text || `${aiName} apresentou um problema.`) : integrationStreamText(payload.text || `${aiName} respondendo…`);
      setLiveChatMessage(visibleProviderText, payload.error ? "error" : payload.done ? "done" : "running");
      setStage(payload.error ? `Falha no ${aiName}` : payload.done ? `${aiName} respondeu` : `${aiName} respondendo`, payload.error ? "error" : payload.done ? "done" : "running");
      if (payload.done) {
        consumeEditIntent(projectId(), externalProvider, !payload.error).catch(() => {});
        const rawFinalText = String(payload.text || "").trim();
        const integrationParsed = parseIntegrationRequest(rawFinalText);
        if (!payload.error && !integrationParsed.request) maybeRepairIntegrationProtocol(externalProvider, rawFinalText, null).catch(() => {});
        const finalText = integrationParsed.text;
        const live = chat.querySelector(".msk-chatgpt-live");
        if (live) live.remove();
        if (finalText) {
          const clientText = payload.error ? friendlyClientError(payload.code || "", finalText) : finalText;
          if (payload.error) logDiscreetIssue({ category:"provider_response_error", code:payload.code || "PROVIDER_RESPONSE_ERROR", severity:"error", source:activeProvider || "provider", message:finalText }).catch(() => {});
          chat.appendChild(createCompactSummaryCard(clientText, {
            title: payload.error ? "Não consegui concluir" : "Resumo da execução",
            state: payload.error ? "Tente novamente" : "Concluído",
            preview: clientText
          }));
          chat.scrollTop = chat.scrollHeight;
          if (projectId()) saveChatMessage(projectId(), "assistant", clientText, {
            kind:"summary", provider:externalProvider,
            title:payload.error ? "Resumo do erro" : "Resumo da execução",
            state:payload.error ? "Falhou" : "Concluído",
            preview:compactText(clientText)
          });
        }
        if (integrationParsed.request) addIntegrationVaultCard(integrationParsed.request);
      }
      return;
    }
    if (externalProvider && message?.type === `MSK_${providerPrefixes[externalProvider]}_BOUND`) {
      if (!message.payload?.projectId || message.payload.projectId === projectId()) {
        agentActive = true;
        activeProvider = externalProvider;
        saveSelectedProvider(projectId(), externalProvider).catch(() => {});
        markStep("agent", "done");
        setStage(`${providerName(externalProvider)} conectado`, "done");
      }
      return;
    }
    if (message?.type === "MSK_PROVIDER_GITHUB_STATUS") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      const aiName = providerName(payload.provider || activeProvider || "");
      const state = String(payload.state || "unknown");
      const blocked = ["not_connected","authorization_required","write_permission_missing","repository_missing","tool_unavailable"].includes(state);
      if (blocked) {
        showDiagnostic({
          ...payload,
          source:payload.provider || "provider",
          sourceLabel:aiName || payload.providerLabel || "IA",
          severity:payload.severity || "error",
          title:payload.title || `${aiName || "IA"}: GitHub não disponível para edição`,
          message:payload.message || `A conversa do ${aiName || "provedor"} está aberta, mas o acesso GitHub para editar não foi confirmado.`,
          action:payload.action || "Conclua somente uma autorização oficial realmente disponível nessa IA; o MSK não vai tratar repositório identificado como permissão de escrita."
        });
        setStage(`${aiName || "IA"}: GitHub precisa de atenção`, "error");
      } else if (state === "reported_connected" || state === "write_confirmed") {
        showDiscreetNotice(`${aiName || "IA"}: acesso GitHub reportado como disponível para este projeto.`, "ok", "GITHUB");
      } else if (state === "update_requested" || state === "authorization_returned") {
        showDiscreetNotice(`${aiName || "IA"}: atualização/autorização GitHub solicitada; aguardando confirmação real.`, "warn", "GITHUB");
      }
      return;
    }
    if (message?.type === "MSK_GROK_LIMIT") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      removeLiveChatMessage();
      addGrokLimitCard(payload);
      return;
    }
    if (message?.type === "MSK_CHATGPT_LIMIT") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      removeLiveChatMessage();
      addChatGPTLimitCard(payload);
      return;
    }
    if (message?.type === "MSK_CHATGPT_DIAGNOSTIC") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      const systemOnly = ["bridge_error", "chatgpt_response_timeout", "chatgpt_connection_recovery"].includes(String(payload.category || ""));
      if (systemOnly) {
        logDiscreetIssue({ ...payload, code:payload.category || "CHATGPT_DIAGNOSTIC" }).catch(() => {});
        showDiscreetNotice(payload.message || "O ChatGPT apresentou uma falha temporária.", payload.severity === "error" ? "error" : "warn", payload.category || "");
      } else {
        showDiagnostic(payload);
      }
      if (payload.severity === "error") setStage(payload.stage || "Atenção necessária", "error");
      return;
    }
    if (message?.type === "MSK_CHATGPT_APPROVAL") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      addChatGPTApprovalCard(payload);
      return;
    }
    if (message?.type === "MSK_CHATGPT_APPROVAL_CLEAR") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      const ids = Array.isArray(payload.requestIds) ? payload.requestIds.map(String) : [];
      chat.querySelectorAll(".msk-chatgpt-approval").forEach(card => {
        if (!ids.length || ids.includes(String(card.dataset.mskRequestId || ""))) card.remove();
      });
      if (!chat.querySelector(".msk-chatgpt-approval") && !chat.querySelector(".msk-chatgpt-live")) setStage(agentActive ? `${providerName(activeProvider)} conectado` : "Projeto pronto", agentActive ? "done" : "ready");
      return;
    }
    if (message?.type === "MSK_CHATGPT_PHASE") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      openChat();
      setChatGPTPhase(payload);
      const state = payload.phase === "done" ? "done" : payload.phase === "error" ? "error" : "running";
      setStage(payload.label || "ChatGPT trabalhando…", state);
      return;
    }
    if (message?.type === "MSK_CHATGPT_STREAM") {
      const payload = message.payload || {};
      if (payload.projectId && payload.projectId !== projectId()) return;
      openChat();
      const visibleChatGPTText = payload.error ? friendlyClientError(payload.code || "", payload.text || "O ChatGPT apresentou um problema.") : integrationStreamText(payload.text || "ChatGPT respondendo…");
      setLiveChatMessage(visibleChatGPTText, payload.error ? "error" : payload.done ? "done" : "running");
      setStage(payload.error ? "Falha no ChatGPT" : payload.done ? "ChatGPT respondeu" : "ChatGPT respondendo", payload.error ? "error" : payload.done ? "done" : "running");
      const systemStreamError = !!payload.error && /não consegui enviar|não conseguiu confirmar|ponte com chatgpt|campo de mensagem do chatgpt|conversa vinculada.*fechada/i.test(String(payload.text || ""));
      if (payload.done && systemStreamError) {
        const finalText = String(payload.text || "").trim() || "O ChatGPT apresentou uma falha temporária.";
        removeLiveChatMessage();
        showDiscreetNotice(friendlyClientError("CHATGPT_BRIDGE_TIMEOUT", finalText), "error", "CHATGPT_BRIDGE_TIMEOUT");
        logDiscreetIssue({ category:"chatgpt_stream_error", code:"CHATGPT_STREAM_ERROR", severity:"error", source:"chatgpt-ui", message:finalText }).catch(() => {});
        return;
      }
      if (payload.done) {
        consumeEditIntent(projectId(), "chatgpt", !payload.error && !systemStreamError).catch(() => {});
        const rawFinalText = String(payload.text || "").trim();
        const integrationParsed = parseIntegrationRequest(rawFinalText);
        if (!payload.error && !integrationParsed.request) maybeRepairIntegrationProtocol("chatgpt", rawFinalText, null).catch(() => {});
        const finalText = integrationParsed.text;
        const live = chat.querySelector(".msk-chatgpt-live");
        if (live) live.remove();
        if (finalText) {
          const clientText = payload.error ? friendlyClientError(payload.code || "", finalText) : finalText;
          if (payload.error) logDiscreetIssue({ category:"chatgpt_response_error", code:payload.code || "CHATGPT_RESPONSE_ERROR", severity:"error", source:"chatgpt-ui", message:finalText }).catch(() => {});
          chat.appendChild(createCompactSummaryCard(clientText, {
            title: payload.error ? "Não consegui concluir" : "Resumo da execução",
            state: payload.error ? "Tente novamente" : "Concluído",
            preview: clientText
          }));
          chat.scrollTop = chat.scrollHeight;
          if (projectId()) saveChatMessage(projectId(), "assistant", clientText, {
            kind:"summary",
            title:payload.error ? "Não consegui concluir" : "Resumo da execução",
            state:payload.error ? "Tente novamente" : "Concluído",
            preview:compactText(clientText)
          });
        }
        if (integrationParsed.request) addIntegrationVaultCard(integrationParsed.request);
      }
      return;
    }
    if (message?.type === "MSK_CHATGPT_BOUND") {
      if (!message.payload?.projectId || message.payload.projectId === projectId()) {
        agentActive = true;
        activeProvider = "chatgpt";
        saveSelectedProvider(projectId(), "chatgpt").catch(() => {});
        markStep("agent", "done");
        setStage("ChatGPT conectado", "done");
      }
      return;
    }
    if (message?.type === "MSK_GUARDIAN_STATE") {
      setGuardianEnabled(message.enabled !== false);
      return;
    }
    if (message?.type === "MSK_OPEN") { root.classList.add("msk-menu-open", "msk-panel-open"); placePanel(); input.focus(); }
    if (message?.type === "MSK_AUTOMATE") requestFullConnection();
    if (message?.type === "MSK_PUBLISH_UPDATE") publishUpdateOnly();
    if (message?.type === "MSK_V2_AUTH_COMPLETE") {
      if (!message.result?.ok) {
        add(friendlyClientError(message.result?.code || "GITHUB_AUTH_REQUIRED", message.result?.error || "A autorização do GitHub não foi concluída."), "agent", "error");
        setStage("Autorização não concluída", "error");
        return;
      }
      add("GitHub autorizado. Carregando seus projetos…", "agent", "done");
      loadV2State().then(state => { if (state?.authorized && !state.activeProjectId) showProjectPicker(); });
      return;
    }
    if (message?.type === "MSK_AUTH_COMPLETE" && message.projectId === projectId()) {
      root.classList.add("msk-menu-open", "msk-panel-open");
      placePanel();
      setStage("Autorização recebida", "running");
      add("Autorização confirmada. A guia temporária foi fechada e o MSK está validando o repositório…", "agent", "done");
      pollProjectStatus();
    }
  });
  // Monitoramento e atualização são silenciosos e nunca bloqueiam o uso da extensão.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.mskUpdateState) refreshExtensionUpdateCard().catch(() => {});
  });
  window.setTimeout(() => refreshExtensionUpdateCard().catch(() => {}), 1800);
  window.setTimeout(() => runtimeMessage({ type:"MSK_HEARTBEAT_NOW" }, 9000).catch(() => {}), 2600);
  window.setTimeout(() => { const id = projectId(); if (id) loadPendingPublishCount(id).catch(() => {}); }, 700);

  // Abre o Guardião uma única vez após o botão de sucesso da licença.
  (async () => {
    try {
      const state = await chrome.storage.local.get(["mskOpenGuardianAfterReload"]);
      if (!state.mskOpenGuardianAfterReload) return;
      await chrome.storage.local.remove("mskOpenGuardianAfterReload");
      setGuardianEnabled(true, { persist: true });
      openChat();
      window.setTimeout(() => { placePanel(); input?.focus(); }, 60);
    } catch {}
  })();

})();
