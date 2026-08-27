import { Phone } from "lucide-react";
import { useSupportLink } from "@/lib/support-link";

/**
 * Bolinha global de suporte via WhatsApp.
 * O número vem da configuração publicada no Super Admin.
 */
export function WhatsappSupportButton() {
  const href = useSupportLink();

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Suporte via WhatsApp"
      className="fixed bottom-24 right-4 z-40 grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-600 md:right-6"
    >
      <Phone className="h-5 w-5" />
    </a>
  );
}
