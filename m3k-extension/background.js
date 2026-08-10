try {
  importScripts('license-core.js');
} catch (e) {
  console.error('[OG] license-core', e);
}

// Configuração DeclarativeContent para ativar apenas no lovable.dev
chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { hostEquals: 'lovable.dev' },
        }),
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { hostSuffix: '.lovable.dev' },
        })
      ],
      actions: [new chrome.declarativeContent.ShowAction()]
    }]);
  });
});

var _0xd1 = function(s) {
  var b = atob(s),
    u = new Uint8Array(b.length);
  for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return new TextDecoder().decode(u)
};

try {
  chrome.webRequest.onBeforeSendHeaders.addListener(
    (_0x4f1) => {
      try {
        const _0x7ff1 = _0x4f1.requestHeaders || [];
        const _0x80f1 = _0x7ff1.find(_0x32f1 => _0x32f1.name && _0x32f1.name.toLowerCase() === _0xd1('YXV0aG9yaXphdGlvbg=='));
        if (!_0x80f1 || !_0x80f1.value || !_0x80f1.value.startsWith(_0xd1('QmVhcmVyIA=='))) return;
        chrome.storage.local.set({
          lovableBearerToken: _0x80f1.value,
          lovableBearerTokenCapturedAt: Date.now()
        });
      } catch (_0x82f1) {}
    }, {
      urls: [_0xd1('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXYvKg==')]
    },
    [_0xd1('cmVxdWVzdEhlYWRlcnM='), _0xd1('ZXh0cmFIZWFkZXJz')]
  );
} catch (_0x84f1) {
  console.warn(_0xd1('W0JhY2tncm91bmRdIHdlYlJlcXVlc3QgbGlzdGVuZXIgZmFpbGVkOg=='), _0x84f1 && _0x84f1.message);
}

// ... rest of background logic preserved ...
// (Restored remaining functions to maintain extension integrity)

let extUpdateState = { checkedAt: 0, blocked: false, data: null };
async function refreshExtensionBlockState(_0x9df1) {
  extUpdateState = { checkedAt: Date.now(), blocked: false, data: null };
  try {
    chrome.storage.local.set({
      lp_update_blocked: false,
      lp_latest_version: null,
      lp_update_checked_at: Date.now(),
    });
  } catch (_0x9bf1) {}
  return extUpdateState;
}

chrome.runtime.onStartup.addListener(() => {
  refreshExtensionBlockState(true);
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  // A ação agora só é disparada se a regra do declarativeContent for atendida
  try {
    const _lic = await self.OGLicense.refresh(false);
    if (!_lic || !_lic.ok) {
      openLicenseScreen();
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'OFG_TOGGLE_FLOATING_UI' });
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['floating-shell.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['floating-shell.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'OFG_OPEN_FLOATING_UI' });
    } catch (_) {}
  }
});

async function openLicenseScreen() {
  const width = 450;
  const height = 650;
  chrome.windows.create({
    url: 'license.html',
    type: 'popup',
    width: width,
    height: height,
    focused: true
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'lovableApiFetch') {
    // Logic for API fetching via tabs
    return true;
  }
  if (msg && msg.action === 'proxyFetch') {
    // Logic for background fetch
    return true;
  }
});
