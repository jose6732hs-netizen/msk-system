import { createFileRoute } from "@tanstack/react-router";
import {
  handleMskLiveLicenseValidation,
  mskLivePreflight,
  withMskLiveCors,
} from "@/lib/msk-live-license.server";

export const Route = createFileRoute("/api/public/live/license/heartbeat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => mskLivePreflight(request),
      POST: async ({ request }) =>
        withMskLiveCors(
          await handleMskLiveLicenseValidation(request, "msk-live-heartbeat", 30),
          request,
        ),
    },
  },
});
