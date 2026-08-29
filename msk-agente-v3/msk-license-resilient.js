(() => {
  "use strict";
  if (window.__MSK_LICENSE_RESILIENT_3432__) return;
  window.__MSK_LICENSE_RESILIENT_3432__ = true;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalizeEmail = value => String(value || "").trim().toLowerCase();
  const normalizeToken = value => String(value || "").trim().toUpperCase();

  const getGate = () => {
    const root = document.querySelector("#msk-root.msk-gate-root, #msk-root");
    const host = root?.firstElementChild || null;
    const shadow = host?.shadowRoot || null;
    if (!root || !shadow) return null;
    const activate = shadow.getElementById("activate");
    const email = shadow.getElementById("email");
    const token = shadow.getElementById("token");
    const msg = shadow.getElementById("msg");
    if (!activate || !email || !token || !msg) return null;
    return { root, shadow, activate, email, token, msg };
  };

  const setMessage = (gate, text, ok = false) => {
    if (!gate?.msg) return;
    gate.msg.textContent = String(text || "");
    gate.msg.className = `msg${ok ? " ok" : ""}`;
  };

  const setBusy = (gate, busy) => {
    if (!gate?.activate) return;
    gate.activate.disabled = !!busy;
    gate.activate.textContent = busy ? "VALIDANDO…" : "LIBERAR ACESSO";
  };

  const matchingStoredLicense = async (email, token) => {
    try {
      const saved = await chrome.storage.local.get(["mskLicense", "mskLicenseEmail"]);
      const license = saved?.mskLicense || null;
      if (!license?.email || !license?.token) return null;
      if (normalizeEmail(license.email) !== email) return null;
      if (normalizeToken(license.token) !== token) return null;
      if (license.expires_at && Date.parse(String(license.expires_at)) <= Date.now()) return null;
      return license;
    } catch {
      return null;
    }
  };

  const waitForStoredLicense = async (email, token, timeout = 2200) => {
    const limit = Date.now() + timeout;
    while (Date.now() < limit) {
      const license = await matchingStoredLicense(email, token);
      if (license) return license;
      await sleep(80);
    }
    return null;
  };

  const sendActivation = async (email, token, timeout = 13000) => {
    let timer = 0;
    try {
      return await Promise.race([
        chrome.runtime.sendMessage({ type:"MSK_LICENSE_ACTIVATE", email, token }).catch(() => null),
        new Promise(resolve => { timer = window.setTimeout(() => resolve(null), timeout); })
      ]);
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  };

  let activating = false;
  const activateResilient = async gate => {
    if (activating) return;
    const email = normalizeEmail(gate.email.value);
    const token = normalizeToken(gate.token.value);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMessage(gate, "Informe o e-mail da sua conta MSK.");
      return;
    }
    if (token.length < 8) {
      setMessage(gate, "Informe a licença completa recebida na compra.");
      return;
    }

    activating = true;
    setBusy(gate, true);
    setMessage(gate, "Validando sua licença no servidor MSK…");

    try {
      // Se a validação anterior já chegou ao storage, não faz o cliente repetir nada.
      let stored = await matchingStoredLicense(email, token);
      if (stored) {
        setMessage(gate, "Acesso liberado. Abrindo o MSK…", true);
        await chrome.storage.local.set({ mskGuardianEnabled:true, mskOpenGuardianAfterReload:true }).catch(() => {});
        window.setTimeout(() => location.reload(), 80);
        return;
      }

      let lastResponse = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        setMessage(gate, attempt === 1
          ? "Validando sua licença no servidor MSK…"
          : `Reconectando ao módulo de licença… ${attempt}/3`);

        const response = await sendActivation(email, token, attempt === 1 ? 13000 : 8500);
        lastResponse = response || lastResponse;

        if (response?.ok) {
          stored = response.license || await matchingStoredLicense(email, token);
          setMessage(gate, "Acesso liberado. Abrindo o MSK…", true);
          await chrome.storage.local.set({ mskGuardianEnabled:true, mskOpenGuardianAfterReload:true }).catch(() => {});
          window.setTimeout(() => location.reload(), 80);
          return;
        }

        // Sintoma observado: o background valida/salva, mas o ACK da mensagem se perde.
        stored = await waitForStoredLicense(email, token, 1800);
        if (stored) {
          setMessage(gate, "Acesso liberado. Abrindo o MSK…", true);
          await chrome.storage.local.set({ mskGuardianEnabled:true, mskOpenGuardianAfterReload:true }).catch(() => {});
          window.setTimeout(() => location.reload(), 80);
          return;
        }

        // Resposta real do servidor (licença inválida, expirada etc.) não deve ser mascarada.
        if (response && response.ok === false && response.code && !/^NETWORK_|^LICENSE_HTTP_0$/i.test(String(response.code))) {
          setMessage(gate, response.message || "Não foi possível validar esta licença.");
          return;
        }

        if (attempt < 3) await sleep(300 + attempt * 250);
      }

      // Última checagem: evita exibir falso erro se o storage chegar alguns ms depois.
      stored = await waitForStoredLicense(email, token, 1800);
      if (stored) {
        setMessage(gate, "Acesso liberado. Abrindo o MSK…", true);
        await chrome.storage.local.set({ mskGuardianEnabled:true, mskOpenGuardianAfterReload:true }).catch(() => {});
        window.setTimeout(() => location.reload(), 80);
        return;
      }

      setMessage(gate, lastResponse?.message || "Não consegui confirmar a validação agora. A extensão tentou se reconectar automaticamente; tente novamente em alguns segundos.");
    } finally {
      activating = false;
      setBusy(gate, false);
    }
  };

  let mountedShadow = null;
  const mount = () => {
    const gate = getGate();
    if (!gate || gate.shadow === mountedShadow) return !!gate;
    mountedShadow = gate.shadow;

    // Captura antes do listener original do msk-license.js para evitar o falso erro
    // e deixar este fluxo resiliente ser o único dono da ativação.
    gate.shadow.addEventListener("click", event => {
      const target = event.composedPath?.()[0] || event.target;
      if (target !== gate.activate && !target?.closest?.("#activate")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      activateResilient(gate).catch(() => {
        activating = false;
        setBusy(gate, false);
        setMessage(gate, "Não consegui concluir a validação. Tente novamente em alguns segundos.");
      });
    }, true);

    gate.shadow.addEventListener("keydown", event => {
      const target = event.composedPath?.()[0] || event.target;
      if (event.key !== "Enter" || ![gate.email, gate.token].includes(target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      activateResilient(gate).catch(() => {});
    }, true);

    return true;
  };

  const storageListener = changes => {
    if (!activating || !changes?.mskLicense?.newValue) return;
    const gate = getGate();
    if (!gate) return;
    const email = normalizeEmail(gate.email.value);
    const token = normalizeToken(gate.token.value);
    const license = changes.mskLicense.newValue;
    if (normalizeEmail(license?.email) !== email || normalizeToken(license?.token) !== token) return;
    setMessage(gate, "Acesso liberado. Abrindo o MSK…", true);
    chrome.storage.local.set({ mskGuardianEnabled:true, mskOpenGuardianAfterReload:true }).catch(() => {});
    window.setTimeout(() => location.reload(), 80);
  };
  chrome.storage.onChanged.addListener(storageListener);

  const timer = window.setInterval(() => {
    if (mount()) window.clearInterval(timer);
  }, 100);
  mount();
})();
