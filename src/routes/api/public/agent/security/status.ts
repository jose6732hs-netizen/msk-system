import { createFileRoute } from "@tanstack/react-router";
import {
  agentExtensionSecurityPreflight,
  handleAgentExtensionSecurityStatus,
} from "@/lib/agent-extension-security.server";

export const Route = createFileRoute("/api/public/agent/security/status")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => agentExtensionSecurityPreflight(request),
      POST: ({ request }) => handleAgentExtensionSecurityStatus(request),
    },
  },
});
