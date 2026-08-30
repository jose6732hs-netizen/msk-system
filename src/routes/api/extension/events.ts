import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionEvent } from "@/lib/extension-telemetry.server";
import { enforceExtensionDeviceSecurity, extensionSecurityPreflight } from "@/lib/extension-device-security.server";

export const Route = createFileRoute("/api/extension/events")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionSecurityPreflight(request),
      POST: async ({ request }) => (await enforceExtensionDeviceSecurity(request)) ?? handleExtensionEvent(request),
    },
  },
});
