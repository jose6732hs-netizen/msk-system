import { useEffect } from "react";
import { buildWhatsappLink } from "@/lib/support-link";

const FALLBACK_NUMBER = "64999117113";
const FALLBACK_MESSAGE = "Olá! Preciso de suporte MSK SISTEM.";

/**
 * Barra global de contingência do WhatsApp.
 * Fica fixa no topo, mas reserva espaço real no layout para não cobrir
 * cabeçalhos, botões ou outras funções da interface.
 */
export function WhatsappSupportButton() {
  const link = buildWhatsappLink(FALLBACK_NUMBER, FALLBACK_MESSAGE);

  useEffect(() => {
    if (!link) return;

    const previousPaddingTop = document.body.style.paddingTop;

    const syncTopOffset = () => {
      document.body.style.paddingTop = window.innerWidth >= 768 ? "64px" : "88px";
    };

    syncTopOffset();
    window.addEventListener("resize", syncTopOffset);

    return () => {
      window.removeEventListener("resize", syncTopOffset);
      document.body.style.paddingTop = previousPaddingTop;
    };
  }, [link]);

  if (!link) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[110] border-b border-emerald-400/20 bg-[#07110b]/98 shadow-[0_10px_28px_-18px_rgba(16,185,129,0.75)] backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-[88px] w-full max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-5 md:min-h-[64px] md:gap-4 md:px-6 md:py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-300/25 bg-amber-300/10 md:h-10 md:w-10">
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]" />
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-amber-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.3 2.7 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.7a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-200 md:text-[11px]">
                Aviso de atendimento
              </span>
              <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Canal alternativo ativo
              </span>
            </div>

            <p className="mt-0.5 text-[12px] font-medium leading-snug text-white/88 sm:text-[13px] md:truncate md:text-sm">
              Nosso WhatsApp principal está temporariamente indisponível. Enquanto normalizamos o atendimento, fale com a equipe pelo número secundário.
            </p>
          </div>
        </div>

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar no WhatsApp alternativo"
          className="group inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-extrabold text-[#06150b] shadow-[0_8px_20px_-12px_rgba(37,211,102,0.9)] transition duration-200 hover:bg-[#45df7c] active:scale-[0.98] sm:px-4 sm:text-sm"
        >
          <svg viewBox="0 0 32 32" className="h-4.5 w-4.5 sm:h-5 sm:w-5" fill="currentColor" aria-hidden="true">
            <path d="M16.02 3.2c-7.06 0-12.8 5.73-12.8 12.79 0 2.25.6 4.45 1.73 6.39L3.2 28.8l6.6-1.72a12.77 12.77 0 0 0 6.22 1.59h.01c7.06 0 12.79-5.74 12.79-12.8 0-3.42-1.33-6.63-3.75-9.04a12.7 12.7 0 0 0-9.05-3.63Zm0 23.05h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.92 1.02 1.05-3.82-.25-.4a10.6 10.6 0 0 1-1.62-5.65c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.11 7.52c0 5.87-4.77 10.55-10.73 10.55Zm5.83-7.92c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.68.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.53-.71-.54l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65s1.14 3.08 1.3 3.29c.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
          </svg>
          <span className="hidden sm:inline">Falar no WhatsApp</span>
          <span className="sm:hidden">Suporte</span>
        </a>
      </div>
    </aside>
  );
}
