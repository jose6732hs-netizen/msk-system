(() => {
  "use strict";
  if (window.__MSK_CHATGPT_LIVE_WATCHDOG__) return;
  window.__MSK_CHATGPT_LIVE_WATCHDOG__ = true;

  let armedUntil = 0;
  let recoverTimer = 0;
  const RELOAD_KEY = "mskChatgptAutoReloadAt";

  const composer = () => document.querySelector('#prompt-textarea, textarea[placeholder], [contenteditable="true"][role="textbox"], div[contenteditable="true"]');

  const loginLike = () => {
    if (composer()) return false;
    const text = String(document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 5000);
    return /(log in|sign in|entrar|fa[cç]a login|create account|criar conta)/i.test(text);
  };

  const tryRecover = () => {
    clearTimeout(recoverTimer);
    if (Date.now() > armedUntil) return;
    if (composer()) return;
    if (document.readyState !== "complete" || !document.body) {
      recoverTimer = window.setTimeout(tryRecover, 250);
      return;
    }
    if (loginLike()) return;

    const previous = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - previous < 12000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));

    // Recuperação silenciosa da própria aba em segundo plano; nunca muda o foco do usuário.
    recoverTimer = window.setTimeout(() => location.reload(), 80);
  };

  const arm = () => {
    armedUntil = Date.now() + 30000;
    if (composer()) return;
    clearTimeout(recoverTimer);
    recoverTimer = window.setTimeout(tryRecover, 900);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "MSK_CHATGPT_LIVE_PREPARE") {
      arm();
      sendResponse({ ok:true, ready:!!composer(), background:true });
      return;
    }
    if (["MSK_CHATGPT_INIT", "MSK_CHATGPT_PROMPT", "MSK_CHATGPT_BRIDGE_INIT", "MSK_CHATGPT_BRIDGE_SEND"].includes(message?.type)) arm();
  });

  window.addEventListener("pageshow", () => {
    if (Date.now() <= armedUntil) window.setTimeout(tryRecover, 300);
  });
})();
