const MSK_CHATGPT_URL = /^https:\/\/chatgpt\.com\//i;
const mskNativeTabsSendMessage = chrome.tabs.sendMessage.bind(chrome.tabs);
const mskHealthReloadAt = new Map();

const mskInjectLiveWatchdog = async tabId => {
  const id = Number(tabId || 0);
  if (!id) return false;
  await chrome.scripting.executeScript({
    target:{ tabId:id },
    files:["chatgpt-live-watchdog.js"]
  }).catch(() => null);
  return true;
};

const mskGetChatGPTHealth = async (tabId, projectId = "") => {
  const id = Number(tabId || 0);
  if (!id) return { ok:false, ready:false, code:"CHATGPT_TAB_CLOSED" };
  const tab = await chrome.tabs.get(id).catch(() => null);
  if (!tab || !MSK_CHATGPT_URL.test(String(tab.url || ""))) {
    return { ok:false, ready:false, code:"CHATGPT_TAB_CLOSED" };
  }

  await chrome.tabs.update(id, { autoDiscardable:false }).catch(() => {});

  if (tab.discarded) {
    await chrome.tabs.reload(id).catch(() => {});
    mskHealthReloadAt.set(id, Date.now());
    return { ok:false, ready:false, reloading:true, code:"CHATGPT_COMPOSER_NOT_READY" };
  }

  await mskInjectLiveWatchdog(id);
  const health = await mskNativeTabsSendMessage(id, {
    type:"MSK_CHATGPT_LIVE_HEALTH",
    payload:{ projectId:String(projectId || "") }
  }).catch(() => null);

  if (health?.ready) return { ok:true, ready:true, background:true };
  if (health?.loginRequired) return { ok:false, ready:false, loginRequired:true, code:"CHATGPT_LOGIN_OR_READY_REQUIRED" };

  const lastReload = Number(mskHealthReloadAt.get(id) || 0);
  if (String(tab.status || "") === "complete" && Date.now() - lastReload > 8000) {
    mskHealthReloadAt.set(id, Date.now());
    await chrome.tabs.reload(id).catch(() => {});
    return { ok:false, ready:false, reloading:true, code:"CHATGPT_COMPOSER_NOT_READY" };
  }

  return { ok:false, ready:false, code:"CHATGPT_COMPOSER_NOT_READY" };
};

// Corrige o falso positivo do bridge: PING só é considerado pronto quando o
// composer do ChatGPT existe de verdade. Se não existir, a aba vinculada é
// recarregada silenciosamente e o background original continua tentando.
try {
  chrome.tabs.sendMessage = async (tabId, message, ...rest) => {
    if (message?.type === "MSK_CHATGPT_PING") {
      const health = await mskGetChatGPTHealth(tabId, message?.payload?.projectId || "");
      if (!health.ready) return health;
    }
    return mskNativeTabsSendMessage(tabId, message, ...rest);
  };
} catch {}

const mskLiveKeepTabReady = async (tabId, projectId = "") => {
  const id = Number(tabId || 0);
  if (!id) return false;
  const tab = await chrome.tabs.get(id).catch(() => null);
  if (!tab || !MSK_CHATGPT_URL.test(String(tab.url || ""))) return false;

  await chrome.tabs.update(id, { autoDiscardable:false }).catch(() => {});
  const health = await mskGetChatGPTHealth(id, projectId);
  if (health.ready) return true;

  // A recuperação é silenciosa. Nunca ativa nem troca a aba do usuário.
  return false;
};

// Acorda/repara a conversa em paralelo ao fluxo original, sem tomar o foco.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "MSK_CHATGPT_SEND") return;
  const payload = message.payload || {};
  const projectId = String(payload.projectId || payload.lovable_project_id || "").trim();
  if (!projectId) return;

  (async () => {
    const key = `mskChatBinding:${projectId}`;
    const binding = (await chrome.storage.local.get(key))[key] || null;
    const tabId = Number(binding?.tabId || 0);
    if (!tabId) return;
    await mskLiveKeepTabReady(tabId, projectId);
  })().catch(() => {});
});

// Assim que a ponte confirma o despacho, mantém a aba pronta para a resposta e
// para o próximo comando, ainda sem abrir o ChatGPT para o cliente.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "MSK_CHATGPT_STATUS") return;
  if (String(message.payload?.status || "") !== "sent") return;
  const tabId = Number(sender.tab?.id || 0);
  if (!tabId || !MSK_CHATGPT_URL.test(String(sender.tab?.url || ""))) return;
  const projectId = String(message.payload?.projectId || "");
  mskLiveKeepTabReady(tabId, projectId).catch(() => {});
  setTimeout(() => mskLiveKeepTabReady(tabId, projectId).catch(() => {}), 650);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!MSK_CHATGPT_URL.test(String(tab?.url || ""))) return;
  if (changeInfo.status === "complete") {
    chrome.tabs.update(tabId, { autoDiscardable:false }).catch(() => {});
    mskInjectLiveWatchdog(tabId).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ url:["https://chatgpt.com/*"] }).then(tabs => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.update(tab.id, { autoDiscardable:false }).catch(() => {});
      mskInjectLiveWatchdog(tab.id).catch(() => {});
    }
  }).catch(() => {});
});
