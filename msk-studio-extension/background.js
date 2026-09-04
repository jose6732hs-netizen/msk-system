/*! MSK SYSTEM • SOFTWARE PROPRIETÁRIO E RESTRITO • Cópia, clonagem, modificação ou redistribuição não autorizada é proibida. */
chrome.action.onClicked.addListener((tab) => {
chrome.sidePanel.open({ tabId: tab.id });
});

const MSK_CATALOG_ALLOWED = [
  'https://msksystem.online/api/public/extension-models',
  'https://msk-system.lovable.app/api/public/extension-models',
];

async function mskFetchCatalog(url) {
  if (!MSK_CATALOG_ALLOWED.includes(url)) return { ok: false, error: 'url_not_allowed' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: controller.signal });
    if (!response.ok) return { ok: false, error: `http_${response.status}` };
    const data = await response.json();
    return { ok: true, models: Array.isArray(data?.models) ? data.models : [] };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'msk-fetch-catalog') return false;
  mskFetchCatalog(String(message.url || '')).then(sendResponse);
  return true;
});
