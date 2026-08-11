/** Agregações do painel do afiliado. Somente servidor. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getGoals, recomputePendingBalance } from "./affiliate.server";
import { getAppUrl } from "./app-url.server";
import { affiliateLink } from "./urls";

const APPROVED = ["APPROVED", "AVAILABLE", "PAID"];

export type RangeKey = "7d" | "30d" | "90d" | "year" | "custom";

export function rangeStart(range: RangeKey, from?: string | null) {
  const now = new Date();
  if (range === "custom" && from) return new Date(from);
  if (range === "7d") return new Date(now.getTime() - 6 * 86400000);
  if (range === "90d") return new Date(now.getTime() - 89 * 86400000);
  if (range === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getTime() - 29 * 86400000);
}

function dayKey(d: string | Date) {
  return new Date(d).toISOString().slice(0, 10);
}

function maskEmail(email?: string | null) {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return "—";
  const visible = (user ?? "").slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, (user ?? "").length - 2))}@${domain}`;
}

export async function loadAffiliateOverview(
  userId: string,
  opts: { range?: RangeKey; from?: string | null; to?: string | null } = {},
) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!affiliate) return { enrolled: false as const };

  await recomputePendingBalance(affiliate.id);

  const start = rangeStart(opts.range ?? "30d", opts.from ?? null);
  const end = opts.to ? new Date(opts.to) : new Date();
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [
    { data: fresh },
    { data: referrals },
    { data: clicks },
    { data: sales },
    { data: commissions },
    { data: withdrawals },
    { data: ledger },
    { data: tiers },
    goals,
    appUrl,
  ] = await Promise.all([
    supabaseAdmin.from("affiliates").select("*").eq("id", affiliate.id).maybeSingle(),
    supabaseAdmin
      .from("affiliate_referrals")
      .select("id,status,first_seen_at,signed_up_at,converted_at,user_id,profiles:user_id(name,email)")
      .eq("affiliate_id", affiliate.id)
      .order("first_seen_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("id,created_at")
      .eq("affiliate_id", affiliate.id)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .limit(5000),
    supabaseAdmin
      .from("transactions")
      .select("id,amount,status,created_at,paid_at,plan_id,user_id,plans(name)")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("affiliate_commissions")
      .select("id,amount,rate,status,source,base_amount,created_at,approved_at,transaction_id,plan_id")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("withdrawals")
      .select("id,amount,status,created_at,pix_key_type")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("affiliate_balance_ledger")
      .select("id,type,amount,balance_after,reason,created_at")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin.from("affiliate_tiers" as any).select("*"),
    getGoals(),
    getAppUrl(),
  ]);
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!affiliate) return { enrolled: false as const };

  await recomputePendingBalance(affiliate.id);

  const start = rangeStart(opts.range ?? "30d", opts.from ?? null);
  const end = opts.to ? new Date(opts.to) : new Date();
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [
    { data: fresh },
    { data: referrals },
    { data: clicks },
    { data: sales },
    { data: commissions },
    { data: withdrawals },
    { data: ledger },
    { data: tiers },
    goals,
    appUrl,
  ] = await Promise.all([
    supabaseAdmin.from("affiliates").select("*").eq("id", affiliate.id).maybeSingle(),
    supabaseAdmin
      .from("affiliate_referrals")
      .select("id,status,first_seen_at,signed_up_at,converted_at,user_id")
      .eq("affiliate_id", affiliate.id)
      .order("first_seen_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("id,created_at")
      .eq("affiliate_id", affiliate.id)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .limit(5000),
    supabaseAdmin
      .from("transactions")
      .select("id,amount,status,created_at,paid_at,plan_id,user_id,plans(name)")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("affiliate_commissions")
      .select("id,amount,rate,status,source,base_amount,created_at,approved_at,transaction_id,plan_id")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("withdrawals")
      .select("id,amount,status,created_at,pix_key_type")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("affiliate_balance_ledger")
      .select("id,type,amount,balance_after,reason,created_at")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin.from("affiliate_tiers" as any).select("*"),
    getGoals(),
    getAppUrl(),
  ]);

  const row = (fresh ?? affiliate) as Record<string, any>;
  const buyerIds = [...new Set((sales ?? []).map((s) => s.user_id).filter(Boolean))] as string[];
  const { data: buyers } = buyerIds.length
    ? await supabaseAdmin.from("profiles").select("id,email").in("id", buyerIds)
    : { data: [] as { id: string; email: string }[] };
  const emailById = new Map((buyers ?? []).map((b) => [b.id, b.email]));
  const commissionRows = commissions ?? [];
  const saleRows = sales ?? [];

  const totalCommission = commissionRows
    .filter((c) => c.status !== "REVERSED" && c.status !== "CANCELLED")
    .reduce((s, c) => s + Number(c.amount), 0);
  const pendingCommission = commissionRows
    .filter((c) => c.status === "PENDING")
    .reduce((s, c) => s + Number(c.amount), 0);
  const paidCommission = commissionRows
    .filter((c) => c.status === "PAID")
    .reduce((s, c) => s + Number(c.amount), 0);

  const commissionByTx = new Map(commissionRows.map((c) => [c.transaction_id, c]));

  const stats = {
    clicks: Number(row["total_clicks"] ?? 0),
    referrals: (referrals ?? []).length,
    signups: (referrals ?? []).filter((r) => r.status === "signup" || r.status === "customer").length,
    customers: (referrals ?? []).filter((r) => r.status === "customer").length,
    sales: saleRows.length,
    approvedSales: saleRows.filter((s) => s.status === "PAID").length,
    pendingSales: saleRows.filter((s) => s.status === "PENDING").length,
    totalCommission: Math.round(totalCommission * 100) / 100,
    pendingCommission: Math.round(pendingCommission * 100) / 100,
    availableBalance: Number(row["available_balance"] ?? 0),
    totalPaid: Math.max(Number(row["total_paid"] ?? 0), Math.round(paidCommission * 100) / 100),
  };

  // Série diária para o gráfico.
  const series: Record<string, { date: string; clicks: number; signups: number; sales: number; approved: number; commission: number }> = {};
  const ensure = (d: string) =>
    (series[d] ??= { date: d, clicks: 0, signups: 0, sales: 0, approved: 0, commission: 0 });
  for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 86400000)) ensure(dayKey(t));
  for (const c of clicks ?? []) ensure(dayKey(c.created_at)).clicks += 1;
  for (const r of referrals ?? []) if (r.signed_up_at && r.signed_up_at >= startIso) ensure(dayKey(r.signed_up_at)).signups += 1;
  for (const s of saleRows) {
    if (s.created_at < startIso) continue;
    const bucket = ensure(dayKey(s.created_at));
    bucket.sales += 1;
    if (s.status === "PAID") bucket.approved += 1;
  }
  for (const c of commissionRows) {
    if (c.created_at < startIso || !APPROVED.includes(c.status)) continue;
    ensure(dayKey(c.created_at)).commission += Number(c.amount);
  }

  const goalTarget = Number(row["goal_amount"] ?? goals.balance ?? 0);
  const progress = goalTarget > 0 ? Math.min(100, (stats.availableBalance / goalTarget) * 100) : 0;

  return {
    enrolled: true as const,
    affiliate: {
      id: row["id"],
      code: row["code"],
      status: row["status"],
      commissionRate: Number(row["commission_rate"] ?? 0),
      createdAt: row["created_at"],
      link: affiliateLink(appUrl, row["code"]),
      pendingBalance: Number(row["pending_balance"] ?? 0),
      withdrawal_password_hash: row["withdrawal_password_hash"],
      pix_key: row["pix_key"],
      pix_key_type: row["pix_key_type"],
      tier_id: row["tier_id"],
    },
    stats,
    goal: { target: goalTarget, current: stats.availableBalance, progress: Math.round(progress * 100) / 100, reached: goalTarget > 0 && stats.availableBalance >= goalTarget },
    goals,
    series: Object.values(series).sort((a, b) => a.date.localeCompare(b.date)),
    sales: saleRows.slice(0, 100).map((s) => {
      const c = commissionByTx.get(s.id) as Record<string, any> | undefined;
      return {
        id: s.id,
        customer: maskEmail(emailById.get(s.user_id as string)),
        plan: (s as Record<string, any>)["plans"]?.name ?? "—",
        amount: Number(s.amount),
        rate: Number(c?.["rate"] ?? 0),
        commission: Number(c?.["amount"] ?? 0),
        status: s.status,
        createdAt: s.created_at,
      };
    }),
    referrals: (referrals ?? []).slice(0, 100).map((r: any) => ({
      id: r.id,
      status: r.status,
      firstSeenAt: r.first_seen_at,
      signedUpAt: r.signed_up_at,
      convertedAt: r.converted_at,
      email: maskEmail(r.profiles?.email),
      name: r.profiles?.name || "Usuário",
    })),
    commissions: commissionRows.slice(0, 100),
    withdrawals: withdrawals ?? [],
    ledger: ledger ?? [],
    appUrl,
    tiers: (tiers as any[]) ?? [],
    currentTier: (tiers as any[])?.find(t => t.id === row["tier_id"]) ?? null,
  };
}
