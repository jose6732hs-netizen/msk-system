import { useSupportLink } from "@/lib/support-link";

/**
 * Botão flutuante 3D de suporte via WhatsApp.
 * O link vem da configuração publicada pelo Super Admin.
 */
export function WhatsappSupportButton() {
  const link = useSupportLink();

  if (!link) return null;

  return (
    <>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com o suporte no WhatsApp"
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
