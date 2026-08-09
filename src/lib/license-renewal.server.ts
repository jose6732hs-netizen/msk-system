/**
 * Renovação automática de licenças, respeitando a duração de cada plano
 * (diário, mensal, anual, vitalício).
 *
 * Regras:
 *  - Assinatura ativa com período vencido e sem cancel_at_period_end:
 *    avança o período e estende/renova a licença (mesmo token).
 *  - Assinatura com cancel_at_period_end: marca como cancelada e a licença
 *    expira naturalmente.
 *  - Licenças vencidas sem assinatura viram "expired" (fail-closed).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { issueOrRenewLicense, logEvent } from "./license.server";
import { logAudit } from "./audit.server";

export type RenewalSummary = {
  renewed: number;
  cancelled: number;
  expired: number;
  errors: string[];
};

export async function runLicenseRenewal(): Promise<RenewalSummary> {
  const nowIso = new Date().toISOString();
  const summary: RenewalSummary = { renewed: 0, cancelled: 0, expired: 0, errors: [] };

  const { data: due } = await supabaseAdmin
    .from("subscriptions")
    .select("id,user_id,plan_id,status,cancel_at_period_end,current_period_end")
    .eq("status", "active")
    .lt("current_period_end", nowIso)
    .limit(200);

  for (const sub of due ?? []) {
    try {
      if (sub.cancel_at_period_end) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled", cancelled_at: nowIso })
          .eq("id", sub.id);
        summary.cancelled++;
        continue;
      }

      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("duration_days,is_lifetime,slug")
        .eq("id", sub.plan_id)
        .maybeSingle();

      const days = plan?.is_lifetime ? null : (plan?.duration_days ?? 30);
      const start = new Date(sub.current_period_end ?? nowIso);
      const nextEnd = days
        ? new Date(start.getTime() + days * 86400000).toISOString()
        : null;

      await supabaseAdmin
        .from("subscriptions")
        .update({
          current_period_start: start.toISOString(),
          current_period_end: nextEnd,
          status: "active",
        })
        .eq("id", sub.id);

      await issueOrRenewLicense({
        userId: sub.user_id,
        planId: sub.plan_id,
        subscriptionId: sub.id,
      });
      summary.renewed++;
    } catch (e) {
      summary.errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  }

  // Fail-closed: qualquer licença vencida perde o acesso.
  const { data: stale } = await supabaseAdmin
    .from("licenses")
    .select("id,user_id")
    .in("status", ["active", "inactive"])
    .not("expires_at", "is", null)
    .lt("expires_at", nowIso)
    .limit(500);

  for (const lic of stale ?? []) {
    await supabaseAdmin.from("licenses").update({ status: "expired" }).eq("id", lic.id);
    await logEvent({ license_id: lic.id, user_id: lic.user_id, event_type: "expired" });
    summary.expired++;
  }

  await logAudit({
    action: "licenses.auto_renewal",
    resource: "licenses",
    result: summary.errors.length ? "failure" : "success",
    metadata: summary as unknown as Record<string, unknown>,
  });

  return summary;
}