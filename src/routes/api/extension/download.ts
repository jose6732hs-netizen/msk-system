import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionDownload } from "@/lib/extension-telemetry.server";
import { enforceExtensionDeviceSecurity, extensionSecurityPreflight } from "@/lib/extension-device-security.server";

export const Route = createFileRoute("/api/extension/download")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionSecurityPreflight(request),
      GET: async ({ request }) => (await enforceExtensionDeviceSecurity(request)) ?? handleExtensionDownload(request),
    },
  },
});
