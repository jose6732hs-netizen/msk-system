(() => {
  "use strict";
  if (window.__MSK_UI_FIXES_3429__) return;
  window.__MSK_UI_FIXES_3429__ = true;

  const getRoot = () => document.querySelector("#msk-root");
  let sendProbeRun = 0;
  let observer = null;

  const trayHasFiles = tray => !!tray?.querySelector?.(".msk-file-chip");
  const buttonBusy = button => !!button?.disabled || button?.getAttribute("aria-busy") === "true" || button?.classList.contains("msk-send-waiting");

  // Esconde SOMENTE a representação visual dos anexos já consumidos pelo envio.
  // pendingAttachments continua intacto no content.js para imagem/áudio/ZIP chegar à IA.
  const suppressSentAttachmentVisual = () => {
    const root = getRoot();
    const tray = root?.querySelector(".msk-attachment-tray");
    if (!root || !tray || (!trayHasFiles(tray) && tray.dataset.mskSentHidden !== "1")) return false;

    tray.dataset.mskSentHidden = "1";
    if (tray.getAttribute("aria-hidden") !== "true") tray.setAttribute("aria-hidden", "true");
    if (tray.style.getPropertyValue("display") !== "none" || tray.style.getPropertyPriority("display") !== "important") {
      tray.style.setProperty("display", "none", "important");
    }
    if (!tray.hidden) tray.hidden = true;
    if (tray.childElementCount) tray.replaceChildren();

    const fileInput = root.querySelector(".msk-file-input");
    if (fileInput) fileInput.value = "";
    return true;
  };

  // Ao anexar um NOVO arquivo, libera o tray para o novo ciclo.
  const releaseAttachmentVisual = () => {
    const tray = getRoot()?.querySelector(".msk-attachment-tray");
    if (!tray) return;
    delete tray.dataset.mskSentHidden;
    tray.removeAttribute("aria-hidden");
    tray.style.removeProperty("display");
  };

  const keepSuppressed = () => {
    const tray = getRoot()?.querySelector(".msk-attachment-tray");
    if (!tray || tray.dataset.mskSentHidden !== "1") return;
    if (tray.getAttribute("aria-hidden") !== "true") tray.setAttribute("aria-hidden", "true");
    if (tray.style.getPropertyValue("display") !== "none" || tray.style.getPropertyPriority("display") !== "important") {
      tray.style.setProperty("display", "none", "important");
    }
    if (!tray.hidden) tray.hidden = true;
    if (tray.childElementCount) tray.replaceChildren();
  };

  // Detecta o MESMO ciclo de envio do content.js. Só esconde se houver prova nova
  // de aceite: texto consumido, busy iniciado, status iniciado ou nova bolha do usuário.
  const armImmediateSendCleanup = () => {
    const root = getRoot();
    const tray = root?.querySelector(".msk-attachment-tray");
    const field = root?.querySelector(".msk-input");
    const sendButton = root?.querySelector(".msk-send");
    if (!root || !tray || !field || !trayHasFiles(tray)) return;

    const run = ++sendProbeRun;
    const beforeText = String(field.value || "").trim();
    const beforeBusy = buttonBusy(sendButton);
    const beforeStageRunning = !!root.querySelector(".msk-stage.running");
    const beforeUserCount = root.querySelectorAll(".msk-chat .msk-msg.user").length;
    const deadline = Date.now() + 1800;

    const verify = () => {
      if (run !== sendProbeRun) return;
      const liveRoot = getRoot();
      const liveTray = liveRoot?.querySelector(".msk-attachment-tray");
      const liveField = liveRoot?.querySelector(".msk-input");
      const liveSend = liveRoot?.querySelector(".msk-send");
      if (!liveRoot || !liveTray || !liveField) return;
      if (liveTray.dataset.mskSentHidden === "1") return;

      const afterText = String(liveField.value || "").trim();
      const textWasConsumed = !!beforeText && !afterText;
      const busyStarted = !beforeBusy && buttonBusy(liveSend);
      const stageStarted = !beforeStageRunning && !!liveRoot.querySelector(".msk-stage.running");
      const userAdded = liveRoot.querySelectorAll(".msk-chat .msk-msg.user").length > beforeUserCount;

      if (textWasConsumed || busyStarted || stageStarted || userAdded) {
        suppressSentAttachmentVisual();
        return;
      }
      if (Date.now() < deadline) window.setTimeout(verify, 20);
    };

    queueMicrotask(verify);
  };

  const mountObserver = () => {
    const root = getRoot();
    if (!root || observer) return;
    observer = new MutationObserver(() => keepSuppressed());
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "style"]
    });
  };

  // Novo anexo escolhido pelo usuário: inicia um tray novo normalmente.
  document.addEventListener("change", event => {
    if (event.target?.matches?.("#msk-root .msk-file-input") && event.isTrusted) releaseAttachmentVisual();
  }, true);

  document.addEventListener("drop", event => {
    if (!event.target?.closest?.("#msk-root")) return;
    if (event.dataTransfer?.files?.length) releaseAttachmentVisual();
  }, true);

  // Fallback: quando o content.js limpa programaticamente o texto, some na hora.
  document.addEventListener("input", event => {
    const field = event.target;
    if (!field?.matches?.("#msk-root .msk-input")) return;
    if (!event.isTrusted && !String(field.value || "").trim()) suppressSentAttachmentVisual();
  }, true);

  document.addEventListener("click", event => {
    if (event.target?.closest?.("#msk-root .msk-send")) armImmediateSendCleanup();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target?.matches?.("#msk-root .msk-input")) armImmediateSendCleanup();
  }, true);

  const mountTimer = window.setInterval(() => {
    mountObserver();
    if (observer) window.clearInterval(mountTimer);
  }, 120);
  mountObserver();
})();
