import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

/** Chave pública para o navegador criar a subscription (não é segredo). */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getVapidKeys } = await import("./push-config.server");
  const keys = await getVapidKeys();
  return { publicKey: keys?.publicKey ?? null };
});

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(10).max(400),
  auth: z.string().min(4).max(200),
  deviceId: z.string().min(4).max(120),
  browser: z.string().max(80).optional(),
  platform: z.string().max(80).optional(),
  userAgent: z.string().max(400).optional(),
});

export const registerPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subscriptionSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("push_devices").upsert(
      {
        user_id: context.userId,
        device_id: data.deviceId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        browser: data.browser ?? null,
        platform: data.platform ?? null,
        user_agent: data.userAgent ?? null,
        active: true,
        last_active_at: new Date().toISOString(),
      } as never,
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyPushDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("push_devices")
      .select("id,device_id,browser,platform,active,last_active_at,created_at")
      .eq("user_id", context.userId)
      .order("last_active_at", { ascending: false });
    return { devices: data ?? [] };
  });

/* ------------------------------ Admin / Testes ----------------------------- */

export const adminPushConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getVapidKeys } = await import("./push-config.server");
    const keys = await getVapidKeys();
    return {
      configured: !!keys,
      source: keys?.source ?? null,
      publicKey: keys?.publicKey ?? null,
      subject: keys?.subject ?? null,
    };
  });

export const adminSaveVapidKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        publicKey: z.string().min(40).max(200),
        privateKey: z.string().min(40).max(500),
        subject: z.string().max(160).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveVapidKeys } = await import("./push-config.server");
    return saveVapidKeys({ publicKey: data.publicKey, privateKey: data.privateKey, subject: data.subject ?? "" });
  });

export const adminGenerateVapidKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { generateVapidPair } = await import("./push-config.server");
    return generateVapidPair();
  });

export const adminTestVapid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { testVapidConnection } = await import("./push-config.server");
    return testVapidConnection();
  });

export const adminSendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(400),
        emoji: z.string().max(8).optional(),
        link: z.string().max(300).optional(),
        target: z.enum(["me", "all"]).default("me"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWebPush } = await import("./push.server");

    let query = supabaseAdmin
      .from("push_devices")
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("active", true as never);
    if (data.target === "me") query = query.eq("user_id", context.userId as never);
    const { data: devices } = await query;

    const list = (devices ?? []) as unknown as {
      id: string;
      user_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }[];
    if (!list.length) return { sent: 0, failed: 0, message: "Nenhum dispositivo inscrito para este alvo." };

    const title = `${data.emoji ? `${data.emoji} ` : ""}${data.title}`;
    let sent = 0;
    let failed = 0;

    for (const device of list) {
      const res = await sendWebPush(device, {
        title,
        body: data.body,
        link: data.link ?? "/painel",
        tag: "teste-push",
      });
      if (res.ok) sent++;
      else {
        failed++;
        if (res.gone) await supabaseAdmin.from("push_devices").update({ active: false } as never).eq("id", device.id);
      }

      await supabaseAdmin.from("notifications").insert({
        user_id: device.user_id,
        audience: "user",
        type: "push",
        title,
        body: data.body,
        emoji: data.emoji ?? null,
        link: data.link ?? "/painel",
        status: res.ok ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        push_status: res.ok ? "delivered" : `http_${res.status}`,
        push_error: res.ok ? null : (res.error ?? null),
        created_by: context.userId,
        metadata: { test: true },
      } as never);
    }

    return { sent, failed, message: `${sent} enviada(s), ${failed} falha(s).` };
  });

export const adminSentNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rows }, { count: devices }] = await Promise.all([
      supabaseAdmin
        .from("notifications")
        .select("id,title,body,type,status,push_status,push_error,created_at,user_id")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).eq("active", true as never),
    ]);
    const list = (rows ?? []) as unknown as {
      id: string;
      title: string;
      body: string;
      type: string;
      status: string;
      push_status: string | null;
      push_error: string | null;
      created_at: string;
      user_id: string | null;
    }[];
    return {
      notifications: list,
      devices: devices ?? 0,
      totalSent: list.filter((n) => n.status === "sent").length,
      totalFailed: list.filter((n) => n.status === "failed").length,
    };
  });
