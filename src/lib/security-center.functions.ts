import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperAdmin } from "./admin-guard";

const installationAction = z.enum([
  "BLOCK",
  "UNBLOCK",
  "REVOKE_SESSIONS",
  "REVOKE_LICENSE",
  "FORCE_REAUTH",
  "REMOVE_DEVICE",
  "MARK_TRUSTED",
  "INVESTIGATE",
  "BLOCK_USER",
]);

export const securityCenterOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase as any;

    const [installRes, eventRes, sessionRes, blockRes, buildRes, ipRes] = await Promise.all([
      db.from("security_installations").select("*").order("last_seen_at", { ascending: false }).limit(1000),
      db.from("security_integrity_events").select("*").order("created_at", { ascending: false }).limit(400),
      db.from("security_sessions").select("id,session_id,installation_id,user_id,license_id,build_id,issued_at,expires_at,revoked_at,last_seen_at,ip,metadata").order("issued_at", { ascending: false }).limit(400),
      db.from("security_blocks").select("*").order("created_at", { ascending: false }).limit(300),
      db.from("security_builds").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("security_installation_ips").select("*").order("last_seen_at", { ascending: false }).limit(500),
    ]);

    for (const result of [installRes, eventRes, sessionRes, blockRes, buildRes, ipRes]) {
      if (result.error) throw result.error;
    }

    const installations = (installRes.data ?? []) as any[];
    const userIds = [...new Set(installations.map((row) => row.user_id).filter(Boolean))] as string[];
    const licenseIds = [...new Set(installations.map((row) => row.license_id).filter(Boolean))] as string[];

    const [profilesRes, licensesRes] = await Promise.all([
      userIds.length
        ? db.from("profiles").select("id,name,email").in("id", userIds.slice(0, 1000))
        : Promise.resolve({ data: [], error: null }),
      licenseIds.length
        ? db.from("licenses").select("id,status,type,expires_at,max_devices,token_preview,token_last4,plans(name,slug)").in("id", licenseIds.slice(0, 1000))
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (licensesRes.error) throw licensesRes.error;

    const profiles = new Map((profilesRes.data ?? []).map((row: any) => [row.id, row]));
    const licenses = new Map((licensesRes.data ?? []).map((row: any) => [row.id, row]));
    const enriched = installations.map((row) => ({
      ...row,
      profile: row.user_id ? profiles.get(row.user_id) ?? null : null,
      license: row.license_id ? licenses.get(row.license_id) ?? null : null,
    }));

    const now = Date.now();
    const activeSessions = (sessionRes.data ?? []).filter((row: any) => !row.revoked_at && Date.parse(row.expires_at) > now);
    const activeBlocks = (blockRes.data ?? []).filter((row: any) => !row.released_at && (!row.expires_at || Date.parse(row.expires_at) > now));
    const recentCritical = (eventRes.data ?? []).filter((row: any) => row.severity === "critical" && Date.parse(row.created_at) > now - 24 * 60 * 60_000);

    return {
      installations: enriched,
      events: eventRes.data ?? [],
      sessions: sessionRes.data ?? [],
      blocks: blockRes.data ?? [],
      builds: buildRes.data ?? [],
      ips: ipRes.data ?? [],
      stats: {
        total: enriched.length,
        active: enriched.filter((row) => row.trust_status === "ACTIVE").length,
        blocked: enriched.filter((row) => row.trust_status === "BLOCKED").length,
        suspicious: enriched.filter((row) => row.trust_status === "SUSPICIOUS").length,
        tampered: enriched.filter((row) => row.trust_status === "TAMPERED").length,
        cloned: enriched.filter((row) => row.trust_status === "CLONED").length,
        expired: enriched.filter((row) => row.trust_status === "LICENSE_EXPIRED").length,
        pending: enriched.filter((row) => row.trust_status === "PENDING").length,
        activeSessions: activeSessions.length,
        activeBlocks: activeBlocks.length,
        critical24h: recentCritical.length,
      },
    };
  });

export const securityCenterInstallationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    installationId: z.string().min(16).max(80),
    action: installationAction,
    reason: z.string().trim().max(500).optional().nullable(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: result, error } = await (context.supabase as any).rpc("security_admin_installation_action", {
      p_installation_id: data.installationId,
      p_action: data.action,
      p_reason: data.reason ?? null,
      p_evidence: { source: "security_center_admin" },
    });
    if (error) throw error;
    return result as any;
  });

export const securityCenterDismissMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    installationId: z.string().min(16).max(80),
    scope: z.enum(["INCIDENT", "BLOCK"]),
    blockId: z.string().uuid().optional().nullable(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.scope === "BLOCK" && !data.blockId) {
      throw new Error("ID da mensagem de bloqueio é obrigatório.");
    }
    const { data: result, error } = await (context.supabase as any).rpc("security_admin_dismiss_message", {
      p_installation_id: data.installationId,
      p_scope: data.scope,
      p_block_id: data.blockId ?? null,
    });
    if (error) throw error;
    return result as any;
  });

export const securityCenterBuildAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    buildId: z.string().min(3).max(160),
    action: z.enum(["BLOCK", "UNBLOCK"]),
    reason: z.string().trim().max(500).optional().nullable(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: result, error } = await (context.supabase as any).rpc("security_admin_build_action", {
      p_build_id: data.buildId,
      p_action: data.action,
      p_reason: data.reason ?? null,
    });
    if (error) throw error;
    return result as any;
  });
