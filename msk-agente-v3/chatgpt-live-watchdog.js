(() => {
  "use strict";
  if (window.__MSK_CHATGPT_LIVE_WATCHDOG_3430__) return;
  window.__MSK_CHATGPT_LIVE_WATCHDOG_3430__ = true;

  let armedUntil = 0;
  let recoverTimer = 0;
  const RELOAD_KEY = "mskChatgptAutoReloadAt3430";

  const composer = () => document.querySelector('#prompt-textarea, textarea[placeholder], [contenteditable="true"][role="textbox"], div[contenteditable="true"]');

  const loginLike = () => {
    if (composer()) return false;
    const text = String(document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 5000);
    return /(log in|sign in|entrar|fa[cç]a login|create account|criar conta)/i.test(text);
  };

  const health = () => ({
    ok: !!composer(),
    ready: !!composer(),
    loginRequired: loginLike(),
    documentReady: document.readyState === "complete",
    background: document.hidden,
    url: location.href
  });

  const tryRecover = () => {
    clearTimeout(recoverTimer);
    if (Date.now() > armedUntil) return;
    if (composer()) return;
    if (document.readyState !== "complete" || !document.body) {
      recoverTimer = window.setTimeout(tryRecover, 180);
      return;
    }
    if (loginLike()) return;

    const previous = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - previous < 10000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    recoverTimer = window.setTimeout(() => location.reload(), 60);
  };

  const arm = () => {
    armedUntil = Date.now() + 45000;
    if (composer()) return;
    clearTimeout(recoverTimer);
    recoverTimer = window.setTimeout(tryRecover, 350);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "MSK_CHATGPT_LIVE_HEALTH") {
      const state = health();
      if (!state.ready && !state.loginRequired) arm();
      sendResponse(state);
      return;
    }
    if (message?.type === "MSK_CHATGPT_PING") {
      const state = health();
      if (!state.ready && !state.loginRequired) arm();
      sendResponse(state);
      return;
    }
    if (message?.type === "MSK_CHATGPT_LIVE_PREPARE") {
      arm();
      sendResponse(health());
      return;
    }
    if (["MSK_CHATGPT_INIT", "MSK_CHATGPT_PROMPT", "MSK_CHATGPT_BRIDGE_INIT", "MSK_CHATGPT_BRIDGE_SEND"].includes(message?.type)) arm();
  });

  const observer = new MutationObserver(() => {
    if (composer()) {
      clearTimeout(recoverTimer);
      armedUntil = 0;
    }
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.addEventListener("pageshow", () => {
    if (Date.now() <= armedUntil) window.setTimeout(tryRecover, 120);
  });
})();
