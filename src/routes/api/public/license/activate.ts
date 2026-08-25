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
import { resolvePlanDuration } from "@/lib/plan-duration";

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
        const identity = body.installation_id ?? body.device_fingerprint;
        if (!identity) return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);

        const license = (await findLicenseByToken(body.token)) as any;
        if (!license) {
          const { hashToken } = await import("@/lib/license.server");
          const tokenHash = await hashToken(body.token);
          await logEvent({
            event_type: "invalid_attempt",
            metadata: {
              ip_hash: await hashValue(ip),
              token_hash_sent: tokenHash,
              error: "Token not found during activation",
            },
          });
          return jsonResponse(
            {
              success: false,
              error: "INVALID_LICENSE",
              message: "Token inválido. Confira os caracteres e tente novamente.",
            },
            404,
          );
        }

        if (license.status === "revoked")
          return jsonResponse({ success: false, error: "LICENSE_REVOKED" }, 403);
        if (license.status === "suspended")
          return jsonResponse({ success: false, error: "LICENSE_SUSPENDED" }, 403);
        if (license.status === "expired")
          return jsonResponse({ success: false, error: "LICENSE_EXPIRED" }, 403);

        const deviceHash = await hashValue(identity);
        const installationId = body.installation_id ?? null;

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
                message: "Esta licença já está vinculada ao limite de dispositivos permitido.",
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

        const now = new Date();
        const updates: Record<string, any> = {
          status: "active",
          last_validation: now.toISOString(),
        };
        let effectiveExpiresAt: string | null = license.expires_at ?? null;

        // Licenças pagas/manuais são emitidas como "inactive" com expires_at=null.
        // A duração real fica em metadata.pending_duration_ms e só começa no primeiro uso.
        if (!license.activated_at) {
          updates["activated_at"] = now.toISOString();
          const pendingMs = Number(license.metadata?.["pending_duration_ms"] ?? 0);

          if (pendingMs > 0) {
            effectiveExpiresAt = new Date(now.getTime() + pendingMs).toISOString();
            updates["expires_at"] = effectiveExpiresAt;
          } else if (!effectiveExpiresAt && license.plan_id) {
            // Recuperação de licenças antigas: derive do plano real, nunca assuma 30 dias.
            const { data: plan } = await supabaseAdmin
              .from("plans")
              .select("name,slug,is_lifetime,duration_label,duration_days,duration_value,duration_unit")
              .eq("id", license.plan_id)
              .maybeSingle();
            if (plan) {
              const resolved = resolvePlanDuration(plan);
              if (!resolved.lifetime && resolved.milliseconds) {
                effectiveExpiresAt = new Date(now.getTime() + resolved.milliseconds).toISOString();
                updates["expires_at"] = effectiveExpiresAt;
              }
            }
          }
        }

        await supabaseAdmin.from("licenses").update(updates as never).eq("id", license.id);

        await logEvent({
          license_id: license.id,
          user_id: license.user_id,
          event_type: "activated",
          device_hash: deviceHash,
          metadata: {
            expires_at: effectiveExpiresAt,
            pending_duration_ms: Number(license.metadata?.["pending_duration_ms"] ?? 0) || null,
          },
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
            expires_at: effectiveExpiresAt,
            max_devices: license.max_devices,
            devices_used: devices ?? 0,
            features: license.plans?.features ?? lockedFeatures(),
          },
        });
      },
    },
  },
});
