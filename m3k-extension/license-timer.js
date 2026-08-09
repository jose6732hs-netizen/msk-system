(function() {
  if (window.__MSK_TIMER_INJECTED__) return;
  window.__MSK_TIMER_INJECTED__ = true;

  const timerEl = document.createElement('div');
  timerEl.id = 'msk-license-timer';
  timerEl.style.cssText = 'position:fixed;bottom:20px;left:20px;background:rgba(0,0,0,0.85);color:#35e68a;padding:8px 15px;border-radius:10px;font-family:Inter,sans-serif;font-size:12px;font-weight:bold;z-index:999999;border:1px solid #35e68a;display:none;align-items:center;gap:8px;backdrop-filter:blur(5px);box-shadow:0 0 15px rgba(53,230,138,0.3);';
  
  const icon = document.createElement('span');
  icon.textContent = '🛡️ MSK MODO ILIMITADO';
  timerEl.appendChild(icon);

  const countdown = document.createElement('span');
  countdown.id = 'msk-timer-countdown';
  timerEl.appendChild(countdown);

  document.body.appendChild(timerEl);

  function updateTimer() {
    chrome.storage.local.get(['ql_expires_at', 'ofg_license_active'], (s) => {
      if (s.ofg_license_active && s.ql_expires_at) {
        const expiresAt = new Date(s.ql_expires_at).getTime();
        const now = Date.now();
        const diff = expiresAt - now;

        if (diff > 0) {
          timerEl.style.display = 'flex';
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          
          if (days > 0) {
            countdown.textContent = days + 'd ' + hours + 'h restante';
          } else {
            countdown.textContent = hours + 'h ' + mins + 'm restante';
          }
        } else {
          timerEl.style.display = 'none';
        }
      } else {
        timerEl.style.display = 'none';
      }
    });
  }

  setInterval(updateTimer, 60000);
  updateTimer();
})();
