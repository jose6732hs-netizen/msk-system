import "./config.js";

const cfg = () => globalThis.MSK_CONFIG || {};
const MSK_SAAS_ORIGIN = "https://msksystem.online";

/* ===== Rede resiliente + diagnóstico seguro ===== */
const MSK_DIAGNOSTICS_KEY = "mskDiagnosticsGlobal";
const mskRedact = (value) => {
  if (value == null) return value;
  if (typeof value === "string") {
    const masked = value
      .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
      .replace(/([?&](?:token|key|secret|password|code)=)[^&#\s]+/gi, "$1[redacted]")
      .replace(/\bMSK-[A-Z0-9-]{8,}\b/gi, "MSK-[redacted]");
    return masked.length > 800 ? `${masked.slice(0, 800)}…` : masked;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(mskRedact);
  if (typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|password|authorization|cookie|secret|apikey|api_key|credential/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = mskRedact(item);
  }
  return out;
};
const mskLog = async (level, code, message, context = {}) => {
  const entry = {
    at: Date.now(),
    level: ["error", "warn", "info"].includes(level) ? level : "info",
    code: String(code || "MSK_EVENT").slice(0, 80),
    message: String(message || "").slice(0, 500),
    context: mskRedact(context || {})
  };
  try {
    const current = (await chrome.storage.local.get(MSK_DIAGNOSTICS_KEY))[MSK_DIAGNOSTICS_KEY] || [];
    current.push(entry);
    await chrome.storage.local.set({ [MSK_DIAGNOSTICS_KEY]: current.slice(-100) });
  } catch {}
  try {
    const method = entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "info";
    console[method](`[MSK:${entry.code}] ${entry.message}`, entry.context);
  } catch {}
  // Telemetria é sempre assíncrona e nunca bloqueia a função principal da extensão.
  try { queueMicrotask(() => mskQueueTelemetryFromLog(entry).catch(() => {})); } catch {}
  return entry;
};
const mskFetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), Math.max(1000, Number(timeoutMs) || 15000));
  const externalSignal = options.signal;
  let externalAbort = null;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else {
      externalAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener("abort", externalAbort, { once:true });
    }
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      const timeoutError = new Error("Tempo limite de conexão excedido.");
      timeoutError.code = "NETWORK_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (externalSignal && externalAbort) externalSignal.removeEventListener("abort", externalAbort);
  }
};
const authSession = async () => (await chrome.storage.local.get("mskAuthSession")).mskAuthSession || null;
const saveAuthSession = async session => chrome.storage.local.set({ mskAuthSession: session });
const authCall = async (mode, email, password) => {
  const config = cfg();
  const path = mode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
  const response = await mskFetchWithTimeout(`${config.supabaseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey }, body: JSON.stringify({ email, password }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.error_description || data.message || `Autenticação ${response.status}`);
  const session = data.access_token ? { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000, user: data.user } : null;
  if (session) await saveAuthSession(session);
  return { session, user: data.user, confirmationRequired: !session };
};
const activeAuthSession = async () => {
  let session = await authSession();
  if (!session?.accessToken) return null;
  if (session.expiresAt > Date.now() + 60_000) return session;
  const config = cfg();
  const response = await mskFetchWithTimeout(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey }, body: JSON.stringify({ refresh_token: session.refreshToken }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) { await chrome.storage.local.remove("mskAuthSession"); return null; }
  session = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000, user: data.user };
  await saveAuthSession(session); return session;
};
const v2Api = async (action, payload = {}) => {
  const session = await activeAuthSession();
  if (!session) return { ok: false, status: 401, error: "Entre na sua conta MSK.", code: "AUTH_REQUIRED" };
  const config = cfg();
  const response = await mskFetchWithTimeout(`${config.supabaseUrl}/functions/v1/msk-api?action=${encodeURIComponent(action)}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey, Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify(payload) });
  const raw = await response.text(); let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || `HTTP ${response.status}` }; }
  return { ok: response.ok, status: response.status, ...data };
};


/* ===== Observabilidade MSK — cliente resiliente, privado e não bloqueante ===== */
const MSK_INSTALLATION_ID_KEY = "mskInstallationId";
const MSK_TELEMETRY_QUEUE_KEY = "mskTelemetryQueue";
const MSK_TELEMETRY_PAUSE_KEY = "mskTelemetryPauseUntil";
const MSK_UPDATE_STATE_KEY = "mskUpdateState";
const MSK_UPDATE_DOWNLOAD_KEY = "mskUpdateDownload";
const MSK_HEARTBEAT_ALARM = "msk-heartbeat";
const MSK_RELEASE_ALARM = "msk-release-check";
const MSK_TELEMETRY_FLUSH_ALARM = "msk-telemetry-flush";
const MSK_LICENSE_REVALIDATE_ALARM = "msk-license-revalidate";
const MSK_LICENSE_EXPIRY_ALARM = "msk-license-expiry";
const MSK_TELEMETRY_MAX = 250;

const mskFriendlyErrorCatalog = {
  AUTH_REQUIRED: "Sua sessão MSK precisa ser renovada. Entre novamente e tente outra vez.",
  NETWORK_TIMEOUT: "A conexão demorou mais que o normal. Tente novamente em alguns segundos.",
  NETWORK_ERROR: "Não consegui falar com o servidor agora. Confira sua internet e tente novamente.",
  CHATGPT_TAB_CLOSED: "A conversa do ChatGPT foi fechada. Abra a conexão novamente e tente outra vez.",
  CHATGPT_BRIDGE_TIMEOUT: "O ChatGPT demorou para responder. A MSK vai tentar se reconectar; tente novamente em alguns segundos.",
  CHATGPT_BRIDGE_NOT_READY: "O ChatGPT ainda está carregando. Aguarde alguns segundos e tente novamente.",
  CHATGPT_BRIDGE_LOADING: "O ChatGPT ainda está preparando a conexão. Aguarde um pouco e tente novamente.",
  CHATGPT_LOGIN_OR_READY_REQUIRED: "Abra o ChatGPT, confirme que sua conta está conectada e tente novamente.",
  GROK_BRIDGE_TIMEOUT: "O Grok demorou para responder. Aguarde alguns segundos e tente novamente.",
  GROK_NOT_CONNECTED: "O Grok ainda não está conectado a este projeto. Conecte-o e tente novamente.",
  GITHUB_WRITE_PERMISSION_DENIED: "O GitHub está conectado, mas ainda não permitiu editar este projeto. Reconecte o GitHub e tente novamente.",
  GITHUB_WRITE_PERMISSION_MISSING: "Falta permissão para editar este repositório no GitHub. Reconecte sua conta e tente novamente.",
  GITHUB_AUTH_REQUIRED: "O GitHub precisa ser autorizado novamente. Clique em reconectar e tente outra vez.",
  GITHUB_REPOSITORY_MISSING: "Ainda não encontrei o repositório deste projeto. Conecte o GitHub antes de continuar.",
  REPOSITORY_MISSING: "Ainda não encontrei o repositório deste projeto. Conecte o GitHub antes de continuar.",
  PROJECT_REQUIRED: "Abra o projeto que deseja editar e tente novamente.",
  PROJECT_MISMATCH: "O projeto aberto não é o mesmo que você escolheu. Abra o projeto correto e tente novamente.",
  LOVABLE_PUBLISH_FAILED: "O site não conseguiu publicar agora. Tente publicar novamente; seu projeto não será trocado.",
  LOVABLE_SYNC_FAILED: "A alteração foi feita, mas o preview ainda não atualizou. Tente atualizar o projeto novamente.",
  LICENSE_EXPIRED: "Sua licença expirou. Renove o acesso para continuar.",
  LICENSE_INVALID: "A licença informada não foi reconhecida. Confira os dados e tente novamente.",
  LICENSE_REVOKED: "Esta licença não está ativa. Entre em contato com o suporte MSK.",
  RATE_LIMITED: "Foram feitas muitas tentativas em pouco tempo. Aguarde alguns segundos e tente novamente."
};

function mskFriendlyErrorMessage(code, fallback = "") {
  const normalized = String(code || "").trim().toUpperCase();
  if (mskFriendlyErrorCatalog[normalized]) return mskFriendlyErrorCatalog[normalized];
  const raw = String(fallback || "").replace(/\s+/g, " ").trim();
  if (/permission|permiss[aã]o|forbidden|403/i.test(raw) && /github|repo/i.test(raw)) return mskFriendlyErrorCatalog.GITHUB_WRITE_PERMISSION_DENIED;
  if (/unauthori[sz]ed|401|auth/i.test(raw) && /github|repo/i.test(raw)) return mskFriendlyErrorCatalog.GITHUB_AUTH_REQUIRED;
  if (/timeout|tempo limite|demorou/i.test(raw)) return mskFriendlyErrorCatalog.NETWORK_TIMEOUT;
  if (/network|fetch|rede|internet|offline/i.test(raw)) return mskFriendlyErrorCatalog.NETWORK_ERROR;
  if (/chatgpt/i.test(raw) && /fechad|closed/i.test(raw)) return mskFriendlyErrorCatalog.CHATGPT_TAB_CLOSED;
  if (/reposit[oó]rio.*n[aã]o|repo.*not found|repository.*missing/i.test(raw)) return mskFriendlyErrorCatalog.REPOSITORY_MISSING;
  if (/publica|deploy|build/i.test(raw) && /falh|fail|erro|error/i.test(raw)) return mskFriendlyErrorCatalog.LOVABLE_PUBLISH_FAILED;
  return raw ? (raw.length > 240 ? `${raw.slice(0, 239)}…` : raw) : "Não consegui concluir esta etapa. Tente novamente; se continuar, o suporte MSK receberá o diagnóstico técnico.";
}

const mskRemoteRedact = (value) => {
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
      .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, "[REDACTED]")
      .replace(/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
      .replace(/\bMSK-[A-Z0-9-]{8,}\b/gi, "MSK-[REDACTED]")
      .replace(/([?&](?:token|key|secret|password|code|apikey|api_key)=)[^&#\s]+/gi, "$1[REDACTED]")
      .slice(0, 1000);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(mskRemoteRedact);
  if (typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|password|authorization|cookie|secret|apikey|api_key|credential|prompt|content|body|attachment|filedata|env/i.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = mskRemoteRedact(item);
  }
  return out;
};

async function mskEnsureInstallationId() {
  const saved = (await chrome.storage.local.get(MSK_INSTALLATION_ID_KEY))[MSK_INSTALLATION_ID_KEY];
  if (saved) return String(saved);
  const id = crypto.randomUUID ? crypto.randomUUID() : `msk-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  await chrome.storage.local.set({ [MSK_INSTALLATION_ID_KEY]: id });
  return id;
}

function mskBrowserSummary() {
  const ua = String(globalThis.navigator?.userAgent || "");
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : "Chromium";
  const os = /Windows/i.test(ua) ? "Windows" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : "unknown";
  return { browser, os };
}

async function mskTelemetryContext(extra = {}) {
  const installationId = await mskEnsureInstallationId();
  const base = await chrome.storage.local.get(["mskLicense", "mskLovableProjectId", "mskProjectLinks"]);
  const projectId = String(extra.projectId || base.mskLovableProjectId || "").trim();
  const providerKey = projectId ? `mskAIProvider:${projectId}` : "";
  const provider = providerKey ? String((await chrome.storage.local.get(providerKey))[providerKey] || "") : "";
  const links = projectId ? (base.mskProjectLinks?.[projectId] || {}) : {};
  const session = await authSession().catch(() => null);
  const client = mskBrowserSummary();
  return {
    installation_id: installationId,
    user_id: String(session?.user?.id || ""),
    account_email: String(base.mskLicense?.email || session?.user?.email || "").toLowerCase(),
    plan: base.mskLicense?.plan || base.mskLicense?.plan_name || null,
    license_expires_at: base.mskLicense?.expires_at ?? null,
    version: chrome.runtime.getManifest().version,
    extension_version: chrome.runtime.getManifest().version,
    project_id: projectId,
    repository: String(extra.repository || extra.repo || links.repo || "").replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, ""),
    provider: String(extra.provider || provider || ""),
    browser: client.browser,
    os: client.os,
    timestamp: new Date().toISOString()
  };
}

async function mskEnqueueTelemetry(kind, payload) {
  try {
    const all = await chrome.storage.local.get([MSK_TELEMETRY_QUEUE_KEY, MSK_TELEMETRY_PAUSE_KEY]);
    const queue = Array.isArray(all[MSK_TELEMETRY_QUEUE_KEY]) ? all[MSK_TELEMETRY_QUEUE_KEY] : [];
    queue.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind,
      payload: mskRemoteRedact(payload),
      createdAt: Date.now(),
      attempts: 0
    });
    await chrome.storage.local.set({ [MSK_TELEMETRY_QUEUE_KEY]: queue.slice(-MSK_TELEMETRY_MAX) });
  } catch {}
}

async function mskQueueTelemetryFromLog(entry) {
  if (!entry || /^TELEMETRY_/i.test(String(entry.code || ""))) return;
  const context = await mskTelemetryContext(entry.context || {}).catch(() => ({}));
  const base = {
    ...context,
    event_id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    action: String(entry.code || "MSK_EVENT").toLowerCase(),
    status: entry.level === "error" ? "failed" : entry.level === "warn" ? "warning" : "ok",
    severity: entry.level === "error" ? "error" : entry.level === "warn" ? "warning" : "info",
    technical_message: String(entry.message || "").slice(0, 500),
    user_message: mskFriendlyErrorMessage(entry.code, entry.message),
    metadata: mskRemoteRedact(entry.context || {})
  };
  await mskEnqueueTelemetry(entry.level === "error" ? "error" : "event", base);
  // Tenta escoar sem segurar a ação do usuário.
  mskFlushTelemetryQueue({ limit: 6 }).catch(() => {});
}

async function mskTelemetryHeaders() {
  const headers = { "Content-Type": "application/json", "Accept": "application/json" };
  const saved = (await chrome.storage.local.get("mskLicense")).mskLicense || null;
  if (saved?.token) {
    headers.Authorization = `Bearer ${String(saved.token).trim()}`;
    return headers;
  }
  // Compatibilidade: contas autenticadas sem token local ainda podem usar a sessão;
  // o backend aceita ambos e resolve a licença ativa do mesmo usuário.
  const session = await activeAuthSession().catch(() => null);
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  return headers;
}

function mskTelemetryRoute(kind) {
  if (kind === "error") return "/api/extension/errors";
  if (kind === "heartbeat") return "/api/extension/heartbeat";
  return "/api/extension/events";
}

let mskTelemetryFlushPromise = null;
async function mskFlushTelemetryQueue(options = {}) {
  if (mskTelemetryFlushPromise) return mskTelemetryFlushPromise;
  mskTelemetryFlushPromise = mskFlushTelemetryQueueInternal(options).finally(() => { mskTelemetryFlushPromise = null; });
  return mskTelemetryFlushPromise;
}
async function mskFlushTelemetryQueueInternal({ limit = 20 } = {}) {
  const saved = await chrome.storage.local.get([MSK_TELEMETRY_QUEUE_KEY, MSK_TELEMETRY_PAUSE_KEY]);
  let queue = Array.isArray(saved[MSK_TELEMETRY_QUEUE_KEY]) ? saved[MSK_TELEMETRY_QUEUE_KEY] : [];
  const pauseUntil = Number(saved[MSK_TELEMETRY_PAUSE_KEY] || 0);
  if (!queue.length || pauseUntil > Date.now()) return { ok:true, queued:queue.length, paused:pauseUntil > Date.now() };
  const headers = await mskTelemetryHeaders();
  let processed = 0;
  let changed = false;
  while (queue.length && processed < Math.max(1, Number(limit) || 20)) {
    const item = queue[0];
    try {
      const response = await mskFetchWithTimeout(`${MSK_SAAS_ORIGIN}${mskTelemetryRoute(item.kind)}`, {
        method:"POST", headers, body:JSON.stringify(item.payload)
      }, 8000);
      if (response.ok) {
        queue.shift(); changed = true; processed += 1; continue;
      }
      // Enquanto o backend novo ainda não estiver publicado, não martela o SaaS.
      if ([404, 405, 501].includes(response.status)) {
        await chrome.storage.local.set({ [MSK_TELEMETRY_PAUSE_KEY]: Date.now() + 6 * 60 * 60 * 1000 });
        break;
      }
      if ([400, 401, 403, 413, 422].includes(response.status)) {
        item.attempts = Number(item.attempts || 0) + 1;
        if (item.attempts >= 3) queue.shift();
        else queue[0] = item;
        changed = true; processed += 1;
        if (response.status === 401 || response.status === 403) break;
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  if (changed) await chrome.storage.local.set({ [MSK_TELEMETRY_QUEUE_KEY]: queue.slice(-MSK_TELEMETRY_MAX) });
  return { ok:true, queued:queue.length, processed };
}

async function mskSendHeartbeat() {
  const context = await mskTelemetryContext().catch(() => ({}));
  const payload = { ...context, status:"online" };
  await mskEnqueueTelemetry("heartbeat", payload);
  return mskFlushTelemetryQueue({ limit:8 }).catch(() => ({ok:false}));
}

function mskVersionParts(version) {
  return String(version || "0").split(".").map(part => Number(String(part).replace(/\D.*$/, "")) || 0);
}
function mskCompareVersions(left, right) {
  const a = mskVersionParts(left), b = mskVersionParts(right);
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const av = a[i] || 0, bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}
async function mskVerifyUpdateIdentity({ force = false } = {}) {
  const saved = (await chrome.storage.local.get("mskLicense")).mskLicense || null;
  const email = String(saved?.email || "").trim().toLowerCase();
  if (!email || !saved?.token) return { ok:false, code:"LICENSE_REQUIRED", email:"" };
  if (saved.expires_at && Date.parse(saved.expires_at) <= Date.now()) return { ok:false, code:"LICENSE_EXPIRED", email };
  const freshEnough = !force && Date.now() - Number(saved.checkedAt || 0) < 5 * 60 * 1000;
  if (freshEnough) return { ok:true, email, checkedAt:Number(saved.checkedAt || Date.now()), source:"cache" };
  try {
    const validation = await mskValidate(email, saved.token);
    const data = validation?.data || {};
    if (!validation?.ok || data?.valid !== true) return { ok:false, code:data?.code || "LICENSE_INVALID", email };
    const next = {
      ...saved,
      plan:data.license?.plan || saved.plan || null,
      plan_name:data.license?.plan_name || saved.plan_name || null,
      expires_at:data.license?.expires_at ?? saved.expires_at ?? null,
      activated_at:data.license?.activated_at ?? saved.activated_at ?? null,
      features:data.license?.features || saved.features || {},
      checkedAt:Date.now()
    };
    await chrome.storage.local.set({ mskLicense:next, mskLicenseEmail:email });
    return { ok:true, email, checkedAt:next.checkedAt, source:"server" };
  } catch (error) {
    return { ok:false, code:error?.code || "LICENSE_VERIFY_FAILED", email };
  }
}
function mskOfficialUpdateUrl(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (host === "msksystem.online" || host === "www.msksystem.online") return url.toString();
  } catch {}
  return "";
}
async function mskRecordUpdateEvent(action, status = "ok", metadata = {}) {
  try {
    const context = await mskTelemetryContext().catch(() => ({}));
    await mskEnqueueTelemetry("event", {
      ...context,
      event_id:crypto.randomUUID ? crypto.randomUUID() : `update-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      action, status, severity:status === "failed" ? "warning" : "info",
      metadata:mskRemoteRedact(metadata)
    });
    mskFlushTelemetryQueue({ limit:6 }).catch(() => {});
  } catch {}
}
function mskIsNewerVersion(candidate, current) {
  const a = mskVersionParts(candidate), b = mskVersionParts(current);
  const max = Math.max(a.length, b.length);
  for (let i=0; i<max; i += 1) {
    const av = a[i] || 0, bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

async function mskCheckRelease({ force = false, verifyIdentity = false } = {}) {
  const current = chrome.runtime.getManifest().version;
  const stored = await chrome.storage.local.get([MSK_UPDATE_STATE_KEY, MSK_UPDATE_DOWNLOAD_KEY, "mskLicense"]);
  const existing = stored[MSK_UPDATE_STATE_KEY] || null;
  const downloadState = stored[MSK_UPDATE_DOWNLOAD_KEY] || null;
  if (!force && existing?.checkedAt && Date.now() - Number(existing.checkedAt) < 60 * 60 * 1000) return { ...existing, currentVersion:current };
  try {
    const baseHeaders = await mskTelemetryHeaders();
    const installId = await mskEnsureInstallationId();
    const email = String(stored.mskLicense?.email || "").trim().toLowerCase();
    const headers = {
      ...baseHeaders,
      "X-MSK-Installation-Id":installId,
      "X-MSK-Extension-Version":current
    };
    if (email) headers["X-MSK-Account-Email"] = email;
    const url = new URL(`${MSK_SAAS_ORIGIN}/api/extension/version`);
    url.searchParams.set("current", current);
    const response = await mskFetchWithTimeout(url.toString(), { method:"GET", headers }, 8000);
    if (!response.ok) {
      const failed = { ...(existing || {}), available:!!existing?.available, currentVersion:current, checkedAt:Date.now(), unavailable:true };
      await chrome.storage.local.set({ [MSK_UPDATE_STATE_KEY]: failed });
      return failed;
    }
    const data = await response.json().catch(() => ({}));
    const latest = String(data.latest_version || data.latestVersion || data.version || "").trim();
    const minimum = String(data.minimum_version || data.minimumVersion || "").trim();
    const remoteAvailable = !!latest && mskIsNewerVersion(latest, current);
    const previousPending = String(existing?.pendingVersion || "").trim();
    const pendingVersion = remoteAvailable
      ? latest
      : (previousPending && mskCompareVersions(current, previousPending) < 0 ? previousPending : previousPending);
    const installedMeetsPending = !!pendingVersion && mskCompareVersions(current, pendingVersion) >= 0;
    let identity = { ok:!!existing?.identityVerified, email:String(existing?.verifiedEmail || email || "") };
    if (installedMeetsPending || verifyIdentity) identity = await mskVerifyUpdateIdentity({ force:true });
    const needsIdentityConfirmation = installedMeetsPending && !identity.ok;
    const updateConfirmed = installedMeetsPending && identity.ok;
    const downloadedForPending = !!downloadState?.version && !!pendingVersion && mskCompareVersions(downloadState.version, pendingVersion) >= 0;
    const state = {
      available: remoteAvailable || needsIdentityConfirmation,
      phase: remoteAvailable ? (downloadedForPending ? "downloaded" : "available") : needsIdentityConfirmation ? "verify" : "current",
      currentVersion: current,
      latestVersion: latest || pendingVersion || current,
      minimumVersion: minimum || "",
      pendingVersion: updateConfirmed ? "" : (pendingVersion || (remoteAvailable ? latest : "")),
      mandatory: !!data.mandatory || (!!minimum && mskIsNewerVersion(minimum, current)),
      downloadUrl: mskOfficialUpdateUrl(data.download_url || data.downloadUrl || existing?.downloadUrl || ""),
      changelog: String(data.changelog || "").slice(0, 2000),
      title: String(data.title || data.update_title || "").slice(0, 120),
      message: String(data.message || data.update_message || "").slice(0, 500),
      releasedAt: data.released_at || data.releasedAt || null,
      downloaded: downloadedForPending,
      downloadCompletedAt: downloadedForPending ? Number(downloadState.completedAt || 0) : 0,
      identityVerified: !!identity.ok,
      verifiedEmail: identity.ok ? String(identity.email || email || "").toLowerCase() : "",
      verificationCode: identity.ok ? "" : String(identity.code || ""),
      updateConfirmed,
      checkedAt: Date.now(),
      unavailable:false
    };
    if (updateConfirmed) {
      await chrome.storage.local.remove(MSK_UPDATE_DOWNLOAD_KEY).catch(() => {});
      await mskRecordUpdateEvent("extension_update_confirmed", "ok", { version:current, email_verified:!!state.verifiedEmail });
    }
    await chrome.storage.local.set({ [MSK_UPDATE_STATE_KEY]: state });
    return state;
  } catch {
    const failed = { ...(existing || {}), currentVersion:current, checkedAt:Date.now(), unavailable:true };
    await chrome.storage.local.set({ [MSK_UPDATE_STATE_KEY]: failed }).catch(() => {});
    return failed;
  }
}

async function mskDownloadRelease() {
  const state = (await chrome.storage.local.get(MSK_UPDATE_STATE_KEY))[MSK_UPDATE_STATE_KEY] || await mskCheckRelease({ force:true });
  const url = mskOfficialUpdateUrl(state?.downloadUrl);
  if (!state?.available || state?.phase === "verify") return { ok:false, code:"UPDATE_NOT_DOWNLOADABLE", message:"A atualização já foi instalada. Falta apenas confirmar sua licença e e-mail." };
  if (!url) return { ok:false, code:"UPDATE_URL_INVALID", message:"O arquivo de atualização ainda não está disponível no servidor oficial MSK." };
  const version = String(state.pendingVersion || state.latestVersion || "").trim();
  try {
    const downloadId = await chrome.downloads.download({ url, filename:version ? `MSK-Agente-v${version}.zip` : undefined, saveAs:true });
    const downloadState = { downloadId, version, startedAt:Date.now(), completedAt:0, status:"started" };
    await chrome.storage.local.set({ [MSK_UPDATE_DOWNLOAD_KEY]:downloadState, [MSK_UPDATE_STATE_KEY]:{ ...state, downloaded:false, phase:"downloading", downloadStartedAt:downloadState.startedAt } });
    await mskRecordUpdateEvent("extension_update_download_started", "ok", { version });
    return { ok:true, downloadId, version };
  } catch (error) {
    await mskRecordUpdateEvent("extension_update_download_failed", "failed", { version, reason:String(error?.message || "download_failed").slice(0,160) });
    return { ok:false, code:"UPDATE_DOWNLOAD_FAILED", message:"Não consegui iniciar o download. Tente novamente em alguns segundos." };
  }
}

chrome.downloads.onChanged.addListener(delta => {
  if (!delta?.id || !delta.state?.current) return;
  (async () => {
    const saved = await chrome.storage.local.get([MSK_UPDATE_DOWNLOAD_KEY, MSK_UPDATE_STATE_KEY]);
    const downloadState = saved[MSK_UPDATE_DOWNLOAD_KEY] || null;
    if (!downloadState || Number(downloadState.downloadId) !== Number(delta.id)) return;
    const status = delta.state.current;
    if (status === "complete") {
      const completed = { ...downloadState, status:"complete", completedAt:Date.now() };
      const state = saved[MSK_UPDATE_STATE_KEY] || {};
      await chrome.storage.local.set({ [MSK_UPDATE_DOWNLOAD_KEY]:completed, [MSK_UPDATE_STATE_KEY]:{ ...state, downloaded:true, phase:"downloaded", downloadCompletedAt:completed.completedAt } });
      await mskRecordUpdateEvent("extension_update_download_completed", "ok", { version:completed.version });
    } else if (status === "interrupted") {
      const state = saved[MSK_UPDATE_STATE_KEY] || {};
      await chrome.storage.local.set({
        [MSK_UPDATE_DOWNLOAD_KEY]:{ ...downloadState, status:"interrupted" },
        [MSK_UPDATE_STATE_KEY]:{ ...state, downloaded:false, phase:"available", downloadInterruptedAt:Date.now() }
      });
      await mskRecordUpdateEvent("extension_update_download_interrupted", "failed", { version:downloadState.version });
    }
  })().catch(() => {});
});

async function mskSetupBackgroundAlarms() {
  await mskEnsureInstallationId().catch(() => {});
  chrome.alarms.create(MSK_HEARTBEAT_ALARM, { periodInMinutes:5 });
  chrome.alarms.create(MSK_TELEMETRY_FLUSH_ALARM, { periodInMinutes:3 });
  chrome.alarms.create(MSK_RELEASE_ALARM, { periodInMinutes:360 });
  // Enquanto a extensão estiver instalada, revogações administrativas são
  // consultadas em segundo plano sem depender de atualizar a página do Lovable.
  chrome.alarms.create(MSK_LICENSE_REVALIDATE_ALARM, { periodInMinutes:1 });
  const saved = (await chrome.storage.local.get("mskLicense")).mskLicense || null;
  if (saved) await mskScheduleLicenseExpiry(saved).catch(() => {});
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === MSK_HEARTBEAT_ALARM) mskSendHeartbeat().catch(() => {});
  if (alarm.name === MSK_TELEMETRY_FLUSH_ALARM) mskFlushTelemetryQueue({ limit:20 }).catch(() => {});
  if (alarm.name === MSK_RELEASE_ALARM) mskCheckRelease({ force:true }).catch(() => {});
  if (alarm.name === MSK_LICENSE_REVALIDATE_ALARM) mskForceLicenseRevalidation().catch(() => {});
  if (alarm.name === MSK_LICENSE_EXPIRY_ALARM) mskInvalidateLicense("LICENSE_EXPIRED", "Sua licença expirou. Renove o acesso para continuar.").catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  mskSetupBackgroundAlarms().catch(() => {});
  mskSendHeartbeat().catch(() => {});
  mskCheckRelease().catch(() => {});
  mskForceLicenseRevalidation().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["MSK_UPDATE_STATUS", "MSK_UPDATE_CHECK", "MSK_UPDATE_DOWNLOAD", "MSK_UPDATE_VERIFY", "MSK_TELEMETRY_STATUS", "MSK_FRIENDLY_ERROR", "MSK_HEARTBEAT_NOW"].includes(message?.type)) return;
  (async () => {
    if (message.type === "MSK_FRIENDLY_ERROR") return sendResponse({ ok:true, message:mskFriendlyErrorMessage(message.code, message.message) });
    if (message.type === "MSK_UPDATE_STATUS") {
      const current = chrome.runtime.getManifest().version;
      let state = (await chrome.storage.local.get(MSK_UPDATE_STATE_KEY))[MSK_UPDATE_STATE_KEY] || null;
      if (!state || String(state.currentVersion || "") !== current) state = await mskCheckRelease({ force:true, verifyIdentity:true });
      else if (!state.checkedAt || Date.now() - Number(state.checkedAt) >= 60 * 60 * 1000) state = await mskCheckRelease();
      return sendResponse({ ok:true, state });
    }
    if (message.type === "MSK_UPDATE_CHECK") return sendResponse({ ok:true, state:await mskCheckRelease({ force:true }) });
    if (message.type === "MSK_UPDATE_VERIFY") return sendResponse({ ok:true, state:await mskCheckRelease({ force:true, verifyIdentity:true }) });
    if (message.type === "MSK_UPDATE_DOWNLOAD") return sendResponse(await mskDownloadRelease());
    if (message.type === "MSK_HEARTBEAT_NOW") return sendResponse(await mskSendHeartbeat());
    const data = await chrome.storage.local.get([MSK_TELEMETRY_QUEUE_KEY, MSK_INSTALLATION_ID_KEY, MSK_TELEMETRY_PAUSE_KEY]);
    return sendResponse({ ok:true, queued:(data[MSK_TELEMETRY_QUEUE_KEY] || []).length, installationId:data[MSK_INSTALLATION_ID_KEY] || "", pausedUntil:Number(data[MSK_TELEMETRY_PAUSE_KEY] || 0) });
  })().catch(error => sendResponse({ ok:false, error:mskFriendlyErrorMessage(error?.code, error?.message) }));
  return true;
});


/* ===== Ponte local ChatGPT — sem servidor de agente ===== */
// Um único inicializador por projeto. Evita que duas atualizações/ações concorrentes
// reenviem o prompt de abertura antes de o primeiro ACK chegar.
const mskChatGPTInitLocks = new Map();
const mskReadChatGPTProjects = async () => (await chrome.storage.local.get("mskChatGPTProjects")).mskChatGPTProjects || {};
const mskWriteChatGPTProject = async (projectId, patch) => {
  const projects = await mskReadChatGPTProjects();
  projects[projectId] = { ...(projects[projectId] || {}), ...patch, projectId, updatedAt: Date.now() };
  await chrome.storage.local.set({ mskChatGPTProjects: projects });
  return projects[projectId];
};
const mskRelayToLovable = async (projectId, payload) => {
  // Envia para todas as abas do editor; cada content script confere o projectId.
  // Assim respostas continuam chegando mesmo se o Lovable mudar a rota (/projects, /p, query etc.).
  const tabs = await chrome.tabs.query({ url: "https://lovable.dev/*" }).catch(() => []);
  for (const tab of tabs) {
    if (!tab.id) continue;
    await chrome.tabs.sendMessage(tab.id, { ...payload, projectId:projectId || payload?.projectId || "" }).catch(() => {});
  }
};
const mskFocusLovableTab = async tabId => {
  const id = Number(tabId || 0);
  if (!id) return false;
  const tab = await chrome.tabs.get(id).catch(() => null);
  if (!tab || !/^https:\/\/(?:[^/]+\.)?lovable\.dev\//.test(String(tab.url || ""))) return false;
  await chrome.tabs.update(id, { active: true }).catch(() => {});
  if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  return true;
};
const mskRestoreTabAfterChatGPTWake = async tabId => {
  const id = Number(tabId || 0);
  if (!id) return;
  const tab = await chrome.tabs.get(id).catch(() => null);
  if (!tab) return;
  await chrome.tabs.update(id, { active:true }).catch(() => {});
};

const mskDispatchChatGPTImmediately = async (tabId, message, { originTabId = null, timeout = 75000 } = {}) => {
  const id = Number(tabId || 0);
  if (!id) return { ok:false, code:"CHATGPT_TAB_CLOSED", error:"A conversa vinculada do ChatGPT foi fechada." };

  const target = await chrome.tabs.get(id).catch(() => null);
  if (!target || !/^https:\/\/chatgpt\.com\//.test(String(target.url || ""))) {
    return { ok:false, code:"CHATGPT_TAB_CLOSED", error:"A conversa vinculada do ChatGPT foi fechada." };
  }

  // A conversa da IA permanece em segundo plano: nunca ativa nem troca a aba do usuário.
  // O bridge recebe e despacha a mensagem diretamente para o ChatGPT.
  await chrome.tabs.update(id, { autoDiscardable:false }).catch(() => {});
  return await mskWaitBridge(id, message, timeout);
};

const mskEnsureChatGPTBridge = async tabId => {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type:"MSK_CHATGPT_PING" });
    if (ping?.ok) return true;
  } catch {}
  try {
    await chrome.scripting.executeScript({ target:{ tabId }, files:["chatgpt-bridge.js"] });
  } catch {}
  for (let i = 0; i < 30; i++) {
    try {
      const ping = await chrome.tabs.sendMessage(tabId, { type:"MSK_CHATGPT_PING" });
      if (ping?.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  await mskLog("warn", "CHATGPT_BRIDGE_NOT_READY", "A ponte do ChatGPT não respondeu após reinjeção.", { tabId:Number(tabId || 0) });
  return false;
};
const mskWaitBridge = async (tabId, message, timeout = 20000) => {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeout) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !/^https:\/\/chatgpt\.com\//.test(String(tab.url || ""))) {
      await mskLog("warn", "CHATGPT_TAB_CLOSED", "A aba vinculada do ChatGPT foi fechada.", { tabId:Number(tabId || 0) });
      return { ok:false, code:"CHATGPT_TAB_CLOSED", error:"A conversa vinculada do ChatGPT foi fechada." };
    }
    const ready = await mskEnsureChatGPTBridge(tabId);
    if (!ready) {
      lastError = "Ponte do ChatGPT ainda carregando.";
      await new Promise(resolve => setTimeout(resolve, 250));
      continue;
    }
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      if (response?.ok) return response;
      lastError = response?.error || lastError;
    } catch (error) {
      lastError = error?.message || lastError;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await mskLog("warn", "CHATGPT_BRIDGE_TIMEOUT", "O ChatGPT não confirmou a operação dentro do tempo limite.", { tabId:Number(tabId || 0), timeout:Number(timeout || 0) });
  return { ok:false, code:"CHATGPT_BRIDGE_TIMEOUT", error:lastError || "O ChatGPT não confirmou o envio em tempo real." };
};

const mskCreateOrRecoverChatGPTBinding = async ({ projectId, stored, originTabId, repo = "", projectName = "Projeto atual", createIfMissing = true }) => {
  const key = `mskChatBinding:${projectId}`;
  let binding = stored || null;
  let tab = binding?.tabId ? await chrome.tabs.get(Number(binding.tabId)).catch(() => null) : null;
  if (tab && !/^https:\/\/chatgpt\.com\//.test(String(tab.url || ""))) tab = null;

  if (!tab && createIfMissing) {
    // Não reaproveita conversa aleatória de outro projeto/usuário. Cria uma ponte
    // dedicada e deixa a própria extensão reconstruir o vínculo.
    tab = await chrome.tabs.create({ url:"https://chatgpt.com/", active:false }).catch(() => null);
    if (!tab?.id) return { ok:false, code:"CHATGPT_OPEN_FAILED", error:"Não consegui abrir o ChatGPT automaticamente." };
    binding = {
      ...(binding || {}),
      projectId,
      tabId:tab.id,
      originTabId:originTabId || binding?.originTabId || null,
      repo:String(repo || binding?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim(),
      createdAt:Date.now(),
      conversationUrl:"",
      returnAfterFirstResponse:false,
      connected:true,
      initialized:false,
      initDeliveryId:"",
      initializingAt:0,
      initialPromptSentAt:0,
      initialPrompt:mskChatGPTInitialPrompt({ projectId, repo:repo || binding?.repo || "", projectName })
    };
    await chrome.storage.local.set({ [key]:binding, [`mskChatTab:${tab.id}`]:projectId });
    await mskLog("info", "CHATGPT_BINDING_CREATED", "Conversa do ChatGPT criada/reconstruída automaticamente.", { projectId, tabId:tab.id });
  } else if (tab) {
    binding = {
      ...(binding || {}), projectId, tabId:tab.id,
      originTabId:originTabId || binding?.originTabId || null,
      repo:String(repo || binding?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim(),
      connected:true
    };
    await chrome.storage.local.set({ [key]:binding, [`mskChatTab:${tab.id}`]:projectId });
  }

  if (!tab?.id || !binding) return { ok:false, code:"CHATGPT_NOT_CONNECTED", error:"Não foi possível reconstruir a conversa do ChatGPT." };

  // O content script é reinjetado quando necessário. Isso elimina dependência de F5.
  const ready = await mskEnsureChatGPTBridge(tab.id);
  if (!ready) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const retryReady = await mskEnsureChatGPTBridge(tab.id);
    if (!retryReady) return { ok:false, code:"CHATGPT_BRIDGE_LOADING", error:"O ChatGPT ainda está inicializando. O MSK tentará novamente automaticamente." };
  }

  // O prompt inicial pertence à CONVERSA, não ao comando. Ele é enviado uma
  // única vez por vínculo/continuação. A atualização da aba nunca dispara INIT.
  // Releia o storage antes de iniciar para não confiar em um snapshot antigo.
  const latestBeforeInit = (await chrome.storage.local.get(key))[key] || binding;
  binding = { ...binding, ...latestBeforeInit, tabId:tab.id, connected:true };
  if (!binding.initialized) {
    let initPromise = mskChatGPTInitLocks.get(projectId);
    if (!initPromise) {
      initPromise = (async () => {
        const fresh = (await chrome.storage.local.get(key))[key] || binding;
        if (fresh.initialized) return { ok:true, binding:{ ...binding, ...fresh, tabId:tab.id, connected:true } };

        const initText = fresh.initialPrompt || mskChatGPTInitialPrompt({ projectId, repo:fresh.repo || repo || "", projectName });
        const initDeliveryId = String(fresh.initDeliveryId || `msk-init-${projectId}-${fresh.createdAt || Date.now()}`);
        const pending = {
          ...fresh,
          projectId,
          tabId:tab.id,
          connected:true,
          initDeliveryId,
          initializingAt:Date.now()
        };
        await chrome.storage.local.set({ [key]:pending, [`mskChatTab:${tab.id}`]:projectId });

        const initResult = await mskWaitBridge(tab.id, {
          type:"MSK_CHATGPT_INIT",
          payload:{
            projectId,
            repo:pending.repo || repo || "",
            originTabId:pending.originTabId || null,
            deliveryId:initDeliveryId,
            text:initText,
            displayText:'Contexto do projeto enviado pela MSK.'
          }
        }, 55000).catch(error => ({ok:false,error:error?.message || "Falha ao iniciar a conversa do ChatGPT."}));

        if (!initResult?.ok) {
          const failed = { ...pending, initializingAt:0 };
          await chrome.storage.local.set({ [key]:failed });
          return { ok:false, code:"CHATGPT_LOGIN_OR_READY_REQUIRED", error:initResult?.error || "O ChatGPT ainda não está pronto para receber mensagens." };
        }

        const liveTab = await chrome.tabs.get(tab.id).catch(() => null);
        const readyBinding = {
          ...pending,
          initialized:true,
          initialPrompt:"",
          initialPromptSentAt:Date.now(),
          initializingAt:0,
          connected:true,
          conversationUrl:liveTab?.url || pending.conversationUrl || ""
        };
        await chrome.storage.local.set({ [key]:readyBinding });
        return { ok:true, binding:readyBinding };
      })().finally(() => mskChatGPTInitLocks.delete(projectId));
      mskChatGPTInitLocks.set(projectId, initPromise);
    }

    const initialized = await initPromise;
    if (!initialized?.ok) return initialized;
    binding = initialized.binding;
  }

  return { ok:true, tab, binding };
};

const mskDeepInspectionRequested = value => {
  const text = String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return false;
  return /\b(analise|analisar|analisa|inspecione|inspecionar|inspeciona|audite|auditar|auditoria|varredura|varrer|investigue|investigar|diagnostique|diagnosticar|revise a seguranca|revisar seguranca|verifique a seguranca|verificar seguranca|seguranca do projeto|projeto inteiro|codigo inteiro|repositorio inteiro|arquitetura inteira|encontre problemas|procure problemas|ache vulnerabilidades|vulnerabilidades)\b/i.test(text);
};

const mskBuildProtectedCommandPrompt = ({ projectId, repo, projectName, providerLabel = "IA", userText = "" }) => {
  const cleanProjectId = String(projectId || "").trim();
  const cleanRepo = String(repo || "").replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").trim();
  const cleanProjectName = String(projectName || "Projeto atual").replace(/\s+/g, " ").trim();
  const cleanUserText = String(userText || "").trim();
  const request = cleanUserText || "Considere somente o contexto explícito desta mensagem.";
  const deep = mskDeepInspectionRequested(cleanUserText);
  const mode = deep ? "INSPECAO_PRECISA" : "FAST_EDIT";
  const executionRules = deep ? `
MODO: INSPEÇÃO PRECISA — o cliente pediu análise/inspeção explicitamente.
- Você pode ampliar a leitura do projeto somente na medida necessária para a inspeção solicitada.
- Mesmo neste modo, evite arquivos sem relação com o objetivo e não altere nada fora do que for confirmado.` : `
MODO: FAST EDIT — PADRÃO OBRIGATÓRIO PARA ESTE COMANDO.
- REGRA PRINCIPAL: VÁ DIRETO AO ARQUIVO DO ASSUNTO. Não comece listando pastas, lendo README, mapeando arquitetura ou inspecionando o repositório inteiro.
- NÃO faça varredura geral, NÃO liste o repositório inteiro, NÃO leia a arquitetura completa e NÃO faça planejamento longo antes de editar.
- Se o arquivo-alvo já foi identificado nesta conversa, abra DIRETAMENTE esse arquivo e edite; não faça nova busca.
- Se o arquivo ainda não for conhecido, faça SOMENTE uma localização direcionada e curta usando o assunto citado pelo cliente. Achou um alvo com confiança suficiente → PARE de procurar e edite.
- Fundo/cor/tema: comece diretamente pelo CSS global, tokens/tema ou arquivo de estilo da página citada.
- Texto do início/home/hero: comece pela página inicial/Hero e pesquise a frase exata; não inspecione outras páginas.
- Texto visível em qualquer página: pesquise primeiro a frase exata e altere somente a ocorrência correta.
- Botão/bloco/menu: pesquise pelo rótulo ou nome do componente citado e abra somente o componente correspondente.
- Login/autenticação: comece pela rota/página/componente de login ou auth relacionado; não audite autenticação inteira salvo pedido explícito.
- Logo/imagem: use nome, alt, referência atual, seção indicada e anexo enviado para localizar somente o componente responsável.
- Remover/ocultar botão, texto ou bloco: localize pelo rótulo/componente exato e faça o menor patch possível.
- Para alteração simples, NÃO rode auditoria geral nem build/teste completo por padrão. Valide o arquivo alterado e o diff mínimo; execute validação maior somente se a mudança realmente puder afetar estrutura/dependências.
- Se a localização continuar ambígua após a busca direcionada, faça UMA pergunta curta ou uma segunda busca estreita; nunca transforme um pedido simples em inspeção do projeto inteiro.
- Reutilize caminhos de arquivos já encontrados anteriormente nesta conversa em vez de procurá-los novamente.`;

  return `MSK — COMANDO SEGURO · ${mode}
Projeto: ${cleanProjectName} | project_id: ${cleanProjectId || "não identificado"}
GitHub: ${cleanRepo || "não identificado"}
Executor: ${providerLabel}

PEDIDO DO CLIENTE:
${request}
${executionRules}

REGRAS GERAIS:
- Mantenha o foco exatamente no pedido acima e altere SOMENTE o necessário para cumpri-lo.
- Preserve tudo que já funciona; não refatore, renomeie ou mexa em partes não solicitadas.
- Se for apenas pergunta/análise, responda sem editar. Se for edição, aplique somente neste repositório GitHub.
- Não use outro projeto/repositório por contexto antigo. Se faltar alvo ou permissão real de escrita, informe isso sem tentar outro destino.
- Faça a escrita real no GitHub assim que o alvo estiver confirmado. Depois valide a alteração e sincronize/confira no Lovable apenas para refletir o GitHub. Não use o agente do Lovable para implementar.
- Para FAST EDIT, priorize localizar → editar → validar diff. Não gaste tempo explicando o que pretende fazer antes de executar.
- Só confirme conclusão quando houver evidência real da edição; responda de forma curta e profissional.
- INTEGRAÇÕES/API/PAGAMENTOS: o cliente usa o COFRE MSK da extensão. Se faltar credencial, token, Client ID, CPF/CNPJ, Secret, Webhook Secret ou outro dado de conexão, NÃO diga que o ChatGPT/Grok não possui ferramenta de secrets, NÃO mande para o painel de secrets da Lovable, NÃO peça .env manual e NÃO peça o valor no chat. Faça primeiro tudo que puder sem o segredo.
- ESCOPO DE CREDENCIAIS: se o cliente disser qual chave quer trocar (ex.: "só API Key") ou citar algumas chaves, solicite SOMENTE essas chaves. Não ofereça campos extras. Se o cliente pedir genericamente para "trocar a API/gateway/credenciais" e houver 2 ou mais credenciais possíveis, faça UMA pergunta curta antes: "Deseja trocar todas as credenciais ou apenas uma específica? Se específica, qual?". Nesse caso NÃO gere o marcador até o cliente responder.
- Quando o escopo estiver claro, finalize OBRIGATORIAMENTE com UMA linha técnica para a extensão abrir o Cofre MSK. Para alteração use mode:"update" e scope:"selected"; para integração nova completa use mode:"new" e scope:"all":
<MSK_INTEGRATION_REQUEST>{"service":"Nome do serviço","title":"Atualizar serviço","mode":"update","scope":"selected","fields":[{"key":"api_key","label":"API Key","placeholder":"Cole a nova API Key","secret":true,"required":false}]}</MSK_INTEGRATION_REQUEST>
- Nesse marcador envie APENAS metadados dos campos, nunca valores reais. Marque como secret:true API keys, tokens, secrets, Client ID/Secret, CPF/CNPJ e identificadores sensíveis. Base URL pública pode ser secret:false. O pop-up da MSK enviará somente os campos realmente preenchidos.`;
};

const mskChatGPTInitialPrompt = ({ projectId, repo, projectName }) => `MSK Agente conectado. Trabalhe SOMENTE no projeto abaixo durante toda esta conversa.

Projeto Lovable: ${projectId}
Nome: ${projectName || "Projeto atual"}
Repositório GitHub: ${repo || "ainda não identificado"}

ARQUITETURA OBRIGATÓRIA:
- A extensão MSK é apenas interface/controle. NÃO use o chat/agente do Lovable para implementar, corrigir ou analisar código.
- Toda alteração de código deve ser feita DIRETAMENTE no repositório GitHub usando ferramentas de escrita realmente disponíveis nesta conversa (GitHub/Codex ou equivalente autorizado).
- O Lovable deve ser usado somente como referência do project_id, sincronização do repositório, preview e publicação. Nunca envie prompt ao agente do Lovable para realizar a alteração.
- REGRA OBRIGATÓRIA DE ENTREGA: toda edição de código solicitada deve ser efetivamente aplicada/commitada no repositório GitHub conectado. Depois da alteração no GitHub, confirme/sincronize a atualização no projeto Lovable correspondente para que o preview reflita exatamente o código atualizado. Não considere a tarefa concluída se a mudança existir apenas no chat, em um patch local ou em uma sugestão sem escrita real no GitHub.
- Após cada edição concluída no GitHub, use o Lovable somente para sincronizar/atualizar e conferir o preview da edição. Se o preview não puder ser executado por limitação real do Lovable, mantenha o commit no GitHub e informe no resumo final que o preview não pôde ser confirmado.
- Falta de créditos no workspace Lovable NÃO é motivo para interromper uma edição GitHub. Continue a alteração pelo GitHub. Se os créditos impedirem apenas preview/build/publicação do Lovable, informe isso SOMENTE no resumo final depois de concluir e validar tudo que for possível no repositório.
- Se não existir ferramenta/permissão real de ESCRITA no GitHub, não atribua o problema a créditos do Lovable. Informe a causa exata observada: repositório ausente, GitHub não autorizado, permissão de escrita ausente, ferramenta indisponível, autenticação necessária, limite real da conta ChatGPT ou outro erro comprovado.
- REPOSITÓRIO IDENTIFICADO NÃO SIGNIFICA GITHUB AUTORIZADO. Mantenha separados os estados de projeto, conversa, repositório e permissão real de escrita.
- Nunca invente a causa de uma falha. Cite de forma curta o sinal/erro real que confirmou o diagnóstico.

MODO DE EXECUÇÃO — FAST EDIT POR PADRÃO:
1. Todo pedido direto de edição deve começar em FAST EDIT: vá ao arquivo já conhecido ou faça apenas busca direcionada pelo texto/componente/tema/imagem citado. NÃO inspecione o repositório inteiro antes de uma alteração simples.
2. Só use inspeção ampla quando o cliente pedir explicitamente para analisar, inspecionar, auditar, investigar o projeto inteiro ou revisar segurança.
3. Assim que localizar o alvo correto, pare de procurar, faça o menor patch possível e valide o diff. Reutilize arquivos já encontrados na conversa.
4. Não altere absolutamente nada fora do que foi solicitado. Preserve design, funcionalidades, dependências, dados, integrações e comportamento existentes.
5. Antes de declarar sucesso, valide objetivamente a alteração com as ferramentas disponíveis. Nunca diga “feito”, “publicado”, “corrigido” ou equivalente sem confirmação real.
6. Para ações demoradas, responda apenas com estados curtos: “Analisando…”, “Aplicando…”, “Validando…” e “Concluído”.
7. Não despeje código, JSON, diffs, logs técnicos ou raciocínio interno, salvo se o usuário solicitar. Em falhas, retorne um diagnóstico curto e factual.
8. Se uma ferramenta exigir permissão/autorização, mantenha o contexto e aguarde a decisão; a extensão MSK espelhará a permissão.
9. Use somente acessos realmente disponíveis. Nunca finja acesso, commit, push, preview ou publicação.
10. Mantenha-se vinculado ao mesmo project_id e repositório até ordem explícita para trocar.
11. Ao concluir, responda de forma profissional e concisa com resultado, status real e resumo curto.

SEGURANÇA: nunca solicite nem revele token de licença, senha, cookie, chave privada ou credencial secreta da extensão.

Não altere nada agora. Confirme brevemente três estados separados: projeto identificado; repositório identificado ou ausente; GitHub/Codex para escrita conectado, não conectado/autorização necessária, ou não verificável. Não trate o nome do repositório como prova de permissão.`;


const mskChatGPTContinuationPrompt = ({ projectId, repo, projectName, history }) => {
  const recent = Array.isArray(history) ? history.slice(-14) : [];
  const transcript = recent.map(item => {
    const role = item?.role === "user" ? "CLIENTE" : "AGENTE";
    return `${role}: ${String(item?.content || "").replace(/\s+/g, " ").trim().slice(0, 1800)}`;
  }).filter(line => !line.endsWith(": ")).join("\n");
  return `CONTINUAÇÃO AUTOMÁTICA MSK — a conversa anterior atingiu o limite de comprimento. Continue exatamente do ponto em que parou, sem refazer trabalho já concluído.

Projeto Lovable: ${projectId}
Nome: ${projectName || "Projeto atual"}
Repositório GitHub: ${repo || "ainda não identificado"}

REGRAS: trabalhe somente neste projeto; execute direto quando o pedido estiver claro; não altere nada fora do pedido; valide antes de confirmar sucesso; mantenha respostas curtas; não exponha código/JSON/logs salvo se solicitado; preserve permissões e aguarde autorizações reais quando necessárias. Faça alterações diretamente no GitHub/Codex quando houver ferramenta de escrita disponível e NUNCA use o chat/agente do Lovable para implementar mudanças. TODA edição deve terminar com escrita real no GitHub conectado e, em seguida, sincronização/atualização do projeto Lovable para que o preview reflita o commit. Não considere concluído se existir apenas sugestão, patch local ou texto no chat. Créditos do Lovable podem limitar preview/publicação, mas não devem interromper edição no GitHub; nesse caso, mantenha o GitHub atualizado e informe apenas que o preview não pôde ser confirmado. Se houver falha, informe somente a causa realmente observada. Verifique o estado atual do projeto pelas ferramentas antes de continuar uma ação pendente.

HISTÓRICO RECENTE DA EXTENSÃO:
${transcript || "Nenhuma mensagem recente disponível."}

Primeiro, responda brevemente “Contexto recuperado.” e continue a tarefa pendente se houver uma ação clara ainda não concluída.`;
};



/* ===== Ponte local externa: Grok, paralela ao ChatGPT ===== */
const MSK_EXTERNAL_AI = {
  grok: {
    id:"grok", label:"Grok", prefix:"GROK", storage:"mskGrok",
    url:"https://grok.com/", match:/^https:\/\/grok\.com\//,
    bridgeFile:"grok-bridge.js"
  }
};
const mskExternalConfig = provider => MSK_EXTERNAL_AI[String(provider || "").toLowerCase()] || null;
const mskExternalBindingKey = (cfg, projectId) => `${cfg.storage}Binding:${projectId}`;
const mskExternalTabKey = (cfg, tabId) => `${cfg.storage}Tab:${tabId}`;
const mskProviderGithubStateKey = (provider, projectId) => `mskProviderGithub:${String(provider || "unknown").toLowerCase()}:${projectId}`;
const mskReadProviderGithubState = async (provider, projectId) => {
  const key = mskProviderGithubStateKey(provider, projectId);
  return (await chrome.storage.local.get(key))[key] || null;
};
const mskWriteProviderGithubState = async (provider, projectId, patch = {}) => {
  const key = mskProviderGithubStateKey(provider, projectId);
  const previous = (await chrome.storage.local.get(key))[key] || {};
  const next = { ...previous, ...patch, provider:String(provider || "").toLowerCase(), projectId, updatedAt:Date.now() };
  await chrome.storage.local.set({ [key]:next });
  return next;
};
const mskClassifyProviderGithubText = (provider, text, repo = "") => {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const cfg = mskExternalConfig(provider);
  const label = provider === "chatgpt" ? "ChatGPT" : (cfg?.label || "IA");
  const evidence = raw.slice(0, 520);
  const base = { provider, providerLabel:label, repository:String(repo || "").replace(/^https:\/\/github\.com\//i, "").trim(), evidence };

  if (/(?:repository|reposit[oó]rio)\s*(?:is|est[aá]|:|-)?\s*(?:not found|not connected|not linked|missing|n[aã]o encontrado|n[aã]o conectado|n[aã]o vinculado|ausente)/i.test(raw)) {
    return { ...base, state:"repository_missing", severity:"error", title:`${label}: repositório não disponível`, message:`O ${label} informou que o repositório necessário não está disponível nesta conversa.`, action:"Confirme o repositório salvo para este project_id. Não trate o projeto como pronto para edição até o repositório correto estar identificado." };
  }
  if (/(permission denied|write access|write permission|read[- ]only|cannot (?:write|push|commit)|can't (?:write|push|commit)|sem permiss[aã]o.{0,50}(?:escrita|push|commit)|permiss[aã]o.{0,50}(?:negada|insuficiente)|forbidden|\b403\b)/i.test(raw) && /(github|repository|reposit[oó]rio|commit|push)/i.test(raw)) {
    return { ...base, state:"write_permission_missing", severity:"error", title:`${label}: GitHub sem permissão de escrita`, message:`A conversa do ${label} está ativa, mas não há permissão confirmada para editar/push no GitHub.`, action:"Conclua uma autorização oficial de escrita disponível nessa IA e tente novamente. O MSK não considerará o GitHub pronto apenas porque o repositório foi identificado." };
  }
  if (/(sign in|log in|authenticate|authentication required|oauth|fa[cç]a login|entre na conta|autentica[cç][aã]o necess[aá]ria)/i.test(raw) && /(github|repository|reposit[oó]rio|connector|conector|tool|ferramenta)/i.test(raw)) {
    return { ...base, state:"authorization_required", severity:"error", title:`${label}: autorização GitHub necessária`, message:`O ${label} informou que é necessária autenticação/autorização real antes de usar o GitHub.`, action:"Abra somente a autorização oficial oferecida pela própria IA/conta e conclua o login. Depois o MSK deve verificar novamente o acesso." };
  }
  if (/(github).{0,120}(not connected|not authorized|unavailable|not available|n[aã]o conectado|n[aã]o autorizado|indispon[ií]vel)|(?:connector|conector|tool|ferramenta).{0,100}(github).{0,100}(unavailable|not available|indispon[ií]vel)/i.test(raw)) {
    return { ...base, state:"not_connected", severity:"error", title:`${label}: GitHub não conectado`, message:`O ${label} está conectado ao MSK, porém a própria resposta indica que o GitHub não está conectado/disponível para escrita.`, action:"Solicite/conclua a integração GitHub oficial disponível nessa IA. Se a conta não oferecer integração de escrita, mantenha o status como não conectado em vez de simular commit ou push." };
  }
  if (/(requested|solicitad[ao]|pending|pendente|waiting|aguardando).{0,100}(github|authorization|autoriza[cç][aã]o|update|atualiza[cç][aã]o)|(?:github|authorization|autoriza[cç][aã]o|update|atualiza[cç][aã]o).{0,100}(requested|solicitad[ao]|pending|pendente|waiting|aguardando)/i.test(raw)) {
    return { ...base, state:"update_requested", severity:"warning", title:`${label}: atualização GitHub solicitada`, message:`O ${label} indicou que uma atualização/autorização GitHub foi solicitada e ainda precisa ser confirmada.`, action:"Aguarde ou conclua a autorização oficial e depois valide novamente antes de considerar a escrita disponível." };
  }
  if (/(github).{0,100}(connected|authorized|write access available|acesso de escrita|conectado|autorizado)|(?:can|consigo|able to).{0,80}(commit|push|write).{0,80}(github|repository|reposit[oó]rio)/i.test(raw)) {
    return { ...base, state:"reported_connected", severity:"info", title:`${label}: acesso GitHub reportado`, message:`O ${label} reportou acesso GitHub disponível. O MSK ainda exige evidência real de commit/push antes de marcar uma edição como concluída.`, action:"Na próxima edição, valide o commit/push real no repositório antes de declarar sucesso." };
  }
  return null;
};

const mskEnsureExternalBridge = async (provider, tabId) => {
  const cfg = mskExternalConfig(provider);
  if (!cfg) return false;
  const pingType = `MSK_${cfg.prefix}_PING`;
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type:pingType });
    if (ping?.ok) return true;
  } catch {}
  try {
    await chrome.scripting.executeScript({ target:{ tabId }, files:[cfg.bridgeFile] });
  } catch {}
  for (let i = 0; i < 40; i++) {
    try {
      const ping = await chrome.tabs.sendMessage(tabId, { type:pingType });
      if (ping?.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 180));
  }
  await mskLog("warn", `${cfg.prefix}_BRIDGE_NOT_READY`, `A ponte do ${cfg.label} não respondeu após reinjeção.`, { tabId:Number(tabId || 0) });
  return false;
};

const mskWaitExternalBridge = async (provider, tabId, message, timeout = 30000) => {
  const cfg = mskExternalConfig(provider);
  if (!cfg) return { ok:false, code:"PROVIDER_UNKNOWN", error:"Provedor não reconhecido." };
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeout) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !cfg.match.test(String(tab.url || ""))) {
      return { ok:false, code:`${cfg.prefix}_TAB_CLOSED`, error:`A conversa vinculada do ${cfg.label} foi fechada.` };
    }
    const ready = await mskEnsureExternalBridge(provider, tabId);
    if (!ready) {
      lastError = `Ponte do ${cfg.label} ainda carregando.`;
      await new Promise(resolve => setTimeout(resolve, 250));
      continue;
    }
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      if (response?.ok) return response;
      lastError = response?.error || lastError;
    } catch (error) {
      lastError = error?.message || lastError;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return { ok:false, code:`${cfg.prefix}_BRIDGE_TIMEOUT`, error:lastError || `O ${cfg.label} não confirmou o envio em tempo real.` };
};

const mskExternalInitialPrompt = (provider, { projectId, repo, projectName }) => {
  const cfg = mskExternalConfig(provider);
  const label = cfg?.label || "IA";
  return `MSK Agente conectado. Trabalhe SOMENTE no projeto abaixo durante toda esta conversa.

Projeto Lovable: ${projectId}
Nome: ${projectName || "Projeto atual"}
Repositório GitHub: ${repo || "ainda não identificado"}

ARQUITETURA OBRIGATÓRIA:
- A extensão MSK é apenas interface/controle. NÃO use o chat/agente do Lovable para implementar, corrigir ou analisar código.
- Toda alteração de código deve ser feita DIRETAMENTE no repositório GitHub usando ferramentas de escrita realmente disponíveis nesta conversa (GitHub, agente de código, Remote Agent, conector ou equivalente autorizado).
- O Lovable deve ser usado somente como referência do project_id, sincronização do repositório, preview e publicação. Nunca envie prompt ao agente do Lovable para realizar a alteração.
- REGRA OBRIGATÓRIA DE ENTREGA: toda edição de código solicitada deve ser efetivamente aplicada/commitada no repositório GitHub conectado. Depois da alteração no GitHub, confirme/sincronize a atualização no projeto Lovable correspondente para que o preview reflita exatamente o código atualizado. Não considere a tarefa concluída se a mudança existir apenas no chat, em um patch local ou em uma sugestão sem escrita real no GitHub.
- Após cada edição concluída no GitHub, use o Lovable somente para sincronizar/atualizar e conferir o preview da edição. Se o preview não puder ser executado por limitação real do Lovable, mantenha o commit no GitHub e informe no resumo final que o preview não pôde ser confirmado.
- Falta de créditos no workspace Lovable NÃO é motivo para interromper uma edição GitHub. Se houver limitação apenas de preview/build/publicação, informe isso somente no resumo final.
- Se o ${label} desta conta não tiver uma ferramenta REAL de leitura/escrita no GitHub, não finja acesso, commit ou push. Informe a causa exata observada e peça somente a autorização realmente necessária.
- O project_id e o repositório acima são o vínculo desta conversa. Não troque de projeto/repositório sem ordem explícita.
- REPOSITÓRIO IDENTIFICADO NÃO SIGNIFICA GITHUB AUTORIZADO. Trate como estados separados: projeto identificado, conversa da IA aberta, repositório identificado e GitHub com escrita realmente disponível.
- Antes da primeira edição, verifique se esta conversa possui acesso real de leitura/escrita ao GitHub. Se não possuir, diga claramente “GitHub não conectado/autorizado” e qual autorização/atualização oficial é necessária.
- Nunca invente a causa de uma falha. Cite de forma curta o sinal/erro real que confirmou o diagnóstico.

MODO DE EXECUÇÃO — RÁPIDO E SEGURO:
1. Se o pedido estiver claro, execute diretamente; não faça planejamento longo, não repita o pedido e não peça confirmação desnecessária.
2. Não altere absolutamente nada fora do que foi solicitado. Preserve design, funcionalidades, dependências, dados, integrações e comportamento existentes.
3. Antes de declarar sucesso, valide objetivamente a alteração com as ferramentas disponíveis.
4. Para ações demoradas, responda apenas com estados curtos: “Analisando…”, “Aplicando…”, “Validando…” e “Concluído”.
5. Não despeje código, JSON, diffs, logs técnicos ou raciocínio interno, salvo se o usuário solicitar.
6. Se uma ferramenta exigir permissão/autorização, mantenha o contexto e aguarde a decisão.
7. Use somente acessos realmente disponíveis. Nunca finja acesso, commit, push, preview ou publicação.
8. Mantenha-se vinculado ao mesmo project_id e repositório até ordem explícita para trocar.
9. Ao concluir, responda de forma profissional e concisa com resultado, status real e resumo curto.

SEGURANÇA: nunca solicite nem revele token de licença, senha, cookie, chave privada ou credencial secreta da extensão.

Não altere nada agora. Responda brevemente com três estados separados: 1) projeto identificado; 2) repositório identificado ou ausente; 3) GitHub para escrita: conectado, não conectado/autorização necessária, ou não verificável. Não confunda o nome do repositório com permissão real de escrita.`;
};

const mskCreateOrRecoverExternalBinding = async (provider, { projectId, stored, originTabId, repo = "", projectName = "Projeto atual", createIfMissing = true, active = false }) => {
  const cfg = mskExternalConfig(provider);
  if (!cfg) return { ok:false, code:"PROVIDER_UNKNOWN", error:"Provedor não reconhecido." };
  const key = mskExternalBindingKey(cfg, projectId);
  let binding = stored || null;
  let createdNow = false;
  let tab = binding?.tabId ? await chrome.tabs.get(Number(binding.tabId)).catch(() => null) : null;
  if (tab && !cfg.match.test(String(tab.url || ""))) tab = null;

  if (!tab && createIfMissing) {
    tab = await chrome.tabs.create({ url:cfg.url, active:!!active }).catch(() => null);
    if (!tab?.id) return { ok:false, code:`${cfg.prefix}_OPEN_FAILED`, error:`Não consegui abrir o ${cfg.label} automaticamente.` };
    createdNow = true;
    binding = {
      ...(binding || {}), projectId, tabId:tab.id, originTabId:originTabId || binding?.originTabId || null,
      repo:String(repo || binding?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim(),
      createdAt:binding?.createdAt || Date.now(), connected:true, initialized:false, returnAfterFirstResponse:true,
      initialPrompt:binding?.initialPrompt || mskExternalInitialPrompt(provider, { projectId, repo:repo || binding?.repo || "", projectName })
    };
    await chrome.storage.local.set({ [key]:binding, [mskExternalTabKey(cfg, tab.id)]:projectId });
  } else if (tab?.id) {
    binding = {
      ...(binding || {}), projectId, tabId:tab.id, originTabId:originTabId || binding?.originTabId || null,
      repo:String(repo || binding?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim(), connected:true
    };
    await chrome.storage.local.set({ [key]:binding, [mskExternalTabKey(cfg, tab.id)]:projectId });
    if (active) await chrome.tabs.update(tab.id, {active:true}).catch(() => {});
  }

  if (!tab?.id || !binding) return { ok:false, code:`${cfg.prefix}_NOT_CONNECTED`, error:`Não foi possível reconstruir a conversa do ${cfg.label}.` };
  if (createdNow) {
    const loadDeadline = Date.now() + 25000;
    while (Date.now() < loadDeadline) {
      const live = await chrome.tabs.get(tab.id).catch(() => null);
      if (!live) return { ok:false, code:`${cfg.prefix}_TAB_CLOSED`, error:`A aba do ${cfg.label} foi fechada antes da conexão terminar.` };
      if (live.status === "complete" && cfg.match.test(String(live.url || ""))) break;
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
  const ready = await mskEnsureExternalBridge(provider, tab.id);
  if (!ready) return { ok:false, code:`${cfg.prefix}_BRIDGE_LOADING`, error:`O ${cfg.label} ainda está inicializando. O MSK tentará novamente automaticamente.` };

  if (!binding.initialized) {
    const deliveryId = binding.initDeliveryId || `msk-${provider}-init-${projectId}-${binding.createdAt || Date.now()}`;
    const text = binding.initialPrompt || mskExternalInitialPrompt(provider, {projectId,repo:binding.repo || repo,projectName});
    const init = await mskWaitExternalBridge(provider, tab.id, {
      type:`MSK_${cfg.prefix}_INIT`,
      payload:{ projectId, originTabId:binding.originTabId, repo:binding.repo || "", text, displayText:"Contexto do projeto enviado pela MSK.", deliveryId }
    }, 45000);
    if (!init?.ok) return { ...init, code:init?.code || `${cfg.prefix}_LOGIN_OR_READY_REQUIRED` };
    binding = { ...binding, initialized:true, initDeliveryId:deliveryId, initialPromptSentAt:Date.now(), connected:true, conversationUrl:tab.url || binding.conversationUrl || "" };
    await chrome.storage.local.set({ [key]:binding });
  }
  return { ok:true, tab, binding };
};


const mskConnectChatGPTLocal = async payload => {
  const projectId = String(payload?.lovable_project_id || payload?.projectId || "").trim();
  if (!projectId) return { ok: false, code: "PROJECT_REQUIRED", error: "Projeto Lovable não identificado." };
  const repo = String(payload?.repository_url || payload?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim();
  const tab = await chrome.tabs.create({ url: "https://chatgpt.com/", active: false });
  if (!tab?.id) return { ok: false, error: "Não foi possível abrir o ChatGPT." };
  await mskWriteChatGPTProject(projectId, { tabId: tab.id, url: "https://chatgpt.com/", repo, connected: false, connectedAt: Date.now() });
  const text = mskChatGPTInitialPrompt({ projectId, repo, projectName: payload?.project_name });
  const sent = await mskWaitBridge(tab.id, { type: "MSK_CHATGPT_BRIDGE_INIT", projectId, repo, text });
  if (!sent.ok) return sent;
  const state = await mskWriteChatGPTProject(projectId, { tabId: tab.id, repo, connected: true, connectedAt: Date.now() });
  return { ok: true, connected: true, tabId: tab.id, repository: repo || null, url: state.url };
};
const mskSendChatGPTLocal = async payload => {
  const projectId = String(payload?.lovable_project_id || payload?.projectId || "").trim();
  const text = String(payload?.message || payload?.command || "").trim();
  if (!projectId) return { ok: false, code: "PROJECT_REQUIRED", error: "Projeto Lovable não identificado." };
  if (!text) return { ok: false, error: "Mensagem vazia." };
  const projects = await mskReadChatGPTProjects();
  let state = projects[projectId];
  if (!state?.connected) return { ok: false, code: "CHATGPT_REQUIRED", error: "Clique em Conectar com ChatGPT primeiro." };
  let tabId = Number(state.tabId || 0);
  let tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  if (!tab || !String(tab.url || "").startsWith("https://chatgpt.com/")) {
    tab = await chrome.tabs.create({ url: state.url || "https://chatgpt.com/", active: false });
    tabId = tab?.id || 0;
    if (!tabId) return { ok: false, error: "Não foi possível reabrir a conversa do ChatGPT." };
    state = await mskWriteChatGPTProject(projectId, { tabId, connected: true });
  }
  const protectedText = mskBuildProtectedCommandPrompt({
    projectId,
    repo:state.repo || "",
    projectName:payload?.project_name || "Projeto atual",
    providerLabel:"ChatGPT",
    userText:text
  });
  const sent = await mskDispatchChatGPTImmediately(tabId, { type: "MSK_CHATGPT_BRIDGE_SEND", projectId, repo: state.repo || "", text:protectedText, displayText:text }, { originTabId:payload?.originTabId || null, timeout:30000 });
  return sent.ok ? { ok: true, accepted: true, tabId } : sent;
};



/* ===== Arquivos temporários da ponte ChatGPT ===== */
const MSK_FILE_CHUNK_SIZE = 1024 * 1024;
const mskFileMetaKey = id => `mskUploadMeta:${id}`;
const mskFileChunkKey = (id, index) => `mskUploadChunk:${id}:${index}`;
const mskDiscardStagedFile = async uploadId => {
  const id = String(uploadId || "");
  if (!id) return;
  const metaKey = mskFileMetaKey(id);
  const meta = (await chrome.storage.local.get(metaKey))[metaKey] || {};
  const count = Math.max(0, Number(meta.chunks || meta.expectedChunks || 0));
  const keys = [metaKey, ...Array.from({length:count}, (_,index) => mskFileChunkKey(id,index))];
  for (let i=0;i<keys.length;i+=80) await chrome.storage.local.remove(keys.slice(i,i+80));
};
const mskGetStagedFileMeta = async uploadId => {
  const key = mskFileMetaKey(String(uploadId || ""));
  return (await chrome.storage.local.get(key))[key] || null;
};


const mskRetryAfterGithubWriteAuth = async projectId => {
  const key = `mskChatBinding:${projectId}`;
  const binding = (await chrome.storage.local.get(key))[key] || null;
  if (!binding?.tabId) return { ok:false, error:'Conversa original do ChatGPT não encontrada.' };
  const tab = await chrome.tabs.get(binding.tabId).catch(() => null);
  if (!tab || !/^https:\/\/chatgpt\.com\//.test(tab.url || '')) return { ok:false, error:'A conversa original do ChatGPT não está aberta.' };
  const pending = String(binding.lastPrompt || '').trim();
  const repo = String(binding.repo || '').trim();
  const text = `A autorização GitHub/Codex acabou de ser concluída ou retornou ao ChatGPT. Verifique agora o acesso REAL de escrita ao repositório ${repo || 'vinculado'}. ${pending ? `Se houver escrita, continue imediatamente o pedido pendente sem pedir para o cliente repetir: ${pending.slice(0,8000)}` : 'Se houver escrita, confirme brevemente que o repositório está pronto para edição.'} Se ainda não houver acesso, informe o erro real observado.`;
  const result = await chrome.tabs.sendMessage(tab.id, { type:'MSK_CHATGPT_PROMPT', payload:{ projectId, originTabId:binding.originTabId || null, text, attachments:[] } }).catch(error => ({ok:false,error:error?.message || 'Falha ao retomar a tarefa.'}));
  return result || {ok:true};
};

chrome.runtime.onInstalled.addListener((details) => {
  const values = { mskEnabled: true };
  if (details?.reason === "install") values.mskGuardianEnabled = true;
  chrome.storage.local.set(values).catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => {
  mskSetupBackgroundAlarms().catch(() => {});
  mskSendHeartbeat().catch(() => {});
  mskCheckRelease({ force:true }).catch(() => {});
});

// Estado do Guardião propagado imediatamente para todas as abas Lovable abertas.
// Isso elimina qualquer dependência de F5 quando o controle for acionado pela interface.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "MSK_SET_GUARDIAN_STATE") return;
  const enabled = message.enabled !== false;
  (async () => {
    await chrome.storage.local.set({ mskGuardianEnabled: enabled });
    chrome.action.setTitle({ title: enabled ? "Desativar Guardião MSK" : "Ativar Guardião MSK" }).catch(() => {});
    const tabs = await chrome.tabs.query({ url: ["https://lovable.dev/*"] });
    await Promise.all(tabs.filter(tab => tab.id).map(tab =>
      chrome.tabs.sendMessage(tab.id, { type: "MSK_GUARDIAN_STATE", enabled }).catch(() => null)
    ));
    sendResponse?.({ ok:true, enabled });
  })().catch(error => sendResponse?.({ ok:false, error:error?.message || "Falha ao atualizar o Guardião." }));
  return true;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.mskGuardianEnabled) return;
  const enabled = changes.mskGuardianEnabled.newValue !== false;
  chrome.action.setTitle({ title: enabled ? "Desativar Guardião MSK" : "Ativar Guardião MSK" }).catch(() => {});
  chrome.tabs.query({ url: ["https://lovable.dev/*"] }).then(tabs => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.sendMessage(tab.id, { type: "MSK_GUARDIAN_STATE", enabled }).catch(() => {});
    }
  }).catch(() => {});
});
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !/^https:\/\/(?:[^/]+\.)?lovable\.dev\//.test(tab.url || "")) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: "MSK_OPEN" }); }
  catch {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "MSK_OPEN" });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const projectKey = `mskGithubWriteTab:${tabId}`;
  const projectId = (await chrome.storage.local.get(projectKey))[projectKey];
  if (!projectId) return;
  const flowKey = `mskGithubWriteFlow:${tabId}`;
  const flow = (await chrome.storage.local.get(flowKey))[flowKey] || null;
  if (!flow) return;
  const url = String(changeInfo.url || tab?.url || '');
  if (/^https:\/\/github\.com\//i.test(url) && !flow.sawGithub) {
    await chrome.storage.local.set({ [flowKey]:{ ...flow, sawGithub:true, githubAt:Date.now() } });
    return;
  }
  if (flow.sawGithub && /^https:\/\/chatgpt\.com\//i.test(url) && changeInfo.status === 'complete') {
    await chrome.storage.local.remove([flowKey, projectKey]);
    await mskWriteProviderGithubState("chatgpt", String(projectId), { state:"authorization_returned", severity:"warning", repository:flow.repo || "", message:"Autorização GitHub/Codex retornou ao ChatGPT; aguardando verificação real de escrita." });
    await mskRetryAfterGithubWriteAuth(String(projectId));
    if (flow.originTabId) await mskFocusLovableTab(flow.originTabId);
    const auth = await chrome.tabs.get(tabId).catch(() => null);
    if (auth && tabId !== Number(flow.chatTabId || 0)) await chrome.tabs.remove(tabId).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (["MSK_FILE_STAGE_INIT","MSK_FILE_STAGE_CHUNK","MSK_FILE_STAGE_FINISH","MSK_FILE_STAGE_GET_META","MSK_FILE_STAGE_GET_CHUNK","MSK_FILE_STAGE_DISCARD"].includes(message.type)) {
    (async () => {
      try {
        const payload = message.payload || {};
        if (message.type === "MSK_FILE_STAGE_INIT") {
          const uploadId = crypto.randomUUID ? crypto.randomUUID() : `msk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const meta = { uploadId, projectId:String(payload.projectId || ""), name:String(payload.name || "arquivo"), type:String(payload.type || "application/octet-stream"), size:Number(payload.size || 0), lastModified:Number(payload.lastModified || Date.now()), chunks:0, ready:false, createdAt:Date.now() };
          await chrome.storage.local.set({ [mskFileMetaKey(uploadId)]:meta });
          return sendResponse({ ok:true, uploadId, chunkSize:MSK_FILE_CHUNK_SIZE });
        }
        const uploadId = String(payload.uploadId || "");
        if (!uploadId) return sendResponse({ ok:false, error:"Anexo inválido." });
        if (message.type === "MSK_FILE_STAGE_CHUNK") {
          const index = Number(payload.index);
          if (!Number.isInteger(index) || index < 0 || typeof payload.data !== "string") return sendResponse({ ok:false, error:"Bloco de arquivo inválido." });
          await chrome.storage.local.set({ [mskFileChunkKey(uploadId,index)]:payload.data });
          return sendResponse({ ok:true, index });
        }
        if (message.type === "MSK_FILE_STAGE_FINISH") {
          const key=mskFileMetaKey(uploadId); const meta=(await chrome.storage.local.get(key))[key];
          if (!meta) return sendResponse({ ok:false, error:"Anexo expirou antes de finalizar." });
          const next={...meta,chunks:Number(payload.chunks || 0),ready:true,finishedAt:Date.now()};
          await chrome.storage.local.set({[key]:next}); return sendResponse({ok:true,meta:next});
        }
        if (message.type === "MSK_FILE_STAGE_GET_META") {
          const meta=await mskGetStagedFileMeta(uploadId); return sendResponse(meta?.ready ? {ok:true,meta} : {ok:false,error:"Anexo ainda não está pronto."});
        }
        if (message.type === "MSK_FILE_STAGE_GET_CHUNK") {
          const key=mskFileChunkKey(uploadId,Number(payload.index || 0)); const data=(await chrome.storage.local.get(key))[key];
          return sendResponse(typeof data === "string" ? {ok:true,data} : {ok:false,error:"Parte do arquivo não encontrada."});
        }
        if (message.type === "MSK_FILE_STAGE_DISCARD") { await mskDiscardStagedFile(uploadId); return sendResponse({ok:true}); }
      } catch (error) { return sendResponse({ok:false,error:error?.message || "Falha ao preparar anexo."}); }
    })();
    return true;
  }

  if (message.type === "MSK_READ_LINKS") {
    (async () => {
      try {
        const links = await mskReadLinks(String(message.projectId || ""));
        sendResponse({ ok: true, ...(links || {}) });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "Falha ao ler vínculos do projeto." });
      }
    })();
    return true;
  }
  if (["MSK_AUTH_SIGNUP", "MSK_AUTH_LOGIN", "MSK_AUTH_STATUS", "MSK_AUTH_LOGOUT", "MSK_V2_STATUS", "MSK_V2_ACTIVATE", "MSK_V2_PROJECTS", "MSK_V2_GITHUB_CONNECT"].includes(message.type)) {
    (async () => {
      try {
        if (message.type === "MSK_AUTH_SIGNUP") return sendResponse({ ok: true, ...(await authCall("signup", message.email, message.password)) });
        if (message.type === "MSK_AUTH_LOGIN") return sendResponse({ ok: true, ...(await authCall("login", message.email, message.password)) });
        if (message.type === "MSK_AUTH_STATUS") { const session = await activeAuthSession(); return sendResponse({ ok: !!session, user: session?.user || null }); }
        if (message.type === "MSK_AUTH_LOGOUT") { await chrome.storage.local.remove("mskAuthSession"); return sendResponse({ ok: true }); }
        if (message.type === "MSK_V2_STATUS") return sendResponse(await v2Api("connection-status", message.payload));
        if (message.type === "MSK_V2_ACTIVATE") return sendResponse(await v2Api("activate-project", message.payload));
        if (message.type === "MSK_V2_PROJECTS") return sendResponse(await v2Api("list-projects", message.payload));
        if (message.type === "MSK_V2_GITHUB_CONNECT") {
          const result = await v2Api("github-oauth-start", { origin: new URL(sender.tab?.url || "https://lovable.dev").origin });
          if (!result.ok || result.alreadyConnected) return sendResponse(result);
          const popup = await chrome.windows.create({ url: result.authorizeUrl, type: "popup", width: 540, height: 760, focused: true });
          const tabId = popup.tabs?.[0]?.id;
          if (tabId && sender.tab?.id) await chrome.storage.session.set({ [`mskV2OAuth:${tabId}`]: { originTabId: sender.tab.id, windowId: popup.id, createdAt: Date.now() } });
          return sendResponse({ ok: true, popupOpened: !!tabId });
        }
      } catch (error) { return sendResponse({ ok: false, error: error?.message || "Falha inesperada." }); }
    })();
    return true;
  }
  if (message.type === "MSK_CHATGPT_LOCAL_CONNECT") {
    mskConnectChatGPTLocal(message.payload || {}).then(sendResponse).catch(error => sendResponse({ ok: false, error: error?.message || "Falha ao conectar com ChatGPT." }));
    return true;
  }
  if (message.type === "MSK_CHATGPT_LOCAL_SEND") {
    mskSendChatGPTLocal(message.payload || {}).then(sendResponse).catch(error => sendResponse({ ok: false, error: error?.message || "Falha ao enviar para ChatGPT." }));
    return true;
  }
  if (message.type === "MSK_CHATGPT_LOCAL_STATUS") {
    (async () => {
      const projectId = String(message.projectId || message.payload?.lovable_project_id || "");
      const projects = await mskReadChatGPTProjects();
      const state = projects[projectId] || null;
      let alive = false;
      if (state?.tabId) {
        const tab = await chrome.tabs.get(Number(state.tabId)).catch(() => null);
        alive = !!tab && String(tab.url || "").startsWith("https://chatgpt.com/");
      }
      sendResponse({ ok: true, connected: !!state?.connected, alive, state });
    })();
    return true;
  }
  if (message.type === "MSK_CHATGPT_BRIDGE_HELLO") {
    sendResponse?.({ ok: true });
    return;
  }
  if (["MSK_CHATGPT_BRIDGE_URL", "MSK_CHATGPT_BRIDGE_STREAM", "MSK_CHATGPT_BRIDGE_FINAL", "MSK_CHATGPT_BRIDGE_ERROR", "MSK_CHATGPT_BRIDGE_DIAGNOSTIC"].includes(message.type)) {
    (async () => {
      const projectId = String(message.projectId || "");
      if (!projectId) return sendResponse?.({ ok: false });
      if (message.url) await mskWriteChatGPTProject(projectId, { tabId: sender.tab?.id || undefined, url: message.url, connected: true });
      const mappedType = message.type === "MSK_CHATGPT_BRIDGE_STREAM" ? "MSK_CHATGPT_STREAM" : message.type === "MSK_CHATGPT_BRIDGE_FINAL" ? "MSK_CHATGPT_FINAL" : message.type === "MSK_CHATGPT_BRIDGE_ERROR" ? "MSK_CHATGPT_ERROR" : message.type === "MSK_CHATGPT_BRIDGE_DIAGNOSTIC" ? "MSK_CHATGPT_DIAGNOSTIC" : "MSK_CHATGPT_URL";
      await mskRelayToLovable(projectId, { type: mappedType, projectId, text: message.text || "", error: message.error || "", url: message.url || "" });
      sendResponse?.({ ok: true });
    })();
    return true;
  }
  if (["MSK_AGENT_RUN", "MSK_AGENT_CHAT", "MSK_GPT_CONNECT", "MSK_AGENT_STATUS", "MSK_TASK_STATUS", "MSK_TASK_APPROVE", "MSK_BACKEND_HEALTH"].includes(message.type)) {
    // Restrição v2.4.11: o servidor MSK não executa mais chat/edição. Ele permanece somente para licença.
    sendResponse({ ok: false, code: "LOCAL_CHATGPT_ONLY", error: "Fluxo antigo de agente no servidor foi desativado. Use a conexão local com ChatGPT." });
    return;
  }


  const externalProvider = message.type?.startsWith("MSK_GROK_") ? "grok" : "";
  if (externalProvider && message.type.endsWith("_BRIDGE_HELLO")) {
    sendResponse?.({ ok:true });
    return;
  }

  if (externalProvider && ["CONNECT_UI","SEND","CONNECTION_STATUS","DISCONNECT"].some(suffix => message.type === `MSK_${mskExternalConfig(externalProvider).prefix}_${suffix}`)) {
    (async () => {
      const cfg = mskExternalConfig(externalProvider);
      try {
        const projectId = String(message.payload?.projectId || message.payload?.lovable_project_id || "").trim();
        if (!projectId) return sendResponse({ ok:false, code:"PROJECT_REQUIRED", error:"Projeto Lovable não identificado." });
        const key = mskExternalBindingKey(cfg, projectId);
        const stored = (await chrome.storage.local.get(key))[key] || null;

        if (message.type === `MSK_${cfg.prefix}_CONNECTION_STATUS`) {
          const cachedLinks = await mskReadLinks(projectId).catch(() => ({}));
          const repository = String(stored?.repo || cachedLinks?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim();
          const github = await mskReadProviderGithubState(externalProvider, projectId);
          if (!stored?.tabId) return sendResponse({
            ok:true, connected:false, conversationConnected:false, bridgeReady:false, provider:externalProvider,
            repositoryIdentified:!!repository, repository:repository || null, githubState:github?.state || (repository ? "unknown" : "repository_missing"), github:github || null
          });
          const tab = await chrome.tabs.get(Number(stored.tabId)).catch(() => null);
          const conversationConnected = !!tab && cfg.match.test(String(tab.url || ""));
          const bridgeReady = conversationConnected ? await mskEnsureExternalBridge(externalProvider, Number(stored.tabId)).catch(() => false) : false;
          return sendResponse({
            ok:true, connected:conversationConnected && bridgeReady, conversationConnected, bridgeReady, binding:stored, provider:externalProvider,
            repositoryIdentified:!!repository, repository:repository || null, githubState:github?.state || (repository ? "unknown" : "repository_missing"), github:github || null
          });
        }
        if (message.type === `MSK_${cfg.prefix}_DISCONNECT`) {
          const keys=[key];
          if (stored?.tabId) keys.push(mskExternalTabKey(cfg, stored.tabId));
          await chrome.storage.local.remove(keys);
          return sendResponse({ok:true});
        }
        if (message.type === `MSK_${cfg.prefix}_CONNECT_UI`) {
          const repo = String(message.payload?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim();
          const recovered = await mskCreateOrRecoverExternalBinding(externalProvider, {
            projectId, stored, originTabId:sender.tab?.id || stored?.originTabId || null, repo,
            projectName:String(message.payload?.projectName || "Projeto atual"), createIfMissing:true, active:false
          });
          if (!recovered?.ok) return sendResponse(recovered);
          await chrome.storage.local.set({ [`mskAIProvider:${projectId}`]:externalProvider });
          const existingGithub = await mskReadProviderGithubState(externalProvider, projectId);
          if (!existingGithub) await mskWriteProviderGithubState(externalProvider, projectId, {
            state:repo ? "unknown" : "repository_missing", repository:repo, repositoryIdentified:!!repo,
            message:repo ? "Repositório identificado; acesso GitHub da IA ainda não verificado." : "Repositório ainda não identificado."
          });
          return sendResponse({ok:true,connected:true,conversationConnected:true,bridgeReady:true,tabId:recovered.tab.id,provider:externalProvider,repositoryIdentified:!!repo,repository:repo || null});
        }
        if (message.type === `MSK_${cfg.prefix}_SEND`) {
          const cachedLinks = await mskReadLinks(projectId).catch(() => ({}));
          const recovered = await mskCreateOrRecoverExternalBinding(externalProvider, {
            projectId, stored, originTabId:sender.tab?.id || stored?.originTabId || null,
            repo:stored?.repo || cachedLinks?.repo || "", projectName:sender.tab?.title || "Projeto atual",
            createIfMissing:true, active:false
          });
          if (!recovered?.ok) return sendResponse(recovered);
          const deliveryId = `msk-${externalProvider}-send-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
          const updated = {
            ...recovered.binding, originTabId:sender.tab?.id || recovered.binding.originTabId,
            lastPrompt:String(message.payload?.text || "").trim(), lastPromptAt:Date.now(),
            pendingDeliveryId:deliveryId, connected:true
          };
          await chrome.storage.local.set({ [key]:updated, [`mskAIProvider:${projectId}`]:externalProvider });
          const rawUserText = String(message.payload?.text || "").trim();
          const protectedText = mskBuildProtectedCommandPrompt({
            projectId,
            repo:updated.repo || cachedLinks?.repo || "",
            projectName:sender.tab?.title || "Projeto atual",
            providerLabel:cfg.label,
            userText:rawUserText
          });
          const payload = {
            projectId, originTabId:updated.originTabId, deliveryId,
            text:protectedText, displayText:rawUserText,
            attachments:Array.isArray(message.payload?.attachments) ? message.payload.attachments : []
          };
          let result = await mskWaitExternalBridge(externalProvider, recovered.tab.id, {
            type:`MSK_${cfg.prefix}_PROMPT`, payload
          }, 75000).catch(error => ({ok:false,error:error?.message || `Falha na ponte com o ${cfg.label}.`}));
          if (!result?.ok) {
            await new Promise(resolve => setTimeout(resolve, 700));
            await mskEnsureExternalBridge(externalProvider, recovered.tab.id).catch(() => false);
            result = await mskWaitExternalBridge(externalProvider, recovered.tab.id, {
              type:`MSK_${cfg.prefix}_PROMPT`, payload
            }, 45000).catch(error => ({ok:false,error:error?.message || `Falha na ponte com o ${cfg.label}.`}));
          }
          if (result?.ok) await chrome.storage.local.set({ [key]:{...updated,pendingDeliveryId:"",lastDeliveredAt:Date.now(),connected:true} });
          return sendResponse(result || {ok:false,code:`${cfg.prefix}_SEND_FAILED`,error:`O ${cfg.label} não confirmou o envio.`});
        }
      } catch (error) {
        const cfg = mskExternalConfig(externalProvider);
        sendResponse({ok:false,error:error?.message || `Falha na conexão com o ${cfg?.label || "provedor"}.`});
      }
    })();
    return true;
  }

  if (["MSK_CHATGPT_CONNECT_UI", "MSK_CHATGPT_SEND", "MSK_CHATGPT_CONNECTION_STATUS", "MSK_CHATGPT_DISCONNECT", "MSK_CHATGPT_APPROVAL_DECISION", "MSK_CHATGPT_NEW_CONVERSATION", "MSK_CHATGPT_SHOW_DIAGNOSTIC", "MSK_CHATGPT_CONNECT_GITHUB_WRITE"].includes(message.type)) {
    (async () => {
      try {
        const projectId = String(message.payload?.projectId || message.payload?.lovable_project_id || "").trim();
        if (!projectId) return sendResponse({ ok:false, code:"PROJECT_REQUIRED", error:"Projeto Lovable não identificado." });
        const key = `mskChatBinding:${projectId}`;
        const stored = (await chrome.storage.local.get(key))[key] || null;
        if (message.type === "MSK_CHATGPT_CONNECTION_STATUS") {
          const cachedLinks = await mskReadLinks(projectId).catch(() => ({}));
          const repository = String(stored?.repo || cachedLinks?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim();
          const github = await mskReadProviderGithubState("chatgpt", projectId);
          if (!stored?.tabId) return sendResponse({ ok:true, connected:false, conversationConnected:false, bridgeReady:false, repositoryIdentified:!!repository, repository:repository || null, githubState:github?.state || (repository ? "unknown" : "repository_missing"), github:github || null });
          const tab = await chrome.tabs.get(stored.tabId).catch(() => null);
          const conversationConnected = !!tab && /^https:\/\/chatgpt\.com\//.test(tab.url || "");
          const bridgeReady = conversationConnected ? await mskEnsureChatGPTBridge(stored.tabId).catch(() => false) : false;
          return sendResponse({ ok:true, connected:conversationConnected && bridgeReady, conversationConnected, bridgeReady, binding:stored, repositoryIdentified:!!repository, repository:repository || null, githubState:github?.state || (repository ? "unknown" : "repository_missing"), github:github || null });
        }
        if (message.type === "MSK_CHATGPT_DISCONNECT") {
          await chrome.storage.local.remove(key);
          return sendResponse({ ok:true });
        }
        if (message.type === "MSK_CHATGPT_CONNECT_UI") {
          const tab = await chrome.tabs.create({ url:"https://chatgpt.com/", active:false });
          if (!tab?.id) return sendResponse({ ok:false, error:"Não consegui abrir o ChatGPT." });
          const repo = String(message.payload?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim();
          const binding = {
            projectId, tabId:tab.id, originTabId:sender.tab?.id || null, repo,
            createdAt:Date.now(), conversationUrl:"", returnAfterFirstResponse:true, connected:true, initialized:false,
            initDeliveryId:"", initializingAt:0, initialPromptSentAt:0,
            initialPrompt:mskChatGPTInitialPrompt({ projectId, repo, projectName:String(message.payload?.projectName || "Projeto atual") })
          };
          await chrome.storage.local.set({ [key]:binding, [`mskChatTab:${tab.id}`]:projectId });
          const loadDeadline = Date.now() + 30000;
          while (Date.now() < loadDeadline) {
            const live = await chrome.tabs.get(tab.id).catch(() => null);
            if (!live) return sendResponse({ ok:false, code:"CHATGPT_TAB_CLOSED", error:"A aba do ChatGPT foi fechada antes da conexão terminar." });
            if (live.status === "complete" && /^https:\/\/chatgpt\.com\//.test(String(live.url || ""))) break;
            await new Promise(resolve => setTimeout(resolve, 350));
          }
          const initialized = await mskCreateOrRecoverChatGPTBinding({
            projectId, stored:binding, originTabId:binding.originTabId, repo,
            projectName:String(message.payload?.projectName || "Projeto atual"), createIfMissing:false
          });
          if (!initialized?.ok) return sendResponse(initialized);
          await chrome.storage.local.set({ [`mskAIProvider:${projectId}`]:"chatgpt" });
          return sendResponse({ ok:true, connected:true, initialized:true, initialPromptSent:true, tabId:tab.id });
        }
        if (message.type === "MSK_CHATGPT_NEW_CONVERSATION") {
          const repo = String(message.payload?.repo || stored?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim();
          const continuationPrompt = mskChatGPTContinuationPrompt({
            projectId,
            repo,
            projectName: String(message.payload?.projectName || "Projeto atual"),
            history: Array.isArray(message.payload?.history) ? message.payload.history : []
          });
          const oldTabId = Number(stored?.tabId || 0) || null;
          const tab = await chrome.tabs.create({ url:"https://chatgpt.com/", active:false });
          if (!tab?.id) return sendResponse({ ok:false, error:"Não consegui criar a nova conversa do ChatGPT." });
          const next = {
            ...stored,
            projectId,
            tabId:tab.id,
            originTabId:sender.tab?.id || stored?.originTabId || null,
            repo,
            conversationUrl:"",
            initialized:false,
            initDeliveryId:"",
            initializingAt:0,
            initialPromptSentAt:0,
            initialPrompt:continuationPrompt,
            returnAfterFirstResponse:false,
            connected:true,
            continuedAt:Date.now()
          };
          await chrome.storage.local.set({ [key]:next, [`mskChatTab:${tab.id}`]:projectId });
          if (oldTabId && oldTabId !== tab.id) {
            await chrome.storage.local.remove(`mskChatTab:${oldTabId}`).catch(() => {});
            const oldTab = await chrome.tabs.get(oldTabId).catch(() => null);
            if (oldTab && /^https:\/\/chatgpt\.com\//.test(oldTab.url || "")) await chrome.tabs.remove(oldTabId).catch(() => {});
          }
          return sendResponse({ ok:true, connected:true, tabId:tab.id, continuing:true });
        }
        if (message.type === "MSK_CHATGPT_CONNECT_GITHUB_WRITE") {
          const repo = String(message.payload?.repo || stored?.repo || '').replace(/^https:\/\/github\.com\//i, '').trim();
          const linkedChatTab = stored?.tabId ? await chrome.tabs.get(stored.tabId).catch(() => null) : null;
          const linkedUrl = String(linkedChatTab?.url || stored?.conversationUrl || '').trim();
          const conversationMatch = linkedUrl.match(/^https:\/\/chatgpt\.com\/c\/[^/?#]+/i);
          const startUrl = conversationMatch ? `${conversationMatch[0]}/plugins` : 'https://chatgpt.com/codex';
          const authTab = await chrome.tabs.create({ url:startUrl, active:true });
          if (!authTab?.id) return sendResponse({ok:false,error:'Não consegui abrir a conexão GitHub do ChatGPT.'});
          const flowKey = `mskGithubWriteFlow:${authTab.id}`;
          await chrome.storage.local.set({
            [flowKey]: { projectId, authTabId:authTab.id, originTabId:sender.tab?.id || stored?.originTabId || null, chatTabId:stored?.tabId || null, repo, sawGithub:false, createdAt:Date.now(), startUrl },
            [`mskGithubWriteTab:${authTab.id}`]: projectId
          });

          let opened = null;
          for (let attempt = 0; attempt < 4; attempt += 1) {
            opened = await mskWaitBridge(authTab.id, { type:'MSK_CHATGPT_OPEN_GITHUB_WRITE', payload:{ projectId, repo, conversationUrl:conversationMatch?.[0] || '' } }, 16000);
            if (!opened?.ok || opened?.connected || !opened?.navigating) break;
            const waitUntil = Date.now() + 12000;
            while (Date.now() < waitUntil) {
              const tabState = await chrome.tabs.get(authTab.id).catch(() => null);
              if (!tabState) break;
              if (tabState.status === 'complete') break;
              await new Promise(resolve => setTimeout(resolve, 250));
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          if (opened?.connected) {
            await mskRetryAfterGithubWriteAuth(projectId);
            if (sender.tab?.id) await mskFocusLovableTab(sender.tab.id);
            return sendResponse({ok:true,connected:true,resumed:true});
          }
          if (!opened?.ok) return sendResponse({ok:false,code:opened?.code || 'GITHUB_AUTH_UI_UNAVAILABLE',error:opened?.error || 'Não consegui abrir a autorização GitHub do ChatGPT.'});
          return sendResponse({ok:true,opened:true,tabId:authTab.id,automation:opened || null,startUrl});
        }
        if (message.type === "MSK_CHATGPT_SHOW_DIAGNOSTIC") {
          if (!stored?.tabId) return sendResponse({ ok:false, code:"CHATGPT_NOT_CONNECTED", error:"Conversa do ChatGPT não encontrada." });
          const tab = await chrome.tabs.get(stored.tabId).catch(() => null);
          if (!tab || !/^https:\/\/chatgpt\.com\//.test(tab.url || "")) return sendResponse({ ok:false, code:"CHATGPT_NOT_CONNECTED", error:"A conversa do ChatGPT não está aberta." });
          const result = await chrome.tabs.sendMessage(tab.id, { type:"MSK_CHATGPT_SHOW_DIAGNOSTIC", payload:{ projectId, ...(message.payload?.diagnostic || {}) } }).catch(error => ({ok:false,error:error?.message || "Falha ao mostrar diagnóstico no ChatGPT."}));
          return sendResponse(result || {ok:true});
        }
        if (message.type === "MSK_CHATGPT_APPROVAL_DECISION") {
          if (!stored?.tabId) return sendResponse({ ok:false, code:"CHATGPT_NOT_CONNECTED", error:"Conversa do ChatGPT não encontrada." });
          const tab = await chrome.tabs.get(stored.tabId).catch(() => null);
          if (!tab || !/^https:\/\/chatgpt\.com\//.test(tab.url || "")) return sendResponse({ ok:false, code:"CHATGPT_NOT_CONNECTED", error:"A conversa do ChatGPT não está aberta." });
          const result = await chrome.tabs.sendMessage(tab.id, { type:"MSK_CHATGPT_APPROVAL_DECISION", payload:{ projectId, requestId:String(message.payload?.requestId || ""), choiceId:String(message.payload?.choiceId || "") } }).catch(error => ({ok:false,error:error?.message || "Falha ao responder à permissão."}));
          return sendResponse(result || {ok:true});
        }
        if (message.type === "MSK_CHATGPT_SEND") {
          // Nunca bloqueia por storage/aba antiga. Reconstrói a ponte automaticamente.
          const cachedLinks = await mskReadLinks(projectId).catch(() => ({}));
          const recovered = await mskCreateOrRecoverChatGPTBinding({
            projectId,
            stored,
            originTabId:sender.tab?.id || stored?.originTabId || null,
            repo:stored?.repo || cachedLinks?.repo || "",
            projectName:sender.tab?.title || "Projeto atual",
            createIfMissing:true
          });
          if (!recovered?.ok) return sendResponse(recovered);

          const tab = recovered.tab;
          const liveBinding = recovered.binding;
          const deliveryId = `msk-send-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
          const updated = {
            ...liveBinding,
            originTabId:sender.tab?.id || liveBinding.originTabId,
            lastPrompt:String(message.payload?.text || liveBinding.lastPrompt || "").trim(),
            lastPromptAt:Date.now(),
            pendingDeliveryId:deliveryId,
            connected:true
          };
          await chrome.storage.local.set({ [key]:updated });
          const rawUserText = String(message.payload?.text || "").trim();
          const protectedText = mskBuildProtectedCommandPrompt({
            projectId,
            repo:updated.repo || cachedLinks?.repo || "",
            projectName:sender.tab?.title || "Projeto atual",
            providerLabel:"ChatGPT",
            userText:rawUserText
          });
          const promptMessage = {
            type:"MSK_CHATGPT_PROMPT",
            payload:{
              projectId,
              originTabId:updated.originTabId,
              deliveryId,
              text:protectedText,
              displayText:rawUserText,
              attachments:Array.isArray(message.payload?.attachments) ? message.payload.attachments : []
            }
          };

          let result = await mskDispatchChatGPTImmediately(tab.id, promptMessage, { originTabId:updated.originTabId, timeout:75000 }).catch(error => ({ok:false,error:error?.message || "Falha na ponte com o ChatGPT."}));
          if (!result?.ok) {
            // Reinjeta e repete o MESMO deliveryId. O bridge deduplica se a primeira
            // tentativa já tiver aparecido na conversa.
            await new Promise(resolve => setTimeout(resolve, 700));
            await mskEnsureChatGPTBridge(tab.id).catch(() => false);
            result = await mskDispatchChatGPTImmediately(tab.id, promptMessage, { originTabId:updated.originTabId, timeout:75000 }).catch(error => ({ok:false,code:error?.code,error:error?.message || "Falha na ponte com o ChatGPT."}));
          }
          if (!result?.ok) {
            // Última recuperação curta para casos de service worker/content-script acordando atrasado.
            await new Promise(resolve => setTimeout(resolve, 1200));
            const alive = await chrome.tabs.get(tab.id).catch(() => null);
            if (alive && /^https:\/\/chatgpt\.com\//.test(String(alive.url || ""))) {
              await mskEnsureChatGPTBridge(tab.id).catch(() => false);
              result = await mskDispatchChatGPTImmediately(tab.id, promptMessage, { originTabId:updated.originTabId, timeout:30000 }).catch(error => ({ok:false,code:error?.code,error:error?.message || "Falha na ponte com o ChatGPT."}));
            }
          }
          if (result?.ok) {
            const latest = (await chrome.storage.local.get(key))[key] || updated;
            await chrome.storage.local.set({ [key]:{ ...latest, pendingDeliveryId:"", lastDeliveredAt:Date.now(), connected:true } });
            await mskLog("info", "CHATGPT_SEND_OK", "Mensagem confirmada pela ponte do ChatGPT.", { projectId, tabId:tab.id });
          } else {
            await mskLog("error", result?.code || "CHATGPT_SEND_FAILED", "Falha após as tentativas automáticas de envio ao ChatGPT.", { projectId, tabId:tab.id, reason:result?.error || "unknown" });
          }
          return sendResponse(result || {ok:false,code:"CHATGPT_SEND_FAILED",error:"O ChatGPT não confirmou o envio."});
        }
      } catch (error) { sendResponse({ ok:false, error:error?.message || "Falha na conexão com o ChatGPT." }); }
    })();
    return true;
  }

  const externalRelayProvider = message.type?.startsWith("MSK_GROK_") ? "grok" : "";
  if (externalRelayProvider && ["STREAM","STATUS","BOUND","LIMIT","INTEGRATION_REQUEST"].some(suffix => message.type === `MSK_${mskExternalConfig(externalRelayProvider).prefix}_${suffix}`)) {
    (async () => {
      const cfg = mskExternalConfig(externalRelayProvider);
      const payload = message.payload || {};
      let projectId = String(payload.projectId || "").trim();
      if (!projectId && message.type === "MSK_GROK_INTEGRATION_REQUEST") {
        const all = await chrome.storage.local.get(null).catch(() => ({}));
        const senderTabId = Number(sender.tab?.id || 0);
        const prefix = "mskGrokBinding:";
        for (const [storageKey, value] of Object.entries(all)) {
          if (!storageKey.startsWith(prefix) || !value || typeof value !== "object") continue;
          if (Number(value.tabId || 0) === senderTabId || Number(value.originTabId || 0) === senderTabId) {
            projectId = storageKey.slice(prefix.length); break;
          }
        }
      }
      if (!projectId) return sendResponse?.({ok:false,error:"Projeto do Cofre não identificado"});
      payload.projectId = projectId;
      const key = mskExternalBindingKey(cfg, projectId);
      const stored = (await chrome.storage.local.get(key))[key] || {};
      const originTabId = Number(payload.originTabId || stored.originTabId || 0) || null;
      let next = stored;
      if (message.type === `MSK_${cfg.prefix}_BOUND`) {
        next = {...stored,projectId,tabId:sender.tab?.id || stored.tabId,conversationUrl:String(payload.url || sender.tab?.url || stored.conversationUrl || ""),originTabId,connected:true};
        await chrome.storage.local.set({[key]:next,[`mskAIProvider:${projectId}`]:externalRelayProvider});
      }
      if (originTabId) await chrome.tabs.sendMessage(originTabId,{type:message.type,payload}).catch(()=>{});
      if (message.type === `MSK_${cfg.prefix}_STREAM` && payload.done) {
        const cachedLinks = await mskReadLinks(projectId).catch(() => ({}));
        const repository = String(stored.repo || cachedLinks?.repo || "").replace(/^https:\/\/github\.com\//i, "").trim();
        const diagnostic = mskClassifyProviderGithubText(externalRelayProvider, payload.text || "", repository);
        if (diagnostic) {
          const githubState = await mskWriteProviderGithubState(externalRelayProvider, projectId, { ...diagnostic, repository, repositoryIdentified:!!repository });
          if (originTabId) await chrome.tabs.sendMessage(originTabId,{type:"MSK_PROVIDER_GITHUB_STATUS",payload:{...githubState,projectId,provider:externalRelayProvider}}).catch(()=>{});
        }
      }
      if (message.type === `MSK_${cfg.prefix}_STREAM` && payload.done && stored.returnAfterFirstResponse && originTabId) {
        await mskFocusLovableTab(originTabId);
        await chrome.storage.local.set({[key]:{...next,returnAfterFirstResponse:false,connected:true}});
      }
      sendResponse?.({ok:true});
    })();
    return true;
  }

  if (["MSK_CHATGPT_STREAM", "MSK_CHATGPT_PHASE", "MSK_CHATGPT_STATUS", "MSK_CHATGPT_BOUND", "MSK_CHATGPT_APPROVAL", "MSK_CHATGPT_APPROVAL_CLEAR", "MSK_CHATGPT_LIMIT", "MSK_CHATGPT_DIAGNOSTIC", "MSK_CHATGPT_INTEGRATION_REQUEST"].includes(message.type)) {
    (async () => {
      const payload = message.payload || {};
      let projectId = String(payload.projectId || "").trim();
      // O card do Cofre pode ser detectado após uma navegação/reativação da aba,
      // quando o bridge ainda não repopulou o projectId em memória. Nesse caso
      // recupera o vínculo real pela aba de origem do bridge.
      if (!projectId && message.type === "MSK_CHATGPT_INTEGRATION_REQUEST") {
        const all = await chrome.storage.local.get(null).catch(() => ({}));
        const senderTabId = Number(sender.tab?.id || 0);
        for (const [storageKey, value] of Object.entries(all)) {
          if (!storageKey.startsWith("mskChatBinding:") || !value || typeof value !== "object") continue;
          if (Number(value.tabId || 0) === senderTabId || Number(value.originTabId || 0) === senderTabId) {
            projectId = storageKey.slice("mskChatBinding:".length); break;
          }
        }
      }
      if (!projectId) return sendResponse?.({ok:false,error:"Projeto do Cofre não identificado"});
      payload.projectId = projectId;
      const key = `mskChatBinding:${projectId}`;
      const stored = (await chrome.storage.local.get(key))[key] || {};
      const originTabId = Number(payload.originTabId || stored.originTabId || 0) || null;
      let next = stored;
      if (message.type === "MSK_CHATGPT_BOUND") {
        next = { ...stored, projectId, tabId:sender.tab?.id || stored.tabId, conversationUrl:String(payload.url || sender.tab?.url || stored.conversationUrl || ""), originTabId, connected:true };
        await chrome.storage.local.set({ [key]:next });
      }
      if (originTabId) await chrome.tabs.sendMessage(originTabId, { type:message.type, payload }).catch(()=>{});
      if (message.type === "MSK_CHATGPT_DIAGNOSTIC") {
        const category = String(payload.category || "");
        const stateMap = { repository_not_connected:"repository_missing", github_write_permission:"write_permission_missing", github_tool_unavailable:"not_connected", external_auth_required:"authorization_required" };
        if (stateMap[category]) await mskWriteProviderGithubState("chatgpt", projectId, { state:stateMap[category], severity:payload.severity || "error", title:payload.title || "", message:payload.message || "", evidence:payload.evidence || "", repository:stored.repo || "" });
      }
      const shouldReturn = !!(stored.returnAfterFirstResponse && originTabId && ((message.type === "MSK_CHATGPT_STREAM" && payload.done) || message.type === "MSK_CHATGPT_APPROVAL"));
      if (shouldReturn) {
        await mskFocusLovableTab(originTabId);
        await chrome.storage.local.set({ [key]:{ ...next, returnAfterFirstResponse:false, connected:true } });
      }
      sendResponse?.({ok:true});
    })();
    return true;
  }

  if (message.type !== "MSK_CONNECT") return;
  const requestedProjectId = String(message.projectId || message.payload?.projectId || "").trim();
  const urls = {
    lovable: requestedProjectId ? `https://lovable.dev/projects/${encodeURIComponent(requestedProjectId)}` : "https://lovable.dev",
    github: "https://github.com",
    supabase: "https://supabase.com/dashboard"
  };
  const url = urls[message.provider];
  if (!url) { sendResponse?.({ ok: false, error: "Conector não reconhecido." }); return; }
  chrome.tabs.create({ url });
  sendResponse?.({ ok: true });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  const changedUrl = changeInfo.url || "";
  if (changeInfo.status === "complete" || changedUrl) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab && /^https:\/\/chatgpt\.com\//.test(tab.url || "")) {
      await mskEnsureChatGPTBridge(tabId).catch(() => false);
      const tabKey = `mskChatTab:${tabId}`;
      const projectId = (await chrome.storage.local.get(tabKey))[tabKey];
      if (projectId) {
        const key = `mskChatBinding:${projectId}`;
        const binding = (await chrome.storage.local.get(key))[key] || {};
        // Atualização/roteamento do ChatGPT só mantém a ponte e a URL.
        // NUNCA envia o prompt inicial daqui; o único dono do INIT é
        // mskCreateOrRecoverChatGPTBinding antes do primeiro comando real.
        await chrome.storage.local.set({
          [key]:{ ...binding, projectId, tabId, connected:true, conversationUrl:tab.url || binding.conversationUrl || "" }
        });
      }
    }
    if (tab) {
      for (const provider of ["grok"]) {
        const cfg = mskExternalConfig(provider);
        if (!cfg?.match.test(String(tab.url || ""))) continue;
        await mskEnsureExternalBridge(provider, tabId).catch(() => false);
        const tabKey = mskExternalTabKey(cfg, tabId);
        const projectId = (await chrome.storage.local.get(tabKey))[tabKey];
        if (projectId) {
          const key = mskExternalBindingKey(cfg, projectId);
          const binding = (await chrome.storage.local.get(key))[key] || {};
          await chrome.storage.local.set({
            [key]:{ ...binding, projectId, tabId, connected:true, conversationUrl:tab.url || binding.conversationUrl || "" }
          });
        }
      }
    }
  }
  if (changedUrl.includes("/functions/v1/msk-api") && changedUrl.includes("action=github-callback") && changedUrl.includes("code=")) {
    const flowKey = `mskV2OAuth:${tabId}`;
    const flow = (await chrome.storage.session.get(flowKey))[flowKey];
    if (flow?.originTabId) {
      try {
        const callback = new URL(changedUrl);
        const result = await v2Api("github-oauth-exchange", { code: callback.searchParams.get("code"), state: callback.searchParams.get("state") });
        await chrome.tabs.sendMessage(flow.originTabId, { type: "MSK_V2_AUTH_COMPLETE", result }).catch(() => {});
        await chrome.tabs.update(flow.originTabId, { active: true }).catch(() => {});
        const origin = await chrome.tabs.get(flow.originTabId).catch(() => null);
        if (origin?.windowId) await chrome.windows.update(origin.windowId, { focused: true }).catch(() => {});
      } finally {
        await chrome.storage.session.remove(flowKey);
        await chrome.tabs.remove(tabId).catch(() => {});
      }
    }
    return;
  }
  if (!changedUrl.includes("lovable.dev/projects/") || !changedUrl.includes("msk_session=")) return;
  const flowKey = `mskAuth:${tabId}`;
  const flow = (await chrome.storage.session.get(flowKey))[flowKey];
  if (!flow?.originTabId || !flow?.projectId) return;
  try {
    const url = new URL(changedUrl);
    const session = new URLSearchParams(url.hash.replace(/^#/, "")).get("msk_session");
    if (!session) return;
    const { mskSessions = {}, mskPendingProjects = {} } = await chrome.storage.local.get(["mskSessions", "mskPendingProjects"]);
    mskSessions[flow.projectId] = session;
    mskPendingProjects[flow.projectId] = false;
    await chrome.storage.local.set({ mskSessions, mskPendingProjects });
    const origin = await chrome.tabs.get(flow.originTabId);
    await chrome.tabs.update(flow.originTabId, { active: true });
    if (origin.windowId) await chrome.windows.update(origin.windowId, { focused: true });
    await chrome.tabs.sendMessage(flow.originTabId, { type: "MSK_AUTH_COMPLETE", projectId: flow.projectId }).catch(() => {});
    await chrome.tabs.remove(tabId);
  } finally {
    await chrome.storage.session.remove(flowKey);
  }
});

/* ===== MSK Agente — licença (e-mail + token) validada no MSK SISTEM ===== */
const MSK_SITE = MSK_SAAS_ORIGIN;

const mskLicenseRequest = async (path, payload) => {
  try {
    const response = await mskFetchWithTimeout(`${MSK_SITE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    }, 12000);
    const data = await response.json().catch(() => ({}));
    return { httpOk: response.ok, status: response.status, data, path };
  } catch (error) {
    await mskLog("warn", error?.code || "LICENSE_NETWORK_ERROR", "Falha temporária ao consultar a licença.", { reason:error?.message || "network" });
    return { httpOk:false, status:0, networkError:true, data:{ valid:false, code:error?.code || "NETWORK_ERROR", message:error?.message || "Falha de rede ao validar." }, path };
  }
};

const mskValidate = async (email, token) => {
  // Banco central único de licenças MSK.
  // O cliente envia somente e-mail + token + versão; nenhuma classificação de
  // produto, IP, dispositivo, navegador, fingerprint ou installation_id.
  const payload = {
    email: String(email || "").trim().toLowerCase(),
    token: String(token || "").trim().toUpperCase(),
    extension_version: chrome.runtime.getManifest().version,
  };

  let result = await mskLicenseRequest("/api/public/license/validate", payload);

  // Falha transitória de rede/CORS durante deploy não deve obrigar o cliente a
  // digitar a licença novamente. Faz uma única retentativa automática.
  if (result?.networkError) {
    await new Promise(resolve => setTimeout(resolve, 850));
    result = await mskLicenseRequest("/api/public/license/validate", payload);
  }

  if (!result?.data?.valid) {
    await mskLog(result.networkError ? "warn" : "error", result?.data?.code || `LICENSE_HTTP_${result?.status || 0}`, "Validação de licença não aprovada.", {
      status: result?.status || 0,
      network: !!result?.networkError,
      route: result?.path || "unknown"
    });
  }
  return result;
};

const mskFriendly = (code, message) => {
  const map = {
    LICENSE_INVALID: "Licença inválida. Confira os caracteres.",
    EMAIL_MISMATCH: "Este e-mail não corresponde ao dono da licença.",
    LICENSE_EXPIRED: "Sua licença expirou.",
    EXPIRED: "Sua licença expirou.",
    LICENSE_REVOKED: "Esta licença foi desativada.",
    REVOKED: "Esta licença foi desativada.",
    DEVICE_LIMIT: "O servidor ainda está aplicando uma regra antiga de dispositivo nesta licença.",
    RATE_LIMITED: "Muitas tentativas. Aguarde alguns segundos.",
    RATE_LIMIT: "Muitas tentativas. Aguarde alguns segundos.",
    NETWORK_TIMEOUT: "O servidor demorou para responder. Tente novamente.",
    NETWORK_ERROR: "O SaaS MSK não respondeu. Verifique a internet e tente novamente.",
    LICENSE_SERVICE_UNAVAILABLE: "O serviço de licenças está temporariamente indisponível. Tente novamente em instantes.",
    INVALID_REQUEST: "Confira o e-mail e a licença informados.",
  };
  return map[code] || message || "Não foi possível validar esta licença.";
};

const mskDefinitiveLicenseFailure = code => [
  "LICENSE_INVALID", "EMAIL_MISMATCH", "LICENSE_EXPIRED", "EXPIRED", "LICENSE_REVOKED", "REVOKED", "LICENSE_INACTIVE"
].includes(String(code || "").toUpperCase());

async function mskBroadcastLicenseInvalidated(code, message) {
  const tabs = await chrome.tabs.query({ url: ["https://lovable.dev/*"] }).catch(() => []);
  await Promise.all((tabs || []).map(tab => tab?.id
    ? chrome.tabs.sendMessage(tab.id, { type:"MSK_LICENSE_INVALIDATED", code, message }).catch(() => {})
    : Promise.resolve()));
}

async function mskScheduleLicenseExpiry(license) {
  await chrome.alarms.clear(MSK_LICENSE_EXPIRY_ALARM).catch(() => {});
  const expiresAt = Date.parse(String(license?.expires_at || ""));
  if (!Number.isFinite(expiresAt)) return { ok:true, scheduled:false };
  if (expiresAt <= Date.now()) {
    return mskInvalidateLicense("LICENSE_EXPIRED", "Sua licença expirou. Renove o acesso para continuar.");
  }
  chrome.alarms.create(MSK_LICENSE_EXPIRY_ALARM, { when:Math.max(Date.now() + 500, expiresAt) });
  return { ok:true, scheduled:true, expiresAt };
}

async function mskInvalidateLicense(code = "LICENSE_REVOKED", message = "Esta licença foi desativada.") {
  const current = (await chrome.storage.local.get("mskLicense")).mskLicense || null;
  await chrome.alarms.clear(MSK_LICENSE_EXPIRY_ALARM).catch(() => {});
  await chrome.storage.local.remove(["mskLicense", "mskGuardianEnabled", "mskOpenGuardianAfterReload"]);
  // Remove apenas sessões operacionais. O e-mail fica salvo para facilitar a renovação.
  await mskClearAccountRuntimeState({ keepLicenseEmail:true }).catch(() => {});
  await mskLog("warn", code || "LICENSE_DISABLED", "Acesso da extensão encerrado por expiração/revogação.", {
    hadLicense:!!current,
    reason:String(code || "LICENSE_DISABLED")
  });
  await mskBroadcastLicenseInvalidated(code, mskFriendly(code, message)).catch(() => {});
  return { ok:false, code, message:mskFriendly(code, message) };
}

async function mskForceLicenseRevalidation() {
  const current = (await chrome.storage.local.get("mskLicense")).mskLicense || null;
  if (!current?.email || !current?.token) return { ok:false, code:"LICENSE_REQUIRED", message:"Conecte sua licença para continuar." };
  if (current.expires_at && Date.parse(current.expires_at) <= Date.now()) {
    return mskInvalidateLicense("LICENSE_EXPIRED", "Sua licença expirou. Renove o acesso para continuar.");
  }
  return mskRefreshStoredLicense(current);
}

let mskLicenseRefreshPromise = null;
const mskRefreshStoredLicense = async current => {
  if (mskLicenseRefreshPromise) return mskLicenseRefreshPromise;
  mskLicenseRefreshPromise = (async () => {
    try {
      const result = await mskValidate(current.email, current.token);
      const data = result?.data || {};
      if (data?.valid) {
        const next = {
          ...current,
          plan: data.license?.plan || current.plan,
          plan_name: data.license?.plan_name || current.plan_name,
          // Nunca reinicia a contagem localmente. Usa o expires_at original devolvido pelo SaaS.
          expires_at: data.license?.expires_at ?? current.expires_at ?? null,
          activated_at: data.license?.activated_at ?? current.activated_at ?? null,
          features: data.license?.features || current.features || {},
          checkedAt: Date.now(),
        };
        await chrome.storage.local.set({ mskLicense: next });
        await mskScheduleLicenseExpiry(next).catch(() => {});
        await mskLog("info", "LICENSE_REFRESH_OK", "Licença revalidada sem vínculo de dispositivo.", { hasExpiry:!!next.expires_at });
        return { ok:true, license:next };
      }
      if (mskDefinitiveLicenseFailure(data?.code)) {
        return mskInvalidateLicense(data?.code || "LICENSE_DISABLED", data?.message || "Esta licença não está mais ativa.");
      }
      // Só falha de rede/servidor temporária mantém o cache já validado, e apenas até o expires_at existente.
      const transient = !!result?.networkError || !result?.status || result.status === 408 || result.status === 429 || result.status >= 500;
      if (transient) {
        const stillWithinExpiry = !current.expires_at || Date.parse(current.expires_at) > Date.now();
        if (stillWithinExpiry) return { ok:true, license:current, offline:true };
      }
      await mskLog("warn", data?.code || `LICENSE_HTTP_${result?.status || 0}`, "Servidor recusou a revalidação da licença.", { status:result?.status || 0 });
      return { ok:false, code:data?.code || "LICENSE_REJECTED", message:mskFriendly(data?.code, data?.message) };
    } catch (error) {
      const stillWithinExpiry = !current.expires_at || Date.parse(current.expires_at) > Date.now();
      await mskLog("warn", error?.code || "LICENSE_REFRESH_ERROR", "Não foi possível revalidar a licença agora.", { reason:error?.message || "unknown" });
      return stillWithinExpiry
        ? { ok:true, license:current, offline:true }
        : mskInvalidateLicense("LICENSE_EXPIRED", "Sua licença expirou. Renove o acesso para continuar.");
    } finally {
      mskLicenseRefreshPromise = null;
    }
  })();
  return mskLicenseRefreshPromise;
};

const mskLicenseStatus = async () => {
  const { mskLicense } = await chrome.storage.local.get("mskLicense");
  if (!mskLicense?.token || !mskLicense?.email) return { ok:false };
  if (mskLicense.expires_at && Date.parse(mskLicense.expires_at) <= Date.now()) {
    return mskInvalidateLicense("LICENSE_EXPIRED", "Sua licença expirou. Renove o acesso para continuar.");
  }
  mskScheduleLicenseExpiry(mskLicense).catch(() => {});

  // Boot nunca depende da rede: uma licença já validada abre imediatamente,
  // mas a revogação administrativa é conferida pelo alarme de 1 minuto e pelo
  // monitor ativo da página do Lovable.
  const stale = Date.now() - Number(mskLicense.checkedAt || 0) >= 60 * 1000;
  if (stale) mskRefreshStoredLicense(mskLicense).catch(() => {});
  return { ok:true, license:mskLicense, refreshing:stale };
};



const mskClearAccountRuntimeState = async ({ keepLicenseEmail = true } = {}) => {
  const all = await chrome.storage.local.get(null);
  const direct = new Set([
    "mskProjectLinks", "mskChatGPTProjects", "mskSessions", "mskPendingProjects",
    "mskAuthSession", "mskLovableToken", "mskLovableTokenCapturedAt", "mskLovableProjectId", "mskPendingProjectOpen"
  ]);
  if (!keepLicenseEmail) direct.add("mskLicenseEmail");
  const prefixes = [
    "mskChatBinding:", "mskChatTab:", "mskGrokBinding:", "mskGrokTab:", "mskAIProvider:", "mskProviderGithub:", "mskGithubWriteFlow:", "mskGithubWriteTab:",
    "mskManualGithub:", "mskWizard:", "mskHistory:", "mskChatHistory:", "mskDiagnostics:",
    "mskDoctorReady:"
  ];
  const keys = Object.keys(all).filter(key => direct.has(key) || prefixes.some(prefix => key.startsWith(prefix)));
  if (keys.length) await chrome.storage.local.remove(keys);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["MSK_LICENSE_ACTIVATE", "MSK_LICENSE_STATUS", "MSK_LICENSE_FORCE_REVALIDATE", "MSK_LICENSE_LOGOUT", "MSK_BOOT_AGENT"].includes(message?.type)) return;
  (async () => {
    try {
      if (message.type === "MSK_LICENSE_STATUS") return sendResponse(await mskLicenseStatus());
      if (message.type === "MSK_LICENSE_FORCE_REVALIDATE") return sendResponse(await mskForceLicenseRevalidation());
      if (message.type === "MSK_LICENSE_LOGOUT") {
        await chrome.alarms.clear(MSK_LICENSE_EXPIRY_ALARM).catch(() => {});
        await chrome.storage.local.remove("mskLicense");
        await mskClearAccountRuntimeState({ keepLicenseEmail: false });
        return sendResponse({ ok: true });
      }
      if (message.type === "MSK_BOOT_AGENT") {
        const tabId = sender.tab?.id;
        if (!tabId) return sendResponse({ ok: false });
        await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] }).catch(() => {});
        await chrome.scripting.executeScript({ target: { tabId }, files: ["config.js", "content.js"] }).catch(() => {});
        return sendResponse({ ok: true });
      }
      const email = String(message.email || "").trim().toLowerCase();
      const token = String(message.token || "").trim().toUpperCase();
      const previousLicense = (await chrome.storage.local.get("mskLicense")).mskLicense || null;
      const validation = await mskValidate(email, token);
      const data = validation?.data || {};
      if (!data?.valid) {
        await mskLog("warn", data?.code || `LICENSE_HTTP_${validation?.status || 0}`, "Ativação de licença recusada.", { status:validation?.status || 0 });
        return sendResponse({ ok: false, code:data?.code || "LICENSE_REJECTED", message: mskFriendly(data?.code, data?.message) });
      }
      if (previousLicense?.email && String(previousLicense.email).toLowerCase() !== email) {
        // Troca de usuário no mesmo navegador: não herda repo, conversa GPT ou sessão Lovable de outra conta.
        await mskClearAccountRuntimeState({ keepLicenseEmail: true });
      }
      const license = {
        email,
        token,
        plan: data.license?.plan || null,
        plan_name: data.license?.plan_name || null,
        expires_at: data.license?.expires_at ?? null,
        activated_at: data.license?.activated_at ?? null,
        features: data.license?.features || {},
        checkedAt: Date.now(),
      };
      await chrome.storage.local.set({ mskLicense: license, mskLicenseEmail: email });
      await mskScheduleLicenseExpiry(license).catch(() => {});
      await mskLog("info", "LICENSE_ACTIVATED", "Licença ativada/revalidada por conta + token.", { hasExpiry:!!license.expires_at, hasActivatedAt:!!license.activated_at });
      // Registra a instalação na Central imediatamente; não espera o próximo alarme.
      mskSendHeartbeat().catch(() => {});
      mskCheckRelease({ force:true, verifyIdentity:true }).catch(() => {});
      return sendResponse({ ok: true, license });
    } catch (error) {
      return sendResponse({ ok: false, message: error?.message || "Falha de rede ao validar." });
    }
  })();
  return true;
});

/* Logs técnicos locais e seguros. Nunca incluem token, senha, cookies ou Authorization. */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["MSK_DIAGNOSTICS_GET", "MSK_DIAGNOSTICS_CLEAR", "MSK_DIAGNOSTIC_LOG"].includes(message?.type)) return;
  (async () => {
    if (message.type === "MSK_DIAGNOSTICS_CLEAR") {
      await chrome.storage.local.remove(MSK_DIAGNOSTICS_KEY);
      return sendResponse({ ok:true });
    }
    if (message.type === "MSK_DIAGNOSTIC_LOG") {
      const payload = message.payload || {};
      await mskLog(payload.level || "info", payload.code || "CLIENT_EVENT", payload.message || "Evento da interface.", payload.context || {});
      return sendResponse({ ok:true });
    }
    const items = (await chrome.storage.local.get(MSK_DIAGNOSTICS_KEY))[MSK_DIAGNOSTICS_KEY] || [];
    return sendResponse({ ok:true, items:items.slice(-100) });
  })().catch(error => sendResponse({ ok:false, error:error?.message || "Falha ao ler diagnóstico." }));
  return true;
});

/* Auto-reload das abas do Lovable ao instalar/atualizar (somente lovable.dev oficial) */
const mskReloadLovableTabs = async () => {
  try {
    const tabs = await chrome.tabs.query({ url: "https://lovable.dev/*" });
    for (const tab of tabs) {
      if (tab.id && new URL(tab.url).hostname === "lovable.dev") chrome.tabs.reload(tab.id);
    }
  } catch {}
};
chrome.runtime.onInstalled.addListener(mskReloadLovableTabs);

/* ============ DETECÇÃO AUTOMÁTICA DE VÍNCULOS POR ID DO PROJETO ============ */
/* Descobre, a partir do ID do projeto Lovable, se já existe repositório GitHub
   conectado e qual banco (Lovable Cloud / Supabase) está vinculado — mesmo que a
   aba atual não mostre essa informação. Ordem: cache → API do Lovable → aba oculta. */
/* ===== Cofre de Integrações MSK — valores só na sessão da extensão ===== */
const mskVaultKey = (projectId, service) => `mskIntegrationVault:${String(projectId || "").trim()}:${String(service || "integracao").toLowerCase().replace(/[^a-z0-9_-]+/g,"-").slice(0,80)}`;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["MSK_INTEGRATION_VAULT_SAVE","MSK_INTEGRATION_VAULT_CLEAR"].includes(message?.type)) return;
  (async () => {
    const projectId = String(message.payload?.projectId || "").trim();
    const service = String(message.payload?.service || "Integração").replace(/\s+/g," ").trim().slice(0,100);
    if (!projectId) return sendResponse({ ok:false, code:"PROJECT_REQUIRED", error:"Projeto não identificado." });
    const key = mskVaultKey(projectId, service);
    if (message.type === "MSK_INTEGRATION_VAULT_CLEAR") {
      await chrome.storage.session.remove(key);
      return sendResponse({ ok:true });
    }
    const fields = Array.isArray(message.payload?.fields) ? message.payload.fields.slice(0,20) : [];
    const clean = {};
    for (const field of fields) {
      const name = String(field?.key || "").replace(/[^a-zA-Z0-9_.-]+/g,"_").slice(0,80);
      if (!name) continue;
      const value = String(field?.value ?? "").slice(0,12000);
      clean[name] = { value, secret: field?.secret !== false, label:String(field?.label || name).slice(0,120) };
    }
    await chrome.storage.session.set({ [key]: { projectId, service, fields:clean, createdAt:Date.now() } });
    // Nunca envia os valores ao log/telemetria.
    return sendResponse({ ok:true, service, fieldKeys:Object.keys(clean) });
  })().catch(error => sendResponse({ ok:false, code:"VAULT_SAVE_FAILED", error:error?.message || "Não consegui proteger esses dados nesta sessão." }));
  return true;
});

const MSK_LOVABLE_ORIGIN = "https://lovable.dev";
const mskParseRepo = (text) => {
  const m = String(text || "").match(/github\.com[\\/]+([A-Za-z0-9_.-]+)[\\/]+([A-Za-z0-9_.-]+?)(?:\.git)?(?=["'\s<>,)\\/]|$)/i);
  if (!m) return "";
  const full = `${m[1]}/${m[2]}`;
  return /^(login|apps|settings|orgs|features|about)$/i.test(m[1]) ? "" : full;
};
const mskParseDb = (text) => {
  const t = String(text || "");
  const ref = t.match(/supabase\.com[\\/]+dashboard[\\/]+project[\\/]+([a-z0-9]{16,})/i)?.[1]
    || t.match(/https?:[\\/]+([a-z0-9]{20})\.supabase\.co/i)?.[1];
  if (ref) return ref;
  return /("cloud_enabled"\s*:\s*true|lovable[\s_-]?cloud\s*(ativo|enabled|on)\b|backend connected)/i.test(t) ? "lovable-cloud" : "";
};
const mskReadLinks = async (id) => (await chrome.storage.local.get("mskProjectLinks")).mskProjectLinks?.[id] || null;
const mskWriteLinks = async (id, links) => {
  const { mskProjectLinks = {} } = await chrome.storage.local.get("mskProjectLinks");
  const previous = mskProjectLinks[id] || {};
  const next = { ...previous };
  const incomingRepo = String(links?.repo || "").replace("https://github.com/", "").trim();
  const incomingDb = String(links?.db || "").trim();
  // Nunca apaga um vínculo válido só porque a página atual não expõe o GitHub.
  if (incomingRepo) next.repo = incomingRepo;
  if (incomingDb) next.db = incomingDb;
  next.detectedAt = Date.now();
  mskProjectLinks[id] = next;
  await chrome.storage.local.set({ mskProjectLinks });
  return next;
};
const mskProbeApi = async (id) => {
  const paths = [
    `/api/projects/${id}`,
    `/api/projects/${id}/github`,
    `/api/projects/${id}/integrations`,
    `/api/projects/${id}/settings`,
    `/api/v1/projects/${id}`,
  ];
  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(`${MSK_LOVABLE_ORIGIN}${path}`, { credentials: "include", headers: { accept: "application/json" }, signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const text = await response.text();
      const repo = mskParseRepo(text);
      const db = mskParseDb(text);
      if (repo || db) return { repo, db, source: "api" };
    } catch {}
  }
  return null;
};
const mskProbeTab = async (id) => {
  let tab = null;
  try {
    tab = await chrome.tabs.create({ url: `${MSK_LOVABLE_ORIGIN}/projects/${id}/settings/git/github`, active: false });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const links = [...document.querySelectorAll('a[href*="github.com/"],a[href*="supabase.com/"]')].map((a) => a.href).join(" ");
          return `${links} ${document.body ? document.body.innerText : ""} ${document.body ? document.body.innerHTML.slice(0, 200000) : ""}`;
        },
      }).catch(() => []);
      const text = injected?.[0]?.result || "";
      const repo = mskParseRepo(text);
      const db = mskParseDb(text);
      if (repo || db) return { repo, db, source: "tab" };
    }
  } catch {} finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
  return null;
};
const mskProjectProbes = new Map();


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["MSK_PROBE_PROJECT", "MSK_CACHE_LINKS", "MSK_GET_LINKS"].includes(message?.type)) return;
  (async () => {
    const id = String(message.projectId || "").trim();
    if (!id) return sendResponse({ ok: false, error: "Projeto não identificado." });
    if (message.type === "MSK_CACHE_LINKS") return sendResponse({ ok: true, links: await mskWriteLinks(id, message.links || {}) });
    if (message.type === "MSK_GET_LINKS") return sendResponse({ ok: true, links: await mskReadLinks(id) });
    const cached = await mskReadLinks(id);
    // Repositório identificado uma vez fica persistente por project_id.
    // Só uma ação explícita de reconexão/troca deve substituir esse vínculo.
    if (cached?.repo && !message.force) return sendResponse({ ok: true, ...cached, source: "cache-persistente" });
    let probe = mskProjectProbes.get(id);
    if (!probe) {
      probe = (async () => (await mskProbeApi(id)) || (message.deep ? await mskProbeTab(id) : null))();
      mskProjectProbes.set(id, probe);
      probe.finally(() => mskProjectProbes.delete(id));
    }
    const found = await probe;
    if (!found) return sendResponse({ ok: false, repo: cached?.repo || "", db: cached?.db || "", source: "none" });
    const saved = await mskWriteLinks(id, { repo: found.repo || cached?.repo || "", db: found.db || cached?.db || "" });
    return sendResponse({ ok: true, ...saved, source: found.source });
  })();
  return true;
});

/* Diagnóstico/autocorreção de ambiente — multiusuário, independente de PC/IP/browser. */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "MSK_ENV_DIAGNOSTIC") return;
  (async () => {
    const projectId = String(message.projectId || message.payload?.projectId || "").trim();
    const result = {
      ok: true,
      version: chrome.runtime.getManifest().version,
      projectId,
      license: { ok: false },
      permissions: { ok: true },
      github: { connected: false, projectLinked: false, repositoryIdentified: false, repo: "", source: "none" },
      chatgpt: { connected: false, bridgeReady: false },
      grok: { connected: false, bridgeReady: false },
      lovable: { sessionReady: false },
      recovered: []
    };

    const license = await mskLicenseStatus().catch(() => ({ ok:false }));
    result.license = { ok: !!license?.ok, email: license?.license?.email || "", offline: !!license?.offline };

    result.permissions.ok = await chrome.permissions.contains({
      origins: ["https://lovable.dev/*", "https://chatgpt.com/*", "https://grok.com/*", "https://api.lovable.dev/*"]
    }).catch(() => false);

    const local = await chrome.storage.local.get(["mskLovableToken", "mskLovableProjectId", "mskLovableTokenCapturedAt"]);
    result.lovable.sessionReady = !!String(local.mskLovableToken || "").trim();
    result.lovable.projectId = String(local.mskLovableProjectId || "").trim();

    if (projectId) {
      let links = await mskReadLinks(projectId);
      if (!links?.repo) {
        const found = await mskProbeApi(projectId).catch(() => null);
        if (found?.repo || found?.db) {
          links = await mskWriteLinks(projectId, found);
          result.recovered.push("github_project_link");
        }
      }
      result.github = {
        connected: !!links?.repo,
        projectLinked: !!links?.repo,
        repositoryIdentified: !!links?.repo,
        repo: String(links?.repo || ""),
        source: links?.repo ? "project" : "none"
      };

      const chatKey = `mskChatBinding:${projectId}`;
      let binding = (await chrome.storage.local.get(chatKey))[chatKey] || null;
      if (binding?.tabId) {
        const tab = await chrome.tabs.get(Number(binding.tabId)).catch(() => null);
        if (!tab || !/^https:\/\/chatgpt\.com\//.test(String(tab.url || ""))) {
          await chrome.storage.local.remove(chatKey);
          binding = null;
          result.recovered.push("stale_chatgpt_binding_removed");
        } else {
          result.chatgpt.connected = true;
          result.chatgpt.tabId = Number(binding.tabId);
          result.chatgpt.bridgeReady = await mskEnsureChatGPTBridge(Number(binding.tabId));
          result.chatgpt.connected = !!result.chatgpt.bridgeReady;
          result.chatgpt.repositoryIdentified = !!links?.repo;
          result.chatgpt.repository = String(links?.repo || binding?.repo || "");
          result.chatgpt.github = await mskReadProviderGithubState("chatgpt", projectId);
          result.chatgpt.githubState = result.chatgpt.github?.state || (links?.repo ? "unknown" : "repository_missing");
          if (result.chatgpt.bridgeReady) result.recovered.push("chatgpt_bridge_ready");
        }
      }

      for (const provider of ["grok"]) {
        const cfg = mskExternalConfig(provider);
        const key = mskExternalBindingKey(cfg, projectId);
        let externalBinding = (await chrome.storage.local.get(key))[key] || null;
        if (!externalBinding?.tabId) continue;
        const tab = await chrome.tabs.get(Number(externalBinding.tabId)).catch(() => null);
        if (!tab || !cfg.match.test(String(tab.url || ""))) {
          await chrome.storage.local.remove(key);
          result.recovered.push(`stale_${provider}_binding_removed`);
          continue;
        }
        result[provider].tabId = Number(externalBinding.tabId);
        result[provider].bridgeReady = await mskEnsureExternalBridge(provider, Number(externalBinding.tabId));
        result[provider].connected = !!result[provider].bridgeReady;
        result[provider].repositoryIdentified = !!links?.repo;
        result[provider].repository = String(links?.repo || externalBinding?.repo || "");
        result[provider].github = await mskReadProviderGithubState(provider, projectId);
        result[provider].githubState = result[provider].github?.state || (links?.repo ? "unknown" : "repository_missing");
        if (result[provider].bridgeReady) result.recovered.push(`${provider}_bridge_ready`);
      }
    }
    sendResponse(result);
  })().catch(error => sendResponse({ ok:false, error:error?.message || "Falha no diagnóstico de ambiente." }));
  return true;
});

/* Ações diretas do Lovable usadas pelo MSK para edição pontual sem prompt de IA. */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["MSK_LOVABLE_SOURCE_CODE", "MSK_LOVABLE_EDIT_CODE"].includes(message?.type)) return;
  (async () => {
    const projectId = String(message.projectId || "").trim();
    const token = String(message.token || "").replace(/^Bearer\s+/i, "").trim();
    if (!projectId) return sendResponse({ ok: false, error: "Projeto Lovable não identificado." });
    if (!token) return sendResponse({ ok: false, error: "Sessão Lovable não encontrada." });

    if (message.type === "MSK_LOVABLE_SOURCE_CODE") {
      let lastError = "Falha ao carregar os arquivos do projeto.";
      for (const base of ["https://api.lovable.dev", "https://lovable-api.com"]) {
        try {
          const response = await fetch(`${base}/projects/${encodeURIComponent(projectId)}/source-code`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
          });
          const text = await response.text();
          let data = null;
          try { data = text ? JSON.parse(text) : null; } catch { data = text; }
          if (!response.ok) {
            lastError = `API Lovable retornou ${response.status}.`;
            continue;
          }
          return sendResponse({ ok: true, files: Array.isArray(data?.files) ? data.files : [] });
        } catch (error) {
          lastError = error?.message || lastError;
        }
      }
      return sendResponse({ ok: false, error: lastError });
    }

    const path = String(message.path || "").replace(/^\//, "").trim();
    const content = typeof message.content === "string" ? message.content : "";
    if (!path || !content || !content.includes("#lovable-badge")) {
      return sendResponse({ ok: false, error: "Alteração de CSS inválida." });
    }

    try {
      let tabId = sender?.tab?.id || null;
      if (!tabId) {
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeLovable = activeTabs.find(tab => /^https:\/\/([^/]+\.)?lovable\.dev\//i.test(tab.url || ""));
        if (activeLovable?.id) tabId = activeLovable.id;
      }
      if (!tabId) {
        const lovableTabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] });
        if (lovableTabs?.[0]?.id) tabId = lovableTabs[0].id;
      }
      if (!tabId) return sendResponse({ ok: false, error: "Abra o projeto no Lovable antes de remover a marca d'água." });

      const url = `https://api.lovable.dev/projects/${encodeURIComponent(projectId)}/edit-code`;
      const requestOptions = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          changes: [{ path, content }],
          commit_message: "Remove project watermark badge",
          file_edit_type: "CodeEdit",
          uploads: []
        }),
        credentials: "include"
      };

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async (requestUrl, options) => {
          try {
            const response = await fetch(requestUrl, options);
            const text = await response.text();
            let data = null;
            try { data = text ? JSON.parse(text) : null; } catch { data = text; }
            return { ok: response.ok, status: response.status, data };
          } catch (error) {
            return { ok: false, status: 0, data: { error: error?.message || "Falha na requisição dentro do Lovable." } };
          }
        },
        args: [url, requestOptions]
      });

      const result = results?.[0]?.result || { ok: false, status: 0, data: { error: "Sem resposta da aba Lovable." } };
      if (!result.ok) {
        const apiMessage = result?.data?.message || result?.data?.error || "";
        return sendResponse({
          ok: false,
          status: result.status,
          error: result.status ? `API Lovable retornou ${result.status}${apiMessage ? `: ${apiMessage}` : "."}` : (apiMessage || "Falha ao salvar a alteração no Lovable."),
          data: result.data
        });
      }
      return sendResponse({ ok: true, status: result.status, data: result.data });
    } catch (error) {
      return sendResponse({ ok: false, error: error?.message || "Falha ao salvar a alteração no Lovable." });
    }
  })();
  return true;
});

/* ===== Canal do painel MSK: mensagens do super admin + usuários ativos ===== */
const mskPanelFetch = async (url, init) => {
  try {
    const response = await fetch(url, init);
    return { ok: response.ok, data: await response.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: {} };
  }
};

const mskPullRemoteMessages = async () => {
  const { mskLicense } = await chrome.storage.local.get("mskLicense");
  if (!mskLicense?.token) return { ok: false, commands: [] };
  const installId = await mskEnsureInstallationId();
  const version = chrome.runtime.getManifest().version;
  const url = `${MSK_SAAS_ORIGIN}/api/extension/control?installation_id=${encodeURIComponent(installId)}&version=${encodeURIComponent(version)}`;
  const result = await mskPanelFetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${String(mskLicense.token).trim()}`,
      "X-MSK-Installation-Id": installId,
      "X-MSK-Extension-Version": version,
      "X-MSK-Extension-Id": chrome.runtime.id,
    },
  });
  const commands = Array.isArray(result.data?.commands) ? result.data.commands : [];
  return { ok: result.ok, commands, control: result.data?.control || null, integrity: result.data?.integrity || null };
};

const mskFetchActiveUsers = async () => {
  const result = await mskPanelFetch(`${MSK_SAAS_ORIGIN}/api/public/presence`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const active = Number(result.data?.online);
  return Number.isFinite(active) ? active : null;
};

const mskAckRemote = async commandId => {
  const { mskLicense } = await chrome.storage.local.get("mskLicense");
  if (!mskLicense?.token) return { ok: false };
  const installId = await mskEnsureInstallationId();
  const version = chrome.runtime.getManifest().version;
  return mskPanelFetch(`${MSK_SAAS_ORIGIN}/api/extension/control`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${String(mskLicense.token).trim()}`,
      "X-MSK-Installation-Id": installId,
      "X-MSK-Extension-Version": version,
      "X-MSK-Extension-Id": chrome.runtime.id,
    },
    body: JSON.stringify({ command_id: commandId }),
  });
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MSK_REMOTE_ACK") {
    mskAckRemote(message.id).then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "MSK_REMOTE_PULL") {
    mskPullRemoteMessages().then(sendResponse, () => sendResponse({ ok: false, commands: [] }));
    return true;
  }
  if (message?.type === "MSK_ACTIVE_USERS") {
    mskFetchActiveUsers().then(active => sendResponse({ ok: true, active }), () => sendResponse({ ok: false }));
    return true;
  }
  return undefined;
});

/* ===== Download do projeto conectado (ZIP do repositório GitHub) ===== */
const mskDownloadProjectZip = async ({ repo, projectId }) => {
  const clean = String(repo || "").replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) {
    return { ok: false, message: "Conecte o GitHub do projeto para baixar o ZIP completo." };
  }
  const filename = `${projectId ? `lovable-${String(projectId).slice(0, 8)}-` : ""}${clean.split("/")[1]}.zip`;
  for (const branch of ["main", "master"]) {
    try {
      const downloadId = await chrome.downloads.download({
        url: `https://github.com/${clean}/archive/refs/heads/${branch}.zip`,
        filename,
      });
      if (downloadId) return { ok: true, downloadId, repo: clean, branch };
    } catch {
      /* tenta o próximo branch */
    }
  }
  return { ok: false, message: "Não consegui iniciar o download do projeto agora." };
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MSK_DOWNLOAD_PROJECT") {
    mskDownloadProjectZip(message.payload || {}).then(sendResponse, () =>
      sendResponse({ ok: false, message: "Falha ao iniciar o download." }),
    );
    return true;
  }
  return undefined;
});
