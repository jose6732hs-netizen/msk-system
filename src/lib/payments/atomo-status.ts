/**
 * Vocabulário oficial de status da AtomoPay.
 * Mantemos a grafia EXATA devolvida pela API (inclusive "prossessing", que é
 * como a documentação oficial escreve) em `provider_status`, e mapeamos para
 * um status interno separado. Módulo puro — pode ser importado no cliente.
 */
export const ATOMO_STATUSES = [
  "waiting_payment",
  "prossessing",
  "processing",
  "authorized",
  "paid",
  "refused",
  "antifraud",
  "refunded",
  "chargedback",
] as const;

export type AtomoStatus = (typeof ATOMO_STATUSES)[number];

/** Status interno do MSK (mesmo dicionário já usado em transactions.status). */
export type InternalStatus =
  | "PENDING"
  | "PROCESSING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CHARGED_BACK"
  | "UNKNOWN";

const MAP: Record<string, InternalStatus> = {
  waiting_payment: "PENDING",
  pending: "PENDING",
  prossessing: "PROCESSING",
  processing: "PROCESSING",
  authorized: "AUTHORIZED",
  paid: "PAID",
  approved: "PAID",
  refused: "FAILED",
  antifraud: "FAILED",
  refunded: "REFUNDED",
  chargedback: "CHARGED_BACK",
  chargeback: "CHARGED_BACK",
};

/** Converte o status bruto da AtomoPay no status interno. */
export function mapAtomoStatus(raw: string | null | undefined): InternalStatus {
  const key = String(raw ?? "").trim().toLowerCase();
  return MAP[key] ?? "UNKNOWN";
}

/** Mensagem amigável ao comprador — nunca expõe regra de antifraude/adquirente. */
export function atomoStatusMessage(raw: string | null | undefined): string {
  switch (mapAtomoStatus(raw)) {
    case "PAID":
      return "Pagamento aprovado.";
    case "AUTHORIZED":
      return "Pagamento autorizado. Finalizando confirmação...";
    case "PROCESSING":
      return "Estamos processando seu pagamento...";
    case "PENDING":
      return "Aguardando pagamento.";
    case "REFUNDED":
      return "Pagamento reembolsado.";
    case "CHARGED_BACK":
      return "Pagamento contestado.";
    case "FAILED":
      return String(raw).toLowerCase() === "antifraud"
        ? "O pagamento não pôde ser autorizado."
        : "Não foi possível aprovar este cartão. Confira os dados ou tente outro meio de pagamento.";
    default:
      return "Não foi possível processar o pagamento.";
  }
}

export const ATOMO_TERMINAL: InternalStatus[] = [
  "PAID",
  "FAILED",
  "REFUNDED",
  "CHARGED_BACK",
];

/** Mascara PAN mantendo apenas BIN + 4 últimos (para logs/erros). */
export function maskPan(pan: string | null | undefined) {
  const digits = String(pan ?? "").replace(/\D+/g, "");
  if (digits.length < 8) return "****";
  return `${digits.slice(0, 6)}${"*".repeat(Math.max(0, digits.length - 10))}${digits.slice(-4)}`;
}

/** Bandeira aproximada a partir do BIN (dado NÃO sensível). */
export function cardBrand(pan: string | null | undefined) {
  const d = String(pan ?? "").replace(/\D+/g, "");
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^(4011|4312|4389|5041|5067|6277|6362|6363|650)/.test(d)) return "elo";
  if (/^(38|60)/.test(d)) return "hipercard";
  return "unknown";
}
