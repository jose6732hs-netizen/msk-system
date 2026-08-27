/* Guard de licença nas páginas da Lovable — bloqueia a UI imediatamente ao vencer. */
(function () {
  "use strict";
  if (window.__OG_LICENSE_GUARD__) return;
  window.__OG_LICENSE_GUARD__ = true;

  var STYLE_ID = "og-license-lock-style";
  var expiryTimer = null;

  function lockCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "html[data-og-locked='1'] .og-floating-shell," +
      "html[data-og-locked='1'] #og-floating-root," +
      "html[data-og-locked='1'] .ts-overlay-root," +
      "html[data-og-locked='1'] .og-mini-orb," +
      "html[data-og-locked='1'] #ofg-floating-window{display:none !important;}" +
      "#og-lic-banner{position:fixed;z-index:2147483646;right:18px;bottom:18px;max-width:330px;" +
      "font-family:Inter,'Segoe UI',system-ui,sans-serif;color:#eaf2ff;background:rgba(10,14,26,.96);" +
      "border:1px solid rgba(255,47,178,.35);border-radius:16px;padding:16px 18px;" +
      "box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 40px rgba(255,47,178,.18);backdrop-filter:blur(14px)}" +
      "#og-lic-banner h4{margin:0 0 6px;font-size:14px}" +
      "#og-lic-banner p{margin:0 0 12px;font-size:12px;color:#8fa3c4;line-height:1.4}" +
      "#og-lic-banner button{width:100%;border:0;border-radius:10px;padding:11px;cursor:pointer;font-weight:800;" +
      "font-size:12.5px;color:#06070d;background:linear-gradient(90deg,#ff2fb2,#38bdf8 60%,#22ffa7)}" +
      "#og-lic-banner .og-lic-x{position:absolute;top:8px;right:12px;background:none;width:auto;color:#8fa3c4;font-size:16px}";
    (document.head || document.documentElement).appendChild(s);
  }

  function banner() {
    if (document.getElementById("og-lic-banner")) return;
    var d = document.createElement("div");
    d.id = "og-lic-banner";
    d.innerHTML =
      "<button class='og-lic-x' title='Fechar'>×</button>" +
      "<h4 style='display:flex;align-items:center;gap:8px;'><span style='font-size:18px;'>🔒</span> MSK SISTEM</h4>" +
      "<p>Sua licença expirou ou não foi encontrada. Insira uma nova licença para continuar usando a extensão.</p>" +
      "<div style='display:flex;flex-direction:column;gap:8px;'>" +
        "<button id='og-lic-open'>INSERIR NOVA LICENÇA</button>" +
        "<a href='https://msksystem.online/planos' target='_blank' rel='noopener' style='text-align:center;font-size:11px;color:#38bdf8;text-decoration:none;font-weight:bold;text-transform:uppercase;'>VER PLANOS ↗</a>" +
      "</div>";
    document.documentElement.appendChild(d);
    d.querySelector(".og-lic-x").addEventListener("click", function () { d.remove(); });
    d.querySelector("#og-lic-open").addEventListener("click", function () {
      chrome.runtime.sendMessage({ type: "OG_OPEN_LICENSE" }, function () {
        void chrome.runtime.lastError;
      });
    });
  }

  function apply(licensed) {
    window.__OG_LICENSED__ = !!licensed;
    lockCss();
    document.documentElement.setAttribute("data-og-locked", licensed ? "0" : "1");
    if (!licensed) banner();
    else {
      var b = document.getElementById("og-lic-banner");
      if (b) b.remove();
    }
  }

  function scheduleExpiry(expiresAt) {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    if (!expiresAt) return;
    var end = Date.parse(expiresAt);
    if (!Number.isFinite(end)) return;
    var left = end - Date.now();
    if (left <= 0) {
      expireNow();
      return;
    }
    expiryTimer = setTimeout(expireNow, Math.min(left + 25, 2147483647));
  }

  function expireNow() {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    apply(false);
    chrome.runtime.sendMessage({ type: "OG_LICENSE_EXPIRED_LOCAL" }, function () {
      void chrome.runtime.lastError;
    });
  }

  function check() {
    chrome.runtime.sendMessage({ type: "OG_LICENSE_STATUS" }, function (res) {
      void chrome.runtime.lastError;
      var licensed = !!(res && res.licensed);
      if (licensed && res.expiresAt && Date.parse(res.expiresAt) <= Date.now()) {
        expireNow();
        return;
      }
      apply(licensed);
      if (licensed) scheduleExpiry(res && res.expiresAt);
      else scheduleExpiry(null);
    });
  }

  apply(false);
  check();
  setInterval(check, 30 * 1000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) check();
  });
  window.addEventListener("focus", check);

  chrome.runtime.onMessage.addListener(function (m) {
    if (!m || m.type !== "OG_LICENSE_CHANGED") return;
    apply(!!m.licensed);
    if (!m.licensed) scheduleExpiry(null);
  });
})();
