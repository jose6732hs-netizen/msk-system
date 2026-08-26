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
    return () => unlockDocumentScroll();
  }, [active]);
}
