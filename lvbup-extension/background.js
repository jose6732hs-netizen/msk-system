// Loader seguro de runtime remoto para Service Worker (MV3)
// Sem eval/new Function; execução via Acorn + JS-Interpreter.

importScripts('acorn.js', 'interpreter.js', 'runtime-loader.js');

const TAG_HANDSHAKE = '[Handshake]';
const TAG_EXECUTION = '[Execution]';

const REMOTE_MANIFEST_URL = 'https://msk-keymaster.lovable.app/ext/runtime/manifest';
const REMOTE_BUNDLE_HOST = 'msk-keymaster.lovable.app';
const RUNTIME_STORAGE_KEY = 'secureRuntimeBackgroundStatus';
const RUNTIME_LAST_CHECK_KEY = 'secureRuntimeBackgroundLastCheck';
const RUNTIME_CHECK_ALARM = 'secure-runtime-background-check';
const API_BASE_URL = 'https://msk-keymaster.lovable.app';
const API_VERSION_HEADER = '3.0';
const LOVABLE_REQUEST_META_KEY = 'lovableRequestMeta';
const GUARDIAN_STORAGE_KEY = 'guardianActiveTabs';
const APPROVE_GUARD_STORAGE_KEY = 'approveGuardTabs';
const VERSION_HEADER_RULE_ID = 3001;
const VERSION_HEADER_RULE_PRIORITY = 1;
const VERSION_HEADER_URL_FILTER = '||msk-keymaster.lovable.app/*';

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

const runtimeState = {
  initialized: false,
  loading: false,
  failed: false,
  message: 'Inicializando runtime remoto...',
  lastVersion: null,
  lastHash: null,
  lastLoadedAt: 0,
  lastCheckedAt: 0,
};

let runtimeExecutionPromise = null;
let guardianActiveTabs = {};
let approveGuardTabs = {};

chrome.storage.local.get([GUARDIAN_STORAGE_KEY], (result) => {
  const fromStorage = result?.[GUARDIAN_STORAGE_KEY];
  guardianActiveTabs = fromStorage && typeof fromStorage === 'object' ? fromStorage : {};
});

chrome.storage.local.get([APPROVE_GUARD_STORAGE_KEY], (result) => {
  const fromStorage = result?.[APPROVE_GUARD_STORAGE_KEY];
  approveGuardTabs = fromStorage && typeof fromStorage === 'object' ? fromStorage : {};
});

function persistApproveGuardState() {
  chrome.storage.local.set({ [APPROVE_GUARD_STORAGE_KEY]: approveGuardTabs });
}

function setApproveGuardState(tabId, isActive) {
  const key = String(tabId || '');
  if (!key) return;
  if (isActive) {
    approveGuardTabs[key] = true;
  } else {
    delete approveGuardTabs[key];
  }
  persistApproveGuardState();
}

function hasApproveGuardState(tabId) {
  return !!approveGuardTabs[String(tabId || '')];
}

function persistGuardianState() {
  chrome.storage.local.set({ [GUARDIAN_STORAGE_KEY]: guardianActiveTabs });
}

function setGuardianState(tabId, isActive) {
  const key = String(tabId || '');
  if (!key) return;
  if (isActive) {
    guardianActiveTabs[key] = true;
  } else {
    delete guardianActiveTabs[key];
  }
  persistGuardianState();
}

function hasGuardianState(tabId) {
  return !!guardianActiveTabs[String(tabId || '')];
}

function getStorageLocalAsync(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function isLovableUrl(url) {
  return /^https:\/\/([a-z0-9-]+\.)*lovable\.dev(\/|$)/i.test(String(url || ''));
}

function ensureApproveGuardOnOpenLovableTabs() {
  chrome.tabs.query({}, (tabs) => {
    const list = Array.isArray(tabs) ? tabs : [];
    list.forEach((tab) => {
      const tabId = Number(tab?.id || 0);
      if (!Number.isFinite(tabId) || tabId <= 0) return;
      if (!isLovableUrl(tab?.url || '')) return;
      activateApproveGuard(tabId).then((ok) => {
        setApproveGuardState(tabId, !!ok);
      });
    });
  });
}

function normalizeRequestHeaders(requestHeaders = []) {
  const headerMap = {};
  for (const header of requestHeaders) {
    const name = String(header?.name || '').trim().toLowerCase();
    if (!name) continue;
    headerMap[name] = String(header?.value || '').trim();
  }
  return headerMap;
}

function saveLovableRequestMeta(headerMap) {
  if (!headerMap || typeof headerMap !== 'object') return;

  const partialMeta = {
    xClientGitSha: headerMap['x-client-git-sha'] || undefined,
    xBrowserSessionId: headerMap['x-browser-session-id'] || undefined,
    userAgent: headerMap['user-agent'] || undefined,
    secChUa: headerMap['sec-ch-ua'] || undefined,
    secChUaMobile: headerMap['sec-ch-ua-mobile'] || undefined,
    secChUaPlatform: headerMap['sec-ch-ua-platform'] || undefined,
    referer: headerMap.referer || undefined,
    origin: headerMap.origin || undefined,
    acceptLanguage: headerMap['accept-language'] || undefined,
  };

  const hasAnyValue = Object.values(partialMeta).some((value) => !!value);
  if (!hasAnyValue) return;

  chrome.storage.local.get([LOVABLE_REQUEST_META_KEY], (result) => {
    const previousMeta = result?.[LOVABLE_REQUEST_META_KEY];
    const safePrevious = previousMeta && typeof previousMeta === 'object' ? previousMeta : {};
    const nextMeta = {
      ...safePrevious,
      ...Object.fromEntries(Object.entries(partialMeta).filter(([, value]) => !!value)),
      capturedAt: Date.now(),
    };
    chrome.storage.local.set({ [LOVABLE_REQUEST_META_KEY]: nextMeta });
  });
}

function isLicenseKeyFormatValid(value) {
  return /^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(String(value || '').trim().toUpperCase());
}

async function sendQuickPromptViaApi({ projectId, promptText, files = [], plan = false }) {
  const safePrompt = String(promptText || '').trim();
  const safeFiles = Array.isArray(files)
    ? files.filter((item) => item && typeof item === 'object' && item.data)
    : [];
  const safePlan = !!plan;

  if (!safePrompt && safeFiles.length <= 0) {
    return { success: false, detail: 'Mensagem e anexos vazios.' };
  }

  const safeProjectId = String(projectId || '').trim();
  const storage = await getStorageLocalAsync(['licenseKey', 'authToken', 'lovable_token', 'deviceId', 'projectId']);
  const licenseKey = String(storage?.licenseKey || '').trim().toUpperCase();
  const authToken = String(storage?.authToken || storage?.lovable_token || '').trim();
  const deviceId = String(storage?.deviceId || '').trim() || null;
  const fallbackProjectId = String(storage?.projectId || '').trim();
  const resolvedProjectId = safeProjectId || fallbackProjectId;

  if (!resolvedProjectId) {
    return { success: false, detail: 'Project ID ausente para enviar prompt rápido.' };
  }

  if (!isLicenseKeyFormatValid(licenseKey)) {
    return { success: false, detail: 'Licença inválida para enviar prompt rápido.' };
  }

  if (!authToken || authToken.length < 20) {
    return { success: false, detail: 'Auth token ausente para enviar prompt rápido.' };
  }

  try {
    const controller = new AbortController();
    const timeoutMs = safeFiles.length > 0 ? 90000 : 25000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${API_BASE_URL}/send-msg/${resolvedProjectId}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-extension-version': API_VERSION_HEADER,
      },
      body: JSON.stringify({
        message: safePrompt || 'Analise os anexos enviados.',
        licenseKey,
        authToken,
        files: safeFiles,
        deviceId,
        plan: safePlan,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        detail: data?.detail || 'Falha ao enviar prompt rápido via API local.',
      };
    }

    return {
      success: true,
      detail: safeFiles.length > 0
        ? 'Mensagem com anexos enviada via Infinity Credits.'
        : 'Prompt rápido enviado via Infinity Credits.',
      payload: data,
    };
  } catch (error) {
    return {
      success: false,
      detail: error?.name === 'AbortError'
        ? 'Tempo limite ao enviar prompt rápido.'
        : 'Erro de conexão ao enviar prompt rápido.',
    };
  }
}

async function executeScriptSafe(tabId, func) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func,
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function activateGuardian(tabId) {
  return executeScriptSafe(tabId, () => {
    const RUNTIME_KEY = '__infinityGuardianController';
    const OVERLAY_ID = 'infinity-guardiao-overlay';

    const resolveAskArea = () => {
      const exactForm = document.querySelector('form#chat-input');
      if (exactForm) return exactForm;
      const partialForm = document.querySelector('form[id*="chat-input"]');
      if (partialForm) return partialForm;
      const editable = document.querySelector('[contenteditable="true"][aria-label="Chat input"]');
      if (editable) return editable.closest('form') || editable.parentElement;
      return document.querySelector('footer');
    };

    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 20 && rect.height > 20;
    };

    const isSidebarOpen = () => {
      const closeBtn = document.querySelector('button[aria-label*="close sidebar" i], button[aria-label*="fechar" i]');
      if (closeBtn && isVisible(closeBtn)) return true;

      const openBtn = document.querySelector('button[aria-label*="open sidebar" i], button[aria-label*="abrir" i]');
      if (openBtn && isVisible(openBtn)) return false;

      const askArea = resolveAskArea();
      return !!(askArea && isVisible(askArea));
    };

    const removeOverlay = () => {
      const existing = document.getElementById(OVERLAY_ID);
      if (existing) existing.remove();
    };

    const ensureOverlay = () => {
      let overlay = document.getElementById(OVERLAY_ID);
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = [
          'position:fixed',
          'background:rgba(59,130,246,0.08)',
          'z-index:2147483646',
          'cursor:not-allowed',
          'pointer-events:all',
          'display:flex',
          'align-items:center',
          'justify-content:center',
          'border-radius:10px',
          'backdrop-filter:saturate(140%)',
        ].join(';');
        overlay.innerHTML = '<span style="background:rgba(30,64,175,.92);color:#fff;padding:5px 14px;border-radius:8px;font-size:12px;font-weight:700;font-family:system-ui,sans-serif;pointer-events:none;white-space:nowrap">🔒 Infinity Credits - Guardião Ativo</span>';
        document.body.appendChild(overlay);
      }
      return overlay;
    };

    const existingController = window[RUNTIME_KEY];
    if (existingController?.cleanup) {
      existingController.cleanup();
    }

    const controller = {
      active: true,
      intervalId: null,
      rafId: null,
      mutationObserver: null,
      onViewportChange: null,
      cleanup: null,
      scheduleUpdate: null,
      update: null,
    };

    controller.update = () => {
      if (!controller.active) return;

      const sidebarOpen = isSidebarOpen();
      const askArea = resolveAskArea();

      if (!sidebarOpen || !askArea || !isVisible(askArea)) {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) overlay.style.display = 'none';
        return;
      }

      const rect = askArea.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) overlay.style.display = 'none';
        return;
      }

      const overlay = ensureOverlay();
      overlay.style.display = 'flex';
      overlay.style.top = `${Math.max(0, rect.top)}px`;
      overlay.style.left = `${Math.max(0, rect.left)}px`;
      overlay.style.width = `${Math.max(0, rect.width)}px`;
      overlay.style.height = `${Math.max(0, rect.height)}px`;
    };

    controller.scheduleUpdate = () => {
      if (!controller.active) return;
      if (controller.rafId) {
        cancelAnimationFrame(controller.rafId);
      }
      controller.rafId = requestAnimationFrame(controller.update);
    };

    controller.onViewportChange = () => {
      controller.scheduleUpdate();
    };

    controller.mutationObserver = new MutationObserver(() => controller.scheduleUpdate());
    const root = document.documentElement || document.body;
    if (root) {
      controller.mutationObserver.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'data-state', 'aria-expanded'],
      });
    }

    window.addEventListener('resize', controller.onViewportChange, true);
    window.addEventListener('scroll', controller.onViewportChange, true);
    controller.intervalId = window.setInterval(() => controller.update(), 700);

    controller.cleanup = () => {
      controller.active = false;
      if (controller.intervalId) clearInterval(controller.intervalId);
      if (controller.rafId) cancelAnimationFrame(controller.rafId);
      if (controller.mutationObserver) controller.mutationObserver.disconnect();
      window.removeEventListener('resize', controller.onViewportChange, true);
      window.removeEventListener('scroll', controller.onViewportChange, true);
      removeOverlay();
    };

    window[RUNTIME_KEY] = controller;
    controller.update();
  });
}

async function deactivateGuardian(tabId) {
  return executeScriptSafe(tabId, () => {
    const controller = window.__infinityGuardianController;
    if (controller?.cleanup) {
      controller.cleanup();
    } else {
      if (controller?.intervalId) clearInterval(controller.intervalId);
      if (controller?.rafId) cancelAnimationFrame(controller.rafId);
      if (controller?.mutationObserver) controller.mutationObserver.disconnect();
      const overlay = document.getElementById('infinity-guardiao-overlay');
      if (overlay) overlay.remove();
    }
    window.__infinityGuardianController = null;
  });
}

async function detectGuardianRuntime(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const ctrl = window.__infinityGuardianController;
        const overlay = document.getElementById('infinity-guardiao-overlay');
        return !!(ctrl?.active || overlay);
      },
    });
    return !!results?.[0]?.result;
  } catch (_) {
    return false;
  }
}

async function activateApproveGuard(tabId) {
  return executeScriptSafe(tabId, () => {
    const RUNTIME_KEY = '__infinityApproveGuardControllerV2';
    const LEGACY_RUNTIME_KEYS = ['__infinityApproveGuardController'];
    const TOAST_ID = '__infinityApproveGuardToast';
    const CONTROLLER_TOKEN_ATTR = 'data-infinity-approve-guard-token';
    const MAX_ATTACHMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024;
    const controllerToken = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const tokenRoot = document.documentElement || document.body;
    if (tokenRoot) {
      tokenRoot.setAttribute(CONTROLLER_TOKEN_ATTR, controllerToken);
    }

    LEGACY_RUNTIME_KEYS.forEach((key) => {
      const legacy = window[key];
      if (legacy?.cleanup) {
        legacy.cleanup();
      }
      try {
        delete window[key];
      } catch (_) {
      }
    });

    const existing = window[RUNTIME_KEY];
    if (existing?.cleanup) {
      existing.cleanup();
    }

    const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const formatFileSizeLabel = (sizeBytes) => {
      const mbValue = Math.max(0, Number(sizeBytes || 0)) / (1024 * 1024);
      const rounded = mbValue >= 10 ? Math.round(mbValue) : Math.round(mbValue * 10) / 10;
      return `${String(rounded).replace(/\.0$/, '')} MB`;
    };
    const getElementText = (element) => String(
      element?.getAttribute?.('aria-label')
      || element?.getAttribute?.('title')
      || element?.textContent
      || ''
    ).replace(/\s+/g, ' ').trim();

    const getEventElementTarget = (event) => {
      const directTarget = event?.target || null;
      if (directTarget && typeof directTarget.closest === 'function') {
        return directTarget;
      }

      const firstPathNode = Array.isArray(event?.composedPath?.()) ? event.composedPath()[0] : null;
      if (firstPathNode && typeof firstPathNode.closest === 'function') {
        return firstPathNode;
      }

      if (firstPathNode?.parentElement && typeof firstPathNode.parentElement.closest === 'function') {
        return firstPathNode.parentElement;
      }

      if (directTarget?.parentElement && typeof directTarget.parentElement.closest === 'function') {
        return directTarget.parentElement;
      }

      return null;
    };

    const isInsideChatInputArea = (element) => {
      if (!element) return false;
      return !!element.closest?.(
        '[contenteditable="true"][aria-label="Chat input"], [contenteditable="true"], #chatinput, form#chat-input, form[id*="chat-input"]'
      );
    };

    const isPlanApprovalControl = (element) => {
      if (!element) return false;
      const button = element.closest?.('button,[role="button"],a[role="button"]') || element;
      const text = normalizeText(getElementText(button));
      if (!['approve', 'aprovar', 'review', 'revisar', 'skip', 'pular'].includes(text)) return false;

      const planFooter = button.closest?.('.border-muted-border.bg-muted, [class*="border-muted-border"][class*="bg-muted"]');
      if (planFooter) return true;

      const parentText = normalizeText(button.parentElement?.textContent || '');
      return parentText.includes('review') && parentText.includes('skip') && parentText.includes('approve');
    };

    const isNativeSendButton = (element) => {
      if (!element) return false;
      if (element.id === 'chatinput-send-message-button') return true;

      const owner = element.closest?.('#chatinput-send-message-button');
      if (owner?.id === 'chatinput-send-message-button') return true;

      const aria = normalizeText(element.getAttribute?.('aria-label') || '');
      if (aria.includes('send message') || aria.includes('enviar mensagem') || aria === 'send' || aria === 'enviar') {
        return isInsideChatInputArea(element);
      }

      return false;
    };

    const extractProjectIdFromLocation = () => {
      const path = String(window.location?.pathname || '');
      const match = path.match(/\/projects\/([a-z0-9-]+)/i);
      return match?.[1] ? String(match[1]).trim() : '';
    };

    const isLovableDashboardPage = () => {
      const origin = String(window.location?.origin || '').toLowerCase();
      const path = String(window.location?.pathname || '');
      return origin === 'https://lovable.dev' && (path === '/dashboard' || path.startsWith('/dashboard/'));
    };

    const getPromptText = () => {
      const editor = document.querySelector('[contenteditable="true"][aria-label="Chat input"]');
      if (!editor) return '';
      return String(editor.textContent || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    };

    const resolveChatForm = () => document.querySelector('form#chat-input, form[id*="chat-input"]');

    const fileToDataUrl = (file) => new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('file_reader_failed'));
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error);
      }
    });

    const collectComposerAttachments = async () => {
      const form = resolveChatForm();
      if (!form) {
        return {
          files: [],
          hasAttachmentIndicators: false,
          oversizedFiles: [],
        };
      }

      const hasAttachmentIndicators = !!form.querySelector(
        'img[src^="blob:"], img[src^="data:image/"], [data-testid*="attachment" i], [aria-label*="anexo" i], [aria-label*="attachment" i]'
      );

      const inputNodes = Array.from(form.querySelectorAll('input[type="file"]'));
      const rawFiles = [];
      inputNodes.forEach((input) => {
        const list = input?.files;
        if (!list || !list.length) return;
        for (let i = 0; i < list.length; i += 1) {
          const file = list.item(i);
          if (file) rawFiles.push(file);
        }
      });

      if (!rawFiles.length) {
        return {
          files: [],
          hasAttachmentIndicators,
        };
      }

      const dedup = new Set();
      const filesPayload = [];
      const oversizedFiles = [];
      for (const file of rawFiles) {
        const key = `${String(file.name || '')}::${Number(file.size || 0)}::${Number(file.lastModified || 0)}::${String(file.type || '')}`;
        if (dedup.has(key)) continue;
        dedup.add(key);

        const fileSize = Math.max(0, Number(file.size || 0));
        if (fileSize > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
          oversizedFiles.push({
            name: String(file.name || 'upload.bin'),
            size: fileSize,
          });
          continue;
        }

        try {
          const data = await fileToDataUrl(file);
          if (!data) continue;
          filesPayload.push({
            name: String(file.name || `upload-${Date.now()}.bin`),
            type: String(file.type || 'application/octet-stream'),
            data,
          });
        } catch (_) {
          // Ignora arquivo com falha de leitura e segue os demais.
        }
      }

      return {
        files: filesPayload,
        hasAttachmentIndicators,
        oversizedFiles,
      };
    };

    const isPlanModeEnabled = () => {
      const toggleBtn = document.querySelector(
        'button[aria-label="Toggle chat mode"][aria-pressed="true"], button[aria-label*="toggle chat mode" i][aria-pressed="true"]'
      );
      return !!toggleBtn;
    };

    const clearPromptEditor = () => {
      try {
        const editor = document.querySelector('[contenteditable="true"][aria-label="Chat input"]');
        if (!editor) return;
        editor.innerHTML = '<p><br class="ProseMirror-trailingBreak"></p>';
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
      } catch (_) {
      }
    };

    const removeToast = () => {
      const toast = document.getElementById(TOAST_ID);
      if (toast) toast.remove();
    };

    const showToast = (message, color = '#2563eb') => {
      removeToast();
      const toast = document.createElement('div');
      toast.id = TOAST_ID;
      toast.style.cssText = [
        'position:fixed',
        'top:16px',
        'right:16px',
        'z-index:2147483647',
        'padding:9px 12px',
        'border-radius:10px',
        'background:rgba(2,6,23,0.94)',
        `border:1px solid ${color}`,
        'color:#e2e8f0',
        'font:600 12px/1.4 system-ui,-apple-system,sans-serif',
      ].join(';');
      toast.textContent = String(message || 'Ação interceptada.');
      document.body.appendChild(toast);
      window.setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-4px)';
        window.setTimeout(() => toast.remove(), 220);
      }, 2200);
    };

    const isCurrentController = () => {
      const root = document.documentElement || document.body;
      if (!root) return true;
      return String(root.getAttribute(CONTROLLER_TOKEN_ATTR) || '') === controllerToken;
    };

    const isRetryableRuntimeError = (message) => {
      const text = String(message || '').toLowerCase();
      return (
        text.includes('receiving end does not exist')
        || text.includes('could not establish connection')
        || text.includes('extension context invalidated')
        || text.includes('the message port closed before a response was received')
      );
    };

    const findNativeSendButton = () => (
      document.getElementById('chatinput-send-message-button')
      || document.querySelector('button[aria-label*="send message" i], button[aria-label*="enviar" i]')
    );

    const sendMessageWithTimeout = (payload, timeoutMs = 18000) => new Promise((resolve) => {
      let settled = false;
      let attempts = 0;
      const maxAttempts = 2;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(value);
      };

      const timeoutId = window.setTimeout(() => {
        finish({ __timeout: true });
      }, Math.max(1200, Number(timeoutMs) || 18000));

      const runAttempt = () => {
        attempts += 1;

        try {
          const canSend = !!(window.chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function');
          if (!canSend) {
            finish({ __runtimeError: 'Runtime da extensão indisponível nesta aba.' });
            return;
          }

          chrome.runtime.sendMessage(payload, (response) => {
            const runtimeError = chrome.runtime?.lastError;
            if (runtimeError) {
              const message = String(runtimeError.message || 'Falha ao comunicar com o background.');
              if (attempts < maxAttempts && isRetryableRuntimeError(message)) {
                window.setTimeout(runAttempt, 300);
                return;
              }
              finish({ __runtimeError: message });
              return;
            }
            finish(response || { success: false, detail: 'Resposta vazia do background.' });
          });
        } catch (error) {
          const message = String(error?.message || error || 'Falha ao comunicar com o background.');
          if (attempts < maxAttempts && isRetryableRuntimeError(message)) {
            window.setTimeout(runAttempt, 300);
            return;
          }
          finish({ __runtimeError: message });
        }
      };

      runAttempt();
    });

    const controller = {
      inFlight: false,
      skipInterceptionUntil: 0,
      onClick: null,
      onKeydown: null,
      onSubmit: null,
      cleanup: null,
    };

    const runNativeFallback = () => {
      controller.skipInterceptionUntil = Date.now() + 1500;

      window.setTimeout(() => {
        try {
          const nativeSendBtn = findNativeSendButton();
          if (nativeSendBtn && typeof nativeSendBtn.click === 'function') {
            nativeSendBtn.click();
            return;
          }

          const chatForm = document.querySelector('form#chat-input, form[id*="chat-input"]');
          if (chatForm && typeof chatForm.requestSubmit === 'function') {
            chatForm.requestSubmit();
          }
        } catch (_) {
          // sem ação
        }
      }, 40);
    };

    const runInterceptedAction = async ({ kind } = {}) => {
      if (!isCurrentController()) return;

      const isNativeSend = kind === 'native-send';
      if (!isNativeSend) return;
      if (controller.inFlight) return;
      if (isLovableDashboardPage()) return;

      const projectId = extractProjectIdFromLocation();
      if (!projectId) {
        showToast('Project ID não encontrado nesta página.', '#ef4444');
        return;
      }

      const promptText = getPromptText();
      const planModeEnabled = isPlanModeEnabled();
      const attachmentSnapshot = await collectComposerAttachments();
      const preparedFiles = Array.isArray(attachmentSnapshot?.files) ? attachmentSnapshot.files : [];
      const oversizedFiles = Array.isArray(attachmentSnapshot?.oversizedFiles) ? attachmentSnapshot.oversizedFiles : [];
      const hasAttachmentIndicators = !!attachmentSnapshot?.hasAttachmentIndicators;

      if (oversizedFiles.length > 0) {
        const firstOversized = oversizedFiles[0] || {};
        showToast(
          `Arquivo "${String(firstOversized.name || 'sem-nome')}" excede ${formatFileSizeLabel(MAX_ATTACHMENT_FILE_SIZE_BYTES)}.`,
          '#ef4444',
        );
        return;
      }

      if (hasAttachmentIndicators && preparedFiles.length === 0) {
        showToast('Anexo detectado no chat. Usando envio nativo para preservar arquivo.', '#f59e0b');
        runNativeFallback();
        return;
      }

      if (!promptText) {
        showToast('Chat input vazio.', '#f59e0b');
        return;
      }

      const payload = {
        action: 'sendQuickPromptViaApi',
        projectId,
        promptText,
        files: preparedFiles,
        plan: planModeEnabled,
      };

      controller.inFlight = true;
      showToast('Interceptando envio via Infinity...', '#2563eb');

      try {
        const response = await sendMessageWithTimeout(payload, 18000);

        if (response?.__timeout) {
          showToast('Reconectando extensão... liberando envio nativo.', '#f59e0b');
          runNativeFallback();
          return;
        }
        if (response?.__runtimeError) {
          showToast('Reconectando extensão... liberando envio nativo.', '#f59e0b');
          runNativeFallback();
          return;
        }
        if (!response?.success) {
          showToast(response?.detail || 'Ação interceptada falhou.', '#ef4444');
          return;
        }

        clearPromptEditor();

        showToast('Mensagem enviada pela Infinity Credits.', '#10b981');
      } finally {
        controller.inFlight = false;
      }
    };

    controller.onClick = (event) => {
      if (Date.now() < Number(controller.skipInterceptionUntil || 0)) return;
      if (!isCurrentController()) {
        if (controller?.cleanup) controller.cleanup();
        return;
      }

      const baseTarget = getEventElementTarget(event);
      const target = baseTarget?.closest?.('button,[role="button"],a[role="button"]');
      if (!target) return;

      if (isPlanApprovalControl(target)) {
        return;
      }

      const isNativeSend = isNativeSendButton(target);
      if (!isNativeSend) return;
      if (isLovableDashboardPage()) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      void runInterceptedAction({ kind: 'native-send' });
    };

    controller.onKeydown = (event) => {
      if (Date.now() < Number(controller.skipInterceptionUntil || 0)) return;
      if (!isCurrentController()) {
        if (controller?.cleanup) controller.cleanup();
        return;
      }

      if (String(event?.key || '').toLowerCase() !== 'enter') return;
      if (event.isComposing) return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

      const targetEl = getEventElementTarget(event);
      if (!isInsideChatInputArea(targetEl)) return;
      if (isLovableDashboardPage()) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      void runInterceptedAction({ kind: 'native-send' });
    };

    controller.onSubmit = (event) => {
      if (Date.now() < Number(controller.skipInterceptionUntil || 0)) return;
      if (!isCurrentController()) {
        if (controller?.cleanup) controller.cleanup();
        return;
      }

      const formEl = getEventElementTarget(event)?.closest?.('form');
      if (!formEl) return;
      const isChatForm = !!formEl.matches?.('form#chat-input, form[id*="chat-input"]');
      if (!isChatForm) return;
      if (isLovableDashboardPage()) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      void runInterceptedAction({ kind: 'native-send' });
    };

    window.addEventListener('click', controller.onClick, true);
    window.addEventListener('keydown', controller.onKeydown, true);
    window.addEventListener('submit', controller.onSubmit, true);

    controller.cleanup = () => {
      window.removeEventListener('click', controller.onClick, true);
      window.removeEventListener('keydown', controller.onKeydown, true);
      window.removeEventListener('submit', controller.onSubmit, true);
      removeToast();

      const root = document.documentElement || document.body;
      if (root && String(root.getAttribute(CONTROLLER_TOKEN_ATTR) || '') === controllerToken) {
        root.removeAttribute(CONTROLLER_TOKEN_ATTR);
      }
    };

    window[RUNTIME_KEY] = controller;
  });
}

async function getGuardianStateResponse(tabId) {
  if (!tabId) return { status: 'inactive' };

  if (hasGuardianState(tabId)) {
    const runtimeActive = await detectGuardianRuntime(tabId);
    if (runtimeActive) {
      return { status: 'active' };
    }

    const restored = await activateGuardian(tabId);
    if (restored) {
      return { status: 'active' };
    }

    setGuardianState(tabId, false);
    return { status: 'inactive' };
  }

  const runtimeActive = await detectGuardianRuntime(tabId);
  if (runtimeActive) {
    setGuardianState(tabId, true);
    return { status: 'active' };
  }

  return { status: 'inactive' };
}

async function toggleGuardianResponse(tabId) {
  if (!tabId) {
    return { status: 'inactive' };
  }

  const currentState = hasGuardianState(tabId) || (await detectGuardianRuntime(tabId));
  if (currentState) {
    await deactivateGuardian(tabId);
    setGuardianState(tabId, false);
    return { status: 'inactive' };
  }

  const ok = await activateGuardian(tabId);
  if (ok) {
    setGuardianState(tabId, true);
    return { status: 'active' };
  }

  return { status: 'inactive', error: 'inject_failed' };
}

async function ensureApproveGuardResponse(tabId) {
  if (!tabId) {
    return { status: 'inactive', error: 'tab_id_invalid' };
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isLovableUrl(tab?.url || '')) {
      setApproveGuardState(tabId, false);
      return { status: 'inactive', error: 'not_lovable_tab' };
    }

    const ok = await activateApproveGuard(tabId);
    setApproveGuardState(tabId, !!ok);
    return ok ? { status: 'active' } : { status: 'inactive', error: 'inject_failed' };
  } catch (_) {
    setApproveGuardState(tabId, false);
    return { status: 'inactive', error: 'inject_failed' };
  }
}

function log(level, ...args) {
  const safeLevel = ['debug', 'info', 'warn', 'error'].includes(String(level)) ? level : 'info';
  const method = console[safeLevel] || console.log;
  method(...args);
}

async function persistRuntimeState() {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [RUNTIME_STORAGE_KEY]: {
        initialized: runtimeState.initialized,
        failed: runtimeState.failed,
        loading: runtimeState.loading,
        message: runtimeState.message,
        lastVersion: runtimeState.lastVersion,
        lastHash: runtimeState.lastHash,
        lastLoadedAt: runtimeState.lastLoadedAt,
      },
      [RUNTIME_LAST_CHECK_KEY]: runtimeState.lastCheckedAt,
    }, resolve);
  });
}

async function setRuntimeState(partial) {
  Object.assign(runtimeState, partial || {});
  await persistRuntimeState();
}

async function runRemoteBackgroundRuntime(trigger = 'startup') {
  if (runtimeExecutionPromise) {
    log('info', TAG_EXECUTION, 'Execução já em andamento. Aguardando conclusão do ciclo atual. Trigger:', trigger);
    return runtimeExecutionPromise;
  }

  runtimeExecutionPromise = (async () => {
    await setRuntimeState({
      loading: true,
      failed: false,
      initialized: false,
      message: 'Carregando ambiente seguro de background...',
      lastCheckedAt: Date.now(),
    });

    try {
      const handshake = await globalThis.RuntimeSecureLoader.fetchAndValidateRuntime({
        manifestUrl: REMOTE_MANIFEST_URL,
        publicKeyPem: RUNTIME_PUBLIC_KEY_PEM,
        expectedBundleHost: REMOTE_BUNDLE_HOST,
        logger: (level, ...args) => log(level, ...args),
      });

      await globalThis.RuntimeSecureLoader.executeBundle({
        bundleCode: handshake.bundleCode,
        contextName: 'background',
        entrypoint: 'background',
        logger: (level, ...args) => log(level, ...args),
        bridgeOptions: {
          chrome,
          notifications: chrome.notifications,
          logger: (level, ...args) => log(level, ...args),
        },
      });

      await setRuntimeState({
        loading: false,
        failed: false,
        initialized: true,
        message: 'Runtime remoto de background carregado com sucesso.',
        lastVersion: handshake.manifest.version,
        lastHash: handshake.downloadedHash || null,
        lastLoadedAt: Date.now(),
      });
    } catch (error) {
      log('error', TAG_HANDSHAKE, 'Falha crítica no runtime remoto (background):', error);

      await setRuntimeState({
        loading: false,
        failed: true,
        initialized: false,
        message: 'Não foi possível inicializar os módulos de segurança. Verifique sua conexão ou contate o suporte.',
      });

      try {
        chrome.notifications.create('', {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Infinity Credits - Falha de inicialização',
          message: 'Não foi possível inicializar os módulos de segurança. Verifique sua conexão ou contate o suporte.',
        });
      } catch (_) {
        // Sem ação.
      }
    }

    return true;
  })();

  try {
    return await runtimeExecutionPromise;
  } finally {
    runtimeExecutionPromise = null;
  }
}

async function scheduleVersionAlarm() {
  try {
    await chrome.alarms.clear(RUNTIME_CHECK_ALARM);
    chrome.alarms.create(RUNTIME_CHECK_ALARM, {
      periodInMinutes: 5,
    });
  } catch (error) {
    log('warn', TAG_HANDSHAKE, 'Falha ao configurar alarmes de atualização:', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

  void scheduleVersionAlarm();
  ensureApproveGuardOnOpenLovableTabs();
  void runRemoteBackgroundRuntime('onInstalled');
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

  void scheduleVersionAlarm();
  ensureApproveGuardOnOpenLovableTabs();
  void runRemoteBackgroundRuntime('onStartup');
});

async function ensureVersionHeaderRule() {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) return;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [VERSION_HEADER_RULE_ID],
      addRules: [
        {
          id: VERSION_HEADER_RULE_ID,
          priority: VERSION_HEADER_RULE_PRIORITY,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              {
                header: 'x-extension-version',
                operation: 'set',
                value: API_VERSION_HEADER,
              },
            ],
          },
          condition: {
            urlFilter: VERSION_HEADER_URL_FILTER,
            resourceTypes: [
              'main_frame',
              'sub_frame',
              'xmlhttprequest',
              'script',
              'other',
            ],
          },
        },
      ],
    });
  } catch (error) {
    log('warn', TAG_HANDSHAKE, 'Falha ao forçar x-extension-version via DNR:', error);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name !== RUNTIME_CHECK_ALARM) return;
  void runRemoteBackgroundRuntime('alarm');
});

// Interceptor de token/auth e metadados de request da Lovable.
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.requestHeaders) {
      const headerMap = normalizeRequestHeaders(details.requestHeaders);
      saveLovableRequestMeta(headerMap);

      const authValue = headerMap.authorization;
      if (authValue) {
        const token = authValue.replace(/^Bearer\s+/i, '').trim();
        if (token.length > 20) {
          chrome.storage.local.set({ authToken: token, lovable_token: token });
        }
      }
    }

    const urlMatch = String(details.url || '').match(/projects\/([a-f0-9-]+)/i);
    if (urlMatch && urlMatch[1]) {
      chrome.storage.local.set({ projectId: urlMatch[1] });
    }
  },
  { urls: ['https://api.lovable.dev/*'] },
  ['requestHeaders'],
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  if (isLovableUrl(tab?.url || '')) {
    activateApproveGuard(tabId).then((ok) => {
      setApproveGuardState(tabId, !!ok);
    });
  } else if (hasApproveGuardState(tabId)) {
    setApproveGuardState(tabId, false);
  }

  if (!hasGuardianState(tabId)) return;

  if (!isLovableUrl(tab?.url || '')) {
    setGuardianState(tabId, false);
    return;
  }

  activateGuardian(tabId).then((ok) => {
    if (!ok) setGuardianState(tabId, false);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (hasApproveGuardState(tabId)) {
    setApproveGuardState(tabId, false);
  }

  if (hasGuardianState(tabId)) {
    setGuardianState(tabId, false);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    if (isLovableUrl(tab?.url || '')) {
      const approveOk = await activateApproveGuard(activeInfo.tabId);
      setApproveGuardState(activeInfo.tabId, !!approveOk);
    } else if (hasApproveGuardState(activeInfo.tabId)) {
      setApproveGuardState(activeInfo.tabId, false);
    }

    if (!hasGuardianState(activeInfo?.tabId)) return;
    if (!isLovableUrl(tab?.url || '')) {
      setGuardianState(activeInfo.tabId, false);
      return;
    }

    const ok = await activateGuardian(activeInfo.tabId);
    if (!ok) setGuardianState(activeInfo.tabId, false);
  } catch (_) {
    if (hasApproveGuardState(activeInfo?.tabId)) {
      setApproveGuardState(activeInfo.tabId, false);
    }

    setGuardianState(activeInfo.tabId, false);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === 'sdkInterceptorEvent') {
    // Ack imediato: o evento já é recebido pelos listeners de runtime no host do sidepanel.
    // Evita relay duplicado e mantém o fluxo do SDK mais limpo.
    sendResponse({ ok: true });
    return false;
  }

  if (message?.action === 'sendQuickPromptViaApi') {
    Promise.resolve()
      .then(() => sendQuickPromptViaApi({
        projectId: message.projectId,
        promptText: message.promptText,
        files: message.files,
        plan: message.plan,
      }))
      .then((payload) => sendResponse(payload))
      .catch((error) => {
        sendResponse({
          success: false,
          detail: error?.message || 'Falha ao enviar prompt rápido via API.',
        });
      });
    return true;
  }

  if (message?.action === 'getGuardianState') {
    getGuardianStateResponse(message.tabId).then(sendResponse);
    return true;
  }

  if (message?.action === 'toggleGuardian') {
    toggleGuardianResponse(message.tabId).then(sendResponse);
    return true;
  }

  if (message?.action === 'ensureApproveGuard') {
    ensureApproveGuardResponse(message.tabId).then(sendResponse);
    return true;
  }

  if (message?.action === 'getSecureRuntimeStatus') {
    sendResponse({
      ok: true,
      status: {
        initialized: runtimeState.initialized,
        loading: runtimeState.loading,
        failed: runtimeState.failed,
        message: runtimeState.message,
        version: runtimeState.lastVersion,
        hash: runtimeState.lastHash,
        loadedAt: runtimeState.lastLoadedAt,
        lastVersion: runtimeState.lastVersion,
        lastHash: runtimeState.lastHash,
        lastLoadedAt: runtimeState.lastLoadedAt,
        lastCheckedAt: runtimeState.lastCheckedAt,
      },
    });
    return true;
  }

  if (message?.action === 'forceSecureRuntimeReload') {
    runRemoteBackgroundRuntime('forceReload')
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({ ok: false, error: String(error?.message || error) });
      });
    return true;
  }

  return false;
});

// Bootstrap imediato do worker.
void ensureVersionHeaderRule();
void scheduleVersionAlarm();
ensureApproveGuardOnOpenLovableTabs();
void runRemoteBackgroundRuntime('bootstrap');
