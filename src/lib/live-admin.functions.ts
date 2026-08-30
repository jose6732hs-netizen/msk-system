import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export const liveAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadLiveAdmin } = await import("./live-admin.server");
    return loadLiveAdmin();
  });

export const liveAdminGenerateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planId: z.string().uuid(),
      email: z.string().email().max(200).optional(),
      standalone: z.boolean().optional(),
      note: z.string().max(300).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { generateLiveLicense } = await import("./live-admin.server");
    return generateLiveLicense(data, context.userId);
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
