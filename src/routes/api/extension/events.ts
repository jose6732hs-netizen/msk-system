import { createFileRoute } from "@tanstack/react-router";
import { extensionPreflight, handleExtensionEvent } from "@/lib/extension-telemetry.server";

export const Route = createFileRoute("/api/extension/events")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      POST: ({ request }) => handleExtensionEvent(request),
    },
  },
});
