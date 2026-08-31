import { createFileRoute } from "@tanstack/react-router";
import { findLicenseByToken, isTrustedExtensionOrigin, rateLimit } from "@/lib/license.server";

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

function isActive(row: any) {
  if (!row || String(row.status).toLowerCase() !== "active") return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  if (row.revoked_at) return false;
  return true;
}

async function handle(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) return json(request, { ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);

  const token = bearer(request);
  if (!token) return json(request, { ok: false, active: false, code: "LICENSE_REQUIRED" }, 401);
  const license = (await findLicenseByToken(token)) as any;
  if (!isActive(license)) return json(request, { ok: false, active: false, code: "LICENSE_INVALID" }, 401);

  if (!(await rateLimit("extension-license-identity", String(license.id), 120))) {
    return json(request, { ok: false, active: false, code: "RATE_LIMITED" }, 429);
  }

  return json(request, {
    ok: true,
    active: true,
    user_id: String(license.user_id),
    license_id: String(license.id),
    status: "active",
    expires_at: license.expires_at ?? null,
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
