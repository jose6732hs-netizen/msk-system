/** Gestão administrativa de afiliados: listagem, metas, comissões e saldo manual. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";
import { getSetting, setSetting } from "./commerce.server";
import { DEFAULT_GOALS, type Goals } from "./affiliate.server";
import { getAppUrl, clearAppUrlCache } from "./app-url.server";
import { affiliateLink } from "./urls";

const PAGE_SIZE = 1000;

async function fetchAll(makeQuery: () => any) {
  const rows: Record<string, any>[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Record<string, any>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function loadProfiles(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const rows: Record<string, any>[] = [];
  const chunkSize = 200;

  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,name,email,last_seen")
      .in("id", chunk);
    if (error) throw error;
    rows.push(...((data ?? []) as Record<string, any>[]));
  }

  return rows;
}

export async function loadAdminAffiliates(search = "") {
  const [affiliates, { data: plans }, { data: overrides }, goals, base] = await Promise.all([
    fetchAll(() =>
      supabaseAdmin
        .from("affiliates")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
    supabaseAdmin.from("plans").select("id,name,price,affiliate_commission_fixed").order("price"),
    supabaseAdmin.from("affiliate_commission_overrides").select("*").limit(500),
    getSetting<Goals>("affiliate_goals", DEFAULT_GOALS),
    getAppUrl(),
  ]);

  const list = affiliates as Record<string, any>[];
  const ownerUserIds = list.map((a) => String(a["user_id"] ?? "")).filter(Boolean);
  const affiliateIds = list.map((a) => String(a["id"] ?? "")).filter(Boolean);

  const [referrals, conversions, commissions, documents] = affiliateIds.length
    ? await Promise.all([
        fetchAll(() =>
          supabaseAdmin
            .from("affiliate_referrals")
            .select("id,affiliate_id,status,user_id,signed_up_at,converted_at")
            .in("affiliate_id", affiliateIds)
            .order("signed_up_at", { ascending: false }),
        ),
        fetchAll(() =>
          supabaseAdmin
            .from("affiliate_conversions")
            .select("affiliate_id,amount,commission_amount,status")
            .in("affiliate_id", affiliateIds),
        ),
        fetchAll(() =>
          supabaseAdmin
            .from("affiliate_commissions")
            .select("affiliate_id,amount,status")
            .in("affiliate_id", affiliateIds),
        ),
        fetchAll(() =>
          supabaseAdmin
            .from("affiliate_documents")
            .select("*")
            .in("affiliate_id", affiliateIds),
        ),
      ])
    : [[], [], [], []];

  // Perfis dos donos dos links + perfis de quem foi indicado.
  // Antes, o painel procurava o indicado apenas no mapa dos próprios afiliados,
  // fazendo nome/e-mail aparecerem como "Usuário / —" mesmo quando existiam.
  const referralUserIds = referrals.map((r) => String(r["user_id"] ?? "")).filter(Boolean);
  const profiles = await loadProfiles([...ownerUserIds, ...referralUserIds]);
  const byUser = new Map(profiles.map((p: any) => [p.id, p]));

  const docsByAffiliate = new Map<string, any[]>();
  documents.forEach((d) => {
    const current = docsByAffiliate.get(d["affiliate_id"]) || [];
    current.push(d);
    docsByAffiliate.set(d["affiliate_id"], current);
  });

  const referralsByAffiliate = new Map<string, Record<string, any>[]>();
  referrals.forEach((referral) => {
    const id = String(referral["affiliate_id"] ?? "");
    const current = referralsByAffiliate.get(id) || [];
    current.push(referral);
    referralsByAffiliate.set(id, current);
  });

  const statsMap = new Map<
    string,
    { signups: number; customers: number; revenue: number; commission: number; pending: number; paid: number }
  >();

  affiliateIds.forEach((id) =>
    statsMap.set(id, { signups: 0, customers: 0, revenue: 0, commission: 0, pending: 0, paid: 0 }),
  );

  referrals.forEach((r) => {
    const stats = statsMap.get(String(r["affiliate_id"]));
    if (!stats) return;
    const status = String(r["status"] ?? "").toLowerCase();
    if (status === "signup" || status === "customer") stats.signups++;
    if (status === "customer") stats.customers++;
  });

  conversions.forEach((c) => {
    const stats = statsMap.get(String(c["affiliate_id"]));
    const status = String(c["status"] ?? "").toUpperCase();
    if (stats && ["APPROVED", "PAID", "COMPLETED"].includes(status)) {
      stats.revenue += Number(c["amount"] ?? 0);
    }
  });

  commissions.forEach((c) => {
    const stats = statsMap.get(String(c["affiliate_id"]));
    if (!stats) return;
    const status = String(c["status"] ?? "").toUpperCase();
    const amount = Number(c["amount"] ?? 0);
    if (status === "PENDING") stats.pending += amount;
    if (status === "PAID") stats.paid += amount;
    if (["PENDING", "APPROVED", "PAID", "AVAILABLE"].includes(status)) stats.commission += amount;
  });

  const term = search.trim().toLowerCase();
  const rows = list
    .map((a) => {
      const profile = byUser.get(a["user_id"]);
      const stats = statsMap.get(a["id"]);

      const affReferrals = (referralsByAffiliate.get(String(a["id"])) ?? [])
        .slice(0, 5)
        .map((r) => {
          const p = byUser.get(r["user_id"]);
          return {
            id: r["id"],
            name: p?.name ?? "Usuário",
            email: p?.email ?? "—",
            status: r["status"],
            signed_up_at: r["signed_up_at"] ?? null,
            converted_at: r["converted_at"] ?? null,
          };
        });

      const isOnline = profile?.last_seen && new Date(profile.last_seen).getTime() > Date.now() - 5 * 60000;

      const row: Record<string, any> = {
        ...(a as Record<string, any>),
        name: profile?.name ?? "—",
        email: profile?.email ?? "—",
        last_seen: profile?.last_seen ?? null,
        is_online: !!isOnline,
        link: affiliateLink(base, a["code"]),
        signups_count: stats?.signups ?? 0,
        customers_count: stats?.customers ?? 0,
        revenue_generated: stats?.revenue ?? 0,
        commission_generated: stats?.commission ?? 0,
        commission_pending: stats?.pending ?? a["pending_balance"] ?? 0,
        commission_paid: stats?.paid ?? a["total_paid"] ?? 0,
        documents: docsByAffiliate.get(a["id"]) || [],
        referrals: affReferrals,
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

export async function approveAffiliateDocs(affiliateId: string, approve: boolean, reason: string | undefined, actorId: string) {
  const status = approve ? "APPROVED" : "REJECTED";
  const { error } = await supabaseAdmin
    .from("affiliates")
    .update({
      verification_status: status,
      verification_notes: reason || null,
      verification_processed_at: new Date().toISOString(),
    } as any)
    .eq("id", affiliateId);

  if (error) throw error;

  // Also update status for all documents of this affiliate
  await supabaseAdmin
    .from("affiliate_documents")
    .update({ status } as any)
    .eq("affiliate_id", affiliateId);

  await logAudit({
    userId: actorId,
    action: approve ? "affiliate.docs_approved" : "affiliate.docs_rejected",
    resource: "affiliates",
    resourceId: affiliateId,
    metadata: { reason },
  });

  return { ok: true };
}
