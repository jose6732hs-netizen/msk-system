(() => {
  "use strict";
  if (window.__MSK_UI_FIXES_3428__) return;
  window.__MSK_UI_FIXES_3428__ = true;

  const getRoot = () => document.querySelector("#msk-root");
  let cleanupRun = 0;
  let observer = null;

  // Remove SOMENTE a parte visual do anexo. O objeto interno continua vivo para
  // que imagem, áudio, ZIP ou outro arquivo termine de ser enviado normalmente.
  const clearAttachmentTrayVisual = () => {
    const root = getRoot();
    if (!root) return false;
    const tray = root.querySelector(".msk-attachment-tray");
    if (!tray || tray.hidden || !tray.querySelector(".msk-file-chip")) return false;
    tray.replaceChildren();
    tray.hidden = true;
    const fileInput = root.querySelector(".msk-file-input");
    if (fileInput) fileInput.value = "";
    return true;
  };

  const clearSentAttachmentTray = () => {
    const root = getRoot();
    if (!root) return;
    const tray = root.querySelector(".msk-attachment-tray");
    if (!tray || tray.hidden || !tray.querySelector(".msk-file-chip")) return;

    [...tray.querySelectorAll(".msk-file-remove")].forEach(button => {
      try { button.click(); } catch {}
    });

    tray.replaceChildren();
    tray.hidden = true;
    const fileInput = root.querySelector(".msk-file-input");
    if (fileInput) fileInput.value = "";
  };

  const executionConfirmed = () => {
    const root = getRoot();
    const tray = root?.querySelector(".msk-attachment-tray");
    if (!root || !tray || tray.hidden || !tray.querySelector(".msk-file-chip")) return false;
    if (tray.querySelector(".msk-file-chip.error, .msk-file-chip.uploading")) return false;

    const stage = root.querySelector(".msk-stage");
    const stageText = (stage?.querySelector("strong")?.textContent || "").trim();
    if (!stage?.classList.contains("running")) return false;

    return /(aplicando\s+altera[cç][aã]o|continuando\s+altera[cç][aã]o|inspecionando|fast\s*edit.*execu[cç][aã]o)/i.test(stageText);
  };

  const clearWhenConfirmed = () => {
    if (!executionConfirmed()) return false;
    window.setTimeout(clearSentAttachmentTray, 0);
    return true;
  };

  const armAttachmentCleanup = () => {
    const root = getRoot();
    const tray = root?.querySelector(".msk-attachment-tray");
    if (!root || !tray || tray.hidden || !tray.querySelector(".msk-file-chip")) return;

    const run = ++cleanupRun;
    const deadline = Date.now() + 90000;

    const verify = () => {
      if (run !== cleanupRun) return;
      const liveRoot = getRoot();
      const liveTray = liveRoot?.querySelector(".msk-attachment-tray");
      if (!liveRoot || !liveTray || liveTray.hidden || !liveTray.querySelector(".msk-file-chip")) return;
      if (liveTray.querySelector(".msk-file-chip.error")) return;

      if (clearWhenConfirmed()) return;
      if (Date.now() < deadline) window.setTimeout(verify, 80);
    };

    window.setTimeout(verify, 0);
  };

  const mountObserver = () => {
    const root = getRoot();
    if (!root || observer) return;
    observer = new MutationObserver(() => {
      clearWhenConfirmed();
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden"]
    });
  };

  // O content.js limpa o campo e dispara um evento input programático quando o
  // comando foi aceito para envio. Nesse MESMO instante escondemos os anexos.
  // isTrusted=false evita apagar anexos quando o usuário apenas apaga o texto à mão.
  document.addEventListener("input", event => {
    const field = event.target;
    if (!field?.matches?.("#msk-root .msk-input")) return;
    if (event.isTrusted) return;
    if (String(field.value || "").trim()) return;
    clearAttachmentTrayVisual();
  }, true);

  document.addEventListener("click", event => {
    if (event.target?.closest?.("#msk-root .msk-send")) armAttachmentCleanup();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target?.matches?.("#msk-root .msk-input")) armAttachmentCleanup();
  }, true);

  const mountTimer = window.setInterval(() => {
    mountObserver();
    if (observer) window.clearInterval(mountTimer);
  }, 250);
  mountObserver();
})();
