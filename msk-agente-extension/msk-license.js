/* MSK Agente — porta de entrada por e-mail + licença.
   Roda ANTES do content.js. Enquanto não houver licença válida, cria o
   #msk-root (o que faz o content.js abortar) e mostra apenas a bolinha
   flutuante com um card quadrado de login. */
(() => {
  if (window.__mskLicenseGate) return;
  window.__mskLicenseGate = true;
  if (document.querySelector("#msk-root")) return;

  const asset = (n) => chrome.runtime.getURL(`assets/${n}`);
  const root = document.createElement("div");
  root.id = "msk-root";
  root.className = "msk-gate-root";
  document.documentElement.appendChild(root);

  const shadowHost = document.createElement("div");
  root.appendChild(shadowHost);
  const sh = shadowHost.attachShadow({ mode: "open" });
  sh.innerHTML = `
  <style>
    :host{all:initial}
    *{box-sizing:border-box;font-family:Inter,"Segoe UI",system-ui,sans-serif}
    .wrap{position:fixed;right:18px;bottom:18px;z-index:2147483647;display:flex;flex-direction:column;align-items:flex-end;gap:12px}
    .orb{width:58px;height:58px;border-radius:50%;border:2px solid #ff2fb2;background:#0b0713;cursor:pointer;
      box-shadow:0 0 22px rgba(255,47,178,.65);display:grid;place-items:center;padding:0;transition:transform .15s}
    .orb:hover{transform:scale(1.07)}
    .orb img{width:34px;height:34px;border-radius:50%}
    .card{width:320px;height:320px;display:none;flex-direction:column;gap:10px;padding:16px;border-radius:18px;
      background:linear-gradient(160deg,#100a1c,#07060d);border:1px solid rgba(255,47,178,.45);
      box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 30px rgba(255,47,178,.25);color:#f5f3ff}
    .card.open{display:flex}
    .head{display:flex;align-items:center;gap:10px}
    .head img{width:30px;height:30px;border-radius:8px}
    .head b{font-size:13px;letter-spacing:.14em}
    .head small{display:block;font-size:10px;color:#b9a9d6;letter-spacing:.12em}
    label{font-size:10px;letter-spacing:.12em;color:#b9a9d6;text-transform:uppercase}
    input{width:100%;padding:10px 12px;border-radius:10px;background:#160f26;border:1px solid rgba(255,255,255,.12);
      color:#fff;font-size:13px;outline:none}
    input:focus{border-color:#ff2fb2;box-shadow:0 0 0 2px rgba(255,47,178,.2)}
    button.cta{margin-top:auto;width:100%;padding:12px;border:0;border-radius:12px;cursor:pointer;font-weight:700;
      font-size:13px;letter-spacing:.06em;color:#fff;background:linear-gradient(90deg,#ff2fb2,#7c3aed);
      box-shadow:0 8px 20px rgba(255,47,178,.35)}
    button.cta:disabled{opacity:.6;cursor:default}
    .msg{font-size:11.5px;line-height:1.35;min-height:32px;color:#ffb4d8}
    .msg.ok{color:#22ffa7}
    .ok-state{display:none;flex-direction:column;gap:8px;height:100%}
    .ok-state.open{display:flex}
    .plan{font-size:12px;color:#cdbdf0}
    .clock{font-variant-numeric:tabular-nums;font-size:26px;font-weight:800;color:#22ffa7;letter-spacing:.04em}
    .link{font-size:11px;color:#8b7fb0;text-decoration:none}
    .menu{display:none;flex-direction:column;align-items:flex-end;gap:8px}
    .menu.open{display:flex}
    .mini{display:flex;align-items:center;gap:8px}
    .mini span{font-size:11px;font-weight:600;letter-spacing:.06em;color:#f5f3ff;background:rgba(11,7,19,.92);
      border:1px solid rgba(255,47,178,.35);padding:5px 10px;border-radius:9px;white-space:nowrap}
    .mini button{width:44px;height:44px;border-radius:50%;border:2px solid #7c3aed;background:#0b0713;color:#fff;
      font-size:17px;cursor:pointer;display:grid;place-items:center;box-shadow:0 0 16px rgba(124,58,237,.5)}
    .mini.locked button{border-color:#5b4b78;box-shadow:none;opacity:.75}
  </style>
  <div class="wrap">
    <section class="card" id="card">
      <div class="head"><img src="${asset("msk-agente-logo.png")}" alt="MSK">
        <div><b>MSK AGENTE</b><small>ACESSO POR LICENÇA</small></div></div>

      <div id="form-state" style="display:flex;flex-direction:column;gap:8px;flex:1">
        <div><label>E-mail da conta MSK</label><input id="email" type="email" placeholder="voce@email.com" autocomplete="email"></div>
        <div><label>Token de acesso (licença)</label><input id="token" placeholder="MSK-XXXX-XXXX-XXXX"></div>
        <div class="msg" id="msg"></div>
        <button class="cta" id="activate">LIBERAR ACESSO</button>
        <a class="link" href="https://msksystem.online/planos" target="_blank" rel="noreferrer">Não tem licença? Assine aqui</a>
      </div>

      <div class="ok-state" id="ok-state">
        <div class="plan" id="plan">Licença ativa</div>
        <div class="clock" id="clock">--:--:--</div>
        <div class="msg ok">Acesso liberado! Atualize para abrir a extensão completa.</div>
        <button class="cta" id="reload">ATUALIZAR E ABRIR EXTENSÃO</button>
      </div>
    </section>

    <div class="menu" id="menu">
      <div class="mini"><span>Conexão / Acesso</span><button id="btn-access" title="Conectar licença">🔑</button></div>
      <div class="mini locked" id="chat-mini"><span id="chat-label">Chat (bloqueado)</span><button id="btn-chat" title="Chat MSK">💬</button></div>
    </div>
    <button class="orb" id="orb" title="MSK Agente"><img src="${asset("msk-agente-logo.png")}" alt="MSK"></button>
  </div>`;

  const $ = (id) => sh.getElementById(id);
  const card = $("card");
  const menu = $("menu");
  $("orb").addEventListener("click", () => {
    menu.classList.toggle("open");
    if (!menu.classList.contains("open")) card.classList.remove("open");
  });
  $("btn-access").addEventListener("click", () => card.classList.toggle("open"));
  $("btn-chat").addEventListener("click", () => {
    card.classList.add("open");
    setMsg("O chat só abre depois de conectar seu e-mail e licença.");
    $("email").focus();
  });


  const setMsg = (t, ok) => { const m = $("msg"); m.textContent = t || ""; m.className = "msg" + (ok ? " ok" : ""); };

  const fmt = (ms) => {
    if (ms == null) return "SEM VENCIMENTO";
    if (ms <= 0) return "EXPIRADA";
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    const p = (n) => String(n).padStart(2, "0");
    return (d > 0 ? d + "d " : "") + p(h) + ":" + p(m) + ":" + p(s);
  };

  let tick = 0;
  const showSuccess = (lic) => {
    $("form-state").style.display = "none";
    $("ok-state").classList.add("open");
    card.classList.add("open");
    menu.classList.add("open");
    $("plan").textContent = lic.plan_name || lic.plan || "Licença ativa";
    const end = lic.expires_at ? Date.parse(lic.expires_at) : null;
    const render = () => { $("clock").textContent = fmt(end ? end - Date.now() : null); };
    render();
    if (tick) clearInterval(tick);
    if (end) tick = setInterval(render, 1000);
  };

  $("reload").addEventListener("click", () => location.reload());

  const activate = async () => {
    const email = String($("email").value || "").trim().toLowerCase();
    const token = String($("token").value || "").trim().toUpperCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg("Informe o e-mail da sua conta MSK.");
    if (token.length < 8) return setMsg("Informe a licença completa recebida na compra.");
    $("activate").disabled = true;
    $("activate").textContent = "VALIDANDO…";
    setMsg("Validando licença no servidor MSK…");
    const res = await chrome.runtime.sendMessage({ type: "MSK_LICENSE_ACTIVATE", email, token }).catch(() => null);
    $("activate").disabled = false;
    $("activate").textContent = "LIBERAR ACESSO";
    if (res && res.ok) { setMsg("Acesso liberado!", true); showSuccess(res.license || {}); return; }
    setMsg((res && res.message) || "Não foi possível validar esta licença.");
  };
  $("activate").addEventListener("click", activate);
  sh.querySelectorAll("input").forEach((i) =>
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") activate(); }));

  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.type === "MSK_OPEN") card.classList.add("open");
  });

  // Boot: já tem licença válida? Então some o gate e carrega o agente completo.
  (async () => {
    const st = await chrome.runtime.sendMessage({ type: "MSK_LICENSE_STATUS" }).catch(() => null);
    if (st && st.ok) {
      root.remove();
      window.__mskLicenseGate = false;
      chrome.runtime.sendMessage({ type: "MSK_BOOT_AGENT" });
      return;
    }
    const saved = await chrome.storage.local.get(["mskLicenseEmail"]);
    if (saved.mskLicenseEmail) $("email").value = saved.mskLicenseEmail;
    if (st && st.message) setMsg(st.message);
  })();
})();
