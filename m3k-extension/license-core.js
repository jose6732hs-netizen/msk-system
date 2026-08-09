/* OFERROLGARCIA — Núcleo de Licenciamento (MSK SUIT)
 * Compartilhado entre background service worker, tela de licença e content scripts.
 * © 2026 Reginaldo Ferrol. */
(function (root) {
  "use strict";

  var API_BASE = "https://msk-extencsoes.lovable.app";
  var EP = {
    validate: API_BASE + "/api/public/license/validate",
    heartbeat: API_BASE + "/api/public/license/heartbeat",
  };

  var STORE = {
    token: "og_license_token",
    state: "og_license_state",
    install: "og_installation_id",
  };

  var REVALIDATE_MS = 15 * 60 * 1000; // 15 minutos
  var GRACE_MS = 6 * 60 * 60 * 1000; // tolerância offline: 6h

  function uuid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    var s = "";
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  function get(keys) {
    return new Promise(function (res) {
      chrome.storage.local.get(keys, function (v) {
        res(v || {});
      });
    });
  }
  function set(obj) {
    return new Promise(function (res) {
      chrome.storage.local.set(obj, function () {
        res();
      });
    });
  }

  async function getInstallationId() {
    var v = await get([STORE.install]);
    var id = v[STORE.install];
    if (!id) {
      id = "og-" + uuid().replace(/-/g, "");
      await set2(STORE.install, id);
    }
    return id;
  }
  function set2(k, val) {
    var o = {};
    o[k] = val;
    return set(o);
  }

  function version() {
    try {
      return chrome.runtime.getManifest().version;
    } catch (e) {
      return "0.0.0";
    }
  }

  function normalizeToken(t) {
    return String(t || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  var ERRORS = {
    LICENSE_INVALID: "Token inválido. Confira os caracteres e tente novamente.",
    LICENSE_EXPIRED: "Esta licença expirou. Renove para continuar usando.",
    LICENSE_REVOKED: "Esta licença foi bloqueada pelo suporte.",
    REAUTH_REQUIRED: "Acesso revogado. Insira um novo token válido.",
    DEVICE_NOT_REGISTERED: "Limite de dispositivos atingido para esta licença.",
    DEVICE_LIMIT: "Limite de dispositivos atingido para esta licença.",
    RATE_LIMITED: "Muitas tentativas. Aguarde alguns segundos.",
    INVALID_REQUEST: "Token com formato inválido.",
    NETWORK: "Sem conexão com o servidor de licenças. Verifique sua internet.",
  };

  function friendly(code) {
    return ERRORS[code] || "Não foi possível validar a licença (" + (code || "erro") + ").";
  }

  /** Chama o servidor. mode: 'validate' | 'heartbeat' */
  async function callServer(token, mode) {
    var installation_id = await getInstallationId();
    var body = {
      token: normalizeToken(token),
      installation_id: installation_id,
      device_fingerprint: installation_id,
      extension_version: version(),
    };
    var r;
    try {
      r = await fetch(mode === "heartbeat" ? EP.heartbeat : EP.validate, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return { ok: false, code: "NETWORK", offline: true };
    }
    var data = null;
    try {
      data = await r.json();
    } catch (e) {}
    if (!data) return { ok: false, code: "NETWORK", offline: true };
    if (r.ok && data.success) return { ok: true, data: data };
    return { ok: false, code: data.error || "LICENSE_INVALID", data: data };
  }

  async function getState() {
    var v = await get([STORE.state, STORE.token]);
    return { state: v[STORE.state] || null, token: v[STORE.token] || "" };
  }

  function stateIsUsable(state) {
    if (!state || !state.valid) return false;
    if (state.expires_at && Date.parse(state.expires_at) < Date.now()) return false;
    // tolerância offline
    if (state.offlineSince && Date.now() - state.offlineSince > GRACE_MS) return false;
    return true;
  }

  async function saveValid(token, data) {
    var state = {
      valid: true,
      checkedAt: Date.now(),
      offlineSince: 0,
      plan: (data && (data.plan || (data.license && data.license.plan))) || null,
      plan_name:
        (data && (data.plan_name || (data.license && data.license.plan_name))) || null,
      expires_at:
        (data && (data.expires_at || (data.license && data.license.expires_at))) || null,
      features: (data && data.features) || null,
      status: (data && data.status) || "ACTIVE",
    };
    var o = {};
    o[STORE.state] = state;
    o[STORE.token] = normalizeToken(token);
    await set(o);
    return state;
  }

  async function clear(reason) {
    var o = {};
    o[STORE.state] = { valid: false, reason: reason || "cleared", checkedAt: Date.now() };
    await set(o);
  }

  /** Ativa um token digitado pelo usuário. */
  async function activate(token) {
    var t = normalizeToken(token);
    if (t.length < 8) return { ok: false, message: "Digite o token completo." };
    var r = await callServer(t, "validate");
    if (r.ok) {
      var st = await saveValid(t, r.data);
      return { ok: true, state: st };
    }
    if (r.offline) return { ok: false, code: "NETWORK", message: friendly("NETWORK") };
    return { ok: false, code: r.code, message: friendly(r.code) };
  }

  /** Revalida silenciosamente o token salvo. */
  async function refresh(force) {
    var s = await getState();
    if (!s.token) {
      await clear("no_token");
      return { ok: false, code: "NO_TOKEN" };
    }
    if (!force && s.state && s.state.checkedAt && Date.now() - s.state.checkedAt < REVALIDATE_MS) {
      return { ok: stateIsUsable(s.state), cached: true, state: s.state };
    }
    var r = await callServer(s.token, "heartbeat");
    if (r.ok) {
      var st = await saveValid(s.token, r.data);
      return { ok: true, state: st };
    }
    if (r.offline) {
      // mantém acesso dentro da tolerância
      var st2 = s.state || {};
      st2.offlineSince = st2.offlineSince || Date.now();
      await set2(STORE.state, st2);
      return { ok: stateIsUsable(st2), code: "NETWORK", state: st2 };
    }
    await clear(r.code);
    return { ok: false, code: r.code };
  }

  /** Verificação rápida usada por content scripts / background. */
  async function isLicensed() {
    var s = await getState();
    return stateIsUsable(s.state);
  }

  root.OGLicense = {
    API_BASE: API_BASE,
    STORE: STORE,
    activate: activate,
    refresh: refresh,
    isLicensed: isLicensed,
    getState: getState,
    getInstallationId: getInstallationId,
    normalizeToken: normalizeToken,
    friendly: friendly,
    clear: clear,
  };
})(typeof self !== "undefined" ? self : window);
