import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export const adminListBuilds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { listBuilds } = await import("./extension.server");
    return listBuilds();
  });

export const adminCreateUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        version: z.string().min(1).max(20).regex(/^[0-9A-Za-z.\-_]+$/),
        fileName: z.string().min(4).max(120).regex(/\.zip$/i, "O arquivo precisa ser .zip"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { createUploadUrl } = await import("./extension.server");
    return createUploadUrl(data);
  });

export const adminRegisterBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        version: z.string().min(1).max(20),
        fileName: z.string().min(4).max(120),
        storagePath: z.string().min(4).max(300),
        channelSlug: z.string().max(60).optional(),
        displayName: z.string().trim().min(1).max(100).optional(),
        sizeBytes: z.number().int().min(1).max(200 * 1024 * 1024),
        releaseNotes: z.string().max(2000).optional(),
        publish: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { registerBuild } = await import("./extension.server");
    return registerBuild(data, context.userId);
  });

export const adminSetBuildPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ buildId: z.string().uuid(), publish: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { setPublished } = await import("./extension.server");
    return setPublished(data.buildId, data.publish, context.userId);
  });

export const adminDeleteBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ buildId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { deleteBuild } = await import("./extension.server");
    return deleteBuild(data.buildId, context.userId);
  });

export const getExtensionDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ channelSlug: z.string().max(60).optional() }).optional().parse(d) ?? {},
  )
  .handler(async ({ context, data }) => {
    const { hasUsableLicenseRole } = await import("./license-entitlements.server");
    const allowed = await hasUsableLicenseRole(context.userId, "extension", { allowPrivileged: true });
    if (!allowed) {
      throw new Error("Seu plano atual não inclui acesso à extensão principal.");
    }
    const { issueDownloadLink } = await import("./extension.server");
    return issueDownloadLink(context.userId, data?.channelSlug ?? null);
  });

/** Entrega exclusiva da MSK LIVE: licença de outros produtos nunca autoriza o ZIP. */
export const getLiveExtensionDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { hasUsableLicenseRole } = await import("./license-entitlements.server");
    const allowed = await hasUsableLicenseRole(context.userId, "live", { allowPrivileged: true });
    if (!allowed) throw new Error("Sua conta não possui uma licença MSK LIVE válida.");
    const { issueDownloadLink } = await import("./extension.server");
    return issueDownloadLink(context.userId, "msk-live");
  });

/** Canais só são expostos ao cliente que possui licença da extensão. */
export const getActiveExtensionChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { hasUsableLicenseRole } = await import("./license-entitlements.server");
    const allowed = await hasUsableLicenseRole(context.userId, "extension", { allowPrivileged: true });
    if (!allowed) return { access: false, channels: [] };
    const { listActiveChannels } = await import("./extension.server");
    return { access: true, channels: await listActiveChannels() };
  });

export const getLatestBuildInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { latestPublishedBuild } = await import("./extension.server");
    return latestPublishedBuild();
  });

export const adminGetReserveExtension = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getReserveConfig } = await import("./reserve-extension.server");
    return getReserveConfig();
  });

export const adminSaveReserveExtension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        version: z.string().max(20).regex(/^[0-9A-Za-z.\-_]*$/).optional(),
        message: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveReserveConfig } = await import("./reserve-extension.server");
    return saveReserveConfig(data, context.userId);
  });

export const adminListExtensionChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { listExtensionChannels } = await import("./extension-channels.server");
    return { channels: await listExtensionChannels() };
  });

export const adminSaveExtensionChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        enabled: z.boolean(),
        version: z.string().min(1).max(20).regex(/^[0-9A-Za-z.\-_]+$/).optional(),
        message: z.string().max(300).optional(),
        chromeExtensionId: z.string().regex(/^[a-p]{32}$/).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveExtensionChannel } = await import("./extension-channels.server");
    return saveExtensionChannel(data, context.userId);
  });
