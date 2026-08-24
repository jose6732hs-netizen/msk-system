import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/sigilopay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleGatewayWebhook } = await import("@/lib/payments/webhook-handler.server");
        return handleGatewayWebhook("sigilopay", request);
      },
    },
  },
});
