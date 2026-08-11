/** Tipos de notificação suportados pela plataforma (usado no cliente e no servidor). */
export const NOTIFICATION_KEYS = [
  "sales",
  "pix_created",
  "pix_approved",
  "sale_approved",
  "payments",
  "commissions",
  "messages",
  "campaigns",
  "updates",
  "promotions",
] as const;

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

/** Grupos exibidos ao usuário (vários eventos internos em um único interruptor). */
export const NOTIFICATION_GROUPS: {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  keys: NotificationKey[];
}[] = [
  {
    id: "sale_created",
    title: "Venda gerada",
    desc: "Aviso quando um PIX ou pedido é gerado.",
    emoji: "🧾",
    keys: ["pix_created", "payments"],
  },
  {
    id: "sale_confirmed",
    title: "Venda confirmada",
    desc: "Aviso quando o pagamento é confirmado e a comissão é liberada.",
    emoji: "✅",
    keys: ["sales", "pix_approved", "sale_approved", "commissions"],
  },
  {
    id: "support",
    title: "Suporte",
    desc: "Respostas e avisos diretos da equipe.",
    emoji: "💬",
    keys: ["messages", "updates"],
  },
  {
    id: "campaigns",
    title: "Campanhas",
    desc: "Novas campanhas, materiais e promoções.",
    emoji: "📣",
    keys: ["campaigns", "promotions"],
  },
];
