import { createFileRoute } from "@tanstack/react-router";
import { extensionSecurityPreflight, handleExtensionSecuritySession } from "@/lib/extension-device-security.server";

export const Route = createFileRoute("/api/extension/session")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionSecurityPreflight(request),
      POST: ({ request }) => handleExtensionSecuritySession(request),
    },
  },
});
