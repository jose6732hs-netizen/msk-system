const CONTROL_URL = "https://msksystem.online/api/extension/control";
const CONTROL_ALARM = "msk-agent-remote-control";
const CONTROL_PERIOD_MINUTES = 0.5;
const nativeFetch = globalThis.fetch.bind(globalThis);
let polling = false;

async function installationId() {
  const stored = await chrome.storage.local.get("mskInstallId");
  if (stored.mskInstallId) return String(stored.mskInstallId);
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
  await chrome.storage.local.set({ mskInstallId: id });
  return id;
}

async function authHeaders() {
  const stored = await chrome.storage.local.get("mskLicense");
  const license = stored.mskLicense;
  if (!license?.token) return null;
  if (license.expires_at && Date.parse(license.expires_at) <= Date.now()) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${license.token}`,
    "X-MSK-Installation-ID": await installationId(),
    "X-MSK-Extension-Version": chrome.runtime.getManifest().version,
  };
}

async function request(method = "GET", body = null) {
  const headers = await authHeaders();
  if (!headers) return { ok: false, skipped: true };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await nativeFetch(CONTROL_URL, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, ...data };
  } catch {
    return { ok: false, offline: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function lovableTabs() {
  return chrome.tabs.query({ url: "https://lovable.dev/*" }).catch(() => []);
}

async function reloadLovableTabs() {
  const tabs = await lovableTabs();
  for (const tab of tabs) if (tab.id) await chrome.tabs.reload(tab.id).catch(() => {});
}

async function applyRemoteState(control) {
  const stored = await chrome.storage.local.get(["mskRemoteBlocked", "mskRemoteBlockReason", "mskRemoteBlockMessage"]);
  const nextBlocked = !!control?.blocked;
  const changed = stored.mskRemoteBlocked !== nextBlocked || stored.mskRemoteBlockReason !== (control?.reason || null) || stored.mskRemoteBlockMessage !== (control?.message || null);

  if (nextBlocked) {
    await chrome.storage.local.set({
      mskRemoteBlocked: true,
      mskRemoteBlockReason: control?.reason || "Bloqueado pelo administrador",
      mskRemoteBlockMessage: control?.message || "Seu acesso ao MSK Agente foi temporariamente bloqueado.",
      mskRemoteBlockedAt: Date.now(),
    });
  } else {
    await chrome.storage.local.remove(["mskRemoteBlocked", "mskRemoteBlockReason", "mskRemoteBlockMessage", "mskRemoteBlockedAt"]);
  }

  if (changed) await reloadLovableTabs();
}

async function deliverMessage(command) {
  const tabs = await lovableTabs();
  const target = tabs.find((tab) => tab.active && tab.id) || tabs.find((tab) => tab.id);
  if (!target?.id) return 0;
  const delivered = await chrome.tabs.sendMessage(target.id, {
    type: "MSK_REMOTE_MESSAGE",
    command: {
      id: command.id,
      type: command.type,
      title: command.title || "Mensagem da MSK",
      message: command.message || "",
      severity: command.severity || "info",
      created_at: command.created_at || null,
    },
  }).then(() => true).catch(() => false);
  return delivered ? 1 : 0;
}

async function acknowledge(id) {
  if (!id) return;
  await request("POST", { command_id: id });
}

async function handleCommand(command) {
  if (!command?.id || !command?.type) return;
  if (command.type === "block") {
    await chrome.storage.local.set({
      mskRemoteBlocked: true,
      mskRemoteBlockReason: command.title || "Bloqueado pelo administrador",
      mskRemoteBlockMessage: command.message || "Seu acesso ao MSK Agente foi temporariamente bloqueado.",
      mskRemoteBlockedAt: Date.now(),
    });
    await acknowledge(command.id);
    await reloadLovableTabs();
    return;
  }
  if (command.type === "unblock") {
    await chrome.storage.local.remove(["mskRemoteBlocked", "mskRemoteBlockReason", "mskRemoteBlockMessage", "mskRemoteBlockedAt"]);
    await acknowledge(command.id);
    await reloadLovableTabs();
    return;
  }
  if (command.type === "refresh") {
    await acknowledge(command.id);
    await reloadLovableTabs();
    return;
  }
  if (command.type === "message" || command.type === "update_notice") {
    const delivered = await deliverMessage(command);
    if (delivered > 0) await acknowledge(command.id);
  }
}

async function pollRemoteControl() {
  if (polling) return;
  polling = true;
  try {
    const result = await request("GET");
    if (!result.ok) {
      if ([401, 403].includes(Number(result.status || 0)) && ["LICENSE_EXPIRED", "LICENSE_INVALID"].includes(String(result.code || ""))) {
        await chrome.storage.local.remove("mskLicense");
        await reloadLovableTabs();
      }
      return;
    }
    await applyRemoteState(result.control || { blocked: false });
    for (const command of result.commands || []) await handleCommand(command);
  } finally {
    polling = false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(CONTROL_ALARM, { periodInMinutes: CONTROL_PERIOD_MINUTES });
  void pollRemoteControl();
});
chrome.runtime.onStartup?.addListener(() => {
  chrome.alarms.create(CONTROL_ALARM, { periodInMinutes: CONTROL_PERIOD_MINUTES });
  void pollRemoteControl();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CONTROL_ALARM) void pollRemoteControl();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.mskLicense?.newValue) {
    if (globalThis.MSK_TELEMETRY?.heartbeat) void globalThis.MSK_TELEMETRY.heartbeat();
    void pollRemoteControl();
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MSK_REMOTE_CONTROL_POLL") return;
  (async () => { await pollRemoteControl(); sendResponse({ ok: true }); })();
  return true;
});

chrome.alarms.create(CONTROL_ALARM, { periodInMinutes: CONTROL_PERIOD_MINUTES });
void pollRemoteControl();

export const mskRemoteControl = { pollRemoteControl };
globalThis.MSK_REMOTE_CONTROL = mskRemoteControl;
