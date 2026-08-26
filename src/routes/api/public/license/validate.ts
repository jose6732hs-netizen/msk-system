import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleValidation } from "@/lib/license-validate.server";

export const Route = createFileRoute("/api/public/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: ({ request }) => handleValidation(request, "validate", 60, "extension"),
    },
  },
});