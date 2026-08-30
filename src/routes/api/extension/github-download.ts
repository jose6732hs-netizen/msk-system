import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionGithubDownload } from "@/lib/extension-github-download.server";
import { enforceExtensionDeviceSecurity, extensionSecurityPreflight } from "@/lib/extension-device-security.server";

export const Route = createFileRoute("/api/extension/github-download")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionSecurityPreflight(request),
      POST: async ({ request }) => (await enforceExtensionDeviceSecurity(request)) ?? handleExtensionGithubDownload(request),
    },
  },
});
