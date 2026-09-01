(() => {
  if (window.__MSK_PREFLIGHT__) return;

  const CACHE_MS = 30_000;
  const cache = new Map();
  let current = { ready: false, checking: false, blockers: [], warnings: [], services: {}, context: null, checkedAt: 0, hidden: true };
  let activePanelHost = null;
  let activateTimer = 0;

  const projectIdFromPage = () => String(location.href).match(/\/projects\/([0-9a-f-]{36})(?:[/?#]|$)/i)?.[1] || '';

  const send = message => new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(message, response => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          resolve({
            ready: false,
            code: 'EXTENSION_TRANSPORT_ERROR',
            error: runtimeError.message || 'Falha de comunicação interna da extensão.',
            blockers: [{ code: 'EXTENSION_TRANSPORT_ERROR', message: runtimeError.message || 'Falha de comunicação interna da extensão.' }],
            warnings: []
          });
          return;
        }
        resolve(response || {
          ready: false,
          code: 'EXTENSION_TRANSPORT_ERROR',
          error: 'Sem resposta do pre-flight MSK.',
          blockers: [{ code: 'EXTENSION_TRANSPORT_ERROR', message: 'Sem resposta do pre-flight MSK.' }],
          warnings: []
        });
      });
    } catch (error) {
      resolve({
        ready: false,
        code: 'EXTENSION_TRANSPORT_ERROR',
        error: error?.message || 'Falha de comunicação interna da extensão.',
        blockers: [{ code: 'EXTENSION_TRANSPORT_ERROR', message: error?.message || 'Falha de comunicação interna da extensão.' }],
        warnings: []
      });
    }
  });

  function operationalRoot() {
    const root = document.querySelector('#msk-root:not(.msk-gate-root)');
    if (!root) return null;
    const panel = root.querySelector('.msk-panel');
    if (!panel) return null;
    return { root, panel };
  }

  function statusLabel(status) {
    return status === 'up' ? 'OK' : status === 'degraded' ? 'ATENÇÃO' : status === 'down' ? 'INDISPONÍVEL' : 'VERIFICANDO';
  }

  function ensureStyle() {
    if (document.getElementById('msk-preflight-style')) return;
    const style = document.createElement('style');
    style.id = 'msk-preflight-style';
    style.textContent = `
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-panel{margin:8px 12px 10px;padding:10px 11px;border:1px solid rgba(110,118,129,.28);border-radius:12px;background:rgba(9,12,16,.72);font-size:11px;line-height:1.35;color:#d8dee4;position:relative;z-index:2}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-head{display:flex;align-items:center;gap:7px;font-weight:700;font-size:11px;letter-spacing:.04em}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-head .dot{width:8px;height:8px;border-radius:50%;background:#7d8590;box-shadow:0 0 8px rgba(125,133,144,.3)}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-panel[data-state="ready"] .msk-preflight-head .dot{background:#48ffa6;box-shadow:0 0 10px rgba(72,255,166,.65)}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-panel[data-state="warning"] .msk-preflight-head .dot{background:#f7c843;box-shadow:0 0 10px rgba(247,200,67,.55)}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-panel[data-state="blocked"] .msk-preflight-head .dot{background:#ff667a;box-shadow:0 0 10px rgba(255,102,122,.55)}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-services{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-service{border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:3px 7px;color:#9da7b3}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-service[data-status="up"]{color:#78f7b0;border-color:rgba(72,255,166,.18)}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-service[data-status="degraded"]{color:#ffd96b;border-color:rgba(247,200,67,.2)}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-service[data-status="down"]{color:#ff8b99;border-color:rgba(255,102,122,.22)}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-message{margin-top:7px;color:#b8c0ca}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-actions{display:flex;gap:6px;margin-top:7px}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-actions button{border:1px solid rgba(72,255,166,.28);border-radius:8px;background:rgba(72,255,166,.08);color:#9effc6;padding:5px 8px;font-size:10px;font-weight:700;cursor:pointer}
      #msk-root:not(.msk-gate-root) .msk-panel .msk-preflight-actions button.secondary{border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.04);color:#c5ccd5}
    `;
    document.documentElement.appendChild(style);
  }

  function removeOutsidePanels() {
    document.querySelectorAll('#msk-root.msk-gate-root .msk-preflight-panel').forEach(node => node.remove());
    document.querySelectorAll('#msk-root:not(.msk-gate-root) > .msk-preflight-panel').forEach(node => node.remove());
  }

  function ensurePanel() {
    removeOutsidePanels();
    const op = operationalRoot();
    if (!op) return null;
    ensureStyle();
    let preflight = op.panel.querySelector(':scope > .msk-preflight-panel');
    if (preflight) return preflight;

    preflight = document.createElement('div');
    preflight.className = 'msk-preflight-panel';
    const input = op.panel.querySelector('.msk-input');
    const anchor = input?.closest('form, .msk-input-wrap, .msk-compose, .msk-footer') || input?.parentElement;
    if (anchor?.parentElement && op.panel.contains(anchor)) anchor.parentElement.insertBefore(preflight, anchor);
    else op.panel.appendChild(preflight);
    return preflight;
  }

  function setComposerBlocked(blocked) {
    const op = operationalRoot();
    if (!op) return;
    const input = op.panel.querySelector('.msk-input');
    const sendButton = op.panel.querySelector('.msk-send');
    if (input) {
      if (blocked) { input.dataset.mskPreflightBlocked = 'true'; input.readOnly = true; }
      else if (input.dataset.mskPreflightBlocked === 'true') { delete input.dataset.mskPreflightBlocked; input.readOnly = false; }
    }
    if (sendButton) {
      if (blocked) { sendButton.dataset.mskPreflightBlocked = 'true'; sendButton.disabled = true; }
      else if (sendButton.dataset.mskPreflightBlocked === 'true') { delete sendButton.dataset.mskPreflightBlocked; sendButton.disabled = false; }
    }
  }

  function render(result = current) {
    current = { ...current, ...result };
    const preflight = ensurePanel();
    if (!preflight) {
      current.hidden = true;
      return;
    }
    current.hidden = false;
    const blockers = Array.isArray(current.blockers) ? current.blockers : [];
    const warnings = Array.isArray(current.warnings) ? current.warnings : [];
    const services = current.services || {};
    const state = current.checking ? 'checking' : blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready';
    preflight.dataset.state = state;

    const serviceDefs = [
      ['database', 'Banco'],
      ['github_api', 'GitHub'],
      ['ai_provider', 'MSK IA'],
      ['task_runtime', 'Tarefas']
    ];
    const serviceHtml = serviceDefs.map(([key, label]) => {
      const status = String(services?.[key]?.status || (current.checking ? 'checking' : 'unknown'));
      return `<span class="msk-preflight-service" data-status="${status}">${label}: ${statusLabel(status)}</span>`;
    }).join('');

    const blocker = blockers[0];
    const warning = warnings[0];
    const message = current.checking
      ? 'Verificando se o projeto está pronto para receber comandos...'
      : blocker
        ? `❌ ${blocker.message || blocker.code}`
        : warning
          ? `⚠️ ${warning.message || warning.code}`
          : '✅ Projeto pronto para edição segura.';

    preflight.innerHTML = `<div class="msk-preflight-head"><span class="dot"></span><span>PRE-FLIGHT MSK</span></div><div class="msk-preflight-services">${serviceHtml}</div><div class="msk-preflight-message"></div><div class="msk-preflight-actions"></div>`;
    preflight.querySelector('.msk-preflight-message').textContent = message;
    const actions = preflight.querySelector('.msk-preflight-actions');
    if (blocker) {
      if (/GITHUB|REPOSITORY|BRANCH/i.test(String(blocker.code || ''))) {
        const connect = document.createElement('button');
        connect.type = 'button';
        connect.textContent = blocker.action || 'Conectar GitHub';
        connect.addEventListener('click', () => operationalRoot()?.panel.querySelector('.msk-direct-github')?.click());
        actions.appendChild(connect);
      }
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'secondary';
      retry.textContent = 'Verificar novamente';
      retry.addEventListener('click', () => check({ force: true }).catch(() => {}));
      actions.appendChild(retry);
    } else if (warnings.length) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'secondary';
      retry.textContent = 'Atualizar status';
      retry.addEventListener('click', () => check({ force: true }).catch(() => {}));
      actions.appendChild(retry);
    }
    setComposerBlocked(current.checking || blockers.length > 0);
  }

  async function check({ force = false, projectId = projectIdFromPage(), repositoryUrl = '' } = {}) {
    const op = operationalRoot();
    if (!op) {
      current = { ...current, ready: false, checking: false, hidden: true };
      return { ...current };
    }

    const key = String(projectId || 'none');
    const cached = cache.get(key);
    if (!force && cached && Date.now() - cached.checkedAt < CACHE_MS) {
      render(cached);
      return cached;
    }

    render({ checking: true, blockers: [], warnings: [] });
    const result = await send({
      type: 'MSK_DIRECT_AGENT_PREFLIGHT_V1',
      payload: { lovable_project_id: projectId, repository_url: repositoryUrl }
    });

    const normalized = {
      ready: result?.ready === true,
      checking: false,
      blockers: Array.isArray(result?.blockers)
        ? result.blockers
        : (result?.ready === true ? [] : [{ code: result?.code || 'PREFLIGHT_FAILED', message: result?.error || 'Não foi possível confirmar o pre-flight.' }]),
      warnings: Array.isArray(result?.warnings) ? result.warnings : [],
      services: result?.services || {},
      context: result?.context || null,
      checkedAt: Date.now(),
      hidden: false
    };
    cache.set(key, normalized);
    render(normalized);
    return normalized;
  }

  async function ensureReady(options = {}) {
    return check({ ...options, force: true });
  }

  function invalidate(projectId = projectIdFromPage()) {
    cache.delete(String(projectId || 'none'));
  }

  function maybeActivate() {
    removeOutsidePanels();
    const op = operationalRoot();
    const host = op?.panel || null;
    if (!host) {
      activePanelHost = null;
      current.hidden = true;
      return;
    }
    ensurePanel();
    if (activePanelHost === host) return;
    activePanelHost = host;
    clearTimeout(activateTimer);
    activateTimer = setTimeout(() => check({ force: true }).catch(() => {
      render({ checking: false, ready: false, blockers: [{ code: 'PREFLIGHT_UNAVAILABLE', message: 'Não consegui validar as condições do agente agora.' }], warnings: [] });
    }), 250);
  }

  window.__MSK_PREFLIGHT__ = { check, ensureReady, invalidate, getState: () => ({ ...current }) };

  const observer = new MutationObserver(maybeActivate);
  const start = () => {
    if (!document.documentElement) return requestAnimationFrame(start);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    maybeActivate();
  };
  start();

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'MSK_DIRECT_AGENT_CONNECTED_RETURN') return undefined;
    invalidate(String(message.projectId || projectIdFromPage()));
    setTimeout(() => check({ force: true }).catch(() => {}), 500);
    return undefined;
  });
})();
