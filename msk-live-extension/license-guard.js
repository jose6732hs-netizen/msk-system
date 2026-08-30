/* MSK Live — guard permanente. A ferramenta só é injetada depois da licença. */
(function () {
  'use strict';
  if (window.__MSKLIVE_LICENSE_GUARD__) return;
  window.__MSKLIVE_LICENSE_GUARD__ = true;

  var ROOT = 'msklive-license-lock';
  var STYLE = 'msklive-license-lock-style';
  var currentLicensed = false;

  function ensureStyle() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent =
      '#' + ROOT + '{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(1,1,1,.88);backdrop-filter:blur(12px);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#fff}' +
      '#' + ROOT + ' .ml-card{width:min(460px,100%);border:1px solid rgba(168,85,247,.45);border-radius:24px;padding:24px;background:linear-gradient(180deg,#0d0d0d,#050505);box-shadow:0 30px 90px rgba(0,0,0,.75),0 0 38px rgba(57,255,20,.08)}' +
      '#' + ROOT + ' .ml-brand{font-size:22px;font-weight:950;letter-spacing:.06em;background:linear-gradient(90deg,#39ff14,#a855f7,#ff2bd6);-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '#' + ROOT + ' h2{font-size:20px;margin:15px 0 8px}' +
      '#' + ROOT + ' p{margin:0;color:#aaa0ad;font-size:13px;line-height:1.55}' +
      '#' + ROOT + ' .ml-status{margin:18px 0;padding:11px 12px;border:1px solid rgba(255,43,214,.28);border-radius:12px;background:rgba(255,43,214,.06);font-size:12px;color:#f0d9ed}' +
      '#' + ROOT + ' .ml-actions{display:grid;gap:9px}' +
      '#' + ROOT + ' button{min-height:46px;border-radius:12px;border:1px solid rgba(57,255,20,.55);background:linear-gradient(90deg,rgba(57,255,20,.14),rgba(168,85,247,.14));color:#fff;font-weight:850;cursor:pointer}' +
      '#' + ROOT + ' button+button{border-color:#302337;background:#111;color:#ddd}' +
      'html[data-msklive-locked="1"]{overflow:hidden!important}';
    (document.head || document.documentElement).appendChild(s);
  }
  function mount(message, busy) {
    ensureStyle();
    document.documentElement.setAttribute('data-msklive-locked', '1');
    var root = document.getElementById(ROOT);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT;
      root.innerHTML = '<div class="ml-card"><div class="ml-brand">MSK LIVE</div><h2>Licença obrigatória</h2><p>Antes de usar a ferramenta, confirme uma licença ativa do MSK LIVE no MSK SYSTEM.</p><div class="ml-status" id="ml-license-status"></div><div class="ml-actions"><button id="ml-open-license">ABRIR PAINEL DE LICENÇA</button><button id="ml-buy-license">PEDIR / RENOVAR LICENÇA</button></div></div>';
      (document.documentElement || document.body).appendChild(root);
      root.querySelector('#ml-open-license').addEventListener('click', function () {
        chrome.runtime.sendMessage({ type: 'MSKLIVE_OPEN_DASHBOARD' }, function () { void chrome.runtime.lastError; });
      });
      root.querySelector('#ml-buy-license').addEventListener('click', function () {
        chrome.runtime.sendMessage({ type: 'MSKLIVE_OPEN_PLANS' }, function () { void chrome.runtime.lastError; });
      });
    }
    var st = root.querySelector('#ml-license-status');
    if (st) st.textContent = busy ? 'Validando sua licença no MSK SYSTEM…' : (message || 'Licença não liberada.');
  }
  function unlock() {
    currentLicensed = true;
    document.documentElement.setAttribute('data-msklive-locked', '0');
    var root = document.getElementById(ROOT);
    if (root) root.remove();
  }
  function lock(message) {
    currentLicensed = false;
    mount(message, false);
  }
  function bootstrap(force) {
    if (!currentLicensed) mount('', true);
    chrome.runtime.sendMessage({ type: force ? 'MSKLIVE_LICENSE_FORCE_REFRESH' : 'MSKLIVE_LICENSE_BOOTSTRAP' }, function (res) {
      void chrome.runtime.lastError;
      if (res && res.licensed) unlock();
      else lock((res && res.message) || 'Sua licença está expirada, inativa ou não pertence ao MSK LIVE.');
    });
  }

  mount('', true);
  bootstrap(false);
  setInterval(function () { bootstrap(false); }, 30 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) bootstrap(true); });
  window.addEventListener('focus', function () { bootstrap(true); });
  chrome.runtime.onMessage.addListener(function (m) {
    if (!m || m.type !== 'MSKLIVE_LICENSE_CHANGED') return;
    if (m.licensed) unlock(); else lock(m.message || 'Licença não liberada.');
  });
})();
