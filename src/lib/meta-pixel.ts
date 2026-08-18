/** Meta Pixel (Facebook) — carregado em todas as etapas do site. */
export const META_PIXEL_ID = "1473326273695938";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void };
    _fbq?: unknown;
  }
}

let loaded = false;

export function initMetaPixel() {
  if (typeof window === "undefined" || loaded) return;
  loaded = true;
  // O snippet base já é injetado no <head> do site; evita init/PageView duplicados.
  if (window.fbq) return;

  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s?.parentNode?.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  const fbq = (window as Window).fbq as ((...args: unknown[]) => void) | undefined;
  fbq?.("init", META_PIXEL_ID);
  fbq?.("track", "PageView");
}

/** Evento padrão do Meta (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase...). */
export function pixelTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  initMetaPixel();
  if (params) window.fbq?.("track", event, params);
  else window.fbq?.("track", event);
}

/** Evento customizado. */
export function pixelTrackCustom(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  initMetaPixel();
  window.fbq?.("trackCustom", event, params ?? {});
}
