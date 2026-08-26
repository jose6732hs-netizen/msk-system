import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/cron/reconcile-payments
 * Header obrigatório: x-cron-secret: <CRON_SECRET>
 * Consulta no gateway todas as transações abertas/expiradas recentes e
 * liquida as que já foram pagas (fallback quando o webhook não chega).
 */
export const Route = createFileRoute("/api/public/cron/reconcile-payments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const sent = request.headers.get("x-cron-secret") ?? "";
        if (!secret || sent !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { reconcileOpenTransactions } = await import("@/lib/reconcile.server");
        const result = await reconcileOpenTransactions({ hours: 72, limit: 100 });
        return Response.json(result);
      },
    },
  },
});
