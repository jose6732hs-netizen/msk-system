import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  clientIp,
  findLicenseByToken,
  hashValue,
  jsonResponse,
  logEvent,
  lockedFeatures,
  preflight,
  rateLimit,
} from "@/lib/license.server";

const schema = z.object({
  token: z.string().min(8).max(64),
  device_fingerprint: z.string().min(8).max(256).optional(),
  installation_id: z.string().min(8).max(128).optional(),
  extension_version: z.string().max(32).optional(),
  browser: z.string().max(64).optional(),
  os: z.string().max(64).optional(),
  device_name: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/public/license/activate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ip = clientIp(request);
        if (!(await rateLimit("activate", ip, 15))) {
          return jsonResponse({ success: false, error: "RATE_LIMITED" }, 429);
        }

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);
        }
        const body = parsed.data;
        // Identidade do dispositivo = installationId persistente (IP nunca é usado como identidade).
        const identity = body.installation_id ?? body.device_fingerprint;
        if (!identity) {
          return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);
        }

        const license = (await findLicenseByToken(body.token)) as any;


        if (!license) {
          await logEvent({
            event_type: "invalid_attempt",
            metadata: { ip_hash: await hashValue(ip) },
          });
          return jsonResponse({ 
            success: false, 
            error: "INVALID_LICENSE",
            message: "Token inválido. Confira os caracteres e tente novamente."
          }, 404);
        }

        if (license.status === "revoked")
          return jsonResponse({ success: false, error: "LICENSE_REVOKED" }, 403);
        if (license.status === "suspended")
          return jsonResponse({ success: false, error: "LICENSE_SUSPENDED" }, 403);
        if (license.status === "expired")
          return jsonResponse({ success: false, error: "LICENSE_EXPIRED" }, 403);

        const deviceHash = await hashValue(identity);
        const installationId = body.installation_id ?? null;

        // Procura primeiro pelo installationId (estável), depois pelo hash legado.
        type DeviceRow = { id: string; status: string };
  let existing: DeviceRow | null = null;
        if (installationId) {
          const { data } = await supabaseAdmin
            .from("license_devices")
            .select("id,status")
            .eq("license_id", license.id)
            .eq("installation_id", installationId)
            .maybeSingle();
          existing = data as DeviceRow | null;
        }
        if (!existing) {
          const { data } = await supabaseAdmin
            .from("license_devices")
            .select("id,status")
            .eq("license_id", license.id)
            .eq("device_hash", deviceHash)
            .maybeSingle();
          existing = data as DeviceRow | null;
        }

        if (!existing) {
          const { count } = await supabaseAdmin
            .from("license_devices")
            .select("id", { count: "exact", head: true })
            .eq("license_id", license.id)
            .eq("status", "active");
          if ((count ?? 0) >= license.max_devices) {
            await logEvent({
              license_id: license.id,
              user_id: license.user_id,
              event_type: "device_limit_reached",
              device_hash: deviceHash,
            });
            return jsonResponse(
              {
                success: false,
                error: "DEVICE_LIMIT_REACHED",
                message:
                  "Esta licença já está vinculada ao limite de dispositivos permitido.",
              },
              403,
            );
          }
          await supabaseAdmin.from("license_devices").insert({
            license_id: license.id,
            device_hash: deviceHash,
            installation_id: installationId,
            device_name: body.device_name ?? `${body.browser ?? "Navegador"} ${body.os ?? ""}`.trim(),
            browser: body.browser ?? null,
            os: body.os ?? null,
            extension_version: body.extension_version ?? null,
            last_ip_hash: await hashValue(ip),
          });
          await logEvent({
            license_id: license.id,
            user_id: license.user_id,
            event_type: "device_added",
            device_hash: deviceHash,
          });
        } else {
          await supabaseAdmin
            .from("license_devices")
            .update({
              status: "active",
              last_seen: new Date().toISOString(),
              last_ip_hash: await hashValue(ip),
              installation_id: installationId,
              device_hash: deviceHash,
              extension_version: body.extension_version ?? null,
            })
            .eq("id", existing.id);
        }

        // Se for o primeiro uso (activated_at nulo), define a expiração a partir de agora
        const updates: any = {
          status: "active",
          last_validation: new Date().toISOString(),
        };
        
        if (!license.activated_at) {
          updates.activated_at = new Date().toISOString();
          // Se a licença tiver uma duração definida (ex: teste/trial), calcula a expiração baseada no agora
          if (license.expires_at && license.starts_at) {
            const duration = new Date(license.expires_at).getTime() - new Date(license.starts_at).getTime();
            updates.expires_at = new Date(Date.now() + duration).toISOString();
          }
        }

        await supabaseAdmin
          .from("licenses")
          .update(updates)
          .eq("id", license.id);


        await logEvent({
          license_id: license.id,
          user_id: license.user_id,
          event_type: "activated",
          device_hash: deviceHash,
        });

        const { count: devices } = await supabaseAdmin
          .from("license_devices")
          .select("id", { count: "exact", head: true })
          .eq("license_id", license.id)
          .eq("status", "active");

        return jsonResponse({
          success: true,
          license: {
            status: "active",
            plan: license.plans?.slug ?? null,
            plan_name: license.plans?.name ?? null,
            expires_at: license.expires_at,
            max_devices: license.max_devices,
            devices_used: devices ?? 0,
            features: license.plans?.features ?? lockedFeatures(),
          },
        });
      },
    },
  },
});