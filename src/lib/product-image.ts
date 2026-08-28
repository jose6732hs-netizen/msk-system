import cardFreeImg from "@/assets/card-free.jpg";
import cardSemanalImg from "@/assets/card-semanal.jpg";
import cardMensalImg from "@/assets/card-mensal.jpg";
import cardTrimestralImg from "@/assets/card-trimestral.jpg";
import dailyLicenseAsset from "@/assets/daily_license_card.jpg.asset.json";

function isChatGptProduct(value?: unknown) {
  const hint = String(value ?? "").trim().toLowerCase();
  return (
    hint.includes("chatgpt") ||
    hint.includes("chat-gpt") ||
    hint.includes("gpt-plus") ||
    hint.includes("gpt plus")
  );
}

function cachedChatGptImage() {
  if (typeof window === "undefined") return "";
  const globalWindow = window as typeof window & { __mskChatGptProductImage?: string };
  return String(globalWindow.__mskChatGptProductImage ?? "").trim();
}

export function productImageFallback(slugValue?: unknown) {
  const slug = String(slugValue ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (isChatGptProduct(slug)) {
    return cachedChatGptImage() || "/favicon.png";
  }

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
  const canonicalChatGpt = isChatGptProduct(slugValue) ? cachedChatGptImage() : "";
  if (canonicalChatGpt) return canonicalChatGpt;

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
 * Mantém a arte original configurada no CMS para o produto ChatGPT em qualquer
 * ponto da interface, inclusive carrinho e componentes que usam fallback local.
 */
async function installChatGptArtworkSync() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const marker = "__mskChatGptArtworkSyncInstalled";
  const globalWindow = window as typeof window & Record<string, unknown> & {
    __mskChatGptProductImage?: string;
  };
  if (globalWindow[marker]) return;
  globalWindow[marker] = true;

  try {
    const { getCmsContent } = await import("./cms.functions");
    const settings = (await getCmsContent()) as any;
    const canonical = String(settings?.site_images?.plans_chatgpt_card ?? "").trim();
    if (!canonical) return;

    globalWindow.__mskChatGptProductImage = canonical;

    const apply = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        const hint = image.dataset.productSlug || image.alt || "";
        if (!isChatGptProduct(hint)) return;
        if (image.getAttribute("src") === canonical) return;
        image.dataset.mskCanonicalProductImage = "1";
        image.src = canonical;
      });
    };

    apply();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLImageElement) {
          const image = mutation.target;
          const hint = image.dataset.productSlug || image.alt || "";
          if (isChatGptProduct(hint) && image.getAttribute("src") !== canonical) image.src = canonical;
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) {
            const hint = node.dataset.productSlug || node.alt || "";
            if (isChatGptProduct(hint) && node.getAttribute("src") !== canonical) node.src = canonical;
          } else if (node instanceof Element) {
            apply(node);
          }
        });
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
  } catch {
    // Se o CMS estiver temporariamente indisponível, preserva a imagem já renderizada.
  }
}

/** Recupera somente imagens reconhecidas de produto que realmente falharam. */
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

      const productHint = String(target.dataset.productSlug || target.alt || "").toLowerCase();
      if (isChatGptProduct(productHint)) {
        const canonical = cachedChatGptImage();
        if (canonical && target.getAttribute("src") !== canonical) target.src = canonical;
        return;
      }

      const source = String(target.getAttribute("src") ?? "");
      const insideProductUi =
        !!target.closest("#checkout-cart") ||
        !!target.closest("[data-plan-card]") ||
        !!target.closest("[data-msk-product-image]") ||
        !!target.closest('[data-msk-security-role="checkout-scroll"]');
      const temporarySource = source.startsWith("blob:") || source.includes("/__l5e/assets-v1/");
      const fallback = productImageFallback(productHint);
      const recognizedProduct = fallback !== "/favicon.png";

      if (
        (!insideProductUi && !temporarySource && !recognizedProduct) ||
        target.dataset.mskFallbackApplied === "1"
      ) {
        return;
      }
      if (!fallback || source === fallback) return;
      if (!insideProductUi && !temporarySource && !recognizedProduct) return;

      target.dataset.mskFallbackApplied = "1";
      event.stopImmediatePropagation();
      target.src = fallback;
    },
    true,
  );
}

/**
 * No mobile o checkout convive com o header e com a navegação fixa inferior.
 * Mantém cabeçalho/total acessíveis e deixa apenas a lista de produtos rolar.
 */
function installMobileCheckoutNavigationFix() {
  if (typeof document === "undefined") return;
  const styleId = "msk-mobile-checkout-navigation-fix";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @media (max-width: 767px) {
      #checkout-cart {
        display: flex !important;
        flex-direction: column !important;
        max-height: calc(100dvh - 7.25rem - env(safe-area-inset-bottom, 0px)) !important;
        overflow: hidden !important;
        scroll-margin-top: 4.25rem;
        scroll-margin-bottom: 4.75rem;
      }

      #checkout-cart > :first-child,
      #checkout-cart > :last-child {
        flex: 0 0 auto;
      }

      #checkout-cart > :nth-child(2) {
        min-height: 0 !important;
        max-height: none !important;
        flex: 1 1 auto !important;
        overflow-y: auto !important;
        overscroll-behavior-y: contain;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
        scrollbar-gutter: stable;
      }

      #checkout-cart > :last-child {
        position: relative;
        z-index: 3;
        box-shadow: 0 -14px 32px rgba(0, 0, 0, .48);
      }
    }
  `;
  document.head.appendChild(style);
}

installProductImageRecovery();
installMobileCheckoutNavigationFix();
void installChatGptArtworkSync();
