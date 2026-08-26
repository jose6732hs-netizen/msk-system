import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleAccountTokenValidation } from "@/lib/account-license-validate.server";

export const Route = createFileRoute("/api/public/license/heartbeat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: ({ request }) => handleAccountTokenValidation(request, "heartbeat", 30, "extension"),
    },
  },
});
