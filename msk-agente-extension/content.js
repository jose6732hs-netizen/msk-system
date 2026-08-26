(() => {
  if (document.querySelector("#msk-root")) return;
  const asset = name => chrome.runtime.getURL(`assets/${name}`);
  const root = document.createElement("div");
  root.id = "msk-root";
  root.innerHTML = `
    <section class="msk-panel" aria-label="Chat do Guardião MSK">
      <div class="msk-head"><div class="msk-brand"><img class="msk-avatar" src="${asset("msk-agente-logo.png")}" alt="MSK Agente"><div><div class="msk-title">MSK AGENTE</div><div class="msk-subtitle">GUARDIÃO DO LOVABLE</div></div></div><span class="msk-badge">ATIVO</span></div>
      <div class="msk-account-card"><div><strong class="msk-account-name">Conta MSK</strong><span class="msk-account-email">Verificando sessão…</span></div><div><b class="msk-account-plan">—</b><small class="msk-account-time"></small></div><button class="msk-account-login" hidden>Entrar</button></div>
      <div class="msk-stage"><span class="msk-stage-dot"></span><strong>Pronto</strong><span>Chat Lovable sincronizado</span></div>
      <div class="msk-project"><span class="msk-project-label">ID do projeto</span><code class="msk-project-id">—</code><button class="msk-project-copy" title="Copiar ID">⧉</button></div>
      <div class="msk-sync"><span data-sync="lovable">Lovable: identificando…</span><span data-sync="github">GitHub: verificando…</span><span data-sync="database">Banco: detectando…</span></div>
      <div class="msk-auto"><button class="msk-auto-run msk-one-connect">Conectar este projeto</button><div class="msk-pub-state" data-state="unknown">Status atualizado em tempo real</div><ol class="msk-auto-steps"><li data-step="lovable">Identificar projeto Lovable</li><li data-step="github">Autorizar GitHub</li><li data-step="db">Detectar banco</li><li data-step="agent">Ativar MSK Agente</li></ol></div>
      <div class="msk-onboarding"><strong>Abra um projeto para começar</strong><span>Entre no editor de um projeto Lovable. O MSK identificará o projeto e guiará a conexão.</span><button class="msk-open-project">Abrir Lovable</button></div>
      <div class="msk-tabs"><button data-tab="chat" class="active">Chat</button><button data-tab="skills">Skills</button><button data-tab="history">Histórico</button></div>
      <div class="msk-skills" hidden><div class="msk-section-label">Skills rápidas</div><button data-skill="Analise o projeto, encontre a causa dos erros atuais e corrija sem alterar o que já funciona.">Corrigir problemas</button><button data-skill="Melhore o projeto profissionalmente, preservando identidade, conteúdo e funcionalidades existentes.">Melhorar projeto</button><button data-skill="Revise e aprimore toda a experiência mobile, corrigindo cortes, sobreposições e responsividade.">Otimizar mobile</button><button data-skill="Faça uma revisão de segurança, autenticação, permissões e dados sensíveis; corrija somente problemas confirmados.">Revisar segurança</button><button data-skill="Implemente a funcionalidade que vou descrever, integre ao projeto existente e preserve tudo que já funciona: ">Criar funcionalidade</button><div class="msk-section-label">Ações do Lovable</div><button data-lovable-action="badge">Remover badge</button><button data-lovable-action="publish">Publicar / atualizar</button><button data-lovable-action="github">Configurar GitHub</button><button data-lovable-action="database">Cloud / banco</button></div>
      <div class="msk-history" hidden><div class="msk-history-empty">As alterações concluídas aparecerão aqui.</div></div>
      <div class="msk-chat"><div class="msk-msg agent">Guardião ativado. Tudo o que você enviar no chat do Lovable aparecerá aqui com o andamento da execução.</div></div>
      <div class="msk-compose"><button class="msk-icon msk-mic" title="Falar comando">🎙</button><input class="msk-input" placeholder="Enviar para o chat do Lovable"><button class="msk-icon msk-send" title="Enviar ao Lovable">➤</button></div>
      <button class="msk-apply-update" hidden>Aplicar alteração e atualizar site</button>
      <div class="msk-foot"><span class="msk-preview">● Lovable conectado</span><label><input class="msk-switch" type="checkbox" checked> espelhar conversa</label></div>
    </section>
    <nav class="msk-quick" aria-label="Conectores MSK">
      <button class="msk-connect msk-agent" data-action="agent" data-label="Chat MSK"><img src="${asset("msk-agente-logo.png")}" alt="MSK"></button>
      <button class="msk-connect msk-gpt" data-action="connect-project" data-label="Conectar projeto"><img src="${asset("gpt.svg")}" alt="Conectar projeto"></button>
    </nav>
      <button class="msk-orb" aria-label="Abrir MSK Agente"><img draggable="false" src="${asset("msk-agente-logo.png")}" alt="MSK Agente"></button>`;
  document.documentElement.appendChild(root);

  const panel = root.querySelector(".msk-panel");
  const orb = root.querySelector(".msk-orb");
  const chat = root.querySelector(".msk-chat");
  const input = root.querySelector(".msk-input");
  const stage = root.querySelector(".msk-stage");
  const mirrorSwitch = root.querySelector(".msk-switch");
  const updateButton = root.querySelector(".msk-apply-update");
  let dragging = false, moved = false, dx = 0, dy = 0;
  let lastPrompt = "", lastAssistant = "", pendingTimer = 0;
  let agentActive = false;
  let v2State = null;
  let lastTaskId = "", lastTaskStatus = "";
  let lastTaskCommand = "";
  const historyEl = root.querySelector(".msk-history");
  const historyKey = id => `mskHistory:${id}`;
  const readHistory = async () => (await chrome.storage.local.get(historyKey(projectId())))[historyKey(projectId())] || [];
  const renderHistory = async () => {
    const entries = await readHistory();
    historyEl.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div"); empty.className = "msk-history-empty"; empty.textContent = "As alterações concluídas aparecerão aqui."; historyEl.appendChild(empty); return;
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
    card.innerHTML = `<strong>Alteração pronta</strong><span>Ver resumo no Histórico →</span>`;
    card.addEventListener("click", () => root.querySelector('[data-tab="history"]').click());
    chat.appendChild(card); chat.scrollTop = chat.scrollHeight;
  };
  const addApprovalCard = ({ title, description, permissions, onConfirm }) => {
    chat.querySelectorAll(".msk-approval-card").forEach(card => card.remove());
    const card = document.createElement("section"); card.className = "msk-approval-card";
    const heading = document.createElement("strong"); heading.textContent = title;
    const copy = document.createElement("p"); copy.textContent = description;
    const list = document.createElement("ul");
    permissions.forEach(text => { const item = document.createElement("li"); item.textContent = text; list.appendChild(item); });
    const actions = document.createElement("div"); actions.className = "msk-approval-actions";
    const cancel = document.createElement("button"); cancel.className = "secondary"; cancel.textContent = "Agora não";
    const confirm = document.createElement("button"); confirm.className = "primary"; confirm.textContent = "Confirmar e continuar";
    cancel.addEventListener("click", () => { card.remove(); add("Conexão cancelada. Nenhuma permissão foi concedida.", "agent"); setStage("Conexão cancelada", "ready"); });
    confirm.addEventListener("click", async () => { confirm.disabled = true; cancel.disabled = true; confirm.textContent = "Iniciando…"; await onConfirm(); card.remove(); });
    actions.append(cancel, confirm); card.append(heading, copy, list, actions); chat.appendChild(card); chat.scrollTop = chat.scrollHeight;
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
  };
  const setStage = (label, state = "ready") => {
    stage.className = `msk-stage ${state}`;
    stage.querySelector("strong").textContent = label;
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

  const applyGuardian = () => {
    nativeTextareas().forEach(decorateNative);
  };
  const observer = new MutationObserver(() => {
    applyGuardian();
    if (!mirrorSwitch.checked || !lastPrompt) return;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      const candidates = [...document.querySelectorAll('[data-message-author-role="assistant"], [data-testid*="assistant" i], article')]
        .filter(el => !root.contains(el) && visible(el));
      const text = (candidates.at(-1)?.innerText || "").trim();
      if (text && text !== lastAssistant && text !== lastPrompt && text.length > 8) {
        lastAssistant = text;
        add(text, "agent", "done");
        setStage("Concluído", "done");
        const textarea = nativeTextarea();
        const form = textarea?.closest("form") || textarea?.parentElement?.parentElement;
        setNativeStatus(form, "Concluído ✓", "done");
      }
    }, 900);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  applyGuardian();

  const mirrorSubmission = (textarea, event) => {
    if (!mirrorSwitch.checked) return;
    const command = textarea.value.trim();
    if (!command || command === lastPrompt) return;
    if (agentActive) {
      event?.preventDefault();
      event?.stopPropagation();
      event?.stopImmediatePropagation?.();
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(textarea, "");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      sendToMsk(command);
      return;
    }
    lastPrompt = command;
    add(command, "user", "sent");
    add("Enviado ao Lovable. O Guardião está acompanhando a execução…", "agent", "running");
    setStage("Executando", "running");
    const form = textarea.closest("form") || textarea.parentElement?.parentElement;
    setNativeStatus(form, "Executando…", "running");
  };
  document.addEventListener("keydown", event => {
    const textarea = event.target instanceof HTMLTextAreaElement && !root.contains(event.target) ? event.target : null;
    if (textarea && event.key === "Enter" && !event.shiftKey && !event.isComposing) mirrorSubmission(textarea, event);
  }, true);
  document.addEventListener("submit", event => {
    const textarea = event.target?.querySelector?.("textarea");
    if (textarea && !root.contains(textarea)) mirrorSubmission(textarea, event);
  }, true);
  document.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    const form = button?.closest?.("form");
    const textarea = form?.querySelector?.("textarea");
    if (!button || !textarea || root.contains(textarea)) return;
    const label = `${button.getAttribute("aria-label") || ""} ${button.title || ""}`;
    if (button.type === "submit" || /send|submit|enviar|construir/i.test(label)) mirrorSubmission(textarea, event);
  }, true);

  const pushToLovable = command => {
    const textarea = nativeTextarea();
    if (!textarea) { add("Abra um projeto no Lovable para enviar este comando.", "agent", "error"); return false; }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, command);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    const form = textarea.closest("form");
    const send = form?.querySelector('button[type="submit"]') || [...(form?.querySelectorAll("button") || [])].at(-1);
    if (send && !send.disabled) send.click();
    else textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    return true;
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
  const sendToMsk = commandValue => {
    const command = String(commandValue ?? input.value).trim();
    const id = projectId();
    if (!command || !id) return;
    if (!agentActive) {
      add("Conecte este projeto antes de enviar alterações.", "agent", "error");
      setStage("Projeto não conectado", "error");
      return;
    }
    const taskId = crypto.randomUUID();
    lastTaskCommand = command;
    lastTaskId = taskId;
    updateButton.hidden = true;
    add(command, "user", "sent");
    add("Comando recebido. Iniciando análise segura do repositório…", "agent", "running");
    setStage("Analisando o projeto", "running");
    const taskTimer = watchTask(taskId, command);
    chrome.runtime.sendMessage({ type: "MSK_AGENT_RUN", payload: { task_id: taskId, command, lovable_project_id: id, project_name: projectName(), page_url: location.href } }, result => {
      const pending = [...chat.querySelectorAll(".msk-msg.running")].at(-1);
      if (!result?.ok) {
        clearInterval(taskTimer);
        add(result?.error || "Falha ao executar com o agente.", "agent", "error");
        setStage("Falha na alteração", "error");
        return;
      }
      pending?.remove();
      lastTaskId = result.task_id || taskId;
      add(result.message || "Alteração preparada no repositório.", "agent", "done");
      setStage(result.requires_approval ? "Pronto para atualizar" : "Alteração concluída", "done");
      updateButton.hidden = !result.requires_approval;
    });
    input.value = "";
  };
  root.querySelector(".msk-send").addEventListener("click", () => sendToMsk());
  input.addEventListener("keydown", event => { if (event.key === "Enter") sendToMsk(); });
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
  root.querySelector(".msk-open-project").addEventListener("click", () => chrome.runtime.sendMessage({ type: "MSK_CONNECT", provider: "lovable" }));
  updateButton.addEventListener("click", () => {
    const id = projectId();
    if (!id || !lastTaskId) return;
    updateButton.disabled = true;
    updateButton.textContent = "Aplicando alteração…";
    setStage("Aplicando no GitHub", "running");
    chrome.runtime.sendMessage({ type: "MSK_TASK_APPROVE", payload: { lovable_project_id: id, task_id: lastTaskId } }, async result => {
      if (!result?.ok) {
        updateButton.disabled = false;
        updateButton.textContent = "Tentar aplicar novamente";
        add(result?.error || "Não foi possível aplicar a alteração.", "agent", "error");
        setStage("Aprovação pendente", "error");
        return;
      }
      add("Alteração aplicada no repositório. Preparando a atualização do site…", "agent", "done");
      saveHistory({ taskId: lastTaskId, command: lastTaskCommand || "Alteração no projeto", summary: result.summary || "Alteração aplicada ao repositório e enviada para atualização do site.", status: "completed", at: Date.now() });
      setStage("Atualizando o site", "running");
      updateButton.hidden = true;
      updateButton.disabled = false;
      updateButton.textContent = "Aplicar alteração e atualizar site";
      await sleep(3500);
      await publishUpdateOnly();
    });
  });

  root.querySelector(".msk-mic").addEventListener("click", () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return add("A transcrição por voz não está disponível neste navegador.", "agent", "error");
    const mic = root.querySelector(".msk-mic");
    const rec = new Recognition(); rec.lang = "pt-BR"; rec.interimResults = false;
    mic.classList.add("listening"); setStage("Ouvindo", "running");
    rec.onresult = e => { input.value = e.results[0][0].transcript; };
    rec.onend = () => { mic.classList.remove("listening"); setStage("Pronto", "ready"); input.focus(); };
    rec.onerror = () => { mic.classList.remove("listening"); setStage("Falha no áudio", "error"); };
    rec.start();
  });

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
  const connectProject = async () => {
    const id = refreshProjectId();
    root.classList.add("msk-menu-open", "msk-panel-open");
    placePanel();
    if (!id) return add("Abra um projeto no editor do Lovable antes de conectar.", "agent", "error");
    markStep("lovable", "done");
    markStep("github", "running");
    markStep("db", "running");
    markStep("agent", "running");
    setStage("Verificando agente central", "running");
    const health = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_BACKEND_HEALTH", payload: {} }, resolve));
    if (!health?.ok) {
      markStep("agent", "error");
      setStage("Backend MSK indisponível", "error");
      add(health?.error || "O agente central não respondeu. Verifique o deploy da função msk-agent e desative a verificação JWT legada.", "agent", "error");
      return;
    }
    setStage("Conectando projeto", "running");
    const nativeRepo = repoUrl();
    if (!nativeRepo) {
      const recovered = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_GPT_CONNECT", payload: { lovable_project_id: id, project_name: projectName(), page_url: location.href, check_only: true } }, resolve));
      if (recovered?.connected) {
        agentActive = true; await setProjectPending(id, false); markStep("github", "done"); markStep("agent", "done");
        add("A instalação GitHub existente foi validada e a sessão MSK foi recuperada. Nenhuma nova autorização foi aberta.", "agent", "done");
        setStage("MSK Agente ativo", "done");
      } else {
        add("O repositório ainda não apareceu nesta tela. Abrindo o guia de sincronização do próprio Lovable…", "agent", "running");
        await startGitGuide(id);
      }
      return;
    }
    add(nativeRepo
      ? "GitHub já conectado ao Lovable. Validando a autorização do MSK para não repetir etapas…"
      : `Projeto ${id} identificado. Abrindo somente a autorização obrigatória do GitHub…`, "agent", "running");
    await setProjectPending(id, true);
    chrome.runtime.sendMessage({ type: "MSK_GPT_CONNECT", payload: { lovable_project_id: id, project_name: projectName(), page_url: location.href, repository_url: nativeRepo } }, async result => {
      if (!result?.ok) {
        add(result?.error || "Não foi possível iniciar a conexão segura.", "agent", "error");
        setStage("Conexão pendente", "error");
        markStep("github", "error");
        return;
      }
      if (result.connected) {
        agentActive = true;
        await setProjectPending(id, false);
        markStep("github", "done");
        markStep("agent", "done");
        syncGithub.textContent = `GitHub: ${result.repository || nativeRepo.replace("https://github.com/", "")}`;
        syncGithub.dataset.state = "connected";
        add(result.discovered ? "Repositório e instalação GitHub encontrados automaticamente. Nenhuma nova autorização foi necessária." : result.recovered ? "GitHub já estava instalado. A sessão MSK foi recuperada automaticamente, sem abrir outra autorização." : "Projeto conectado. O status continuará sendo atualizado automaticamente.", "agent", "done");
        setStage("MSK Agente ativo", "done");
        await finishGitGuide(id);
      } else {
        add("Confirme a instalação na janela oficial do GitHub. Ao retornar, o MSK concluirá sozinho.", "agent", "pending");
        setStage("Aguardando autorização", "running");
      }
    });
  };
  const requestProjectConnection = () => {
    root.classList.add("msk-menu-open", "msk-panel-open"); placePanel();
    root.querySelector('[data-tab="chat"]').click();
    setStage("Confirmação necessária", "running");
    addApprovalCard({
      title: "Autorizar MSK neste projeto?",
      description: "O MSK usará somente os acessos necessários para executar e publicar as alterações solicitadas.",
      permissions: ["Identificar o projeto Lovable aberto", "Ler e editar o repositório autorizado no GitHub", "Detectar Lovable Cloud ou solicitar acesso ao Supabase", "Criar alterações e pedir sua confirmação antes de aplicar"],
      onConfirm: connectProject
    });
  };
  const activateVisibleProject = async () => {
    const repository = repoUrl();
    if (!repository) return false;
    const repoFullName = repository.replace("https://github.com/", "");
    const result = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_V2_ACTIVATE", payload: { repoFullName, lovableProjectId: projectId() || null } }, resolve));
    if (!result?.ok) { add(result?.error || "Não foi possível ativar este projeto.", "agent", "error"); return false; }
    v2State = { ...(v2State || {}), activeProjectId: result.projectId, activeProject: result };
    agentActive = true; markStep("github", "done"); markStep("agent", "done");
    syncGithub.textContent = `GitHub: ${result.repo}`; syncGithub.dataset.state = "connected";
    setStage("MSK Agente ativo", "done"); add(`Projeto ativo: ${result.repo}`, "agent", "done");
    return true;
  };
  const showProjectPicker = async () => {
    chat.querySelectorAll(".msk-project-picker").forEach(el => el.remove());
    const result = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_V2_PROJECTS", payload: {} }, resolve));
    if (!result?.ok) return add(result?.error || "Não foi possível listar seus repositórios.", "agent", "error");
    const picker = document.createElement("section"); picker.className = "msk-project-picker";
    const title = document.createElement("strong"); title.textContent = "Escolha o projeto"; picker.appendChild(title);
    const repos = result.projects || [];
    if (!repos.length) { const empty = document.createElement("p"); empty.textContent = "Nenhum repositório autorizado foi encontrado no GitHub."; picker.appendChild(empty); }
    repos.slice(0, 30).forEach(repo => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = repo.repoFullName;
      button.addEventListener("click", async () => {
        button.disabled = true; button.textContent = "Ativando…";
        const activated = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_V2_ACTIVATE", payload: { repoFullName: repo.repoFullName, lovableProjectId: projectId() || null } }, resolve));
        if (!activated?.ok) { button.disabled = false; button.textContent = repo.repoFullName; return add(activated?.error || "Falha ao ativar o projeto.", "agent", "error"); }
        picker.remove(); await loadV2State(); add(`Projeto ativo: ${activated.repo}`, "agent", "done");
      });
      picker.appendChild(button);
    });
    chat.appendChild(picker); chat.scrollTop = chat.scrollHeight;
  };
  const loadV2State = async () => {
    const auth = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_AUTH_STATUS" }, resolve));
    if (!auth?.ok) { renderAccount(null, null); agentActive = false; setStage("Entre na conta MSK", "ready"); return null; }
    const state = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_V2_STATUS", payload: {} }, resolve));
    if (!state?.ok) { renderAccount(auth, null); add(state?.error || "A API multiusuário ainda não está disponível.", "agent", "error"); return null; }
    v2State = state; renderAccount(auth, state);
    if (state.authorized && state.activeProjectId) {
      agentActive = true; markStep("github", "done"); markStep("agent", "done");
      syncGithub.textContent = `GitHub: ${state.activeProject?.repo_full_name || state.githubLogin}`; syncGithub.dataset.state = "connected";
      setStage("MSK Agente ativo", "done");
    } else if (state.authorized) {
      markStep("github", "done"); setStage("Escolha um projeto", "ready");
    } else { markStep("github", "idle"); setStage("GitHub não autorizado", "ready"); }
    return state;
  };
  const connectProjectV2 = async () => {
    root.classList.add("msk-menu-open", "msk-panel-open"); placePanel();
    const id = refreshProjectId();
    if (!id) return add("Abra ou escolha um projeto Lovable para começar.", "agent", "error");
    const auth = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_AUTH_STATUS" }, resolve));
    if (!auth?.ok) { renderAccount(null, null); add("Entre ou crie sua conta MSK. Depois volte e clique em Conectar projeto.", "agent", "error"); chrome.runtime.openOptionsPage(); return; }
    setStage("Consultando estado da conexão", "running");
    const state = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_V2_STATUS", payload: {} }, resolve));
    if (!state?.ok) { add(state?.error || "Não foi possível consultar sua conta.", "agent", "error"); setStage("Falha na conexão", "error"); return; }
    v2State = state; renderAccount(auth, state);
    if (state.authorized) {
      markStep("github", "done");
      if (state.activeProjectId) { agentActive = true; markStep("agent", "done"); setStage("MSK Agente ativo", "done"); add(`GitHub conectado como ${state.githubLogin}. Projeto já ativo; nenhuma autorização foi aberta.`, "agent", "done"); return; }
      if (await activateVisibleProject()) return;
      add("GitHub autorizado. Escolha o repositório que deseja iniciar.", "agent", "running");
      return showProjectPicker();
    }
    const oauth = await new Promise(resolve => chrome.runtime.sendMessage({ type: "MSK_V2_GITHUB_CONNECT", payload: {} }, resolve));
    if (!oauth?.ok) { add(oauth?.error || "Não foi possível abrir a autorização.", "agent", "error"); setStage("Autorização pendente", "error"); return; }
    if (oauth.alreadyConnected) { await loadV2State(); return; }
    if (!oauth.popupOpened) { add("O popup foi bloqueado. Libere popups para o Lovable e tente novamente.", "agent", "error"); return; }
    add("Confirme o GitHub no popup. Esta janela fechará automaticamente.", "agent", "running"); setStage("Aguardando GitHub", "running");
  };
  root.querySelector("[data-action='connect-project']").addEventListener("click", requestProjectConnection);

  const pollProjectStatus = async () => {
    const id = projectId();
    if (!id) return;
    const cloud = /lovable cloud|cloud (ativo|enabled)|backend connected/i.test(document.body.innerText || "");
    markStep("lovable", "done");
    chrome.runtime.sendMessage({ type: "MSK_AGENT_STATUS", payload: { lovable_project_id: id, project_name: projectName() } }, async result => {
      if (result?.connected) {
        const firstActivation = !agentActive;
        agentActive = true;
        await setProjectPending(id, false);
        markStep("github", "done");
        markStep("db", cloud || supabaseRef() ? "done" : "pending");
        markStep("agent", "done");
        setStage("MSK Agente ativo", "done");
        syncGithub.textContent = `GitHub: ${result.repository || "conectado"}`;
        syncGithub.dataset.state = "connected";
        if (firstActivation) add("Conexão confirmada em tempo real. O MSK já pode executar comandos neste projeto.", "agent", "done");
      } else {
        agentActive = false;
        const { mskPendingProjects = {} } = await chrome.storage.local.get("mskPendingProjects");
        if (mskPendingProjects[id]) {
          markStep("github", "pending");
          markStep("agent", "pending");
          setStage("Aguardando GitHub", "running");
        }
      }
    });
  };
  setTimeout(loadV2State, 700);

  /* ============ ID DO PROJETO SINCRONIZADO ============ */
  const idEl = root.querySelector(".msk-project-id");
  const projectId = () => location.pathname.match(/(?:projects|p)\/([0-9a-f-]{8,})/i)?.[1]
    || location.hostname.match(/([0-9a-f]{8}-[0-9a-f-]{27,})/i)?.[1] || "";
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
    return id;
  };
  root.querySelector(".msk-project-copy").addEventListener("click", () => {
    const id = projectId();
    if (!id) return add("Nenhum projeto aberto para copiar o ID.", "agent", "error");
    navigator.clipboard?.writeText(id);
    add(`ID copiado: ${id}`, "agent", "sent");
  });
  refreshProjectId();
  setInterval(refreshProjectId, 2000);

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
    if (!id) return add("Abra um projeto Lovable antes de usar esta ação.", "agent", "error");
    if (type === "publish") return publishUpdateOnly();
    if (type === "github") return requestProjectConnection();
    const state = { type, returnUrl: location.href, startedAt: Date.now() };
    await chrome.storage.local.set({ [actionKey(id)]: state });
    setStage(type === "badge" ? "Verificando plano e badge" : "Abrindo Cloud / banco", "running");
    location.assign(type === "badge" ? `https://lovable.dev/projects/${id}/settings/project` : `https://lovable.dev/projects/${id}`);
  };
  const finishLovableAction = async (id, state, message, kind = "done") => {
    await chrome.storage.local.set({ [`mskActionResult:${id}`]: { message, kind, at: Date.now() } });
    await chrome.storage.local.remove(actionKey(id));
    if (state.returnUrl && state.returnUrl !== location.href) location.assign(state.returnUrl);
    else { add(message, "agent", kind); setStage(kind === "done" ? "Ação concluída" : "Ação disponível", kind); }
  };
  const resumeLovableAction = async () => {
    const id = refreshProjectId(); if (!id) return;
    const stored = await chrome.storage.local.get([actionKey(id), `mskActionResult:${id}`]);
    const result = stored[`mskActionResult:${id}`];
    if (result) {
      root.classList.add("msk-menu-open", "msk-panel-open"); placePanel();
      add(result.message, "agent", result.kind || "done");
      await chrome.storage.local.remove(`mskActionResult:${id}`);
    }
    const state = stored[actionKey(id)]; if (!state) return;
    if (state.type === "database") {
      await finishLovableAction(id, state, "Área de Cloud/banco aberta. A conexão usa somente os controles oficiais do Lovable e do Supabase.", "done");
      return;
    }
    if (state.type !== "badge" || !location.pathname.includes("/settings/project")) return;
    await sleep(1300);
    const textHit = [...document.querySelectorAll("label,span,p,div")].find(el => !root.contains(el) && visible(el) && /(remove|hide|remover|ocultar).{0,35}(badge|watermark|marca d.?água|lovable)/i.test(el.innerText || ""));
    const box = textHit?.closest("section,article,[class*='card'],[class*='setting'],div") || textHit?.parentElement;
    const control = box?.querySelector('button[role="switch"],input[type="checkbox"]');
    if (!textHit || !control) {
      const pro = /upgrade|plano pro|requires pro|requer pro/i.test(document.body.innerText || "");
      await finishLovableAction(id, state, pro ? "Remover badge exige um plano Lovable compatível. Nenhuma cobrança ou plano foi alterado." : "O controle oficial de remover badge não apareceu nesta conta. Nenhuma configuração foi alterada.", "error");
      return;
    }
    const enabled = control instanceof HTMLInputElement ? control.checked : control.getAttribute("aria-checked") === "true";
    if (!enabled) control.click();
    await sleep(500);
    const save = findByText(/^(save|salvar|apply|aplicar|update|atualizar)( changes| alterações)?$/i);
    if (save) await clickEl(save);
    await finishLovableAction(id, state, "Badge do Lovable removido pelos controles oficiais da conta. Você voltou à tela anterior.", "done");
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
    pubState.textContent = `${pub ? "Site publicado" : "Site em rascunho"} · status em tempo real`;
    return { published: pub, url };
  };
  refreshPublishState();
  setInterval(refreshPublishState, 4000);

  let running = false;

  const openPublishDialog = async () => {
    if (findByText(/^(publish|publicar|update|atualizar|republish|republicar)\b/i) && document.querySelector('[role="dialog"]')) return true;
    return clickText(/^(publish|publicar|republish|republicar)\b/i, 8000);
  };

  const doPublish = async (mode) => {
    // mode: "first" | "update"
    markStep("publish", "running");
    const opened = await openPublishDialog();
    if (!opened) {
      add("Não encontrei o botão de publicar nesta tela. Abra o projeto no editor do Lovable.", "agent", "error");
      markStep("publish", "error");
      return false;
    }
    const confirm = await waitFor(() => findByText(mode === "update"
      ? /^(update|atualizar|republish|republicar|publish|publicar)\b/i
      : /^(publish|publicar)\b/i), 9000);
    if (confirm) await clickEl(confirm);
    add(mode === "update" ? "Atualização de publicação solicitada." : "Publicação solicitada no Lovable.", "agent", "sent");
    markStep("publish", "done");
    return true;
  };

  const waitPublished = async () => {
    markStep("wait", "running");
    const live = await waitFor(() => publishedUrl() || (isPublished() ? "ok" : null), 180000, 1500);
    if (live) {
      add(`Publicação confirmada${String(live).startsWith("http") ? `: ${live}` : "."}`, "agent", "done");
      markStep("wait", "done");
    } else {
      add("Não consegui confirmar a publicação no tempo esperado; seguindo com as conexões.", "agent", "error");
      markStep("wait", "error");
    }
    await closeOverlays();
    refreshPublishState();
    return !!live;
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
      const ok = await waitFor(() => (alreadyConnected(/(github\.com\/[\w.-]+\/[\w.-]+|conectado|connected|sync)/i) ? "ok" : null), 90000, 2000);
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
    add("Fluxo nativo do GitHub não abriu; solicitando pelo chat do Lovable.", "agent", "running");
    const sent = pushToLovable(`Guardião MSK: conecte o projeto ${id} ao GitHub, crie o repositório e confirme o status da conexão.`);
    markStep("github", sent ? "pending" : "error");
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
      const ok = await waitFor(() => (alreadyConnected(/(supabase\.com\/dashboard\/project|conectado|connected|cloud ativo)/i) ? "ok" : null), 90000, 2000);
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
    add("Painel nativo do banco não abriu; solicitando pelo chat do Lovable com o ID do projeto.", "agent", "running");
    const sent = pushToLovable(`Guardião MSK: ative/valide o banco de dados (Lovable Cloud) do projeto ${id} e vincule este banco ao meu assistente MSK usando o ID do projeto ${id}. Confirme host, projeto e status da conexão.`);
    markStep("db", sent ? "pending" : "error");
    add(sent ? "Pedido de conexão do banco enviado para o projeto identificado." : "Abra o chat do Lovable para enviar o pedido do banco.", "agent", sent ? "sent" : "error");
    return false;
  };

  const connectDatabase = async (id) => {
    markStep("db", "running");
    const sent = pushToLovable(`Guardião MSK: ative/valide o banco de dados (Lovable Cloud) do projeto ${id} e vincule este banco ao meu assistente MSK usando o ID do projeto ${id}. Confirme host, projeto e status da conexão.`);
    if (sent) {
      add("Conexão do banco solicitada por ID do projeto.", "agent", "sent");
      markStep("db", "done");
    } else {
      add("Não consegui enviar o pedido de banco pelo chat do Lovable.", "agent", "error");
      markStep("db", "error");
    }
    await sleep(2500);
    return sent;
  };

  const handoff = async (id) => {
    markStep("agent", "running");
    const url = publishedUrl();
    const ok = pushToLovable(`Guardião MSK: projeto ${id}${url ? ` publicado em ${url}` : ""} está pronto. Registre repositório GitHub + banco de dados no meu assistente MSK e devolva os endpoints de integração.`);
    markStep("agent", ok ? "done" : "error");
    add(ok ? "Entrega ao assistente MSK enviada. Automação finalizada." : "Não consegui enviar a entrega final ao assistente.", "agent", ok ? "done" : "error");
    return ok;
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
        const asked = await doPublish(state.published ? "update" : "first");
        if (asked) await waitPublished();
        else markStep("wait", "error");
      }

      const gh = await connectGithub(id);
      const db = await connectSupabase(id);
      const done = await handoff(id);
      const pending = !gh;
      setStage(done && !pending ? "Automação concluída" : pending ? "Aguardando sua autorização" : "Automação com pendências", done && !pending ? "done" : "error");
      if (pending) add("Único passo que depende de você: autorizar o GitHub/Supabase na janela oficial do provedor. Depois disso, rode a automação novamente e ela conclui sozinha.", "agent");
      if (!db) add("Verifique se o chat do Lovable está aberto para o passo do banco de dados.", "agent", "error");
    } catch (err) {
      add(`Automação interrompida: ${err?.message || err}`, "agent", "error");
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
    runBtn.disabled = true;
    root.classList.add("msk-menu-open", "msk-panel-open"); placePanel();
    try {
      steps.forEach(li => (li.dataset.state = "idle"));
      setStage("Publicando atualização", "running");
      const ok = await doPublish(isPublished() ? "update" : "first");
      if (ok) await waitPublished();
      setStage(ok ? "Atualização publicada" : "Publicação com pendência", ok ? "done" : "error");
    } catch (err) {
      add(`Falha ao publicar: ${err?.message || err}`, "agent", "error");
      setStage("Falha ao publicar", "error");
    } finally {
      running = false;
      runBtn.disabled = false;
      refreshPublishState();
    }
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
    const key = gitGuideKey(id);
    const current = (await chrome.storage.local.get(key))[key];
    await chrome.storage.local.set({ [key]: current || { returnUrl: location.href, startedAt: Date.now() } });
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
      await chrome.storage.local.set({ [key]: { ...state, validating: true } });
      root.classList.add("msk-menu-open", "msk-panel-open"); placePanel();
      add(`Repositório detectado: ${repo.replace("https://github.com/", "")}. Validando a instalação MSK…`, "agent", "running");
      connectProject();
      return;
    }
    if (root.querySelector(".msk-git-guide")) return;
    guideBusy = true;
    try {
      removeGitGuide();
      const card = document.createElement("aside"); card.className = "msk-git-guide";
      const title = document.createElement("strong"); title.textContent = "Conectar GitHub ao Lovable";
      const step = document.createElement("span"); step.className = "msk-guide-step"; step.textContent = "PASSO 1 DE 2";
      const copy = document.createElement("p"); copy.textContent = "Clique primeiro em Git. Na tela seguinte, escolha GitHub e confirme o repositório deste projeto.";
      const note = document.createElement("small"); note.textContent = "O MSK continuará automaticamente quando o Lovable mostrar o repositório conectado.";
      const actions = document.createElement("div");
      const cancel = document.createElement("button"); cancel.className = "secondary"; cancel.textContent = "Cancelar";
      const next = document.createElement("button"); next.className = "primary"; next.textContent = "Destacar botão";
      cancel.addEventListener("click", async () => { await chrome.storage.local.remove(key); removeGitGuide(); });
      next.addEventListener("click", async () => {
        const exact = re => clickables().find(el => re.test(label(el).trim()));
        const target = exact(/^git$/i) || exact(/^github$/i) || findByText(/^(connect github|conectar github)$/i);
        if (target) { highlightApproval(target, /^git$/i.test(label(target).trim()) ? "a opção Git" : "o GitHub no Lovable"); target.scrollIntoView({ block: "center", behavior: "smooth" }); }
        else { copy.textContent = "Aguarde a página carregar. Abra a opção Git e depois selecione GitHub."; }
      });
      actions.append(cancel, next); card.append(step, title, copy, note, actions); root.appendChild(card);
      next.click();
    } finally { guideBusy = false; }
  };
  const supabaseRef = () => [...document.querySelectorAll('a[href*="supabase.com/dashboard/project/"]')]
    .map(a => a.href.match(/\/project\/([a-z0-9-]+)/i)?.[1]).find(Boolean) || "";
  const syncGithub = root.querySelector('[data-sync="github"]');
  const syncDatabase = root.querySelector('[data-sync="database"]');
  const syncLovable = root.querySelector('[data-sync="lovable"]');
  const refreshSyncCards = () => {
    const repo = repoUrl();
    const db = supabaseRef();
    const id = projectId();
    syncLovable.textContent = id ? `Lovable: ${id}` : "Lovable: abra um projeto";
    syncLovable.dataset.state = id ? "connected" : "pending";
    syncGithub.textContent = repo ? `GitHub: ${repo.replace("https://github.com/", "")}` : agentActive ? "GitHub: conectado" : "GitHub: aguardando autorização";
    syncGithub.dataset.state = repo || agentActive ? "connected" : "pending";
    syncDatabase.textContent = db ? `Supabase: ${db}` : /cloud (ativo|enabled)|backend connected/i.test(document.body.innerText || "") ? "Banco: Lovable Cloud" : "Banco: aguardando";
    syncDatabase.dataset.state = db || /cloud (ativo|enabled)|backend connected/i.test(document.body.innerText || "") ? "connected" : "pending";
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
        if (!location.pathname.includes("/settings/git")) {
          location.assign(`${base}/settings/git`);
          return;
        }
        await writeWizard(id, { ...state, phase: "github_create" });
        location.assign(`${base}/settings/git/github/create`);
        return;
      }
      if (state.phase === "github_create" || state.phase === "github_wait") {
        markStep("github", "running");
        const repo = repoUrl();
        if (repo || /repository (connected|created)|repositório (conectado|criado)|sync enabled/i.test(document.body.innerText || "")) {
          markStep("github", "done");
          syncGithub.textContent = repo ? `GitHub: ${repo.replace("https://github.com/", "")}` : "GitHub: conectado";
          syncGithub.dataset.state = "connected";
          add("GitHub conectado e repositório criado. Seguindo para o banco.", "agent", "done");
          await writeWizard(id, { ...state, phase: "database" });
          location.assign(base);
          return;
        }
        if (!location.pathname.includes("/settings/git/github")) {
          location.assign(`${base}/settings/git/github/create`);
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
        markStep("db", "running");
        const { db } = refreshSyncCards();
        if (db || /supabase project.*connected|projeto supabase.*conectado|cloud (ativo|enabled)/i.test(document.body.innerText || "")) {
          markStep("db", "done");
          markStep("agent", "done");
          setStage("Projeto sincronizado", "done");
          add(`Configuração concluída para o projeto ${id}. GitHub e banco estão sincronizados.`, "agent", "done");
          await writeWizard(id, { ...state, phase: "done", repo: repoUrl(), databaseRef: db || "lovable-cloud" });
          return;
        }
        if (location.pathname !== `/projects/${id}`) {
          location.assign(base);
          return;
        }
        await clickText(/^(more|mais)$/i, 3500);
        await clickText(/^(cloud|supabase|banco de dados|database)$/i, 5000);
        await clickText(/already have a supabase project|connect it here|já tenho um projeto supabase|conectar projeto supabase/i, 7000);
        const connectDb = findByText(/^(connect|conectar)$/i);
        if (highlightApproval(connectDb, "o projeto Supabase")) {
          markStep("db", "pending");
          syncDatabase.textContent = "Banco: escolha e confirme o projeto";
          syncDatabase.dataset.state = "pending";
          if (!state.notifiedDatabase) {
            add("Escolha o projeto Supabase e confirme o botão destacado. A vinculação será registrada pelo ID do projeto, nunca por IP.", "agent", "pending");
            await writeWizard(id, { ...state, phase: "database_wait", notifiedDatabase: true });
          }
        } else {
          setStage("Escolha Cloud ou Supabase", "running");
          add("Abra Mais → Cloud. Você pode manter o Lovable Cloud ou escolher “Connect it here” para usar um Supabase próprio.", "agent", "pending");
        }
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
      const asked = await doPublish("first");
      published = asked ? await waitPublished() : false;
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
    location.assign(`https://lovable.dev/projects/${id}/settings/git`);
  };
  setInterval(refreshSyncCards, 2000);
  setTimeout(refreshSyncCards, 500);
  setInterval(renderGitGuide, 1500);
  setTimeout(renderGitGuide, 700);
  setTimeout(resumeLovableAction, 900);

  root.querySelector(".msk-auto-run").addEventListener("click", requestProjectConnection);
  root.querySelector(".msk-auto-update")?.addEventListener("click", publishUpdateOnly);

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "MSK_OPEN") { root.classList.add("msk-menu-open", "msk-panel-open"); placePanel(); input.focus(); }
    if (message?.type === "MSK_AUTOMATE") requestProjectConnection();
    if (message?.type === "MSK_PUBLISH_UPDATE") publishUpdateOnly();
    if (message?.type === "MSK_V2_AUTH_COMPLETE") {
      if (!message.result?.ok) {
        add(message.result?.error || "A autorização do GitHub não foi concluída.", "agent", "error");
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
})();
