import { useQuery } from "@tanstack/react-query";
import { getCmsContent } from "@/lib/cms.functions";

/** Monta o link do WhatsApp de suporte a partir do número/URL configurado no Super Admin. */
export function buildWhatsappLink(raw?: string | null, message?: string) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const text = encodeURIComponent(message ?? "Olá! Preciso de suporte MSK SISTEM.");

  if (/^https?:\/\//i.test(value)) {
    return value.includes("text=") ? value : `${value}${value.includes("?") ? "&" : "?"}text=${text}`;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${text}`;
}

/** Hook global: retorna o link de suporte publicado (ou null quando não configurado). */
export function useSupportLink(message?: string) {
  const { data } = useQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCmsContent(),
    staleTime: 5 * 60 * 1000,
  });

  const config = (data as Record<string, any> | undefined)?.["config"] ?? {};
  return buildWhatsappLink(config.support_whatsapp || config.support_url, message);
}
