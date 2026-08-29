import { useEffect } from "react";

type ScrollSnapshot = {
  scrollY: number;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverscrollBehavior: string;
};

let lockCount = 0;
let snapshot: ScrollSnapshot | null = null;

const CHECKOUT_SECURITY_STYLE_ID = "msk-checkout-security-artwork";

function ensureCheckoutSecurityArtworkStyles() {
  if (typeof document === "undefined" || document.getElementById(CHECKOUT_SECURITY_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = CHECKOUT_SECURITY_STYLE_ID;
  style.textContent = `
    [data-msk-checkout-stage="choose"] [data-msk-security-role="method-bar"]::before,
    [data-msk-checkout-stage="pix"] [data-msk-security-role="checkout-scroll"]::before,
    [data-msk-checkout-stage="pix"] [data-msk-security-role="checkout-scroll"]::after {
      content: "";
      display: block;
      box-sizing: border-box;
      background-repeat: no-repeat;
      background-position: center;
      pointer-events: none;
    }

    [data-msk-checkout-stage="choose"] [data-msk-security-role="method-bar"]::before {
      width: min(100%, 420px);
      aspect-ratio: 420 / 130;
      margin: 0 auto 12px;
      background-image: url("/images/checkout-method-security.webp");
      background-size: contain;
    }

    [data-msk-checkout-stage="pix"] [data-msk-security-role="checkout-scroll"]::before {
      width: min(calc(100% - 24px), 420px);
      aspect-ratio: 420 / 131;
      margin: 16px auto 0;
      background-image: url("/images/checkout-pix-security.webp");
      background-size: contain;
    }

    [data-msk-checkout-stage="pix"] [data-msk-security-role="checkout-scroll"]::after {
      width: min(calc(100% - 24px), 680px);
      aspect-ratio: 2.08 / 1;
      margin: 12px auto 4px;
      background-image:
        url("/images/checkout-payment-safe.webp"),
        url("/images/checkout-data-protected.webp");
      background-size: 48% auto, 48% auto;
      background-position: left center, right center;
    }

    @media (max-width: 640px) {
      [data-msk-checkout-stage="choose"] [data-msk-security-role="method-bar"]::before {
        margin-bottom: 10px;
      }

      [data-msk-checkout-stage="pix"] [data-msk-security-role="checkout-scroll"]::before {
        width: min(calc(100% - 16px), 420px);
        margin-top: 10px;
      }

      [data-msk-checkout-stage="pix"] [data-msk-security-role="checkout-scroll"]::after {
        width: calc(100% - 16px);
        margin-top: 8px;
        background-size: 49% auto, 49% auto;
      }
    }
  `;
  document.head.appendChild(style);
}

function findCheckoutRoot() {
  if (typeof document === "undefined") return null;

  const label = Array.from(document.querySelectorAll("p")).find(
    (element) => element.textContent?.trim().toLowerCase() === "checkout seguro",
  );
  const header = label?.closest("header");
  const root = header?.parentElement;
  const methodBar = header?.nextElementSibling as HTMLElement | null;
  const scroll = methodBar?.nextElementSibling as HTMLElement | null;

  if (!(root instanceof HTMLElement) || !methodBar || !scroll) return null;
  return { root, methodBar, scroll };
}

function syncCheckoutSecurityArtwork() {
  const checkout = findCheckoutRoot();
  if (!checkout) return null;

  ensureCheckoutSecurityArtworkStyles();
  const { root, methodBar, scroll } = checkout;
  methodBar.dataset['mskSecurityRole'] = "method-bar";
  scroll.dataset['mskSecurityRole'] = "checkout-scroll";

  const methodButtons = Array.from(methodBar.querySelectorAll("button"));
  const cardSelected = methodButtons[1]?.classList.contains("bg-primary") ?? false;
  const pixGenerated = Boolean(
    scroll.querySelector('[aria-label="Copiar código PIX"], [aria-label="Código PIX copiado"]'),
  );
  const paid = scroll.textContent?.includes("Pagamento confirmado") ?? false;

  root.dataset['mskCheckoutStage'] = paid ? "paid" : cardSelected ? "card" : pixGenerated ? "pix" : "choose";
  return root;
}

function lockDocumentScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  lockCount += 1;
  if (lockCount > 1) return;

  const html = document.documentElement;
  const body = document.body;
  const scrollY = window.scrollY;

  snapshot = {
    scrollY,
    htmlOverflow: html.style.overflow,
    htmlOverscrollBehavior: html.style.overscrollBehavior,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverscrollBehavior: body.style.overscrollBehavior,
  };

  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overscrollBehavior = "none";
}

function unlockDocumentScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0 || !snapshot) return;

  const html = document.documentElement;
  const body = document.body;
  const saved = snapshot;
  snapshot = null;

  html.style.overflow = saved.htmlOverflow;
  html.style.overscrollBehavior = saved.htmlOverscrollBehavior;
  body.style.overflow = saved.bodyOverflow;
  body.style.position = saved.bodyPosition;
  body.style.top = saved.bodyTop;
  body.style.left = saved.bodyLeft;
  body.style.right = saved.bodyRight;
  body.style.width = saved.bodyWidth;
  body.style.overscrollBehavior = saved.bodyOverscrollBehavior;

  window.scrollTo(0, saved.scrollY);
}

/**
 * Congela a página de fundo enquanto um modal crítico está aberto.
 * Suporta modais aninhados sem restaurar o body antes da hora.
 */
export function useModalScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lockDocumentScroll();

    const checkoutRoot = syncCheckoutSecurityArtwork();
    let observer: MutationObserver | null = null;
    let frame = 0;

    if (checkoutRoot) {
      const syncAfterRender = () => {
        if (frame) window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          syncCheckoutSecurityArtwork();
        });
      };

      observer = new MutationObserver(syncAfterRender);
      observer.observe(checkoutRoot, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "aria-label"],
      });
    }

    return () => {
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      unlockDocumentScroll();
    };
  }, [active]);
}
