import { createFileRoute } from "@tanstack/react-router";
import { hardeningPreflight, handleHardeningSession } from "@/lib/extension-hardening-v1.server";

export const Route = createFileRoute("/api/extension/session")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => hardeningPreflight(request),
      POST: ({ request }) => handleHardeningSession(request),
    },
  },
});
