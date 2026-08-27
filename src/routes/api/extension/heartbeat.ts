import { createFileRoute } from "@tanstack/react-router";
import { extensionPreflight, handleExtensionHeartbeat } from "@/lib/extension-telemetry.server";

export const Route = createFileRoute("/api/extension/heartbeat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      POST: ({ request }) => handleExtensionHeartbeat(request),
    },
  },
});
