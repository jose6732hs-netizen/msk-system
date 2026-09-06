import { createFileRoute } from "@tanstack/react-router";
import { preflight, findLicenseByToken, jsonResponse } from "@/lib/license.server";
import { handleUnifiedLicenseValidation } from "@/lib/unified-license-validate.server";
import { isAgentUserRemotelyBlocked } from "@/lib/extension-remote-control.server";

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
 * Endpoint oficial da tela de KEY do MSK Agente.
 *
 * Usa a mesma política account-token do endpoint central e do heartbeat:
 * - valida e-mail + token no banco central;
 * - aceita escopo agent e extension legado;
 * - preserva produto, status, validade/expiração e bloqueio remoto;
 * - não prende a autorização a reinstalação/fingerprint/dispositivo.
 */
export const Route = createFileRoute("/api/public/agent/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      POST: async ({ request }) => {
        const input = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
        const response = await handleUnifiedLicenseValidation(
          request,
          "agent-validate",
          120,
        );
        if (!response.ok) return withExtensionCors(response, request);

        const body = await response.clone().json().catch(() => null) as Record<string, unknown> | null;
        if (body?.["valid"] === true && typeof input?.["token"] === "string") {
          const license: any = await findLicenseByToken(String(input["token"]));
          if (license?.user_id) {
            const control = await isAgentUserRemotelyBlocked(String(license.user_id));
            if (control?.blocked) {
              const blocked = jsonResponse({
                success: false,
                valid: false,
                status: "BLOCKED",
                error: "EXTENSION_BLOCKED",
                code: "EXTENSION_BLOCKED",
                message: control.block_message || "Seu acesso ao MSK Agente está temporariamente bloqueado.",
                reason: control.block_reason || null,
                timestamp: Date.now(),
              }, 403, request);
              return withExtensionCors(blocked, request);
            }
          }
        }

        return withExtensionCors(response, request);
      },
    },
  },
});
