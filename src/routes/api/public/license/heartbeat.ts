import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleValidation } from "@/lib/license-validate.server";

export const Route = createFileRoute("/api/public/license/heartbeat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      // Heartbeat da extensão principal: token de outro produto nunca é aceito.
      POST: ({ request }) => handleValidation(request, "heartbeat", 30, "extension"),
    },
  },
});