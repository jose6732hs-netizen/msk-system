/* OFERROLGARCIA — Núcleo de Licenciamento (MSK SUIT)
 * Compartilhado entre background service worker, tela de licença e content scripts.
 * © 2026 Reginaldo Ferrol. */
(function (root) {
  "use strict";

  var API_BASE = "https://msksystem.online";
  var EP = {
    validate: API_BASE + "/api/public/license/validate",
    heartbeat: API_BASE + "/api/public/license/heartbeat",
  };

  var STORE = {
    token: "og_license_token",
    email: "og_license_email",
    state: "og_license_state",
    install: "og_installation_id",
  };

  var REVALIDATE_MS = 60 * 1000; // servidor a cada minuto; expiração local é imediata
  var GRACE_MS = 6 * 60 * 60 * 1000; // tolerância offline nunca ultrapassa expires_at

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
    NO_TOKEN: "Insira uma licença válida para continuar.",
    LICENSE_INACTIVE: "Esta licença não está ativa no momento.",
    LICENSE_INVALID: "Token inválido. Confira os caracteres e tente novamente.",
    LICENSE_EXPIRED: "Esta licença expirou. Renove para continuar usando.",
    LICENSE_REVOKED: "Esta licença foi bloqueada pelo suporte.",
    REAUTH_REQUIRED: "Acesso revogado. Insira um novo token válido.",
    DEVICE_NOT_REGISTERED: "Limite de dispositivos atingido para esta licença.",
    DEVICE_LIMIT: "Limite de dispositivos atingido para esta licença.",
    RATE_LIMITED: "Muitas tentativas. Aguarde alguns segundos.",
    INVALID_REQUEST: "Token com formato inválido.",
    EMAIL_MISMATCH: "Este e-mail não corresponde ao dono desta licença.",
    LICENSE_PRODUCT_MISMATCH: "Esta licença não é válida para esta extensão.",
    LICENSE_SERVICE_UNAVAILABLE: "Servidor de licenças indisponível. Tente novamente em instantes.",
    NETWORK: "Sem conexão com o servidor de licenças. Verifique sua internet.",
  };

  function friendly(code) {
    return ERRORS[code] || "Não foi possível validar a licença (" + (code || "erro") + ").";
  }

  function isExpired(state) {
    if (!state || !state.expires_at) return false;
    var end = Date.parse(state.expires_at);
    return Number.isFinite(end) && end <= Date.now();
  }

  function stateIsUsable(state) {
    if (!state || !state.valid) return false;
    if (isExpired(state)) return false;
    if (state.offlineSince && Date.now() - state.offlineSince > GRACE_MS) return false;
    return true;
  }

  /** Chama o servidor. mode: 'validate' | 'heartbeat' */
  async function callServer(token, mode, email) {
    var installation_id = await getInstallationId();
    if (!email) {
      var saved = await get([STORE.email]);
      email = saved[STORE.email] || "";
    }
    var body = {
      token: normalizeToken(token),
      email: String(email || "").trim().toLowerCase() || undefined,
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
    return { ok: false, code: data.code || data.error || "LICENSE_INVALID", data: data };
  }

  async function getState() {
    var v = await get([STORE.state, STORE.token]);
    return { state: v[STORE.state] || null, token: v[STORE.token] || "" };
  }

  async function saveValid(token, data, email) {
    var state = {
      valid: true,
      checkedAt: Date.now(),
      offlineSince: 0,
      plan: (data && (data.plan || (data.license && data.license.plan))) || null,
      plan_name:
        (data && (data.plan_name || data.planName || (data.license && data.license.plan_name))) || null,
      expires_at:
        (data && (data.expires_at || data.expiresAt || (data.license && data.license.expires_at))) || null,
      features: (data && (data.features || (data.license && data.license.features))) || null,
      status: (data && data.status) || "ACTIVE",
    };
    state.activated_at =
      (data && (data.activated_at || (data.license && data.license.activated_at))) || null;
    var o = {};
    o[STORE.state] = state;
    o["OG_LICENSE_STATE"] = state;
    o[STORE.token] = normalizeToken(token);
    if (email) o[STORE.email] = String(email).trim().toLowerCase();
    await set(o);
    return state;
  }

  async function clear(reason, previousState) {
    var o = {};
    var dead = {
      valid: false,
      reason: reason || "cleared",
      checkedAt: Date.now(),
      expires_at: previousState && previousState.expires_at ? previousState.expires_at : null,
    };
    o[STORE.state] = dead;
    o["OG_LICENSE_STATE"] = dead;
    await set(o);
    return dead;
  }

  /** Ativa um token digitado pelo usuário. */
  async function activate(token, email) {
    var t = normalizeToken(token);
    if (t.length < 8) return { ok: false, message: "Digite a licença completa." };
    var mail = String(email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail))
      return { ok: false, message: "Informe o e-mail da sua conta MSK." };
    var r = await callServer(t, "validate", mail);
    if (r.ok) {
      var st = await saveValid(t, r.data, mail);
      if (isExpired(st)) {
        await clear("LICENSE_EXPIRED", st);
        return { ok: false, code: "LICENSE_EXPIRED", message: friendly("LICENSE_EXPIRED") };
      }
      return { ok: true, state: st };
    }
    if (r.offline) return { ok: false, code: "NETWORK", message: friendly("NETWORK") };
    return { ok: false, code: r.code, message: friendly(r.code) };
  }

  /** Revalida silenciosamente o token salvo. */
  async function refresh(force) {
    var s = await getState();
    if (!s.token) {
      await clear("NO_TOKEN", s.state);
      return { ok: false, code: "NO_TOKEN" };
    }

    // O vencimento local tem prioridade absoluta sobre cache/offline.
    if (isExpired(s.state)) {
      await clear("LICENSE_EXPIRED", s.state);
      return { ok: false, code: "LICENSE_EXPIRED", state: s.state };
    }

    if (!force && s.state && s.state.checkedAt && Date.now() - s.state.checkedAt < REVALIDATE_MS) {
      var usable = stateIsUsable(s.state);
      return {
        ok: usable,
        cached: true,
        state: s.state,
        code: usable ? null : (isExpired(s.state) ? "LICENSE_EXPIRED" : "LICENSE_INACTIVE"),
      };
    }

    var r = await callServer(s.token, "heartbeat");
    if (r.ok) {
      var st = await saveValid(s.token, r.data);
      if (isExpired(st)) {
        await clear("LICENSE_EXPIRED", st);
        return { ok: false, code: "LICENSE_EXPIRED", state: st };
      }
      return { ok: true, state: st };
    }

    if (r.offline) {
      var st2 = s.state || {};
      if (isExpired(st2)) {
        await clear("LICENSE_EXPIRED", st2);
        return { ok: false, code: "LICENSE_EXPIRED", state: st2 };
      }
      st2.offlineSince = st2.offlineSince || Date.now();
      var o = {};
      o[STORE.state] = st2;
      o["OG_LICENSE_STATE"] = st2;
      await set(o);
      return { ok: stateIsUsable(st2), code: "NETWORK", state: st2 };
    }

    await clear(r.code, s.state);
    return { ok: false, code: r.code, state: s.state };
  }

  /** Verificação rápida usada por content scripts / background. */
  async function isLicensed() {
    var s = await getState();
    if (isExpired(s.state)) {
      await clear("LICENSE_EXPIRED", s.state);
      return false;
    }
    return stateIsUsable(s.state);
  }

  root.OGLicense = {
    API_BASE: API_BASE,
    STORE: STORE,
    activate: activate,
    refresh: refresh,
    isLicensed: isLicensed,
    isExpired: isExpired,
    getState: getState,
    getInstallationId: getInstallationId,
    normalizeToken: normalizeToken,
    friendly: friendly,
    clear: clear,
  };
})(typeof self !== "undefined" ? self : window);
