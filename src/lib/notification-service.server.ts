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

  // 1. Verificar preferências
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("notification_preferences")
    .eq("id", userId)
    .single();
  
  const prefs = (profile?.notification_preferences as Record<string, boolean>) || {};
  if (prefs[type] === false) return { skipped: true, reason: "preference_off" };

  // 2. Registrar Notificação Interna
  const { data: notif, error: nErr } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type,
    title: finalTitle,
    body,
    emoji,
    link: link || "/painel",
    data: metadata || {},
    status: "pending"
  } as any).select("id").single();

  if (nErr) throw nErr;

  // 3. Buscar Dispositivos Ativos
  const { data: devices } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!devices || devices.length === 0) return { internal: notif.id, push: 0 };

  let sent = 0;
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

    // Registrar Log
    await supabaseAdmin.from("push_notification_logs").insert({
      notification_id: notif.id,
      user_id: userId,
      device_id: device.device_id,
      status: res.ok ? "delivered" : "failed",
      error_message: res.ok ? null : (res.error || `HTTP ${res.status}`),
      sent_at: new Date().toISOString()
    } as any);

    if (res.ok) sent++;
    else if (res.gone) {
      await supabaseAdmin.from("push_subscriptions").update({ is_active: false }).eq("id", device.id);
    }
  }

  // Atualizar notificação original
  await supabaseAdmin.from("notifications").update({
    push_sent: sent > 0,
    push_sent_at: sent > 0 ? new Date().toISOString() : null,
    status: "sent"
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
