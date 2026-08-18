import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";
import { AmploPayService } from "./payments/amplo-pay.server";

export async function loadFinanceOverview() {
  const [
    { data: transactions },
    { data: withdrawals },
    { data: affiliates },
    { data: resellers },
    { data: commissions },
    { data: audit },
  ] = await Promise.all([
    supabaseAdmin
      .from("transactions")
      .select("id,identifier,amount,status,method,purpose,created_at,paid_at,profiles:user_id(email)")
      .order("created_at", { ascending: false })
      .limit(80),
    supabaseAdmin
      .from("withdrawals")
      .select("id,identifier,amount,status,pix_key_type,created_at,profiles:user_id(email)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("affiliates")
      .select("id,code,status,total_sales,total_commission,available_balance,profiles:user_id(email)")
      .order("total_commission", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("resellers")
      .select("id,code,tier,status,available_balance,total_deposited,trials_available,trials_used,profiles:user_id(email)")
      .order("total_deposited", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("affiliate_commissions")
      .select("id,amount,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("audit_logs")
      .select("id,action,resource,result,created_at,user_id,metadata")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const st = (t: any) => String(t?.status ?? "").toUpperCase();
  const PAID_STATUSES = ["PAID", "APPROVED", "COMPLETED"];
  const OPEN_STATUSES = ["PENDING", "WAITING_PAYMENT", "AWAITING_PAYMENT", "PROCESSING"];
  const paid = (transactions ?? []).filter((t: any) => PAID_STATUSES.includes(st(t)) || t.paid_at);
  const revenue = paid.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const generatedRevenue = (transactions ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0);
  const pendingTransactions = (transactions ?? []).filter(
    (t: any) => OPEN_STATUSES.includes(st(t)) && !t.paid_at,
  );
  const pendingRevenue = pendingTransactions.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const approvedCommissions = (commissions ?? [])
    .filter((c: any) => ["AVAILABLE", "APPROVED", "PAID"].includes(String(c.status).toUpperCase()))
    .reduce((s: number, c: any) => s + Number(c.amount), 0);
  const pendingCommissions = (commissions ?? [])
    .filter((c: any) => String(c.status).toUpperCase() === "PENDING")
    .reduce((s: number, c: any) => s + Number(c.amount), 0);
  const pendingWithdrawalValue = (withdrawals ?? [])
    .filter((w: any) => String(w.status).toUpperCase() === "PENDING")
    .reduce((s: number, w: any) => s + Number(w.amount), 0);

  let gatewayBalance: Record<string, any> | null = null;
  try {
    gatewayBalance = await (await AmploPayService.create()).getBalance();
  } catch {
    gatewayBalance = null;
  }

  return {
    transactions: (transactions ?? []) as Record<string, any>[],
    withdrawals: (withdrawals ?? []) as Record<string, any>[],
    affiliates: (affiliates ?? []) as Record<string, any>[],
    resellers: (resellers ?? []) as Record<string, any>[],
    commissions: (commissions ?? []) as Record<string, any>[],
    audit: (audit ?? []) as Record<string, any>[],
    gatewayBalance,
    stats: {
      revenue,
      generatedRevenue,
      pendingRevenue,
      approvedCommissions,
      pendingCommissions,
      netRevenue: revenue - approvedCommissions,
      averageTicket: paid.length ? revenue / paid.length : 0,
      conversionRate: transactions?.length ? (paid.length / transactions.length) * 100 : 0,
      pendingWithdrawalValue,
      activeAffiliates: (affiliates ?? []).filter((a: any) => a.status === "active").length,
      totalAffiliateSales: (affiliates ?? []).reduce((sum: number, a: any) => sum + Number(a.total_sales), 0),
      paidCount: paid.length,
      pending: pendingTransactions.length,
      pendingWithdrawals: (withdrawals ?? []).filter((w: any) => w.status === "PENDING").length,
    },
  };
}

export async function resolveWithdrawal(
  input: { withdrawalId: string; action: "approve" | "reject"; reason?: string | undefined },
  adminId: string,
) {
  const { data: wd } = await supabaseAdmin
    .from("withdrawals")
    .select("*")
    .eq("id", input.withdrawalId)
    .maybeSingle();
  if (!wd) throw new Error("Solicitação não encontrada");
  if (wd.status !== "PENDING") throw new Error("Solicitação já processada");

  if (input.action === "reject") {
    const table = wd.affiliate_id ? "affiliates" : "resellers";
    const accountId = wd.affiliate_id ?? wd.reseller_id;
    if (accountId) {
      const { data: acc } = await supabaseAdmin
        .from(table)
        .select("id,available_balance")
        .eq("id", accountId)
        .maybeSingle();
      if (acc) {
        await supabaseAdmin
          .from(table)
          .update({ available_balance: Number(acc.available_balance) + Number(wd.amount) })
          .eq("id", acc.id);
      }
    }
    await supabaseAdmin
      .from("withdrawals")
      .update({ status: "REJECTED", error: input.reason ?? null, updated_at: new Date().toISOString() })
      .eq("id", wd.id);
    await logAudit({
      userId: adminId,
      action: "withdrawal.rejected",
      resource: "withdrawals",
      resourceId: wd.id,
    });
    return { ok: true, status: "REJECTED" };
  }

  try {
    const service = await AmploPayService.create();
    const result = await service.createWithdrawal({
      identifier: wd.identifier,
      amountCents: Math.round(Number(wd.amount) * 100),
      pixKey: wd.pix_key ?? "",
      pixKeyType: wd.pix_key_type ?? "",
    });
    await supabaseAdmin
      .from("withdrawals")
      .update({
        status: "PAID",
        provider_transfer_id: result.id ?? result.transferId ?? null,
        raw: result as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wd.id);
    await logAudit({
      userId: adminId,
      action: "withdrawal.paid",
      resource: "withdrawals",
      resourceId: wd.id,
      metadata: { amount: wd.amount },
    });
    return { ok: true, status: "PAID" };
  } catch (e) {
    const message = (e as Error).message;
    await supabaseAdmin
      .from("withdrawals")
      .update({ status: "ERROR", error: message, updated_at: new Date().toISOString() })
      .eq("id", wd.id);
    await logAudit({
      userId: adminId,
      action: "withdrawal.error",
      resource: "withdrawals",
      resourceId: wd.id,
      result: "failure",
      metadata: { message },
    });
    throw new Error(`Falha ao processar saque: ${message}`);
  }
}