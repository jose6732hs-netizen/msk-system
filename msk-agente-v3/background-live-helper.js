const MSK_CHATGPT_URL = /^https:\/\/chatgpt\.com\//i;

const mskLiveKeepTabReady = async (tabId, projectId = "") => {
  const id = Number(tabId || 0);
  if (!id) return false;
  const tab = await chrome.tabs.get(id).catch(() => null);
  if (!tab || !MSK_CHATGPT_URL.test(String(tab.url || ""))) return false;

  // Nunca toma foco do usuário. Apenas impede descarte e acorda a ponte em segundo plano.
  await chrome.tabs.update(id, { autoDiscardable:false }).catch(() => {});
  if (tab.discarded) {
    await chrome.tabs.reload(id).catch(() => {});
    return true;
  }

  await chrome.tabs.sendMessage(id, {
    type:"MSK_CHATGPT_LIVE_PREPARE",
    payload:{ projectId:String(projectId || "") }
  }).catch(() => null);

  try {
    const ping = await chrome.tabs.sendMessage(id, { type:"MSK_CHATGPT_PING" });
    if (ping?.ok) return true;
  } catch {}

  // Reinjeção automática: elimina a necessidade de F5 manual.
  await chrome.scripting.executeScript({
    target:{ tabId:id },
    files:["chatgpt-live-watchdog.js", "chatgpt-bridge.js"]
  }).catch(() => null);
  return true;
};

// Resposta imediata para texto simples: a UI da extensão não fica esperando o DOM do ChatGPT.
// O background original continua executando o envio real e os streams/erros continuam voltando à MSK.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "MSK_CHATGPT_SEND") return;

  const payload = message.payload || {};
  const projectId = String(payload.projectId || payload.lovable_project_id || "").trim();
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (!projectId) return;

  (async () => {
    const key = `mskChatBinding:${projectId}`;
    const binding = (await chrome.storage.local.get(key))[key] || null;
    const tabId = Number(binding?.tabId || 0);
    if (!tabId) return;

    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !MSK_CHATGPT_URL.test(String(tab.url || ""))) return;

    mskLiveKeepTabReady(tabId, projectId).catch(() => {});

    // Para anexos, deixa o fluxo original confirmar antes de limpar os arquivos temporários.
    if (attachments.length) return;

    sendResponse({
      ok:true,
      accepted:true,
      live:true,
      background:true,
      tabId
    });
  })().catch(() => {});

  return true;
});

// Assim que a própria ponte confirma que o prompt foi enviado, resincroniza o GPT
// silenciosamente em segundo plano. Não abre aba, não muda foco e não exige F5.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "MSK_CHATGPT_STATUS") return;
  if (String(message.payload?.status || "") !== "sent") return;
  const tabId = Number(sender.tab?.id || 0);
  if (!tabId || !MSK_CHATGPT_URL.test(String(sender.tab?.url || ""))) return;
  const projectId = String(message.payload?.projectId || "");
  mskLiveKeepTabReady(tabId, projectId).catch(() => {});
  window.setTimeout?.(() => mskLiveKeepTabReady(tabId, projectId).catch(() => {}), 650);
});

// Mantém qualquer aba vinculada do ChatGPT pronta sem ativá-la.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!MSK_CHATGPT_URL.test(String(tab?.url || ""))) return;
  if (changeInfo.status === "complete") {
    chrome.tabs.update(tabId, { autoDiscardable:false }).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ url:["https://chatgpt.com/*"] }).then(tabs => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.update(tab.id, { autoDiscardable:false }).catch(() => {});
    }
  }).catch(() => {});
});
