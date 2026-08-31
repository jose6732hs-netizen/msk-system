import { createFileRoute } from "@tanstack/react-router";
import { handleSecurityChallenge, securityCenterPreflight } from "@/lib/security-center.server";

export const Route = createFileRoute("/api/security/challenge")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => securityCenterPreflight(request),
      POST: ({ request }) => handleSecurityChallenge(request),
    },
  },
});
