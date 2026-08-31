import { useQuery } from "@tanstack/react-query";
import { getCmsContent } from "@/lib/cms.functions";

const DEFAULT_SUPPORT_WHATSAPP = "64999117113";

/** Monta o link do WhatsApp de suporte a partir do número/URL configurado no Super Admin. */
export function buildWhatsappLink(raw?: string | null, message?: string) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const text = encodeURIComponent(message ?? "Olá! Preciso de suporte MSK SISTEM.");

  if (/^https?:\/\//i.test(value)) {
    // Suporte deve abrir conversa direta. Convites de grupo antigos são ignorados.
    if (/^https?:\/\/chat\.whatsapp\.com\//i.test(value)) {
      return `https://wa.me/${DEFAULT_SUPPORT_WHATSAPP}?text=${text}`;
    }
    return value.includes("text=") ? value : `${value}${value.includes("?") ? "&" : "?"}text=${text}`;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${text}`;
}

/** Hook global: retorna sempre um contato direto de suporte, nunca convite de grupo. */
export function useSupportLink(message?: string) {
  const { data } = useQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCmsContent(),
    staleTime: 5 * 60 * 1000,
  });

  const config = (data as Record<string, any> | undefined)?.["config"] ?? {};
  const configured = config.support_whatsapp || config.support_phone || config.support_number;
  return buildWhatsappLink(configured || DEFAULT_SUPPORT_WHATSAPP, message);
}
