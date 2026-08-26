import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, preflight } from "@/lib/license.server";

/**
 * POST /api/public/cron/renew-licenses
 * Header obrigatório: x-cron-secret: <CRON_SECRET>
 * Agende a cada hora (pg_cron ou agendador externo).
 */
export const Route = createFileRoute("/api/public/cron/renew-licenses")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const sent = request.headers.get("x-cron-secret") ?? "";
        // fail-closed: sem segredo configurado, ninguém executa.
        if (!secret || sent !== secret) {
          return jsonResponse({ success: false, error: "UNAUTHORIZED" }, 401, request);
        }
        try {
          const { runLicenseRenewal } = await import("@/lib/license-renewal.server");
          return jsonResponse({ success: true, ...(await runLicenseRenewal()) }, 200, request);
        } catch (e) {
          console.error("[cron] Falha ao renovar licenças:", e instanceof Error ? e.message : "unknown_error");
          return jsonResponse(
            { success: false, error: "RENEWAL_FAILED" },
            500,
            request,
          );
        }
      },
    },
  },
});