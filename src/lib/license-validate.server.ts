import { z } from "zod";
import {
  clientIp,
  findLicenseByToken,
  hashValue,
  jsonResponse,
  logEvent,
  rateLimit,
} from "./license.server";
import { resolveLicenseSnapshot } from "./license-entitlements.server";
import { resolveLicenseProductBinding, resolveProductIdentifier } from "./license-product.server";
import { resolvePlanDuration } from "./plan-duration";
import { resolveLicenseScope, scopeLabel, type LicenseScope } from "./license-scope.server";

export const validateSchema = z.object({
  token: z.string().min(8).max(64),
  email: z.string().email().max(160).optional(),
  device_fingerprint: z.string().min(8).max(256).optional(),
  installation_id: z.string().min(8).max(128).optional(),
  deviceId: z.string().min(8).max(256).optional(),
  extension_version: z.string().max(32).optional(),
  // Compatibilidade/telemetria. Nos endpoints oficiais este valor é
  // sobrescrito no servidor antes de chegar à validação.
  product: z.string().max(40).optional(),
});

type ExpectedRole = LicenseScope;

type LicenseRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  type: string;
  expires_at: string | null;
  activated_at?: string | null;
  max_devices: number;
  metadata: Record<string, unknown> | null;
  plans: {
    id?: string;
    slug: string;
    name: string;
    price?: number;
    currency?: string;
    max_devices?: number;
    is_lifetime?: boolean;
    duration_label?: string | null;
    duration_days?: number | null;
    duration_value?: number | null;
    duration_unit?: string | null;
    features: Record<string, boolean> | null;
  } | null;
};

const LOCKED = {
  chat: false,
  projects: false,
  download: false,
  background_tools: false,
};

function hasOwn(metadata: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(metadata, key);
}

/**
 * Recupera a duração sem permitir que uma licença paga herde duração de outro
 * plano/configuração atual. Snapshot da licença é sempre a fonte da verdade.
 * A tabela plans só é usada para licenças realmente legadas, sem snapshot.
 */
async function durationForLicense(license: LicenseRow) {
  const metadata = (license.metadata ?? {}) as Record<string, unknown>;
  const pending = Number(metadata["pending_duration_ms"] ?? 0);
  if (pending > 0) return { milliseconds: pending, lifetime: false };

  const hasDurationSnapshot = [
    "plan_duration_value_snapshot",
    "plan_duration_unit_snapshot",
    "plan_duration_snapshot",
    "plan_is_lifetime_snapshot",
    "pending_duration_ms",
  ].some((key) => hasOwn(metadata, key));

  if (metadata["plan_is_lifetime_snapshot"] === true) {
    return { milliseconds: null, lifetime: true };
  }

  const snapValue = Number(metadata["plan_duration_value_snapshot"] ?? 0);
  const snapUnit = String(metadata["plan_duration_unit_snapshot"] ?? "").trim();
  if (snapValue > 0 && snapUnit) {
    const resolved = resolvePlanDuration({ duration_value: snapValue, duration_unit: snapUnit });
    return { milliseconds: resolved.milliseconds ?? null, lifetime: resolved.lifetime };
  }

  const snapDays = Number(metadata["plan_duration_snapshot"] ?? 0);
  if (snapDays > 0) {
    const resolved = resolvePlanDuration({ duration_value: snapDays, duration_unit: "days" });
    return { milliseconds: resolved.milliseconds ?? null, lifetime: resolved.lifetime };
  }

  // Snapshot existente mas sem duração válida: não inventar prazo nem herdar
  // configuração nova do plano.
  if (hasDurationSnapshot) return { milliseconds: null, lifetime: false };

  if (!license.plan_id) return { milliseconds: null, lifetime: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("name,slug,is_lifetime,duration_label,duration_days,duration_value,duration_unit")
    .eq("id", license.plan_id)
    .maybeSingle();
  if (!plan) return { milliseconds: null, lifetime: false };
  const resolved = resolvePlanDuration(plan);
  return { milliseconds: resolved.milliseconds ?? null, lifetime: resolved.lifetime };
}

/** Lógica compartilhada por validate/heartbeat, com produto fixado pelo endpoint. */
export async function handleValidation(
  request: Request,
  bucket: string,
  limit: number,
  expectedRole: ExpectedRole | ExpectedRole[],
) {
  const allowedScopes: LicenseScope[] = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
  const primaryScope = allowedScopes[0] ?? "extension";
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

  const snapshot = resolveLicenseSnapshot(license);

  // Produto é a fonte de verdade. Licenças antigas podem não ter product_id;
  // nesse caso reconciliamos por transação/oferta/plano e persistimos o vínculo.
  // A role continua existindo apenas como fallback para registros realmente
  // legados que não possuem relação inequívoca com um produto.
  const expectedProduct = await resolveProductIdentifier(parsed.data.product ?? primaryScope);
  const productBinding = await resolveLicenseProductBinding({
    licenseId: license.id,
    planId: license.plan_id,
    expectedProductIdentifier: parsed.data.product ?? primaryScope,
  });
  const scopeInfo = await resolveLicenseScope(license, parsed.data.product ?? primaryScope);
  const productMismatch =
    !!expectedProduct && !!productBinding.product && productBinding.product.id !== expectedProduct.id;
  const scopeMismatch = !allowedScopes.includes(scopeInfo.scope);

  if (productMismatch || scopeMismatch) {
    await logEvent({
      license_id: license.id,
      user_id: license.user_id,
      event_type: "product_mismatch",
      metadata: {
        requested_role: allowedScopes.join(","),
        license_role: snapshot.role,
        license_scope: scopeInfo.scope,
        scope_source: scopeInfo.source,
        requested_product: parsed.data.product ?? null,
        requested_product_id: expectedProduct?.id ?? null,
        license_product_id: productBinding.product?.id ?? null,
        license_product_slug: productBinding.product?.slug ?? null,
        product_binding_source: productBinding.source,
        product_binding_ambiguous: productBinding.ambiguous,
        license_slug: snapshot.slug,
      },
    });
    return respond(
      {
        success: false,
        valid: false,
        error: "LICENSE_PRODUCT_MISMATCH",
        code: "LICENSE_PRODUCT_MISMATCH",
        message: `Este token pertence a ${scopeLabel(scopeInfo.scope)} e só funciona nesse produto.`,
      },
      403,
    );
  }

  if (parsed.data.email) {
    const sent = parsed.data.email.trim().toLowerCase();
    const { data: owner } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", license.user_id)
      .maybeSingle();
    const ownerEmail = String((owner as any)?.email ?? "").trim().toLowerCase();
    if (!ownerEmail || ownerEmail !== sent) {
      await logEvent({
        license_id: license.id,
        user_id: license.user_id,
        event_type: "email_mismatch",
        metadata: { bucket },
      });
      return respond(
        {
          success: false,
          valid: false,
          error: "EMAIL_MISMATCH",
          code: "EMAIL_MISMATCH",
          message: "Este e-mail não corresponde ao dono desta licença.",
        },
        403,
      );
    }
  }

  const identity = parsed.data.installation_id ?? parsed.data.device_fingerprint ?? parsed.data.deviceId;
  if (!identity) {
    return respond({ success: false, valid: false, error: "INVALID_REQUEST", code: "INVALID_REQUEST" }, 400);
  }
  const deviceHash = await hashValue(identity);

  if (license.status === "inactive") {
    const activatedAt = new Date();
    const duration = await durationForLicense(license);
    const patch: Record<string, unknown> = {
      status: "active",
      activated_at: activatedAt.toISOString(),
    };

    if (!license.expires_at && !duration.lifetime && Number(duration.milliseconds ?? 0) > 0) {
      const expiresAt = new Date(activatedAt.getTime() + Number(duration.milliseconds)).toISOString();
      patch["expires_at"] = expiresAt;
      license.expires_at = expiresAt;
    }

    await supabaseAdmin.from("licenses").update(patch as never).eq("id", license.id);
    license.status = "active";
    license.activated_at = activatedAt.toISOString();
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

  const ipHash = await hashValue(ip);
  if (!device && license.status === "active") {
    const { data: sameIp } = await supabaseAdmin
      .from("license_devices")
      .select("id,status")
      .eq("license_id", license.id)
      .eq("last_ip_hash", ipHash)
      .eq("status", "active")
      .order("last_seen", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sameIp) {
      await supabaseAdmin
        .from("license_devices")
        .update({
          device_hash: deviceHash,
          installation_id: parsed.data.installation_id ?? parsed.data.deviceId ?? null,
        } as never)
        .eq("id", (sameIp as DeviceRow).id);
      device = sameIp as DeviceRow;
    }
  }

  if (!device && license.status === "active") {
    const { count } = await supabaseAdmin
      .from("license_devices")
      .select("id", { count: "exact", head: true })
      .eq("license_id", license.id)
      .eq("status", "active");
    const used = count ?? 0;
    if (license.max_devices > 0 && used >= license.max_devices) {
      return respond(
        {
          success: false,
          valid: false,
          error: "DEVICE_LIMIT",
          code: "DEVICE_LIMIT",
          message: "Limite de dispositivos atingido para esta licença.",
        },
        403,
      );
    }

    const { data: newDev, error: devErr } = await supabaseAdmin
      .from("license_devices")
      .insert({
        license_id: license.id,
        device_hash: deviceHash,
        installation_id: parsed.data.installation_id ?? parsed.data.deviceId ?? null,
        status: "active",
        last_seen: new Date().toISOString(),
        last_ip_hash: ipHash,
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
    .update({ last_seen: now, last_ip_hash: ipHash })
    .eq("id", device.id);
  await supabaseAdmin.from("licenses").update({ last_validation: now }).eq("id", license.id);

  const active = license.status === "active";
  await logEvent({
    license_id: license.id,
    user_id: license.user_id,
    event_type: bucket === "heartbeat" ? "heartbeat" : "validated",
    device_hash: deviceHash,
    metadata: {
      product: parsed.data.product ?? null,
      product_id: productBinding.product?.id ?? null,
      product_slug: productBinding.product?.slug ?? null,
      product_binding_source: productBinding.source,
      expected_role: primaryScope,
      license_role: snapshot.role,
      extension_version: parsed.data.extension_version ?? null,
    },
  });

  const responseData = {
    success: active,
    valid: active,
    status: license.status.toUpperCase(),
    action: active ? null : "REAUTH_REQUIRED",
    license: {
      status: license.status.toUpperCase(),
      plan: snapshot.slug,
      plan_name: snapshot.name,
      product_id: productBinding.product?.id ?? null,
      product_slug: productBinding.product?.slug ?? null,
      product_name: productBinding.product?.name ?? null,
      expires_at: license.expires_at,
      activated_at: license.activated_at ?? null,
      max_devices: snapshot.maxDevices ?? license.max_devices,
      devices_used: 1,
      features: active ? snapshot.features : LOCKED,
      role: snapshot.role,
    },
    expiresAt: license.expires_at,
    email_required: true,
    planName: snapshot.name,
    planSlug: snapshot.slug,
    timestamp: Date.now(),
  };

  const { signData } = await import("./license.server");
  const signature = await signData(JSON.stringify(responseData));
  return respond({ ...responseData, signature });
}