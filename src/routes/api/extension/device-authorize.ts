import { createFileRoute } from "@tanstack/react-router";
import {
  extensionDeviceAuthorizePreflight,
  handleExtensionDeviceAuthorize,
} from "@/lib/extension-device-authorize.server";

export const Route = createFileRoute("/api/extension/device-authorize")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionDeviceAuthorizePreflight(request),
      POST: ({ request }) => handleExtensionDeviceAuthorize(request),
    },
  },
});
