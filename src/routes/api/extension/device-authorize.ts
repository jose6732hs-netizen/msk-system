import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionDeviceAuthorize } from "@/lib/extension-device-authorize.server";
import { hardeningPreflight, handleProtectedActionAuthorize } from "@/lib/extension-hardening-v1.server";

function authorize(request: Request) {
  return request.headers.get("x-msk-build-id") ? handleProtectedActionAuthorize(request) : handleExtensionDeviceAuthorize(request);
}

export const Route = createFileRoute("/api/extension/device-authorize")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => hardeningPreflight(request),
      POST: ({ request }) => authorize(request),
    },
  },
});
