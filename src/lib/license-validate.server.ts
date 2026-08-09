import { z } from "zod";
import {
  clientIp,
  findLicenseByToken,
  hashValue,
  jsonResponse,
  logEvent,
  rateLimit,
} from "./license.server";

export const validateSchema = z.object({
  token: z.string().min(8).max(64),
  device_fingerprint: z.string().min(8).max(256).optional(),
  installation_id: z.string().min(8).max(128).optional(),
  extension_version: z.string().max(32).optional(),
});

type LicenseRow = {
  id: string;
  user_id: string;
  status: string;
  expires_at: string | null;
  max_devices: number;
  plans: { slug: string; name: string; features: Record<string, boolean> } | null;
};

const LOCKED = {
  chat: false,
  projects: false,
  download: false,
  background_tools: false,
};

/** Lógica compartilhada por /validate e /heartbeat. */
export async function handleValidation(request: Request, bucket: string, limit: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ip = clientIp(request);
  if (!(await rateLimit(bucket, ip, limit))) {
    return jsonResponse({ success: false, error: "RATE_LIMITED" }, 429);
  }

  const parsed = validateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);

  const license = (await findLicenseByToken(parsed.data.token)) as LicenseRow | null;
  if (!license) {
    await logEvent({ event_type: "invalid_attempt", metadata: { bucket, token: parsed.data.token.slice(-4) } });
    return jsonResponse({ success: false, error: "LICENSE_INVALID" }, 404);
  }

  const identity = parsed.data.installation_id ?? parsed.data.device_fingerprint;
  if (!identity) return jsonResponse({ success: false, error: "INVALID_REQUEST" }, 400);
  const deviceHash = await hashValue(identity);

  // Se a licença está 'inactive', vamos ativá-la agora se for o primeiro uso.
  if (license.status === "inactive") {
    await supabaseAdmin
      .from("licenses")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("id", license.id);
    license.status = "active";
  }

  type DeviceRow = { id: string; status: string };
  let device: DeviceRow | null = null;
  if (parsed.data.installation_id) {
    const { data } = await supabaseAdmin
      .from("license_devices")
      .select("id,status")
      .eq("license_id", license.id)
      .eq("installation_id", parsed.data.installation_id)
      .maybeSingle();
    device = data as DeviceRow | null;
  }
  if (!device) {
    const { data } = await supabaseAdmin
      .from("license_devices")
      .select("id,status")
      .eq("license_id", license.id)
      .eq("device_hash", deviceHash)
      .maybeSingle();
    device = data as DeviceRow | null;
  }

  // Auto-registro se a licença é ativa e o dispositivo é novo
  if (!device && license.status === "active") {
    const { data: newDev, error: devErr } = await supabaseAdmin
      .from("license_devices")
      .insert({
        license_id: license.id,
        device_hash: deviceHash,
        installation_id: parsed.data.installation_id ?? null,
        status: "active",
        last_seen: new Date().toISOString(),
        last_ip_hash: await hashValue(ip),
      } as never)
      .select("id,status")
      .single();
    
    if (!devErr) device = newDev as DeviceRow;
  }

  if (!device || device.status !== "active") {
    return jsonResponse(
      { success: false, error: "DEVICE_NOT_REGISTERED", status: license.status.toUpperCase() },
      403,
    );
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("license_devices")
    .update({ last_seen: now, last_ip_hash: await hashValue(ip) })
    .eq("id", device.id);
  await supabaseAdmin.from("licenses").update({ last_validation: now }).eq("id", license.id);

  const active = license.status === "active";
  await logEvent({
    license_id: license.id,
    user_id: license.user_id,
    event_type: bucket === "heartbeat" ? "heartbeat" : "validated",
    device_hash: deviceHash,
  });

  return jsonResponse({
    success: active,
    valid: active,
    status: license.status.toUpperCase(),
    // Se revogada ou suspensa, forçamos o cliente a invalidar localmente
    action: active ? null : "REAUTH_REQUIRED",
    license: {
      status: license.status.toUpperCase(),
      plan: license.plans?.slug ?? null,
      plan_name: license.plans?.name ?? null,
      expires_at: license.expires_at,
      max_devices: license.max_devices,
      features: active ? (license.plans?.features ?? LOCKED) : LOCKED,
    },
  });
}