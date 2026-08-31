import { createFileRoute } from "@tanstack/react-router";
import { hardeningPreflight, handleHardeningIntegrity } from "@/lib/extension-hardening-v1.server";

export const Route = createFileRoute("/api/extension/integrity")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => hardeningPreflight(request),
      POST: ({ request }) => handleHardeningIntegrity(request),
    },
  },
});
