import { createFileRoute } from "@tanstack/react-router";
import {
  extensionIntegrityPreflight,
  handleExtensionIntegrityGate,
} from "@/lib/extension-integrity-gate.server";

export const Route = createFileRoute("/api/extension/integrity")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionIntegrityPreflight(request),
      POST: ({ request }) => handleExtensionIntegrityGate(request),
    },
  },
});
