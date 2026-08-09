(() => {
  'use strict';

  const TAG_HANDSHAKE = '[Handshake]';
  const TAG_PARSING = '[Parsing]';
  const TAG_EXECUTION = '[Execution]';

  const REMOTE_MANIFEST_URL = 'https://msk-keymaster.lovable.app/ext/runtime/manifest';
  const REMOTE_UI_ORIGIN = 'https://msk-keymaster.lovable.app';
  const REMOTE_UI_BASE_URL = `${REMOTE_UI_ORIGIN}/ext/runtime/ui`;
  const REMOTE_HOT_RELOAD_WS_URL = 'wss://msk-keymaster.lovable.app/ext/runtime/ws/hotreload';
  const REMOTE_BUNDLE_HOST = 'msk-keymaster.lovable.app';
  const DEV_REMOTE_HOT_RELOAD = false;

  // Chave pública de exemplo (substituir pela chave real de produção).
  const RUNTIME_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmFRPQDuWVOwgGrBiSgrv
7A+5HkEu1CgDka2wMQWvjKiPOabq9YMjZtFsLV0wo07Gvb9i+Za1y4zz3XAFoW6R
uCguzU8yQ05Kfi/E9SaSpKsSgoRHqfcnHEGnD3goGyzs7yGOQf9gN4vsS5MTGJ5C
qa4pKeqPhIkYJ4cTcVg1qL2mSlns87lrh7qNv6JEbmOqX29kLi5AG9dDm6QQdpBX
830PmYqV0fwSXz5RkUt9QfXu8L6sLXjUVxwUUtOPqSApdtd8l3zdKI6fdS9fBv91
oxoIOqNiEib4XPuRjaeGgOhrkip/0IW4ojIfZLNhTRkKTJAJXfnKCyiVk0YiYixs
jwIDAQAB
-----END PUBLIC KEY-----`;

  const SUPPORT_WHATSAPP_URL = 'https://chat.whatsapp.com/HcF04iHn3rbIWvXdCoxJLb';

  const loaderStatusEl = document.getElementById('loaderStatus');
  const loaderProgressEl = document.getElementById('loaderProgress');
  const diagnosticsEl = document.getElementById('diagnostics');
  const errorBoxEl = document.getElementById('errorBox');
  const errorTextEl = document.getElementById('errorText');
  const retryBtnEl = document.getElementById('retryBtn');
  const supportBtnEl = document.getElementById('supportBtn');
  const runtimeRootEl = document.getElementById('runtimeRoot');

  const REMOTE_UI_BRIDGE_EVENT = 'InfinityRuntimeBridge';
  const remoteBridgeHostEvents = { bound: false };
  const devHotReloadState = {
    socket: null,
    reconnectTimerId: null,
    stopped: false,
    reconnectAttempt: 0,
    lastFingerprint: null,
  };
  const BRIDGE_SDK_VERSION = '1.0.0';
  const BRIDGE_INTERCEPTOR_RUNTIME_KEY = '__lovableSdkInterceptors';

  const BRIDGE_SUPPORTED_COMMANDS = [
    'runtime.sendMessage',
    'runtime.getManifest',
    'runtime.getURL',
    'runtime.getPlatformInfo',
    'runtime.reload',
    'storage.get',
    'storage.set',
    'storage.remove',
    'storage.clear',
    'storage.getBytesInUse',
    'tabs.query',
    'tabs.get',
    'tabs.create',
    'tabs.update',
    'tabs.reload',
    'tabs.remove',
    'windows.getCurrent',
    'windows.create',
    'scripting.executeScript',
    'scripting.insertCSS',
    'scripting.removeCSS',
    'notifications.create',
    'fetch',
    'window.open',
    'sdk.getCapabilities',
    'sdk.health',
    'interceptor.register',
    'interceptor.unregister',
    'interceptor.list',
    'interceptor.clear',
    'lovable.toggleChat',
    'lovable.fetchQuickSuggestions',
    'lovable.fetchHistory',
  ];

  const BRIDGE_SUPPORTED_EVENTS = [
    'storage.onChanged',
    'tabs.onActivated',
    'tabs.onUpdated',
    'runtime.onMessage',
    'interceptor.onEvent',
  ];

  const CONTEXT_MENU_BLOCK_MESSAGE = 'Clique com botão direito desativado.';
  const CONTEXT_MENU_TOAST_COOLDOWN_MS = 1800;
  let lastContextMenuToastAt = 0;
  let contextMenuToastTimerId = null;

  function isAllowedRemoteUiOrigin(origin) {
    return String(origin || '') === REMOTE_UI_ORIGIN;
  }

  function buildRemoteUiUrl(pathname = 'sidepanel.html', query = null) {
    const clean = String(pathname || 'sidepanel.html').replace(/^\/+/, '');
    const base = `${REMOTE_UI_BASE_URL}/${clean}`;
    if (!query || typeof query !== 'object') return base;
    const params = new URLSearchParams();
    Object.keys(query).forEach((key) => {
      const value = query[key];
      if (value === undefined || value === null) return;
      params.set(key, String(value));
    });
    const serialized = params.toString();
    return serialized ? `${base}?${serialized}` : base;
  }

  function toSerializableError(error) {
    return {
      message: String(error?.message || error || 'Erro desconhecido.'),
      name: String(error?.name || 'Error'),
    };
  }

  function sendBridgeReply(targetWindow, sourceOrigin, requestId, ok, payload) {
    if (!targetWindow || !requestId) return;
    targetWindow.postMessage({
      channel: REMOTE_UI_BRIDGE_EVENT,
      phase: 'response',
      requestId,
      ok: !!ok,
      payload: payload ?? null,
    }, sourceOrigin);
  }

  function sanitizeSenderForBridge(sender) {
    if (!sender || typeof sender !== 'object') return null;
    return {
      id: sender.id ? String(sender.id) : null,
      url: sender.url ? String(sender.url) : null,
      origin: sender.origin ? String(sender.origin) : null,
      frameId: Number.isFinite(Number(sender.frameId)) ? Number(sender.frameId) : null,
      documentId: sender.documentId ? String(sender.documentId) : null,
      documentLifecycle: sender.documentLifecycle ? String(sender.documentLifecycle) : null,
      tab: sender.tab
        ? {
          id: Number.isFinite(Number(sender.tab.id)) ? Number(sender.tab.id) : null,
          url: sender.tab.url ? String(sender.tab.url) : null,
          title: sender.tab.title ? String(sender.tab.title) : null,
          active: !!sender.tab.active,
          status: sender.tab.status ? String(sender.tab.status) : null,
          windowId: Number.isFinite(Number(sender.tab.windowId)) ? Number(sender.tab.windowId) : null,
        }
        : null,
    };
  }

  function getBridgeCapabilities() {
    return {
      bridgeVersion: BRIDGE_SDK_VERSION,
      commands: BRIDGE_SUPPORTED_COMMANDS.slice(),
      events: BRIDGE_SUPPORTED_EVENTS.slice(),
      interceptor: {
        requiredConfig: ['tabId'],
        optionalConfig: [
          'id',
          'eventTypes',
          'selectors',
          'capture',
          'preventDefault',
          'stopPropagation',
          'passive',
          'once',
          'onlyTrusted',
          'keys',
          'urlContains',
          'throttleMs',
          'maxEventsPerMinute',
          'includeText',
        ],
      },
    };
  }

  function normalizeInterceptorConfig(rawConfig) {
    const safe = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const tabId = Number(safe.tabId || 0);
    const eventTypes = Array.isArray(safe.eventTypes)
      ? safe.eventTypes
        .map((evt) => String(evt || '').trim().toLowerCase())
        .filter(Boolean)
      : ['click'];
    const selectors = Array.isArray(safe.selectors)
      ? safe.selectors
        .map((selector) => String(selector || '').trim())
        .filter(Boolean)
      : ['*'];
    const keys = Array.isArray(safe.keys)
      ? safe.keys
        .map((key) => String(key || '').trim().toLowerCase())
        .filter(Boolean)
      : [];

    return {
      id: String(safe.id || '').trim() || `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tabId,
      eventTypes: eventTypes.length ? Array.from(new Set(eventTypes)) : ['click'],
      selectors: selectors.length ? Array.from(new Set(selectors)) : ['*'],
      capture: safe.capture !== false,
      preventDefault: !!safe.preventDefault,
      stopPropagation: !!safe.stopPropagation,
      passive: !!safe.passive,
      once: !!safe.once,
      onlyTrusted: !!safe.onlyTrusted,
      keys: Array.from(new Set(keys)),
      urlContains: String(safe.urlContains || '').trim(),
      throttleMs: Math.max(0, Number(safe.throttleMs || 0) || 0),
      maxEventsPerMinute: Math.max(0, Number(safe.maxEventsPerMinute || 0) || 0),
      includeText: safe.includeText !== false,
    };
  }

  async function registerBridgeInterceptor(rawConfig) {
    const config = normalizeInterceptorConfig(rawConfig);
    if (!Number.isFinite(config.tabId) || config.tabId <= 0) {
      throw new Error('tabId inválido para interceptor.register');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: config.tabId },
      world: 'ISOLATED',
      args: [config],
      func: (inputConfig) => {
        const STORE_KEY = '__lovableSdkInterceptors';
        const safe = inputConfig && typeof inputConfig === 'object' ? inputConfig : {};

        const eventTypes = Array.isArray(safe.eventTypes)
          ? safe.eventTypes.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
          : ['click'];
        const selectors = Array.isArray(safe.selectors)
          ? safe.selectors.map((item) => String(item || '').trim()).filter(Boolean)
          : ['*'];
        const keys = Array.isArray(safe.keys)
          ? safe.keys.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
          : [];

        const id = String(safe.id || '').trim() || `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const preventDefault = !!safe.preventDefault;
        const stopPropagation = !!safe.stopPropagation;
        const capture = safe.capture !== false;
        const passive = preventDefault ? false : !!safe.passive;
        const once = !!safe.once;
        const onlyTrusted = !!safe.onlyTrusted;
        const includeText = safe.includeText !== false;
        const throttleMs = Math.max(0, Number(safe.throttleMs || 0) || 0);
        const maxEventsPerMinute = Math.max(0, Number(safe.maxEventsPerMinute || 0) || 0);
        const urlContains = String(safe.urlContains || '').trim();

        if (!window[STORE_KEY] || typeof window[STORE_KEY] !== 'object') {
          window[STORE_KEY] = { items: {} };
        }
        if (!window[STORE_KEY].items || typeof window[STORE_KEY].items !== 'object') {
          window[STORE_KEY].items = {};
        }

        const store = window[STORE_KEY];

        const current = store.items[id];
        if (current && typeof current.cleanup === 'function') {
          current.cleanup();
        }

        let lastAt = 0;
        const minuteBucket = [];

        const item = {
          id,
          createdAt: Date.now(),
          hits: 0,
          eventTypes,
          selectors,
          keys,
          urlContains,
          cleanup: null,
        };

        const describeNode = (node) => {
          if (!node || node.nodeType !== 1) return '';
          const el = node;
          const tag = String(el.tagName || '').toLowerCase();
          const elId = el.id ? `#${el.id}` : '';
          const classes = typeof el.className === 'string'
            ? el.className.trim().split(/\s+/).slice(0, 2).map((cls) => `.${cls}`).join('')
            : '';
          return `${tag}${elId}${classes}`;
        };

        const resolveMatch = (target) => {
          if (!target || typeof target.closest !== 'function') return null;
          if (!selectors.length || selectors.includes('*')) {
            return {
              selector: '*',
              element: target,
            };
          }

          for (const selector of selectors) {
            try {
              const found = target.closest(selector);
              if (found) {
                return {
                  selector,
                  element: found,
                };
              }
            } catch (_) {
              // seletor inválido, ignora.
            }
          }

          return null;
        };

        const listener = (event) => {
          const type = String(event?.type || '').toLowerCase();
          if (!type || !eventTypes.includes(type)) return;
          if (onlyTrusted && !event.isTrusted) return;
          if (urlContains && !String(window.location.href || '').includes(urlContains)) return;

          if (keys.length > 0 && (type === 'keydown' || type === 'keyup' || type === 'keypress')) {
            const eventKey = String(event.key || '').trim().toLowerCase();
            if (!eventKey || !keys.includes(eventKey)) return;
          }

          const now = Date.now();
          if (throttleMs > 0 && (now - lastAt) < throttleMs) return;

          while (minuteBucket.length && (now - minuteBucket[0]) > 60000) {
            minuteBucket.shift();
          }
          if (maxEventsPerMinute > 0 && minuteBucket.length >= maxEventsPerMinute) return;

          const initialTarget = event?.target || null;
          const target = initialTarget && typeof initialTarget.closest === 'function'
            ? initialTarget
            : (event?.composedPath?.()[0] || null);
          const matched = resolveMatch(target);
          if (!matched) return;

          lastAt = now;
          minuteBucket.push(now);
          item.hits += 1;

          const path = typeof event.composedPath === 'function'
            ? event.composedPath().slice(0, 8).map((node) => describeNode(node)).filter(Boolean)
            : [];

          const payload = {
            interceptorId: id,
            eventType: type,
            selector: matched.selector,
            url: String(window.location.href || ''),
            title: String(document.title || ''),
            timestamp: now,
            key: String(event.key || ''),
            code: String(event.code || ''),
            ctrlKey: !!event.ctrlKey,
            shiftKey: !!event.shiftKey,
            altKey: !!event.altKey,
            metaKey: !!event.metaKey,
            target: describeNode(matched.element || target),
            text: includeText
              ? String(
                matched.element?.getAttribute?.('aria-label')
                || matched.element?.getAttribute?.('title')
                || matched.element?.textContent
                || ''
              ).replace(/\s+/g, ' ').trim().slice(0, 240)
              : '',
            path,
            defaultPrevented: !!event.defaultPrevented,
          };

          try {
            chrome.runtime.sendMessage({
              action: 'sdkInterceptorEvent',
              payload,
            });
          } catch (_) {
            // sem ação
          }

          if (preventDefault) {
            event.preventDefault();
          }
          if (stopPropagation) {
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
              event.stopImmediatePropagation();
            }
          }

          if (once && typeof item.cleanup === 'function') {
            item.cleanup();
          }
        };

        const listenerOptions = {
          capture,
          passive,
        };

        eventTypes.forEach((eventType) => {
          window.addEventListener(eventType, listener, listenerOptions);
        });

        item.cleanup = () => {
          eventTypes.forEach((eventType) => {
            window.removeEventListener(eventType, listener, listenerOptions);
          });
          delete store.items[id];
        };

        store.items[id] = item;

        return {
          ok: true,
          id,
          eventTypes: item.eventTypes,
          selectors: item.selectors,
          createdAt: item.createdAt,
        };
      },
    });

    const runtimeError = chrome.runtime?.lastError;
    if (runtimeError) {
      throw new Error(String(runtimeError.message || 'Falha ao instalar interceptor.'));
    }

    return results?.[0]?.result || { ok: false, error: 'no_result' };
  }

  async function unregisterBridgeInterceptor(tabId, interceptorId) {
    const safeTabId = Number(tabId || 0);
    const safeId = String(interceptorId || '').trim();
    if (!Number.isFinite(safeTabId) || safeTabId <= 0) {
      throw new Error('tabId inválido para interceptor.unregister');
    }
    if (!safeId) {
      throw new Error('id inválido para interceptor.unregister');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: safeTabId },
      world: 'ISOLATED',
      args: [safeId],
      func: (id) => {
        const STORE_KEY = '__lovableSdkInterceptors';
        const store = window[STORE_KEY] && typeof window[STORE_KEY] === 'object'
          ? window[STORE_KEY]
          : { items: {} };
        const item = store.items?.[id];
        if (item && typeof item.cleanup === 'function') {
          item.cleanup();
          return { ok: true, removed: 1 };
        }
        return { ok: true, removed: 0 };
      },
    });

    const runtimeError = chrome.runtime?.lastError;
    if (runtimeError) {
      throw new Error(String(runtimeError.message || 'Falha ao remover interceptor.'));
    }

    return results?.[0]?.result || { ok: true, removed: 0 };
  }

  async function listBridgeInterceptors(tabId) {
    const safeTabId = Number(tabId || 0);
    if (!Number.isFinite(safeTabId) || safeTabId <= 0) {
      throw new Error('tabId inválido para interceptor.list');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: safeTabId },
      world: 'ISOLATED',
      args: [BRIDGE_INTERCEPTOR_RUNTIME_KEY],
      func: (storeKey) => {
        const key = String(storeKey || '__lovableSdkInterceptors');
        const store = window[key] && typeof window[key] === 'object' ? window[key] : { items: {} };
        const items = store.items && typeof store.items === 'object' ? store.items : {};
        return Object.values(items).map((item) => ({
          id: String(item?.id || ''),
          eventTypes: Array.isArray(item?.eventTypes) ? item.eventTypes : [],
          selectors: Array.isArray(item?.selectors) ? item.selectors : [],
          keys: Array.isArray(item?.keys) ? item.keys : [],
          createdAt: Number(item?.createdAt || 0),
          hits: Number(item?.hits || 0),
          urlContains: String(item?.urlContains || ''),
        }));
      },
    });

    const runtimeError = chrome.runtime?.lastError;
    if (runtimeError) {
      throw new Error(String(runtimeError.message || 'Falha ao listar interceptors.'));
    }

    return Array.isArray(results?.[0]?.result) ? results[0].result : [];
  }

  async function clearBridgeInterceptors(tabId) {
    const safeTabId = Number(tabId || 0);
    if (!Number.isFinite(safeTabId) || safeTabId <= 0) {
      throw new Error('tabId inválido para interceptor.clear');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: safeTabId },
      world: 'ISOLATED',
      args: [BRIDGE_INTERCEPTOR_RUNTIME_KEY],
      func: (storeKey) => {
        const key = String(storeKey || '__lovableSdkInterceptors');
        const store = window[key] && typeof window[key] === 'object' ? window[key] : { items: {} };
        const items = store.items && typeof store.items === 'object' ? store.items : {};
        let removed = 0;

        Object.keys(items).forEach((id) => {
          const item = items[id];
          if (item && typeof item.cleanup === 'function') {
            item.cleanup();
            removed += 1;
          }
        });

        store.items = {};
        window[key] = store;

        return { ok: true, removed };
      },
    });

    const runtimeError = chrome.runtime?.lastError;
    if (runtimeError) {
      throw new Error(String(runtimeError.message || 'Falha ao limpar interceptors.'));
    }

    return results?.[0]?.result || { ok: true, removed: 0 };
  }

  function postBridgeEvent(eventName, payload) {
    const iframe = document.getElementById('remoteUiFrame');
    const targetWindow = iframe?.contentWindow;
    if (!targetWindow) return;

    targetWindow.postMessage({
      channel: REMOTE_UI_BRIDGE_EVENT,
      phase: 'event',
      event: String(eventName || ''),
      payload: payload ?? null,
    }, REMOTE_UI_ORIGIN);
  }

  function stopDevRemoteHotReloadLoop() {
    devHotReloadState.stopped = true;
    if (devHotReloadState.reconnectTimerId) {
      clearTimeout(devHotReloadState.reconnectTimerId);
      devHotReloadState.reconnectTimerId = null;
    }
    if (devHotReloadState.socket) {
      try {
        devHotReloadState.socket.close();
      } catch (_) {
        // sem ação
      }
      devHotReloadState.socket = null;
    }
  }

  function devHotReloadApplyRuntimeChange(payload) {
    const data = payload && typeof payload === 'object' ? payload : {};
    const scope = String(data.scope || 'runtime').toLowerCase();
    const fingerprint = String(data.fingerprint || '').trim() || null;

    if (fingerprint && fingerprint === devHotReloadState.lastFingerprint) {
      return;
    }
    devHotReloadState.lastFingerprint = fingerprint;

    if (scope === 'ui') {
      const iframe = document.getElementById('remoteUiFrame');
      if (!iframe) return;

      const currentSrc = String(iframe.getAttribute('src') || buildRemoteUiUrl('sidepanel.html'));
      const next = new URL(currentSrc);
      next.searchParams.set('__hot_reload', String(Date.now()));
      iframe.setAttribute('src', next.toString());
      setDiagnostics(`${TAG_EXECUTION} alteração remota de UI detectada via WS. Recarregando iframe...`);
      return;
    }

    setDiagnostics(`${TAG_HANDSHAKE} alteração remota detectada via WS. Recarregando runtime...`);
    void initializeSidepanelRuntime('dev-hot-reload-ws');
  }

  function scheduleDevHotReloadReconnect() {
    if (!DEV_REMOTE_HOT_RELOAD || devHotReloadState.stopped) return;
    if (devHotReloadState.reconnectTimerId) return;

    const baseDelay = 1000;
    const maxDelay = 12000;
    const attempt = Math.max(0, Number(devHotReloadState.reconnectAttempt || 0));
    const delay = Math.min(maxDelay, baseDelay * Math.pow(1.7, attempt));

    devHotReloadState.reconnectTimerId = setTimeout(() => {
      devHotReloadState.reconnectTimerId = null;
      connectDevHotReloadSocket();
    }, delay);
  }

  function connectDevHotReloadSocket() {
    if (!DEV_REMOTE_HOT_RELOAD || devHotReloadState.stopped) return;
    if (devHotReloadState.socket && devHotReloadState.socket.readyState <= 1) return;

    let socket;
    try {
      socket = new WebSocket(REMOTE_HOT_RELOAD_WS_URL);
    } catch (_) {
      devHotReloadState.reconnectAttempt += 1;
      scheduleDevHotReloadReconnect();
      return;
    }

    devHotReloadState.socket = socket;

    socket.addEventListener('open', () => {
      devHotReloadState.reconnectAttempt = 0;
      setDiagnostics(`${TAG_HANDSHAKE} hot-reload WS conectado.`);
    });

    socket.addEventListener('message', (event) => {
      let payload = null;
      try {
        payload = JSON.parse(String(event.data || 'null'));
      } catch (_) {
        payload = null;
      }
      if (!payload || typeof payload !== 'object') return;
      if (String(payload.type || '') !== 'runtime_changed') return;
      devHotReloadApplyRuntimeChange(payload);
    });

    socket.addEventListener('close', () => {
      if (devHotReloadState.socket === socket) {
        devHotReloadState.socket = null;
      }
      if (!devHotReloadState.stopped) {
        devHotReloadState.reconnectAttempt += 1;
        scheduleDevHotReloadReconnect();
      }
    });

    socket.addEventListener('error', () => {
      try {
        socket.close();
      } catch (_) {
        // sem ação
      }
    });
  }

  function startDevRemoteHotReloadLoop() {
    if (!DEV_REMOTE_HOT_RELOAD) return;
    devHotReloadState.stopped = false;
    connectDevHotReloadSocket();
  }

  function setupRemoteUiBridge() {
    const bridgeIframe = document.getElementById('remoteUiFrame');
    if (!bridgeIframe) return;

    window.addEventListener('message', (event) => {
      if (!isAllowedRemoteUiOrigin(event.origin)) return;
      if (event.source !== bridgeIframe.contentWindow) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.channel !== REMOTE_UI_BRIDGE_EVENT || data.phase !== 'request') return;

      const requestId = String(data.requestId || '').trim();
      const command = String(data.command || '').trim();
      const args = Array.isArray(data.args) ? data.args : [];

      const replyOk = (payload) => sendBridgeReply(event.source, event.origin, requestId, true, payload);
      const replyErr = (error) => sendBridgeReply(event.source, event.origin, requestId, false, {
        error: String(error?.message || error || 'Falha no bridge.'),
      });

      try {
        switch (command) {
          case 'runtime.sendMessage': {
            const payload = args[0] ?? null;
            chrome.runtime.sendMessage(payload, (response) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em runtime.sendMessage')));
                return;
              }
              replyOk(response ?? null);
            });
            return;
          }

          case 'storage.get': {
            const keys = args[0] ?? null;
            chrome.storage.local.get(keys, (result) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em storage.get')));
                return;
              }
              replyOk(result || {});
            });
            return;
          }

          case 'storage.set': {
            const payload = args[0] ?? {};
            chrome.storage.local.set(payload, () => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em storage.set')));
                return;
              }
              replyOk({ ok: true });
            });
            return;
          }

          case 'storage.remove': {
            const keys = args[0] ?? null;
            chrome.storage.local.remove(keys, () => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em storage.remove')));
                return;
              }
              replyOk({ ok: true });
            });
            return;
          }

          case 'tabs.query': {
            const queryInfo = args[0] ?? {};
            chrome.tabs.query(queryInfo, (tabs) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em tabs.query')));
                return;
              }
              replyOk(tabs || []);
            });
            return;
          }

          case 'tabs.create': {
            const createProps = args[0] ?? {};
            chrome.tabs.create(createProps, (tab) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em tabs.create')));
                return;
              }
              replyOk(tab || null);
            });
            return;
          }

          case 'scripting.executeScript': {
            const details = args[0] ?? null;
            if (!details || typeof details !== 'object') {
              replyErr(new Error('Parâmetros inválidos para scripting.executeScript'));
              return;
            }
            chrome.scripting.executeScript(details, (injectionResults) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em scripting.executeScript')));
                return;
              }
              replyOk(injectionResults || []);
            });
            return;
          }

          case 'notifications.create': {
            const options = args[0] ?? {};
            chrome.notifications.create('', options, (notificationId) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em notifications.create')));
                return;
              }
              replyOk({ id: notificationId || '' });
            });
            return;
          }

          case 'runtime.getManifest': {
            replyOk(chrome.runtime.getManifest());
            return;
          }

          case 'runtime.getURL': {
            const path = String(args[0] || '');
            replyOk(chrome.runtime.getURL(path));
            return;
          }

          case 'runtime.getPlatformInfo': {
            chrome.runtime.getPlatformInfo((platformInfo) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em runtime.getPlatformInfo')));
                return;
              }
              replyOk(platformInfo || null);
            });
            return;
          }

          case 'runtime.reload': {
            replyOk({ ok: true, reloading: true });
            setTimeout(() => {
              try {
                chrome.runtime.reload();
              } catch (_) {
                // sem ação
              }
            }, 50);
            return;
          }

          case 'sdk.getCapabilities': {
            replyOk(getBridgeCapabilities());
            return;
          }

          case 'sdk.health': {
            Promise.resolve()
              .then(async () => {
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const runtimeStatus = await fetchBackgroundState();
                return {
                  ok: true,
                  bridgeVersion: BRIDGE_SDK_VERSION,
                  activeTab: activeTab || null,
                  runtimeStatus: runtimeStatus || null,
                  now: Date.now(),
                };
              })
              .then(replyOk)
              .catch(replyErr);
            return;
          }

          case 'window.open': {
            const rawUrl = String(args[0] || '');
            const target = String(args[1] || '_blank');
            const features = String(args[2] || 'noopener,noreferrer');
            window.open(rawUrl, target, features);
            replyOk({ ok: true });
            return;
          }

          case 'fetch': {
            const payload = args[0] ?? null;
            const proxyPrefix = '__bridge_proxy__::';

            let input = payload;
            let init = args[1] ?? {};

            if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
              const rawUrl = String(payload.url || '').trim();
              input = rawUrl || payload.input || '';
              init = payload.options ?? payload.init ?? {};
            }

            if (typeof input === 'string' && input.startsWith(proxyPrefix)) {
              input = input.slice(proxyPrefix.length);
            }

            fetch(input, init)
              .then(async (response) => {
                const text = await response.text();
                replyOk({
                  ok: response.ok,
                  status: response.status,
                  statusText: response.statusText,
                  headers: Object.fromEntries(response.headers.entries()),
                  bodyText: text,
                });
              })
              .catch((error) => replyErr(error));
            return;
          }

          case 'storage.clear': {
            chrome.storage.local.clear(() => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em storage.clear')));
                return;
              }
              replyOk({ ok: true });
            });
            return;
          }

          case 'storage.getBytesInUse': {
            const keys = args[0] ?? null;
            chrome.storage.local.getBytesInUse(keys, (bytesInUse) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em storage.getBytesInUse')));
                return;
              }
              replyOk(Number(bytesInUse || 0));
            });
            return;
          }

          case 'tabs.get': {
            const tabId = Number(args[0]);
            if (!Number.isFinite(tabId) || tabId <= 0) {
              replyErr(new Error('tabId inválido para tabs.get'));
              return;
            }
            chrome.tabs.get(tabId, (tab) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em tabs.get')));
                return;
              }
              replyOk(tab || null);
            });
            return;
          }

          case 'tabs.update': {
            const tabId = Number(args[0]);
            const updateProps = args[1] ?? {};
            if (!Number.isFinite(tabId) || tabId <= 0) {
              replyErr(new Error('tabId inválido para tabs.update'));
              return;
            }
            chrome.tabs.update(tabId, updateProps, (tab) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em tabs.update')));
                return;
              }
              replyOk(tab || null);
            });
            return;
          }

          case 'tabs.reload': {
            const tabId = Number(args[0]);
            const reloadProps = args[1] ?? {};
            if (!Number.isFinite(tabId) || tabId <= 0) {
              replyErr(new Error('tabId inválido para tabs.reload'));
              return;
            }
            chrome.tabs.reload(tabId, reloadProps, () => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em tabs.reload')));
                return;
              }
              replyOk({ ok: true });
            });
            return;
          }

          case 'tabs.remove': {
            const tabIdsRaw = args[0];
            const tabIds = Array.isArray(tabIdsRaw)
              ? tabIdsRaw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
              : [Number(tabIdsRaw)].filter((id) => Number.isFinite(id) && id > 0);

            if (!tabIds.length) {
              replyErr(new Error('tabId(s) inválido(s) para tabs.remove'));
              return;
            }

            chrome.tabs.remove(tabIds, () => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em tabs.remove')));
                return;
              }
              replyOk({ ok: true, removed: tabIds.length });
            });
            return;
          }

          case 'windows.getCurrent': {
            const getInfo = args[0] ?? { populate: false };
            chrome.windows.getCurrent(getInfo, (win) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em windows.getCurrent')));
                return;
              }
              replyOk(win || null);
            });
            return;
          }

          case 'windows.create': {
            const createData = args[0] ?? {};
            chrome.windows.create(createData, (win) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em windows.create')));
                return;
              }
              replyOk(win || null);
            });
            return;
          }

          case 'scripting.insertCSS': {
            const details = args[0] ?? null;
            if (!details || typeof details !== 'object') {
              replyErr(new Error('Parâmetros inválidos para scripting.insertCSS'));
              return;
            }
            chrome.scripting.insertCSS(details, () => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em scripting.insertCSS')));
                return;
              }
              replyOk({ ok: true });
            });
            return;
          }

          case 'scripting.removeCSS': {
            const details = args[0] ?? null;
            if (!details || typeof details !== 'object') {
              replyErr(new Error('Parâmetros inválidos para scripting.removeCSS'));
              return;
            }
            chrome.scripting.removeCSS(details, () => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em scripting.removeCSS')));
                return;
              }
              replyOk({ ok: true });
            });
            return;
          }

          case 'interceptor.register': {
            const config = args[0] ?? {};
            Promise.resolve()
              .then(() => registerBridgeInterceptor(config))
              .then(replyOk)
              .catch(replyErr);
            return;
          }

          case 'interceptor.unregister': {
            const tabId = Number(args[0]);
            const interceptorId = String(args[1] || '').trim();
            Promise.resolve()
              .then(() => unregisterBridgeInterceptor(tabId, interceptorId))
              .then(replyOk)
              .catch(replyErr);
            return;
          }

          case 'interceptor.list': {
            const tabId = Number(args[0]);
            Promise.resolve()
              .then(() => listBridgeInterceptors(tabId))
              .then((items) => replyOk({ ok: true, items }))
              .catch(replyErr);
            return;
          }

          case 'interceptor.clear': {
            const tabId = Number(args[0]);
            Promise.resolve()
              .then(() => clearBridgeInterceptors(tabId))
              .then(replyOk)
              .catch(replyErr);
            return;
          }

          case 'lovable.toggleChat': {
            const tabId = Number(args[0]);
            if (!Number.isFinite(tabId) || tabId <= 0) {
              replyErr(new Error('tabId inválido para lovable.toggleChat'));
              return;
            }

            chrome.scripting.executeScript({
              target: { tabId },
              func: () => {
                const sidebarBtn = document.querySelector('button[aria-label="Close sidebar"]') ||
                  document.querySelector('button[aria-label="Open sidebar"]');
                if (sidebarBtn) {
                  sidebarBtn.click();
                  return true;
                }

                const chat = document.querySelector('aside') || document.querySelector('[role="complementary"]');
                if (chat) {
                  chat.style.display = chat.style.display === 'none' ? '' : 'none';
                  return true;
                }
                return false;
              },
            }, (results) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em lovable.toggleChat')));
                return;
              }
              replyOk({ ok: true, results: results || [] });
            });
            return;
          }

          case 'lovable.fetchQuickSuggestions': {
            const tabId = Number(args[0]);
            if (!Number.isFinite(tabId) || tabId <= 0) {
              replyErr(new Error('tabId inválido para lovable.fetchQuickSuggestions'));
              return;
            }

            chrome.scripting.executeScript({
              target: { tabId },
              func: () => {
                const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
                const blockedPattern = /^(ask lovable\.{0,3}|visual edits|enviar|send|stop|parar|abrir|fechar)$/i;

                const selectors = [
                  '[aria-haspopup="dialog"] [data-horizontal-scroll="true"] button',
                  '[data-horizontal-scroll="true"] button',
                ];

                const collected = [];
                selectors.forEach((selector) => {
                  document.querySelectorAll(selector).forEach((btn) => {
                    const text = normalize(btn.textContent);
                    if (!text) return;
                    if (blockedPattern.test(text)) return;
                    if (text.length < 4 || text.length > 140) return;
                    collected.push(text);
                  });
                });

                const unique = Array.from(new Set(collected));
                return unique.slice(0, 8);
              },
            }, (results) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em lovable.fetchQuickSuggestions')));
                return;
              }
              const payload = Array.isArray(results?.[0]?.result) ? results[0].result : [];
              replyOk(payload);
            });
            return;
          }

          case 'lovable.fetchHistory': {
            const tabId = Number(args[0]);
            if (!Number.isFinite(tabId) || tabId <= 0) {
              replyErr(new Error('tabId inválido para lovable.fetchHistory'));
              return;
            }

            chrome.scripting.executeScript({
              target: { tabId },
              func: () => {
                const normalize = (value) => String(value || '')
                  .replace(/\u200B/g, '')
                  .replace(/\r/g, '')
                  .replace(/[ \t]+\n/g, '\n')
                  .replace(/\n{3,}/g, '\n\n')
                  .replace(/[ \t]{2,}/g, ' ')
                  .trim();

                const nodes = Array.from(document.querySelectorAll('[data-message-id]'));
                const seen = new Set();
                const output = [];

                for (const node of nodes) {
                  const id = String(node.getAttribute('data-message-id') || '').trim();
                  if (!id || seen.has(id)) continue;
                  seen.add(id);

                  const role = id.startsWith('umsg_')
                    ? 'user'
                    : (id.startsWith('aimsg_') ? 'assistant' : 'unknown');

                  const proseTexts = Array.from(node.querySelectorAll('.prose'))
                    .map((el) => normalize(el.innerText))
                    .filter(Boolean);

                  let text = proseTexts.join('\n\n');
                  if (!text) {
                    text = normalize(node.innerText);
                  }

                  if (!text) continue;
                  output.push({ id, role, text });
                }

                return output.slice(-120);
              },
            }, (results) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError) {
                replyErr(new Error(String(runtimeError.message || 'Falha em lovable.fetchHistory')));
                return;
              }
              const payload = Array.isArray(results?.[0]?.result) ? results[0].result : [];
              replyOk(payload);
            });
            return;
          }

          default:
            replyErr(new Error(`Comando não suportado no bridge: ${command}`));
            return;
        }
      } catch (error) {
        replyErr(toSerializableError(error));
      }
    });

    if (!remoteBridgeHostEvents.bound) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        const safeChanges = {};
        const raw = changes && typeof changes === 'object' ? changes : {};
        Object.keys(raw).forEach((key) => {
          const item = raw[key] || {};
          safeChanges[key] = {
            oldValue: item.oldValue,
            newValue: item.newValue,
          };
        });

        postBridgeEvent('storage.onChanged', {
          changes: safeChanges,
          areaName: String(areaName || 'local'),
        });
      });

      chrome.tabs.onActivated.addListener((activeInfo) => {
        postBridgeEvent('tabs.onActivated', {
          activeInfo: activeInfo || null,
        });
      });

      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        postBridgeEvent('tabs.onUpdated', {
          tabId: Number(tabId || 0),
          changeInfo: changeInfo || {},
          tab: tab || null,
        });
      });

      chrome.runtime.onMessage.addListener((message, sender) => {
        const safeSender = sanitizeSenderForBridge(sender);

        if (message?.action === 'sdkInterceptorEventRelay' || message?.action === 'sdkInterceptorEvent') {
          const eventPayload = message?.payload && typeof message.payload === 'object'
            ? message.payload
            : {};
          postBridgeEvent('interceptor.onEvent', {
            ...eventPayload,
            sender: safeSender,
          });
          return;
        }

        postBridgeEvent('runtime.onMessage', {
          message: message ?? null,
          sender: safeSender,
        });
      });

      remoteBridgeHostEvents.bound = true;
    }
  }

  function clampProgress(value) {
    const n = Number(value || 0);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function setProgress(value) {
    if (!loaderProgressEl) return;
    loaderProgressEl.style.width = `${clampProgress(value)}%`;
  }

  function setStatus(message) {
    if (loaderStatusEl) {
      loaderStatusEl.textContent = String(message || 'Carregando ambiente seguro...');
    }
  }

  function setDiagnostics(message) {
    if (diagnosticsEl) {
      diagnosticsEl.textContent = String(message || '');
    }
  }

  function ensureContextMenuToastHost() {
    let host = document.getElementById('contextMenuBlockToast');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'contextMenuBlockToast';
    host.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:18px',
      'transform:translateX(-50%) translateY(8px)',
      'z-index:2147483647',
      'padding:9px 12px',
      'border-radius:10px',
      'background:rgba(2,6,23,0.96)',
      'border:1px solid rgba(59,130,246,0.42)',
      'color:#dbeafe',
      'font:700 12px/1.4 system-ui,-apple-system,sans-serif',
      'box-shadow:0 12px 34px rgba(2,6,23,0.45)',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity .18s ease, transform .18s ease',
      'white-space:nowrap',
    ].join(';');
    document.body.appendChild(host);
    return host;
  }

  function showContextMenuBlockedToast() {
    const now = Date.now();
    if ((now - lastContextMenuToastAt) < CONTEXT_MENU_TOAST_COOLDOWN_MS) {
      return;
    }
    lastContextMenuToastAt = now;

    const host = ensureContextMenuToastHost();
    host.textContent = CONTEXT_MENU_BLOCK_MESSAGE;
    host.style.opacity = '1';
    host.style.transform = 'translateX(-50%) translateY(0)';

    if (contextMenuToastTimerId) {
      clearTimeout(contextMenuToastTimerId);
    }

    contextMenuToastTimerId = setTimeout(() => {
      host.style.opacity = '0';
      host.style.transform = 'translateX(-50%) translateY(8px)';
      contextMenuToastTimerId = null;
    }, 1500);
  }

  function installContextMenuProtection() {
    if (document.documentElement?.dataset.contextMenuProtectionInstalled === '1') {
      return;
    }

    if (document.documentElement) {
      document.documentElement.dataset.contextMenuProtectionInstalled = '1';
    }

    const blockContextMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      setDiagnostics('[Execution] Clique com botão direito bloqueado.');
      showContextMenuBlockedToast();
    };

    document.addEventListener('contextmenu', blockContextMenu, true);
    document.addEventListener('keydown', (event) => {
      const key = String(event.key || '');
      const isKeyboardContextMenu = key === 'ContextMenu' || (event.shiftKey && key === 'F10');
      if (!isKeyboardContextMenu) return;
      blockContextMenu(event);
    }, true);
  }

  function showErrorUI(message) {
    if (errorTextEl) {
      errorTextEl.textContent = String(
        message ||
        'Não foi possível inicializar os módulos de segurança. Verifique sua conexão ou contate o suporte.',
      );
    }

    if (errorBoxEl) {
      errorBoxEl.classList.add('active');
    }

    setProgress(100);
  }

  function hideErrorUI() {
    if (errorBoxEl) {
      errorBoxEl.classList.remove('active');
    }
  }

  function log(level, ...args) {
    const safeLevel = ['debug', 'info', 'warn', 'error'].includes(String(level)) ? level : 'info';
    const method = console[safeLevel] || console.log;
    method(...args);

    // Não expor detalhes técnicos de erro para o usuário final no painel.
    if (safeLevel === 'error') {
      setDiagnostics('[Handshake] Não foi possível inicializar os módulos de segurança.');
      return;
    }

    const firstText = args.find((value) => typeof value === 'string');
    if (firstText) {
      setDiagnostics(firstText);
    }
  }

  async function fetchBackgroundState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSecureRuntimeStatus' }, (response) => {
        const runtimeError = chrome.runtime?.lastError;
        if (runtimeError) {
          resolve(null);
          return;
        }
        resolve(response?.status || null);
      });
    });
  }

  async function initializeSidepanelRuntime(trigger = 'bootstrap') {
    stopDevRemoteHotReloadLoop();
    hideErrorUI();
    setProgress(8);
    setStatus('Carregando ambiente seguro...');
    setDiagnostics(`${TAG_HANDSHAKE} inicialização (${trigger}).`);

    try {
      const backgroundState = await fetchBackgroundState();
      if (backgroundState?.loading) {
        setStatus('Sincronizando com serviço de segurança...');
        setDiagnostics(`${TAG_HANDSHAKE} aguardando background finalizar handshake.`);
      }

      setProgress(18);
      setStatus('Consultando manifesto remoto...');

      const handshake = await globalThis.RuntimeSecureLoader.fetchAndValidateRuntime({
        manifestUrl: REMOTE_MANIFEST_URL,
        publicKeyPem: RUNTIME_PUBLIC_KEY_PEM,
        expectedBundleHost: REMOTE_BUNDLE_HOST,
        logger: (level, ...args) => {
          log(level, ...args);

          const joined = args.join(' ');
          if (joined.includes(TAG_HANDSHAKE)) {
            setStatus('Validando assinatura e integridade...');
            setProgress(50);
          }
        },
      });

      setProgress(68);
      setStatus('Processando módulos remotos com sandbox...');
      setDiagnostics(`${TAG_PARSING} preparando execução do bundle.`);

      await globalThis.RuntimeSecureLoader.executeBundle({
        bundleCode: handshake.bundleCode,
        contextName: 'sidepanel',
        entrypoint: 'sidepanel',
        logger: (level, ...args) => log(level, ...args),
        bridgeOptions: {
          chrome,
          document,
          remoteUiBaseUrl: REMOTE_UI_BASE_URL,
          notifications: chrome.notifications,
          logger: (level, ...args) => log(level, ...args),
          openExternalUrl: (url) => {
            window.open(String(url || SUPPORT_WHATSAPP_URL), '_blank', 'noopener,noreferrer');
          },
        },
      });

      setProgress(100);
      setStatus('Ambiente seguro inicializado com sucesso.');
      setDiagnostics(`${TAG_EXECUTION} runtime remoto ativo (versão ${handshake.manifest.version}).`);

      if (runtimeRootEl && !runtimeRootEl.innerHTML.trim()) {
        runtimeRootEl.textContent = 'Runtime remoto inicializado.';
      }

      if (runtimeRootEl) {
        const remoteUiUrl = buildRemoteUiUrl('sidepanel.html', {
          parentOrigin: window.location.origin,
          extVersion: chrome.runtime.getManifest().version,
        });
        runtimeRootEl.innerHTML = `
          <iframe
            id="remoteUiFrame"
            src="${remoteUiUrl}"
            title="Infinity Remote UI"
            allow="microphone; camera; clipboard-read; clipboard-write"
            style="width:100%;height:100%;max-height:100vh;border:1px solid rgba(59,130,246,0.24);border-radius:12px;background:#020617;display:block;"
          ></iframe>
        `;
        setupRemoteUiBridge();
        startDevRemoteHotReloadLoop();
        setDiagnostics(`${TAG_EXECUTION} runtime remoto ativo (versão ${handshake.manifest.version}) + UI remota carregada.`);
      }
    } catch (error) {
      log('error', TAG_HANDSHAKE, 'Falha crítica ao inicializar sidepanel:', error);
      setStatus('Falha ao inicializar ambiente seguro.');
      showErrorUI('Não foi possível inicializar os módulos de segurança. Verifique sua conexão ou contate o suporte.');
      setDiagnostics('[Handshake] Não foi possível inicializar os módulos de segurança.');
    }
  }

  if (retryBtnEl) {
    retryBtnEl.addEventListener('click', () => {
      void initializeSidepanelRuntime('retry-button');
    });
  }

  if (supportBtnEl) {
    supportBtnEl.addEventListener('click', () => {
      setDiagnostics(`${TAG_EXECUTION} abrindo suporte no WhatsApp.`);
    });
  }

  installContextMenuProtection();
  void initializeSidepanelRuntime('bootstrap');
})();
