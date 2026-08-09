import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  clientIp,
  findLicenseByToken,
  hashValue,
  jsonResponse,
  logEvent,
  preflight,
  rateLimit,
} from "@/lib/license.server";

const schema = z.object({
  token: z.string().min(8).max(64),
  device_fingerprint: z.string().min(8).max(256).optional(),
  installation_id: z.string().min(8).max(128).optional(),
});

/** Desvincula o dispositivo atual (chamado pela própria extensão). */
export const Route = createFileRoute("/api/public/license/deactivate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!(await rateLimit("deactivate", clientIp(request), 20)))
          return jsonResponse({ success: false, error: "RATE_LIMITED" }, 429);

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);

        const license = (await findLicenseByToken(parsed.data.token)) as {
          id: string;
          user_id: string;
        } | null;
        if (!license) return jsonResponse({ success: false, error: "INVALID_LICENSE" }, 404);

        const identity = parsed.data.installation_id ?? parsed.data.device_fingerprint;
        if (!identity) return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);
        const deviceHash = await hashValue(identity);
        const query = supabaseAdmin
          .from("license_devices")
          .update({ status: "removed" })
          .eq("license_id", license.id);
        await (parsed.data.installation_id
          ? query.eq("installation_id", parsed.data.installation_id)
          : query.eq("device_hash", deviceHash));

        await logEvent({
          license_id: license.id,
          user_id: license.user_id,
          event_type: "device_removed",
          device_hash: deviceHash,
        });
        return jsonResponse({ success: true });
      },
    },
  },
});