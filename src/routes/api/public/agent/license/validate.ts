import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleValidation } from "@/lib/license-validate.server";

/**
 * Validação exclusiva do MSK Agente.
 * Um token da Extensão ou do Clonador nunca é aceito nesta rota.
 */
export const Route = createFileRoute("/api/public/agent/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: ({ request }) => handleValidation(request, "agent-validate", 60, "agent"),
    },
  },
});
