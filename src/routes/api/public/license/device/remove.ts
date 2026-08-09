import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  clientIp,
  findLicenseByToken,
  jsonResponse,
  logEvent,
  preflight,
  rateLimit,
} from "@/lib/license.server";

const schema = z.object({
  token: z.string().min(8).max(64),
  device_id: z.string().uuid(),
});

/** Remove um dispositivo específico pelo id (extensão ou painel). */
export const Route = createFileRoute("/api/public/license/device/remove")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!(await rateLimit("device-remove", clientIp(request), 20)))
          return jsonResponse({ success: false, error: "RATE_LIMITED" }, 429);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);

        const license = (await findLicenseByToken(parsed.data.token)) as {
          id: string;
          user_id: string;
        } | null;
        if (!license) return jsonResponse({ success: false, error: "INVALID_LICENSE" }, 404);

        const { error } = await supabaseAdmin
          .from("license_devices")
          .update({ status: "removed" })
          .eq("id", parsed.data.device_id)
          .eq("license_id", license.id);
        if (error) return jsonResponse({ success: false, error: "DEVICE_NOT_FOUND" }, 404);

        await logEvent({
          license_id: license.id,
          user_id: license.user_id,
          event_type: "device_removed",
          metadata: { device_id: parsed.data.device_id },
        });
        return jsonResponse({ success: true });
      },
    },
  },
});