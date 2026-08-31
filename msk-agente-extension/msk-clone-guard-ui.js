(() => {
  const OVERLAY_ID = 'msk-clone-guard-overlay';
  const LOCK_KEY = 'mskCloneProtectionV1';
  let currentLock = null;

  function escapeText(value) {
    return String(value || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function removeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
    document.documentElement?.removeAttribute('data-msk-clone-blocked');
  }

  function renderOverlay(lock) {
    if (!lock?.blocked) return removeOverlay();
    currentLock = lock;
    document.documentElement?.setAttribute('data-msk-clone-blocked', '1');
    let root = document.getElementById(OVERLAY_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = OVERLAY_ID;
      root.setAttribute('role', 'alertdialog');
      root.setAttribute('aria-modal', 'true');
      root.innerHTML = `
        <div class="msk-clone-card">
          <div class="msk-clone-shield">!</div>
          <div class="msk-clone-kicker">SEGURANÇA MSK</div>
          <h1>EXTENSÃO CLONADA</h1>
          <p class="msk-clone-copy">Esta instalação foi bloqueada pela segurança MSK. Comandos, GitHub e IA estão desativados.</p>
          <div class="msk-clone-ref"></div>
          <button type="button" class="msk-clone-plans">VER PLANOS OFICIAIS MSK</button>
          <p class="msk-clone-foot">Use somente versões oficiais distribuídas pela MSK.</p>
        </div>`;
      const style = document.createElement('style');
      style.textContent = `
        #${OVERLAY_ID}{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;background:radial-gradient(circle at 50% 25%,rgba(255,35,72,.16),transparent 38%),#050506!important;padding:24px!important;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;color:#fff!important}
        #${OVERLAY_ID} *{box-sizing:border-box!important}
        #${OVERLAY_ID} .msk-clone-card{width:min(720px,100%)!important;border:1px solid rgba(255,61,91,.42)!important;border-radius:28px!important;background:linear-gradient(180deg,rgba(27,8,13,.96),rgba(8,8,10,.98))!important;box-shadow:0 0 0 1px rgba(255,255,255,.03),0 30px 100px rgba(0,0,0,.7),0 0 80px rgba(255,35,72,.12)!important;padding:42px 34px!important;text-align:center!important}
        #${OVERLAY_ID} .msk-clone-shield{width:74px!important;height:74px!important;margin:0 auto 18px!important;display:grid!important;place-items:center!important;border-radius:24px!important;background:#ff274b!important;color:#fff!important;font-size:42px!important;font-weight:1000!important;box-shadow:0 0 34px rgba(255,39,75,.42)!important}
        #${OVERLAY_ID} .msk-clone-kicker{font-size:12px!important;font-weight:900!important;letter-spacing:.28em!important;color:#ff6881!important;margin-bottom:10px!important}
        #${OVERLAY_ID} h1{margin:0!important;font-size:clamp(38px,7vw,72px)!important;line-height:.98!important;letter-spacing:-.045em!important;font-weight:1000!important;color:#fff!important;text-shadow:0 0 30px rgba(255,39,75,.18)!important}
        #${OVERLAY_ID} .msk-clone-copy{max-width:590px!important;margin:22px auto 0!important;font-size:16px!important;line-height:1.65!important;color:rgba(255,255,255,.76)!important}
        #${OVERLAY_ID} .msk-clone-ref{margin:18px auto 0!important;width:max-content!important;max-width:100%!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:999px!important;background:rgba(255,255,255,.04)!important;padding:8px 13px!important;font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace!important;color:rgba(255,255,255,.55)!important;letter-spacing:.08em!important}
        #${OVERLAY_ID} .msk-clone-plans{margin-top:26px!important;min-height:52px!important;border:0!important;border-radius:15px!important;padding:0 24px!important;background:linear-gradient(90deg,#bfff00,#68ff5d)!important;color:#071007!important;font-size:13px!important;font-weight:1000!important;letter-spacing:.06em!important;cursor:pointer!important;box-shadow:0 12px 40px rgba(130,255,75,.16)!important}
        #${OVERLAY_ID} .msk-clone-plans:hover{filter:brightness(1.08)!important;transform:translateY(-1px)!important}
        #${OVERLAY_ID} .msk-clone-foot{margin:16px 0 0!important;font-size:11px!important;color:rgba(255,255,255,.38)!important}
      `;
      root.appendChild(style);
      root.querySelector('.msk-clone-plans')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'MSK_CLONE_GUARD_OPEN_PLANS' }).catch(() => {
          window.open('https://msksystem.online', '_blank', 'noopener,noreferrer');
        });
      });
      (document.documentElement || document).appendChild(root);
    }
    const ref = root.querySelector('.msk-clone-ref');
    if (ref) ref.innerHTML = `DISPOSITIVO · ${escapeText(lock.deviceRef || String(lock.installationId || '').slice(-10) || 'BLOQUEADO')}`;
  }

  async function refresh(force = false) {
    try {
      const response = await chrome.runtime.sendMessage({ type: force ? 'MSK_CLONE_GUARD_REFRESH' : 'MSK_CLONE_GUARD_STATUS' });
      const lock = response?.lock || null;
      if (lock?.blocked) renderOverlay(lock);
      else if (response?.blocked === false) removeOverlay();
    } catch {}
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes?.[LOCK_KEY]) return;
    const next = changes[LOCK_KEY].newValue || null;
    if (next?.blocked) renderOverlay(next); else removeOverlay();
  });

  chrome.storage.local.get(LOCK_KEY).then(saved => {
    const lock = saved?.[LOCK_KEY] || null;
    if (lock?.blocked) renderOverlay(lock);
  }).catch(() => {});

  setInterval(() => refresh(true), 15_000);
  void refresh(false);
})();
