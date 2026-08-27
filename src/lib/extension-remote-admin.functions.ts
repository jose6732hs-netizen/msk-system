import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperAdmin } from "./admin-guard";

const userId = z.string().uuid();
const installationId = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/).optional().nullable();

export const extensionRemoteAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadRemoteControlAdmin } = await import("./extension-remote-control.server");
    return (await loadRemoteControlAdmin()) as any;
  });

export const extensionRemoteAdminSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    userId,
    installationId,
    title: z.string().trim().min(1).max(180),
    message: z.string().trim().min(1).max(2000),
    severity: z.enum(["info", "success", "warning", "critical"]).default("info"),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { sendRemoteMessage } = await import("./extension-remote-control.server");
    return sendRemoteMessage(data as any, context.userId);
  });

export const extensionRemoteAdminSetBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    userId,
    blocked: z.boolean(),
    reason: z.string().trim().max(300).optional().nullable(),
    message: z.string().trim().max(1000).optional().nullable(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { setRemoteBlock } = await import("./extension-remote-control.server");
    return setRemoteBlock(data as any, context.userId);
  });
