(() => {
  "use strict";
  if (window.__MSK_UI_FIXES_3422__) return;
  window.__MSK_UI_FIXES_3422__ = true;

  const getRoot = () => document.querySelector("#msk-root");
  let cleanupRun = 0;

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

  const armAttachmentCleanup = () => {
    const root = getRoot();
    const tray = root?.querySelector(".msk-attachment-tray");
    if (!root || !tray || tray.hidden || !tray.querySelector(".msk-file-chip")) return;

    const run = ++cleanupRun;
    const initialStage = (root.querySelector(".msk-stage strong")?.textContent || "").trim();
    const deadline = Date.now() + 90000;

    const verify = () => {
      if (run !== cleanupRun) return;
      const liveRoot = getRoot();
      const liveTray = liveRoot?.querySelector(".msk-attachment-tray");
      if (!liveRoot || !liveTray || liveTray.hidden || !liveTray.querySelector(".msk-file-chip")) return;

      if (liveTray.querySelector(".msk-file-chip.error")) return;

      const stillPreparing = !!liveTray.querySelector(".msk-file-chip.uploading");
      const stage = liveRoot.querySelector(".msk-stage");
      const stageText = (stage?.querySelector("strong")?.textContent || "").trim();
      const movedToExecution =
        !!stage?.classList.contains("running") &&
        stageText !== initialStage &&
        !/preparando\s+anexos?/i.test(stageText);

      if (!stillPreparing && movedToExecution) {
        clearSentAttachmentTray();
        return;
      }

      if (Date.now() < deadline) window.setTimeout(verify, 70);
    };

    window.setTimeout(verify, 0);
  };

  document.addEventListener("click", event => {
    if (event.target?.closest?.("#msk-root .msk-send")) armAttachmentCleanup();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target?.matches?.("#msk-root .msk-input")) armAttachmentCleanup();
  }, true);
})();
