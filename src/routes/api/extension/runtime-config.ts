import { createFileRoute } from "@tanstack/react-router";
import { supabaseServer } from "@/integrations/supabase/client.server";
import { findLicenseByToken, isTrustedExtensionOrigin, rateLimit } from "@/lib/license.server";

const DEFAULT_POLICY = {
  version: 1,
  editBudgets: {
    fast: { maxFiles: 1, maxChangedLines: 32, maxReplacementRatio: 0.12 },
    medium: { maxFiles: 4, maxChangedLines: 180, maxReplacementRatio: 0.32 },
    diagnostic: { maxFiles: 12, maxChangedLines: 600, maxReplacementRatio: 0.65 },
  },
  behavior: {
    askOnlyForProductDecisions: true,
    longPromptAutonomous: true,
    finalSummaryOnly: true,
    autoRetryFocusedPatch: true,
  },
  preview: {
    syncImmediately: true,
    pollBuild: true,
    autoRollbackOwnBrokenCommit: true,
  },
};

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = !origin || isTrustedExtensionOrigin(origin);
  return {
    ...(origin && allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "authorization, content-type, x-api-key, x-msk-extension-version, x-msk-installation-id, x-msk-extension-id",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=30", ...cors(request) },
  });
}

function credential(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() ?? "";
}

function activeLicense(row: any) {
  if (!row || String(row.status).toLowerCase() !== "active" || row.revoked_at) return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  return true;
}

async function handle(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) return json(request, { ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);

  const token = credential(request);
  if (!token) return json(request, { ok: false, code: "LICENSE_REQUIRED" }, 401);
  const license = (await findLicenseByToken(token)) as any;
  if (!activeLicense(license)) return json(request, { ok: false, code: "LICENSE_INVALID" }, 401);
  if (!(await rateLimit("extension-runtime-policy", String(license.id), 180))) return json(request, { ok: false, code: "RATE_LIMITED" }, 429);

  const { data, error } = await (supabaseServer as any)
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", "extension_runtime_policy")
    .maybeSingle();

  if (error) console.error("[MSK Extension] runtime policy query failed", error.message);
  const value = data?.value;
  const policy = value && typeof value === "object" ? { ...DEFAULT_POLICY, ...value } : DEFAULT_POLICY;
  return json(request, { ok: true, policy, updated_at: data?.updated_at ?? null });
}

export const Route = createFileRoute("/api/extension/runtime-config")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
      POST: ({ request }) => handle(request),
    },
  },
});
