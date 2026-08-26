import { z } from "zod";
import {
  clientIp,
  findLicenseByToken,
  hashValue,
  jsonResponse,
  logEvent,
  rateLimit,
} from "./license.server";
import { resolvePlanDuration } from "./plan-duration";

export const validateSchema = z.object({
  token: z.string().min(8).max(64),
  // Login da extensão: e-mail + licença.
  email: z.string().email().max(160).optional(),
  device_fingerprint: z.string().min(8).max(256).optional(),
  installation_id: z.string().min(8).max(128).optional(),
  // Compatibilidade com builds antigos da MSK COPY.
  deviceId: z.string().min(8).max(256).optional(),
  extension_version: z.string().max(32).optional(),
  product: z.string().max(40).optional(),
});

type LicenseRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  type: string;
  expires_at: string | null;
  max_devices: number;
  metadata: Record<string, unknown> | null;
  plans: { slug: string; name: string; features: Record<string, boolean> | null } | null;
};

const LOCKED = {
  chat: false,
  projects: false,
  download: false,
  background_tools: false,
};

async function recoverDurationFromPlan(planId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("name,slug,is_lifetime,duration_label,duration_days,duration_value,duration_unit")
    .eq("id", planId)
    .maybeSingle();
  return plan ? resolvePlanDuration(plan) : null;
}

function productAllowed(license: LicenseRow, product?: string) {
  if (!product) return true;
  if (product !== "msk-copy") return false;
  const slug = String(license.plans?.slug ?? "").toLowerCase();
  const features = license.plans?.features ?? {};
  return slug.startsWith("page-cloner-") || features["page_cloner"] === true;
}

/** Lógica compartilhada por /validate e /heartbeat. */
export async function handleValidation(request: Request, bucket: string, limit: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ip = clientIp(request);
  const respond = (body: unknown, status = 200) => jsonResponse(body, status, request);

  if (!(await rateLimit(bucket, ip, limit))) {
    return respond({ success: false, valid: false, error: "RATE_LIMITED", code: "RATE_LIMITED" }, 429);
  }

  const parsed = validateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respond({ success: false, valid: false, error: "INVALID_REQUEST", code: "INVALID_REQUEST" }, 400);
  }

  const license = (await findLicenseByToken(parsed.data.token)) as LicenseRow | null;
  if (!license) {
    const { hashToken } = await import("./license.server");
    const sentHash = await hashToken(parsed.data.token);
    await logEvent({
      event_type: "invalid_attempt",
      metadata: {
        bucket,
        token_last4: parsed.data.token.slice(-4),
        sent_hash: sentHash,
        error: "Token not found in database",
      },
    });
    return respond(
      {
        success: false,
        valid: false,
        error: "LICENSE_INVALID",
        code: "LICENSE_INVALID",
        message: "Token inválido. Confira os caracteres e tente novamente.",
      },
      404,
    );
  }

  if (!productAllowed(license, parsed.data.product)) {
    await logEvent({
      license_id: license.id,
      user_id: license.user_id,
      event_type: "product_mismatch",
      metadata: { requested_product: parsed.data.product ?? null, plan: license.plans?.slug ?? null },
    });
    return respond(
      {
        success: false,
        valid: false,
        error: "LICENSE_PRODUCT_MISMATCH",
        code: "LICENSE_PRODUCT_MISMATCH",
        message: "Este token não pertence ao MSK COPY. Use uma licença do Clonador.",
      },
      403,
    );
  }

  const identity = parsed.data.installation_id ?? parsed.data.device_fingerprint ?? parsed.data.deviceId;
  if (!identity) {
    return respond({ success: false, valid: false, error: "INVALID_REQUEST", code: "INVALID_REQUEST" }, 400);
  }
  const deviceHash = await hashValue(identity);

  if (license.status === "inactive") {
    const activatedAt = new Date();
    const pending = Number((license.metadata as any)?.["pending_duration_ms"] ?? 0);
    const patch: Record<string, unknown> = {
      status: "active",
      activated_at: activatedAt.toISOString(),
    };

    if (!license.expires_at && pending > 0) {
      const expiresAt = new Date(activatedAt.getTime() + pending).toISOString();
      patch["expires_at"] = expiresAt;
      license.expires_at = expiresAt;
    } else if (!license.expires_at) {
      const snapVal = Number((license.metadata as any)?.["plan_duration_value_snapshot"] ?? 0);
      const snapUnit = String((license.metadata as any)?.["plan_duration_unit_snapshot"] || "");
      let recoveredMs = 0;

      if (snapVal > 0 && snapUnit) {
        try {
          recoveredMs = resolvePlanDuration({ duration_value: snapVal, duration_unit: snapUnit }).milliseconds ?? 0;
        } catch {
          recoveredMs = 0;
        }
      }

      if (!(recoveredMs > 0) && license.plan_id) {
        const resolved = await recoverDurationFromPlan(license.plan_id);
        if (resolved?.lifetime) recoveredMs = 0;
        else recoveredMs = resolved?.milliseconds ?? 0;
      }

      if (recoveredMs > 0) {
        const expiresAt = new Date(activatedAt.getTime() + recoveredMs).toISOString();
        patch["expires_at"] = expiresAt;
        license.expires_at = expiresAt;
      }
    }

    await supabaseAdmin.from("licenses").update(patch as never).eq("id", license.id);
    license.status = "active";
  }

  type DeviceRow = { id: string; status: string };
  let device: DeviceRow | null = null;
  if (parsed.data.installation_id) {
    const { data } = await supabaseAdmin
      .from("license_devices")
      .select("id,status")
      .eq("license_id", license.id)
      .eq("installation_id", parsed.data.installation_id)
      .maybeSingle();
    device = data as DeviceRow | null;
  }
  if (!device) {
    const { data } = await supabaseAdmin
      .from("license_devices")
      .select("id,status")
      .eq("license_id", license.id)
      .eq("device_hash", deviceHash)
      .maybeSingle();
    device = data as DeviceRow | null;
  }

  if (!device && license.status === "active") {
    const { data: newDev, error: devErr } = await supabaseAdmin
      .from("license_devices")
      .insert({
        license_id: license.id,
        device_hash: deviceHash,
        installation_id: parsed.data.installation_id ?? parsed.data.deviceId ?? null,
        status: "active",
        last_seen: new Date().toISOString(),
        last_ip_hash: await hashValue(ip),
      } as never)
      .select("id,status")
      .single();
    if (!devErr) device = newDev as DeviceRow;
  }

  if (!device || device.status !== "active") {
    return respond(
      {
        success: false,
        valid: false,
        error: "DEVICE_NOT_REGISTERED",
        code: "DEVICE_NOT_REGISTERED",
        status: license.status.toUpperCase(),
      },
      403,
    );
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("license_devices")
    .update({ last_seen: now, last_ip_hash: await hashValue(ip) })
    .eq("id", device.id);
  await supabaseAdmin.from("licenses").update({ last_validation: now }).eq("id", license.id);

  const active = license.status === "active";
  await logEvent({
    license_id: license.id,
    user_id: license.user_id,
    event_type: bucket === "heartbeat" ? "heartbeat" : "validated",
    device_hash: deviceHash,
    metadata: parsed.data.product ? { product: parsed.data.product, extension_version: parsed.data.extension_version ?? null } : {},
  });

  const responseData = {
    success: active,
    valid: active,
    status: license.status.toUpperCase(),
    action: active ? null : "REAUTH_REQUIRED",
    license: {
      status: license.status.toUpperCase(),
      plan: license.plans?.slug ?? null,
      plan_name: license.plans?.name ?? null,
      expires_at: license.expires_at,
      max_devices: license.max_devices,
      devices_used: 1,
      features: active ? (license.plans?.features ?? LOCKED) : LOCKED,
    },
    // Aliases para builds antigos da extensão.
    expiresAt: license.expires_at,
    planName: license.plans?.name ?? null,
    planSlug: license.plans?.slug ?? null,
    timestamp: Date.now(),
  };

  const { signData } = await import("./license.server");
  const signature = await signData(JSON.stringify(responseData));

  return respond({ ...responseData, signature });
}
