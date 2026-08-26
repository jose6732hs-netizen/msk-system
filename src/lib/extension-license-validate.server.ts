import { z } from "zod";
import {
  clientIp,
  findLicenseByToken,
  hashToken,
  jsonResponse,
  logEvent,
  rateLimit,
} from "./license.server";
import { resolveLicenseSnapshot } from "./license-entitlements.server";
import { resolvePlanDuration } from "./plan-duration";

const extensionLicenseSchema = z.object({
  token: z.string().min(8).max(64),
  email: z.string().email().max(160),
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
 * Mantém o prazo congelado no snapshot comprado pela licença. Reinstalar a
 * extensão nunca recria a validade nem reinicia activated_at/expires_at.
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

function inactiveLicenseResponse(license: LicenseRow) {
  const status = String(license.status || "inactive").toLowerCase();
  if (status === "expired") {
    return {
      code: "LICENSE_EXPIRED",
      message: "Esta licença expirou. Renove o acesso para continuar.",
    };
  }
  if (["revoked", "cancelled", "canceled", "suspended", "blocked"].includes(status)) {
    return {
      code: "LICENSE_REVOKED",
      message: "Esta licença não está disponível. Verifique sua assinatura.",
    };
  }
  return {
    code: "LICENSE_INACTIVE",
    message: "Esta licença não está ativa no momento.",
  };
}

/**
 * Validação exclusiva da extensão MSK principal.
 *
 * Regra de autorização: e-mail do titular + token + status/vencimento da
 * licença. IP, navegador, fingerprint e installation_id NÃO participam da
 * autorização e não são gravados em license_devices.
 */
export async function handleExtensionValidation(
  request: Request,
  bucket: string,
  limit: number,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ip = clientIp(request);
  const respond = (body: unknown, status = 200) => jsonResponse(body, status, request);

  if (!(await rateLimit(bucket, ip, limit))) {
    return respond(
      {
        success: false,
        valid: false,
        error: "RATE_LIMITED",
        code: "RATE_LIMITED",
        message: "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
      },
      429,
    );
  }

  const parsed = extensionLicenseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respond(
      {
        success: false,
        valid: false,
        error: "INVALID_REQUEST",
        code: "INVALID_REQUEST",
        message: "Informe o e-mail da conta e uma licença válida.",
      },
      400,
    );
  }

  const license = (await findLicenseByToken(parsed.data.token)) as LicenseRow | null;
  if (!license) {
    const sentHash = await hashToken(parsed.data.token);
    await logEvent({
      event_type: "invalid_attempt",
      metadata: {
        bucket,
        token_last4: parsed.data.token.slice(-4),
        sent_hash: sentHash,
        error: "Token not found in database",
        policy: "account_token",
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
  if (snapshot.role !== "extension") {
    await logEvent({
      license_id: license.id,
      user_id: license.user_id,
      event_type: "product_mismatch",
      metadata: {
        requested_role: "extension",
        license_role: snapshot.role,
        requested_product: parsed.data.product ?? null,
        license_slug: snapshot.slug,
      },
    });
    return respond(
      {
        success: false,
        valid: false,
        error: "LICENSE_PRODUCT_MISMATCH",
        code: "LICENSE_PRODUCT_MISMATCH",
        message: "Este token não é válido para este produto.",
      },
      403,
    );
  }

  const sentEmail = parsed.data.email.trim().toLowerCase();
  const { data: owner } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", license.user_id)
    .maybeSingle();
  const ownerEmail = String((owner as any)?.email ?? "").trim().toLowerCase();

  if (!ownerEmail || ownerEmail !== sentEmail) {
    await logEvent({
      license_id: license.id,
      user_id: license.user_id,
      event_type: "email_mismatch",
      metadata: { bucket, policy: "account_token" },
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

  // Somente a PRIMEIRA ativação inicia a contagem. Reinstalações não entram
  // neste bloco porque a licença já está active e mantém os mesmos timestamps.
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

  const active = license.status === "active";
  const now = new Date().toISOString();
  await supabaseAdmin.from("licenses").update({ last_validation: now }).eq("id", license.id);

  await logEvent({
    license_id: license.id,
    user_id: license.user_id,
    event_type: bucket === "heartbeat" ? "heartbeat" : "validated",
    device_hash: null,
    metadata: {
      product: parsed.data.product ?? null,
      expected_role: "extension",
      license_role: snapshot.role,
      extension_version: parsed.data.extension_version ?? null,
      policy: "account_token",
    },
  });

  if (!active) {
    const failure = inactiveLicenseResponse(license);
    return respond(
      {
        success: false,
        valid: false,
        status: license.status.toUpperCase(),
        error: failure.code,
        code: failure.code,
        message: failure.message,
        expiresAt: license.expires_at,
        timestamp: Date.now(),
      },
      403,
    );
  }

  const responseData = {
    success: true,
    valid: true,
    status: license.status.toUpperCase(),
    action: null,
    license: {
      status: license.status.toUpperCase(),
      plan: snapshot.slug,
      plan_name: snapshot.name,
      expires_at: license.expires_at,
      activated_at: license.activated_at ?? null,
      // 0 = política sem vínculo por dispositivo para a extensão principal.
      max_devices: 0,
      devices_used: 0,
      features: snapshot.features,
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
