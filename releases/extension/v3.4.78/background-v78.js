// MSK v3.4.78 — canal rápido de controle remoto e notificações.
// Mantém compatibilidade com o canal legado, mas permite ao content script
// consultar bloqueio/mensagens em baixa latência sem depender do ciclo antigo.
const MSK_V78_ORIGIN = 'https://msksystem.online';

async function v78AuthContext() {
  const stored = await chrome.storage.local.get(['mskLicense', 'mskInstallationId']);
  const license = stored?.mskLicense || null;
  const token = String(license?.token || license?.access_token || '').trim();
  const installationId = String(stored?.mskInstallationId || '').trim();
  return { license, token, installationId };
}

async function v78PullControl() {
  const { license, token, installationId } = await v78AuthContext();
  if (!token || !installationId) {
    return { ok: false, code: !token ? 'MSK_LICENSE_TOKEN_MISSING' : 'MSK_INSTALLATION_ID_MISSING', commands: [], license_status: String(license?.status || '') };
  }
  const version = chrome.runtime.getManifest().version;
  const url = `${MSK_V78_ORIGIN}/api/extension/control?installation_id=${encodeURIComponent(installationId)}&version=${encodeURIComponent(version)}&_=${Date.now()}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-MSK-Installation-Id': installationId,
        'X-MSK-Extension-Version': version,
        'X-MSK-Extension-Id': chrome.runtime.id
      }
    });
    const data = await response.json().catch(() => ({}));
    const commands = Array.isArray(data?.commands) ? data.commands
      : Array.isArray(data?.messages) ? data.messages
      : Array.isArray(data?.notifications) ? data.notifications
      : [];
    return {
      ok: response.ok,
      status: response.status,
      commands,
      control: data?.control || null,
      integrity: data?.integrity || null,
      blocked: data?.blocked === true || data?.control?.blocked === true || data?.integrity?.blocked === true,
      code: String(data?.code || ''),
      license_status: String(license?.status || '')
    };
  } catch (error) {
    return { ok: false, status: 0, code: 'MSK_CONTROL_NETWORK_UNAVAILABLE', commands: [], error: error?.message || 'Falha ao consultar o controle MSK.' };
  }
}

async function v78AckControl(id) {
  const { token, installationId } = await v78AuthContext();
  if (!token || !installationId || !id) return { ok: false };
  const version = chrome.runtime.getManifest().version;
  try {
    const response = await fetch(`${MSK_V78_ORIGIN}/api/extension/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-MSK-Installation-Id': installationId,
        'X-MSK-Extension-Version': version,
        'X-MSK-Extension-Id': chrome.runtime.id
      },
      body: JSON.stringify({ command_id: String(id) })
    });
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
  } catch (error) {
    return { ok: false, code: 'MSK_CONTROL_ACK_FAILED', error: error?.message || '' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'MSK_V78_CONTROL_POLL') {
    v78PullControl().then(sendResponse, error => sendResponse({ ok: false, commands: [], error: error?.message || '' }));
    return true;
  }
  if (message?.type === 'MSK_V78_CONTROL_ACK') {
    v78AckControl(message?.id || message?.command_id).then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  }
  return undefined;
});

async function v78BroadcastLicenseState(value) {
  const status = String(value?.status || '').toLowerCase();
  const blocked = value?.blocked === true || ['blocked', 'revoked', 'suspended', 'inactive', 'cancelled', 'canceled'].includes(status);
  if (!blocked) return;
  const tabs = await chrome.tabs.query({ url: 'https://lovable.dev/*' }).catch(() => []);
  for (const tab of tabs) {
    if (!tab?.id) continue;
    chrome.tabs.sendMessage(tab.id, { type: 'MSK_V78_CONTROL_PUSH', blocked: true, control: { blocked: true, status } }).catch(() => {});
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes?.mskLicense?.newValue) void v78BroadcastLicenseState(changes.mskLicense.newValue);
});