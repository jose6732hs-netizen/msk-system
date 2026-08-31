import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionRemoteControl } from "@/lib/extension-remote-control.server";
import { enforceExtensionDeviceSecurity } from "@/lib/extension-device-security.server";
import { enforceExtensionIntegrityGate } from "@/lib/extension-integrity-gate.server";
import { enforceSecurityCenter } from "@/lib/security-center.server";
import { enforceHardeningRequest, hardeningPreflight } from "@/lib/extension-hardening-v1.server";

async function secured(request: Request) {
  return (
    (await enforceHardeningRequest(request)) ??
    (await enforceSecurityCenter(request)) ??
    (await enforceExtensionIntegrityGate(request)) ??
    (await enforceExtensionDeviceSecurity(request)) ??
    handleExtensionRemoteControl(request)
  );
}

function preflight(request: Request) {
  const base = hardeningPreflight(request);
  const headers = new Headers(base.headers);
  const allowed = new Set((headers.get("access-control-allow-headers") ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  for (const header of ["x-msk-license", "x-msk-security-session"]) allowed.add(header);
  headers.set("access-control-allow-headers", [...allowed].join(", "));
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
