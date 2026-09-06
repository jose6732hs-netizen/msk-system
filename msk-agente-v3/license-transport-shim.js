/* MSK license transport shim — somente conectividade, sem alterar autorização. */
const MSK_LICENSE_PRIMARY_ORIGIN = "https://msksystem.online";
const MSK_LICENSE_FALLBACK_ORIGINS = [
  "https://msk-system.lovable.app",
  "https://msk-sistem.lovable.app",
];
const MSK_LICENSE_PATHS = new Set([
  "/api/public/license/validate",
  "/api/public/agent/license/validate",
  "/api/public/license/heartbeat",
  "/api/public/agent/license/heartbeat",
]);
const nativeFetch = globalThis.fetch.bind(globalThis);

function mskLicenseUrl(value) {
  try {
    const raw = typeof value === "string" || value instanceof URL ? String(value) : value?.url;
    const url = new URL(raw);
    return url.origin === MSK_LICENSE_PRIMARY_ORIGIN && MSK_LICENSE_PATHS.has(url.pathname) ? url : null;
  } catch (_) {
    return null;
  }
}

function mskShouldFallback(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function mskFallbackLicenseFetch(url, init, requestClone) {
  let lastError = null;
  for (const origin of MSK_LICENSE_FALLBACK_ORIGINS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
      const target = `${origin}${url.pathname}${url.search}`;
      let response;
      if (requestClone) {
        const headers = new Headers(requestClone.headers);
        response = await nativeFetch(new Request(target, {
          method: requestClone.method,
          headers,
          body: ["GET", "HEAD"].includes(requestClone.method) ? undefined : await requestClone.clone().arrayBuffer(),
          cache: requestClone.cache,
          credentials: requestClone.credentials,
          redirect: requestClone.redirect,
          signal: controller.signal,
        }));
      } else {
        response = await nativeFetch(target, { ...(init || {}), signal: controller.signal });
      }
      // 4xx da rota oficial é decisão do servidor e não deve ser contornada.
      if (!mskShouldFallback(response.status)) return response;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("MSK_LICENSE_BACKENDS_UNAVAILABLE");
}

globalThis.fetch = async (input, init) => {
  const url = mskLicenseUrl(input);
  if (!url) return nativeFetch(input, init);

  let requestClone = null;
  if (typeof Request !== "undefined" && input instanceof Request) {
    try { requestClone = input.clone(); } catch (_) {}
  }

  try {
    const primary = await nativeFetch(input, init);
    if (!mskShouldFallback(primary.status)) return primary;
    try {
      return await mskFallbackLicenseFetch(url, init, requestClone);
    } catch (_) {
      return primary;
    }
  } catch (primaryError) {
    try {
      return await mskFallbackLicenseFetch(url, init, requestClone);
    } catch (_) {
      throw primaryError;
    }
  }
};
