import cardFreeImg from "@/assets/card-free.jpg";
import cardSemanalImg from "@/assets/card-semanal.jpg";
import cardMensalImg from "@/assets/card-mensal.jpg";
import cardTrimestralImg from "@/assets/card-trimestral.jpg";

export function productImageFallback(slugValue?: unknown) {
  const slug = String(slugValue ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (slug.startsWith("msk-agent") || slug.startsWith("msk-agente")) {
    if (/^msk-agent(?:e)?-3(?:-|$)/.test(slug)) return "/agent-offers/agent-3.jpg";
    if (/^msk-agent(?:e)?-2(?:-|$)/.test(slug)) return "/agent-offers/agent-2.jpg";
    if (/^msk-agent(?:e)?-1(?:-|$)/.test(slug)) return "/agent-offers/agent-1.jpg";
    return "/agent-offers/agent-2.jpg";
  }

  if (slug.startsWith("page-cloner") || slug.includes("clonagem") || slug.includes("clonador")) {
    if (slug.includes("month") || slug.includes("mensal")) return "/cloner-offers/cloner-monthly.webp";
    if (slug.includes("week") || slug.includes("semanal")) return "/cloner-offers/cloner-weekly.webp";
    return "/cloner-offers/cloner-daily.webp";
  }

  if (slug === "free-test" || slug.includes("teste-gratis") || slug.includes("teste-gratuito")) {
    return cardFreeImg;
  }
  if (slug === "weekly" || slug.includes("semanal")) return cardSemanalImg;
  if (slug === "monthly" || slug.includes("mensal")) return cardMensalImg;
  if (slug === "quarterly" || slug.includes("trimestral")) return cardTrimestralImg;

  return "/favicon.png";
}

export function normalizeProductImage(imageValue?: unknown, slugValue?: unknown) {
  const value = String(imageValue ?? "").trim();
  const fallback = productImageFallback(slugValue);
  if (!value) return fallback;

  // Blob local não sobrevive fora da aba atual. URLs de assets do próprio projeto são preservadas.
  if (value.startsWith("blob:")) return fallback;

  if (/^https?:\/\//i.test(value) || value.startsWith("data:image/") || value.startsWith("/")) {
    return value;
  }

  return fallback;
}

/**
 * Recupera somente imagens de produto que realmente falharam no navegador.
 * Não sobrescreve mais os cards do MSK Agente: cada oferta preserva sua arte própria.
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

      const insideProductUi =
        !!target.closest("#checkout-cart") ||
        !!target.closest("[data-plan-card]") ||
        !!target.closest("[data-msk-product-image]") ||
        !!target.closest('[data-msk-security-role="checkout-scroll"]');
      if (!insideProductUi || target.dataset.mskFallbackApplied === "1") return;

      const source = String(target.getAttribute("src") ?? "");
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
