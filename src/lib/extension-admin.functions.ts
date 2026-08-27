import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperAdmin } from "./admin-guard";

const versionSchema = z.string().trim().min(3).max(40).regex(/^[0-9]+(\.[0-9]+){1,3}([+-][A-Za-z0-9.-]+)?$/);

export const extensionAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadExtensionAdminCenter } = await import("./extension-admin.server");
    return loadExtensionAdminCenter();
  });

export const extensionAdminResolveError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ errorId: z.string().uuid(), resolved: z.boolean().default(true) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { resolveExtensionError } = await import("./extension-admin.server");
    return resolveExtensionError(data.errorId, data.resolved);
  });

export const extensionAdminResolveIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ incidentId: z.string().uuid(), resolved: z.boolean().default(true) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { resolveExtensionIncident } = await import("./extension-admin.server");
    return resolveExtensionIncident(data.incidentId, data.resolved);
  });

export const extensionAdminSaveRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    version: versionSchema,
    title: z.string().trim().min(1).max(180),
    changelog: z.string().max(20_000).default(""),
    buildId: z.string().uuid().optional().nullable(),
    mandatory: z.boolean().default(false),
    minimumVersion: versionSchema.optional().nullable(),
    downloadUrl: z.string().url().max(1200).optional().nullable(),
    status: z.enum(["draft", "testing", "released", "deprecated"]),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { saveExtensionRelease } = await import("./extension-admin.server");
    return saveExtensionRelease(data, context.userId);
  });

export const extensionAdminAcknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ alertId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { acknowledgeExtensionAlert } = await import("./extension-admin.server");
    return acknowledgeExtensionAlert(data.alertId, context.userId);
  });
