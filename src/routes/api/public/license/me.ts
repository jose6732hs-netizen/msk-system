import { createFileRoute } from "@tanstack/react-router";
import {
  clientIp,
  findLicenseByToken,
  jsonResponse,
  preflight,
  rateLimit,
} from "@/lib/license.server";

type LicenseRow = {
  id: string;
  status: string;
  expires_at: string | null;
  max_devices: number;
  plans: { slug: string; name: string; features: Record<string, boolean> } | null;
};

/** GET /api/public/license/me  —  Authorization: Bearer <TOKEN DA LICENÇA> */
export const Route = createFileRoute("/api/public/license/me")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!(await rateLimit("me", clientIp(request), 60)))
          return jsonResponse({ success: false, error: "RATE_LIMITED" }, 429);

        const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token) return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);

        const license = (await findLicenseByToken(token)) as LicenseRow | null;
        if (!license) return jsonResponse({ success: false, error: "INVALID_LICENSE" }, 404);

        const { data: devices } = await supabaseAdmin
          .from("license_devices")
          .select("device_name,browser,os,last_seen,first_seen,status")
          .eq("license_id", license.id)
          .eq("status", "active");

        const active = license.status === "active";
        return jsonResponse({
          success: true,
          license: {
            status: license.status,
            plan: license.plans?.slug ?? null,
            plan_name: license.plans?.name ?? null,
            expires_at: license.expires_at,
            max_devices: license.max_devices,
            devices_used: devices?.length ?? 0,
            features: active
              ? (license.plans?.features ?? {})
              : { chat: false, projects: false, download: false, background_tools: false },
          },
          devices: devices ?? [],
        });
      },
    },
  },
});