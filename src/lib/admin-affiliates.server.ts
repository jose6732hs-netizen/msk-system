/** Gestão administrativa de afiliados: listagem, metas, comissões e saldo manual. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";
import { getSetting, setSetting } from "./commerce.server";
import { DEFAULT_GOALS, type Goals } from "./affiliate.server";
import { getAppUrl, clearAppUrlCache } from "./app-url.server";
import { affiliateLink } from "./urls";

export async function loadAdminAffiliates(search = "") {
  const [{ data: affiliates }, { data: plans }, { data: overrides }, goals, base] = await Promise.all([
    supabaseAdmin
      .from("affiliates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin.from("plans").select("id,name,price,affiliate_commission_fixed").order("price"),
    supabaseAdmin.from("affiliate_commission_overrides").select("*").limit(500),
    getSetting<Goals>("affiliate_goals", DEFAULT_GOALS),
    getAppUrl(),
  ]);

  const list = (affiliates ?? []) as Record<string, any>[];
  const userIds = list.map((a) => a["user_id"]);
  const affiliateIds = list.map((a) => a["id"]);

  const [{ data: profiles }, { data: referrals }, { data: conversions }, { data: commissions }] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("profiles").select("id,name,email").in("id", userIds)
      : { data: [] as Record<string, any>[] },
    affiliateIds.length
      ? supabaseAdmin.from("affiliate_referrals").select("affiliate_id, status").in("affiliate_id", affiliateIds)
      : { data: [] as Record<string, any>[] },
    affiliateIds.length
      ? supabaseAdmin.from("affiliate_conversions").select("affiliate_id, amount, commission_amount, status").in("affiliate_id", affiliateIds)
      : { data: [] as Record<string, any>[] },
    affiliateIds.length
      ? supabaseAdmin.from("affiliate_commissions").select("affiliate_id, amount, status").in("affiliate_id", affiliateIds)
      : { data: [] as Record<string, any>[] },
  ]);

  const byUser = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  
  const statsMap = new Map<string, { signups: number; customers: number; revenue: number; commission: number; pending: number; paid: number }>();
  
  affiliateIds.forEach(id => statsMap.set(id, { signups: 0, customers: 0, revenue: 0, commission: 0, pending: 0, paid: 0 }));

  (referrals ?? []).forEach(r => {
    const stats = statsMap.get(r['affiliate_id']);
    if (stats) {
      if (r['status'] === 'signup' || r['status'] === 'customer') stats.signups++;
      if (r['status'] === 'customer') stats.customers++;
    }
  });

  (conversions ?? []).forEach(c => {
    const stats = statsMap.get(c['affiliate_id']);
    if (stats && c['status'] === 'APPROVED') {
      stats.revenue += Number(c['amount']);
    }
  });

  (commissions ?? []).forEach(c => {
    const stats = statsMap.get(c['affiliate_id']);
    if (stats) {
      if (c['status'] === 'PENDING') stats.pending += Number(c['amount']);
      if (c['status'] === 'PAID') stats.paid += Number(c['amount']);
      if (['PENDING', 'APPROVED', 'PAID', 'AVAILABLE'].includes(c['status'] as string)) {
        stats.commission += Number(c['amount']);
      }
    }
  });
  
  const term = search.trim().toLowerCase();
  const rows = list
    .map((a) => {
      const profile = byUser.get(a["user_id"]);
      const stats = statsMap.get(a["id"]);
      const row: Record<string, any> = {
        ...(a as Record<string, any>),
        name: profile?.name ?? "—",
        email: profile?.email ?? "—",
        link: affiliateLink(base, a["code"]),
        signups_count: stats?.signups ?? 0,
        customers_count: stats?.customers ?? 0,
        revenue_generated: stats?.revenue ?? 0,
        commission_generated: stats?.commission ?? 0,
        commission_pending: stats?.pending ?? a["pending_balance"] ?? 0,
        commission_paid: stats?.paid ?? a["total_paid"] ?? 0,
      };
      return row;
    })
    .filter(
      (a) =>
        !term ||
        String(a["code"]).toLowerCase().includes(term) ||
        String(a["name"]).toLowerCase().includes(term) ||
        String(a["email"]).toLowerCase().includes(term),
    );

  const globalCommissions = await getSetting<{ affiliate: number }>("commissions", { affiliate: 30 });

  return {
    affiliates: rows,
    plans: (plans ?? []) as Record<string, any>[],
    overrides: (overrides ?? []) as Record<string, any>[],
    goals,
    defaultRate: globalCommissions.affiliate,
    appUrl: base,
  };
}

export async function updateAffiliate(
  input: {
    affiliateId: string;
    commissionRate?: number | undefined;
    goalAmount?: number | undefined;
    status?: "active" | "blocked" | undefined;
    notes?: string | undefined;
  },
  actorId: string,
) {
  const patch: Record<string, unknown> = {};
  if (input.commissionRate !== undefined) patch["commission_rate"] = input.commissionRate;
  if (input.goalAmount !== undefined) patch["goal_amount"] = input.goalAmount;
  if (input.notes !== undefined) patch["notes"] = input.notes;
  if (input.status !== undefined) {
    patch["status"] = input.status;
    patch["blocked_at"] = input.status === "blocked" ? new Date().toISOString() : null;
  }
  if (!Object.keys(patch).length) return { ok: true };

  const { error } = await supabaseAdmin.from("affiliates").update(patch as never).eq("id", input.affiliateId);
  if (error) throw error;
  await logAudit({
    userId: actorId,
    action: "affiliate.updated",
    resource: "affiliates",
    resourceId: input.affiliateId,
    metadata: patch,
  });
  return { ok: true };
}

export async function adjustAffiliateBalance(
  input: { affiliateId: string; amount: number; reason: string },
  actorId: string,
) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id,available_balance")
    .eq("id", input.affiliateId)
    .maybeSingle();
  if (!affiliate) throw new Error("Afiliado não encontrado");

  const next = Number((affiliate as Record<string, any>)["available_balance"] ?? 0) + input.amount;
  if (next < 0) throw new Error("Saldo resultante não pode ser negativo");

  await supabaseAdmin.from("affiliates").update({ available_balance: next } as never).eq("id", input.affiliateId);
  await supabaseAdmin.from("affiliate_balance_ledger").insert({
    affiliate_id: input.affiliateId,
    type: input.amount >= 0 ? "manual_credit" : "manual_debit",
    amount: Math.abs(input.amount),
    balance_after: next,
    reason: input.reason,
  } as never);
  await logAudit({
    userId: actorId,
    action: "affiliate.balance_adjusted",
    resource: "affiliates",
    resourceId: input.affiliateId,
    metadata: { amount: input.amount, reason: input.reason },
  });
  return { ok: true, balance: next };
}

export async function saveCommissionOverride(
  input: {
    affiliateId?: string | null;
    planId?: string | null;
    rate?: number | null;
    fixedAmount?: number | null;
  },
  actorId: string,
) {
  const { error } = await supabaseAdmin.from("affiliate_commission_overrides").upsert(
    {
      affiliate_id: input.affiliateId ?? null,
      plan_id: input.planId ?? null,
      rate: input.rate ?? null,
      fixed_amount: input.fixedAmount ?? null,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "affiliate_id,plan_id" },
  );
  if (error) throw error;
  await logAudit({
    userId: actorId,
    action: "affiliate.commission_override_saved",
    resource: "affiliate_commission_overrides",
    metadata: input,
  });
  return { ok: true };
}

export async function deleteCommissionOverride(id: string, actorId: string) {
  await supabaseAdmin.from("affiliate_commission_overrides").delete().eq("id", id);
  await logAudit({
    userId: actorId,
    action: "affiliate.commission_override_deleted",
    resource: "affiliate_commission_overrides",
    resourceId: id,
  });
  return { ok: true };
}

export async function saveAffiliateGoals(goals: Goals, actorId: string) {
  await setSetting("affiliate_goals", goals);
  await logAudit({ userId: actorId, action: "settings.affiliate_goals_updated", resource: "app_settings" });
  return { ok: true };
}

export async function saveAppUrl(url: string, actorId: string) {
  await setSetting("app_url", { url: url.replace(/\/+$/, "") });
  clearAppUrlCache();
  await logAudit({ userId: actorId, action: "settings.app_url_updated", resource: "app_settings" });
  return { ok: true };
}
