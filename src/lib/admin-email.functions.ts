import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperAdmin } from "./admin-guard";

export const adminEmailBroadcastOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getEmailBroadcastOverview } = await import("./admin-email.server");
    return getEmailBroadcastOverview();
  });

export const adminSendWhatsappOutageBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({
      newWhatsapp: z.string().min(10).max(32),
      subject: z.string().min(5).max(160).optional(),
    }).parse(value),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { sendWhatsappOutageBroadcast } = await import("./admin-email.server");
    return sendWhatsappOutageBroadcast(data, context.userId);
  });
