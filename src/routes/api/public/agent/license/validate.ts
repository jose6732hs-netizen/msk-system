import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleAccountTokenValidation } from "@/lib/account-license-validate.server";

/**
 * Validação exclusiva do MSK Agente.
 * Um token da Extensão ou do Clonador nunca é aceito nesta rota.
 */
export const Route = createFileRoute("/api/public/agent/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: ({ request }) => handleAccountTokenValidation(request, "agent-validate", 60, "agent"),
    },
  },
});
