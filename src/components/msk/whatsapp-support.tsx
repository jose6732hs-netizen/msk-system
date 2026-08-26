import { buildWhatsappLink } from "@/lib/support-link";

const FALLBACK_NUMBER = "64999117113";
const FALLBACK_MESSAGE = "Olá! Preciso de suporte MSK SISTEM.";

/**
 * Aviso global de contingência + atalho flutuante para o WhatsApp secundário.
 * Enquanto o canal principal estiver indisponível, o atendimento é direcionado
 * para o número alternativo em todas as etapas do site.
 */
export function WhatsappSupportButton() {
  const link = buildWhatsappLink(FALLBACK_NUMBER, FALLBACK_MESSAGE);
  if (!link) return null;

  return (
    <>
      <aside
        role="status"
        aria-live="polite"
        className="fixed left-1/2 top-3 z-[120] w-[calc(100%-1.25rem)] max-w-3xl -translate-x-1/2 overflow-hidden rounded-2xl border-2 border-emerald-400/60 bg-[#07120c]/95 shadow-[0_22px_70px_-24px_rgba(16,185,129,0.75)] backdrop-blur-xl md:top-5"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-lime-300 to-emerald-500" />

        <div className="flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center md:gap-5">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <span className="relative mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/40 bg-amber-400/10 shadow-[inset_0_0_18px_rgba(251,191,36,0.08)]">
              <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.95)]" />
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.3 2.7 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.7a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </span>

            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">
                  Aviso importante
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                  Canal alternativo ativo
                </span>
              </div>

              <h2 className="text-base font-bold leading-tight text-white sm:text-lg">
                Nosso WhatsApp principal está temporariamente indisponível
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-white/72 sm:text-sm">
                Devido ao alto volume de atendimentos, estamos direcionando o suporte para um número secundário. Para não ficar sem atendimento, fale com nossa equipe pelo canal alternativo abaixo.
              </p>
            </div>
          </div>

          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-extrabold text-[#06150b] shadow-[0_12px_28px_-12px_rgba(37,211,102,0.95)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#42e27d] active:translate-y-0 md:min-w-[210px]"
            aria-label="Falar agora no WhatsApp alternativo"
          >
            <svg viewBox="0 0 32 32" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M16.02 3.2c-7.06 0-12.8 5.73-12.8 12.79 0 2.25.6 4.45 1.73 6.39L3.2 28.8l6.6-1.72a12.77 12.77 0 0 0 6.22 1.59h.01c7.06 0 12.79-5.74 12.79-12.8 0-3.42-1.33-6.63-3.75-9.04a12.7 12.7 0 0 0-9.05-3.63Zm0 23.05h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.92 1.02 1.05-3.82-.25-.4a10.6 10.6 0 0 1-1.62-5.65c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.11 7.52c0 5.87-4.77 10.55-10.73 10.55Zm5.83-7.92c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.68.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.53-.71-.54l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65s1.14 3.08 1.3 3.29c.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
            </svg>
            <span>Falar no WhatsApp agora</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </a>
        </div>

        <div className="border-t border-white/8 bg-white/[0.035] px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50 sm:text-[11px]">
          Atendimento temporário pelo número (64) 99911-7113 • mensagem de suporte preenchida automaticamente
        </div>
      </aside>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com o suporte no WhatsApp alternativo"
        className="group fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-3 z-[105] md:bottom-8 md:right-8"
      >
        <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[#25D366]/30" />
        <span
          className="relative grid h-14 w-14 place-items-center rounded-full border border-white/25 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-active:translate-y-0 md:h-16 md:w-16"
          style={{
            background: "linear-gradient(145deg, #4ef08a 0%, #25D366 45%, #0f7a3d 100%)",
            boxShadow:
              "0 18px 32px -12px rgba(37,211,102,0.65), inset 0 2px 6px rgba(255,255,255,0.55), inset 0 -6px 12px rgba(0,0,0,0.35)",
            transformStyle: "preserve-3d",
          }}
        >
          <span
            className="absolute left-2 right-2 top-1.5 h-4 rounded-full opacity-70 blur-[2px]"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.85), transparent)" }}
          />
          <svg viewBox="0 0 32 32" className="relative h-7 w-7 drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] md:h-8 md:w-8" fill="#fff" aria-hidden="true">
            <path d="M16.02 3.2c-7.06 0-12.8 5.73-12.8 12.79 0 2.25.6 4.45 1.73 6.39L3.2 28.8l6.6-1.72a12.77 12.77 0 0 0 6.22 1.59h.01c7.06 0 12.79-5.74 12.79-12.8 0-3.42-1.33-6.63-3.75-9.04a12.7 12.7 0 0 0-9.05-3.63Zm0 23.05h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.92 1.02 1.05-3.82-.25-.4a10.6 10.6 0 0 1-1.62-5.65c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.11 7.52c0 5.87-4.77 10.55-10.73 10.55Zm5.83-7.92c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.68.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.53-.71-.54l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65s1.14 3.08 1.3 3.29c.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
          </svg>
        </span>
      </a>
    </>
  );
}
