import { createFileRoute } from "@tanstack/react-router";
import {
  agentExtensionSecurityPreflight,
  handleAgentExtensionSecurityReport,
} from "@/lib/agent-extension-security.server";

export const Route = createFileRoute("/api/public/agent/security/report")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => agentExtensionSecurityPreflight(request),
      POST: ({ request }) => handleAgentExtensionSecurityReport(request),
    },
  },
});
