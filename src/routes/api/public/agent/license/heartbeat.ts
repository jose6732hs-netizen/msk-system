import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleValidation } from "@/lib/license-validate.server";

/** Heartbeat exclusivo do MSK Agente; preserva isolamento entre produtos. */
export const Route = createFileRoute("/api/public/agent/license/heartbeat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: ({ request }) => handleValidation(request, "agent-heartbeat", 30, "agent"),
    },
  },
});
