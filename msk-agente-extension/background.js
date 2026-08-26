import "./config.js";

const cfg = () => globalThis.MSK_CONFIG || {};
const authSession = async () => (await chrome.storage.local.get("mskAuthSession")).mskAuthSession || null;
const saveAuthSession = async session => chrome.storage.local.set({ mskAuthSession: session });
const authCall = async (mode, email, password) => {
  const config = cfg();
  const path = mode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
  const response = await fetch(`${config.supabaseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey }, body: JSON.stringify({ email, password }) });
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
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey }, body: JSON.stringify({ refresh_token: session.refreshToken }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) { await chrome.storage.local.remove("mskAuthSession"); return null; }
  session = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000, user: data.user };
  await saveAuthSession(session); return session;
};
const v2Api = async (action, payload = {}) => {
  const session = await activeAuthSession();
  if (!session) return { ok: false, status: 401, error: "Entre na sua conta MSK.", code: "AUTH_REQUIRED" };
  const config = cfg();
  const response = await fetch(`${config.supabaseUrl}/functions/v1/msk-api?action=${encodeURIComponent(action)}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey, Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify(payload) });
  const raw = await response.text(); let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || `HTTP ${response.status}` }; }
  return { ok: response.ok, status: response.status, ...data };
};

chrome.runtime.onInstalled.addListener(() => chrome.storage.local.set({ mskEnabled: true }));
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !/^https:\/\/(?:[^/]+\.)?lovable\.dev\//.test(tab.url || "")) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: "MSK_OPEN" }); }
  catch {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "MSK_OPEN" });
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  if (["MSK_AGENT_RUN", "MSK_GPT_CONNECT", "MSK_AGENT_STATUS", "MSK_TASK_STATUS", "MSK_TASK_APPROVE", "MSK_BACKEND_HEALTH"].includes(message.type)) {
    (async () => {
      const cfg = globalThis.MSK_CONFIG || {};
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        sendResponse({ ok: false, error: "Backend Supabase ainda não foi publicado/configurado." });
        return;
      }
      const signedSession = await activeAuthSession();
      if (signedSession && ["MSK_AGENT_RUN", "MSK_TASK_STATUS", "MSK_TASK_APPROVE", "MSK_AGENT_STATUS"].includes(message.type)) {
        const v2Actions = { MSK_AGENT_RUN: "run", MSK_TASK_STATUS: "run-status", MSK_TASK_APPROVE: "approve-run", MSK_AGENT_STATUS: "connection-status" };
        const payload = message.type === "MSK_TASK_APPROVE" ? { ...message.payload, confirmed: true } : message.payload;
        const result = await v2Api(v2Actions[message.type], payload);
        if (message.type === "MSK_AGENT_STATUS" && result.ok) return sendResponse({ ...result, connected: !!result.authorized && !!result.activeProjectId, repository: result.activeProject?.repo_full_name || null });
        return sendResponse(result);
      }
      const actions = { MSK_AGENT_RUN: "run", MSK_GPT_CONNECT: "connect", MSK_AGENT_STATUS: "status", MSK_TASK_STATUS: "task-status", MSK_TASK_APPROVE: "approve", MSK_BACKEND_HEALTH: "health" };
      const action = actions[message.type];
      try {
        const projectId = String(message.payload?.lovable_project_id || "");
        const { mskSessions = {} } = await chrome.storage.local.get("mskSessions");
        const mskSession = String(mskSessions[projectId] || "");
        const response = await fetch(`${cfg.supabaseUrl.replace(/\/$/, "")}/functions/v1/msk-agent?action=${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, ...(mskSession ? { "X-MSK-Session": mskSession } : {}) },
          body: JSON.stringify(message.payload || {})
        });
        const raw = await response.text();
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; }
        catch { data = { error: raw || `Supabase respondeu HTTP ${response.status}.` }; }
        if (response.ok && data.session_token && projectId) {
          const { mskSessions = {} } = await chrome.storage.local.get("mskSessions");
          mskSessions[projectId] = String(data.session_token);
          await chrome.storage.local.set({ mskSessions });
          delete data.session_token;
        }
        if (data.authorize_url) {
          const authTab = await chrome.tabs.create({ url: data.authorize_url, active: true });
          if (authTab.id && sender.tab?.id) {
            await chrome.storage.session.set({
              [`mskAuth:${authTab.id}`]: { originTabId: sender.tab.id, projectId, createdAt: Date.now() }
            });
          }
        }
        sendResponse({ ok: response.ok, status: response.status, ...data });
      } catch (error) {
        sendResponse({ ok: false, error: `Não foi possível acessar o agente MSK no Supabase: ${error?.message || "falha de rede"}.` });
      }
    })();
    return true;
  }
  if (message.type !== "MSK_CONNECT") return;
  const urls = { lovable: "https://lovable.dev", github: "https://github.com", supabase: "https://supabase.com/dashboard" };
  const url = urls[message.provider];
  if (!url) { sendResponse?.({ ok: false, error: "Conector não reconhecido." }); return; }
  chrome.tabs.create({ url });
  sendResponse?.({ ok: true });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  const changedUrl = changeInfo.url || "";
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
const MSK_SITE = "https://msksystem.online";

const mskInstallationId = async () => {
  const { mskInstallId } = await chrome.storage.local.get("mskInstallId");
  if (mskInstallId) return mskInstallId;
  const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())).replace(/-/g, "");
  await chrome.storage.local.set({ mskInstallId: id });
  return id;
};

const mskValidate = async (email, token) => {
  const installation_id = await mskInstallationId();
  const response = await fetch(`${MSK_SITE}/api/public/license/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      token,
      installation_id,
      device_fingerprint: installation_id,
      extension_version: chrome.runtime.getManifest().version,
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { httpOk: response.ok, data };
};

const mskFriendly = (code, message) => {
  const map = {
    LICENSE_INVALID: "Licença inválida. Confira os caracteres.",
    EMAIL_MISMATCH: "Este e-mail não corresponde ao dono da licença.",
    DEVICE_LIMIT: "Limite de dispositivos atingido para esta licença.",
    RATE_LIMITED: "Muitas tentativas. Aguarde alguns segundos.",
  };
  return map[code] || message || "Não foi possível validar esta licença.";
};

const mskLicenseStatus = async () => {
  const { mskLicense } = await chrome.storage.local.get("mskLicense");
  if (!mskLicense?.token || !mskLicense?.email) return { ok: false };
  if (mskLicense.expires_at && Date.parse(mskLicense.expires_at) <= Date.now()) {
    await chrome.storage.local.remove("mskLicense");
    return { ok: false, message: "Sua licença expirou. Insira uma nova licença." };
  }
  // Revalida no servidor no máximo a cada 10 minutos.
  if (Date.now() - Number(mskLicense.checkedAt || 0) < 600000) return { ok: true, license: mskLicense };
  try {
    const { data } = await mskValidate(mskLicense.email, mskLicense.token);
    if (data?.valid) {
      const next = {
        ...mskLicense,
        plan: data.license?.plan || mskLicense.plan,
        plan_name: data.license?.plan_name || mskLicense.plan_name,
        expires_at: data.license?.expires_at ?? null,
        features: data.license?.features || {},
        checkedAt: Date.now(),
      };
      await chrome.storage.local.set({ mskLicense: next });
      return { ok: true, license: next };
    }
    await chrome.storage.local.remove("mskLicense");
    return { ok: false, message: mskFriendly(data?.code, data?.message) };
  } catch {
    return { ok: true, license: mskLicense, offline: true };
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["MSK_LICENSE_ACTIVATE", "MSK_LICENSE_STATUS", "MSK_LICENSE_LOGOUT", "MSK_BOOT_AGENT"].includes(message?.type)) return;
  (async () => {
    try {
      if (message.type === "MSK_LICENSE_STATUS") return sendResponse(await mskLicenseStatus());
      if (message.type === "MSK_LICENSE_LOGOUT") {
        await chrome.storage.local.remove("mskLicense");
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
      const { data } = await mskValidate(email, token);
      if (!data?.valid) return sendResponse({ ok: false, message: mskFriendly(data?.code, data?.message) });
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
      return sendResponse({ ok: true, license });
    } catch (error) {
      return sendResponse({ ok: false, message: error?.message || "Falha de rede ao validar." });
    }
  })();
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
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "MSK_OPEN" }).catch(() => {});
});
