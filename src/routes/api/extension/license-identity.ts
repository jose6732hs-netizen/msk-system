import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  findLicenseByToken,
  isTrustedExtensionOrigin,
  logEvent,
  rateLimit,
} from "@/lib/license.server";

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = !origin || isTrustedExtensionOrigin(origin);
  return {
    ...(origin && allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors(request),
    },
  });
}

function bearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parseTime(value: unknown) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

async function handle(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) {
    return json(request, { ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
  }

  const token = bearer(request);
  if (!token) return json(request, { ok: false, active: false, code: "LICENSE_REQUIRED" }, 401);

  const body = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>;
  const providedEmail = normalizeEmail(body["email"]);

  const license = (await findLicenseByToken(token)) as any;
  if (!license) {
    return json(request, { ok: false, active: false, code: "LICENSE_INVALID" }, 401);
  }

  // Erros diferenciados — nunca agrupar em LICENSE_INVALID.
  if (license.revoked_at || String(license.status).toLowerCase() === "revoked") {
    return json(request, { ok: false, active: false, code: "LICENSE_REVOKED" }, 401);
  }
  const status = String(license.status).toLowerCase();
  if (status === "suspended" || status === "blocked") {
    return json(request, { ok: false, active: false, code: "LICENSE_BLOCKED" }, 401);
  }

  const now = Date.now();
  if (license.starts_at && parseTime(license.starts_at) > now) {
    return json(request, { ok: false, active: false, code: "LICENSE_NOT_STARTED" }, 401);
  }

  if (!(await rateLimit("extension-license-identity", String(license.id), 120))) {
    return json(request, { ok: false, active: false, code: "RATE_LIMITED" }, 429);
  }

  // Validação de e-mail em TODA validação de licença, antes de qualquer sucesso.
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
    String(license.user_id),
  );
  const realEmail = normalizeEmail(userData?.user?.email);
  if (userError || !realEmail || !providedEmail || realEmail !== providedEmail) {
    await logEvent({
      license_id: String(license.id),
      user_id: String(license.user_id),
      event_type: "license_email_mismatch",
      metadata: { provided_email_present: !!providedEmail },
    });
    return json(request, { ok: false, active: false, code: "LICENSE_EMAIL_MISMATCH" }, 401);
  }

  const alreadyActivated = !!license.activated_at;

  if (!alreadyActivated) {
    // Primeiro uso legítimo: licença nunca usada (activated_at null).
    // O expires_at pré-calculado é apenas referência de duração; recalcula a partir de agora.
    const metadata = { ...((license.metadata ?? {}) as Record<string, unknown>) };
    let durationMs = Number(metadata["pending_duration_ms"] ?? 0);
    if (!(durationMs > 0)) {
      durationMs = parseTime(license.expires_at) - parseTime(license.created_at);
    }
    const activatedAt = new Date(now).toISOString();
    const expiresAt = durationMs > 0 ? new Date(now + durationMs).toISOString() : (license.expires_at ?? null);
    delete metadata["pending_duration_ms"];

    const { error: updateError } = await supabaseAdmin
      .from("licenses")
      .update({
        status: "active",
        activated_at: activatedAt,
        expires_at: expiresAt,
        metadata,
        activation_count: Number(license.activation_count ?? 0) + 1,
      } as never)
      .eq("id", String(license.id))
      .is("activated_at", null)
      .neq("status", "revoked");

    if (updateError) {
      return json(request, { ok: false, active: false, code: "LICENSE_INVALID" }, 401);
    }

    await logEvent({
      license_id: String(license.id),
      user_id: String(license.user_id),
      event_type: "first_activation",
      metadata: { duration_ms: durationMs > 0 ? durationMs : null },
    });

    return json(request, {
      ok: true,
      active: true,
      user_id: String(license.user_id),
      license_id: String(license.id),
      email: realEmail,
      status: "active",
      activated_at: activatedAt,
      expires_at: expiresAt,
      first_activation: true,
    });
  }

  // Licença já ativada — nunca reativar.
  if (license.expires_at && parseTime(license.expires_at) <= now) {
    return json(request, { ok: false, active: false, code: "LICENSE_EXPIRED" }, 401);
  }

  return json(request, {
    ok: true,
    active: true,
    user_id: String(license.user_id),
    license_id: String(license.id),
    email: realEmail,
    status: "active",
    activated_at: license.activated_at ?? null,
    expires_at: license.expires_at ?? null,
    first_activation: false,
  });
}

export const Route = createFileRoute("/api/extension/license-identity")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
      POST: ({ request }) => handle(request),
    },
  },
});
