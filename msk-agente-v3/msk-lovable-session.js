(() => {
  "use strict";

  let capturedToken = "";
  let capturedProjectId = "";

  const projectIdFromUrl = value => {
    try {
      const match = String(value || "").match(/\/projects\/([0-9a-fA-F-]{36})/i);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  };

  const currentProjectId = () => projectIdFromUrl(location.pathname);

  const emitSession = (token, projectId, force = false) => {
    const normalizedToken = String(token || "").replace(/^Bearer\s+/i, "").trim();
    const normalizedProjectId = String(projectId || currentProjectId() || "").trim();
    let changed = false;

    if (normalizedToken && normalizedToken !== capturedToken) {
      capturedToken = normalizedToken;
      changed = true;
    }
    if (normalizedProjectId && normalizedProjectId !== capturedProjectId) {
      capturedProjectId = normalizedProjectId;
      changed = true;
    }

    if (!force && !changed) return;
    if (!capturedToken) return;

    window.postMessage({
      type: "MSK_LOVABLE_SESSION_FOUND",
      token: capturedToken,
      projectId: normalizedProjectId || capturedProjectId || currentProjectId()
    }, "*");
  };

  const readSupabaseToken = () => {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token || "";
        if (typeof token === "string" && token.length > 20) {
          capturedToken = token.replace(/^Bearer\s+/i, "").trim();
          const id = currentProjectId();
          if (id) emitSession(capturedToken, id, true);
          return capturedToken;
        }
      }
    } catch {}
    return "";
  };

  window.addEventListener("message", event => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === "MSK_LOVABLE_SESSION_REQUEST") {
      if (!capturedToken) readSupabaseToken();
      emitSession(capturedToken, currentProjectId() || capturedProjectId, true);
    }
  });

  try {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      try {
        const input = args[0];
        const init = args[1] || {};
        const url = typeof input === "string" ? input : (input?.url || "");
        let auth = "";
        if (input instanceof Request) auth = input.headers?.get?.("authorization") || "";
        if (init.headers instanceof Headers) auth = init.headers.get("authorization") || auth;
        else if (init.headers && typeof init.headers === "object") auth = init.headers.Authorization || init.headers.authorization || auth;
        if (/^Bearer\s+/i.test(auth)) emitSession(auth, projectIdFromUrl(url));
      } catch {}
      return originalFetch.apply(this, args);
    };
  } catch {}

  try {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__mskLovableUrl = url;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      try {
        if (String(name || "").toLowerCase() === "authorization" && /^Bearer\s+/i.test(String(value || ""))) {
          emitSession(value, projectIdFromUrl(this.__mskLovableUrl));
        }
      } catch {}
      return originalSetRequestHeader.apply(this, arguments);
    };
  } catch {}

  readSupabaseToken();
  window.setInterval(() => {
    const id = currentProjectId();
    if (!capturedToken) readSupabaseToken();
    if (capturedToken && id && id !== capturedProjectId) emitSession(capturedToken, id, true);
  }, 1500);
})();
