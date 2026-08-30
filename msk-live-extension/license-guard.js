/* MSK Live — popup de licença centralizado. A ferramenta só libera após validação. */
(function () {
  'use strict';
  if (window.__MSKLIVE_LICENSE_GUARD__) return;
  window.__MSKLIVE_LICENSE_GUARD__ = true;

  var ROOT = 'msklive-license-lock';
  var STYLE = 'msklive-license-lock-style';
  var currentLicensed = false;
  var validating = false;

  function send(message) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (response) {
          void chrome.runtime.lastError;
          resolve(response || null);
        });
      } catch (e) { resolve(null); }
    });
  }

  function ensureStyle() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent =
      '#' + ROOT + '{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.56);backdrop-filter:blur(7px);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#fff}' +
      '#' + ROOT + ' *{box-sizing:border-box}' +
      '#' + ROOT + ' .ml-card{width:min(440px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;border:1px solid rgba(168,85,247,.48);border-radius:24px;padding:22px;background:linear-gradient(180deg,rgba(15,15,17,.99),rgba(5,5,6,.99));box-shadow:0 32px 100px rgba(0,0,0,.78),0 0 42px rgba(168,85,247,.15);animation:mlPop .18s ease-out}' +
      '@keyframes mlPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}' +
      '#' + ROOT + ' .ml-top{display:flex;align-items:center;justify-content:space-between;gap:12px}' +
      '#' + ROOT + ' .ml-brand{font-size:22px;font-weight:950;letter-spacing:.06em;background:linear-gradient(90deg,#39ff14,#a855f7,#ff2bd6);-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '#' + ROOT + ' .ml-pill{font-size:9px;font-weight:900;letter-spacing:.1em;color:#bfffb3;border:1px solid rgba(57,255,20,.28);background:rgba(57,255,20,.07);border-radius:999px;padding:6px 8px}' +
      '#' + ROOT + ' h2{font-size:21px;line-height:1.2;margin:16px 0 7px}' +
      '#' + ROOT + ' .ml-copy{margin:0;color:#aaa0ad;font-size:12.5px;line-height:1.55}' +
      '#' + ROOT + ' .ml-status{margin:15px 0 14px;padding:10px 11px;border:1px solid rgba(255,43,214,.28);border-radius:11px;background:rgba(255,43,214,.06);font-size:11.5px;color:#f0d9ed;line-height:1.45}' +
      '#' + ROOT + ' .ml-status[data-tone="ok"]{border-color:rgba(57,255,20,.35);background:rgba(57,255,20,.07);color:#d9ffd3}' +
      '#' + ROOT + ' .ml-status[data-tone="busy"]{border-color:rgba(168,85,247,.38);background:rgba(168,85,247,.08);color:#eadcff}' +
      '#' + ROOT + ' .ml-form{display:grid;gap:10px}' +
      '#' + ROOT + ' label{display:block;margin:0 0 5px;color:#b9aebe;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.11em}' +
      '#' + ROOT + ' input{width:100%;height:46px;border-radius:11px;border:1px solid #34283a;background:#09090a;color:#fff;padding:0 12px;outline:none;font-size:13px}' +
      '#' + ROOT + ' input:focus{border-color:#a855f7;box-shadow:0 0 0 3px rgba(168,85,247,.11)}' +
      '#' + ROOT + ' .ml-actions{display:grid;gap:8px;margin-top:11px}' +
      '#' + ROOT + ' button{min-height:46px;border-radius:11px;border:1px solid #33263a;background:#111;color:#fff;font-size:11.5px;font-weight:900;cursor:pointer;padding:0 12px}' +
      '#' + ROOT + ' button:disabled{opacity:.58;cursor:wait}' +
      '#' + ROOT + ' .ml-primary{border-color:rgba(57,255,20,.58);background:linear-gradient(90deg,rgba(57,255,20,.16),rgba(168,85,247,.16),rgba(255,43,214,.13))}' +
      '#' + ROOT + ' .ml-links{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '#' + ROOT + ' .ml-note{margin-top:12px;padding-top:12px;border-top:1px solid #211825;color:#746b78;font-size:9.5px;line-height:1.45;text-align:center}' +
      'html[data-msklive-locked="1"]{overflow:hidden!important}' +
      '@media(max-width:520px){#' + ROOT + '{padding:10px}#' + ROOT + ' .ml-card{padding:18px;border-radius:20px}#' + ROOT + ' .ml-links{grid-template-columns:1fr}}';
    (document.head || document.documentElement).appendChild(s);
  }

  function status(text, tone) {
    var el = document.getElementById('ml-license-status');
    if (!el) return;
    el.textContent = text || '';
    el.setAttribute('data-tone', tone || 'err');
  }

  function setBusy(on) {
    validating = !!on;
    var btn = document.getElementById('ml-license-submit');
    if (btn) {
      btn.disabled = validating;
      btn.textContent = validating ? 'VALIDANDO…' : 'VALIDAR E LIBERAR MSK LIVE';
    }
  }

  function mount(message, busy) {
    ensureStyle();
    document.documentElement.setAttribute('data-msklive-locked', '1');
    var root = document.getElementById(ROOT);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT;
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'Validar licença MSK LIVE');
      root.innerHTML =
        '<div class="ml-card">' +
          '<div class="ml-top"><div class="ml-brand">MSK LIVE</div><div class="ml-pill">LICENÇA OBRIGATÓRIA</div></div>' +
          '<h2>Validar licença</h2>' +
          '<p class="ml-copy">Antes de usar a ferramenta, valide uma licença ativa do MSK LIVE. Licenças de outros produtos MSK não liberam esta extensão.</p>' +
          '<div class="ml-status" id="ml-license-status" data-tone="busy">Conferindo sua licença no MSK SYSTEM…</div>' +
          '<form class="ml-form" id="ml-license-form">' +
            '<div><label for="ml-license-email">E-mail da conta MSK</label><input id="ml-license-email" type="email" autocomplete="email" placeholder="voce@email.com" required></div>' +
            '<div><label for="ml-license-token">Licença MSK LIVE</label><input id="ml-license-token" type="text" autocomplete="off" spellcheck="false" placeholder="MSK-XXXX-XXXX-XXXX-XXXX" required></div>' +
            '<button class="ml-primary" id="ml-license-submit" type="submit">VALIDAR E LIBERAR MSK LIVE</button>' +
          '</form>' +
          '<div class="ml-actions"><div class="ml-links"><button id="ml-buy-license" type="button">PEDIR / RENOVAR LICENÇA</button><button id="ml-open-account" type="button">MEU PAINEL</button></div></div>' +
          '<div class="ml-note">A ferramenta permanece bloqueada até o servidor confirmar produto, plano e validade.</div>' +
        '</div>';
      (document.documentElement || document.body).appendChild(root);

      var form = root.querySelector('#ml-license-form');
      var email = root.querySelector('#ml-license-email');
      var token = root.querySelector('#ml-license-token');
      token.addEventListener('input', function () {
        token.value = String(token.value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').slice(0, 64);
      });
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (validating) return;
        var mail = String(email.value || '').trim().toLowerCase();
        var key = String(token.value || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
          status('Informe o e-mail da sua conta MSK.', 'err');
          email.focus();
          return;
        }
        if (key.length < 8) {
          status('Digite a licença MSK LIVE completa.', 'err');
          token.focus();
          return;
        }
        setBusy(true);
        status('Validando licença no MSK SYSTEM…', 'busy');
        var result = await send({ type: 'MSKLIVE_LICENSE_ACTIVATE', email: mail, token: key });
        setBusy(false);
        if (result && result.licensed) {
          status('Licença validada. Liberando a ferramenta…', 'ok');
          window.setTimeout(unlock, 280);
          return;
        }
        status((result && result.message) || 'Licença não liberada. Confira os dados ou renove o plano.', 'err');
      });
      root.querySelector('#ml-buy-license').addEventListener('click', function () {
        send({ type: 'MSKLIVE_OPEN_PLANS' });
      });
      root.querySelector('#ml-open-account').addEventListener('click', function () {
        send({ type: 'MSKLIVE_OPEN_ACCOUNT' });
      });
      send({ type: 'MSKLIVE_LICENSE_FORM_STATE' }).then(function (saved) {
        if (!saved) return;
        if (saved.email) email.value = saved.email;
        if (saved.token) token.value = saved.token;
      });
    }
    status(busy ? 'Conferindo sua licença no MSK SYSTEM…' : (message || 'Informe e-mail e licença para continuar.'), busy ? 'busy' : 'err');
    setBusy(!!busy);
  }

  function unlock() {
    currentLicensed = true;
    validating = false;
    document.documentElement.setAttribute('data-msklive-locked', '0');
    var root = document.getElementById(ROOT);
    if (root) root.remove();
  }

  function lock(message) {
    currentLicensed = false;
    mount(message || 'Sua licença não está ativa.', false);
  }

  async function bootstrap(force) {
    if (!currentLicensed) mount('', true);
    var res = await send({ type: force ? 'MSKLIVE_LICENSE_FORCE_REFRESH' : 'MSKLIVE_LICENSE_BOOTSTRAP' });
    if (res && res.licensed) unlock();
    else lock((res && res.message) || 'Sua licença está expirada, inativa ou não pertence ao MSK LIVE.');
  }

  mount('', true);
  bootstrap(false);
  setInterval(function () { bootstrap(false); }, 30 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) bootstrap(true); });
  window.addEventListener('focus', function () { bootstrap(true); });
  chrome.runtime.onMessage.addListener(function (m) {
    if (!m || m.type !== 'MSKLIVE_LICENSE_CHANGED') return;
    if (m.licensed) unlock();
    else lock(m.message || 'Licença não liberada.');
  });
})();
