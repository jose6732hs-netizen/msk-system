import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

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

const prefsSchema = z.object(
  Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, z.boolean().optional()])) as Record<
    NotificationKey,
    z.ZodOptional<z.ZodBoolean>
  >,
);

/** Preferências de notificação do usuário logado (cria o registro se não existir). */
export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (data) return { prefs: data as Record<string, boolean | string> };

    const defaults = Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, true]));
    await context.supabase
      .from("notification_preferences")
      .insert({ user_id: context.userId, ...defaults } as never);
    return { prefs: { user_id: context.userId, ...defaults } as Record<string, boolean | string> };
  });

export const updateMyNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => prefsSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("notification_preferences")
      .upsert({ user_id: context.userId, ...data } as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Chaves globais (Super Admin): liga/desliga cada tipo de disparo na plataforma. */
export const getGlobalNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "notification_channels")
      .maybeSingle();
    const stored = (data?.value ?? {}) as Record<string, boolean>;
    const settings = Object.fromEntries(
      NOTIFICATION_KEYS.map((k) => [k, stored[k] !== false]),
    ) as Record<NotificationKey, boolean>;
    return { settings };
  });

export const saveGlobalNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => prefsSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert(
        { key: "notification_channels", value: data as never, updated_at: new Date().toISOString() } as never,
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
