import { createFileRoute } from "@tanstack/react-router";
import { preflight, findLicenseByToken } from "@/lib/license.server";
import { handleUnifiedLicenseValidation } from "@/lib/unified-license-validate.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const INSTALLATION_RE = /^[A-Za-z0-9_-]{16,80}$/;
const VERSION_RE = /^[0-9A-Za-z.+_-]{1,64}$/;
const EXTENSION_ALLOW_HEADERS = "content-type, authorization, x-msk-installation-id, x-msk-extension-version";

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
      "access-control-allow-headers": EXTENSION_ALLOW_HEADERS,
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
  headers.set("access-control-allow-headers", EXTENSION_ALLOW_HEADERS);
  headers.set("access-control-allow-methods", "POST, GET, OPTIONS");
  headers.set("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function registerAgentInstallation(
  body: Record<string, unknown> | null,
  validationResponse: Response,
) {
  try {
    if (!body || !validationResponse.ok) return;
    const result = (await validationResponse.clone().json().catch(() => null)) as any;
    if (!result?.valid || String(result?.license?.role || "") !== "agent") return;

    const installationId = String(body["installation_id"] ?? body["device_fingerprint"] ?? "").trim();
    const version = String(body["extension_version"] ?? body["version"] ?? "unknown").trim();
    const token = String(body["token"] ?? "").trim();
    if (!INSTALLATION_RE.test(installationId) || !VERSION_RE.test(version) || !token) return;

    const license = (await findLicenseByToken(token)) as any;
    if (!license || String(license.status) !== "active") return;
    const expiresAt = license.expires_at ? Date.parse(license.expires_at) : null;
    if (expiresAt && expiresAt <= Date.now()) return;

    const db = supabaseAdmin as any;
    const now = new Date().toISOString();
    const { data: existing } = await db
      .from("extension_installations")
      .select("id,user_id")
      .eq("installation_id", installationId)
      .maybeSingle();

    // Nunca transfere silenciosamente uma instalação entre contas.
    if (existing && String(existing.user_id) !== String(license.user_id)) return;

    const patch = {
      license_id: license.id,
      version,
      last_seen_at: now,
      last_activity_at: now,
      metadata: { source: "license_validation", role: "agent" },
    };

    if (existing?.id) {
      await db
        .from("extension_installations")
        .update(patch)
        .eq("id", existing.id)
        .eq("user_id", license.user_id);
    } else {
      await db.from("extension_installations").insert({
        user_id: license.user_id,
        installation_id: installationId,
        ...patch,
      });
    }
  } catch {
    // Telemetria nunca pode derrubar uma validação de licença válida.
  }
}

/**
 * Endpoint único do banco central de licenças MSK.
 * A validação continua independente de IP/navegador, mas quando uma extensão
 * Agent válida informa installation_id ela também passa a aparecer na Central.
 */
export const Route = createFileRoute("/api/public/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      POST: async ({ request }) => {
        const body = (await request.clone().json().catch(() => null)) as Record<string, unknown> | null;
        const response = await handleUnifiedLicenseValidation(request, "validate", 60);
        await registerAgentInstallation(body, response);
        return withExtensionCors(response, request);
      },
    },
  },
});
