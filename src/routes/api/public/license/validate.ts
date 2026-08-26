import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleAccountTokenValidation } from "@/lib/account-license-validate.server";

export const Route = createFileRoute("/api/public/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: ({ request }) => handleAccountTokenValidation(request, "validate", 60, "extension"),
    },
  },
});
