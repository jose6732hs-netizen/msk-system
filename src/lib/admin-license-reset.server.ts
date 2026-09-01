import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logEvent } from "./license.server";
import { durationLabelFromMs, resolvePlanDuration } from "./plan-duration";

function durationFromSnapshot(metadata: any) {
  const pendingMs = Number(metadata.pending_duration_ms ?? 0);
  if (pendingMs > 0) return pendingMs;

  const value = Number(metadata.plan_duration_value_snapshot ?? 0);
  const unit = String(metadata.plan_duration_unit_snapshot ?? "").trim();
  const label = String(metadata.plan_duration_label_snapshot ?? "").trim();
  if (!(value > 0) && !label) return null;

  try {
    const resolved = resolvePlanDuration({
      duration_value: value > 0 ? value : null,
      duration_unit: unit || null,
      duration_label: label || null,
      is_lifetime: unit === "lifetime",
    });
    return resolved.milliseconds;
  } catch {
    return null;
  }
}

export async function resetLicenseTimer(licenseId: string, adminId: string) {
  const { data: license, error } = await supabaseAdmin
    .from("licenses")
    .select(
      "id,user_id,status,activated_at,expires_at,revoked_at,revocation_reason,metadata,plans(name,slug,is_lifetime,allow_trial,price,duration_label,duration_days,duration_value,duration_unit)",
    )
    .eq("id", licenseId)
    .single();

  if (error || !license) throw error ?? new Error("Licença não encontrada.");

  const metadata = ((license.metadata ?? {}) as Record<string, any>);
  let durationMs = durationFromSnapshot(metadata);

  if (!(durationMs && durationMs > 0)) {
    const plan = Array.isArray(license.plans) ? license.plans[0] : license.plans;
    if (!plan) throw new Error("Não foi possível identificar a duração original desta licença.");
    const resolved = resolvePlanDuration(plan as Record<string, any>);
    if (resolved.lifetime || !resolved.milliseconds) {
      throw new Error("Licença vitalícia não possui contador para reiniciar.");
    }
    durationMs = resolved.milliseconds;
  }

  const finalDurationMs = Number(durationMs);
  if (!(finalDurationMs > 0)) {
    throw new Error("A duração original desta licença é inválida.");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + finalDurationMs).toISOString();
  const nextMetadata = {
    ...metadata,
    pending_duration_ms: finalDurationMs,
    timer_restarted_at: now.toISOString(),
    timer_restarted_by: adminId,
  };

  const { error: updateError } = await supabaseAdmin
    .from("licenses")
    .update({
      status: "active",
      activated_at: now.toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
      revocation_reason: null,
      metadata: nextMetadata,
    } as never)
    .eq("id", license.id);
  if (updateError) throw updateError;

  await logEvent({
    license_id: license.id,
    user_id: license.user_id,
    event_type: "admin_restart_timer",
    metadata: {
      admin_id: adminId,
      duration_ms: finalDurationMs,
      previous_status: license.status,
      previous_expires_at: license.expires_at ?? null,
      expires_at: expiresAt,
    },
  });

  return {
    ok: true,
    expiresAt,
    durationMs: finalDurationMs,
    durationLabel: durationLabelFromMs(finalDurationMs) ?? "validade original",
  };
}
