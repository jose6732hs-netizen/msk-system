import { createFileRoute } from "@tanstack/react-router";
import { extensionPreflight, handleExtensionDownload } from "@/lib/extension-telemetry.server";

export const Route = createFileRoute("/api/extension/download")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      GET: ({ request }) => handleExtensionDownload(request),
    },
  },
});
