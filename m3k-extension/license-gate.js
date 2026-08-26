/* Tela de ativação de licença — OferrolGarcia PRO */
(function () {
  "use strict";
  var L = self.OGLicense;

  var $ = function (id) { return document.getElementById(id); };
  var form = $("lic-form"),
    input = $("lic-token"),
    emailInput = $("lic-email"),
    msg = $("lic-msg"),
    submit = $("lic-submit"),
    spinner = submit.querySelector(".lic-spinner"),
    label = submit.querySelector(".lic-btn-label"),
    statusBox = $("lic-status"),
    statusText = $("lic-status-text"),
    card = $("lic-card"),
    success = $("lic-success");

  function setStatus(tone, text) {
    statusBox.setAttribute("data-tone", tone);
    statusText.textContent = text;
  }
  function setMsg(text, ok) {
    msg.textContent = text || "";
    msg.className = "lic-msg" + (ok ? " ok" : "");
  }
  function busy(on) {
    submit.disabled = on;
    spinner.hidden = !on;
    label.textContent = on ? "VALIDANDO…" : "VALIDAR E ABRIR EXTENSÃO";
  }

  function fmtDate(iso) {
    if (!iso) return "Licença sem data de expiração";
    try {
      return "Válida até " + new Date(iso).toLocaleString("pt-BR");
    } catch (e) { return ""; }
  }

  function maskInput(v) {
    var raw = L.normalizeToken(v).replace(/[^A-Z0-9-]/g, "");
    return raw.slice(0, 64);
  }

  input.addEventListener("input", function () {
    var pos = input.selectionStart;
    input.value = maskInput(input.value);
    try { input.setSelectionRange(pos, pos); } catch (e) {}
    setMsg("");
  });

  $("lic-paste").addEventListener("click", async function () {
    try {
      var t = await navigator.clipboard.readText();
      input.value = maskInput(t);
      input.focus();
    } catch (e) {
      setMsg("Não foi possível ler a área de transferência. Cole com Ctrl+V.");
    }
  });

  function openExtension() {
    chrome.runtime.sendMessage({ type: "OG_LICENSE_OK" }, function () {
      void chrome.runtime.lastError;
    });
  }

  function showSuccess(state) {
    card.hidden = true;
    success.hidden = false;
    $("lic-plan").textContent = state.plan_name || state.plan || "Licença ativa";
    $("lic-exp").textContent = fmtDate(state.expires_at);
    startCountdown(state);
    
    // Confetes no sucesso
    try {
      if (window.confetti) {
        window.confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ff2fb2', '#38bdf8', '#22ffa7']
        });
      }
    } catch (e) {}

    var n = 3;
    var redirect = $("lic-redirect");
    var tick = setInterval(function () {
      n--;
      redirect.textContent = n > 0
        ? "Abrindo a Lovable com a extensão liberada em " + n + "…"
        : "Abrindo…";
      if (n <= 0) { clearInterval(tick); openExtension(); }
    }, 1000);
    $("lic-open").addEventListener("click", function () {
      clearInterval(tick);
      openExtension();
    });
  }

  var countdownTick = null;
  function startCountdown(state) {
    var box = $("lic-countdown");
    var clock = $("lic-countdown-clock");
    var fill = $("lic-countdown-fill");
    if (!box || !clock) return;
    if (countdownTick) clearInterval(countdownTick);
    if (!state || !state.expires_at) {
      box.hidden = true;
      return;
    }
    var end = Date.parse(state.expires_at);
    var start = state.activated_at ? Date.parse(state.activated_at) : Date.now();
    if (!end || isNaN(end)) { box.hidden = true; return; }
    var total = Math.max(end - start, 1);
    box.hidden = false;

    function pad(n) { return String(n).padStart(2, "0"); }
    function render() {
      var left = end - Date.now();
      if (left <= 0) {
        clock.textContent = "EXPIRADA";
        if (fill) { fill.style.width = "0%"; fill.style.background = "#ef4444"; }
        clearInterval(countdownTick);
        return;
      }
      var d = Math.floor(left / 86400000);
      var h = Math.floor((left % 86400000) / 3600000);
      var m = Math.floor((left % 3600000) / 60000);
      var s2 = Math.floor((left % 60000) / 1000);
      clock.textContent = (d > 0 ? d + "d " : "") + pad(h) + ":" + pad(m) + ":" + pad(s2);
      if (fill) {
        var pct = Math.max(0, Math.min(100, (left / total) * 100));
        fill.style.width = pct + "%";
        fill.style.background = pct > 40 ? "#22c55e" : pct > 15 ? "#f59e0b" : "#ef4444";
      }
    }
    render();
    countdownTick = setInterval(render, 1000);
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var token = maskInput(input.value);
    var email = String((emailInput && emailInput.value) || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMsg("Informe o e-mail da sua conta MSK.");
      if (emailInput) emailInput.focus();
      return;
    }
    if (token.length < 8) {
      setMsg("Digite a licença completa recebida na compra.");
      input.focus();
      return;
    }
    busy(true);
    setStatus("busy", "Validando e-mail e licença no servidor MSK…");
    setMsg("");
    var r = await L.activate(token, email);
    busy(false);
    if (r.ok) {
      setStatus("ok", "Licença válida e vinculada a este dispositivo.");
      setMsg("Acesso liberado!", true);
      showSuccess(r.state);
    } else {
      setStatus("err", "Falha na validação.");
      setMsg(r.message || "Token inválido.");
      input.select();
    }
  });

  // Função para tornar o popup arrastável
  function makeDraggable(shell, handle) {
    var isDragging = false;
    var offsetX, offsetY;

    // Recuperar posição salva
    chrome.storage.local.get(['licPopupPosition'], function(result) {
      if (result.licPopupPosition) {
        shell.style.left = result.licPopupPosition.left;
        shell.style.top = result.licPopupPosition.top;
        shell.style.transform = 'none'; // Remove centralização automática
      }
    });

    handle.addEventListener('mousedown', function(e) {
      if (e.target.closest('a') || e.target.closest('button')) return;
      isDragging = true;
      offsetX = e.clientX - shell.getBoundingClientRect().left;
      offsetY = e.clientY - shell.getBoundingClientRect().top;
      shell.style.transition = 'none';
      document.body.style.cursor = 'move';
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var left = e.clientX - offsetX;
      var top = e.clientY - offsetY;
      
      shell.style.left = left + 'px';
      shell.style.top = top + 'px';
      shell.style.transform = 'none';
    });

    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      shell.style.transition = 'transform 0.1s ease-out';
      document.body.style.cursor = 'default';

      // Salvar posição
      chrome.storage.local.set({
        licPopupPosition: {
          left: shell.style.left,
          top: shell.style.top
        }
      });
    });
  }

  (async function init() {
    var shell = document.querySelector('.lic-shell');
    var handle = document.querySelector('.lic-head');
    if (shell && handle) makeDraggable(shell, handle);

    try { $("lic-ver").textContent = "v" + chrome.runtime.getManifest().version; } catch (e) {}
    var id = await L.getInstallationId();
    $("lic-install").textContent = "ID " + id.slice(-10);

    var s = await L.getState();
    if (s.token) input.value = s.token;
    chrome.storage.local.get(["og_license_email"], function (v) {
      if (v && v.og_license_email && emailInput) emailInput.value = v.og_license_email;
    });
    if (s.token) {
      setStatus("busy", "Reverificando licença salva…");
      var r = await L.refresh(true);
      if (r.ok) {
        setStatus("ok", "Licença ativa neste dispositivo.");
        showSuccess(r.state || {});
        return;
      }
      setStatus("err", L.friendly(r.code));
      setMsg(L.friendly(r.code));
    } else {
      setStatus("idle", "Informe e-mail + licença para ativar…");
      if (emailInput) emailInput.focus(); else input.focus();
    }
  })();
})();
