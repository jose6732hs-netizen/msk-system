import { createFileRoute } from "@tanstack/react-router";
import { extensionPreflight, handleExtensionError } from "@/lib/extension-telemetry.server";

export const Route = createFileRoute("/api/extension/errors")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      POST: ({ request }) => handleExtensionError(request),
    },
  },
});
