(() => {
  if (window.__MSK_LICENSE_PAGE_WATCH__) return;
  window.__MSK_LICENSE_PAGE_WATCH__ = true;

  const LICENSE_KEY = "mskLicense";
  const FORCE_OPEN_KEY = "mskForceLicenseOpen";
  let timer = null;

  function openGateIfRequested() {
    chrome.storage.local.get(FORCE_OPEN_KEY).then((stored) => {
      if (!stored[FORCE_OPEN_KEY]) return;
      const root = document.querySelector("#msk-root");
      const host = root?.firstElementChild;
      const shadow = host?.shadowRoot;
      const card = shadow?.getElementById("card");
      const menu = shadow?.getElementById("menu");
      if (card) card.classList.add("open");
      if (menu) menu.classList.add("open");
      chrome.storage.local.remove(FORCE_OPEN_KEY).catch(() => {});
    }).catch(() => {});
  }

  async function expireNow() {
    if (timer) clearTimeout(timer);
    timer = null;
    await chrome.storage.local.remove(LICENSE_KEY).catch(() => {});
    await chrome.storage.local.set({
      [FORCE_OPEN_KEY]: true,
      mskLicenseBlockedAt: Date.now(),
      mskLicenseBlockReason: "LICENSE_EXPIRED",
    }).catch(() => {});
    location.reload();
  }

  async function schedule() {
    if (timer) clearTimeout(timer);
    timer = null;
    const stored = await chrome.storage.local.get(LICENSE_KEY).catch(() => ({}));
    const license = stored[LICENSE_KEY];
    if (!license?.expires_at) {
      openGateIfRequested();
      return;
    }
    const end = Date.parse(license.expires_at);
    if (!Number.isFinite(end)) return;
    const delay = end - Date.now();
    if (delay <= 0) {
      await expireNow();
      return;
    }
    // setTimeout cobre a página ativa; o background mantém um chrome.alarm redundante.
    timer = setTimeout(expireNow, Math.min(delay, 2_147_000_000));
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[LICENSE_KEY]) void schedule();
  });

  void schedule();
  window.addEventListener("focus", () => void schedule());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void schedule();
  });
})();
