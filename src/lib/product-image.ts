import cardFreeImg from "@/assets/card-free.jpg";
import cardSemanalImg from "@/assets/card-semanal.jpg";
import cardMensalImg from "@/assets/card-mensal.jpg";
import cardTrimestralImg from "@/assets/card-trimestral.jpg";
import dailyLicenseAsset from "@/assets/daily_license_card.jpg.asset.json";

const AGENT_BANNER_IMAGES = [
  "/images/msk-agent-banner-1.webp",
  "/images/msk-agent-banner-2.webp",
];

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
  if (slug === "daily" || slug.includes("diario") || slug.includes("diário")) return dailyLicenseAsset.url;
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
 * Preserva a arte original de cada oferta e aplica o mesmo fallback do produto em qualquer rota/carrinho.
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
        !!target.closest("[data-msk-product-image]") ||
        !!target.closest('[data-msk-security-role="checkout-scroll"]');
      const temporarySource = source.startsWith("blob:") || source.includes("/__l5e/assets-v1/");
      const fallback = productImageFallback(target.dataset.productSlug || target.alt);
      const recognizedProduct = fallback !== "/favicon.png";

      if (
        (!insideProductUi && !temporarySource && !recognizedProduct) ||
        target.dataset.mskFallbackApplied === "1"
      ) {
        return;
      }
      if (!fallback || source === fallback) return;

      // Imagens reconhecidas de produto usam o mesmo fallback em qualquer rota,
      // impedindo que o carrinho troque a arte por um banner genérico.
      if (!insideProductUi && !temporarySource && !recognizedProduct) return;

      target.dataset.mskFallbackApplied = "1";
      event.stopImmediatePropagation();
      target.src = fallback;
    },
    true,
  );
}

function syncAgentBannerCarousel() {
  if (typeof document === "undefined") return;
  const section = document.getElementById("msk-agente");
  const frame = section?.querySelector<HTMLElement>(":scope > div");
  if (!frame || frame.dataset.mskAgentBannerCarousel === "1") return;

  frame.dataset.mskAgentBannerCarousel = "1";
  const original = frame.querySelector<HTMLImageElement>(":scope > img");
  const layer = document.createElement("div");
  layer.setAttribute("aria-label", "Banners MSK Agente");
  Object.assign(layer.style, {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
  });

  const images = AGENT_BANNER_IMAGES.map((src, index) => {
    const image = document.createElement("img");
    image.src = src;
    image.alt = `MSK Agente banner ${index + 1}`;
    image.decoding = "async";
    Object.assign(image.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      opacity: index === 0 ? "1" : "0",
      transition: "opacity 700ms ease",
    });
    image.addEventListener(
      "load",
      () => {
        if (original) original.style.display = "none";
      },
      { once: true },
    );
    layer.appendChild(image);
    return image;
  });

  frame.insertBefore(layer, frame.firstChild);
  let active = 0;
  const timer = window.setInterval(() => {
    if (!frame.isConnected) {
      window.clearInterval(timer);
      return;
    }
    active = (active + 1) % images.length;
    images.forEach((image, index) => {
      image.style.opacity = index === active ? "1" : "0";
    });
  }, 5000);
}

function installAgentBannerCarousel() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const marker = "__mskAgentBannerCarouselInstalled";
  const globalWindow = window as typeof window & Record<string, unknown>;
  if (globalWindow[marker]) return;
  globalWindow[marker] = true;

  const refresh = () => window.requestAnimationFrame(syncAgentBannerCarousel);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

installProductImageRecovery();
installAgentBannerCarousel();
