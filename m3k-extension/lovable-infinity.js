(function() {
  'use strict';

  // Injetar CSS para animações neon e gradientes
  function injectStyles() {
    if (document.getElementById('msk-infinity-styles')) return;
    const style = document.createElement('style');
    style.id = 'msk-infinity-styles';
    style.textContent = `
      @keyframes msk-neon-glow {
        0% { text-shadow: 0 0 5px #ff00ff, 0 0 10px #ff00ff, 0 0 20px #ff00ff; }
        50% { text-shadow: 0 0 10px #ff00ff, 0 0 20px #ff00ff, 0 0 40px #ff00ff, 0 0 60px #ff00ff; }
        100% { text-shadow: 0 0 5px #ff00ff, 0 0 10px #ff00ff, 0 0 20px #ff00ff; }
      }

      .msk-infinity-text {
        color: #ff69b4 !important;
        font-weight: 900 !important;
        animation: msk-neon-glow 2s infinite alternate !important;
        font-family: serif !important;
        font-size: 1.2em;
      }

      .msk-infinity-bar {
        background: linear-gradient(90deg, #ff00ff, #ff69b4) !important;
        width: 100% !important;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: width 0.5s ease-in-out !important;
      }

      .msk-bar-text {
        position: absolute;
        color: white;
        font-weight: bold;
        font-size: 10px;
        text-shadow: 0 0 3px black;
        z-index: 10;
      }
    `;
    document.head.appendChild(style);
  }

  function applyInfinityHack() {
    // 1. Encontrar o texto de créditos
    const selectors = [
      '[class*="credits"]', 
      '[class*="Credits"]', 
      '[data-testid*="credits"]', 
      '[data-testid*="Credits"]'
    ];
    
    // Procura por elementos que contenham o número de créditos (ex: "4.20 left")
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      if (el.children.length === 0 && (el.textContent.includes('left') || el.textContent.includes('créditos') || el.textContent.includes('credits'))) {
        // Se for o valor numérico
        if (/^\d+(\.\d+)?\s*(left|créditos|credits)/i.test(el.textContent.trim())) {
           el.innerHTML = '<span class="msk-infinity-text">∞</span>';
        }
      }
      
      // Trocar texto "Créditos" por "✨ Infinito ✨"
      if (el.children.length === 0 && (el.textContent.trim() === 'Créditos' || el.textContent.trim() === 'Credits')) {
        el.textContent = '✨ Infinito ✨';
        el.style.color = '#ff69b4';
      }
    });

    // 2. Barra de progresso
    const progressBars = document.querySelectorAll('[role="progressbar"], [class*="progress"], [class*="Progress"]');
    progressBars.forEach(bar => {
      // Verifica se a barra está no contexto de créditos
      const container = bar.closest('[class*="credits"], [class*="Credits"], [data-testid*="credits"]');
      if (container || bar.getAttribute('aria-label')?.toLowerCase().includes('credits')) {
        const fill = bar.querySelector('div') || bar;
        if (fill) {
          fill.classList.add('msk-infinity-bar');
          fill.style.width = '100%';
          
          if (!fill.querySelector('.msk-bar-text')) {
            const txt = document.createElement('span');
            txt.className = 'msk-bar-text';
            txt.textContent = '∞';
            fill.appendChild(txt);
          }
        }
      }
    });
  }

  // Monitorar mudanças no DOM (Lovable é uma SPA dinâmica)
  function init() {
    injectStyles();
    applyInfinityHack();

    const observer = new MutationObserver((mutations) => {
      applyInfinityHack();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Executar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
