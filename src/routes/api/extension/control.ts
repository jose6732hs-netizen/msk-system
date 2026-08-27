import { createFileRoute } from "@tanstack/react-router";
import { handleExtensionRemoteControl, remoteControlPreflight } from "@/lib/extension-remote-control.server";

export const Route = createFileRoute("/api/extension/control")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => remoteControlPreflight(request),
      GET: ({ request }) => handleExtensionRemoteControl(request),
      POST: ({ request }) => handleExtensionRemoteControl(request),
    },
  },
});
