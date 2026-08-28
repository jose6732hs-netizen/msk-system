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

export const adminSendEmailCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        audience: z.enum(["all", "single"]),
        profileId: z.string().uuid().optional(),
        subject: z.string().trim().min(3).max(160),
        title: z.string().trim().min(2).max(140),
        message: z.string().trim().min(2).max(6000),
      })
      .superRefine((data, ctx) => {
        if (data.audience === "single" && !data.profileId) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["profileId"], message: "Selecione um cliente." });
        }
      })
      .parse(value),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { sendCustomEmailCampaign } = await import("./admin-email.server");
    return sendCustomEmailCampaign(data, context.userId);
  });

export const adminSendWhatsappOutageBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        newWhatsapp: z.string().min(10).max(32),
        subject: z.string().min(5).max(160).optional(),
      })
      .parse(value),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { sendWhatsappOutageBroadcast } = await import("./admin-email.server");
    return sendWhatsappOutageBroadcast(data, context.userId);
  });
