const LICENSE_KEY = "mskLicense";
const EXPIRY_ALARM = "msk-agent-license-expiry";
const RECHECK_ALARM = "msk-agent-license-recheck";
const RECHECK_MINUTES = 1;
const VALIDATE_URL = "https://msksystem.online/api/public/agent/license/validate";

async function readLicense() {
  const stored = await chrome.storage.local.get(LICENSE_KEY);
  return stored[LICENSE_KEY] || null;
}

async function installationId() {
  const stored = await chrome.storage.local.get("mskInstallId");
  if (stored.mskInstallId) return String(stored.mskInstallId);
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
  await chrome.storage.local.set({ mskInstallId: id });
  return id;
}

async function openLicenseGate() {
  const tabs = await chrome.tabs.query({ url: "https://lovable.dev/*" }).catch(() => []);
  for (const tab of tabs) {
    if (!tab.id) continue;
    await chrome.tabs.reload(tab.id).catch(() => {});
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { type: "MSK_OPEN" }).catch(() => {});
    }, 1400);
  }
}

async function lockLicense(reason = "LICENSE_EXPIRED") {
  await chrome.storage.local.remove(LICENSE_KEY);
  await chrome.storage.local.set({
    mskLicenseBlockedAt: Date.now(),
    mskLicenseBlockReason: reason,
  });
  await chrome.alarms.clear(EXPIRY_ALARM).catch(() => {});
  await openLicenseGate();
}

async function scheduleExactExpiry() {
  const license = await readLicense();
  await chrome.alarms.clear(EXPIRY_ALARM).catch(() => {});
  if (!license?.expires_at) return;
  const end = Date.parse(license.expires_at);
  if (!Number.isFinite(end)) return;
  if (end <= Date.now()) {
    await lockLicense("LICENSE_EXPIRED");
    return;
  }
  chrome.alarms.create(EXPIRY_ALARM, { when: end });
}

async function revalidateLicense() {
  const license = await readLicense();
  if (!license?.token || !license?.email) return;

  if (license.expires_at && Date.parse(license.expires_at) <= Date.now()) {
    await lockLicense("LICENSE_EXPIRED");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const installation_id = await installationId();
    const response = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        email: String(license.email).trim().toLowerCase(),
        token: String(license.token).trim().toUpperCase(),
        installation_id,
        device_fingerprint: installation_id,
        extension_version: chrome.runtime.getManifest().version,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.valid) {
      if (["LICENSE_EXPIRED", "LICENSE_INVALID", "LICENSE_REVOKED", "LICENSE_SUSPENDED", "EMAIL_MISMATCH", "DEVICE_LIMIT"].includes(String(data?.code || ""))) {
        await lockLicense(String(data.code));
      }
      return;
    }

    const next = {
      ...license,
      plan: data.license?.plan || license.plan,
      plan_name: data.license?.plan_name || license.plan_name,
      expires_at: data.license?.expires_at ?? null,
      features: data.license?.features || license.features || {},
      checkedAt: Date.now(),
    };
    await chrome.storage.local.set({ [LICENSE_KEY]: next });
    await scheduleExactExpiry();
  } catch {
    // Falha de rede nunca derruba uma licença ainda válida localmente.
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(RECHECK_ALARM, { periodInMinutes: RECHECK_MINUTES });
  void scheduleExactExpiry();
  void revalidateLicense();
});

chrome.runtime.onStartup?.addListener(() => {
  chrome.alarms.create(RECHECK_ALARM, { periodInMinutes: RECHECK_MINUTES });
  void scheduleExactExpiry();
  void revalidateLicense();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === EXPIRY_ALARM) void lockLicense("LICENSE_EXPIRED");
  if (alarm.name === RECHECK_ALARM) void revalidateLicense();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[LICENSE_KEY]) void scheduleExactExpiry();
});

chrome.alarms.create(RECHECK_ALARM, { periodInMinutes: RECHECK_MINUTES });
void scheduleExactExpiry();

export const mskLicenseWatch = { scheduleExactExpiry, revalidateLicense, lockLicense };
globalThis.MSK_LICENSE_WATCH = mskLicenseWatch;
