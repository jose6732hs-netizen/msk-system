export function productImageFallback(slugValue?: unknown) {
  const slug = String(slugValue ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (slug.startsWith("msk-agent") || slug.startsWith("msk-agente")) {
    if (/^msk-agent(?:e)?-3(?:-|$)/.test(slug)) return "/agent-offers/agent-3.jpg";
    if (/^msk-agent(?:e)?-2(?:-|$)/.test(slug)) return "/agent-offers/agent-2.jpg";
    if (/^msk-agent(?:e)?-1(?:-|$)/.test(slug)) return "/agent-offers/agent-1.jpg";
    return "/msk-agente-banner.svg";
  }

  if (slug.startsWith("page-cloner") || slug.includes("clonagem") || slug.includes("clonador")) {
    if (slug.includes("month") || slug.includes("mensal")) return "/cloner-offers/cloner-monthly.webp";
    if (slug.includes("week") || slug.includes("semanal")) return "/cloner-offers/cloner-weekly.webp";
    return "/cloner-offers/cloner-daily.webp";
  }

  return "/favicon.png";
}

export function normalizeProductImage(imageValue?: unknown, slugValue?: unknown) {
  const value = String(imageValue ?? "").trim();
  const fallback = productImageFallback(slugValue);
  if (!value) return fallback;

  // URLs temporárias do editor Lovable e blobs locais não sobrevivem no site publicado.
  if (value.startsWith("blob:") || value.startsWith("/__l5e/assets-v1/")) return fallback;

  if (/^https?:\/\//i.test(value) || value.startsWith("data:image/") || value.startsWith("/")) {
    return value;
  }

  return fallback;
}

/**
 * Protege cards de oferta/carrinho contra URLs de imagem que deixaram de existir.
 * O listener roda em captura para impedir handlers locais de recolocarem uma URL quebrada.
 */
function installProductImageRecovery() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const marker = "__mskProductImageRecoveryInstalled";
  const globalWindow = window as typeof window & Record<string, unknown>;
  if (globalWindow[marker]) return;
  globalWindow[marker] = true;

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;

      const source = String(target.getAttribute("src") ?? "");
      const insideProductUi =
        !!target.closest("#checkout-cart") ||
        !!target.closest("[data-plan-card]") ||
        !!target.closest("[data-msk-product-image]");
      const temporarySource = source.startsWith("blob:") || source.includes("/__l5e/assets-v1/");
      if (!insideProductUi && !temporarySource) return;
      if (target.dataset.mskFallbackApplied === "1") return;

      const fallback = productImageFallback(target.dataset.productSlug || target.alt);
      if (!fallback || source === fallback) return;

      target.dataset.mskFallbackApplied = "1";
      event.stopImmediatePropagation();
      target.src = fallback;
    },
    true,
  );
}

installProductImageRecovery();
