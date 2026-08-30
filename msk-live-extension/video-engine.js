/* MSK Live — gate do Video Engine. O motor real só carrega com licença válida. */
(function () {
  'use strict';
  var msg = document.createElement('div');
  msg.id = 'msklive-engine-license-check';
  msg.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#050505;color:#fff;font:700 14px Inter,system-ui,sans-serif;letter-spacing:.02em';
  msg.textContent = 'Validando licença MSK LIVE…';
  document.documentElement.appendChild(msg);

  chrome.runtime.sendMessage({ type: 'MSKLIVE_LICENSE_FORCE_REFRESH' }, function (res) {
    void chrome.runtime.lastError;
    if (!res || !res.licensed) {
      location.replace(chrome.runtime.getURL('start.html?reason=' + encodeURIComponent((res && res.code) || 'LICENSE_REQUIRED')));
      return;
    }
    try { msg.remove(); } catch (e) {}
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('video-engine-core.js');
    s.onerror = function () { document.body.textContent = 'Não foi possível iniciar o Video Engine.'; };
    (document.head || document.documentElement).appendChild(s);
  });
})();
