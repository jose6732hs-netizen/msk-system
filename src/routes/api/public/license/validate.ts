import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleExtensionValidation } from "@/lib/extension-license-validate.server";

export const Route = createFileRoute("/api/public/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: ({ request }) => handleExtensionValidation(request, "validate", 60),
    },
  },
});
