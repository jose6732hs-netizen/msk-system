import { createFileRoute } from "@tanstack/react-router";
import { handleSecurityHandshake, securityCenterPreflight } from "@/lib/security-center.server";

export const Route = createFileRoute("/api/security/handshake")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => securityCenterPreflight(request),
      POST: ({ request }) => handleSecurityHandshake(request),
    },
  },
});
