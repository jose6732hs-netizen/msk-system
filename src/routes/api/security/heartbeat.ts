import { createFileRoute } from "@tanstack/react-router";
import { hardeningPreflight, handleHardeningHeartbeat } from "@/lib/extension-hardening-v1.server";

export const Route = createFileRoute("/api/security/heartbeat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => hardeningPreflight(request),
      POST: ({ request }) => handleHardeningHeartbeat(request),
    },
  },
});
