import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, assertSuperAdmin } from "./admin-guard";

const userId = z.string().uuid();
const requiredInstallationId = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const installationId = requiredInstallationId.optional().nullable();

function cloneAlertSignature(row: any) {
  return JSON.stringify([
    String(row?.version ?? ""),
    String(row?.extension_id ?? ""),
    String(row?.suspicion_reason ?? ""),
    String(row?.block_reason ?? ""),
    row?.blocked === true ? "blocked" : "open",
  ]);
}

export const extensionRemoteAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadRemoteControlAdmin } = await import("./extension-remote-control.server");
    const overview = (await loadRemoteControlAdmin()) as any;
    const suspicious = Array.isArray(overview?.suspicious) ? overview.suspicious : [];

    if (!suspicious.length) return overview;

    const ids = [...new Set(
      suspicious
        .map((row: any) => String(row?.installation_id ?? ""))
        .filter((id: string) => requiredInstallationId.safeParse(id).success),
    )];

    if (!ids.length) return overview;

    const { data: rows } = await (supabaseAdmin as any)
      .from("extension_installations")
      .select("installation_id,metadata")
      .in("installation_id", ids);

    const hiddenByInstallation = new Map<string, string>();
    for (const row of rows ?? []) {
      const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
      const dismissal = metadata?.admin_clone_alert_dismissal;
      if (dismissal?.signature) {
        hiddenByInstallation.set(String(row.installation_id), String(dismissal.signature));
      }
    }

    return {
      ...overview,
      suspicious: suspicious.filter((row: any) => {
        const installation = String(row?.installation_id ?? "");
        return hiddenByInstallation.get(installation) !== cloneAlertSignature(row);
      }),
    };
  });

export const extensionRemoteAdminDismissCloneAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ installationId: requiredInstallationId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: row, error: readError } = await (supabaseAdmin as any)
      .from("extension_installations")
      .select("id,installation_id,version,extension_id,suspicion_reason,block_reason,blocked,metadata")
      .eq("installation_id", data.installationId)
      .maybeSingle();

    if (readError) throw readError;
    if (!row) throw new Error("Instalação não encontrada.");

    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? { ...row.metadata }
      : {};

    metadata.admin_clone_alert_dismissal = {
      signature: cloneAlertSignature(row),
      hidden_at: new Date().toISOString(),
      hidden_by: context.userId,
    };

    const { error } = await (supabaseAdmin as any)
      .from("extension_installations")
      .update({ metadata })
      .eq("id", row.id);

    if (error) throw error;

    return {
      ok: true,
      installationId: data.installationId,
      securityStatePreserved: true,
    };
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

export const extensionRemoteAdminSendAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    userId,
    installationId,
    action: z.enum(["refresh", "revalidate_license", "clear_cache", "diagnostic", "update_notice"]),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { sendRemoteAction } = await import("./extension-remote-control.server");
    return sendRemoteAction(data as any, context.userId);
  });

export const extensionRemoteAdminBroadcastUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    version: z.string().trim().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/),
    downloadUrl: z.string().url().max(1000).optional().nullable(),
    mandatory: z.boolean().default(false),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { broadcastUpdateNotice } = await import("./extension-remote-control.server");
    return broadcastUpdateNotice(data as any, context.userId);
  });

export const extensionRemoteAdminMarkRepliesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { markRepliesRead } = await import("./extension-remote-control.server");
    return markRepliesRead(data.userId);
  });

export const extensionRemoteAdminBlockInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    installationId: requiredInstallationId,
    blocked: z.boolean(),
    reason: z.string().trim().max(300).optional().nullable(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { setInstallationBlock } = await import("./extension-remote-control.server");
    return setInstallationBlock(data as any, context.userId);
  });


