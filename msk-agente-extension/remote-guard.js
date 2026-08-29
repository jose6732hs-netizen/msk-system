(() => {
  if (window.__mskRemoteGuard) return;
  window.__mskRemoteGuard = true;

  const BLOCK_ROOT_ID = "msk-root";
  const MESSAGE_ROOT_ID = "msk-remote-message-root";

  function blockedRoot() {
    const root = document.getElementById(BLOCK_ROOT_ID);
    return root?.dataset?.mskRemoteBlock === "1" ? root : null;
  }

  function showBlocked(message) {
    if (blockedRoot()) return;
    const existing = document.getElementById(BLOCK_ROOT_ID);
    if (existing) existing.remove();

    const root = document.createElement("div");
    root.id = BLOCK_ROOT_ID;
    root.dataset.mskRemoteBlock = "1";
    document.documentElement.appendChild(root);
    const host = document.createElement("div");
    root.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host{all:initial}*{box-sizing:border-box;font-family:Inter,"Segoe UI",system-ui,sans-serif}
        .veil{position:fixed;inset:0;z-index:2147483647;background:rgba(3,3,5,.94);backdrop-filter:blur(14px);display:grid;place-items:center;padding:24px}
        .card{width:min(430px,100%);border-radius:26px;border:1px solid rgba(255,66,95,.35);background:linear-gradient(155deg,#151015,#09090b);box-shadow:0 24px 90px rgba(0,0,0,.7),0 0 40px rgba(255,66,95,.12);padding:28px;color:#fff;text-align:center}
        .icon{width:56px;height:56px;margin:0 auto;border-radius:18px;background:rgba(255,66,95,.12);border:1px solid rgba(255,66,95,.3);display:grid;place-items:center;font-size:27px}
        .eyebrow{margin-top:18px;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#ff6f88}
        h2{margin:8px 0 0;font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-.02em}
        p{margin:12px auto 0;max-width:340px;color:#c7c3cb;font-size:13px;line-height:1.55}
        .foot{margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#817c88}
      </style>
      <div class="veil"><section class="card"><div class="icon">🔒</div><div class="eyebrow">MSK Agente</div><h2>Acesso temporariamente bloqueado</h2><p id="msg"></p><div class="foot">Controle de acesso MSK SISTEM</div></section></div>`;
    shadow.getElementById("msg").textContent = String(message || "Seu acesso ao MSK Agente foi temporariamente bloqueado. Entre em contato com o suporte MSK.").slice(0, 1000);
  }

  function clearBlocked() {
    blockedRoot()?.remove();
  }

  function showMessage(command) {
    document.getElementById(MESSAGE_ROOT_ID)?.remove();
    const root = document.createElement("div");
    root.id = MESSAGE_ROOT_ID;
    document.documentElement.appendChild(root);
    const shadow = root.attachShadow({ mode: "open" });
    const severity = ["success", "warning", "critical"].includes(command?.severity) ? command.severity : "info";
    shadow.innerHTML = `
      <style>
        :host{all:initial}*{box-sizing:border-box;font-family:Inter,"Segoe UI",system-ui,sans-serif}
        .wrap{position:fixed;right:20px;top:20px;z-index:2147483646;width:min(390px,calc(100vw - 32px));animation:in .2s ease-out}
        .card{border-radius:20px;border:1px solid rgba(255,255,255,.12);background:rgba(10,10,12,.96);box-shadow:0 22px 70px rgba(0,0,0,.55);padding:16px;color:#fff;backdrop-filter:blur(18px)}
        .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.brand{font-size:9px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#8aff72}
        h3{margin:5px 0 0;font-size:16px;line-height:1.25;font-weight:900}.msg{margin-top:9px;color:#c9c6ce;font-size:12.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
        button{width:32px;height:32px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#aaa;cursor:pointer;font-size:18px}.bar{height:3px;border-radius:99px;margin-top:14px;background:#58ef75}
        .warning .bar{background:#f5b942}.critical .bar{background:#ff4d68}.success .bar{background:#40e397}
        .reply{margin-top:12px;display:flex;gap:8px;align-items:flex-end}
        textarea{flex:1;min-height:38px;max-height:120px;resize:vertical;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;padding:9px 11px;font-size:12px;font-family:inherit;outline:none}
        textarea:focus{border-color:rgba(138,255,114,.5)}
        .send{width:auto;height:38px;padding:0 14px;border-radius:12px;border:1px solid rgba(138,255,114,.45);background:rgba(138,255,114,.14);color:#8aff72;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
        .status{margin-top:8px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#8aff72;display:none}
        @keyframes in{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}
      </style>
      <div class="wrap ${severity}"><section class="card"><div class="top"><div><div class="brand">Mensagem MSK SISTEM</div><h3 id="title"></h3></div><button id="close" aria-label="Fechar">×</button></div><div class="msg" id="message"></div><div class="reply"><textarea id="reply" rows="1" placeholder="Responder ao suporte MSK…"></textarea><button class="send" id="send">Enviar</button></div><div class="status" id="status">Resposta enviada ao suporte MSK</div><div class="bar"></div></section></div>`;
    shadow.getElementById("title").textContent = String(command?.title || "Mensagem da MSK").slice(0, 180);
    shadow.getElementById("message").textContent = String(command?.message || "").slice(0, 2000);
    shadow.getElementById("close").addEventListener("click", () => root.remove());

    const replyBox = shadow.getElementById("reply");
    const sendButton = shadow.getElementById("send");
    const status = shadow.getElementById("status");
    const submit = () => {
      const body = String(replyBox.value || "").trim();
      if (!body) return;
      sendButton.disabled = true;
      sendButton.textContent = "Enviando";
      chrome.runtime.sendMessage({ type: "MSK_REMOTE_REPLY", commandId: command?.id || null, body }, (response) => {
        sendButton.disabled = false;
        sendButton.textContent = response?.ok ? "Enviado" : "Tentar";
        status.style.display = "block";
        status.textContent = response?.ok ? "Resposta enviada ao suporte MSK" : "Não foi possível enviar agora";
        if (response?.ok) {
          replyBox.value = "";
          setTimeout(() => root.remove(), 2200);
        }
      });
    };
    sendButton.addEventListener("click", submit);
    replyBox.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "MSK_REMOTE_MESSAGE") showMessage(message.command || {});
    if (message?.type === "MSK_REMOTE_BLOCK") showBlocked(message.message);
    if (message?.type === "MSK_REMOTE_UNBLOCK") clearBlocked();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.mskRemoteBlocked) {
      if (changes.mskRemoteBlocked.newValue) {
        chrome.storage.local.get("mskRemoteBlockMessage").then((stored) => showBlocked(stored.mskRemoteBlockMessage));
      } else {
        clearBlocked();
      }
    }
    if (changes.mskRemoteBlockMessage?.newValue && blockedRoot()) {
      clearBlocked();
      showBlocked(changes.mskRemoteBlockMessage.newValue);
    }
  });

  chrome.storage.local.get(["mskRemoteBlocked", "mskRemoteBlockMessage"]).then((stored) => {
    if (stored.mskRemoteBlocked) showBlocked(stored.mskRemoteBlockMessage);
  });
})();
