import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionRemoteControl } from "@/lib/extension-remote-control.server";
import { enforceExtensionDeviceSecurity, extensionSecurityPreflight } from "@/lib/extension-device-security.server";
import { enforceExtensionIntegrityGate } from "@/lib/extension-integrity-gate.server";
import { enforceSecurityCenter } from "@/lib/security-center.server";

async function secured(request: Request) {
  return (
    (await enforceSecurityCenter(request)) ??
    (await enforceExtensionIntegrityGate(request)) ??
    (await enforceExtensionDeviceSecurity(request)) ??
    handleExtensionRemoteControl(request)
  );
}

function preflight(request: Request) {
  const legacy = extensionSecurityPreflight(request);
  const headers = new Headers(legacy.headers);
  const allowed = headers.get("access-control-allow-headers") ?? "";
  const extra = ["x-msk-license", "x-msk-security-session"];
  const current = new Set(allowed.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  for (const header of extra) current.add(header);
  headers.set("access-control-allow-headers", [...current].join(", "));
  return new Response(null, { status: 204, headers });
}

export const Route = createFileRoute("/api/extension/control")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      GET: ({ request }) => secured(request),
      POST: ({ request }) => secured(request),
    },
  },
});
