import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  findLicenseByToken,
  hashValue,
  jsonResponse,
  logEvent,
  preflight,
  rateLimit,
  signData,
} from "@/lib/license.server";
import { resolveLicenseSnapshot } from "@/lib/license-entitlements.server";
import { resolvePlanDuration } from "@/lib/plan-duration";
import { handleUnifiedLicenseValidation } from "@/lib/unified-license-validate.server";
import { isAgentUserRemotelyBlocked } from "@/lib/extension-remote-control.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const fastSchema = z.object({
  token: z.string().min(8).max(64),
  email: z.string().email().max(160),
  extension_version: z.string().max(32).optional(),
  product: z.string().max(40).optional(),
});

function browserExtensionOrigin(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
    return origin;
  }
  return null;
}

function extensionPreflight(request: Request) {
  const origin = browserExtensionOrigin(request);
  if (!origin) return preflight(request);
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-max-age": "86400",
      vary: "Origin",
    },
  });
}

function withExtensionCors(response: Response, request: Request) {
  const origin = browserExtensionOrigin(request);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-headers", "content-type, authorization");
  headers.set("access-control-allow-methods", "POST, GET, OPTIONS");
  headers.set("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function durationForFastActivation(license: any, snapshot: ReturnType<typeof resolveLicenseSnapshot>) {
  const metadata =
    license?.metadata && typeof license.metadata === "object" && !Array.isArray(license.metadata)
      ? (license.metadata as Record<string, unknown>)
      : {};

  const pending = Number(metadata["pending_duration_ms"] ?? 0);
  if (pending > 0) return { lifetime: false, milliseconds: pending };

  if (metadata["plan_is_lifetime_snapshot"] === true || snapshot.isLifetime) {
    return { lifetime: true, milliseconds: null };
  }

  const snapValue = Number(metadata["plan_duration_value_snapshot"] ?? 0);
  const snapUnit = String(metadata["plan_duration_unit_snapshot"] ?? "").trim();
  if (snapValue > 0 && snapUnit) {
    const duration = resolvePlanDuration({ duration_value: snapValue, duration_unit: snapUnit });
    return { lifetime: duration.lifetime, milliseconds: duration.milliseconds };
  }

  const snapDays = Number(metadata["plan_duration_snapshot"] ?? 0);
  if (snapDays > 0) {
    const duration = resolvePlanDuration({ duration_value: snapDays, duration_unit: "days" });
    return { lifetime: duration.lifetime, milliseconds: duration.milliseconds };
  }

  const duration = resolvePlanDuration({
    name: snapshot.name,
    slug: snapshot.slug,
    duration_label: snapshot.durationLabel,
    duration_days: snapshot.durationDays,
    duration_value: snapshot.durationValue,
    duration_unit: snapshot.durationUnit,
    is_lifetime: snapshot.isLifetime,
    allow_trial: Boolean(license?.plans?.allow_trial),
    price: snapshot.price,
  });
  return { lifetime: duration.lifetime, milliseconds: duration.milliseconds };
}

/**
 * Fast path para licenças inequivocamente do MSK Agente.
 *
 * ACTIVE e primeira ativação INACTIVE evitam o pipeline de compatibilidade,
 * produto, telemetria e instalação que antes bloqueava a tela de KEY. Qualquer
 * licença legada/ambígua continua caindo na política completa existente.
 */
async function tryFastAgentValidation(
  request: Request,
  rawInput: Record<string, unknown> | null,
): Promise<Response | null> {
  const parsed = fastSchema.safeParse(rawInput);
  if (!parsed.success) return null;

  try {
    let license: any = await findLicenseByToken(parsed.data.token);
    if (!license) return null;

    let status = String(license.status ?? "").toLowerCase();
    if (status !== "active" && status !== "inactive") return null;

    const currentExpiry = license.expires_at ? Date.parse(String(license.expires_at)) : Number.NaN;
    if (Number.isFinite(currentExpiry) && currentExpiry <= Date.now()) return null;

    let snapshot = resolveLicenseSnapshot(license);
    const role = String(snapshot.role ?? "").toLowerCase();
    const slug = String(snapshot.slug ?? license?.plans?.slug ?? "").toLowerCase();
    const clearlyAgent =
      role === "agent" ||
      slug.startsWith("msk-agent") ||
      snapshot.features?.["agent"] === true ||
      snapshot.features?.["product_type"] === "agent";

    if (!clearlyAgent) return null;

    const email = parsed.data.email.trim().toLowerCase();
    const credentialKey = await hashValue(
      `agent::${email}::${parsed.data.token.trim().toUpperCase()}`,
    );

    // As três verificações independentes começam juntas.
    const [allowed, ownerResult, control] = await Promise.all([
      rateLimit("agent-fast-validate", `account:${credentialKey}`, 120),
      supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", license.user_id)
        .maybeSingle(),
      isAgentUserRemotelyBlocked(String(license.user_id)),
    ]);

    if (!allowed) {
      return jsonResponse(
        {
          success: false,
          valid: false,
          error: "RATE_LIMITED",
          code: "RATE_LIMITED",
          message: "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
          timestamp: Date.now(),
        },
        429,
        request,
      );
    }

    const ownerEmail = String((ownerResult.data as any)?.email ?? "").trim().toLowerCase();
    // Conta antiga sem e-mail em profiles usa o fluxo robusto, que consulta o Auth.
    if (!ownerEmail) return null;

    if (ownerEmail !== email) {
      return jsonResponse(
        {
          success: false,
          valid: false,
          error: "EMAIL_MISMATCH",
          code: "EMAIL_MISMATCH",
          message: "Este e-mail não corresponde ao dono desta licença.",
          timestamp: Date.now(),
        },
        403,
        request,
      );
    }

    if (control?.blocked) {
      return jsonResponse(
        {
          success: false,
          valid: false,
          status: "BLOCKED",
          error: "EXTENSION_BLOCKED",
          code: "EXTENSION_BLOCKED",
          message:
            control.block_message ||
            "Seu acesso ao MSK Agente está temporariamente bloqueado.",
          reason: control.block_reason || null,
          timestamp: Date.now(),
        },
        403,
        request,
      );
    }

    // Primeira ativação também usa caminho curto. O compare-and-set impede duas
    // instalações simultâneas de reiniciarem a validade.
    if (status === "inactive") {
      const activatedAt = new Date();
      const duration = durationForFastActivation(license, snapshot);
      const patch: Record<string, unknown> = {
        status: "active",
        activated_at: activatedAt.toISOString(),
      };
      if (!license.expires_at && !duration.lifetime && Number(duration.milliseconds ?? 0) > 0) {
        patch["expires_at"] = new Date(
          activatedAt.getTime() + Number(duration.milliseconds),
        ).toISOString();
      }

      const { data: activated, error: activationError } = await supabaseAdmin
        .from("licenses")
        .update(patch as never)
        .eq("id", license.id)
        .eq("status", "inactive")
        .select("status,activated_at,expires_at")
        .maybeSingle();

      if (activationError) return null;

      if (activated) {
        license.status = String((activated as any).status ?? "active");
        license.activated_at = (activated as any).activated_at ?? license.activated_at ?? null;
        license.expires_at = (activated as any).expires_at ?? license.expires_at ?? null;
      } else {
        // Outra requisição venceu a ativação; apenas lê o estado oficial atual.
        const refreshed: any = await findLicenseByToken(parsed.data.token);
        if (!refreshed || String(refreshed.status ?? "").toLowerCase() !== "active") return null;
        license = refreshed;
        snapshot = resolveLicenseSnapshot(license);
      }
      status = "active";
    }

    if (status !== "active") return null;

    const responseData = {
      success: true,
      valid: true,
      status: "ACTIVE",
      action: null,
      license: {
        status: "ACTIVE",
        plan: snapshot.slug,
        plan_name: snapshot.name,
        expires_at: license.expires_at ?? null,
        activated_at: license.activated_at ?? null,
        max_devices: 0,
        devices_used: 0,
        features: snapshot.features,
        role: "agent",
        scope: "agent",
        product_slug: snapshot.slug,
      },
      expiresAt: license.expires_at ?? null,
      email_required: true,
      planName: snapshot.name,
      planSlug: snapshot.slug,
      timestamp: Date.now(),
    };

    const signature = await signData(JSON.stringify(responseData));

    // Telemetria não segura mais a resposta da tela de KEY.
    void Promise.allSettled([
      supabaseAdmin
        .from("licenses")
        .update({ last_validation: new Date().toISOString() })
        .eq("id", license.id),
      logEvent({
        license_id: license.id,
        user_id: license.user_id,
        event_type: "validated_fast",
        device_hash: null,
        metadata: {
          product: parsed.data.product ?? "msk-agent",
          expected_role: "agent",
          license_role: snapshot.role,
          extension_version: parsed.data.extension_version ?? null,
          policy: "account_token_fast",
        },
      }),
    ]).catch(() => undefined);

    return jsonResponse({ ...responseData, signature }, 200, request);
  } catch {
    // Qualquer situação inesperada cai para a política completa já existente.
    return null;
  }
}

/**
 * Endpoint oficial da tela de KEY do MSK Agente.
 *
 * - ACTIVE/INACTIVE inequívoca do Agente: caminho curto;
 * - legado, conta antiga ou ambiguidade: política completa existente.
 */
export const Route = createFileRoute("/api/public/agent/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      POST: async ({ request }) => {
        const input = (await request.clone().json().catch(() => null)) as Record<
          string,
          unknown
        > | null;

        const fast = await tryFastAgentValidation(request, input);
        if (fast) return withExtensionCors(fast, request);

        const response = await handleUnifiedLicenseValidation(
          request,
          "agent-validate",
          120,
        );
        return withExtensionCors(response, request);
      },
    },
  },
});
