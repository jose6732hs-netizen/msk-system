import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

const filters = z.object({
  days: z.number().int().min(1).max(90).default(7),
  severity: z.enum(["all", "critical", "error", "warning", "info"]).default("all"),
  status: z.enum(["all", "open", "resolved"]).default("open"),
  search: z.string().max(120).optional().nullable(),
  limit: z.number().int().min(10).max(500).default(120),
});

/** Lista os erros reportados pela extensão + estado da conexão em tempo real. */
export const extensionErrorsAdminFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filters.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const now = Date.now();
    const since = new Date(now - data.days * 86_400_000).toISOString();

    let query = db
      .from("extension_errors")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.severity !== "all") query = query.eq("severity", data.severity);
    if (data.status !== "all") query = query.eq("resolved", data.status === "resolved");

    const search = (data.search ?? "").trim();
    if (search) {
      const safe = search.replace(/[%,]/g, " ");
      query = query.or(
        [
          `error_code.ilike.%${safe}%`,
          `title.ilike.%${safe}%`,
          `user_message.ilike.%${safe}%`,
          `technical_message.ilike.%${safe}%`,
          `installation_id.ilike.%${safe}%`,
          `extension_version.ilike.%${safe}%`,
        ].join(","),
      );
    }

    const [errorsRes, installationsRes, commandsRes, buildsRes] = await Promise.all([
      query,
      db
        .from("extension_installations")
        .select("installation_id,user_id,version,last_seen_at,browser")
        .order("last_seen_at", { ascending: false })
        .limit(3000),
      db
        .from("extension_remote_commands")
        .select("id,status,created_at")
        .in("status", ["pending", "delivered"])
        .limit(1000),
      db
        .from("extension_builds")
        .select("id,version,file_name,is_published,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const errors = (errorsRes.data ?? []) as any[];
    const installations = (installationsRes.data ?? []) as any[];
    const commands = (commandsRes.data ?? []) as any[];
    const builds = (buildsRes.data ?? []) as any[];

    const userIds = [...new Set(errors.map((row) => row.user_id).filter(Boolean))].slice(0, 200);
    let profiles: any[] = [];
    if (userIds.length) {
      const { data: rows } = await db.from("profiles").select("id,name,email").in("id", userIds);
      profiles = rows ?? [];
    }
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const lastSeen = installations[0]?.last_seen_at ?? null;
    const online = installations.filter(
      (row) => Date.parse(row.last_seen_at ?? 0) >= now - 5 * 60_000,
    );
    const active15m = installations.filter(
      (row) => Date.parse(row.last_seen_at ?? 0) >= now - 15 * 60_000,
    );

    const byCode = new Map<string, number>();
    const byVersion = new Map<string, number>();
    for (const row of errors) {
      const code = String(row.error_code ?? "desconhecido");
      byCode.set(code, (byCode.get(code) ?? 0) + 1);
      const version = String(row.extension_version ?? "—");
      byVersion.set(version, (byVersion.get(version) ?? 0) + 1);
    }

    return {
      generatedAt: new Date(now).toISOString(),
      connection: {
        online: online.length,
        active15m: active15m.length,
        installations: installations.length,
        lastSeenAt: lastSeen,
        latencySeconds: lastSeen ? Math.max(0, Math.round((now - Date.parse(lastSeen)) / 1000)) : null,
        pendingCommands: commands.filter((c) => c.status === "pending").length,
        deliveredCommands: commands.filter((c) => c.status === "delivered").length,
        publishedBuild: builds.find((b) => b.is_published) ?? null,
      },
      totals: {
        matched: errors.length,
        open: errors.filter((row) => !row.resolved).length,
        critical: errors.filter((row) => row.severity === "critical" && !row.resolved).length,
        last24h: errors.filter((row) => Date.parse(row.created_at) >= now - 86_400_000).length,
      },
      topCodes: [...byCode.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      versions: [...byVersion.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      errors: errors.map((row) => ({
        id: String(row.id),
        errorId: String(row.error_id ?? ""),
        code: String(row.error_code ?? ""),
        title: row.title ?? null,
        severity: String(row.severity ?? "error"),
        resolved: row.resolved === true,
        createdAt: row.created_at,
        installationId: row.installation_id ?? null,
        version: row.extension_version ?? null,
        browser: row.browser ?? null,
        provider: row.provider ?? null,
        action: row.action ?? null,
        repository: row.repository ?? null,
        projectId: row.project_id ?? null,
        ip: row.ip_address ?? null,
        userMessage: row.user_message ?? null,
        technicalMessage: row.technical_message ?? null,
        stack: row.stack_summary ?? null,
        user: profileMap.get(row.user_id) ?? null,
      })),
      builds: builds.map((b) => ({
        id: String(b.id),
        version: String(b.version ?? ""),
        fileName: String(b.file_name ?? ""),
        published: b.is_published === true,
        createdAt: b.created_at,
      })),
    };
  });

/** Marca um erro como resolvido/reaberto. */
export const extensionErrorsAdminSetResolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), resolved: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("extension_errors")
      .update({ resolved: data.resolved, resolved_at: data.resolved ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Resolve em lote todos os erros de um mesmo código. */
export const extensionErrorsAdminResolveCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("extension_errors")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("error_code", data.code)
      .eq("resolved", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
