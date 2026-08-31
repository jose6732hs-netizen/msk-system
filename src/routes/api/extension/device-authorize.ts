import { createFileRoute } from "@tanstack/react-router";
import { extensionDeviceAuthorizePreflight, handleExtensionDeviceAuthorize } from "@/lib/extension-device-authorize.server";
import { hardeningPreflight, handleProtectedActionAuthorize } from "@/lib/extension-hardening-v1.server";

function preflight(request: Request) {
  return request.headers.get("x-msk-build-id") ? hardeningPreflight(request) : extensionDeviceAuthorizePreflight(request);
}

function authorize(request: Request) {
  return request.headers.get("x-msk-build-id") ? handleProtectedActionAuthorize(request) : handleExtensionDeviceAuthorize(request);
}

export const Route = createFileRoute("/api/extension/device-authorize")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: ({ request }) => authorize(request),
    },
  },
});
