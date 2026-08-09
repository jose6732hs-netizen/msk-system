import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPush } from "./push.server";

const notificationSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(400),
  emoji: z.string().max(8).optional(),
  link: z.string().max(300).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  broadcast: z.boolean().optional().default(false),
  scheduleAt: z.string().datetime().optional(),
});

export const getUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // No Supabase, filtros .is("col", null) para nulos
    const { count } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { count: count ?? 0 };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { notifications: data ?? [] };
  });

export const markAsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const markAllAsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });

export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => notificationSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const title = `${data.emoji ? `${data.emoji} ` : ""}${data.title}`;
    
    let targetUserIds: string[] = [];
    if (data.broadcast) {
      const { data: users } = await supabaseAdmin.from("profiles").select("id");
      targetUserIds = users?.map(u => u.id) ?? [];
    } else if (data.userIds?.length) {
      targetUserIds = data.userIds;
    }

    if (!targetUserIds.length) throw new Error("Nenhum destinatário definido.");

    for (const uid of targetUserIds) {
      const { data: notif } = await supabaseAdmin.from("notifications").insert({
        user_id: uid,
        title,
        body: data.body,
        emoji: data.emoji ?? null,
        link: data.link ?? null,
        created_by: context.userId,
        status: "sent",
        sent_at: new Date().toISOString(),
      } as never).select("id").single();

      const { data: devices } = await supabaseAdmin
        .from("push_devices")
        .select("id,endpoint,p256dh,auth")
        .eq("user_id", uid)
        .eq("active", true as never);

      if (devices?.length) {
        for (const device of devices) {
          const res = await sendWebPush(device as any, {
            title,
            body: data.body,
            link: data.link ?? "/painel",
            tag: notif?.id || "notif",
          });
          
          if (!res.ok && res.gone) {
            await supabaseAdmin.from("push_devices").update({ active: false } as never).eq("id", device.id);
          }
        }
      }
    }

    return { ok: true, count: targetUserIds.length };
  });
