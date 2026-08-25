/** Agregações do painel do afiliado. Somente servidor. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getGoals, recomputePendingBalance } from "./affiliate.server";
import { getAppUrl } from "./app-url.server";
import { affiliateLink } from "./urls";

const APPROVED = ["APPROVED", "AVAILABLE", "PAID", "COMPLETED"];
const PAGE_SIZE = 1000;

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
  for (let index = 0; index < uniqueIds.length; index += 200) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,name")
      .in("id", uniqueIds.slice(index, index + 200));
    if (error) throw error;
    rows.push(...((data ?? []) as Record<string, any>[]));
  }
  return rows;
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
    referrals,
    clicks,
    sales,
    commissions,
    withdrawals,
    ledger,
    { data: tiers },
    goals,
    appUrl,
  ] = await Promise.all([
    supabaseAdmin.from("affiliates").select("*").eq("id", affiliate.id).maybeSingle(),
    fetchAll(() =>
      supabaseAdmin
        .from("affiliate_referrals")
        .select("id,status,first_seen_at,signed_up_at,converted_at,user_id")
        .eq("affiliate_id", affiliate.id)
        .order("first_seen_at", { ascending: false }),
    ),
    fetchAll(() =>
      supabaseAdmin
        .from("affiliate_clicks")
        .select("id,created_at")
        .eq("affiliate_id", affiliate.id)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: false }),
    ),
    fetchAll(() =>
      supabaseAdmin
        .from("transactions")
        .select("id,amount,status,created_at,paid_at,plan_id,user_id,plans(name)")
        .eq("affiliate_id", affiliate.id)
        .order("created_at", { ascending: false }),
    ),
    fetchAll(() =>
      supabaseAdmin
        .from("affiliate_commissions")
        .select("id,amount,rate,status,source,base_amount,created_at,approved_at,transaction_id,plan_id")
        .eq("affiliate_id", affiliate.id)
        .order("created_at", { ascending: false }),
    ),
    fetchAll(() =>
      supabaseAdmin
        .from("withdrawals")
        .select("id,amount,status,created_at,pix_key_type")
        .eq("affiliate_id", affiliate.id)
        .order("created_at", { ascending: false }),
    ),
    fetchAll(() =>
      supabaseAdmin
        .from("affiliate_balance_ledger")
        .select("id,type,amount,balance_after,reason,created_at")
        .eq("affiliate_id", affiliate.id)
        .order("created_at", { ascending: false }),
    ),
    supabaseAdmin.from("affiliate_tiers" as any).select("*"),
    getGoals(),
    getAppUrl(),
  ]);

  const row = (fresh ?? affiliate) as Record<string, any>;
  const profileIds = [
    ...new Set(
      [
        ...sales.map((s) => s["user_id"]),
        ...referrals.map((r) => r["user_id"]),
      ].filter(Boolean),
    ),
  ] as string[];
  const buyers = await loadProfiles(profileIds);
  const userById = new Map(buyers.map((b) => [b["id"], { email: b["email"], name: b["name"] }]));
  const commissionRows = commissions;
  const saleRows = sales;

  const totalCommission = commissionRows
    .filter((c) => !["REVERSED", "CANCELLED"].includes(String(c["status"] ?? "").toUpperCase()))
    .reduce((s, c) => s + Number(c["amount"] ?? 0), 0);
  const pendingCommission = commissionRows
    .filter((c) => String(c["status"] ?? "").toUpperCase() === "PENDING")
    .reduce((s, c) => s + Number(c["amount"] ?? 0), 0);
  const paidCommission = commissionRows
    .filter((c) => String(c["status"] ?? "").toUpperCase() === "PAID")
    .reduce((s, c) => s + Number(c["amount"] ?? 0), 0);

  const commissionByTx = new Map(commissionRows.map((c) => [c["transaction_id"], c]));
  const paidStatuses = ["PAID", "APPROVED", "COMPLETED"];
  const pendingStatuses = ["PENDING", "WAITING", "WAITING_PAYMENT", "AWAITING_PAYMENT", "PROCESSING"];
  const saleStatus = (s: Record<string, any>) => String(s["status"] ?? "").toUpperCase();

  const stats = {
    clicks: Number(row["total_clicks"] ?? clicks.length),
    referrals: referrals.length,
    signups: referrals.filter((r) => ["signup", "customer"].includes(String(r["status"] ?? "").toLowerCase())).length,
    customers: referrals.filter((r) => String(r["status"] ?? "").toLowerCase() === "customer").length,
    sales: saleRows.length,
    approvedSales: saleRows.filter((s) => paidStatuses.includes(saleStatus(s)) || Boolean(s["paid_at"])).length,
    pendingSales: saleRows.filter((s) => pendingStatuses.includes(saleStatus(s)) && !s["paid_at"]).length,
    totalCommission: Math.round(totalCommission * 100) / 100,
    pendingCommission: Math.round(pendingCommission * 100) / 100,
    availableBalance: Number(row["available_balance"] ?? 0),
    totalPaid: Math.max(Number(row["total_paid"] ?? 0), Math.round(paidCommission * 100) / 100),
  };

  const series: Record<string, { date: string; clicks: number; signups: number; sales: number; approved: number; commission: number }> = {};
  const ensure = (d: string) =>
    (series[d] ??= { date: d, clicks: 0, signups: 0, sales: 0, approved: 0, commission: 0 });
  for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 86400000)) ensure(dayKey(t));
  for (const c of clicks) ensure(dayKey(c["created_at"])).clicks += 1;
  for (const r of referrals) {
    if (r["signed_up_at"] && r["signed_up_at"] >= startIso && r["signed_up_at"] <= endIso) {
      ensure(dayKey(r["signed_up_at"])).signups += 1;
    }
  }
  for (const s of saleRows) {
    if (s["created_at"] < startIso || s["created_at"] > endIso) continue;
    const bucket = ensure(dayKey(s["created_at"]));
    bucket.sales += 1;
    if (paidStatuses.includes(saleStatus(s)) || Boolean(s["paid_at"])) bucket.approved += 1;
  }
  for (const c of commissionRows) {
    if (c["created_at"] < startIso || c["created_at"] > endIso || !APPROVED.includes(String(c["status"] ?? "").toUpperCase())) continue;
    ensure(dayKey(c["created_at"])).commission += Number(c["amount"] ?? 0);
  }

  const { getAffiliateGoal } = await import("./affiliate.server");
  const goalTarget = (await getAffiliateGoal(stats.availableBalance)) ?? 1000;
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
    goal: {
      target: goalTarget,
      current: stats.availableBalance,
      progress: Math.round(progress * 100) / 100,
      reached: goalTarget > 0 && stats.availableBalance >= goalTarget,
    },
    goals,
    series: Object.values(series).sort((a, b) => a.date.localeCompare(b.date)),
    sales: saleRows.map((s) => {
      const c = commissionByTx.get(s["id"]) as Record<string, any> | undefined;
      const user = userById.get(s["user_id"] as string);
      const amount = Number(s["amount"] ?? 0);
      const rate = Number(c?.["rate"] ?? row["commission_rate"] ?? 0);
      const commission = c?.["amount"] != null
        ? Number(c["amount"])
        : Math.round(amount * (rate / 100) * 100) / 100;
      const status = saleStatus(s);
      return {
        id: s["id"],
        customer: maskEmail(user?.email),
        customerName: user?.name || "Usuário",
        plan: (s as Record<string, any>)["plans"]?.name ?? "—",
        amount,
        rate,
        commission,
        commissionStatus: c?.["status"] ?? (paidStatuses.includes(status) ? "PENDING" : "ESTIMATED"),
        status,
        createdAt: s["created_at"],
      };
    }),
    referrals: referrals.map((r: any) => {
      const p = userById.get(r["user_id"] as string);
      return {
        id: r["id"],
        status: r["status"],
        firstSeenAt: r["first_seen_at"],
        signedUpAt: r["signed_up_at"],
        convertedAt: r["converted_at"],
        email: maskEmail(p?.email),
        name: p?.name || "Usuário",
      };
    }),
    commissions: commissionRows,
    withdrawals,
    ledger,
    appUrl,
    tiers: (tiers as any[]) ?? [],
    currentTier: (tiers as any[])?.find((t) => t.id === row["tier_id"]) ?? null,
  };
}
