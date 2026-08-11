/** Tipos de notificação suportados pela plataforma (usado no cliente e no servidor). */
export const NOTIFICATION_KEYS = [
  "sales",
  "payments",
  "commissions",
  "messages",
  "campaigns",
  "updates",
  "promotions",
] as const;

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
