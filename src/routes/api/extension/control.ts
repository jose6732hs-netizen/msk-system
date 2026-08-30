import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionRemoteControl } from "@/lib/extension-remote-control.server";
import { enforceExtensionDeviceSecurity, extensionSecurityPreflight } from "@/lib/extension-device-security.server";

async function secured(request: Request) {
  return (await enforceExtensionDeviceSecurity(request)) ?? handleExtensionRemoteControl(request);
}

export const Route = createFileRoute("/api/extension/control")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionSecurityPreflight(request),
      GET: ({ request }) => secured(request),
      POST: ({ request }) => secured(request),
    },
  },
});
