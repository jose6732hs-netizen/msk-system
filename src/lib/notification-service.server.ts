import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPush } from "./push.server";

export type NotificationType = 
  | "pix_created" | "pix_approved" | "sale_approved" | "sale_canceled" 
  | "commission_earned" | "withdrawal_requested" | "withdrawal_approved" | "withdrawal_rejected"
  | "new_referral" | "plan_activated" | "plan_renewed" | "plan_expiring"
  | "license_activated" | "license_expired" | "system";

const EMOJI_MAP: Record<NotificationType | string, string> = {
  pix_created: "🧾",
  pix_approved: "✅",
  sale_approved: "💰",
  sale_canceled: "⚠️",
  commission_earned: "🎉",
  withdrawal_requested: "💸",
  withdrawal_approved: "💸",
  withdrawal_rejected: "⚠️",
  new_referral: "👤",
  plan_activated: "🚀",
  plan_renewed: "🔄",
  plan_expiring: "⏳",
  license_activated: "🔑",
  license_expired: "⚠️",
  system: "🔔"
};

export async function sendProfessionalNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, any>;
}) {
  const { userId, type, title, body, link, metadata } = params;
  const emoji = EMOJI_MAP[type] || "🔔";
  const finalTitle = `${emoji} ${title}`;

  // 1. Registrar Notificação Interna
  const { data: notif, error: nErr } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    audience: "user",
    type,
    title: finalTitle,
    body,
    emoji,
    link: link || "/painel",
    metadata: (metadata || {}) as any,
    status: "pending"
  } as any).select("id").single() as any;

  if (nErr) throw nErr;

  // 2. Buscar Dispositivos Ativos
  const { data: devices } = await (supabaseAdmin as any)
    .from("push_devices")
    .select("id,endpoint,p256dh,auth,device_id")
    .eq("user_id", userId)
    .eq("active", true);

  if (!devices || devices.length === 0) {
    await supabaseAdmin.from("notifications").update({ status: "sent", sent_at: new Date().toISOString() } as any).eq("id", notif.id);
    return { internal: notif.id, push: 0 };
  }

  let sent = 0;
  let lastError: string | null = null;
  for (const device of devices) {
    const res = await sendWebPush({
      endpoint: device.endpoint,
      p256dh: device.p256dh,
      auth: device.auth
    }, {
      title: finalTitle,
      body,
      link: link || "/painel",
      notificationId: notif.id,
      tag: type
    });

    if (res.ok) sent++;
    else {
      lastError = res.error || `HTTP ${res.status}`;
      if (res.gone) {
        await (supabaseAdmin as any).from("push_devices").update({ active: false }).eq("id", device.id);
      }
    }
  }

  // Atualizar notificação original
  await supabaseAdmin.from("notifications").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    push_status: sent > 0 ? "delivered" : "failed",
    push_error: sent > 0 ? null : lastError
  } as any).eq("id", notif.id);

  return { internal: notif.id, push: sent };
}

export function getPlanEmoji(planName: string): string {
  const name = planName.toLowerCase();
  if (name.includes("pro")) return "🚀";
  if (name.includes("premium")) return "👑";
  if (name.includes("business")) return "💎";
  if (name.includes("starter")) return "🌱";
  if (name.includes("anual")) return "📅";
  return "🟢";
}
