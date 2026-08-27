(() => {
  if (window.__mskUpdateNotice) return;
  window.__mskUpdateNotice = true;

  const host = document.createElement("div");
  host.id = "msk-update-notice-host";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box;font-family:Inter,"Segoe UI",system-ui,sans-serif}
      .card{position:fixed;right:18px;top:18px;z-index:2147483646;width:min(360px,calc(100vw - 36px));display:none;color:#f8fafc;background:linear-gradient(155deg,#12091d,#07070b);border:1px solid rgba(34,255,167,.32);border-radius:18px;padding:15px;box-shadow:0 20px 60px rgba(0,0,0,.55),0 0 24px rgba(34,255,167,.12)}
      .card.open{display:block}.card.mandatory{border-color:rgba(255,196,61,.6);box-shadow:0 20px 60px rgba(0,0,0,.58),0 0 28px rgba(255,196,61,.12)}
      .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;background:rgba(34,255,167,.1);color:#22ffa7}.mandatory .badge{background:rgba(255,196,61,.12);color:#ffd166}
      h3{font-size:14px;margin:10px 0 3px;font-weight:900}p{margin:0;color:#aaa4b8;font-size:11.5px;line-height:1.45}.versions{margin:12px 0;padding:10px;border-radius:12px;background:rgba(255,255,255,.035);font-size:11.5px}.versions b{color:#fff}.actions{display:flex;gap:8px;margin-top:12px}.btn{flex:1;border:0;border-radius:11px;padding:10px 12px;cursor:pointer;font-size:11px;font-weight:900}.primary{background:linear-gradient(90deg,#22ffa7,#7c3aed);color:#07110d}.secondary{background:#191323;color:#e8e3f3;border:1px solid rgba(255,255,255,.09)}.close{border:0;background:transparent;color:#7f788e;font-size:18px;cursor:pointer;padding:0 2px}.mandatory .close{display:none}.changes{display:none;max-height:160px;overflow:auto;margin-top:10px;padding:10px;border-radius:11px;background:rgba(0,0,0,.28);white-space:pre-wrap;color:#c7c1d1;font-size:11px;line-height:1.45}.changes.open{display:block}.status{min-height:15px;margin-top:8px;color:#ffcf70;font-size:10.5px}
    </style>
    <aside class="card" id="card">
      <div class="top"><div><span class="badge" id="badge">Nova atualização disponível</span><h3 id="title">MSK Agente</h3></div><button class="close" id="close" aria-label="Fechar">×</button></div>
      <p id="message">Uma versão nova do MSK Agente está pronta.</p>
      <div class="versions">Versão atual: <b id="current">—</b><br>Nova versão: <b id="latest">—</b><br>Versão mínima: <b id="minimum">—</b></div>
      <div class="actions"><button class="btn primary" id="update">Atualizar agora</button><button class="btn secondary" id="news">Ver novidades</button></div>
      <div class="changes" id="changes"></div><div class="status" id="status"></div>
    </aside>`;

  const $ = (id) => shadow.getElementById(id);
  let currentUpdate = null;

  function render(update) {
    currentUpdate = update;
    if (!update?.update_available) { $("card").classList.remove("open"); return; }
    $("card").classList.toggle("mandatory", !!update.mandatory);
    $("card").classList.add("open");
    $("badge").textContent = update.mandatory ? "Atualização necessária para continuar" : "Nova atualização disponível";
    $("title").textContent = update.title || "MSK Agente";
    $("message").textContent = update.mandatory ? "Atualize o MSK Agente antes de executar novas alterações." : "Uma versão nova do MSK Agente está pronta para instalação manual.";
    $("current").textContent = update.current_version || chrome.runtime.getManifest().version;
    $("latest").textContent = update.latest_version || "—";
    $("minimum").textContent = update.minimum_version || "—";
    $("changes").textContent = update.changelog || "Nenhuma nota adicional informada.";
  }

  $("close").addEventListener("click", () => {
    if (!currentUpdate?.mandatory) $("card").classList.remove("open");
  });
  $("news").addEventListener("click", () => $("changes").classList.toggle("open"));
  $("update").addEventListener("click", async () => {
    $("update").disabled = true;
    $("status").textContent = "Preparando download oficial…";
    const result = await chrome.runtime.sendMessage({ type: "MSK_EXTENSION_UPDATE_DOWNLOAD" }).catch(() => null);
    $("update").disabled = false;
    $("status").textContent = result?.ok ? "Download oficial aberto. Instale a nova versão para continuar." : (result?.error || "Não consegui preparar a atualização agora.");
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "MSK_UPDATE_STATUS") render(message.update);
  });

  chrome.runtime.sendMessage({ type: "MSK_EXTENSION_UPDATE_STATUS" }).then((result) => render(result?.update)).catch(() => {});
})();
