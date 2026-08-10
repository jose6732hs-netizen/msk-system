(function() {
  "use strict";

  function initTimer() {
    const body = document.getElementById('sp-body');
    if (!body) return;

    // Remove timer antigo se existir
    const old = document.getElementById('msk-license-timer');
    if (old) old.remove();

    const timerContainer = document.createElement('div');
    timerContainer.id = 'msk-license-timer';
    timerContainer.className = 'sp-trial-countdown';
    timerContainer.style.margin = '10px';
    timerContainer.style.padding = '12px';
    timerContainer.style.background = 'rgba(0,0,0,0.4)';
    timerContainer.style.borderRadius = '12px';
    timerContainer.style.border = '1px solid rgba(255,255,255,0.05)';
    
    timerContainer.innerHTML = `
      <div class="sp-countdown-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <span class="sp-countdown-label" style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.5);">Tempo Restante</span>
        <span id="msk-timer-clock" class="sp-countdown-time" style="font-family:monospace; font-size:14px; font-weight:900; color:#3b82f6;">--:--</span>
      </div>
      <div class="sp-trial-bar" style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
        <div id="msk-timer-bar" class="sp-trial-bar-fill" style="width:100%; height:100%; background:#22c55e; transition: width 1s linear, background 0.5s ease;"></div>
      </div>
    `;

    body.prepend(timerContainer);

    function update() {
      chrome.storage.local.get(['OG_LICENSE_STATE'], function(data) {
        const state = data.OG_LICENSE_STATE;
        if (!state || !state.expires_at || state.status !== 'ACTIVE') {
          timerContainer.style.display = 'none';
          return;
        }

        timerContainer.style.display = 'block';
        const now = Date.now();
        const expiry = new Date(state.expires_at).getTime();
        const start = state.activated_at ? new Date(state.activated_at).getTime() : (expiry - 15 * 60000);
        
        const total = expiry - start;
        const remaining = expiry - now;
        
        if (remaining <= 0) {
          document.getElementById('msk-timer-clock').textContent = "EXPIRADO";
          document.getElementById('msk-timer-bar').style.width = '0%';
          return;
        }

        const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        
        const clock = document.getElementById('msk-timer-clock');
        const bar = document.getElementById('msk-timer-bar');
        
        clock.textContent = (m < 10 ? '0'+m : m) + ':' + (s < 10 ? '0'+s : s);
        bar.style.width = pct + '%';
        
        // Cores baseadas no percentual
        // comeca verde (100-50), meio fica amarela (50-30), em 70% (ou seja 30% restante) fica vermelha
        if (pct > 50) {
          bar.style.background = '#22c55e'; // Verde
          clock.style.color = '#3b82f6';
        } else if (pct > 30) {
          bar.style.background = '#eab308'; // Amarelo
          clock.style.color = '#eab308';
        } else {
          bar.style.background = '#ef4444'; // Vermelho
          clock.style.color = '#ef4444';
          bar.classList.add('sp-bar-urgent'); // Animacao de pulso ja existente no CSS
        }
      });
    }

    const interval = setInterval(update, 1000);
    update();
    
    // Limpeza se o elemento for removido ou script reiniciado
    timerContainer.addEventListener('remove', () => clearInterval(interval));
  }

  // Espera o body da sidepanel carregar
  const observer = new MutationObserver((mutations, obs) => {
    const body = document.getElementById('sp-body');
    if (body) {
      initTimer();
      obs.disconnect();
    }
  });
  
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
