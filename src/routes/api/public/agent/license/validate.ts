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

/**
 * Fast path para uma licença do MSK Agente que já está ACTIVE.
 *
 * A rota robusta continua existindo para primeira ativação, licenças legadas,
 * reconciliação de produto e qualquer caso ambíguo. O objetivo aqui é tirar do
 * caminho crítico as consultas e gravações extras que faziam clientes já ativos
 * esperar vários segundos só para abrir o Agente.
 */
async function tryFastActiveAgentValidation(
  request: Request,
  rawInput: Record<string, unknown> | null,
): Promise<Response | null> {
  const parsed = fastSchema.safeParse(rawInput);
  if (!parsed.success) return null;

  try {
    const license: any = await findLicenseByToken(parsed.data.token);
    if (!license || String(license.status ?? "").toLowerCase() !== "active") return null;

    const expiresAt = license.expires_at ? Date.parse(String(license.expires_at)) : Number.NaN;
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return null;

    const snapshot = resolveLicenseSnapshot(license);
    const role = String(snapshot.role ?? "").toLowerCase();
    const slug = String(snapshot.slug ?? license?.plans?.slug ?? "").toLowerCase();

    // Só usa o atalho quando o snapshot é inequivocamente do Agente.
    // Casos legados/ambíguos continuam na validação robusta abaixo.
    if (role !== "agent" && !slug.startsWith("msk-agent")) return null;

    const email = parsed.data.email.trim().toLowerCase();
    const credentialKey = await hashValue(
      `agent::${email}::${parsed.data.token.trim().toUpperCase()}`,
    );

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
 * - ACTIVE inequívoca do Agente: fast path de poucas consultas em paralelo;
 * - primeira ativação, legado ou ambiguidade: política completa existente.
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

        const fast = await tryFastActiveAgentValidation(request, input);
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
