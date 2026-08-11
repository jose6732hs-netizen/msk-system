import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertSuperAdmin } from "./admin-guard";

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "super_admin"]);
    return { admin: !!data?.length, superAdmin: !!data?.some((r: any) => r.role === "super_admin") };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ 
      search: z.string().max(120).optional(),
      userSearch: z.string().max(120).optional()
    }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadAdminOverview } = await import("./admin.server");
    return loadAdminOverview(data.search ?? "", data.userSearch ?? "");
  });

const licenseAction = z.object({
  licenseId: z.string().uuid(),
  action: z.enum(["revoke", "suspend", "reactivate", "extend"]),
  reason: z.string().max(240).optional(),
  days: z.number().int().min(1).max(3650).optional(),
});

export const adminLicenseAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => licenseAction.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runLicenseAction } = await import("./admin.server");
    return runLicenseAction(data, context.userId);
  });

export const adminGetLicenseDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ licenseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: license, error } = await supabaseAdmin
      .from("licenses")
      .select("*, plans(*)")
      .eq("id", data.licenseId)
      .single();
    if (error) throw error;

    let profiles: any = null;
    if (license.user_id) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", license.user_id)
        .maybeSingle();
      profiles = p ?? null;
    }

    // Decrypt the token for the admin to copy the full message
    const { decryptToken } = await import("./license.server");
    const fullToken = license.token_encrypted ? await decryptToken(license.token_encrypted) : null;

    return { ...license, profiles, fullToken };
  });

export const adminRemoveDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ deviceId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("license_devices")
      .update({ status: "removed" })
      .eq("id", data.deviceId);
    return { ok: true };
  });

const planSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(2).max(40),
  name: z.string().min(2).max(60),
  description: z.string().max(400).default(""),
  price: z.number().min(0),
  currency: z.string().min(3).max(3).default("BRL"),
  duration_label: z.string().max(40).default(""),
  duration_days: z.number().int().min(1).nullable(),
  is_lifetime: z.boolean().default(false),
  auto_renew: z.boolean().default(true),
  max_devices: z.number().int().min(1).max(100).default(1),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  image_url: z.string().max(400).default("").optional(),
  affiliate_commission_rate: z.number().min(0).max(100).default(0),
  affiliate_commission_fixed: z.number().min(0).default(0),
});

export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { savePlan } = await import("./admin.server");
    return savePlan(data);
  });

/* ============ Gateway de pagamento (Amplo Pay) ============ */

export const adminGatewaySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getSettingsSummary } = await import("./payments/amplo-pay.server");
    return getSettingsSummary();
  });

export const adminSaveGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        publicKey: z.string().min(8).max(400).optional(),
        secretKey: z.string().min(8).max(400).optional(),
        webhookSecret: z.string().min(8).max(400).optional(),
        baseUrl: z.string().url().optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveCredentials, getSettingsSummary } = await import("./payments/amplo-pay.server");
    const { logAudit } = await import("./audit.server");
    await saveCredentials({ ...data, updatedBy: context.userId });
    await logAudit({
      userId: context.userId,
      action: "gateway.settings_updated",
      resource: "payment_settings",
      metadata: { active: data.active ?? null },
    });
    return getSettingsSummary();
  });

export const adminTestGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { testCredentials } = await import("./payments/amplo-pay.server");
    try {
      return await testCredentials();
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

export const adminFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadFinanceOverview } = await import("./admin-finance.server");
    return loadFinanceOverview();
  });

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ key: z.enum(["trial", "commissions", "reseller_tiers"]), value: z.any() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { setSetting } = await import("./commerce.server");
    const { logAudit } = await import("./audit.server");
    await setSetting(data.key, data.value);
    await logAudit({ userId: context.userId, action: `settings.${data.key}_updated`, resource: "app_settings" });
    return { ok: true };
  });

export const adminWithdrawalAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        withdrawalId: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        reason: z.string().max(240).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { resolveWithdrawal } = await import("./admin-finance.server");
    return resolveWithdrawal(data, context.userId);
  });

/* ============ Geração manual de tokens (Super Admin) ============ */

export const adminTokenPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { loadTokenPlans } = await import("./admin-tokens.server");
    return { plans: await loadTokenPlans() };
  });

export const adminGenerateToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.union([z.string().email(), z.literal("")]).optional(),
        standalone: z.boolean().optional(),
        planId: z.string().uuid(),
        duration: z.enum([
          "trial15",
          "trial60",
          "day1",
          "day7",
          "day30",
          "day90",
          "day365",
          "lifetime",
          "custom",
        ]),
        customDays: z.number().int().min(1).max(3650).optional(),
        customMinutes: z.number().int().min(1).max(100000).optional(),
        maxDevices: z.number().int().min(1).max(100).optional(),
        note: z.string().max(240).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { generateManualToken } = await import("./admin-tokens.server");
    return generateManualToken(data, context.userId);
  });

export const adminUserAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      action: z.enum(["reset_password", "reset_withdrawal_password", "block_user", "unblock_user"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");

    if (data.action === "reset_password") {
      // In Supabase, admin can send a reset email or update the password directly
      // Here we'll generate a recovery link via Supabase Auth Admin
      const { data: recovery, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: (await supabaseAdmin.from("profiles").select("email").eq("id", data.userId).single()).data?.email || "",
      });
      if (error) throw error;
      await logAudit({ userId: context.userId, action: "user.password_reset_requested", resource: "profiles", resourceId: data.userId });
      return { ok: true, link: recovery.properties.action_link };
    }

    if (data.action === "reset_withdrawal_password") {
      const { error } = await supabaseAdmin
        .from("affiliates")
        .update({ withdrawal_password_hash: null, withdrawal_attempts: 0, withdrawal_blocked_at: null } as never)
        .eq("user_id", data.userId);
      if (error) throw error;
      await logAudit({ userId: context.userId, action: "user.withdrawal_password_reset", resource: "profiles", resourceId: data.userId });
      return { ok: true };
    }

    if (data.action === "block_user") {
      // Logic to block user access globally
      // In this system, blocking might involve adding a 'blocked' role or status
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: 'none' }); // 'none' means permanent ban in some providers, but Supabase uses ban_duration
      // Let's use a custom status in profiles for better app-level control
      await supabaseAdmin.from("profiles").update({ status: 'blocked' } as any).eq("id", data.userId);
      await logAudit({ userId: context.userId, action: "user.blocked", resource: "profiles", resourceId: data.userId });
      return { ok: true };
    }

    if (data.action === "unblock_user") {
      await supabaseAdmin.from("profiles").update({ status: 'active' } as any).eq("id", data.userId);
      await logAudit({ userId: context.userId, action: "user.unblocked", resource: "profiles", resourceId: data.userId });
      return { ok: true };
    }

    return { ok: false };
  });