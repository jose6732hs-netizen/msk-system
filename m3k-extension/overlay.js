var _0xd6=function(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new TextDecoder().decode(u)};
// ============= oferrolgarcia Overlay =============
// Two layout modes:
//   "sidebar": iframe sidebar fixed on the right of lovable.dev.
//   "popup":   sidebar hidden. A floating round launcher with the extension logo
//              opens a vertical FAB-style menu with main actions + a submenu for
//              quick prompt templates. The user types in Lovable's NATIVE composer;
//              we intercept Enter and route the send through the extension iframe.

(function () {
  if (window.__tsOverlayInjected) return;
  window.__tsOverlayInjected = true;

  // Apenas na janela principal: evita painel/launcher duplicados em iframes
  // e toggles múltiplos (TS_TOGGLE_OVERLAY chega a todos os frames da aba).
  if (window.top !== window) return;

  // Bug fix: só injeta UI (seta, sidebar, launcher, interceptação de Enter)
  // no lovable.dev. Em outros sites (YouTube, Google, etc.) a extensão não
  // deve mostrar nada nem interceptar teclas — apenas captura passiva de token.
  if (!location.hostname.endsWith(_0xd6('bG92YWJsZS5kZXY='))) return;

  if (typeof window.TS_DEBUG === _0xd6('dW5kZWZpbmVk')) window.TS_DEBUG = false;
  const _0x22de7f6 = (..._0x1ccff6) => { if (window.TS_DEBUG) console.log(..._0x1ccff6); };

  const _0x22de8f6 = _0xd6('dHMtY29tbXVuaXR5LW92ZXJsYXktcm9vdA==');
  const _0x22de9f6 = _0xd6('dHMtY29tbXVuaXR5LW92ZXJsYXktaWZyYW1l');
  const _0x22deaf6 = _0xd6('dHMtY29tbXVuaXR5LW92ZXJsYXktc3R5bGU=');
  const _0x22debf6 = _0xd6('dHMtZmxvYXRpbmctbGF1bmNoZXI=');
  const _0x22decf6 = _0xd6('dHMtZmxvYXRpbmctYWN0aW9uLW1lbnU=');
  const _0x22dedf6 = _0xd6('dHMtZmxvYXRpbmctc3VibWVudQ==');
  const _0x22deef6 = _0xd6('dHMtbm90aWZpY2F0aW9uLXBhbmVs');
  const _0x22deff6 = _0xd6('dHMtbmF0aXZlLWNvbXBvc2VyLXdyYXA=');
  const _0x22df0f6 = 380;
  const _0x22df1f6 = _0xd6('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW1oNWFuTmhhV0ZzWldKd2MydDNablpwYm1sbklpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzT0RRM01qRXlPVGNzSW1WNGNDSTZNakV3TURJNU56STVOMzAueFJ6eE1mcjkyeHhSeE13Z05HXzBpejlKMlJjNlNRVjNmTGdWS0l0SmdyZw==');
  // Remote notifications feed removed (previous owner's server).

  function _0x22df2f6() {
    try { return chrome.runtime.getURL(_0xd6('c2lkZXBhbmVsLmh0bWw=')); } catch (_0x35d1f6) { return null; }
  }
  function _0x22df3f6() {
    try { return chrome.runtime.getURL(_0xd6('aWNvbnMvaWNvbjEyOC5wbmc=')); } catch (_0x35d3f6) { return ""; }
  }

  function _0x22df4f6() {
    if (document.getElementById(_0x22deaf6)) return;
    const _0x366cf6 = document.createElement(_0xd6('c3R5bGU='));
    _0x366cf6.id = _0x22deaf6;
    _0x366cf6.textContent = `
      :root {
        --ts-sidebar-width: 0px;
        --ts-primary-purple: var(--ts-brand-primary);
        --ts-primary-purple-strong: var(--ts-brand-primary-hover);
        --ts-primary-gradient: var(--ts-brand-gradient);
        --ts-primary-border: rgba(var(--ts-brand-primary-rgb), 0.55);
        --ts-primary-border-soft: rgba(var(--ts-brand-primary-rgb), 0.32);
        --ts-primary-glow: 0 0 0 3px rgba(var(--ts-brand-primary-rgb), 0.18);
        --ts-primary-glow-strong: 0 8px 24px rgba(var(--ts-brand-primary-rgb), 0.35);
      }
      body.ts-sidebar-open {
        padding-right: var(--ts-sidebar-width) !important;
        transition: padding-right 280ms ease !important;
        box-sizing: border-box !important;
      }
      body:not(.ts-sidebar-open) {
        padding-right: 0 !important;
        transition: padding-right 280ms ease !important;
      }
      #${_0x22de8f6} {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        width: ${_0x22df0f6}px !important;
        height: 100vh !important;
        z-index: 2147483647 !important;
        transition: transform 280ms ease !important;
        background: transparent !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: -2px 0 16px rgba(0,0,0,0.18) !important;
        pointer-events: auto !important;
      }
      #${_0x22de8f6}.ts-sidebar-collapsed {
        transform: translateX(100%) !important;
        pointer-events: none !important;
      }
      #${_0x22de8f6}.ts-popup-mode {
        width: 0 !important;
        height: 0 !important;
        pointer-events: none !important;
        box-shadow: none !important;
        transform: none !important;
        overflow: hidden !important;
      }
      #${_0x22de8f6}.ts-popup-mode > #${_0x22de9f6} {
        position: absolute !important;
        left: -10000px !important;
        top: -10000px !important;
        width: 1px !important;
        height: 1px !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      #${_0x22de9f6} {
        width: 100% !important;
        height: 100% !important;
        min-height: 480px !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        background: #ffffff !important;
      }

      /* ===== Floating launcher (popup mode) ===== */
      #${_0x22debf6} {
        position: fixed !important;
        right: 24px !important;
        bottom: 24px !important;
        width: 56px !important;
        height: 56px !important;
        border-radius: 999px !important;
        cursor: grab !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(255, 255, 255, 0.06) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        border: 1px solid var(--ts-primary-border-soft) !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18) !important;
        padding: 0 !important;
        transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease !important;
        user-select: none !important;
        touch-action: none !important;
      }
      #${_0x22debf6}:hover {
        transform: scale(1.06) !important;
        border-color: var(--ts-primary-border) !important;
        box-shadow: var(--ts-primary-glow-strong) !important;
      }
      #${_0x22debf6}.ts-launcher-dragging {
        cursor: grabbing !important;
        transition: none !important;
      }
      #${_0x22debf6} img {
        width: 38px !important;
        height: 38px !important;
        object-fit: contain !important;
        pointer-events: none !important;
        border-radius: 8px !important;
        opacity: 1 !important;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35)) !important;
      }
      #${_0x22debf6}.ts-launcher-active {
        background: var(--ts-primary-gradient) !important;
        border-color: var(--ts-primary-purple) !important;
      }
      #${_0x22debf6}.ts-launcher-recording {
        animation: tsLauncherPulse 1.2s infinite !important;
      }
      @keyframes tsLauncherPulse {
        0%,100% { box-shadow: 0 12px 32px rgba(239,68,68,0.45); }
        50%     { box-shadow: 0 12px 32px rgba(239,68,68,0.9); }
      }
      #${_0x22debf6} .ts-launcher-dot {
        position: absolute !important;
        top: 4px !important;
        right: 4px !important;
        min-width: 16px !important;
        height: 16px !important;
        padding: 0 4px !important;
        border-radius: 999px !important;
        background: #ef4444 !important;
        color: #fff !important;
        font: 600 10px/16px system-ui, -apple-system, sans-serif !important;
        text-align: center !important;
        box-shadow: 0 0 0 2px rgba(15,23,42,0.9), 0 2px 6px rgba(239,68,68,0.6) !important;
        pointer-events: none !important;
        display: none !important;
      }
      #${_0x22debf6}.ts-has-unread .ts-launcher-dot {
        display: block !important;
        animation: tsLauncherDotPulse 1.6s infinite !important;
      }
      @keyframes tsLauncherDotPulse {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.15); }
      }

      /* ===== Native composer wrap outline (popup mode) — desativado ===== */
      /* Mantemos o estilo padrão da Lovable, sem contorno nem badge. */


      /* ===== FAB-style vertical menu (transparent items) ===== */
      #${_0x22decf6}, #${_0x22dedf6} {
        position: fixed !important;
        z-index: 2147483647 !important;
        flex-direction: column !important;
        gap: 10px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        pointer-events: auto !important;
        opacity: 1 !important;
        visibility: visible !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        transition:
          left 260ms cubic-bezier(0.22, 1, 0.36, 1),
          right 260ms cubic-bezier(0.22, 1, 0.36, 1),
          top 260ms cubic-bezier(0.22, 1, 0.36, 1),
          bottom 260ms cubic-bezier(0.22, 1, 0.36, 1),
          transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 220ms ease !important;
      }
      #${_0x22decf6}[data-align="right"], #${_0x22dedf6}[data-align="right"] { align-items: flex-end !important; }
      #${_0x22decf6}[data-align="left"],  #${_0x22dedf6}[data-align="left"]  { align-items: flex-start !important; }
      #${_0x22decf6}.ts-floating-menu-open, #${_0x22dedf6} {
        display: flex !important;
      }
      #${_0x22decf6}:not(.ts-floating-menu-open) {
        display: none !important;
      }
      #${_0x22decf6} .ts-fab-item, #${_0x22dedf6} .ts-fab-item {
        display: inline-flex !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 0 !important;
        background: transparent !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 0 !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        box-shadow: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        transform: translateY(0) !important;
        animation: tsFabIn 240ms cubic-bezier(0.22, 1, 0.36, 1) both !important;
        pointer-events: auto !important;
        font-family: inherit !important;
        text-align: left !important;
        white-space: nowrap !important;
        transition:
          transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 200ms ease !important;
      }
      #${_0x22decf6} .ts-fab-label, #${_0x22dedf6} .ts-fab-label {
        padding: 6px 10px !important;
        border-radius: 999px !important;
        background: rgba(15, 15, 20, 0.42) !important;
        backdrop-filter: blur(10px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(10px) saturate(140%) !important;
        color: #fff !important;
        text-shadow: 0 1px 4px rgba(0,0,0,0.45) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        line-height: 1.2 !important;
        font-weight: 600 !important;
        letter-spacing: 0.01em !important;
      }
      #${_0x22decf6}[data-align="left"] .ts-fab-item,
      #${_0x22dedf6}[data-align="left"] .ts-fab-item { flex-direction: row !important; }
      #${_0x22decf6}[data-align="right"] .ts-fab-item,
      #${_0x22dedf6}[data-align="right"] .ts-fab-item { flex-direction: row-reverse !important; }
      #${_0x22decf6} .ts-fab-item:hover, #${_0x22dedf6} .ts-fab-item:hover {
        transform: scale(1.04) !important;
      }
      #${_0x22decf6} .ts-fab-item:hover .ts-fab-circle,
      #${_0x22dedf6} .ts-fab-item:hover .ts-fab-circle {
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.55) !important;
      }
      #${_0x22decf6} .ts-fab-circle, #${_0x22dedf6} .ts-fab-circle {
        width: 38px !important; height: 38px !important;
        border-radius: 999px !important;
        background: var(--ts-primary-gradient) !important;
        color: #fff !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 15px !important;
        flex: 0 0 auto !important;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.45), 0 0 0 1px rgba(255,255,255,0.08) inset !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        transition: box-shadow 200ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1) !important;
      }
      #${_0x22decf6} .ts-fab-circle svg, #${_0x22dedf6} .ts-fab-circle svg {
        width: 18px !important; height: 18px !important; stroke: #fff !important;
      }
      #${_0x22decf6} .ts-fab-item.ts-fab-prompts .ts-fab-circle {
        background: linear-gradient(135deg, #f59e0b, #d97706) !important;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.45) !important;
      }
      #${_0x22decf6} .ts-fab-chevron {
        opacity: 0.85 !important;
        display: inline-flex !important;
        margin: 0 4px !important;
      }
      #${_0x22decf6} .ts-fab-chevron svg { width: 14px !important; height: 14px !important; stroke: #fff !important; }
      @keyframes tsFabIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      #${_0x22dedf6} {
        max-height: 70vh !important;
        overflow-y: auto !important;
        padding: 4px !important;
      }
      #ts-action-toast {
        position: fixed !important;
        z-index: 2147483647 !important;
        padding: 8px 14px !important;
        border-radius: 999px !important;
        background: rgba(20, 20, 25, 0.72) !important;
        backdrop-filter: blur(12px) saturate(150%) !important;
        -webkit-backdrop-filter: blur(12px) saturate(150%) !important;
        color: #fff !important;
        font: 600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35) !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transform: translate(-50%, 8px) !important;
        transition: opacity 180ms ease, transform 180ms ease !important;
        max-width: 80vw !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      #ts-action-toast.ts-visible {
        opacity: 1 !important;
        transform: translate(-50%, 0) !important;
      }
      #ts-action-toast.ts-toast-error { border-color: rgba(239,68,68,0.55) !important; color: #fecaca !important; }
      #ts-action-toast.ts-toast-success { border-color: rgba(34,197,94,0.55) !important; color: #bbf7d0 !important; }

      #${_0x22decf6} .ts-fab-badge {
        position: absolute !important;
        top: -4px !important;
        right: -4px !important;
        min-width: 17px !important;
        height: 17px !important;
        padding: 0 4px !important;
        border-radius: 999px !important;
        background: #ef4444 !important;
        color: #fff !important;
        font-size: 9px !important;
        font-weight: 800 !important;
        line-height: 17px !important;
        text-align: center !important;
        box-shadow: 0 0 0 2px rgba(15,15,20,0.95) !important;
      }
      #${_0x22deef6} {
        position: fixed !important;
        z-index: 2147483647 !important;
        width: min(340px, calc(100vw - 24px)) !important;
        max-height: min(420px, calc(100vh - 24px)) !important;
        overflow: auto !important;
        background: rgba(17, 17, 19, 0.96) !important;
        color: #f4f4f5 !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        border-radius: 14px !important;
        box-shadow: 0 18px 50px rgba(0,0,0,0.45) !important;
        backdrop-filter: blur(14px) !important;
        -webkit-backdrop-filter: blur(14px) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      }
      #${_0x22deef6} .ts-notif-head { display:flex !important; align-items:center !important; justify-content:space-between !important; padding:12px 14px !important; border-bottom:1px solid rgba(255,255,255,0.08) !important; font-size:13px !important; font-weight:800 !important; }
      #${_0x22deef6} .ts-notif-close { border:0 !important; background:transparent !important; color:#a1a1aa !important; cursor:pointer !important; font-size:15px !important; padding:4px 8px !important; }
      #${_0x22deef6} .ts-notif-list { padding:8px !important; }
      #${_0x22deef6} .ts-notif-empty { margin:0 !important; padding:18px 8px !important; text-align:center !important; color:#a1a1aa !important; font-size:12px !important; }
      #${_0x22deef6} .ts-notif-item { padding:10px 11px !important; border:1px solid rgba(255,255,255,0.08) !important; border-radius:10px !important; background:rgba(255,255,255,0.04) !important; margin-bottom:7px !important; }
      #${_0x22deef6} .ts-notif-title { font-size:12px !important; font-weight:800 !important; color:#fff !important; margin-bottom:4px !important; }
      #${_0x22deef6} .ts-notif-msg { font-size:12px !important; line-height:1.45 !important; color:#d4d4d8 !important; margin-bottom:6px !important; }
      #${_0x22deef6} .ts-notif-link { font-size:11px !important; color:var(--ts-primary-purple) !important; text-decoration:none !important; font-weight:700 !important; }
      #${_0x22deef6} .ts-notif-date { margin-top:5px !important; font-size:10px !important; color:#71717a !important; }

    `;
    (document.head || document.documentElement).appendChild(_0x366cf6);
  }

  function _0x22df5f6() {
    if (document.getElementById(_0x22de8f6)) return document.getElementById(_0x22de8f6);
    const _0x377ef6 = _0x22df2f6();
    if (!_0x377ef6) return null;
    _0x22df4f6();

    const _0x377ff6 = document.createElement("div");
    _0x377ff6.id = _0x22de8f6;

    const _0x3780f6 = document.createElement(_0xd6('aWZyYW1l'));
    _0x3780f6.id = _0x22de9f6;
    _0x3780f6.src = _0x377ef6;
    _0x3780f6.setAttribute(_0xd6('YWxsb3c='), _0xd6('bWljcm9waG9uZTsgY2xpcGJvYXJkLXJlYWQ7IGNsaXBib2FyZC13cml0ZQ=='));

    _0x377ff6.appendChild(_0x3780f6);
    document.body.appendChild(_0x377ff6);
    console.info(_0xd6('W1RTIE92ZXJsYXldIFNpZGViYXIgaWZyYW1lIGluamVjdGVkIGF0'), _0x377ef6);
    return _0x377ff6;
  }

  let _0x22df6f6 = _0xd6('cG9wdXA='); // "sidebar" | "popup"
  let _0x22df7f6 = false; // 🔒 cadeado: bloqueia interceptação de teclado em qualquer página
  const _0x22df8f6 = {
    bug: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSI4IiB5PSI2IiB3aWR0aD0iOCIgaGVpZ2h0PSIxNCIgcng9IjQiLz48cGF0aCBkPSJtMTkgNy0zIDIiLz48cGF0aCBkPSJtNSA3IDMgMiIvPjxwYXRoIGQ9Im0xOSAxOS0zLTIiLz48cGF0aCBkPSJtNSAxOSAzLTIiLz48cGF0aCBkPSJNMjAgMTNoLTQiLz48cGF0aCBkPSJNNCAxM2g0Ii8+PHBhdGggZD0ibTEwIDQgMSAyIi8+PHBhdGggZD0ibTE0IDQtMSAyIi8+PC9zdmc+'),
    refresh: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIyMyA0IDIzIDEwIDE3IDEwIi8+PHBvbHlsaW5lIHBvaW50cz0iMSAyMCAxIDE0IDcgMTQiLz48cGF0aCBkPSJNMy41MSA5YTkgOSAwIDAgMSAxNC44NS0zLjM2TDIzIDEwTTEgMTRsNC42NCA0LjM2QTkgOSAwIDAgMCAyMC40OSAxNSIvPjwvc3ZnPg=='),
    palette: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMy41IiBjeT0iNi41IiByPSIwLjUiLz48Y2lyY2xlIGN4PSIxNy41IiBjeT0iMTAuNSIgcj0iMC41Ii8+PGNpcmNsZSBjeD0iOC41IiBjeT0iNy41IiByPSIwLjUiLz48Y2lyY2xlIGN4PSI2LjUiIGN5PSIxMiIgcj0iMC41Ii8+PHBhdGggZD0iTTEyIDJDNi41IDIgMiA2LjUgMiAxMnM0LjUgMTAgMTAgMTBjLjkyNiAwIDEuNjQ4LS43NDYgMS42NDgtMS42ODggMC0uNDM3LS4xOC0uODM1LS40MzctMS4xMjUtLjI5LS4yODktLjQzOC0uNjUyLS40MzgtMS4xMjVhMS42NCAxLjY0IDAgMCAxIDEuNjY4LTEuNjY4aDEuOTk2YzMuMDUxIDAgNS41NTUtMi41MDMgNS41NTUtNS41NTRDMjEuOTY1IDYuMDEyIDE3LjQ2MSAyIDEyIDJ6Ii8+PC9zdmc+'),
    book: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNCAxOS41QTIuNSAyLjUgMCAwIDEgNi41IDE3SDIwIi8+PHBhdGggZD0iTTYuNSAySDIwdjIwSDYuNUEyLjUgMi41IDAgMCAxIDQgMTkuNXYtMTVBMi41IDIuNSAwIDAgMSA2LjUgMnoiLz48L3N2Zz4='),
    zap: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWdvbiBwb2ludHM9IjEzIDIgMyAxNCAxMiAxNCAxMSAyMiAyMSAxMCAxMiAxMCAxMyAyIi8+PC9zdmc+'),
    shield: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMjJzOC00IDgtMTBWNWwtOC0zLTggM3Y3YzAgNiA4IDEwIDggMTB6Ii8+PC9zdmc+'),
    flask: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNOSAydjZsLTUuNSA5LjVBMiAyIDAgMCAwIDUuMiAyMWgxMy42YTIgMiAwIDAgMCAxLjctMy41TDE1IDhWMiIvPjxwYXRoIGQ9Ik04LjUgMmg3Ii8+PHBhdGggZD0iTTcgMTZoMTAiLz48L3N2Zz4='),
    phone: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSI1IiB5PSIyIiB3aWR0aD0iMTQiIGhlaWdodD0iMjAiIHJ4PSIyIiByeT0iMiIvPjxsaW5lIHgxPSIxMiIgeTE9IjE4IiB4Mj0iMTIuMDEiIHkyPSIxOCIvPjwvc3ZnPg=='),
    search: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI4Ii8+PGxpbmUgeDE9IjIxIiB5MT0iMjEiIHgyPSIxNi42NSIgeTI9IjE2LjY1Ii8+PC9zdmc+'),
    pen: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMjBoOSIvPjxwYXRoIGQ9Ik0xNi41IDMuNWEyLjEyMSAyLjEyMSAwIDAgMSAzIDNMNyAxOWwtNCAxIDEtNEwxNi41IDMuNXoiLz48L3N2Zz4='),
    puzzle: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTkuNDM5IDcuODVjLS4wNDkuMzIyLjA1OS42NDguMjg5Ljg3OGwxLjU2OCAxLjU2OGMuNDcuNDcuNzA2IDEuMDg3LjcwNiAxLjcwNHMtLjIzNSAxLjIzMy0uNzA2IDEuNzA0bC0xLjYxMSAxLjYxMWEuOTguOTggMCAwIDEtLjgzNy4yNzZjLS40Ny0uMDctLjgwMi0uNDgtLjk2OC0uOTI1YTIuNTAxIDIuNTAxIDAgMSAwLTMuMjE0IDMuMjE0Yy40NDYuMTY2Ljg1NS40OTcuOTI1Ljk2OGEuOTc5Ljk3OSAwIDAgMS0uMjc2LjgzN2wtMS42MSAxLjYxYTIuNDA0IDIuNDA0IDAgMCAxLTEuNzA1LjcwNyAyLjQwMiAyLjQwMiAwIDAgMS0xLjcwNC0uNzA2bC0xLjU2OC0xLjU2OGExLjAyNiAxLjAyNiAwIDAgMC0uODc3LS4yOWMtLjQ5My4wNzQtLjg0LjUwNC0xLjAyLjk2OGEyLjUgMi41IDAgMSAxLTMuMjM3LTMuMjM3Yy40NjQtLjE4Ljg5NC0uNTI3Ljk2Ny0xLjAyYTEuMDI2IDEuMDI2IDAgMCAwLS4yODktLjg3N0wyLjcgMTUuMTRhMi40MDIgMi40MDIgMCAwIDEtLjcwNi0xLjcwNGMwLS42MTcuMjM1LTEuMjM0LjcwNi0xLjcwNGwxLjYxMS0xLjYxMWMuMjMtLjIzLjU1Ni0uMzM4Ljg3Ny0uMjkuNDkzLjA3NC44NC41MDQgMS4wMi45NjhhMi41IDIuNSAwIDEgMCAzLjIzNy0zLjIzN2MtLjQ2NC0uMTgtLjg5NC0uNTI3LS45NjctMS4wMmExLjAyNiAxLjAyNiAwIDAgMSAuMjg5LS44NzdsMS41NjgtMS41NjhBMi40MDIgMi40MDIgMCAwIDEgMTIuMDM2IDJjLjYxNyAwIDEuMjM0LjIzNSAxLjcwNC43MDZsMS42MTEgMS42MTFjLjIzLjIzLjMzOC41NTYuMjkuODc3LS4wNzQuNDkzLS41MDQuODQtLjk2OCAxLjAyYTIuNSAyLjUgMCAxIDAgMy4yMzcgMy4yMzdjLjE4LS40NjQuNTI3LS44OTQgMS4wMi0uOTY3LjMyLS4wNDguNjQ3LjA2Ljg3Ny4yOXoiLz48L3N2Zz4='),
    ambulance: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTAgMTBINiIvPjxwYXRoIGQ9Ik0xNCAxOFY2YTIgMiAwIDAgMC0yLTJINGEyIDIgMCAwIDAtMiAydjExYTEgMSAwIDAgMCAxIDFoMiIvPjxwYXRoIGQ9Ik0xOSAxOGgyYTEgMSAwIDAgMCAxLTF2LTMuMjhhMSAxIDAgMCAwLS42ODQtLjk0OGwtMS45MjMtLjY0MWExIDEgMCAwIDEtLjU3OC0uNTAybC0xLjUzOS0zLjA3NkExIDEgMCAwIDAgMTYuMzgyIDhIMTQiLz48cGF0aCBkPSJNOCA4djQiLz48cGF0aCBkPSJNOSAxOGg2Ii8+PGNpcmNsZSBjeD0iMTciIGN5PSIxOCIgcj0iMiIvPjxjaXJjbGUgY3g9IjciIGN5PSIxOCIgcj0iMiIvPjwvc3ZnPg=='),
    truck: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIxIiB5PSIzIiB3aWR0aD0iMTUiIGhlaWdodD0iMTMiLz48cG9seWdvbiBwb2ludHM9IjE2IDggMjAgOCAyMyAxMSAyMyAxNiAxNiAxNiAxNiA4Ii8+PGNpcmNsZSBjeD0iNS41IiBjeT0iMTguNSIgcj0iMi41Ii8+PGNpcmNsZSBjeD0iMTguNSIgY3k9IjE4LjUiIHI9IjIuNSIvPjwvc3ZnPg=='),
    film: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIyIiB5PSIyIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHJ4PSIyLjE4IiByeT0iMi4xOCIvPjxsaW5lIHgxPSI3IiB5MT0iMiIgeDI9IjciIHkyPSIyMiIvPjxsaW5lIHgxPSIxNyIgeTE9IjIiIHgyPSIxNyIgeTI9IjIyIi8+PGxpbmUgeDE9IjIiIHkxPSIxMiIgeDI9IjIyIiB5Mj0iMTIiLz48bGluZSB4MT0iMiIgeTE9IjciIHgyPSI3IiB5Mj0iNyIvPjxsaW5lIHgxPSIyIiB5MT0iMTciIHgyPSI3IiB5Mj0iMTciLz48bGluZSB4MT0iMTciIHkxPSIxNyIgeDI9IjIyIiB5Mj0iMTciLz48bGluZSB4MT0iMTciIHkxPSI3IiB4Mj0iMjIiIHkyPSI3Ii8+PC9zdmc+'),
    accessibility: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjQiIHI9IjEiLz48cGF0aCBkPSJtMTggMTkgMS03LTYgMSIvPjxwYXRoIGQ9Im01IDggMy0zIDUuNSAzLTIuMzYgMy41Ii8+PHBhdGggZD0iTTQuMjQgMTQuNWE1IDUgMCAwIDAgNi44OCA2Ii8+PHBhdGggZD0iTTEzLjc2IDE3LjVhNSA1IDAgMCAwLTYuODgtNiIvPjwvc3ZnPg=='),
    file: _0xd6('PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ii8+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiLz48L3N2Zz4='),
    clock: _0xd6('PHN2ZyB3aWR0aD0iMTMiIGhlaWdodD0iMTMiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwb2x5bGluZSBwb2ludHM9IjEyIDYgMTIgMTIgMTYgMTQiLz48L3N2Zz4='),
    alert: _0xd6('PHN2ZyB3aWR0aD0iMTMiIGhlaWdodD0iMTMiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTAuMjkgMy44NiAxLjgyIDE4YTIgMiAwIDAgMCAxLjcxIDNoMTYuOTRhMiAyIDAgMCAwIDEuNzEtM0wxMy43MSAzLjg2YTIgMiAwIDAgMC0zLjQyIDB6Ii8+PGxpbmUgeDE9IjEyIiB5MT0iOSIgeDI9IjEyIiB5Mj0iMTMiLz48bGluZSB4MT0iMTIiIHkxPSIxNyIgeDI9IjEyLjAxIiB5Mj0iMTciLz48L3N2Zz4='),
    check: _0xd6('PHN2ZyB3aWR0aD0iMTMiIGhlaWdodD0iMTMiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjIwIDYgOSAxNyA0IDEyIi8+PC9zdmc+'),
    x: _0xd6('PHN2ZyB3aWR0aD0iMTMiIGhlaWdodD0iMTMiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxsaW5lIHgxPSIxOCIgeTE9IjYiIHgyPSI2IiB5Mj0iMTgiLz48bGluZSB4MT0iNiIgeTE9IjYiIHgyPSIxOCIgeTI9IjE4Ii8+PC9zdmc+'),
    download: _0xd6('PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCIvPjxwb2x5bGluZSBwb2ludHM9IjcgMTAgMTIgMTUgMTcgMTAiLz48bGluZSB4MT0iMTIiIHkxPSIxNSIgeDI9IjEyIiB5Mj0iMyIvPjwvc3ZnPg==')
  };
  // Built-in fallback prompts — used if iframe templates not yet received.
  const _0x22df9f6 = [
    { label: _0xd6('Q29ycmlnaXIgQnVn'),        icon: _0x22df8f6.bug, prompt: _0xd6('SWRlbnRpZmlxdWUgZSBjb3JyaWphIG8gYnVnIGRlc3RlIGPDs2RpZ28sIGV4cGxpY2FuZG8gYSBjYXVzYSByYWl6IGUgYSBzb2x1w6fDo28u') },
    { label: _0xd6('UmVmYXRvcmFy'),           icon: _0x22df8f6.refresh, prompt: _0xd6('UmVmYXRvcmUgZXN0ZSBjw7NkaWdvIG1hbnRlbmRvIG8gY29tcG9ydGFtZW50bywgbWVsaG9yYW5kbyBsZWdpYmlsaWRhZGUsIG1vZHVsYXJpZGFkZSBlIG5vbWVzLg==') },
    { label: _0xd6('TWVsaG9yYXIgVUk='),         icon: _0x22df8f6.palette, prompt: _0xd6('TWVsaG9yZSBhIFVJIGRlc3RlIGNvbXBvbmVudGU6IGhpZXJhcnF1aWEgdmlzdWFsLCBlc3Bhw6dhbWVudG8sIHRpcG9ncmFmaWEgZSByZXNwb25zaXZpZGFkZS4=') },
    { label: _0xd6('RXhwbGljYXIgQ8OzZGlnbw=='),     icon: _0x22df8f6.book, prompt: _0xd6('RXhwbGlxdWUgZXN0ZSBjw7NkaWdvIHBhc3NvIGEgcGFzc28sIGluY2x1aW5kbyBvIHBvcnF1w6ogZGUgY2FkYSBkZWNpc8Ojby4=') },
    { label: _0xd6('T3RpbWl6YXI='),            icon: _0x22df8f6.zap, prompt: _0xd6('T3RpbWl6ZSBlc3RlIGPDs2RpZ28gcXVhbnRvIGEgcGVyZm9ybWFuY2UsIGNvbXBsZXhpZGFkZSBlIHVzbyBkZSBtZW3Ds3JpYS4=') },
    { label: _0xd6('U2VndXJhbsOnYQ=='),           icon: _0x22df8f6.shield, prompt: _0xd6('RmHDp2EgdW1hIHJldmlzw6NvIGRlIHNlZ3VyYW7Dp2E6IHZhbGlkYcOnw6NvIGRlIGlucHV0LCBYU1MsIFNRTGksIGF1dG9yaXphw6fDo28gZSBzZWNyZXRzLg==') },
    { label: _0xd6('Q3JpYXIgVGVzdGU='),         icon: _0x22df8f6.flask, prompt: _0xd6('Q3JpZSB0ZXN0ZXMgdW5pdMOhcmlvcyBjb2JyaW5kbyBjYXNvcyBmZWxpemVzLCBlcnJvcyBlIGVkZ2UgY2FzZXMu') },
    { label: _0xd6('UmVzcG9uc2l2aWRhZGU='),      icon: _0x22df8f6.phone, prompt: _0xd6('VG9ybmUgZXN0ZSBsYXlvdXQgdG90YWxtZW50ZSByZXNwb25zaXZvIChtb2JpbGUsIHRhYmxldCwgZGVza3RvcCkgc2VtIHF1ZWJyYXIgYSBlc3TDqXRpY2Eu') },
    { label: "SEO",                 icon: _0x22df8f6.search, prompt: _0xd6('T3RpbWl6ZSBTRU86IHRpdGxlLCBtZXRhIGRlc2NyaXB0aW9uLCBoZWFkaW5ncywgYWx0IGVtIGltYWdlbnMsIHNjaGVtYS9KU09OLUxEIGUgY2Fub25pY2FsLg==') },
    { label: _0xd6('Q29weSAmIE1hcmtldGluZw=='),    icon: _0x22df8f6.pen, prompt: _0xd6('UmVlc2NyZXZhIGVzdGUgY29udGXDumRvIGNvbSB0b20gcGVyc3Vhc2l2bywgY2xhcm8gZSB2b2x0YWRvIGEgY29udmVyc8Ojby4=') },
    { label: _0xd6('Q2FyZHMgJiBCb3TDtWVz'),      icon: _0x22df8f6.puzzle, prompt: _0xd6('Q3JpZSB2YXJpYcOnw7VlcyBkZSBjYXJkcyBlIGJvdMO1ZXMgY29tIGVzdGFkb3MgKGhvdmVyLCBhY3RpdmUsIGRpc2FibGVkKSBjb25zaXN0ZW50ZXMgYW8gZGVzaWduIHN5c3RlbS4=') },
    { label: _0xd6('Rml4IEVycm9y'),           icon: _0x22df8f6.ambulance, prompt: _0xd6('QW5hbGlzZSBlc3RlIGVycm8gZSBwcm9wb25oYSBhIGNvcnJlw6fDo28gZXhhdGEsIGV4cGxpY2FuZG8gYSBjYXVzYSByYWl6Lg==') },
    { label: _0xd6('TWlncmHDp8Ojbw=='),            icon: _0x22df8f6.truck, prompt: _0xd6('RmHDp2EgYSBtaWdyYcOnw6NvIG1hbnRlbmRvIGNvbXBhdGliaWxpZGFkZSwgY29tIHBsYW5vIHBhc3NvIGEgcGFzc28gZSByb2xsYmFjay4=') },
    { label: _0xd6('VHJhbnNpw6fDo28='),           icon: _0x22df8f6.film, prompt: _0xd6('QWRpY2lvbmUgdHJhbnNpw6fDtWVzIGUgYW5pbWHDp8O1ZXMgc3VhdmVzLCByZXNwZWl0YW5kbyBwcmVmZXJzLXJlZHVjZWQtbW90aW9uLg==') },
  ];
  let _0x22dfaf6 = _0x22df9f6.slice();

  // ===================== Skills source (shared with Sidepanel) =====================
  // Mirrors SP_BUILTIN_SKILLS from sidepanel.js; user skills are read from
  // chrome.storage.local under the same key the sidepanel uses ("sp_user_skills"),
  // so the slash picker, the Skills tab and any autocomplete share one source.
  const _0x22dfbf6 = [
    { id: _0xd6('YnVpbHRpbl9hY2Nlc3NpYmlsaXR5'), builtin: true, icon: _0x22df8f6.accessibility, name: _0xd6('QWNjZXNzaWJpbGl0eSBSZXZpZXc='), description: _0xd6('QXVkaXRhIGFjZXNzaWJpbGlkYWRlIChXQ0FHIDIuMSBBQSk='), prefix: _0xd6('L3NraWxsOmFjY2Vzc2liaWxpdHk=') },
    { id: _0xd6('YnVpbHRpbl9yZWRlc2lnbg=='),      builtin: true, icon: _0x22df8f6.palette, name: _0xd6('UmVkZXNpZ24='),              description: _0xd6('UmVmaW5hIG8gZGVzaWduIG1hbnRlbmRvIGEgZnVuY2lvbmFsaWRhZGU='), prefix: _0xd6('L3NraWxsOnJlZGVzaWdu') },
    { id: _0xd6('YnVpbHRpbl9zZW9fcmV2aWV3'),    builtin: true, icon: _0x22df8f6.search, name: _0xd6('U0VPIFJldmlldw=='),            description: _0xd6('QXVkaXRvcmlhIHTDqWNuaWNhIGUgb24tcGFnZSBkZSBTRU8='), prefix: _0xd6('L3NraWxsOnNlby1yZXZpZXc=') },
    { id: _0xd6('YnVpbHRpbl92aWRlb19jcmVhdG9y'), builtin: true, icon: _0x22df8f6.film, name: _0xd6('VmlkZW8gQ3JlYXRvcg=='),         description: _0xd6('R2VyYSB2w61kZW9zIGN1cnRvcyBwYXJhIG8gcHJvamV0bw=='), prefix: _0xd6('L3NraWxsOnZpZGVvLWNyZWF0b3I=') },
    { id: _0xd6('YnVpbHRpbl9za2lsbF9jcmVhdG9y'), builtin: true, icon: _0x22df8f6.puzzle, name: _0xd6('U2tpbGwgQ3JlYXRvcg=='),         description: _0xd6('Q3JpYSB1bWEgbm92YSBza2lsbCByZXV0aWxpesOhdmVs'),
      content: _0xd6('TWUgYWp1ZGUgYSBjcmlhciB1bWEgbm92YSBza2lsbCByZXV0aWxpesOhdmVsIHBhcmEgbyBMb3ZhYmxlLiBGYcOnYSBhcyBwZXJndW50YXMgbmVjZXNzw6FyaWFzIHBhcmEgZW50ZW5kZXI6ICgxKSBxdWFsIHRhcmVmYSBlc3BlY8OtZmljYSBlc3NhIHNraWxsIHJlc29sdmUsICgyKSBxdWFuZG8gZWxhIGRldmUgc2VyIGFjaW9uYWRhLCAoMykgcXVhbCBvIG91dHB1dCBlc3BlcmFkbywgKDQpIHJlc3RyacOnw7Vlcy9jb252ZW7Dp8O1ZXMgZG8gcHJvamV0byBxdWUgcHJlY2lzYW0gc2VyIHNlZ3VpZGFzLiBFbSBzZWd1aWRhLCBnZXJlIG8gcHJvbXB0IGZpbmFsIGRhIHNraWxsIGNvbSBub21lLCBkZXNjcmnDp8OjbyBjdXJ0YSBlIGNvcnBvIGRvIHByb21wdCBwcm9udG8gcGFyYSBjb2xhci4=') }
  ];
  let _0x22dfcf6 = [];
  function _0x22dfdf6(_0x11d07f6) {
    return String(_0x11d07f6 || _0xd6('c2tpbGw=')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || _0xd6('c2tpbGw=');
  }
  function _0x22dfef6(_0x11de9f6) {
    if (!_0x11de9f6) return null;
    const _0x11deaf6 = _0x11de9f6.name || _0x11de9f6.label || _0xd6('U2tpbGw=');
    const _0x11debf6 = _0x11de9f6.prefix || (_0xd6('L3NraWxsOg==') + _0x22dfdf6(_0x11deaf6));
    return {
      id: _0x11de9f6.id || _0x11debf6,
      label: _0x11deaf6,
      icon: _0x11de9f6.icon || "✦",
      description: _0x11de9f6.description || "",
      prefix: _0x11debf6,
      content: _0x11de9f6.content || "",
      builtin: !!_0x11de9f6.builtin
    };
  }
  function _0x22dfff6() {
    const _0x11e02f6 = _0x22dfbf6.concat(_0x22dfcf6 || []);
    return _0x11e02f6.map(_0x22dfef6).filter(Boolean);
  }
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([_0xd6('c3BfdXNlcl9za2lsbHM=')], (_0x11eb6f6) => {
        _0x22dfcf6 = Array.isArray(_0x11eb6f6 && _0x11eb6f6.sp_user_skills) ? _0x11eb6f6.sp_user_skills : [];
      });
      chrome.storage.onChanged.addListener((_0x11ecdf6, _0x11ecef6) => {
        if (_0x11ecef6 === _0xd6('bG9jYWw=') && _0x11ecdf6.sp_user_skills) {
          _0x22dfcf6 = Array.isArray(_0x11ecdf6.sp_user_skills.newValue) ? _0x11ecdf6.sp_user_skills.newValue : [];
          if (_0x22e79f6 && _0x22e79f6.open) {
            _0x22e79f6.items = _0x22e7ef6(_0x22e79f6.query);
            _0x22e81f6();
          }
        }
      });
    }
  } catch (_0x11ed0f6) { /* noop */ }

  function _0x22e00f6(_0x11f49f6) {
    const _0x11f4af6 = document.getElementById(_0x22de8f6);
    if (_0x11f4af6) _0x11f4af6.classList.toggle(_0xd6('dHMtc2lkZWJhci1jb2xsYXBzZWQ='), Boolean(_0x11f49f6));
    if (!document.body) return;
    const _0x11f4bf6 = _0x22df6f6 === _0xd6('cG9wdXA=');
    if (_0x11f49f6 || _0x11f4bf6) {
      document.body.classList.remove(_0xd6('dHMtc2lkZWJhci1vcGVu'));
      document.documentElement.style.setProperty(_0xd6('LS10cy1zaWRlYmFyLXdpZHRo'), "0px");
    } else {
      document.body.classList.add(_0xd6('dHMtc2lkZWJhci1vcGVu'));
      document.documentElement.style.setProperty(_0xd6('LS10cy1zaWRlYmFyLXdpZHRo'), _0x22df0f6 + "px");
    }
  }

  function _0x22e01f6(_0x11f55f6) { _0x22e00f6(Boolean(_0x11f55f6)); }

  function _0x22e02f6(_0x12019f6) {
    // Modo popup/chat padrão desativado: a extensão deve enviar sempre pelo painel.
    _0x22df6f6 = _0xd6('cG9wdXA=');
    const _0x1201af6 = document.getElementById(_0x22de8f6);
    const _0x1201bf6 = false;
    if (_0x1201af6) _0x1201af6.classList.remove(_0xd6('dHMtcG9wdXAtbW9kZQ=='));

    // Não adiciona classe ativa nem marca o composer — mantém o prompt da Lovable padrão.
    if (document.body) document.body.classList.remove(_0xd6('dHMtbmF0aXZlLWNoYXQtYWN0aXZl'));
    _0x22e0ef6();
    _0x22e0ff6();
    _0x22e0af6();
    _0x22e2bf6();

    _0x22e10f6();
    _0x22e0ef6();
    _0x22e1cf6();
    try {
      chrome.storage.local.get({ sidebarCollapsed: false }, (_0x12028f6) => {
        _0x22e00f6(Boolean(_0x12028f6 && _0x12028f6.sidebarCollapsed));
      });
    } catch (_0x1202af6) {
      _0x22e00f6(false);
    }
  }

  // ===================== Popup launcher =====================
  const _0x22e03f6 = 56;

  // Try to detect the white preview area on lovable.dev so the launcher and
  // menu never overlap the chat/history/sidepanel. Falls back to viewport.
  function _0x22e04f6() {
    const _0x1243ff6 = [
      _0xd6('aWZyYW1lW3NyYyo9ImxvdmFibGVwcm9qZWN0LmNvbSJd'),
      _0xd6('aWZyYW1lW3NyYyo9ImxvdmFibGUuYXBwIl0='),
      _0xd6('aWZyYW1lW3RpdGxlKj0icHJldmlldyIgaV0='),
      _0xd6('aWZyYW1lW3RpdGxlKj0iUHJldmlldyIgaV0='),
      _0xd6('W2RhdGEtcHJldmlldy1jb250YWluZXJd'),
      _0xd6('bWFpbiBpZnJhbWU='),
    ];
    let _0x12440f6 = null, _0x12441f6 = 0;
    for (const _0x12442f6 of _0x1243ff6) {
      document.querySelectorAll(_0x12442f6).forEach((_0x123a6f6) => {
        if (_0x123a6f6.id === _0x22de9f6) return;
        const _0x123a7f6 = _0x123a6f6.getBoundingClientRect();
        const _0x123a8f6 = _0x123a7f6.width * _0x123a7f6.height;
        if (_0x123a8f6 > _0x12441f6 && _0x123a7f6.width > 200 && _0x123a7f6.height > 200) { _0x12440f6 = _0x123a7f6; _0x12441f6 = _0x123a8f6; }
      });
      if (_0x12440f6) break;
    }
    if (_0x12440f6) {
      return { left: _0x12440f6.left, top: _0x12440f6.top, right: _0x12440f6.right, bottom: _0x12440f6.bottom };
    }
    // Fallback — full viewport minus our sidebar.
    const _0x12443f6 = _0x22df6f6 === _0xd6('c2lkZWJhcg==') ? _0x22df0f6 : 0;
    return { left: 0, top: 0, right: window.innerWidth - _0x12443f6, bottom: window.innerHeight };
  }

  function _0x22e05f6(_0x12538f6, _0x12539f6) {
    const _0x1253af6 = _0x22e04f6();
    const _0x1253bf6 = 8;
    return {
      x: Math.max(_0x1253af6.left + _0x1253bf6, Math.min(_0x1253af6.right - _0x22e03f6 - _0x1253bf6, _0x12538f6)),
      y: Math.max(_0x1253af6.top + _0x1253bf6, Math.min(_0x1253af6.bottom - _0x22e03f6 - _0x1253bf6, _0x12539f6)),
    };
  }
  function _0x22e06f6(_0x125ccf6, _0x125cdf6) {
    if (!_0x125ccf6 || !_0x125cdf6) return;
    const { x, y } = _0x22e05f6(_0x125cdf6.x, _0x125cdf6.y);
    _0x125ccf6.style.setProperty(_0xd6('bGVmdA=='), x + "px", _0xd6('aW1wb3J0YW50'));
    _0x125ccf6.style.setProperty("top", y + "px", _0xd6('aW1wb3J0YW50'));
    _0x125ccf6.style.setProperty(_0xd6('cmlnaHQ='), _0xd6('YXV0bw=='), _0xd6('aW1wb3J0YW50'));
    _0x125ccf6.style.setProperty(_0xd6('Ym90dG9t'), _0xd6('YXV0bw=='), _0xd6('aW1wb3J0YW50'));
  }
  function _0x22e07f6(_0x125d2f6) {
    try { chrome.storage.local.set({ tsFloatingLauncherPosition: _0x125d2f6 }); } catch (_0x125d4f6) {}
  }
  function _0x22e08f6(_0x12930f6) {
    let _0x12931f6 = false, _0x12932f6 = false, _0x12933f6 = 0, _0x12934f6 = 0, _0x12935f6 = 0, _0x12936f6 = 0;
    _0x12930f6.addEventListener(_0xd6('cG9pbnRlcmRvd24='), (_0x1272ff6) => {
      if (_0x1272ff6.button !== 0) return;
      _0x12931f6 = true; _0x12932f6 = false;
      const _0x12730f6 = _0x12930f6.getBoundingClientRect();
      _0x12935f6 = _0x12730f6.left; _0x12936f6 = _0x12730f6.top;
      _0x12933f6 = _0x1272ff6.clientX; _0x12934f6 = _0x1272ff6.clientY;
      _0x12930f6.classList.add(_0xd6('dHMtbGF1bmNoZXItZHJhZ2dpbmc='));
      try { _0x12930f6.setPointerCapture(_0x1272ff6.pointerId); } catch (_0x12732f6) {}
    });
    _0x12930f6.addEventListener(_0xd6('cG9pbnRlcm1vdmU='), (_0x127edf6) => {
      if (!_0x12931f6) return;
      const _0x127eef6 = _0x127edf6.clientX - _0x12933f6, _0x127eff6 = _0x127edf6.clientY - _0x12934f6;
      if (!_0x12932f6 && (Math.abs(_0x127eef6) > 3 || Math.abs(_0x127eff6) > 3)) _0x12932f6 = true;
      if (_0x12932f6) {
        _0x22e06f6(_0x12930f6, { x: _0x12935f6 + _0x127eef6, y: _0x12936f6 + _0x127eff6 });
        // Menu/submenu follow drag in real time.
        const _0x12846f6 = document.getElementById(_0x22decf6);
        if (_0x12846f6) _0x22e37f6(_0x12846f6);
        const _0x12847f6 = document.getElementById(_0x22dedf6);
        if (_0x12847f6) _0x22e38f6(_0x12847f6);
      }
    });
    const _0x12937f6 = (_0x12877f6) => {
      if (!_0x12931f6) return;
      _0x12931f6 = false;

      _0x12930f6.classList.remove(_0xd6('dHMtbGF1bmNoZXItZHJhZ2dpbmc='));
      try { _0x12930f6.releasePointerCapture(_0x12877f6.pointerId); } catch (_0x12875f6) {}
      if (_0x12932f6) {
        const _0x128c6f6 = _0x12930f6.getBoundingClientRect();
        const _0x128c7f6 = _0x22e05f6(_0x128c6f6.left, _0x128c6f6.top);
        _0x22e06f6(_0x12930f6, _0x128c7f6);
        _0x22e07f6(_0x128c7f6);
        _0x12930f6.dataset.tsJustDragged = "1";
        setTimeout(() => { delete _0x12930f6.dataset.tsJustDragged; }, 50);
      }
    };
    _0x12930f6.addEventListener(_0xd6('cG9pbnRlcnVw'), _0x12937f6);
    _0x12930f6.addEventListener(_0xd6('cG9pbnRlcmNhbmNlbA=='), _0x12937f6);
  }
  function _0x22e09f6() {
    if (document.getElementById(_0x22debf6)) return;
    const _0x12ac1f6 = document.createElement(_0xd6('YnV0dG9u'));
    _0x12ac1f6.id = _0x22debf6;
    _0x12ac1f6.type = _0xd6('YnV0dG9u');
    _0x12ac1f6.title = ((window.tsBrandName && window.tsBrandName()) || _0xd6('b2ZlcnJvbGdhcmNpYQ==')) + _0xd6('IOKAlCBjbGlxdWUgcGFyYSBhYnJpciBvIG1lbnUgKGFycmFzdGUgcGFyYSBtb3Zlcik=');
    const _0x12ac2f6 = document.createElement("img");
    _0x12ac2f6.src = _0x22df3f6();
    _0x12ac2f6.alt = "TS";
    _0x12ac1f6.appendChild(_0x12ac2f6);
    const _0x12ac3f6 = document.createElement(_0xd6('c3Bhbg=='));
    _0x12ac3f6.className = _0xd6('dHMtbGF1bmNoZXItZG90');
    _0x12ac3f6.setAttribute(_0xd6('ZGF0YS10cy1sYXVuY2hlci1kb3Q='), "");
    _0x12ac3f6.textContent = "";
    _0x12ac1f6.appendChild(_0x12ac3f6);
    document.body.appendChild(_0x12ac1f6);
    try {
      chrome.storage.local.get({ tsFloatingLauncherPosition: null }, (_0x12aa3f6) => {
        if (_0x12aa3f6 && _0x12aa3f6.tsFloatingLauncherPosition) _0x22e06f6(_0x12ac1f6, _0x12aa3f6.tsFloatingLauncherPosition);
      });
    } catch (_0x12aa5f6) {}
    _0x22e08f6(_0x12ac1f6);
    _0x12ac1f6.addEventListener(_0xd6('Y2xpY2s='), (_0x12ad5f6) => {
      _0x12ad5f6.stopPropagation();
      if (_0x12ac1f6.dataset.tsJustDragged) return;
      _0x22e2df6();
    });
  }

  function _0x22e0af6() {
    const _0x12aeaf6 = document.getElementById(_0x22debf6); if (_0x12aeaf6) _0x12aeaf6.remove();
    _0x22e2bf6();
  }

  // ===================== Native composer detection + wrap =====================
  function _0x22e0bf6() {
    const _0x12b2ff6 = [
      _0xd6('dGV4dGFyZWFbcGxhY2Vob2xkZXIqPSJBc2siXQ=='),
      _0xd6('dGV4dGFyZWFbcGxhY2Vob2xkZXIqPSJhc2siXQ=='),
      _0xd6('dGV4dGFyZWFbcGxhY2Vob2xkZXIqPSJwcm9tcHQiIGld'),
      _0xd6('dGV4dGFyZWFbcGxhY2Vob2xkZXIqPSJtZXNzYWdlIiBpXQ=='),
      _0xd6('ZGl2W2NvbnRlbnRlZGl0YWJsZT0idHJ1ZSJdW3JvbGU9InRleHRib3giXQ=='),
      _0xd6('Zm9ybSB0ZXh0YXJlYQ=='),
      _0xd6('dGV4dGFyZWE='),
    ];
    for (const _0x12b30f6 of _0x12b2ff6) {
      const _0x12b2bf6 = document.querySelectorAll(_0x12b30f6);
      for (const _0x12b2cf6 of _0x12b2bf6) {
        if (_0x12b2cf6.closest && (_0x12b2cf6.closest(`#${_0x22de8f6}`) || _0x12b2cf6.closest(`#${_0x22decf6}`) || _0x12b2cf6.closest(`#${_0x22dedf6}`))) continue;
        if (_0x12b2cf6.offsetParent !== null) return _0x12b2cf6;
      }
    }
    return null;
  }

  function _0x22e0cf6() {
    const _0x12c3bf6 = _0x22e0bf6();
    if (!_0x12c3bf6) return null;
    // Prefer enclosing form; else walk up looking for a container that also holds buttons.
    const _0x12c3cf6 = _0x12c3bf6.closest(_0xd6('Zm9ybQ=='));
    if (_0x12c3cf6) return _0x12c3cf6;
    let _0x12c3df6 = _0x12c3bf6.parentElement;
    let _0x12c3ef6 = 0;
    while (_0x12c3df6 && _0x12c3ef6 < 6) {
      const _0x12c25f6 = _0x12c3df6.querySelector(_0xd6('YnV0dG9u'));
      const _0x12c26f6 = _0x12c3df6.getBoundingClientRect();
      if (_0x12c25f6 && _0x12c26f6.width > 200 && _0x12c26f6.height > 40) return _0x12c3df6;
      _0x12c3df6 = _0x12c3df6.parentElement; _0x12c3ef6++;
    }
    return _0x12c3bf6.parentElement || _0x12c3bf6;
  }

  function _0x22e0df6() {
    // Nunca marca o composer da Lovable.
    return _0x22e0ef6();
  }
  function _0x22e0ef6() {
    document.querySelectorAll("." + _0x22deff6).forEach((_0x12c47f6) => _0x12c47f6.classList.remove(_0x22deff6));
  }

  function _0x22e0ff6() {
    // Badge desativado — mantém o prompt da Lovable com aparência padrão.
    const _0x12c59f6 = document.getElementById(_0xd6('dHMtbmF0aXZlLWJhZGdl'));
    if (_0x12c59f6) _0x12c59f6.remove();
  }

  function _0x22e10f6() {
    const _0x12c6bf6 = document.getElementById(_0xd6('dHMtbmF0aXZlLWJhZGdl')); if (_0x12c6bf6) _0x12c6bf6.remove();
  }

  // ===================== Selected Skill Badge (popup mode) =====================
  // When the user picks a skill via the slash picker, we don't write the
  // "/skill:..." prefix into the native textarea. Instead we keep the picked
  // skill in memory and render a small badge above the native composer.
  // The prefix is only prepended to the prompt at send time (and the badge is
  // cleared after the send is fired).
  let _0x22e11f6 = null;
  const _0x22e12f6 = _0xd6('dHMtc2tpbGwtYmFkZ2U=');
  const _0x22e13f6 = _0xd6('dHMtc2tpbGwtYmFkZ2Utc3R5bGU=');
  // Tracks the textarea we've padded so we can revert padding cleanly
  let _0x22e14f6 = null;
  let _0x22e15f6 = "";
  function _0x22e16f6() {
    if (document.getElementById(_0x22e13f6)) return;
    const _0x1391ef6 = document.createElement(_0xd6('c3R5bGU='));
    _0x1391ef6.id = _0x22e13f6;
    _0x1391ef6.textContent = `
      #${_0x22e12f6} {
        position: fixed; z-index: 2147483645;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 3px 6px 3px 6px; border-radius: 8px;
        background: var(--ts-brand-gradient);
        color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
        font-size: 11px; font-weight: 600; letter-spacing: 0.01em; line-height: 1;
        box-shadow: 0 2px 6px rgba(var(--ts-brand-primary-rgb),.35);
        opacity: 0; transform: translateY(-2px);
        transition: opacity .15s ease, transform .15s ease, left .15s ease, top .15s ease;
        pointer-events: auto; cursor: default; user-select: none;
        max-width: 240px; height: 22px;
      }
      #${_0x22e12f6}.ts-skill-open { opacity: 1; transform: translateY(0); }
      #${_0x22e12f6} .ts-skill-badge-icon {
        width: 14px; height: 14px; border-radius: 50%;
        background: rgba(255,255,255,.25);
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 9px;
      }
      #${_0x22e12f6} .ts-skill-badge-name {
        max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #${_0x22e12f6} .ts-skill-badge-x {
        margin-left: 2px; width: 14px; height: 14px; border-radius: 50%;
        background: rgba(255,255,255,.22); color: #fff; border: none; cursor: pointer;
        font-size: 12px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;
        padding: 0; transition: background .15s ease;
      }
      #${_0x22e12f6} .ts-skill-badge-x:hover { background: rgba(255,255,255,.4); }
    `;
    document.head.appendChild(_0x1391ef6);
  }
  function _0x22e17f6() {
    if (_0x22e14f6) {
      try { _0x22e14f6.style.paddingTop = _0x22e15f6 || ""; } catch (_0x13920f6) {}
      _0x22e14f6 = null;
      _0x22e15f6 = "";
    }
  }
  function _0x22e18f6() {
    const _0x13931f6 = _0x22e0bf6();
    if (!_0x13931f6) return;
    if (_0x22e14f6 !== _0x13931f6) {
      _0x22e17f6();
      _0x22e14f6 = _0x13931f6;
      _0x22e15f6 = _0x13931f6.style.paddingTop || "";
    }
    try { _0x13931f6.style.paddingTop = _0xd6('MzJweA=='); } catch (_0x13933f6) {}
  }
  function _0x22e19f6() {
    let _0x13bd2f6 = document.getElementById(_0x22e12f6);
    if (!_0x22e11f6 || _0x22df6f6 !== _0xd6('cG9wdXA=')) {
      if (_0x13bd2f6) _0x13bd2f6.remove();
      _0x22e17f6();
      return;
    }
    _0x22e16f6();
    if (!_0x13bd2f6) {
      _0x13bd2f6 = document.createElement("div");
      _0x13bd2f6.id = _0x22e12f6;
      document.body.appendChild(_0x13bd2f6);
    }
    const _0x13bd3f6 = String(_0x22e11f6.icon || "✦");
    const _0x13bd4f6 = _0x13bd3f6.trim().startsWith(_0xd6('PHN2Zw=='));
    const _0x13bd5f6 = _0x13bd4f6 ? _0x13bd3f6 : _0x22e2ef6(_0x13bd3f6);
    const _0x13bd6f6 = _0x22e2ef6(_0x22e11f6.label || _0x22e11f6.name || _0xd6('U2tpbGw='));
    _0x13bd2f6.innerHTML =
      `<span class="ts-skill-badge-icon">${_0x13bd5f6}</span>` +
      `<span class="ts-skill-badge-name">${_0x13bd6f6}</span>` +
      `<button type="button" class="ts-skill-badge-x" aria-label="Remover skill">×</button>`;
    const _0x13bd7f6 = _0x13bd2f6.querySelector(_0xd6('LnRzLXNraWxsLWJhZGdlLXg='));
    if (_0x13bd7f6) _0x13bd7f6.addEventListener(_0xd6('Y2xpY2s='), (_0x13ba1f6) => {
      _0x13ba1f6.preventDefault(); _0x13ba1f6.stopPropagation();
      _0x22e1cf6();
    });
    _0x22e18f6();
    _0x22e1af6();
    requestAnimationFrame(() => _0x13bd2f6.classList.add(_0xd6('dHMtc2tpbGwtb3Blbg==')));
  }
  function _0x22e1af6() {
    const _0x13deef6 = document.getElementById(_0x22e12f6);
    if (!_0x13deef6) return;
    const _0x13deff6 = _0x22e0bf6();
    if (!_0x13deff6) { _0x13deef6.remove(); _0x22e17f6(); return; }
    // Anchor inside the textarea, top-left corner
    const _0x13df0f6 = _0x13deff6.getBoundingClientRect();
    const _0x13df1f6 = _0x13deef6.offsetWidth || 140;
    const _0x13df2f6 = _0x13df0f6.top + 6;
    const _0x13df3f6 = Math.max(8, _0x13df0f6.left + 8);
    _0x13deef6.style.left = Math.min(_0x13df3f6, window.innerWidth - _0x13df1f6 - 8) + "px";
    _0x13deef6.style.top = _0x13df2f6 + "px";
  }
  function _0x22e1bf6(_0x13e00f6) {
    _0x22e11f6 = _0x13e00f6 || null;
    _0x22e19f6();
  }
  function _0x22e1cf6() {
    _0x22e11f6 = null;
    _0x22e17f6();
    _0x22e19f6();
  }

  setInterval(() => {
    if (_0x22df6f6 !== _0xd6('cG9wdXA=')) return;
    _0x22e0df6();
    _0x22e0ff6();
    if (_0x22e11f6) _0x22e1af6();
    if (typeof _0x22e1ff6 !== _0xd6('dW5kZWZpbmVk') && _0x22e1ff6.length) _0x22e22f6();
    _0x22e4ff6();
    _0x22e66f6();
  }, 800);
  window.addEventListener(_0xd6('c2Nyb2xs'), () => {
    if (_0x22df6f6 !== _0xd6('cG9wdXA=')) return;
    _0x22e0ff6();
    if (_0x22e11f6) _0x22e1af6();
    if (typeof _0x22e1ff6 !== _0xd6('dW5kZWZpbmVk') && _0x22e1ff6.length) _0x22e22f6();
  }, true);
  window.addEventListener(_0xd6('cmVzaXpl'), () => {
    if (_0x22df6f6 !== _0xd6('cG9wdXA=')) return;
    _0x22e0ff6();
    if (_0x22e11f6) _0x22e1af6();
    if (typeof _0x22e1ff6 !== _0xd6('dW5kZWZpbmVk') && _0x22e1ff6.length) _0x22e22f6();
  });


  // ===================== Popup attachment previews =====================
  const _0x22e1df6 = _0xd6('dHMtcG9wdXAtYXR0YWNoLXByZXZpZXc=');
  const _0x22e1ef6 = _0xd6('dHMtcG9wdXAtYXR0YWNoLXN0eWxl');
  let _0x22e1ff6 = []; // [{ id, name, size, type, blobUrl, file }]

  function _0x22e20f6() {
    if (document.getElementById(_0x22e1ef6)) return;
    const _0x15053f6 = document.createElement(_0xd6('c3R5bGU='));
    _0x15053f6.id = _0x22e1ef6;
    _0x15053f6.textContent = `
      #${_0x22e1df6} {
        position: fixed; z-index: 2147483645;
        display: flex; flex-wrap: wrap; gap: 6px;
        max-width: 520px; pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
      }
      #${_0x22e1df6} .ts-att-item {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 6px 4px 4px; border-radius: 10px;
        background: rgba(59,130,246,0.14);
        border: 1px solid rgba(59,130,246,0.38);
        color: #f4f4f5; font-size: 11px; font-weight: 500;
        max-width: 220px;
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      }
      #${_0x22e1df6} .ts-att-thumb {
        width: 28px; height: 28px; border-radius: 6px; object-fit: cover;
        background: rgba(255,255,255,0.08);
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 12px;
      }
      #${_0x22e1df6} .ts-att-name {
        max-width: 130px; white-space: nowrap; overflow: hidden;
        text-overflow: ellipsis;
      }
      #${_0x22e1df6} .ts-att-x {
        width: 16px; height: 16px; border-radius: 50%;
        background: rgba(255,255,255,0.20); color: #fff; border: none;
        cursor: pointer; font-size: 12px; line-height: 1;
        display: inline-flex; align-items: center; justify-content: center;
        padding: 0; transition: background .15s ease;
      }
      #${_0x22e1df6} .ts-att-x:hover { background: rgba(255,255,255,0.4); }
    `;
    document.head.appendChild(_0x15053f6);
  }

  function _0x22e21f6() {
    let _0x152caf6 = document.getElementById(_0x22e1df6);
    if (_0x22df6f6 !== _0xd6('cG9wdXA=') || !_0x22e1ff6.length) {
      if (_0x152caf6) _0x152caf6.remove();
      return;
    }
    _0x22e20f6();
    if (!_0x152caf6) {
      _0x152caf6 = document.createElement("div");
      _0x152caf6.id = _0x22e1df6;
      document.body.appendChild(_0x152caf6);
    }
    _0x152caf6.innerHTML = _0x22e1ff6.map((_0x1529af6) => {
      const _0x1529bf6 = _0x1529af6.type && _0x1529af6.type.indexOf(_0xd6('aW1hZ2Uv')) === 0;
      const _0x1529cf6 = _0x1529bf6 && _0x1529af6.blobUrl
        ? `<img class="ts-att-thumb" src="${_0x1529af6.blobUrl}" alt="">`
        : `<span class="ts-att-thumb">${_0x22df8f6.file}</span>`;
      const _0x1529df6 = _0x22e2ef6(_0x1529af6.name);
      let _0x1529ef6 = "";
      if (_0x1529af6.uploading) _0x1529ef6 = `<span class="ts-att-status" title="Enviando…">${_0x22df8f6.clock}</span>`;
      else if (_0x1529af6.uploadFailed) _0x1529ef6 = `<span class="ts-att-status" title="Falha no upload">${_0x22df8f6.alert}</span>`;
      else if (_0x1529af6.ready) _0x1529ef6 = `<span class="ts-att-status" title="Pronto">${_0x22df8f6.check}</span>`;
      return `<div class="ts-att-item" data-id="${_0x1529af6.id}">${_0x1529cf6}<span class="ts-att-name" title="${_0x1529df6}">${_0x1529df6}</span>${_0x1529ef6}<button type="button" class="ts-att-x" aria-label="Remover anexo" data-id="${_0x1529af6.id}">×</button></div>`;
    }).join("");
    _0x152caf6.querySelectorAll(_0xd6('LnRzLWF0dC14')).forEach((_0x152b2f6) => {
      _0x152b2f6.addEventListener(_0xd6('Y2xpY2s='), (_0x152c7f6) => {
        _0x152c7f6.preventDefault(); _0x152c7f6.stopPropagation();
        _0x22e28f6(_0x152b2f6.getAttribute(_0xd6('ZGF0YS1pZA==')));
      });
    });
    _0x22e22f6();
  }

  function _0x22e22f6() {
    const _0x1544ff6 = document.getElementById(_0x22e1df6);
    if (!_0x1544ff6) return;
    const _0x15450f6 = _0x22e0cf6() || _0x22e0bf6();
    if (!_0x15450f6) { _0x1544ff6.remove(); return; }
    const _0x15451f6 = _0x15450f6.getBoundingClientRect();
    _0x1544ff6.style.left = Math.max(8, _0x15451f6.left + 4) + "px";
    const _0x15452f6 = _0x1544ff6.offsetHeight || 36;
    _0x1544ff6.style.top = Math.max(8, _0x15451f6.top - _0x15452f6 - 6) + "px";
    _0x1544ff6.style.maxWidth = Math.min(_0x15451f6.width, 520) + "px";
  }

  function _0x22e23f6(_0x15503f6) {
    const _0x15504f6 = Array.from(_0x15503f6 || []);
    for (const _0x15505f6 of _0x15504f6) {
      if (!_0x15505f6) continue;
      // Avoid duplicate if sidepanel already broadcast this file
      const _0x154fcf6 = _0x22e1ff6.find(_0x154acf6 => _0x154acf6.name === (_0x15505f6.name || _0xd6('YXJxdWl2bw==')) && _0x154acf6.size === (_0x15505f6.size || 0));
      if (_0x154fcf6) continue;
      const id = _0xd6('YXR0Xw==') + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      let blobUrl = null;
      try { if (_0x15505f6.type && _0x15505f6.type.indexOf(_0xd6('aW1hZ2Uv')) === 0) blobUrl = URL.createObjectURL(_0x15505f6); } catch (_0x154cff6) {}
      _0x22e1ff6.push({
        id, name: _0x15505f6.name || _0xd6('YXJxdWl2bw=='), size: _0x15505f6.size || 0,
        type: _0x15505f6.type || "", blobUrl, file: _0x15505f6,
        uploading: true, uploadFailed: false, ready: false,
      });
    }
    _0x22e21f6();
  }

  function _0x22e24f6(_0x15655f6) {
    const _0x15656f6 = (_0x1553ef6) => (_0x1553ef6.name || "") + "::" + (_0x1553ef6.size || 0);
    const _0x15657f6 = new Set(_0x15655f6.map(_0x15656f6));
    const _0x15658f6 = _0x22e1ff6.filter(_0x155aef6 => !_0x15657f6.has(_0x15656f6(_0x155aef6)));
    for (const _0x15659f6 of _0x15658f6) { try { if (_0x15659f6.blobUrl) URL.revokeObjectURL(_0x15659f6.blobUrl); } catch(_0x155cef6){} }
    _0x22e1ff6 = _0x22e1ff6.filter(_0x15601f6 => _0x15657f6.has(_0x15656f6(_0x15601f6)));
    for (const _0x1565af6 of _0x15655f6) {
      const _0x15632f6 = _0x22e1ff6.find(_0x15630f6 => _0x15656f6(_0x15630f6) === _0x15656f6(_0x1565af6));
      if (_0x15632f6) {
        _0x15632f6.uploading = !!_0x1565af6.uploading;
        _0x15632f6.uploadFailed = !!_0x1565af6.uploadFailed;
        _0x15632f6.ready = !!_0x1565af6.ready;
        _0x15632f6.upload = _0x1565af6.upload || _0x15632f6.upload || null;
        if (_0x1565af6.type) _0x15632f6.type = _0x1565af6.type;
      } else {
        _0x22e1ff6.push({
          id: _0xd6('YXR0Xw==') + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          name: _0x1565af6.name || _0xd6('YXJxdWl2bw=='), size: _0x1565af6.size || 0, type: _0x1565af6.type || "",
          blobUrl: null, file: null,
          uploading: !!_0x1565af6.uploading, uploadFailed: !!_0x1565af6.uploadFailed, ready: !!_0x1565af6.ready,
          upload: _0x1565af6.upload || null,
        });
      }
    }
    // Expose a single source of truth for ready uploads
    try {
      window.TS_PENDING_ATTACHMENTS = _0x22e1ff6
        .filter(_0x15641f6 => _0x15641f6.ready && _0x15641f6.upload)
        .map(_0x15646f6 => _0x15646f6.upload);
    } catch (_0x15648f6) {}
    _0x22e21f6();
  }

  window.addEventListener(_0xd6('bWVzc2FnZQ=='), (_0x15a61f6) => {
    const _0x15a62f6 = _0x15a61f6 && _0x15a61f6.data;
    if (!_0x15a62f6 || _0x15a62f6.type !== _0xd6('VFNfT1ZFUkxBWV9BVFRBQ0hfU1RBVEU=')) return;
    _0x22e24f6(Array.isArray(_0x15a62f6.items) ? _0x15a62f6.items : []);
  });

  function _0x22e25f6() {
    return _0x22e1ff6.some(_0x15a67f6 => _0x15a67f6.uploading);
  }
  function _0x22e26f6() {
    return _0x22e1ff6.some(_0x15a6cf6 => _0x15a6cf6.uploadFailed);
  }
  function _0x22e27f6() {
    return _0x22e1ff6.filter(_0x15a75f6 => _0x15a75f6.ready && _0x15a75f6.upload).map(_0x15a7af6 => _0x15a7af6.upload);
  }


  function _0x22e28f6(_0x15ac1f6) {
    const _0x15ac2f6 = _0x22e1ff6.find((_0x15a97f6) => _0x15a97f6.id === _0x15ac1f6);
    if (!_0x15ac2f6) return;
    _0x22e1ff6 = _0x22e1ff6.filter((_0x15ab4f6) => _0x15ab4f6.id !== _0x15ac1f6);
    try { if (_0x15ac2f6.blobUrl) URL.revokeObjectURL(_0x15ac2f6.blobUrl); } catch (_0x15ab8f6) {}
    try {
      _0x22e42f6({ type: _0xd6('VFNfUE9QVVBfQUNUSU9O'), action: _0xd6('ZGV0YWNo'), name: _0x15ac2f6.name, size: _0x15ac2f6.size });
    } catch (_0x15abcf6) {}
    _0x22e21f6();
  }
  function _0x22e29f6() {
    for (const _0x15ad3f6 of _0x22e1ff6) {
      try { if (_0x15ad3f6.blobUrl) URL.revokeObjectURL(_0x15ad3f6.blobUrl); } catch (_0x15accf6) {}
    }
    _0x22e1ff6 = [];
    _0x22e21f6();

  }


  // ===================== FAB menu =====================
  let _0x22e2af6 = false;

  function _0x22e2bf6() {
    _0x22e2af6 = false;
    const _0x15d9cf6 = document.getElementById(_0x22decf6);
    if (_0x15d9cf6) { _0x15d9cf6.classList.remove(_0xd6('dHMtZmxvYXRpbmctbWVudS1vcGVu')); _0x15d9cf6.remove(); }
    _0x22e2cf6();
    const _0x15d9df6 = document.getElementById(_0x22debf6);
    if (_0x15d9df6) { _0x15d9df6.classList.remove(_0xd6('dHMtbGF1bmNoZXItYWN0aXZl')); _0x15d9df6.classList.remove(_0xd6('dHMtZmxvYXRpbmctbWVudS1vcGVu')); }
    console.log(_0xd6('W1RTIFBvcHVwXSBNZW51IG9wZW46'), _0x22e2af6);
  }
  function _0x22e2cf6() {
    const _0x15daff6 = document.getElementById(_0x22dedf6); if (_0x15daff6) _0x15daff6.remove();
  }

  function _0x22e2df6() {
    console.log(_0xd6('W1RTIFBvcHVwXSBMYXVuY2hlciBjbGlja2Vk'));
    if (_0x22e2af6 || document.getElementById(_0x22decf6)) { _0x22e2bf6(); return; }
    _0x22e3af6();
  }

  function _0x22e2ef6(_0x15dbdf6) {
    return String(_0x15dbdf6 || "").replace(/[&<>"']/g, (_0x15dd1f6) => ({
      "&": _0xd6('JmFtcDs='), "<": _0xd6('Jmx0Ow=='), ">": _0xd6('Jmd0Ow=='), '"': _0xd6('JnF1b3Q7'), "'": _0xd6('JiMzOTs=')
    }[_0x15dd1f6]));
  }

  function _0x22e2ff6(_0x15dd6f6) {
    try {
      if (!_0x15dd6f6) return "";
      const _0x15df6f6 = new URL(String(_0x15dd6f6), window.location.href);
      return /^https?:$/.test(_0x15df6f6.protocol) ? _0x15df6f6.href : "";
    } catch (_0x15df8f6) { return ""; }
  }

  function _0x22e30f6(url, _0x15e02f6 = {}) {
    return new Promise((_0x15e0bf6, _0x15e0cf6) => {
      try {
        chrome.runtime.sendMessage({
          action: _0xd6('cHJveHlGZXRjaA=='),
          url,
          method: _0x15e02f6.method || "GET",
          headers: _0x15e02f6.headers || {},
          body: _0x15e02f6.body || null,
        }, (_0x15e41f6) => {
          if (chrome.runtime.lastError) return _0x15e0cf6(new Error(chrome.runtime.lastError.message));
          if (!_0x15e41f6) return _0x15e0cf6(new Error(_0xd6('U2VtIHJlc3Bvc3RhIGRvIGJhY2tncm91bmQ=')));
          if (!_0x15e41f6.ok) return _0x15e0cf6(new Error(_0xd6('RXJybyA=') + (_0x15e41f6.status || 0)));
          _0x15e0bf6(_0x15e41f6.data);
        });
      } catch (_0x15e43f6) { _0x15e0cf6(_0x15e43f6); }
    });
  }

  async function _0x22e31f6() {
    // Neutralized: remote notifications feed disabled (previous owner's server).
    return [];
  }

  // Lucide icon SVGs (stroke uses currentColor in CSS).
  const _0x22e32f6 = {
    panelRight: _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIvPjxsaW5lIHgxPSIxNSIgeTE9IjMiIHgyPSIxNSIgeTI9IjIxIi8+PHBhdGggZD0iTTEwIDhsLTMgNCAzIDQiLz48L3N2Zz4='),
    badgeX:     _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuODUgOC42MmE0IDQgMCAwIDEgNC43OC00Ljc3IDQgNCAwIDAgMSA2Ljc0IDAgNCA0IDAgMCAxIDQuNzggNC43OCA0IDQgMCAwIDEgMCA2Ljc0IDQgNCAwIDAgMS00Ljc3IDQuNzggNCA0IDAgMCAxLTYuNzUgMCA0IDQgMCAwIDEtNC43OC00Ljc3IDQgNCAwIDAgMSAwLTYuNzZaIi8+PGxpbmUgeDE9IjkiIHkxPSI5IiB4Mj0iMTUiIHkyPSIxNSIvPjxsaW5lIHgxPSIxNSIgeTE9IjkiIHgyPSI5IiB5Mj0iMTUiLz48L3N2Zz4='),
    download:   _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDE1djRhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJ2LTQiLz48cG9seWxpbmUgcG9pbnRzPSI3IDEwIDEyIDE1IDE3IDEwIi8+PGxpbmUgeDE9IjEyIiB5MT0iMTUiIHgyPSIxMiIgeTI9IjMiLz48L3N2Zz4='),
    sparkles:   _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTEyIDMtMS45IDUuOGEyIDIgMCAwIDEtMS4zIDEuM0wzIDEybDUuOCAxLjlhMiAyIDAgMCAxIDEuMyAxLjNMMTIgMjFsMS45LTUuOGEyIDIgMCAwIDEgMS4zLTEuM0wyMSAxMmwtNS44LTEuOWEyIDIgMCAwIDEtMS4zLTEuM0wxMiAzWiIvPjxwYXRoIGQ9Ik01IDN2NCIvPjxwYXRoIGQ9Ik0xOSAxN3Y0Ii8+PHBhdGggZD0iTTMgNWg0Ii8+PHBhdGggZD0iTTE3IDE5aDQiLz48L3N2Zz4='),
    library:    _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTE2IDYgNCAxNCIvPjxwYXRoIGQ9Ik0xMiA2djE0Ii8+PHBhdGggZD0iTTggOHYxMiIvPjxwYXRoIGQ9Ik00IDR2MTYiLz48L3N2Zz4='),
    bell:       _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTE4IDhhNiA2IDAgMCAwLTEyIDBjMCA3LTMgOS0zIDloMThzLTMtMi0zLTkiLz48cGF0aCBkPSJNMTMuNzMgMjFhMiAyIDAgMCAxLTMuNDYgMCIvPjwvc3ZnPg=='),
    chevronR:   _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iOSAxOCAxNSAxMiA5IDYiLz48L3N2Zz4='),
    chevronL:   _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iMTUgMTggOSAxMiAxNSA2Ii8+PC9zdmc+'),
  };

  const _0x22e33f6 = _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMTEiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxMSIgcng9IjIiLz48cGF0aCBkPSJNNyAxMVY3YTUgNSAwIDAgMSA5LjktMSIvPjwvc3ZnPg==');
  const _0x22e34f6  = _0xd6('PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2VmNDQ0NCIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMTEiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxMSIgcng9IjIiIGZpbGw9InJnYmEoMjM5LDY4LDY4LC4xKSIvPjxwYXRoIGQ9Ik03IDExVjdhNSA1IDAgMCAxIDEwIDB2NCIvPjwvc3ZnPg==');

  function _0x22e35f6() {
    return [
      { action: _0xd6('c2lkZWJhcg=='),       icon: _0x22e32f6.panelRight, label: _0xd6('TW9kbyBTaWRlYmFy') },
      { action: _0xd6('d2F0ZXJtYXJr'),     icon: _0x22e32f6.badgeX,     label: _0xd6('UmVtb3ZlciBtYXJjYSBkJ8OhZ3Vh') },
      { action: _0xd6('ZG93bmxvYWQ='),      icon: _0x22e32f6.download,   label: _0xd6('QmFpeGFy') },
      { action: _0xd6('b3B0aW1pemU='),      icon: _0x22e32f6.sparkles,   label: _0xd6('T3RpbWl6YXI=') },
      { action: _0xd6('bm90aWZpY2F0aW9ucw=='), icon: _0x22e32f6.bell,       label: _0xd6('Tm90aWZpY2HDp8O1ZXM=') },
      { action: _0xd6('bG9jaw=='),          icon: _0x22df7f6 ? _0x22e34f6 : _0x22e33f6, label: _0x22df7f6 ? _0xd6('RGVzYmxvcXVlYXIgdGVjbGFkbw==') : _0xd6('QmxvcXVlYXIgdGVjbGFkbw=='), isLock: true },
      { action: _0xd6('cHJvbXB0cw=='),       icon: _0x22e32f6.library,    label: _0xd6('UHJvbXB0cyBQcm9udG9z'), isPrompts: true },
    ];
  }

  // Determine which side of the preview the launcher is on, to align the
  // menu opposite of the closest edge.
  function _0x22e36f6() {
    const _0x17772f6 = document.getElementById(_0x22debf6);
    const _0x17773f6 = _0x22e04f6();
    if (!_0x17772f6) return { hAlign: _0xd6('cmlnaHQ='), vAlign: "up" };
    const _0x17774f6 = _0x17772f6.getBoundingClientRect();
    const _0x17775f6 = _0x17774f6.left + _0x17774f6.width / 2, _0x17776f6 = _0x17774f6.top + _0x17774f6.height / 2;
    const _0x17777f6 = (_0x17773f6.left + _0x17773f6.right) / 2;
    const _0x17778f6 = (_0x17773f6.top + _0x17773f6.bottom) / 2;
    return {
      hAlign: _0x17775f6 >= _0x17777f6 ? _0xd6('cmlnaHQ=') : _0xd6('bGVmdA=='), // launcher on right ⇒ items align right
      vAlign: _0x17776f6 >= _0x17778f6 ? "up" : _0xd6('ZG93bg=='),
    };
  }

  function _0x22e37f6(_0x179a0f6) {
    const _0x179a1f6 = document.getElementById(_0x22debf6);
    const _0x179a2f6 = _0x22e04f6();
    const _0x179a3f6 = _0x22e36f6();
    _0x179a0f6.setAttribute(_0xd6('ZGF0YS1hbGlnbg=='), _0x179a3f6.hAlign);
    // Reset position props
    [_0xd6('bGVmdA=='),_0xd6('cmlnaHQ='),"top",_0xd6('Ym90dG9t')].forEach((_0x17873f6) => _0x179a0f6.style.setProperty(_0x17873f6, _0xd6('YXV0bw=='), _0xd6('aW1wb3J0YW50')));
    if (!_0x179a1f6) {
      _0x179a0f6.style.setProperty(_0xd6('cmlnaHQ='), _0xd6('MjRweA=='), _0xd6('aW1wb3J0YW50'));
      _0x179a0f6.style.setProperty(_0xd6('Ym90dG9t'), _0xd6('OTBweA=='), _0xd6('aW1wb3J0YW50'));
      return;
    }
    const _0x179a4f6 = _0x179a1f6.getBoundingClientRect();
    const _0x179a5f6 = 12;
    if (_0x179a3f6.hAlign === _0xd6('cmlnaHQ=')) {
      _0x179a0f6.style.setProperty(_0xd6('cmlnaHQ='), Math.max(8, window.innerWidth - _0x179a4f6.right) + "px", _0xd6('aW1wb3J0YW50'));
    } else {
      _0x179a0f6.style.setProperty(_0xd6('bGVmdA=='), Math.max(8, _0x179a4f6.left) + "px", _0xd6('aW1wb3J0YW50'));
    }
    if (_0x179a3f6.vAlign === "up") {
      _0x179a0f6.style.setProperty(_0xd6('Ym90dG9t'), Math.max(8, window.innerHeight - _0x179a4f6.top + _0x179a5f6) + "px", _0xd6('aW1wb3J0YW50'));
    } else {
      _0x179a0f6.style.setProperty("top", Math.max(8, _0x179a4f6.bottom + _0x179a5f6) + "px", _0xd6('aW1wb3J0YW50'));
    }
    // Constrain inside preview bounds
    _0x179a0f6.style.setProperty(_0xd6('bWF4LXdpZHRo'), Math.max(160, _0x179a2f6.right - _0x179a2f6.left - 16) + "px", _0xd6('aW1wb3J0YW50'));
  }

  function _0x22e38f6(_0x17b37f6) {
    const _0x17b38f6 = document.getElementById(_0x22decf6);
    if (!_0x17b38f6) return;
    const _0x17b39f6 = _0x22e36f6();
    _0x17b37f6.setAttribute(_0xd6('ZGF0YS1hbGlnbg=='), _0x17b39f6.hAlign);
    [_0xd6('bGVmdA=='),_0xd6('cmlnaHQ='),"top",_0xd6('Ym90dG9t')].forEach((_0x17a73f6) => _0x17b37f6.style.setProperty(_0x17a73f6, _0xd6('YXV0bw=='), _0xd6('aW1wb3J0YW50')));
    const _0x17b3af6 = _0x17b38f6.getBoundingClientRect();
    const _0x17b3bf6 = 10;
    if (_0x17b39f6.hAlign === _0xd6('cmlnaHQ=')) {
      // Open to the LEFT of the main menu
      _0x17b37f6.style.setProperty(_0xd6('cmlnaHQ='), Math.max(8, window.innerWidth - _0x17b3af6.left + _0x17b3bf6) + "px", _0xd6('aW1wb3J0YW50'));
    } else {
      // Open to the RIGHT of the main menu
      _0x17b37f6.style.setProperty(_0xd6('bGVmdA=='), Math.max(8, _0x17b3af6.right + _0x17b3bf6) + "px", _0xd6('aW1wb3J0YW50'));
    }
    _0x17b37f6.style.setProperty(_0xd6('Ym90dG9t'), Math.max(8, window.innerHeight - _0x17b3af6.bottom) + "px", _0xd6('aW1wb3J0YW50'));
  }

  let _0x22e39f6 = null;

  function _0x22e3af6() {
    const _0x18374f6 = document.getElementById(_0x22decf6);
    if (_0x18374f6) _0x18374f6.remove();
    _0x22e2cf6();

    const _0x18375f6 = document.createElement("div");
    _0x18375f6.id = _0x22decf6;
    _0x18375f6.setAttribute(_0xd6('cm9sZQ=='), _0xd6('bWVudQ=='));
    _0x18375f6.innerHTML = _0x22e35f6().map((_0x1805ff6, _0x18060f6) => {
      const _0x18061f6 = _0x1805ff6.isPrompts ? `<span class="ts-fab-chevron">${_0x22e32f6.chevronL}</span>` : "";
      const _0x18062f6 = _0x1805ff6.action === _0xd6('bm90aWZpY2F0aW9ucw==') ? `<span class="ts-fab-badge" data-ts-notif-badge style="display:none">0</span>` : "";
      const _0x18063f6 = _0x1805ff6.isPrompts ? _0xd6('IHRzLWZhYi1wcm9tcHRz') : (_0x1805ff6.isLock && _0x22df7f6 ? _0xd6('IHRzLWZhYi1sb2NrLWFjdGl2ZQ==') : "");
      return `<button type="button" class="ts-fab-item${_0x18063f6}" data-action="${_0x1805ff6.action}" style="animation-delay:${_0x18060f6 * 40}ms">` +
        `<span class="ts-fab-circle">${_0x1805ff6.icon}${_0x18062f6}</span>` +
        `<span class="ts-fab-label">${_0x22e2ef6(_0x1805ff6.label)}</span>` +
        _0x18061f6 +
      `</button>`;
    }).join("");
    document.body.appendChild(_0x18375f6);
    _0x18375f6.classList.add(_0xd6('dHMtZmxvYXRpbmctbWVudS1vcGVu'));
    _0x22e37f6(_0x18375f6);

    _0x22e2af6 = true;
    const _0x18376f6 = document.getElementById(_0x22debf6);
    if (_0x18376f6) { _0x18376f6.classList.add(_0xd6('dHMtbGF1bmNoZXItYWN0aXZl')); _0x18376f6.classList.add(_0xd6('dHMtZmxvYXRpbmctbWVudS1vcGVu')); }

    console.log(_0xd6('W1RTIFBvcHVwXSBNZW51IG9wZW46'), _0x22e2af6);
    _0x22e3cf6();

    _0x18375f6.querySelectorAll(_0xd6('W2RhdGEtYWN0aW9uXQ==')).forEach((_0x181b0f6) => {
      const _0x181b1f6 = _0x181b0f6.getAttribute(_0xd6('ZGF0YS1hY3Rpb24='));
      _0x181b0f6.addEventListener(_0xd6('Y2xpY2s='), (_0x181a9f6) => {
        _0x181a9f6.preventDefault();
        _0x181a9f6.stopPropagation();
        _0x22e3ff6(_0x181b1f6);
      });
      if (_0x181b1f6 === _0xd6('cHJvbXB0cw==')) {
        _0x181b0f6.addEventListener(_0xd6('bW91c2VlbnRlcg=='), () => {
          if (_0x22e39f6) clearTimeout(_0x22e39f6);
          if (!document.getElementById(_0x22dedf6)) _0x22e3bf6();
        });
        _0x181b0f6.addEventListener(_0xd6('bW91c2VsZWF2ZQ=='), () => {
          if (_0x22e39f6) clearTimeout(_0x22e39f6);
          _0x22e39f6 = setTimeout(() => {
            const _0x181c7f6 = document.getElementById(_0x22dedf6);
            if (_0x181c7f6 && !_0x181c7f6.matches(_0xd6('OmhvdmVy'))) _0x22e2cf6();
          }, 220);
        });
      } else {
        _0x181b0f6.addEventListener(_0xd6('bW91c2VlbnRlcg=='), () => { _0x22e2cf6(); });
      }
    });

    const _0x18377f6 = (_0x182eff6) => {
      const _0x182f0f6 = document.getElementById(_0x22debf6);
      const _0x182f1f6 = document.getElementById(_0x22dedf6);
      const _0x182f2f6 = document.getElementById(_0x22decf6);
      if (_0x182f2f6 && _0x182f2f6.contains(_0x182eff6.target)) return;
      if (_0x182f1f6 && _0x182f1f6.contains(_0x182eff6.target)) return;
      if (_0x182f0f6 && _0x182f0f6.contains(_0x182eff6.target)) return;
      _0x22e2bf6();
      document.removeEventListener(_0xd6('Y2xpY2s='), _0x18377f6, true);
    };
    setTimeout(() => document.addEventListener(_0xd6('Y2xpY2s='), _0x18377f6, true), 0);

    const _0x18378f6 = () => {
      if (!_0x22e2af6) return;
      _0x22e37f6(_0x18375f6);
      const _0x1832df6 = document.getElementById(_0x22dedf6);
      if (_0x1832df6) _0x22e38f6(_0x1832df6);
    };
    window.addEventListener(_0xd6('cmVzaXpl'), _0x18378f6);
    window.addEventListener(_0xd6('c2Nyb2xs'), _0x18378f6, true);
  }

  function _0x22e3bf6() {
    _0x22e2cf6();
    const _0x184f8f6 = document.getElementById(_0x22decf6);
    if (!_0x184f8f6) return;
    const _0x184f9f6 = document.createElement("div");
    _0x184f9f6.id = _0x22dedf6;
    const _0x184faf6 = (_0x22dfaf6 && _0x22dfaf6.length) ? _0x22dfaf6 : [];
    _0x184f9f6.innerHTML = _0x184faf6.length
      ? _0x184faf6.map((_0x1848af6, _0x1848bf6) =>
          `<button class="ts-fab-item" data-prompt-index="${_0x1848bf6}" style="animation-delay:${_0x1848bf6 * 25}ms" title="${_0x22e2ef6(_0x1848af6.label)}">` +
            `<span class="ts-fab-circle">${(function(_0x1846df6){_0x1846df6=String(_0x1846df6||"✦");return _0x1846df6.trim().charAt(0)==="<"?_0x1846df6:_0x22e2ef6(_0x1846df6);})(_0x1848af6.icon)}</span>` +
            `<span class="ts-fab-label">${_0x22e2ef6(_0x1848af6.label)}</span>` +
          `</button>`
        ).join("")
      : `<div class="ts-fab-item" style="cursor:default;opacity:1">Carregando prompts…</div>`;
    document.body.appendChild(_0x184f9f6);
    _0x22e38f6(_0x184f9f6);

    _0x184f9f6.addEventListener(_0xd6('bW91c2VlbnRlcg=='), () => {
      if (_0x22e39f6) clearTimeout(_0x22e39f6);
    });
    _0x184f9f6.addEventListener(_0xd6('bW91c2VsZWF2ZQ=='), () => {
      if (_0x22e39f6) clearTimeout(_0x22e39f6);
      _0x22e39f6 = setTimeout(() => _0x22e2cf6(), 220);
    });

    _0x184f9f6.querySelectorAll(_0xd6('W2RhdGEtcHJvbXB0LWluZGV4XQ==')).forEach((_0x18503f6) => {
      _0x18503f6.addEventListener(_0xd6('Y2xpY2s='), (_0x185a8f6) => {
        _0x185a8f6.stopPropagation();
        const _0x185a9f6 = parseInt(_0x18503f6.getAttribute(_0xd6('ZGF0YS1wcm9tcHQtaW5kZXg=')), 10);
        const _0x185aaf6 = _0x22dfaf6[_0x185a9f6];
        if (!_0x185aaf6) return;
        const _0x185abf6 = _0x22e46f6(_0x185aaf6.prompt);
        if (_0x185abf6) {
          _0x22e41f6(_0xd6('UHJvbXB0IGluc2VyaWRvIOKAlCByZXZpc2UgZSBlbnZpZQ=='), _0xd6('c3VjY2Vzcw=='));
        } else {
          _0x22e41f6(_0xd6('Q29tcG9zZXIgbmF0aXZvIG7Do28gZW5jb250cmFkbw=='), _0xd6('ZXJyb3I='));
        }
        _0x22e2cf6();
      });
    });
  }

  async function _0x22e3cf6() {
    try {
      const _0x185c5f6 = await _0x22e31f6();
      if (!Array.isArray(_0x185c5f6)) return;
      chrome.storage.local.get([_0xd6('cWxfcmVhZF9ub3RpZnM=')], (_0x18688f6) => {
        const _0x18689f6 = (_0x18688f6 && _0x18688f6.ql_read_notifs) || [];
        const _0x1868af6 = _0x185c5f6.filter((_0x18623f6) => !_0x18689f6.includes(_0x18623f6.id)).length;
        document.querySelectorAll(_0xd6('W2RhdGEtdHMtbm90aWYtYmFkZ2Vd')).forEach((_0x18663f6) => {
          _0x18663f6.textContent = String(_0x1868af6);
          _0x18663f6.style.display = _0x1868af6 > 0 ? _0xd6('YmxvY2s=') : _0xd6('bm9uZQ==');
        });
        const _0x1868bf6 = document.getElementById(_0x22debf6);
        if (_0x1868bf6) {
          _0x1868bf6.classList.toggle(_0xd6('dHMtaGFzLXVucmVhZA=='), _0x1868af6 > 0);
          const _0x186b3f6 = _0x1868bf6.querySelector(_0xd6('W2RhdGEtdHMtbGF1bmNoZXItZG90XQ=='));
          if (_0x186b3f6) _0x186b3f6.textContent = _0x1868af6 > 9 ? "9+" : (_0x1868af6 > 0 ? String(_0x1868af6) : "");
        }
      });
    } catch (_0x186b5f6) {}
  }

  function _0x22e3df6(_0x18968f6) {
    const _0x18969f6 = document.getElementById(_0x22debf6);
    const _0x1896af6 = _0x18969f6 ? _0x18969f6.getBoundingClientRect() : { right: window.innerWidth - 24, top: 24, bottom: 80 };
    const _0x1896bf6 = Math.min(340, window.innerWidth - 24);
    const _0x1896cf6 = Math.max(12, Math.min(window.innerWidth - _0x1896bf6 - 12, _0x1896af6.right - _0x1896bf6));
    const _0x1896df6 = Math.max(12, Math.min(window.innerHeight - 140, _0x1896af6.top));
    _0x18968f6.style.setProperty(_0xd6('bGVmdA=='), _0x1896cf6 + "px", _0xd6('aW1wb3J0YW50'));
    _0x18968f6.style.setProperty("top", _0x1896df6 + "px", _0xd6('aW1wb3J0YW50'));
  }

  async function _0x22e3ef6() {
    let _0x189a5f6 = document.getElementById(_0x22deef6);
    if (_0x189a5f6) { _0x189a5f6.remove(); return; }
    _0x189a5f6 = document.createElement("div");
    _0x189a5f6.id = _0x22deef6;
    _0x189a5f6.innerHTML = _0xd6('PGRpdiBjbGFzcz0idHMtbm90aWYtaGVhZCI+PHNwYW4+Tm90aWZpY2HDp8O1ZXM8L3NwYW4+PGJ1dHRvbiBjbGFzcz0idHMtbm90aWYtY2xvc2UiIHR5cGU9ImJ1dHRvbiI+JHtPRkdfSUNPTlMueH08L2J1dHRvbj48L2Rpdj48ZGl2IGNsYXNzPSJ0cy1ub3RpZi1saXN0Ij48cCBjbGFzcz0idHMtbm90aWYtZW1wdHkiPkNhcnJlZ2FuZG8uLi48L3A+PC9kaXY+');
    document.body.appendChild(_0x189a5f6);
    _0x22e3df6(_0x189a5f6);
    _0x189a5f6.querySelector(_0xd6('LnRzLW5vdGlmLWNsb3Nl')).addEventListener(_0xd6('Y2xpY2s='), () => _0x189a5f6.remove());

    try {
      const _0x18b5af6 = await _0x22e31f6();
      const _0x18b5bf6 = _0x189a5f6.querySelector(_0xd6('LnRzLW5vdGlmLWxpc3Q='));
      if (!Array.isArray(_0x18b5af6) || !_0x18b5af6.length) { _0x18b5bf6.innerHTML = _0xd6('PHAgY2xhc3M9InRzLW5vdGlmLWVtcHR5Ij5OZW5odW1hIG5vdGlmaWNhw6fDo28uPC9wPg=='); return; }
      chrome.storage.local.set({ ql_read_notifs: _0x18b5af6.map((_0x18a00f6) => _0x18a00f6.id) });
      document.querySelectorAll(_0xd6('W2RhdGEtdHMtbm90aWYtYmFkZ2Vd')).forEach((_0x18a1df6) => { _0x18a1df6.style.display = _0xd6('bm9uZQ=='); });
      _0x18b5bf6.innerHTML = _0x18b5af6.map((_0x18b54f6) => {
        const _0x18b55f6 = _0x22e2ff6(_0x18b54f6.link);
        const _0x18b56f6 = _0x18b55f6 ? _0xd6('PGEgY2xhc3M9InRzLW5vdGlmLWxpbmsiIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIG5vcmVmZXJyZXIiIGhyZWY9Ig==') + _0x22e2ef6(_0x18b55f6) + _0xd6('Ij5BYnJpciBsaW5rIOKGkjwvYT4=') : '';
        const _0x18b57f6 = _0x18b54f6.created_at ? new Date(_0x18b54f6.created_at).toLocaleString(_0xd6('cHQtQlI=')) : '';
        return _0xd6('PGRpdiBjbGFzcz0idHMtbm90aWYtaXRlbSI+PGRpdiBjbGFzcz0idHMtbm90aWYtdGl0bGUiPg==') + _0x22e2ef6(_0x18b54f6.title || _0xd6('Tm90aWZpY2HDp8Ojbw==')) + _0xd6('PC9kaXY+PGRpdiBjbGFzcz0idHMtbm90aWYtbXNnIj4=') + _0x22e2ef6(_0x18b54f6.message || '') + _0xd6('PC9kaXY+') + _0x18b56f6 + _0xd6('PGRpdiBjbGFzcz0idHMtbm90aWYtZGF0ZSI+') + _0x22e2ef6(_0x18b57f6) + _0xd6('PC9kaXY+PC9kaXY+');
      }).join('');
    } catch (_0x18b5df6) {
      const _0x18b6ef6 = _0x189a5f6.querySelector(_0xd6('LnRzLW5vdGlmLWxpc3Q='));
      if (_0x18b6ef6) _0x18b6ef6.innerHTML = _0xd6('PHAgY2xhc3M9InRzLW5vdGlmLWVtcHR5Ij5FcnJvIGFvIGNhcnJlZ2FyLjwvcD4=');
    }
  }


  function _0x22e3ff6(_0x18bdaf6) {
    if (_0x18bdaf6 === _0xd6('c2lkZWJhcg==')) {
      _0x22e02f6(_0xd6('c2lkZWJhcg=='));
      try { chrome.storage.local.set({ tsExtensionLayoutMode: _0xd6('c2lkZWJhcg==') }); } catch (_0x18b78f6) {}
      _0x22e2bf6();
    } else if (_0x18bdaf6 === _0xd6('d2F0ZXJtYXJr')) {
      _0x22e43f6(_0xd6('d2F0ZXJtYXJr'));
      _0x22e41f6(_0xd6('UmVtb3ZlbmRvIG1hcmNhIGQnw6FndWHigKY='));
      _0x22e2bf6();
    } else if (_0x18bdaf6 === _0xd6('ZG93bmxvYWQ=')) {
      _0x22e43f6(_0xd6('ZG93bmxvYWQ='));
      _0x22e41f6(_0xd6('QmFpeGFuZG8gYXJxdWl2b3MgZG8gcHJvamV0b+KApg=='));
      _0x22e2bf6();
    } else if (_0x18bdaf6 === _0xd6('b3B0aW1pemU=')) {
      // Optimize text already in native composer
      const _0x18bcbf6 = _0x22e0bf6();
      const _0x18bccf6 = _0x18bcbf6 ? _0x22e44f6(_0x18bcbf6).trim() : "";
      if (!_0x18bccf6) {
        _0x22e41f6(_0xd6('RGlnaXRlIGFsZ28gbm8gY2hhdCBuYXRpdm8gYW50ZXMgZGUgb3RpbWl6YXI='), _0xd6('ZXJyb3I='));
        return;
      }
      _0x22e43f6(_0xd6('b3B0aW1pemU='), { prompt: _0x18bccf6 });
      _0x22e41f6(_0xd6('T3RpbWl6YW5kbyBwcm9tcHQgZG8gY29tcG9zZXIgbmF0aXZv4oCm'));
      _0x22e2bf6();
    } else if (_0x18bdaf6 === _0xd6('bm90aWZpY2F0aW9ucw==')) {
      _0x22e3ef6();
    } else if (_0x18bdaf6 === _0xd6('bG9jaw==')) {
      _0x22df7f6 = !_0x22df7f6;
      try { chrome.storage.local.set({ ts_intercept_locked: _0x22df7f6 }); } catch (_0x18bd6f6) {}
      _0x22e41f6(_0x22df7f6 ? _0xd6('8J+UkiBUZWNsYWRvIGJsb3F1ZWFkbyDigJQgZXh0ZW5zw6NvIHBhdXNhZGE=') : _0xd6('8J+UkyBUZWNsYWRvIGRlc2Jsb3F1ZWFkbw=='), _0x22df7f6 ? _0xd6('ZXJyb3I=') : _0xd6('c3VjY2Vzcw=='));
      _0x22e2bf6();
    } else if (_0x18bdaf6 === _0xd6('cHJvbXB0cw==')) {
      if (document.getElementById(_0x22dedf6)) { _0x22e2cf6(); return; }
      _0x22e3bf6();
    }
  }

  let _0x22e40f6 = null;
  function _0x22e41f6(_0x191ebf6, _0x191ecf6) {
    let _0x191edf6 = document.getElementById(_0xd6('dHMtYWN0aW9uLXRvYXN0'));
    if (!_0x191edf6) {
      _0x191edf6 = document.createElement("div");
      _0x191edf6.id = _0xd6('dHMtYWN0aW9uLXRvYXN0');
      document.body.appendChild(_0x191edf6);
    }
    _0x191edf6.textContent = _0x191ebf6 || "";
    _0x191edf6.classList.remove(_0xd6('dHMtdG9hc3QtZXJyb3I='), _0xd6('dHMtdG9hc3Qtc3VjY2Vzcw=='));
    if (_0x191ecf6 === _0xd6('ZXJyb3I=')) _0x191edf6.classList.add(_0xd6('dHMtdG9hc3QtZXJyb3I='));
    if (_0x191ecf6 === _0xd6('c3VjY2Vzcw==')) _0x191edf6.classList.add(_0xd6('dHMtdG9hc3Qtc3VjY2Vzcw=='));

    // Anchor above the active composer (native or extension)
    let _0x191eef6 = null;
    try {
      const _0x18fddf6 = _0x22e0cf6();
      if (_0x18fddf6) _0x191eef6 = _0x18fddf6.getBoundingClientRect();
    } catch (_0x18fdff6) {}
    if (!_0x191eef6) {
      const _0x19000f6 = _0x22e0bf6();
      if (_0x19000f6) _0x191eef6 = _0x19000f6.getBoundingClientRect();
    }
    let _0x191eff6, _0x191f0f6;
    if (_0x191eef6 && _0x191eef6.width > 0) {
      _0x191eff6 = _0x191eef6.left + _0x191eef6.width / 2;
      _0x191f0f6 = Math.max(8, window.innerHeight - _0x191eef6.top + 10);
    } else {
      _0x191eff6 = window.innerWidth / 2;
      _0x191f0f6 = 24;
    }
    _0x191edf6.style.setProperty(_0xd6('bGVmdA=='), _0x191eff6 + "px", _0xd6('aW1wb3J0YW50'));
    _0x191edf6.style.setProperty(_0xd6('cmlnaHQ='), _0xd6('YXV0bw=='), _0xd6('aW1wb3J0YW50'));
    _0x191edf6.style.setProperty("top", _0xd6('YXV0bw=='), _0xd6('aW1wb3J0YW50'));
    _0x191edf6.style.setProperty(_0xd6('Ym90dG9t'), _0x191f0f6 + "px", _0xd6('aW1wb3J0YW50'));

    // Force reflow then show
    void _0x191edf6.offsetWidth;
    _0x191edf6.classList.add(_0xd6('dHMtdmlzaWJsZQ=='));

    if (_0x22e40f6) clearTimeout(_0x22e40f6);
    _0x22e40f6 = setTimeout(() => {
      try {
        _0x191edf6.classList.remove(_0xd6('dHMtdmlzaWJsZQ=='));
        setTimeout(() => { try { _0x191edf6.remove(); } catch (_0x191e8f6) {} }, 220);
      } catch (_0x191eaf6) {}
      _0x22e40f6 = null;
    }, 2000);
  }

  function _0x22e42f6(_0x1921df6) {
    const _0x1921ef6 = document.getElementById(_0x22de9f6);
    if (!_0x1921ef6 || !_0x1921ef6.contentWindow) return false;
    try { _0x1921ef6.contentWindow.postMessage(_0x1921df6, "*"); return true; } catch (_0x19220f6) { return false; }
  }
  function _0x22e43f6(action, _0x19236f6) {
    _0x22e42f6(Object.assign({ type: _0xd6('VFNfUE9QVVBfQUNUSU9O'), action }, _0x19236f6 || {}));
  }

  // ===================== Composer read / write =====================
  function _0x22e44f6(_0x1925bf6) {
    if (!_0x1925bf6) return "";
    if (_0x1925bf6.tagName === _0xd6('VEVYVEFSRUE=') || _0x1925bf6.tagName === _0xd6('SU5QVVQ=')) return _0x1925bf6.value || "";
    return _0x1925bf6.innerText || _0x1925bf6.textContent || "";
  }
  function _0x22e45f6(_0x1926ff6) {
    if (!_0x1926ff6) return;
    if (_0x1926ff6.tagName === _0xd6('VEVYVEFSRUE=') || _0x1926ff6.tagName === _0xd6('SU5QVVQ=')) {
      const _0x192a9f6 = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, _0xd6('dmFsdWU=')) || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, _0xd6('dmFsdWU='));
      if (_0x192a9f6 && _0x192a9f6.set) _0x192a9f6.set.call(_0x1926ff6, "");
      else _0x1926ff6.value = "";
      _0x1926ff6.dispatchEvent(new Event(_0xd6('aW5wdXQ='), { bubbles: true }));
    } else {
      _0x1926ff6.innerHTML = "";
      _0x1926ff6.dispatchEvent(new InputEvent(_0xd6('aW5wdXQ='), { bubbles: true }));
    }
  }

  // Reusable insert helper — used by prompt template menu.
  // Does NOT auto-send. If composer is non-empty, append with newline.
  function _0x22e46f6(_0x193f8f6) {
    const _0x193f9f6 = _0x22e0bf6();
    if (!_0x193f9f6) {
      console.warn(_0xd6('W1RTIFBvcHVwXSBOYXRpdmUgTG92YWJsZSB0ZXh0YXJlYSBub3QgZm91bmQ='));
      return false;
    }
    _0x193f9f6.focus();
    const _0x193faf6 = _0x22e44f6(_0x193f9f6);
    const _0x193fbf6 = _0x193faf6 && _0x193faf6.trim()
      ? _0x193faf6.replace(/\s+$/, "") + "\n\n" + _0x193f8f6
      : _0x193f8f6;
    if (_0x193f9f6.tagName === _0xd6('VEVYVEFSRUE=') || _0x193f9f6.tagName === _0xd6('SU5QVVQ=')) {
      const _0x193c3f6 = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, _0xd6('dmFsdWU=')) || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, _0xd6('dmFsdWU='));
      if (_0x193c3f6 && _0x193c3f6.set) _0x193c3f6.set.call(_0x193f9f6, _0x193fbf6);
      else _0x193f9f6.value = _0x193fbf6;
      _0x193f9f6.dispatchEvent(new Event(_0xd6('aW5wdXQ='), { bubbles: true }));
    } else if (_0x193f9f6.isContentEditable || _0x193f9f6.getAttribute(_0xd6('Y29udGVudGVkaXRhYmxl')) === _0xd6('dHJ1ZQ==')) {
      _0x193f9f6.textContent = _0x193fbf6;
      _0x193f9f6.dispatchEvent(new InputEvent(_0xd6('aW5wdXQ='), { bubbles: true }));
    }
    return true;
  }

  function _0x22e47f6(prompt, _0x194bff6) {
    const _0x194c0f6 = { type: _0xd6('VFNfUE9QVVBfQUNUSU9O'), action: _0xd6('c2VuZA=='), prompt };
    if (Array.isArray(_0x194bff6) && _0x194bff6.length) _0x194c0f6.files = _0x194bff6;
    _0x22de7f6(_0xd6('W1RTIE5hdGl2ZSBTZW5kXSBwZW5kaW5nIGF0dGFjaG1lbnRzOg=='), window.TS_PENDING_ATTACHMENTS);
    _0x22de7f6(_0xd6('W1RTIE5hdGl2ZSBTZW5kXSBmaWxlcyBzZW50Og=='), _0x194c0f6.files || []);
    const _0x194c1f6 = _0x22e42f6(_0x194c0f6);
    if (!_0x194c1f6) _0x22e41f6(_0xd6('UGFpbmVsIG7Do28gcHJvbnRvLiBBYnJhIG8gbW9kbyBzaWRlYmFyIHVtYSB2ZXou'), _0xd6('ZXJyb3I='));
    return _0x194c1f6;
  }


  function _0x22e48f6(files) {
    _0x22e41f6(_0xd6('RW52aWFuZG8g') + files.length + _0xd6('IGFycXVpdm8ocynigKY='));
    _0x22e42f6({ type: _0xd6('VFNfUE9QVVBfQUNUSU9O'), action: _0xd6('YXR0YWNo'), files });
    try { _0x22e23f6(files); } catch (_0x194c3f6) {}
  }

  // ===== Unified popup native send handler =====
  // All paths (Enter on textarea, click on native send button, form submit)
  // must route through this single function. It NEVER falls back to Lovable's
  // own send — that would drop the extension's uploaded files[] from the payload.
  function _0x22e49f6() {
    _0x22de7f6(_0xd6('W1RTIFBvcHVwXSBoYW5kbGVQb3B1cE5hdGl2ZVNlbmQgZW50ZXJlZA=='));
    const _0x1981bf6 = _0x22e0bf6();
    const _0x1981cf6 = _0x1981bf6 ? _0x22e44f6(_0x1981bf6).trim() : "";
    const _0x1981df6 = _0x1981cf6.length > 0;
    const _0x1981ef6 = _0x22e27f6();
    const _0x1981ff6 = _0x1981ef6.length > 0;
    _0x22de7f6(_0xd6('W1RTIFBvcHVwXSBtZXNzYWdlOg=='), _0x1981cf6);
    _0x22de7f6(_0xd6('W1RTIFBvcHVwXSBhdHRhY2htZW50cyBiZWZvcmUgc2VuZDo='), _0x22e1ff6);
    _0x22de7f6(_0xd6('W1RTIFBvcHVwXSByZWFkeSBmaWxlcyBmb3IgcGF5bG9hZDo='), _0x1981ef6);

    if (_0x22e25f6()) {
      _0x22e41f6(_0xd6('QWd1YXJkZSBvIHVwbG9hZCB0ZXJtaW5hcg=='), _0xd6('aW5mbw=='));
      return false;
    }
    if (_0x22e26f6()) {
      _0x22e41f6(_0xd6('UmVtb3ZhIG8gYW5leG8gY29tIGZhbGhhIGFudGVzIGRlIGVudmlhci4='), _0xd6('ZXJyb3I='));
      return false;
    }
    if (!_0x1981df6 && !_0x22e11f6 && !_0x1981ff6) {
      _0x22e41f6(_0xd6('TmFkYSBwYXJhIGVudmlhci4='), _0xd6('ZXJyb3I='));
      return false;
    }

    if (_0x1981bf6) _0x22e45f6(_0x1981bf6);
    let _0x19820f6 = _0x1981cf6;
    if (_0x22e11f6) {
      const _0x1974ff6 = _0x22e11f6.prefix
        || (_0x22e11f6.content ? _0x22e11f6.content : "");
      _0x19820f6 = _0x1981cf6 ? (_0x1974ff6 + (_0x1974ff6.endsWith(":") || _0x1974ff6.endsWith(" ") ? "" : " ") + _0x1981cf6) : _0x1974ff6;
      _0x22e1cf6();
    }
    // Qualidade: força Lovable a executar o prompt com máxima precisão
    if (_0x19820f6 && _0x19820f6.trim().length > 20) {
      _0x19820f6 = _0x19820f6.trimEnd() + _0xd6('CgpJTVBPUlRBTlRFOiBFeGVjdXRlIFRPRE9TIG9zIGRldGFsaGVzIGRlc3RhIHRhcmVmYSBjb20gbcOheGltYSBwcmVjaXPDo28uIE7Do28gaWdub3JlIG5hZGEsIG7Do28gc2ltcGxpZmlxdWUsIGltcGxlbWVudGUgRVhBVEFNRU5URSBvIHF1ZSBmb2kgcGVkaWRvLg==');
    }
    const _0x19821f6 = _0x22e47f6(_0x19820f6, _0x1981ef6);
    if (_0x19821f6 === false && _0x1981ff6) {
      _0x22e41f6(_0xd6('RW52aW8gaW50ZXJjZXB0YWRvIGZhbGhvdS4gVmVyaWZpcXVlIG8gY29uc29sZS4='), _0xd6('ZXJyb3I='));
      return false;
    }
    _0x22e41f6(_0xd6('RW52aWFuZG8gcGVsbyBtw6l0b2RvIGRhIGV4dGVuc8Ojb+KApg=='));
    return true;
  }

  // Intercept Enter on the native composer in popup mode.
  document.addEventListener(_0xd6('a2V5ZG93bg=='), (_0x19d8cf6) => {
    if (_0x22df6f6 !== _0xd6('cG9wdXA=')) return;
    if (_0x22df7f6) return; // 🔒 cadeado ativo — não intercepta teclas
    if (!location.pathname.match(/\/projects\/[0-9a-fA-F-]{36}/i)) return; // só dentro de projetos
    if (_0x19d8cf6.key !== _0xd6('RW50ZXI=') || _0x19d8cf6.shiftKey || _0x19d8cf6.isComposing) return;
    const _0x19d8df6 = _0x19d8cf6.target;
    if (!_0x19d8df6 || !(_0x19d8df6.tagName === _0xd6('VEVYVEFSRUE=') || (_0x19d8df6.getAttribute && _0x19d8df6.getAttribute(_0xd6('Y29udGVudGVkaXRhYmxl')) === _0xd6('dHJ1ZQ==')))) return;
    if (_0x19d8df6.closest && (_0x19d8df6.closest(`#${_0x22de8f6}`) || _0x19d8df6.closest(`#${_0x22decf6}`) || _0x19d8df6.closest(`#${_0x22dedf6}`))) return;
    const _0x19d8ef6 = _0x22e44f6(_0x19d8df6).trim();
    if (!_0x19d8ef6 && !_0x22e11f6 && !_0x22e27f6().length && !_0x22e1ff6.length) return;
    _0x19d8cf6.preventDefault();
    _0x19d8cf6.stopPropagation();
    _0x19d8cf6.stopImmediatePropagation?.();
    _0x22e49f6();
  }, true);

  // Intercept form submit in popup mode.
  document.addEventListener(_0xd6('c3VibWl0'), (_0x1a2c1f6) => {
    if (_0x22df6f6 !== _0xd6('cG9wdXA=')) return;
    if (_0x22df7f6) return; // 🔒 cadeado
    if (!location.pathname.match(/\/projects\/[0-9a-fA-F-]{36}/i)) return;
    const _0x1a2c2f6 = _0x1a2c1f6.target;
    if (!_0x1a2c2f6 || !_0x1a2c2f6.contains) return;
    const _0x1a2c3f6 = _0x22e0bf6();
    if (!_0x1a2c3f6 || !_0x1a2c2f6.contains(_0x1a2c3f6)) return;
    _0x1a2c1f6.preventDefault();
    _0x1a2c1f6.stopPropagation();
    _0x1a2c1f6.stopImmediatePropagation?.();
    _0x22e49f6();
  }, true);





  // ===================== Native button interception =====================
  function _0x22e4af6() {
    const _0x1a396f6 = [
      _0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJtaWMiIGld'),_0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJ2b3oiIGld'),_0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJ2b2ljZSIgaV0='),
      _0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJkaWN0YSIgaV0='),_0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJzcGVlY2giIGld'),
      _0xd6('YnV0dG9uW3RpdGxlKj0ibWljIiBpXQ=='),_0xd6('YnV0dG9uW3RpdGxlKj0idm96IiBpXQ=='),
    ];
    for (const _0x1a397f6 of _0x1a396f6) {
      for (const _0x1a393f6 of document.querySelectorAll(_0x1a397f6)) {
        if (_0x1a393f6.closest && _0x1a393f6.closest(`#${_0x22de8f6}`)) continue;
        if (_0x1a393f6.offsetParent !== null) return _0x1a393f6;
      }
    }
    return null;
  }
  function _0x22e4bf6() {
    // NOTE: we intentionally do NOT match the "+" / "Add" / "Plus" button anymore.
    // In the current Lovable UI, "+" opens a menu (Settings, History, …, Attach).
    // We let that menu open natively and intercept the "Attach" menu item instead
    // (see installNativeAttachMenuInterceptor). Only buttons whose label is
    // unambiguously about attaching files are bound here, for older UI variants.
    const _0x1a3fef6 = [
      _0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJhdHRhY2giIGld'),_0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJhbmV4YXIiIGld'),
      _0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJ1cGxvYWQiIGld'),_0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJmaWxlIiBpXQ=='),
      _0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJpbWFnZSIgaV0='),_0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJpbWFnZW0iIGld'),
      _0xd6('YnV0dG9uW3RpdGxlKj0iYXR0YWNoIiBpXQ=='),_0xd6('YnV0dG9uW3RpdGxlKj0iYW5leGFyIiBpXQ=='),
      _0xd6('YnV0dG9uW3RpdGxlKj0idXBsb2FkIiBpXQ=='),_0xd6('YnV0dG9uW3RpdGxlKj0iaW1hZ2UiIGld'),
      _0xd6('bGFiZWxbZm9yXSBpbnB1dFt0eXBlPSJmaWxlIl0='),
    ];
    for (const _0x1a3fff6 of _0x1a3fef6) {
      for (const _0x1a3cff6 of document.querySelectorAll(_0x1a3fff6)) {
        const _0x1a3fbf6 = _0x1a3cff6.tagName === _0xd6('SU5QVVQ=') ? _0x1a3cff6.closest(_0xd6('bGFiZWw=')) || _0x1a3cff6 : _0x1a3cff6;
        if (!_0x1a3fbf6) continue;
        if (_0x1a3fbf6.closest && _0x1a3fbf6.closest(`#${_0x22de8f6}`)) continue;
        if (_0x1a3fbf6.offsetParent !== null) return _0x1a3fbf6;
      }
    }
    return null;
  }

  function _0x22e4cf6() {
    const _0x1a4a8f6 = [
      _0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJzZW5kIiBpXQ=='),_0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJlbnZpYXIiIGld'),_0xd6('YnV0dG9uW2FyaWEtbGFiZWwqPSJzdWJtaXQiIGld'),
      _0xd6('YnV0dG9uW3RpdGxlKj0ic2VuZCIgaV0='),_0xd6('YnV0dG9uW3RpdGxlKj0iZW52aWFyIiBpXQ=='),_0xd6('YnV0dG9uW3RpdGxlKj0ic3VibWl0IiBpXQ=='),
      _0xd6('YnV0dG9uW3R5cGU9InN1Ym1pdCJd'),
      _0xd6('Zm9ybSBidXR0b25bdHlwZT0ic3VibWl0Il0='),
    ];
    for (const _0x1a4a9f6 of _0x1a4a8f6) {
      for (const _0x1a431f6 of document.querySelectorAll(_0x1a4a9f6)) {
        if (_0x1a431f6.closest && _0x1a431f6.closest(`#${_0x22de8f6}`)) continue;
        if (_0x1a431f6.offsetParent === null) continue;
        return _0x1a431f6;
      }
    }
    // Heuristic: find icon-only button inside composer wrap with arrow/send svg.
    try {
      const _0x1a43bf6 = _0x22e0cf6();
      if (_0x1a43bf6) {
        const _0x1a456f6 = _0x1a43bf6.querySelectorAll(_0xd6('YnV0dG9u'));
        for (const _0x1a457f6 of _0x1a456f6) {
          if (_0x1a457f6.closest && _0x1a457f6.closest(`#${_0x22de8f6}`)) continue;
          if (_0x1a457f6.offsetParent === null) continue;
          const _0x1a487f6 = (_0x1a457f6.innerText || _0x1a457f6.textContent || "").trim();
          if (/^(➜|↑|→|send|enviar)$/i.test(_0x1a487f6)) return _0x1a457f6;
          if (!_0x1a487f6) {
            const _0x1a492f6 = _0x1a457f6.querySelector('svg');
            if (_0x1a492f6) {
              const _0x1a4a3f6 = _0x1a492f6.outerHTML || "";
              if (/arrow-up|send|paper-plane|M12 19V5|M5 12l7-7|m5 12 7-7/i.test(_0x1a4a3f6)) return _0x1a457f6;
            }
          }
        }
      }
    } catch (_0x1a4a5f6) {}
    return null;
  }


  function _0x22e4df6() {
    return false;
  }

  // Direct-bound interceptors (capture-phase) on the actual native buttons,
  // re-applied whenever DOM changes. This wins over Lovable's own handlers,
  // which sometimes open the file picker on pointerdown/mousedown.
  const _0x22e4ef6 = _0xd6('X190c05hdGl2ZUJvdW5k');
  function _0x22e4ff6() {
    if (!_0x22e4df6()) return;
    const _0x1a86cf6 = _0x22e4bf6();
    if (_0x1a86cf6 && !_0x1a86cf6[_0x22e4ef6]) {
      _0x1a86cf6[_0x22e4ef6] = true;
      const _0x1a7c7f6 = (_0x1a793f6) => {
        if (!_0x22e4df6()) return;
        _0x1a793f6.preventDefault();
        _0x1a793f6.stopPropagation();
        if (_0x1a793f6.stopImmediatePropagation) _0x1a793f6.stopImmediatePropagation();
        if (_0x1a793f6.type === _0xd6('Y2xpY2s=')) _0x22e52f6();
      };
      [_0xd6('cG9pbnRlcmRvd24='),_0xd6('bW91c2Vkb3du'),_0xd6('Y2xpY2s='),_0xd6('a2V5ZG93bg==')].forEach((_0x1a7bef6) => {
        _0x1a86cf6.addEventListener(_0x1a7bef6, (_0x1a7bdf6) => {
          if (_0x1a7bef6 === _0xd6('a2V5ZG93bg==') && _0x1a7bdf6.key !== _0xd6('RW50ZXI=') && _0x1a7bdf6.key !== " ") return;
          _0x1a7c7f6(_0x1a7bdf6);
        }, true);
      });
      // Also block any nested <input type=file> from being clicked by Lovable.
      _0x1a86cf6.querySelectorAll(_0xd6('aW5wdXRbdHlwZT0iZmlsZSJd')).forEach((_0x1a7faf6) => {
        if (_0x1a7faf6[_0x22e4ef6]) return;
        _0x1a7faf6[_0x22e4ef6] = true;
        _0x1a7faf6.addEventListener(_0xd6('Y2xpY2s='), (_0x1a7f9f6) => {
          if (!_0x22e4df6()) return;
          _0x1a7f9f6.preventDefault();
          _0x1a7f9f6.stopPropagation();
          if (_0x1a7f9f6.stopImmediatePropagation) _0x1a7f9f6.stopImmediatePropagation();
          _0x22e52f6();
        }, true);
      });
    }
    const _0x1a86df6 = _0x22e4af6();
    if (_0x1a86df6 && !_0x1a86df6[_0x22e4ef6]) {
      _0x1a86df6[_0x22e4ef6] = true;
      [_0xd6('cG9pbnRlcmRvd24='),_0xd6('bW91c2Vkb3du'),_0xd6('Y2xpY2s=')].forEach((_0x1a84af6) => {
        _0x1a86df6.addEventListener(_0x1a84af6, (_0x1a849f6) => {
          if (!_0x22e4df6()) return;
          _0x1a849f6.preventDefault();
          _0x1a849f6.stopPropagation();
          if (_0x1a849f6.stopImmediatePropagation) _0x1a849f6.stopImmediatePropagation();
          if (_0x1a84af6 === _0xd6('Y2xpY2s=')) _0x22e73f6();
        }, true);
      });
    }
    const _0x1a86ef6 = _0x22e4cf6();
    if (_0x1a86ef6 && !_0x1a86ef6[_0x22e4ef6]) {
      _0x1a86ef6[_0x22e4ef6] = true;
      [_0xd6('cG9pbnRlcmRvd24='),_0xd6('bW91c2Vkb3du'),_0xd6('Y2xpY2s='),_0xd6('a2V5ZG93bg==')].forEach((_0x1a8aff6) => {
        _0x1a86ef6.addEventListener(_0x1a8aff6, (_0x1a8aef6) => {
          if (!_0x22e4df6()) return;
          if (_0x1a8aff6 === _0xd6('a2V5ZG93bg==') && _0x1a8aef6.key !== _0xd6('RW50ZXI=') && _0x1a8aef6.key !== " ") return;
          _0x1a8aef6.preventDefault();
          _0x1a8aef6.stopPropagation();
          if (_0x1a8aef6.stopImmediatePropagation) _0x1a8aef6.stopImmediatePropagation();
          if (_0x1a8aff6 === _0xd6('Y2xpY2s=') || _0x1a8aff6 === _0xd6('a2V5ZG93bg==')) _0x22e49f6();
        }, true);
      });
    }
  }


  let _0x22e50f6 = false;
  function _0x22e51f6() {
    if (!_0x22e50f6) {
      _0x22e50f6 = true;
      // Global capture-phase fallback for cases where direct binding misses
      // a re-rendered button (covers click/pointerdown/mousedown).
      [_0xd6('cG9pbnRlcmRvd24='),_0xd6('bW91c2Vkb3du'),_0xd6('Y2xpY2s=')].forEach((_0x1ae3ff6) => {
        document.addEventListener(_0x1ae3ff6, (_0x1ae39f6) => {
          if (!_0x22e4df6()) return;
          const _0x1ae3af6 = _0x1ae39f6.target;
          if (!_0x1ae3af6 || !_0x1ae3af6.closest) return;
          if (_0x1ae3af6.closest(`#${_0x22de8f6}`) || _0x1ae3af6.closest(`#${_0x22decf6}`) ||
              _0x1ae3af6.closest(`#${_0x22dedf6}`) || _0x1ae3af6.closest(`#${_0x22debf6}`)) return;
          const _0x1ae3bf6 = _0x1ae3af6.closest(_0xd6('YnV0dG9uLCBsYWJlbA=='));
          if (!_0x1ae3bf6) return;
          const _0x1ae3cf6 = _0x22e4af6();
          const _0x1ae3df6 = _0x22e4bf6();
          const _0x1ae3ef6 = _0x22e4cf6();
          if (_0x1ae3cf6 && (_0x1ae3bf6 === _0x1ae3cf6 || _0x1ae3cf6.contains(_0x1ae3bf6))) {
            _0x1ae39f6.preventDefault(); _0x1ae39f6.stopPropagation();
            if (_0x1ae39f6.stopImmediatePropagation) _0x1ae39f6.stopImmediatePropagation();
            if (_0x1ae3ff6 === _0xd6('Y2xpY2s=')) _0x22e73f6();
            return;
          }
          if (_0x1ae3df6 && (_0x1ae3bf6 === _0x1ae3df6 || _0x1ae3df6.contains(_0x1ae3bf6))) {
            _0x1ae39f6.preventDefault(); _0x1ae39f6.stopPropagation();
            if (_0x1ae39f6.stopImmediatePropagation) _0x1ae39f6.stopImmediatePropagation();
            if (_0x1ae3ff6 === _0xd6('Y2xpY2s=')) _0x22e52f6();
            return;
          }
          if (_0x1ae3ef6 && (_0x1ae3bf6 === _0x1ae3ef6 || _0x1ae3ef6.contains(_0x1ae3bf6) || _0x1ae3bf6.contains(_0x1ae3ef6))) {
            _0x1ae39f6.preventDefault(); _0x1ae39f6.stopPropagation();
            if (_0x1ae39f6.stopImmediatePropagation) _0x1ae39f6.stopImmediatePropagation();
            if (_0x1ae3ff6 === _0xd6('Y2xpY2s=')) _0x22e49f6();
            return;
          }

        }, true);
      });
    }
    _0x22e4ff6();
    _0x22e66f6();
    _0x22e56f6();
  }

  function _0x22e52f6() { _0x22e67f6(); }

  // ===== Native "Attach" menu item interception (popup mode) =====
  // Lovable's "+" composer button opens a menu (Settings, History, Knowledge,
  // GitHub, Connectors, Take a screenshot, Add reference, Add skill, Attach…).
  // We let the menu open natively but hijack the "Attach" entry so the file
  // picker / upload flow runs through the extension instead of Lovable's.
  function _0x22e53f6() {
    try {
      document.dispatchEvent(new KeyboardEvent(_0xd6('a2V5ZG93bg=='), { key: _0xd6('RXNjYXBl'), bubbles: true }));
      document.dispatchEvent(new KeyboardEvent(_0xd6('a2V5dXA='),   { key: _0xd6('RXNjYXBl'), bubbles: true }));
    } catch (_0x1ae41f6) {}
  }

  function _0x22e54f6(_0x1b052f6) {
    if (!_0x1b052f6 || !_0x1b052f6.closest) return false;
    if (_0x1b052f6.closest(`#${_0x22de8f6}`) || _0x1b052f6.closest(`#${_0x22decf6}`) ||
        _0x1b052f6.closest(`#${_0x22dedf6}`) || _0x1b052f6.closest(`#${_0x22debf6}`)) return false;
    const _0x1b053f6 = _0x1b052f6.closest(_0xd6('W3JvbGU9Im1lbnVpdGVtIl0sIFtyb2xlPSJvcHRpb24iXSwgW2NtZGstaXRlbV0sIFtkYXRhLXJhZGl4LWNvbGxlY3Rpb24taXRlbV0sIGxpLCBidXR0b24sIGRpdg=='));
    if (!_0x1b053f6) return false;
    // Must look like a menu entry — i.e. live inside a popover/menu/listbox/cmdk container.
    const _0x1b054f6 = _0x1b053f6.closest(
      _0xd6('W3JvbGU9Im1lbnUiXSwgW3JvbGU9Imxpc3Rib3giXSwgW3JvbGU9ImRpYWxvZyJdLCBbZGF0YS1yYWRpeC1wb3BwZXItY29udGVudC13cmFwcGVyXSwgW2NtZGstcm9vdF0sIFtjbWRrLWxpc3RdLCBbZGF0YS1zdGF0ZT0ib3BlbiJd')
    );
    if (!_0x1b054f6) return false;
    const _0x1b055f6 = (_0x1b053f6.innerText || _0x1b053f6.textContent || "").trim().toLowerCase();
    if (!_0x1b055f6) return false;
    // Exact "attach" / "anexar" or short label starting with it. Avoid matching
    // long sentences like "attach a file to your message" inside tooltips.
    if (_0x1b055f6 === _0xd6('YXR0YWNo') || _0x1b055f6 === _0xd6('YW5leGFy')) return true;
    if (_0x1b055f6.length <= 32 && (/^attach\b/.test(_0x1b055f6) || /^anexar\b/.test(_0x1b055f6))) return true;
    return false;
  }

  let _0x22e55f6 = false;
  function _0x22e56f6() {
    if (_0x22e55f6) return;
    _0x22e55f6 = true;
    const _0x1b32ff6 = (_0x1b324f6) => {
      if (!_0x22e4df6()) return;
      if (_0x1b324f6.type === _0xd6('a2V5ZG93bg==') && _0x1b324f6.key !== _0xd6('RW50ZXI=') && _0x1b324f6.key !== " ") return;
      if (!_0x22e54f6(_0x1b324f6.target)) return;
      _0x1b324f6.preventDefault();
      _0x1b324f6.stopPropagation();
      if (_0x1b324f6.stopImmediatePropagation) _0x1b324f6.stopImmediatePropagation();
      if (_0x1b324f6.type === _0xd6('Y2xpY2s=') || _0x1b324f6.type === _0xd6('a2V5ZG93bg==')) {
        _0x22de7f6(_0xd6('W1RTIFBvcHVwXSBOYXRpdmUgQXR0YWNoIGludGVyY2VwdGVk'));
        _0x22e53f6();
        // Defer so the menu has a tick to unmount before the picker opens.
        setTimeout(() => { try { _0x22e67f6(); } catch (_0x1b326f6) {} }, 0);
      }
    };
    [_0xd6('cG9pbnRlcmRvd24='),_0xd6('bW91c2Vkb3du'),_0xd6('Y2xpY2s='),_0xd6('a2V5ZG93bg==')].forEach((_0x1b33af6) => {
      document.addEventListener(_0x1b33af6, _0x1b32ff6, true);
    });
  }


  // ===== Native drag-and-drop interception (popup mode) =====
  const _0x22e57f6 = [_0xd6('aW1hZ2UvcG5n'), _0xd6('aW1hZ2UvanBlZw=='), _0xd6('aW1hZ2UvanBn'), _0xd6('aW1hZ2Uvd2VicA==')];
  let _0x22e58f6 = null;
  let _0x22e59f6 = false;
  let _0x22e5af6 = false;

  function _0x22e5bf6() {
    if (_0x22e5af6) return;
    _0x22e5af6 = true;
    const _0x1bfe5f6 = document.createElement(_0xd6('c3R5bGU='));
    _0x1bfe5f6.id = _0xd6('dHMtZHJhZy1oaWRlLXN0eWxl');
    _0x1bfe5f6.textContent = `
      html.ts-dragging-files [class*="dropzone" i],
      html.ts-dragging-files [class*="DropZone" i],
      html.ts-dragging-files [data-dropzone],
      html.ts-dragging-files [class*="drop-overlay" i],
      html.ts-dragging-files [class*="DropOverlay" i],
      html.ts-dragging-files [class*="file-drop" i] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(_0x1bfe5f6);
  }

  function _0x22e5cf6() {
    try {
      document.documentElement.classList.add(_0xd6('dHMtZHJhZ2dpbmctZmlsZXM='));
      // Hide any element whose visible text matches Lovable's drop overlay copy.
      const _0x1c037f6 = document.querySelectorAll(_0xd6('Ym9keSAq'));
      const _0x1c038f6 = /(drop any files here|add files|add them to message)/i;
      for (const _0x1c039f6 of _0x1c037f6) {
        if (_0x1c039f6.id === _0xd6('dHMtZHJvcC1vdmVybGF5')) continue;
        if (_0x1c039f6.closest("#" + _0x22de8f6)) continue;
        const _0x1c067f6 = (_0x1c039f6.textContent || "").trim();
        if (_0x1c067f6.length > 0 && _0x1c067f6.length < 200 && _0x1c038f6.test(_0x1c067f6)) {
          _0x1c039f6.classList.add(_0xd6('dHMtaGlkZS1sb3ZhYmxlLWRyb3Atb3ZlcmxheQ=='));
          _0x1c039f6.style.setProperty(_0xd6('ZGlzcGxheQ=='), _0xd6('bm9uZQ=='), _0xd6('aW1wb3J0YW50'));
        }
      }
    } catch (_0x1c069f6) {}
  }
  function _0x22e5df6() {
    try {
      document.documentElement.classList.remove(_0xd6('dHMtZHJhZ2dpbmctZmlsZXM='));
      document.querySelectorAll(_0xd6('LnRzLWhpZGUtbG92YWJsZS1kcm9wLW92ZXJsYXk=')).forEach((_0x1c07cf6) => {
        _0x1c07cf6.classList.remove(_0xd6('dHMtaGlkZS1sb3ZhYmxlLWRyb3Atb3ZlcmxheQ=='));
        _0x1c07cf6.style.removeProperty(_0xd6('ZGlzcGxheQ=='));
      });
    } catch (_0x1c07ef6) {}
  }

  function _0x22e5ef6() {
    if (_0x22e58f6 && document.body.contains(_0x22e58f6)) return _0x22e58f6;
    const _0x1c0cdf6 = document.createElement("div");
    _0x1c0cdf6.id = _0xd6('dHMtZHJvcC1vdmVybGF5');
    _0x1c0cdf6.style.cssText = [
      _0xd6('cG9zaXRpb246Zml4ZWQ='),
      _0xd6('ei1pbmRleDoyMTQ3NDgzNjQ2'),
      _0xd6('cG9pbnRlci1ldmVudHM6bm9uZQ=='),
      _0xd6('ZGlzcGxheTpub25l'),
      _0xd6('YWxpZ24taXRlbXM6Y2VudGVy'),
      _0xd6('anVzdGlmeS1jb250ZW50OmNlbnRlcg=='),
      _0xd6('Ym9yZGVyOjJweCBkYXNoZWQgcmdiYSg1OSwxMzAsMjQ2LDAuOSk='),
      _0xd6('YmFja2dyb3VuZDpyZ2JhKDU5LDEzMCwyNDYsMC4xMCk='),
      _0xd6('YmFja2Ryb3AtZmlsdGVyOmJsdXIoMnB4KQ=='),
      _0xd6('Y29sb3I6I2ZmZg=='),
      _0xd6('Zm9udDo2MDAgMTRweC8xLjIgLWFwcGxlLXN5c3RlbSxCbGlua01hY1N5c3RlbUZvbnQsJ1NlZ29lIFVJJyxSb2JvdG8sc2Fucy1zZXJpZg=='),
      _0xd6('Ym9yZGVyLXJhZGl1czoxNHB4'),
      _0xd6('Ym94LXNoYWRvdzowIDhweCAzMnB4IHJnYmEoNTksMTMwLDI0NiwwLjM1KQ=='),
    ].join(";");
    _0x1c0cdf6.innerHTML = `<div style="background:rgba(20,20,28,0.85);padding:10px 16px;border-radius:10px;border:1px solid rgba(59,130,246,0.6);display:flex;align-items:center;gap:6px"><span style="display:inline-flex">${_0x22df8f6.download}</span> Solte para anexar imagem</div>`;
    document.body.appendChild(_0x1c0cdf6);
    _0x22e58f6 = _0x1c0cdf6;
    return _0x1c0cdf6;
  }
  function _0x22e5ff6() {
    const _0x1c1aaf6 = _0x22e5ef6();
    const _0x1c1abf6 = _0x22e0cf6() || _0x22e0bf6();
    if (_0x1c1abf6) {
      const _0x1c194f6 = _0x1c1abf6.getBoundingClientRect();
      const _0x1c195f6 = 8;
      _0x1c1aaf6.style.left = Math.max(8, _0x1c194f6.left - _0x1c195f6) + "px";
      _0x1c1aaf6.style.top = Math.max(8, _0x1c194f6.top - _0x1c195f6) + "px";
      _0x1c1aaf6.style.width = (_0x1c194f6.width + _0x1c195f6 * 2) + "px";
      _0x1c1aaf6.style.height = (_0x1c194f6.height + _0x1c195f6 * 2) + "px";
    } else {
      _0x1c1aaf6.style.left = _0xd6('MTZweA==');
      _0x1c1aaf6.style.top = _0xd6('MTZweA==');
      _0x1c1aaf6.style.width = (window.innerWidth - 32) + "px";
      _0x1c1aaf6.style.height = (window.innerHeight - 32) + "px";
    }
    _0x1c1aaf6.style.display = _0xd6('ZmxleA==');
    _0x22e5cf6();
  }
  function _0x22e60f6() {
    if (_0x22e58f6) _0x22e58f6.style.display = _0xd6('bm9uZQ==');
    _0x22e5df6();
  }

  let _0x22e61f6 = null;
  function _0x22e62f6() {
    if (_0x22e61f6) clearTimeout(_0x22e61f6);
    _0x22e61f6 = setTimeout(() => { _0x22e60f6(); }, 80);
  }
  function _0x22e63f6() {
    if (_0x22e61f6) { clearTimeout(_0x22e61f6); _0x22e61f6 = null; }
  }

  function _0x22e64f6(_0x1c430f6) {
    try {
      const _0x1c477f6 = _0x1c430f6.dataTransfer;
      if (!_0x1c477f6) return false;
      const _0x1c478f6 = Array.from(_0x1c477f6.types || []);
      return _0x1c478f6.includes(_0xd6('RmlsZXM=')) || _0x1c478f6.includes(_0xd6('YXBwbGljYXRpb24veC1tb3otZmlsZQ=='));
    } catch (_0x1c47af6) { return false; }
  }

  function _0x22e65f6(_0x1c4b6f6) {
    if (!_0x22e4df6()) return;
    if (!_0x22e64f6(_0x1c4b6f6)) return;

    _0x1c4b6f6.preventDefault();
    _0x1c4b6f6.stopPropagation();
    if (_0x1c4b6f6.stopImmediatePropagation) _0x1c4b6f6.stopImmediatePropagation();

    if (_0x1c4b6f6.type === _0xd6('ZHJhZ2VudGVy') || _0x1c4b6f6.type === _0xd6('ZHJhZ292ZXI=')) {
      try { if (_0x1c4b6f6.dataTransfer) _0x1c4b6f6.dataTransfer.dropEffect = _0xd6('Y29weQ=='); } catch (_0x1c4aaf6) {}
      _0x22e63f6();
      _0x22e5ff6();
      return false;
    }
    if (_0x1c4b6f6.type === _0xd6('ZHJhZ2xlYXZl')) {
      _0x22e62f6();
      return false;
    }
    if (_0x1c4b6f6.type === _0xd6('ZHJvcA==')) {
      _0x22e60f6();
      const _0x1c529f6 = Array.from((_0x1c4b6f6.dataTransfer && _0x1c4b6f6.dataTransfer.files) || []);
      const _0x1c52af6 = _0x1c529f6.filter((_0x1c510f6) => _0x1c510f6 && typeof _0x1c510f6.type === _0xd6('c3RyaW5n') &&
        (_0x22e57f6.includes(_0x1c510f6.type.toLowerCase()) || _0x1c510f6.type.toLowerCase().startsWith(_0xd6('aW1hZ2Uv'))));
      if (!_0x1c52af6.length) {
        if (_0x1c529f6.length) _0x22e41f6(_0xd6('RW52aWUgYXBlbmFzIGltYWdlbnMgKHBuZy9qcGVnL3dlYnApLg=='), _0xd6('ZXJyb3I='));
        return false;
      }
      try { _0x22e48f6(_0x1c52af6); } catch (_0x1c51ef6) {}
      _0x22e41f6(_0xd6('SW1hZ2VtIGFuZXhhZGE='));
      return false;
    }
  }

  function _0x22e66f6() {
    if (_0x22e59f6) return;
    _0x22e59f6 = true;
    _0x22e5bf6();
    const _0x1c593f6 = [_0xd6('ZHJhZ2VudGVy'), _0xd6('ZHJhZ292ZXI='), _0xd6('ZHJhZ2xlYXZl'), _0xd6('ZHJvcA==')];
    const _0x1c594f6 = [window, document, document.body].filter(Boolean);
    _0x1c593f6.forEach((_0x1c580f6) => {
      _0x1c594f6.forEach((_0x1c584f6) => {
        try { _0x1c584f6.addEventListener(_0x1c580f6, _0x22e65f6, true); } catch (_0x1c586f6) {}
      });
    });
    // End-of-drag cleanup safety net.
    window.addEventListener(_0xd6('ZHJhZ2VuZA=='), () => { _0x22e60f6(); }, true);
  }


  function _0x22e67f6() {
    let _0x1c5c3f6 = document.getElementById(_0xd6('dHMtcG9wdXAtZmlsZS1pbnB1dC1nbG9iYWw='));
    if (!_0x1c5c3f6) {
      _0x1c5c3f6 = document.createElement(_0xd6('aW5wdXQ='));
      _0x1c5c3f6.type = _0xd6('ZmlsZQ==');
      _0x1c5c3f6.id = _0xd6('dHMtcG9wdXAtZmlsZS1pbnB1dC1nbG9iYWw=');
      _0x1c5c3f6.multiple = true;
      _0x1c5c3f6.accept = _0xd6('aW1hZ2UvKg==');
      _0x1c5c3f6.style.display = _0xd6('bm9uZQ==');
      document.body.appendChild(_0x1c5c3f6);
      _0x1c5c3f6.addEventListener(_0xd6('Y2hhbmdl'), () => {
        const _0x1c5bef6 = Array.from(_0x1c5c3f6.files || []);
        _0x1c5c3f6.value = "";
        if (_0x1c5bef6.length) _0x22e48f6(_0x1c5bef6);
      });
    }
    _0x1c5c3f6.click();
  }

  // ===================== Init =====================
  function _0x22e68f6() {
    if (!document.body) {
      document.addEventListener(_0xd6('RE9NQ29udGVudExvYWRlZA=='), _0x22e68f6, { once: true });
      return;
    }
    _0x22df4f6();
    _0x22df5f6();
    try {
      chrome.storage.local.get({ sidebarCollapsed: false, tsExtensionLayoutMode: _0xd6('c2lkZWJhcg=='), ts_intercept_locked: false }, (_0x1c5e4f6) => {
        _0x22e02f6((_0x1c5e4f6 && _0x1c5e4f6.tsExtensionLayoutMode) || _0xd6('c2lkZWJhcg=='));
        _0x22e01f6(Boolean(_0x1c5e4f6 && _0x1c5e4f6.sidebarCollapsed));
        _0x22df7f6 = Boolean(_0x1c5e4f6 && _0x1c5e4f6.ts_intercept_locked);
      });
    } catch (_0x1c5e6f6) {
      _0x22e02f6(_0xd6('c2lkZWJhcg=='));
      _0x22e01f6(false);
    }
  }

  // Replace Lovable's "LOV 3" / "LOV3" / "Lov3.0" header label on chat
  // message cards generated by the extension (Synthetic Fix Error intent)
  // with the oferrolgarcia sender identity. We only touch leaf text nodes so
  // we never break Lovable's interactive controls.
  function _0x22e69f6() {
    return _0xd6('RW52aWFkbyBwb3Igb2ZlcnJvbGdhcmNpYQ==');
  }
  const _0x22e6af6 = /^\s*(?:lov\s*\d+(?:\.\d+)?|fix(?:\s+build)?\s*error|sec(?:u|ur)?rty\s*scan|security\s*scan|security\s*review|verifica(?:\u00e7|c)(?:\u00e3|a)o\s*de\s*seguran(?:\u00e7|c)a|revis(?:\u00e3|a)o\s*de\s*seguran(?:\u00e7|c)a|an(?:\u00e1|a)lise\s*de\s*seguran(?:\u00e7|c)a|try\s*to\s*fix\s*seo[^\n]*|fix\s*seo\s*issue[^\n]*|seo\s*issue\s*:[^\n]*|meta\s*[-\s]?description|meta\s*descri(?:\u00e7|c)(?:\u00e3|a)o|corrigir\s*(?:problema\s*de\s*)?seo[^\n]*|edi(?:\u00e7|c)(?:\u00e3|a)o\s*visual|visual\s*edit|enviado\s*por\s*[\u26A1\u2728\u{1F4AC}\u{1F680}\s]*.+)\s*$/iu;
  function _0x22e6bf6(_0x1c86bf6) {
    try {
      const _0x1c9f3f6 = _0x22e69f6();
      const _0x1c9f4f6 = (_0x1c86bf6 && _0x1c86bf6.querySelectorAll) ? _0x1c86bf6 : document.body;
      if (!_0x1c9f4f6) return;
      const _0x1c9f5f6 = document.createTreeWalker(_0x1c9f4f6, NodeFilter.SHOW_TEXT, {
        acceptNode(_0x1c962f6) {
          if (!_0x1c962f6.nodeValue || !_0x22e6af6.test(_0x1c962f6.nodeValue)) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const _0x1c9f6f6 = [];
      let _0x1c9f7f6;
      while ((_0x1c9f7f6 = _0x1c9f5f6.nextNode())) _0x1c9f6f6.push(_0x1c9f7f6);
      for (const _0x1c9f8f6 of _0x1c9f6f6) {
        if (_0x1c9f8f6.nodeValue !== _0x1c9f3f6) _0x1c9f8f6.nodeValue = _0x1c9f3f6;
      }
    } catch (_0x1c9faf6) {}
  }

  const _0x22e6cf6 = new MutationObserver(() => {
    if (!document.getElementById(_0x22deaf6)) _0x22df4f6();
    if (!document.getElementById(_0x22de8f6)) {
      _0x22df5f6();
      try {
        chrome.storage.local.get({ sidebarCollapsed: false, tsExtensionLayoutMode: _0xd6('c2lkZWJhcg==') }, (_0x1cd31f6) => {
          _0x22e02f6((_0x1cd31f6 && _0x1cd31f6.tsExtensionLayoutMode) || _0xd6('c2lkZWJhcg=='));
          _0x22e01f6(Boolean(_0x1cd31f6 && _0x1cd31f6.sidebarCollapsed));
        });
      } catch (_0x1cd33f6) {}
    }
    if (_0x22df6f6 === _0xd6('cG9wdXA=')) {
      if (!document.getElementById(_0x22debf6)) _0x22e09f6();
      _0x22e0df6();
      _0x22e4ff6();
      _0x22e66f6();
    }
    _0x22e6bf6(document.body);
  });
  try { _0x22e6cf6.observe(document.documentElement, { childList: true, subtree: true }); } catch (_0x1cdd5f6) {}
  try { _0x22e6bf6(document.body); } catch (_0x1ce77f6) {}

  try {
    chrome.storage.onChanged.addListener((_0x1cf80f6, _0x1cf81f6) => {
      if (_0x1cf81f6 !== _0xd6('bG9jYWw=')) return;
      if (_0x1cf80f6.tsExtensionLayoutMode) _0x22e02f6(_0x1cf80f6.tsExtensionLayoutMode.newValue || _0xd6('c2lkZWJhcg=='));
      if (_0x1cf80f6.sidebarCollapsed) _0x22e01f6(Boolean(_0x1cf80f6.sidebarCollapsed.newValue));
      if (_0x1cf80f6.ts_intercept_locked !== undefined) _0x22df7f6 = Boolean(_0x1cf80f6.ts_intercept_locked.newValue);
    });
  } catch (_0x1cf83f6) {}

  // ===================== Notifications polling =====================
  try {
    setTimeout(() => { _0x22e3cf6(); }, 1500);
    setInterval(() => { _0x22e3cf6(); }, 30000);
  } catch (_0x1d025f6) {}


  // ===================== Voice (popup native sink) =====================
  let _0x22e6df6 = null;
  let _0x22e6ef6 = false;
  let _0x22e6ff6 = _0xd6('aWZyYW1l');
  let _0x22e70f6 = "";
  let _0x22e71f6 = "";

  function _0x22e72f6(_0x1de47f6) {
    if (_0x22e6ff6 === _0xd6('bmF0aXZl')) {
      const _0x1de24f6 = _0x22e0bf6();
      if (_0x1de47f6.type === _0xd6('VFNfVk9JQ0VfVFJBTlNDUklQVA==') && _0x1de24f6) {
        _0x22e71f6 = _0x1de47f6.transcript || "";
        const _0x1ddd2f6 = _0x22e70f6;
        const _0x1ddd3f6 = _0x1de24f6.tagName === _0xd6('VEVYVEFSRUE=')
          ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, _0xd6('dmFsdWU='))
          : null;
        const _0x1ddd4f6 = _0x1ddd2f6 + (_0x1ddd2f6 && _0x22e71f6 ? " " : "") + _0x22e71f6;
        if (_0x1ddd3f6 && _0x1ddd3f6.set) _0x1ddd3f6.set.call(_0x1de24f6, _0x1ddd4f6);
        else if (_0x1de24f6.tagName === _0xd6('VEVYVEFSRUE=')) _0x1de24f6.value = _0x1ddd4f6;
        else _0x1de24f6.innerText = _0x1ddd4f6;
        _0x1de24f6.dispatchEvent(new Event(_0xd6('aW5wdXQ='), { bubbles: true }));
      } else if (_0x1de47f6.type === _0xd6('VFNfVk9JQ0VfU1RBVFVT')) {
        const _0x1ddfbf6 = document.getElementById(_0x22debf6);
        if (_0x1ddfbf6) _0x1ddfbf6.classList.toggle(_0xd6('dHMtbGF1bmNoZXItcmVjb3JkaW5n'), Boolean(_0x1de47f6.listening));
        _0x22e41f6(_0x1de47f6.listening ? _0xd6('T3V2aW5kb+KApiAoY2xpcXVlIG5vdmFtZW50ZSBwYXJhIHBhcmFyKQ==') : _0xd6('RGl0YWRvIGZpbmFsaXphZG8='));
      } else if (_0x1de47f6.type === _0xd6('VFNfVk9JQ0VfRVJST1I=')) {
        _0x22e41f6("" + (_0x1de47f6.message || _0x1de47f6.error || _0xd6('RXJybyBubyBtaWNyb2ZvbmU=')), _0xd6('ZXJyb3I='));
        const _0x1de23f6 = document.getElementById(_0x22debf6);
        if (_0x1de23f6) _0x1de23f6.classList.remove(_0xd6('dHMtbGF1bmNoZXItcmVjb3JkaW5n'));
      }
      return;
    }
    const _0x1de48f6 = document.getElementById(_0x22de9f6);
    if (!_0x1de48f6 || !_0x1de48f6.contentWindow) return;
    try { _0x1de48f6.contentWindow.postMessage(_0x1de47f6, "*"); } catch (_0x1de4af6) {}
  }

  function _0x22e73f6() {
    if (_0x22e6ef6) { _0x22e74f6(); return; }
    const _0x1de68f6 = _0x22e0bf6();
    if (!_0x1de68f6) { _0x22e41f6(_0xd6('Q29tcG9zZXIgbmF0aXZvIG7Do28gZW5jb250cmFkby4='), _0xd6('ZXJyb3I=')); return; }
    _0x22e70f6 = _0x22e44f6(_0x1de68f6);
    _0x22e71f6 = "";
    _0x22e6ff6 = _0xd6('bmF0aXZl');
    _0x22e75f6();
  }
  function _0x22e74f6() {
    if (_0x22e6df6) { try { _0x22e6df6.stop(); } catch (_0x1de6af6) {} }
  }
  async function _0x22e75f6() {
    if (_0x22e6ef6) return;
    const _0x1debdf6 = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!_0x1debdf6) {
      _0x22e72f6({ type: _0xd6('VFNfVk9JQ0VfRVJST1I='), error: _0xd6('dW5zdXBwb3J0ZWQ='), message: _0xd6('UmVjb25oZWNpbWVudG8gZGUgdm96IG7Do28gc3Vwb3J0YWRvLg==') });
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      _0x22e72f6({ type: _0xd6('VFNfVk9JQ0VfRVJST1I='), error: _0xd6('bm8tbWVkaWFkZXZpY2Vz'), message: _0xd6('Z2V0VXNlck1lZGlhIGluZGlzcG9uw612ZWwu') });
      return;
    }
    let _0x1debef6;
    try { _0x1debef6 = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (_0x1deb2f6) {
      _0x22e72f6({ type: _0xd6('VFNfVk9JQ0VfRVJST1I='), error: (_0x1deb2f6 && _0x1deb2f6.name) || _0xd6('dW5rbm93bg=='), message: (_0x1deb2f6 && _0x1deb2f6.message) || _0xd6('RmFsaGEgYW8gYWNlc3NhciBtaWNyb2ZvbmUu') });
      return;
    }
    try { _0x1debef6.getTracks().forEach((_0x1debaf6) => _0x1debaf6.stop()); } catch (_0x1debcf6) {}
    try {
      const _0x1dfeff6 = new _0x1debdf6();
      _0x1dfeff6.lang = _0xd6('cHQtQlI=');
      _0x1dfeff6.continuous = true;
      _0x1dfeff6.interimResults = true;
      _0x1dfeff6.maxAlternatives = 1;
      let _0x1dff0f6 = "";
      _0x1dfeff6.onstart = function () { _0x22e6ef6 = true; _0x1dff0f6 = ""; _0x22e72f6({ type: _0xd6('VFNfVk9JQ0VfU1RBVFVT'), listening: true }); };
      _0x1dfeff6.onresult = function (_0x1dfaef6) {
        let _0x1dfaff6 = "";
        for (let _0x1dfb0f6 = _0x1dfaef6.resultIndex; _0x1dfb0f6 < _0x1dfaef6.results.length; _0x1dfb0f6++) {
          const _0x1df7df6 = _0x1dfaef6.results[_0x1dfb0f6];
          if (_0x1df7df6.isFinal) _0x1dff0f6 += (_0x1dff0f6 ? " " : "") + _0x1df7df6[0].transcript;
          else _0x1dfaff6 += _0x1df7df6[0].transcript;
        }
        _0x22e72f6({ type: _0xd6('VFNfVk9JQ0VfVFJBTlNDUklQVA=='), transcript: (_0x1dff0f6 + " " + _0x1dfaff6).trim() });
      };
      _0x1dfeff6.onerror = function (_0x1dfd4f6) { _0x22e72f6({ type: _0xd6('VFNfVk9JQ0VfRVJST1I='), error: _0x1dfd4f6.error || _0xd6('dW5rbm93bg=='), message: String(_0x1dfd4f6.error || "") }); };
      _0x1dfeff6.onend = function () { _0x22e6ef6 = false; _0x22e6df6 = null; _0x22e72f6({ type: _0xd6('VFNfVk9JQ0VfU1RBVFVT'), listening: false }); };
      _0x22e6df6 = _0x1dfeff6;
      _0x1dfeff6.start();
    } catch (_0x1dff2f6) {
      _0x22e6ef6 = false; _0x22e6df6 = null;
      _0x22e72f6({ type: _0xd6('VFNfVk9JQ0VfRVJST1I='), error: (_0x1dff2f6 && _0x1dff2f6.name) || _0xd6('c3RhcnQtZmFpbGVk'), message: (_0x1dff2f6 && _0x1dff2f6.message) || "" });
    }
  }

  // ===================== postMessage handlers =====================
  window.addEventListener(_0xd6('bWVzc2FnZQ=='), (_0x1e43cf6) => {
    const _0x1e43df6 = _0x1e43cf6 && _0x1e43cf6.data;
    if (!_0x1e43df6 || typeof _0x1e43df6 !== _0xd6('b2JqZWN0')) return;
    if (_0x1e43df6.type === _0xd6('VFNfVk9JQ0VfU1RBUlQ=')) { _0x22e6ff6 = _0xd6('aWZyYW1l'); _0x22e75f6(); }
    else if (_0x1e43df6.type === _0xd6('VFNfVk9JQ0VfU1RPUA==')) { _0x22e74f6(); }
    else if (_0x1e43df6.type === _0xd6('VFNfT1ZFUkxBWV9TRVRfQ09MTEFQU0VE')) {
      _0x22e01f6(Boolean(_0x1e43df6.collapsed));
      try { chrome.storage.local.set({ sidebarCollapsed: Boolean(_0x1e43df6.collapsed) }); } catch (_0x1e400f6) {}
    } else if (_0x1e43df6.type === _0xd6('VFNfT1ZFUkxBWV9TRVRfTEFZT1VU')) {
      const _0x1e423f6 = (_0x1e43df6.mode === _0xd6('cG9wdXA=') || _0x1e43df6.mode === _0xd6('ZmxvYXRpbmc=')) ? _0xd6('cG9wdXA=') : _0xd6('c2lkZWJhcg==');
      _0x22e02f6(_0x1e423f6);
      try { chrome.storage.local.set({ tsExtensionLayoutMode: _0x1e423f6 }); } catch (_0x1e425f6) {}
    } else if (_0x1e43df6.type === _0xd6('VFNfT1ZFUkxBWV9URU1QTEFURVM=')) {
      if (Array.isArray(_0x1e43df6.templates)) {
        _0x22dfaf6 = _0x1e43df6.templates.slice(0, 24);
        if (document.getElementById(_0x22dedf6)) _0x22e3bf6();
      }
    } else if (_0x1e43df6.type === _0xd6('VFNfUE9QVVBfUkVTVUxU')) {
      _0x22e41f6(_0x1e43df6.message || (_0x1e43df6.ok ? _0xd6('Q29uY2x1w61kbw==') : _0xd6('RmFsaGE=')), _0x1e43df6.ok ? _0xd6('c3VjY2Vzcw==') : _0xd6('ZXJyb3I='));
    }
  });

  try {
    chrome.runtime.onMessage.addListener((_0x1e4eaf6) => {
      if (!_0x1e4eaf6) return;
      if (_0x1e4eaf6.type === _0xd6('VFNfVE9HR0xFX09WRVJMQVk=')) {
        chrome.storage.local.get({ sidebarCollapsed: false }, (_0x1e527f6) => {
          const _0x1e528f6 = !Boolean(_0x1e527f6 && _0x1e527f6.sidebarCollapsed);
          chrome.storage.local.set({ sidebarCollapsed: _0x1e528f6 });
          _0x22e01f6(_0x1e528f6);
        });
      }
    });
  } catch (_0x1e52af6) {}

  // ===================== Slash Skills Picker (popup mode) =====================
  // Intercept "/" typed in the native Lovable composer (popup mode only),
  // suppress Lovable's native command menu, and render the extension's own
  // prompt picker anchored above the composer.
  const _0x22e76f6 = _0xd6('dHMtc2xhc2gtc2tpbGxz');
  const _0x22e77f6 = _0xd6('dHMtc2xhc2gtc2tpbGxzLXN0eWxl');
  const _0x22e78f6 = _0xd6('dHMtc2xhc2gtc2tpbGxzLWFjdGl2ZQ==');
  let _0x22e79f6 = { open: false, query: "", items: [], index: 0, target: null };

  function _0x22e7af6() {
    if (document.getElementById(_0x22e77f6)) return;
    const _0x1f8ebf6 = document.createElement(_0xd6('c3R5bGU='));
    _0x1f8ebf6.id = _0x22e77f6;
    _0x1f8ebf6.textContent = `
      body.${_0x22e78f6} [role="listbox"]:not(#${_0x22e76f6} *):not(#${_0x22e76f6}),
      body.${_0x22e78f6} [data-radix-popper-content-wrapper]:not(#${_0x22e76f6} *),
      body.${_0x22e78f6} [data-command]:not(#${_0x22e76f6} *),
      body.${_0x22e78f6} [data-radix-collection-item]:not(#${_0x22e76f6} *),
      body.${_0x22e78f6} [cmdk-root]:not(#${_0x22e76f6} *),
      body.${_0x22e78f6} [cmdk-list]:not(#${_0x22e76f6} *),
      body.${_0x22e78f6} [cmdk-item]:not(#${_0x22e76f6} *) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .ts-slash-skills-textarea-active {
        box-shadow:
          0 0 0 1px rgba(var(--ts-brand-primary-rgb), 0.55),
          0 0 18px rgba(var(--ts-brand-primary-rgb), 0.22) !important;
        border-radius: 12px !important;
        transition: box-shadow .18s ease !important;
      }
      #${_0x22e76f6} {
        position: fixed;
        z-index: 2147483646;
        min-width: 320px;
        max-width: 460px;
        max-height: 340px;
        overflow: hidden;
        background: rgba(18, 18, 24, 0.96);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(var(--ts-brand-primary-rgb), 0.45);
        border-radius: 14px;
        box-shadow: 0 18px 48px rgba(0,0,0,.45), 0 0 0 1px rgba(59,130,246,.25);
        color: #f5f5f7;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
        font-size: 13px;
        opacity: 0;
        transform: translateY(6px);
        transition: opacity .14s ease, transform .14s ease;
        display: flex;
        flex-direction: column;
      }
      #${_0x22e76f6}.ts-slash-open { opacity: 1; transform: translateY(0); }
      #${_0x22e76f6} .ts-slash-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.06);
      }
      #${_0x22e76f6} .ts-slash-title {
        display: flex; align-items: center; gap: 6px;
        font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
        color: rgba(255,255,255,.65);
      }
      #${_0x22e76f6} .ts-slash-badge {
        background: var(--ts-brand-gradient);
        color: #fff; padding: 2px 8px; border-radius: 999px;
        font-size: 10px; font-weight: 600; letter-spacing: .05em;
      }
      #${_0x22e76f6} .ts-slash-hint { font-size: 10px; color: rgba(255,255,255,.4); }
      #${_0x22e76f6} .ts-slash-list {
        list-style: none; margin: 0; padding: 6px;
        overflow-y: auto; max-height: 280px;
      }
      #${_0x22e76f6} .ts-slash-item {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 10px; border-radius: 8px; cursor: pointer;
        transition: background .12s ease;
      }
      #${_0x22e76f6} .ts-slash-item:hover,
      #${_0x22e76f6} .ts-slash-item.ts-active {
        background: rgba(var(--ts-brand-primary-rgb), 0.22);
      }
      #${_0x22e76f6} .ts-slash-icon {
        width: 26px; height: 26px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, rgba(59,130,246,.55), rgba(37,99,235,.45));
        font-size: 14px; flex-shrink: 0;
      }
      #${_0x22e76f6} .ts-slash-label { flex: 1; font-weight: 500; color: #fff; }
      #${_0x22e76f6} .ts-slash-preview {
        font-size: 11px; color: rgba(255,255,255,.45);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        max-width: 180px;
      }
      #${_0x22e76f6} .ts-slash-empty {
        padding: 18px; text-align: center; color: rgba(255,255,255,.5); font-size: 12px;
      }
    `;
    document.head.appendChild(_0x1f8ebf6);
  }

  function _0x22e7bf6() {
    return _0x22df6f6 === _0xd6('cG9wdXA=');
  }

  function _0x22e7cf6(_0x1f936f6) {
    if (!_0x1f936f6) return false;
    if (_0x1f936f6.closest && (_0x1f936f6.closest(`#${_0x22de8f6}`) || _0x1f936f6.closest(`#${_0x22decf6}`) || _0x1f936f6.closest(`#${_0x22dedf6}`) || _0x1f936f6.closest(`#${_0x22e76f6}`))) return false;
    if (_0x1f936f6.tagName === _0xd6('VEVYVEFSRUE=')) return true;
    if (_0x1f936f6.getAttribute && _0x1f936f6.getAttribute(_0xd6('Y29udGVudGVkaXRhYmxl')) === _0xd6('dHJ1ZQ==')) return true;
    return false;
  }

  function _0x22e7df6(_0x1f9e2f6) {
    if (typeof _0x1f9e2f6 !== _0xd6('c3RyaW5n')) return null;
    const _0x1f9e3f6 = _0x1f9e2f6.replace(/^\s+/, "");
    if (!_0x1f9e3f6.startsWith("/")) return null;
    // Match "/" + optional word + optional space + rest
    const _0x1f9e4f6 = _0x1f9e3f6.match(/^\/([\p{L}\p{N}_-]*)(?:\s+([\s\S]*))?$/u);
    if (!_0x1f9e4f6) return null;
    return { command: _0x1f9e4f6[1] || "", rest: _0x1f9e4f6[2] || "" };
  }

  function _0x22e7ef6(_0x1fa4ef6) {
    const _0x1fa4ff6 = (_0x1fa4ef6 || "").toLowerCase().trim();
    const _0x1fa50f6 = _0x22dfff6();
    if (!_0x1fa4ff6) return _0x1fa50f6.slice(0, 50);
    return _0x1fa50f6.filter((_0x1fb3df6) => {
      const _0x1fb3ef6 = String(_0x1fb3df6.label || "").toLowerCase();
      const _0x1fb3ff6 = String(_0x1fb3df6.prefix || "").toLowerCase();
      const _0x1fb40f6 = String(_0x1fb3df6.description || "").toLowerCase();
      return _0x1fb3ef6.includes(_0x1fa4ff6) || _0x1fb3ff6.includes(_0x1fa4ff6) || _0x1fb40f6.includes(_0x1fa4ff6);
    });
  }

  function _0x22e7ff6() {
    let _0x1fb7ff6 = document.getElementById(_0x22e76f6);
    if (_0x1fb7ff6) return _0x1fb7ff6;
    _0x22e7af6();
    _0x1fb7ff6 = document.createElement("div");
    _0x1fb7ff6.id = _0x22e76f6;
    _0x1fb7ff6.innerHTML = `
      <div class="ts-slash-head">
        <div class="ts-slash-title">
          <span class="ts-slash-badge">TS Skills</span>
        </div>
        <div class="ts-slash-hint">↑↓ navegar · Enter usar · Esc fechar</div>
      </div>
      <ul class="ts-slash-list" role="listbox"></ul>
    `;
    document.body.appendChild(_0x1fb7ff6);
    _0x1fb7ff6.addEventListener(_0xd6('bW91c2Vkb3du'), (_0x1fb7df6) => { _0x1fb7df6.preventDefault(); }); // prevent textarea blur
    return _0x1fb7ff6;
  }

  function _0x22e80f6() {
    const _0x1ff77f6 = document.getElementById(_0x22e76f6);
    if (!_0x1ff77f6 || !_0x22e79f6.target) return;
    const _0x1ff78f6 = _0x22e0cf6() || _0x22e79f6.target;
    const _0x1ff79f6 = _0x1ff78f6.getBoundingClientRect();
    const _0x1ff7af6 = Math.min(460, Math.max(320, _0x1ff79f6.width));
    let _0x1ff7bf6 = _0x1ff79f6.left + (_0x1ff79f6.width - _0x1ff7af6) / 2;
    _0x1ff7bf6 = Math.max(8, Math.min(_0x1ff7bf6, window.innerWidth - _0x1ff7af6 - 8));
    _0x1ff77f6.style.width = _0x1ff7af6 + "px";
    _0x1ff77f6.style.left = _0x1ff7bf6 + "px";
    // anchor above composer
    const _0x1ff7cf6 = _0x1ff77f6.offsetHeight || 280;
    let _0x1ff7df6 = _0x1ff79f6.top - _0x1ff7cf6 - 8;
    if (_0x1ff7df6 < 8) _0x1ff7df6 = _0x1ff79f6.bottom + 8;
    _0x1ff77f6.style.top = _0x1ff7df6 + "px";
  }

  function _0x22e81f6() {
    const _0x2038cf6 = _0x22e7ff6();
    const _0x2038df6 = _0x2038cf6.querySelector(_0xd6('LnRzLXNsYXNoLWxpc3Q='));
    if (!_0x2038df6) return;
    const _0x2038ef6 = _0x22e79f6.items;
    if (!_0x2038ef6.length) {
      _0x2038df6.innerHTML = `<li class="ts-slash-empty">Nenhuma skill encontrada</li>`;
      return;
    }
    if (_0x22e79f6.index >= _0x2038ef6.length) _0x22e79f6.index = 0;
    _0x2038df6.innerHTML = _0x2038ef6.map((_0x202aaf6, _0x202abf6) => {
      const _0x202acf6 = _0x202abf6 === _0x22e79f6.index ? _0xd6('IHRzLWFjdGl2ZQ==') : "";
      const _0x202adf6 = String(_0x202aaf6.icon || "✦");
      const _0x202aef6 = _0x202adf6.trim().startsWith(_0xd6('PHN2Zw=='));
      const _0x202aff6 = _0x202aef6 ? _0x202adf6 : _0x22e2ef6(_0x202adf6);
      const _0x202b0f6 = _0x22e2ef6(String(_0x202aaf6.prefix || _0x202aaf6.description || "").slice(0, 80));
      return `<li class="ts-slash-item${_0x202acf6}" data-idx="${_0x202abf6}" role="option">
        <span class="ts-slash-icon">${_0x202aff6}</span>
        <span class="ts-slash-label">${_0x22e2ef6(_0x202aaf6.label || "")}</span>
        <span class="ts-slash-preview">${_0x202b0f6}</span>
      </li>`;
    }).join("");
    _0x2038df6.querySelectorAll(_0xd6('LnRzLXNsYXNoLWl0ZW0=')).forEach((_0x202f7f6) => {
      _0x202f7f6.addEventListener(_0xd6('bW91c2VlbnRlcg=='), () => {
        _0x22e79f6.index = parseInt(_0x202f7f6.getAttribute(_0xd6('ZGF0YS1pZHg=')), 10) || 0;
        _0x2038df6.querySelectorAll(_0xd6('LnRzLXNsYXNoLWl0ZW0=')).forEach((_0x202f1f6) => _0x202f1f6.classList.toggle(_0xd6('dHMtYWN0aXZl'), _0x202f1f6 === _0x202f7f6));
      });
      _0x202f7f6.addEventListener(_0xd6('Y2xpY2s='), (_0x20332f6) => {
        _0x20332f6.preventDefault(); _0x20332f6.stopPropagation();
        const _0x20333f6 = parseInt(_0x202f7f6.getAttribute(_0xd6('ZGF0YS1pZHg=')), 10) || 0;
        _0x22e85f6(_0x20333f6);
      });
    });
    const _0x2038ff6 = _0x2038df6.querySelector(_0xd6('LnRzLXNsYXNoLWl0ZW0udHMtYWN0aXZl'));
    if (_0x2038ff6 && _0x2038ff6.scrollIntoView) _0x2038ff6.scrollIntoView({ block: _0xd6('bmVhcmVzdA==') });
  }

  function _0x22e82f6(_0x2047af6, _0x2047bf6) {
    _0x22e79f6.target = _0x2047af6;
    _0x22e79f6.query = _0x2047bf6 || "";
    _0x22e79f6.items = _0x22e7ef6(_0x22e79f6.query);
    _0x22e79f6.index = 0;
    _0x22e79f6.open = true;
    document.body.classList.add(_0x22e78f6);
    const _0x2047cf6 = _0x22e7ff6();
    _0x22e81f6();
    _0x22e80f6();
    requestAnimationFrame(() => { _0x2047cf6.classList.add(_0xd6('dHMtc2xhc2gtb3Blbg==')); _0x22e80f6(); });
    if (_0x2047af6 && _0x2047af6.classList) _0x2047af6.classList.add(_0xd6('dHMtc2xhc2gtc2tpbGxzLXRleHRhcmVhLWFjdGl2ZQ=='));
  }

  function _0x22e83f6(_0x204a4f6) {
    if (!_0x22e79f6.open) return;
    _0x22e79f6.query = _0x204a4f6 || "";
    _0x22e79f6.items = _0x22e7ef6(_0x22e79f6.query);
    _0x22e79f6.index = 0;
    _0x22e81f6();
    _0x22e80f6();
  }

  function _0x22e84f6() {
    _0x22e79f6.open = false;
    document.body.classList.remove(_0x22e78f6);
    const _0x204d6f6 = document.getElementById(_0x22e76f6);
    if (_0x204d6f6) _0x204d6f6.remove();
    if (_0x22e79f6.target && _0x22e79f6.target.classList) {
      _0x22e79f6.target.classList.remove(_0xd6('dHMtc2xhc2gtc2tpbGxzLXRleHRhcmVhLWFjdGl2ZQ=='));
    }
    _0x22e79f6.target = null;
  }

  function _0x22e85f6(_0x206dff6) {
    const _0x206e0f6 = _0x22e79f6.items[_0x206dff6];
    const _0x206e1f6 = _0x22e79f6.target;
    if (!_0x206e0f6 || !_0x206e1f6) { _0x22e84f6(); return; }
    // Replace the "/query" portion with just the remaining text (no prefix in
    // the textarea). The picked skill is stored separately and rendered as a
    // badge above the composer; the prefix is added at send time.
    const _0x206e2f6 = _0x22e44f6(_0x206e1f6);
    const _0x206e3f6 = _0x22e7df6(_0x206e2f6);
    const _0x206e4f6 = _0x206e3f6 && _0x206e3f6.rest ? _0x206e3f6.rest : "";
    if (_0x206e1f6.tagName === _0xd6('VEVYVEFSRUE=') || _0x206e1f6.tagName === _0xd6('SU5QVVQ=')) {
      const _0x2067ef6 = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, _0xd6('dmFsdWU='))
        || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, _0xd6('dmFsdWU='));
      if (_0x2067ef6 && _0x2067ef6.set) _0x2067ef6.set.call(_0x206e1f6, _0x206e4f6);
      else _0x206e1f6.value = _0x206e4f6;
      _0x206e1f6.dispatchEvent(new Event(_0xd6('aW5wdXQ='), { bubbles: true }));
    } else if (_0x206e1f6.isContentEditable) {
      _0x206e1f6.textContent = _0x206e4f6;
      _0x206e1f6.dispatchEvent(new InputEvent(_0xd6('aW5wdXQ='), { bubbles: true }));
    }
    _0x22e1bf6(_0x206e0f6);
    _0x206e1f6.focus();
    _0x22e84f6();
    try { _0x22e41f6(_0xd6('U2tpbGwg') + (_0x206e0f6.label || _0x206e0f6.name || _0xd6('c2VsZWNpb25hZGE='))); } catch (_0x206e6f6) {}
  }

  // Capture-phase input handler: detect "/" at start of native composer
  function _0x22e86f6(_0x2077bf6) {
    if (!_0x22e7bf6()) return;
    const _0x2077cf6 = _0x2077bf6.target;
    if (!_0x22e7cf6(_0x2077cf6)) {
      if (_0x22e79f6.open) _0x22e84f6();
      return;
    }
    const _0x2077df6 = _0x22e44f6(_0x2077cf6);
    const _0x2077ef6 = _0x22e7df6(_0x2077df6);
    if (_0x2077ef6) {
      if (!_0x22e79f6.open) _0x22e82f6(_0x2077cf6, _0x2077ef6.command);
      else _0x22e83f6(_0x2077ef6.command);
    } else if (_0x22e79f6.open) {
      _0x22e84f6();
    }
  }

  document.addEventListener(_0xd6('aW5wdXQ='), _0x22e86f6, true);
  document.addEventListener(_0xd6('YmVmb3JlaW5wdXQ='), _0x22e86f6, true);
  document.addEventListener(_0xd6('a2V5dXA='), _0x22e86f6, true);

  // Keyboard navigation within picker — must run before Lovable handlers (capture)
  document.addEventListener(_0xd6('a2V5ZG93bg=='), (_0x21aabf6) => {
    if (!_0x22e79f6.open || !_0x22e7bf6()) return;
    const _0x21aacf6 = _0x21aabf6.target;
    if (!_0x22e7cf6(_0x21aacf6)) return;
    if (_0x21aabf6.key === _0xd6('QXJyb3dEb3du')) {
      _0x21aabf6.preventDefault(); _0x21aabf6.stopPropagation(); _0x21aabf6.stopImmediatePropagation?.();
      _0x22e79f6.index = Math.min(_0x22e79f6.items.length - 1, _0x22e79f6.index + 1);
      _0x22e81f6();
    } else if (_0x21aabf6.key === _0xd6('QXJyb3dVcA==')) {
      _0x21aabf6.preventDefault(); _0x21aabf6.stopPropagation(); _0x21aabf6.stopImmediatePropagation?.();
      _0x22e79f6.index = Math.max(0, _0x22e79f6.index - 1);
      _0x22e81f6();
    } else if (_0x21aabf6.key === _0xd6('RW50ZXI=') || _0x21aabf6.key === "Tab") {
      if (_0x21aabf6.shiftKey) return;
      _0x21aabf6.preventDefault(); _0x21aabf6.stopPropagation(); _0x21aabf6.stopImmediatePropagation?.();
      _0x22e85f6(_0x22e79f6.index);
    } else if (_0x21aabf6.key === _0xd6('RXNjYXBl')) {
      _0x21aabf6.preventDefault(); _0x21aabf6.stopPropagation(); _0x21aabf6.stopImmediatePropagation?.();
      _0x22e84f6();
    }
  }, true);

  // Close when clicking outside or composer loses focus
  document.addEventListener(_0xd6('Zm9jdXNvdXQ='), (_0x21f3af6) => {
    if (!_0x22e79f6.open) return;
    setTimeout(() => {
      const _0x21f39f6 = document.activeElement;
      if (_0x22e79f6.open && !_0x22e7cf6(_0x21f39f6) && !(_0x21f39f6 && _0x21f39f6.closest && _0x21f39f6.closest(`#${_0x22e76f6}`))) {
        _0x22e84f6();
      }
    }, 80);
  }, true);
  document.addEventListener(_0xd6('bW91c2Vkb3du'), (_0x223e5f6) => {
    if (!_0x22e79f6.open) return;
    const _0x223e6f6 = document.getElementById(_0x22e76f6);
    if (_0x223e6f6 && _0x223e6f6.contains(_0x223e5f6.target)) return;
    if (_0x22e7cf6(_0x223e5f6.target)) return;
    _0x22e84f6();
  }, true);
  window.addEventListener(_0xd6('cmVzaXpl'), () => { if (_0x22e79f6.open) _0x22e80f6(); });
  window.addEventListener(_0xd6('c2Nyb2xs'), () => { if (_0x22e79f6.open) _0x22e80f6(); }, true);

  _0x22e68f6();
})();
