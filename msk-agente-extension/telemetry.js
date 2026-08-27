const BASE_URL = "https://msksystem.online/api/extension";
const QUEUE_KEY = "mskTelemetryQueue";
const UPDATE_KEY = "mskExtensionUpdate";
const QUEUE_LIMIT = 100;
const QUEUE_MAX_AGE = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT = 4500;
const nativeFetch = globalThis.fetch.bind(globalThis);

const SENSITIVE_KEY = /(pass(word)?|cookie|authorization|api[_-]?key|secret|service[_-]?role|private[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|github[_-]?token|license[_-]?token|\.env)/i;
const CONTENT_KEY = /^(prompt|prompts|command|commands|content|contents|messages?|conversation|raw_body|request_body|response_body)$/i;
const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/i,
  /\bsk-[A-Za-z0-9_-]{16,}\b/i,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /\bMSK-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2,4}\b/i,
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitize(value, key = "", depth = 0) {
  if (depth > 6) return "[MAX_DEPTH]";
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (CONTENT_KEY.test(key)) {
    let size = 0;
    try { size = typeof value === "string" ? value.length : JSON.stringify(value ?? "").length; } catch {}
    return `[CONTENT_NOT_LOGGED]:${Math.min(size, 1000000)}`;
  }
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) return "[REDACTED]";
    return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => sanitize(item, key, depth + 1));
  if (typeof value === "object") {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value).slice(0, 80)) {
      output[String(childKey).slice(0, 100)] = sanitize(childValue, childKey, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, 500);
}

async function installationId() {
  const { mskInstallId } = await chrome.storage.local.get("mskInstallId");
  if (mskInstallId) return String(mskInstallId);
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
  await chrome.storage.local.set({ mskInstallId: id });
  return id;
}

async function license() {
  const { mskLicense } = await chrome.storage.local.get("mskLicense");
  if (!mskLicense?.token) return null;
  if (mskLicense.expires_at && Date.parse(mskLicense.expires_at) <= Date.now()) return null;
  return mskLicense;
}

function platformInfo() {
  const ua = String(globalThis.navigator?.userAgent || "");
  let browser = "Chromium";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Google Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  let os = "Outro";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  return { browser, os };
}

async function headers() {
  const currentLicense = await license();
  if (!currentLicense?.token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${currentLicense.token}`,
    "X-MSK-Installation-ID": await installationId(),
    "X-MSK-Extension-Version": chrome.runtime.getManifest().version,
  };
}

async function activeProjectContext() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://lovable.dev/*" });
    const tab = tabs.find((item) => item.active) || tabs[0];
    const match = String(tab?.url || "").match(/\/projects\/([0-9a-f-]{20,})/i);
    const projectId = match?.[1] || null;
    const { mskProjectLinks = {} } = await chrome.storage.local.get("mskProjectLinks");
    const links = projectId ? mskProjectLinks[projectId] || {} : {};
    return {
      project_id: projectId,
      repository: normalizeRepo(links.repo),
      workspace_url: projectId ? `https://lovable.dev/projects/${projectId}` : null,
    };
  } catch {
    return { project_id: null, repository: null, workspace_url: null };
  }
}

function normalizeRepo(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let path = raw;
  try { path = new URL(raw).pathname; } catch { path = raw.replace(/^git@github\.com:/i, ""); }
  const clean = path.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(clean) ? clean : null;
}

async function enqueue(endpoint, payload, attempts = 0) {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const now = Date.now();
  const queue = Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY].filter((item) => now - Number(item.createdAt || 0) < QUEUE_MAX_AGE) : [];
  queue.push({ endpoint, payload: sanitize(payload), attempts, createdAt: now });
  await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(-QUEUE_LIMIT) });
}

async function request(endpoint, options = {}, queueOnFail = false) {
  const authHeaders = await headers();
  if (!authHeaders) return { ok: false, skipped: true, code: "NO_LICENSE" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await nativeFetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...authHeaders, ...(options.headers || {}) },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && queueOnFail && response.status >= 500) {
      const body = options.body ? JSON.parse(options.body) : {};
      await enqueue(endpoint, body);
    }
    return { ok: response.ok, status: response.status, ...data };
  } catch (error) {
    if (queueOnFail && options.body) {
      try { await enqueue(endpoint, JSON.parse(options.body)); } catch {}
    }
    return { ok: false, offline: true, error: error?.message || "network" };
  } finally {
    clearTimeout(timeout);
  }
}

async function post(endpoint, payload, queueOnFail = true) {
  return request(endpoint, { method: "POST", body: JSON.stringify(sanitize(payload)) }, queueOnFail);
}

async function flushQueue() {
  const currentLicense = await license();
  if (!currentLicense) return;
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const now = Date.now();
  const queue = Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY] : [];
  if (!queue.length) return;
  const keep = [];
  for (const item of queue.slice(0, 20)) {
    if (now - Number(item.createdAt || 0) > QUEUE_MAX_AGE || Number(item.attempts || 0) >= 3) continue;
    const result = await post(item.endpoint, item.payload, false);
    if (!result.ok && (result.offline || Number(result.status || 0) >= 500)) keep.push({ ...item, attempts: Number(item.attempts || 0) + 1 });
    await sleep(60);
  }
  keep.push(...queue.slice(20));
  await chrome.storage.local.set({ [QUEUE_KEY]: keep.slice(-QUEUE_LIMIT) });
}

async function trackEvent(action, details = {}) {
  const install = await installationId();
  const context = await activeProjectContext();
  const payload = {
    event_id: crypto.randomUUID?.(),
    timestamp: new Date().toISOString(),
    installation_id: install,
    extension_version: chrome.runtime.getManifest().version,
    project_id: details.project_id || context.project_id || null,
    repository: normalizeRepo(details.repository || context.repository),
    provider: details.provider || null,
    action,
    status: details.status || "success",
    duration_ms: Number.isFinite(details.duration_ms) ? Math.max(0, Math.min(3600000, Math.round(details.duration_ms))) : null,
    metadata: sanitize(details.metadata || {}),
  };
  return post("/events", payload, true);
}

async function trackError(errorCode, details = {}) {
  const install = await installationId();
  const context = await activeProjectContext();
  const payload = {
    error_id: crypto.randomUUID?.(),
    timestamp: new Date().toISOString(),
    installation_id: install,
    extension_version: chrome.runtime.getManifest().version,
    error_code: String(errorCode || "EXTENSION_ERROR").toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 100),
    severity: details.severity || "error",
    title: details.title || "Falha na operação",
    technical_message: sanitize(details.technical_message || details.error || "", "technical_message"),
    stack: sanitize(details.stack || "", "stack"),
    action: details.action || null,
    provider: details.provider || null,
    project_id: details.project_id || context.project_id || null,
    repository: normalizeRepo(details.repository || context.repository),
    browser: platformInfo().browser,
    metadata: sanitize(details.metadata || {}),
  };
  return post("/errors", payload, true);
}

async function heartbeat() {
  const currentLicense = await license();
  if (!currentLicense) return { ok: false, skipped: true };
  const context = await activeProjectContext();
  const info = platformInfo();
  const result = await post("/heartbeat", {
    installation_id: await installationId(),
    version: chrome.runtime.getManifest().version,
    project_id: context.project_id,
    repository: context.repository,
    workspace_url: context.workspace_url,
    provider: null,
    browser: info.browser,
    os: info.os,
    timestamp: new Date().toISOString(),
  }, false);
  if (result?.code === "LICENSE_EXPIRED") {
    await chrome.storage.local.remove("mskLicense");
    const tabs = await chrome.tabs.query({ url: "https://lovable.dev/*" }).catch(() => []);
    for (const tab of tabs) if (tab.id) chrome.tabs.reload(tab.id).catch(() => {});
  }
  return result;
}

function compareVersions(a, b) {
  const parts = (value) => String(value || "0").split(/[+-]/, 1)[0].split(".").map((item) => Number(item) || 0);
  const aa = parts(a), bb = parts(b);
  for (let index = 0; index < Math.max(aa.length, bb.length, 3); index += 1) {
    const diff = (aa[index] || 0) - (bb[index] || 0);
    if (diff) return diff;
  }
  return 0;
}

async function checkVersion(force = false) {
  const currentLicense = await license();
  if (!currentLicense) return null;
  const existing = (await chrome.storage.local.get(UPDATE_KEY))[UPDATE_KEY];
  if (!force && existing?.checkedAt && Date.now() - existing.checkedAt < 60 * 60_000) return existing;
  const current = chrome.runtime.getManifest().version;
  const result = await request(`/version?current_version=${encodeURIComponent(current)}&installation_id=${encodeURIComponent(await installationId())}`, { method: "GET" }, false);
  if (!result.ok) return existing || null;
  const update = {
    current_version: current,
    latest_version: result.latest_version || current,
    minimum_version: result.minimum_version || current,
    mandatory: !!result.mandatory,
    update_available: !!result.update_available && compareVersions(current, result.latest_version) < 0,
    download_url: result.download_url || null,
    changelog: result.changelog || "",
    title: result.title || "Nova atualização disponível",
    released_at: result.released_at || null,
    checkedAt: Date.now(),
  };
  await chrome.storage.local.set({ [UPDATE_KEY]: update });
  const tabs = await chrome.tabs.query({ url: "https://lovable.dev/*" }).catch(() => []);
  for (const tab of tabs) if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "MSK_UPDATE_STATUS", update }).catch(() => {});
  if (update.update_available) void trackEvent(update.mandatory ? "update_required" : "update_available", { metadata: { latest_version: update.latest_version, minimum_version: update.minimum_version } });
  return update;
}

async function downloadUpdate() {
  const update = await checkVersion(true);
  if (!update?.update_available || !update.download_url) return { ok: false, error: "Nenhuma atualização disponível." };
  void trackEvent("update_download_started", { metadata: { latest_version: update.latest_version } });
  const url = new URL(update.download_url);
  const endpoint = `${url.pathname}${url.search}`.replace(/^\/api\/extension/, "");
  const result = await request(endpoint, { method: "GET" }, false);
  if (!result.ok || !result.url) return { ok: false, error: result.message || "Não foi possível preparar o download oficial." };
  await chrome.tabs.create({ url: result.url, active: true });
  void trackEvent("update_download_opened", { metadata: { latest_version: update.latest_version } });
  return { ok: true };
}

async function updateBlocksWrites() {
  const update = (await chrome.storage.local.get(UPDATE_KEY))[UPDATE_KEY];
  if (!update?.mandatory || !update?.update_available) return false;
  if (Date.now() - Number(update.checkedAt || 0) > 24 * 60 * 60_000) return false;
  return compareVersions(chrome.runtime.getManifest().version, update.minimum_version || update.latest_version) < 0;
}

// Observa operações importantes sem alterar o payload original e sem guardar o prompt.
const observedFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || String(input || "");
  if (url.startsWith(BASE_URL)) return observedFetch(input, init);
  const isRun = /functions\/v1\/(?:msk-api|msk-agent).*action=(?:run|approve-run|approve)/i.test(url);
  if (isRun && await updateBlocksWrites()) {
    return new Response(JSON.stringify({ ok: false, code: "UPDATE_REQUIRED", error: "Atualização necessária para continuar.", message: "Atualize o MSK Agente para continuar." }), { status: 426, headers: { "Content-Type": "application/json" } });
  }
  const started = Date.now();
  let payload = {};
  try { payload = typeof init?.body === "string" ? JSON.parse(init.body) : {}; } catch {}
  try {
    const response = await observedFetch(input, init);
    const duration = Date.now() - started;
    if (isRun) {
      const body = await response.clone().json().catch(() => ({}));
      const projectId = String(payload?.lovable_project_id || payload?.lovableProjectId || "") || null;
      const repository = normalizeRepo(payload?.repository_url || payload?.repositoryUrl || payload?.connection_context?.github);
      const provider = ["chatgpt", "grok", "blackbox", "gemini"].includes(String(payload?.provider || "").toLowerCase()) ? String(payload.provider).toLowerCase() : null;
      void trackEvent("prompt_completed", { project_id: projectId, repository, provider, status: response.ok ? "success" : "failed", duration_ms: duration, metadata: { http_status: response.status, commit_sha: body?.commit_sha || body?.commitSha || null, preview_url: body?.preview_url || body?.previewUrl || null } });
      if (response.ok && (body?.commit_sha || body?.commitSha)) void trackEvent("github_write_success", { project_id: projectId, repository, provider: "github", duration_ms: duration, metadata: { commit_sha: body?.commit_sha || body?.commitSha } });
      if (!response.ok) void trackError(body?.code || "AGENT_RUN_FAILED", { action: "prompt_completed", provider, project_id: projectId, repository, technical_message: body?.error || body?.message || `HTTP ${response.status}`, metadata: { http_status: response.status } });
    } else if (/action=github-oauth-exchange/i.test(url) && response.ok) {
      void trackEvent("github_connected", { provider: "github" });
    } else if (/action=activate-project/i.test(url) && response.ok) {
      const body = await response.clone().json().catch(() => ({}));
      void trackEvent("project_detected", { project_id: payload?.lovableProjectId || payload?.lovable_project_id || body?.lovableProjectId || null, repository: normalizeRepo(payload?.repoFullName || body?.repoFullName || body?.repo), metadata: { project_name: body?.project?.name || null } });
    } else if (/functions\/v1\/msk-agent.*action=connect/i.test(url) && response.ok) {
      void trackEvent("chatgpt_connected", { provider: "chatgpt" });
    }
    return response;
  } catch (error) {
    if (isRun) void trackError("AI_BRIDGE_TIMEOUT", { action: "prompt_completed", technical_message: error?.message || "Falha de rede", stack: error?.stack || "" });
    throw error;
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MSK_EXTENSION_UPDATE_STATUS") {
    (async () => sendResponse({ ok: true, update: await checkVersion(false) }))();
    return true;
  }
  if (message?.type === "MSK_EXTENSION_UPDATE_DOWNLOAD") {
    (async () => sendResponse(await downloadUpdate()))();
    return true;
  }
  if (message?.type === "MSK_AGENT_RUN") {
    const payload = message.payload || {};
    const prompt = String(payload.prompt || payload.command || payload.message || "");
    void trackEvent("prompt_sent", {
      project_id: payload.lovable_project_id || payload.lovableProjectId || null,
      repository: normalizeRepo(payload.repository_url || payload.repositoryUrl || payload.connection_context?.github),
      provider: ["chatgpt", "grok", "blackbox", "gemini"].includes(String(payload.provider || "").toLowerCase()) ? String(payload.provider).toLowerCase() : null,
      status: "started",
      metadata: { prompt_size: prompt.length, operation_type: payload.action || "agent_run" },
    });
  }
  if (message?.type === "MSK_V2_GITHUB_CONNECT") void trackEvent("github_connect_started", { provider: "github", status: "started" });
  if (message?.type === "MSK_PROBE_PROJECT" || message?.type === "MSK_GET_LINKS") void trackEvent("project_opened", { project_id: message.projectId || null, status: "started" });
});

chrome.runtime.onInstalled.addListener(async (details) => {
  void trackEvent(details.reason === "update" ? "extension_updated" : "extension_started", { metadata: { reason: details.reason, previous_version: details.previousVersion || null } });
  chrome.alarms.create("msk-agent-heartbeat", { periodInMinutes: 5 });
  chrome.alarms.create("msk-agent-version-check", { periodInMinutes: 360 });
  await sleep(1200);
  void heartbeat();
  void checkVersion(true);
  void flushQueue();
});

chrome.runtime.onStartup?.addListener(() => {
  chrome.alarms.create("msk-agent-heartbeat", { periodInMinutes: 5 });
  chrome.alarms.create("msk-agent-version-check", { periodInMinutes: 360 });
  void heartbeat();
  void checkVersion(false);
  void flushQueue();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "msk-agent-heartbeat") { void heartbeat(); void flushQueue(); }
  if (alarm.name === "msk-agent-version-check") void checkVersion(true);
});

// Garante os alarmes também em service workers já instalados antes desta versão.
chrome.alarms.create("msk-agent-heartbeat", { periodInMinutes: 5 });
chrome.alarms.create("msk-agent-version-check", { periodInMinutes: 360 });

export const mskTelemetry = { trackEvent, trackError, heartbeat, checkVersion, downloadUpdate, flushQueue, sanitize };
globalThis.MSK_TELEMETRY = mskTelemetry;
