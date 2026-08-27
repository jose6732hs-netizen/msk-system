try {
  importScripts('license-core.js');
} catch (e) {
  console.error('[MSK] license-core', e);
}

const LICENSE_HEARTBEAT_ALARM = 'msk-license-heartbeat';
const LICENSE_EXPIRY_ALARM = 'msk-license-expiry';
const LOVABLE_URLS = ['https://lovable.dev/*', 'https://*.lovable.dev/*'];
let licenseWindowId = null;
let lastLicenseState = null;

function configureDeclarativeContent() {
  try {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
      chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({ pageUrl: { hostEquals: 'lovable.dev' } }),
          new chrome.declarativeContent.PageStateMatcher({ pageUrl: { hostSuffix: '.lovable.dev' } })
        ],
        actions: [new chrome.declarativeContent.ShowAction()]
      }]);
    });
  } catch (e) {
    console.warn('[MSK] declarativeContent', e && e.message);
  }
}

function configureLicenseAlarms() {
  try {
    chrome.alarms.create(LICENSE_HEARTBEAT_ALARM, { periodInMinutes: 1 });
  } catch (e) {
    console.warn('[MSK] heartbeat alarm', e && e.message);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  configureDeclarativeContent();
  configureLicenseAlarms();
  void monitorLicense(true, false);
});

chrome.runtime.onStartup.addListener(() => {
  configureLicenseAlarms();
  void monitorLicense(true, false);
});

var _0xd1 = function(s) {
  var b = atob(s), u = new Uint8Array(b.length);
  for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return new TextDecoder().decode(u);
};

try {
  chrome.webRequest.onBeforeSendHeaders.addListener(
    (_0x4f1) => {
      try {
        const headers = _0x4f1.requestHeaders || [];
        const auth = headers.find(h => h.name && h.name.toLowerCase() === _0xd1('YXV0aG9yaXphdGlvbg=='));
        if (!auth || !auth.value || !auth.value.startsWith(_0xd1('QmVhcmVyIA=='))) return;
        chrome.storage.local.set({ lovableBearerToken: auth.value, lovableBearerTokenCapturedAt: Date.now() });
      } catch (_) {}
    },
    { urls: [_0xd1('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXYvKg==')] },
    [_0xd1('cmVxdWVzdEhlYWRlcnM='), _0xd1('ZXh0cmFIZWFkZXJz')]
  );
} catch (e) {
  console.warn('[MSK] webRequest indisponível:', e && e.message);
}

async function getLovableTabs() {
  try {
    return await chrome.tabs.query({ url: LOVABLE_URLS });
  } catch (_) {
    return [];
  }
}

async function notifyLovableTabs(licensed, reason, reload) {
  const tabs = await getLovableTabs();
  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'OG_LICENSE_CHANGED',
        licensed: !!licensed,
        reason: reason || null,
      });
    } catch (_) {}
    if (reload && !licensed) {
      try { await chrome.tabs.reload(tab.id); } catch (_) {}
    }
  }));
}

async function openLicenseScreen() {
  const target = chrome.runtime.getURL('license.html');
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    for (const win of windows) {
      const found = (win.tabs || []).find(tab => tab.url === target);
      if (found) {
        licenseWindowId = win.id || null;
        if (win.id) await chrome.windows.update(win.id, { focused: true });
        if (found.id) await chrome.tabs.update(found.id, { active: true });
        return;
      }
    }
  } catch (_) {}

  try {
    const created = await chrome.windows.create({
      url: 'license.html',
      type: 'popup',
      width: 450,
      height: 650,
      focused: true,
    });
    licenseWindowId = created && created.id ? created.id : null;
  } catch (e) {
    console.error('[MSK] não foi possível abrir a licença', e);
  }
}

async function scheduleExpiry(state) {
  try { await chrome.alarms.clear(LICENSE_EXPIRY_ALARM); } catch (_) {}
  if (!state || !state.valid || !state.expires_at) return;
  const when = Date.parse(state.expires_at);
  if (!Number.isFinite(when)) return;
  if (when <= Date.now()) {
    await blockAndPrompt('LICENSE_EXPIRED', true);
    return;
  }
  try { chrome.alarms.create(LICENSE_EXPIRY_ALARM, { when }); } catch (_) {}
}

async function blockAndPrompt(reason, reloadLovable) {
  try {
    const current = await self.OGLicense.getState();
    await self.OGLicense.clear(reason || 'LICENSE_INACTIVE', current && current.state);
  } catch (_) {}
  try { await chrome.alarms.clear(LICENSE_EXPIRY_ALARM); } catch (_) {}
  lastLicenseState = false;
  await notifyLovableTabs(false, reason || 'LICENSE_INACTIVE', !!reloadLovable);
  await openLicenseScreen();
}

async function monitorLicense(force, promptWhenInvalid) {
  if (!self.OGLicense) {
    if (promptWhenInvalid) await openLicenseScreen();
    return { licensed: false, code: 'LICENSE_CORE_UNAVAILABLE' };
  }

  let result;
  try {
    result = await self.OGLicense.refresh(!!force);
  } catch (e) {
    console.error('[MSK] validação de licença', e);
    if (promptWhenInvalid) await openLicenseScreen();
    return { licensed: false, code: 'LICENSE_CHECK_FAILED' };
  }

  if (result && result.ok) {
    const saved = result.state || (await self.OGLicense.getState()).state;
    await scheduleExpiry(saved);
    if (lastLicenseState !== true) await notifyLovableTabs(true, null, false);
    lastLicenseState = true;
    return { licensed: true, state: saved };
  }

  const current = await self.OGLicense.getState();
  const state = (result && result.state) || current.state || null;
  const expiredByClock = !!(state && state.expires_at && Date.parse(state.expires_at) <= Date.now());
  const code = (result && result.code) || (state && state.reason) || 'LICENSE_INACTIVE';

  if (code === 'LICENSE_EXPIRED' || expiredByClock) {
    await blockAndPrompt('LICENSE_EXPIRED', true);
    return { licensed: false, code: 'LICENSE_EXPIRED' };
  }

  if (lastLicenseState !== false) await notifyLovableTabs(false, code, false);
  lastLicenseState = false;
  if (promptWhenInvalid && code !== 'NETWORK') await openLicenseScreen();
  return { licensed: false, code: code, state: state };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm) return;
  if (alarm.name === LICENSE_EXPIRY_ALARM) {
    void blockAndPrompt('LICENSE_EXPIRED', true);
    return;
  }
  if (alarm.name === LICENSE_HEARTBEAT_ALARM) {
    void monitorLicense(true, true);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.OG_LICENSE_STATE) return;
  const state = changes.OG_LICENSE_STATE.newValue;
  if (state && state.valid) void scheduleExpiry(state);
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (licenseWindowId === windowId) licenseWindowId = null;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  const checked = await monitorLicense(false, true);
  if (!checked.licensed) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'OFG_TOGGLE_FLOATING_UI' });
  } catch (_) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['floating-shell.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['floating-shell.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'OFG_OPEN_FLOATING_UI' });
    } catch (_) {}
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'OG_LICENSE_STATUS') {
    (async () => {
      const licensed = await self.OGLicense.isLicensed();
      const current = await self.OGLicense.getState();
      const state = current.state || null;
      const reason = licensed ? null : (state && state.reason) || 'LICENSE_INACTIVE';
      sendResponse({
        licensed: !!licensed,
        reason,
        expiresAt: state && state.expires_at ? state.expires_at : null,
      });
      if (!licensed && reason === 'LICENSE_EXPIRED') void blockAndPrompt('LICENSE_EXPIRED', true);
      else if (licensed) void scheduleExpiry(state);
    })();
    return true;
  }

  if (msg.type === 'OG_OPEN_LICENSE') {
    void openLicenseScreen();
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'OG_LICENSE_EXPIRED_LOCAL') {
    void blockAndPrompt('LICENSE_EXPIRED', true);
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'OG_LICENSE_OK') {
    (async () => {
      const checked = await monitorLicense(false, false);
      sendResponse({ ok: checked.licensed });
      if (checked.licensed) {
        const tabs = await getLovableTabs();
        if (tabs.length) {
          const target = tabs.find(t => t.active) || tabs[0];
          if (target && target.windowId) {
            try { await chrome.windows.update(target.windowId, { focused: true }); } catch (_) {}
          }
        }
      }
    })();
    return true;
  }

  if (msg.action === 'lovableApiFetch') {
    return true;
  }
  if (msg.action === 'proxyFetch') {
    return true;
  }
});

configureLicenseAlarms();
void monitorLicense(false, false);
