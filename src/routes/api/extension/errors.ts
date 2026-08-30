import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionError } from "@/lib/extension-telemetry.server";
import { enforceExtensionDeviceSecurity, extensionSecurityPreflight } from "@/lib/extension-device-security.server";

export const Route = createFileRoute("/api/extension/errors")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionSecurityPreflight(request),
      POST: async ({ request }) => (await enforceExtensionDeviceSecurity(request)) ?? handleExtensionError(request),
    },
  },
});
