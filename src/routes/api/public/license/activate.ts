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
import { resolveLicenseSnapshot } from "@/lib/license-entitlements.server";
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

function hasOwn(metadata: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(metadata, key);
}

async function frozenDuration(license: any) {
  const metadata = (license?.metadata ?? {}) as Record<string, unknown>;
  const pending = Number(metadata["pending_duration_ms"] ?? 0);
  if (pending > 0) return { milliseconds: pending, lifetime: false };

  const hasSnapshot = [
    "plan_duration_value_snapshot",
    "plan_duration_unit_snapshot",
    "plan_duration_snapshot",
    "plan_is_lifetime_snapshot",
    "pending_duration_ms",
  ].some((key) => hasOwn(metadata, key));

  if (metadata["plan_is_lifetime_snapshot"] === true) {
    return { milliseconds: null as number | null, lifetime: true };
  }

  const value = Number(metadata["plan_duration_value_snapshot"] ?? 0);
  const unit = String(metadata["plan_duration_unit_snapshot"] ?? "").trim();
  if (value > 0 && unit) {
    const resolved = resolvePlanDuration({ duration_value: value, duration_unit: unit });
    return { milliseconds: resolved.milliseconds ?? null, lifetime: resolved.lifetime };
  }

  const days = Number(metadata["plan_duration_snapshot"] ?? 0);
  if (days > 0) {
    const resolved = resolvePlanDuration({ duration_value: days, duration_unit: "days" });
    return { milliseconds: resolved.milliseconds ?? null, lifetime: resolved.lifetime };
  }

  // Se a licença já tem snapshot, nunca herdar uma duração alterada depois.
  if (hasSnapshot) return { milliseconds: null as number | null, lifetime: false };

  // Compatibilidade apenas para licenças realmente antigas, sem snapshot.
  if (!license?.plan_id) return { milliseconds: null as number | null, lifetime: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("name,slug,is_lifetime,duration_label,duration_days,duration_value,duration_unit")
    .eq("id", license.plan_id)
    .maybeSingle();
  if (!plan) return { milliseconds: null as number | null, lifetime: false };
  const resolved = resolvePlanDuration(plan);
  return { milliseconds: resolved.milliseconds ?? null, lifetime: resolved.lifetime };
}

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

        const snapshot = resolveLicenseSnapshot(license);
        // Este endpoint é da extensão principal. Clonador/agente têm licenças próprias.
        if (snapshot.role !== "extension") {
          await logEvent({
            license_id: license.id,
            user_id: license.user_id,
            event_type: "product_mismatch",
            metadata: { requested_role: "extension", license_role: snapshot.role, license_slug: snapshot.slug },
          });
          return jsonResponse(
            {
              success: false,
              error: "LICENSE_PRODUCT_MISMATCH",
              message: "Este token não é válido para este produto.",
            },
            403,
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

        if (!license.activated_at) {
          updates["activated_at"] = now.toISOString();
          const duration = await frozenDuration(license);
          if (!effectiveExpiresAt && !duration.lifetime && Number(duration.milliseconds ?? 0) > 0) {
            effectiveExpiresAt = new Date(now.getTime() + Number(duration.milliseconds)).toISOString();
            updates["expires_at"] = effectiveExpiresAt;
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
            license_role: snapshot.role,
            plan_slug: snapshot.slug,
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
            plan: snapshot.slug,
            plan_name: snapshot.name,
            expires_at: effectiveExpiresAt,
            max_devices: snapshot.maxDevices ?? license.max_devices,
            devices_used: devices ?? 0,
            features: snapshot.features ?? lockedFeatures(),
            role: snapshot.role,
          },
        });
      },
    },
  },
});