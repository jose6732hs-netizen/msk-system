import { createFileRoute } from "@tanstack/react-router";
import { extensionPreflight, handleExtensionVersion } from "@/lib/extension-telemetry.server";

export const Route = createFileRoute("/api/extension/version")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      GET: ({ request }) => handleExtensionVersion(request),
    },
  },
});
