import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";
import { planSchema } from "./admin.schemas";

export const liveAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadLiveAdmin } = await import("./live-admin.server");
    return loadLiveAdmin();
  });

export const liveAdminSaveOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveLiveOffer } = await import("./live-admin.server");
    return saveLiveOffer(data, context.userId);
  });

export const liveAdminGenerateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planId: z.string().uuid(),
      email: z.string().email().max(200).optional(),
      standalone: z.boolean().optional(),
      note: z.string().max(300).optional(),
    })
      .refine((data) => data.standalone === true || Boolean(data.email), {
        message: "Informe o e-mail do cliente ou marque licença sem usuário.",
        path: ["email"],
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { generateLiveLicense } = await import("./live-admin.server");
    return generateLiveLicense(data as { planId: string; email?: string | null; standalone?: boolean; note?: string | null }, context.userId);
  });

export const liveAdminLicenseAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      licenseId: z.string().uuid(),
      action: z.enum(["revoke", "restore", "reset_devices"]),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runLiveLicenseAction } = await import("./live-admin.server");
    return runLiveLicenseAction(data, context.userId);
  });
