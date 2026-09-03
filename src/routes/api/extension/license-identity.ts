import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashToken, isTrustedExtensionOrigin, logEvent } from "@/lib/license.server";

const db = supabaseAdmin as any;

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
      "cache-control": "no-store, no-cache, must-revalidate",
      ...cors(request),
    },
  });
}

function bearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function time(value: unknown) {
  const ms = value ? Date.parse(String(value)) : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function inactiveCode(row: any) {
  const status = String(row?.status ?? "").toLowerCase();
  if (row?.revoked_at || status === "revoked") return "LICENSE_REVOKED";
  if (["blocked", "suspended", "disabled"].includes(status)) return "LICENSE_BLOCKED";
  if (row?.expires_at && time(row.expires_at) <= Date.now()) return "LICENSE_EXPIRED";
  return "LICENSE_INVALID";
}

function active(row: any) {
  if (!row || String(row.status ?? "").toLowerCase() !== "active") return false;
  if (row.revoked_at) return false;
  const expires = time(row.expires_at);
  return !expires || expires > Date.now();
}

function durationFromFreshLicense(row: any) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const snap = Number((metadata as any).pending_duration_ms ?? 0);
  if (snap > 0) return snap;
  const created = time(row?.created_at);
  const expires = time(row?.expires_at);
  return created > 0 && expires > created ? expires - created : 0;
}

async function activateFirstUse(row: any) {
  const status = String(row?.status ?? "").toLowerCase();
  if (row?.activated_at || row?.revoked_at) return { row, activatedNow: false };
  if (!["inactive", "expired"].includes(status)) return { row, activatedNow: false };

  const durationMs = durationFromFreshLicense(row);
  const now = new Date();
  const activatedAt = now.toISOString();
  const expiresAt = durationMs > 0 ? new Date(now.getTime() + durationMs).toISOString() : null;
  const metadata = {
    ...((row?.metadata && typeof row.metadata === "object") ? row.metadata : {}),
    first_activated_at: activatedAt,
    ...(durationMs > 0 ? { pending_duration_ms: durationMs } : {}),
  };

  const { data, error } = await db
    .from("licenses")
    .update({
      status: "active",
      activated_at: activatedAt,
      expires_at: expiresAt,
      metadata,
    })
    .eq("id", String(row.id))
    .is("activated_at", null)
    .in("status", ["inactive", "expired"])
    .select("id,user_id,status,created_at,activated_at,expires_at,revoked_at,revocation_reason,metadata")
    .maybeSingle();

  if (error || !data) return { row, activatedNow: false };

  logEvent({
    license_id: String(data.id),
    user_id: String(data.user_id),
    event_type: "first_activated",
    metadata: { expires_at: data.expires_at ?? null },
  }).catch(() => {});

  return { row: data, activatedNow: true };
}

async function handle(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) {
    return json(request, { ok: false, active: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
  }

  const token = bearer(request);
  if (!token) return json(request, { ok: false, active: false, code: "LICENSE_REQUIRED" }, 401);

  const tokenHash = await hashToken(token);
  const { data: found, error } = await db
    .from("licenses")
    .select("id,user_id,status,created_at,activated_at,expires_at,revoked_at,revocation_reason,metadata")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("[license-identity] lookup failed", error.message);
    return json(request, { ok: false, active: false, code: "LICENSE_SERVICE_UNAVAILABLE" }, 503);
  }
  if (!found) return json(request, { ok: false, active: false, code: "LICENSE_INVALID" }, 401);

  let license: any = found;
  let activatedNow = false;

  if (!active(license) && !license.activated_at && !license.revoked_at) {
    const activation = await activateFirstUse(license);
    license = activation.row;
    activatedNow = activation.activatedNow;
  }

  if (!active(license)) {
    const code = inactiveCode(license);
    if (code === "LICENSE_EXPIRED" && String(license.status).toLowerCase() === "active") {
      db.from("licenses").update({ status: "expired" }).eq("id", String(license.id)).then(() => {}).catch(() => {});
    }
    return json(request, {
      ok: false,
      active: false,
      code,
      status: String(license.status ?? "invalid"),
      expires_at: license.expires_at ?? null,
    }, 401);
  }

  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedEmail = String(input.email ?? "").trim().toLowerCase();

  return json(request, {
    ok: true,
    active: true,
    user_id: String(license.user_id),
    license_id: String(license.id),
    email: requestedEmail || null,
    status: "active",
    activated_at: license.activated_at ?? license.created_at ?? null,
    expires_at: license.expires_at ?? null,
    first_activation: activatedNow,
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
