/**
 * Núcleo do programa de afiliados: rastreio de indicação, cálculo de comissão,
 * saldo e métricas. Todo cálculo acontece aqui — nunca no cliente.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashValue } from "./license.server";
import { logAudit } from "./audit.server";
import { getSetting } from "./commerce.server";
import { recomputeAffiliateTier } from "./affiliate-tiers.server";

export type Goals = {
  balance: number;
  commission: number;
  sales: number;
  referrals: number;
  monthly: number;
};

export const DEFAULT_GOALS: Goals = {
  balance: 1000,
  commission: 0,
  sales: 0,
  referrals: 0,
  monthly: 0,
};

export async function getGoals() {
  return getSetting<Goals>("affiliate_goals", DEFAULT_GOALS);
}

/* ------------------------------- Rastreio ------------------------------- */

export async function trackVisit(input: {
  code: string;
  visitorId: string;
  landingPath?: string | null;
  referer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    term?: string | null;
  } | null;
  deviceType?: string | null;
}) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id,code,status,user_id")
    .eq("code", input.code.toUpperCase())
    .maybeSingle();
  
  if (!affiliate || affiliate.status !== "active") return { ok: false as const };

  const ipHash = input.ip ? await hashValue(input.ip) : null;
  
  // 1. Registrar o clique bruto (affiliate_clicks)
  // Proteção: ignorar se for o mesmo visitor_id e affiliate_id nos últimos 2 minutos (prevenir F5 abusivo)
  const { data: recentClick } = await supabaseAdmin
    .from("affiliate_clicks")
    .select("id")
    .eq("affiliate_id", affiliate.id)
    .eq("visitor_id", input.visitorId)
    .gte("created_at", new Date(Date.now() - 2 * 60000).toISOString())
    .limit(1)
    .maybeSingle();

  if (!recentClick) {
    await supabaseAdmin.from("affiliate_clicks").insert({
      affiliate_id: affiliate.id,
      visitor_id: input.visitorId,
      landing_path: input.landingPath ?? null,
      referer: input.referer ?? null,
      ip_hash: ipHash,
      user_agent: input.userAgent?.slice(0, 250) ?? null,
      utm_source: input.utm?.source ?? null,
      utm_medium: input.utm?.medium ?? null,
      utm_campaign: input.utm?.campaign ?? null,
      utm_content: input.utm?.content ?? null,
      utm_term: input.utm?.term ?? null,
      device_type: input.deviceType ?? null,
    } as never);

    // Incrementar contador de cliques no registro do afiliado
    // Fallback se o RPC não estiver tipado no cliente
    try {
      await supabaseAdmin.rpc("increment_affiliate_clicks" as any, { aff_id: affiliate.id });
    } catch {
      const { data: current } = await supabaseAdmin
        .from("affiliates")
        .select("total_clicks")
        .eq("id", affiliate.id)
        .maybeSingle();
      await supabaseAdmin
        .from("affiliates")
        .update({ total_clicks: Number(current?.total_clicks ?? 0) + 1 })
        .eq("id", affiliate.id);
    }
    
    // Log de evento
    await recordAffiliateEvent({
      affiliateId: affiliate.id,
      eventType: "click",
      metadata: { visitorId: input.visitorId, landingPath: input.landingPath }
    });
  }

  // 2. Persistir Atribuição (Last Valid Referrer)
  const settings = await getSetting<{ attribution_window_days: number }>("affiliate_settings", { attribution_window_days: 30 });
  const expiresAt = new Date(Date.now() + settings.attribution_window_days * 86400000).toISOString();

  await supabaseAdmin.from("affiliate_attributions").upsert({
    affiliate_id: affiliate.id,
    visitor_id: input.visitorId,
    landing_page: input.landingPath ?? null,
    utm_source: input.utm?.source ?? null,
    utm_medium: input.utm?.medium ?? null,
    utm_campaign: input.utm?.campaign ?? null,
    utm_content: input.utm?.content ?? null,
    utm_term: input.utm?.term ?? null,
    expires_at: expiresAt,
    attributed_at: new Date().toISOString(),
  } as never, { onConflict: "visitor_id", ignoreDuplicates: false });

  return { ok: true as const, code: affiliate.code };
}

/** Liga o cadastro do usuário ao afiliado que o indicou. */
export async function attachReferral(input: {
  code?: string | null;
  userId: string;
  visitorId?: string | null;
}) {
  let affiliateId: string | null = null;
  
  if (input.code) {
    const { data: aff } = await supabaseAdmin
      .from("affiliates")
      .select("id,user_id,status")
      .eq("code", input.code.toUpperCase())
      .maybeSingle();
    if (aff && aff.status === "active" && aff.user_id !== input.userId) {
      affiliateId = aff.id;
    }
  }

  if (!affiliateId && input.visitorId) {
    const { data: attr } = await supabaseAdmin
      .from("affiliate_attributions")
      .select("affiliate_id")
      .eq("visitor_id", input.visitorId)
      .gte("expires_at", new Date().toISOString())
      .order("attributed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    affiliateId = attr?.affiliate_id ?? null;
  }

  if (!affiliateId) return { ok: false as const };

  const { data: affiliate } = await supabaseAdmin.from("affiliates").select("user_id").eq("id", affiliateId).single();
  if (affiliate?.user_id === input.userId) return { ok: false as const };

  const { data: already } = await supabaseAdmin
    .from("affiliate_referrals")
    .select("id")
    .eq("user_id", input.userId)
    .maybeSingle();
  
  if (already) return { ok: true as const, existing: true };

  const { error } = await supabaseAdmin.from("affiliate_referrals").insert({
    affiliate_id: affiliateId,
    user_id: input.userId,
    visitor_id: input.visitorId || `user:${input.userId}`,
    status: "signup",
    signed_up_at: new Date().toISOString(),
  } as never);

  if (error) return { ok: false as const };

  if (input.visitorId) {
    await supabaseAdmin
      .from("affiliate_attributions")
      .update({ user_id: input.userId } as never)
      .eq("visitor_id", input.visitorId);
  }

  await recordAffiliateEvent({
    affiliateId,
    userId: input.userId,
    eventType: "signup",
    metadata: { visitorId: input.visitorId }
  });

  await logAudit({
    userId: input.userId,
    action: "affiliate.signup_attributed",
    resource: "affiliate_referrals",
    resourceId: affiliateId,
  });

  return { ok: true as const };
}

/** Afiliado que indicou o usuário (atribuição persistente). */
export async function affiliateForUser(userId: string) {
  const { data: ref } = await supabaseAdmin
    .from("affiliate_referrals")
    .select("affiliate_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (ref?.affiliate_id) return ref.affiliate_id;

  const { data: attr } = await supabaseAdmin
    .from("affiliate_attributions")
    .select("affiliate_id")
    .eq("user_id", userId)
    .gte("expires_at", new Date().toISOString())
    .order("attributed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return attr?.affiliate_id ?? null;
}

/* ---------------------------- Comissão real ---------------------------- */

type PlanCommission = {
  affiliate_commission_rate?: number | null;
  affiliate_commission_fixed?: number | null;
} | null;

export type ResolvedCommission = {
  rate: number;
  fixed: number;
  amount: number;
  source: "override_plan" | "override_global" | "plan" | "default";
};

/** Prioridade: override por plano → override global do afiliado → plano → padrão. */
export async function resolveCommission(input: {
  affiliateId: string;
  planId?: string | null;
  amount: number;
}): Promise<ResolvedCommission> {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("commission_rate")
    .eq("id", input.affiliateId)
    .maybeSingle();

  const { data: overrides } = await supabaseAdmin
    .from("affiliate_commission_overrides")
    .select("plan_id,rate,fixed_amount,active")
    .eq("affiliate_id", input.affiliateId)
    .eq("active", true);

  const byPlan = input.planId ? overrides?.find((o) => o.plan_id === input.planId) : undefined;
  const global = overrides?.find((o) => !o.plan_id);

  let plan: PlanCommission = null;
  if (input.planId) {
    const { data } = await supabaseAdmin
      .from("plans")
      .select("affiliate_commission_rate,affiliate_commission_fixed")
      .eq("id", input.planId)
      .maybeSingle();
    plan = (data ?? null) as PlanCommission;
  }

  let rate = 0;
  let fixed = 0;
  let source: ResolvedCommission["source"] = "default";

  if (byPlan) {
    rate = Number(byPlan.rate);
    fixed = Number(byPlan.fixed_amount);
    source = "override_plan";
  } else if (global) {
    rate = Number(global.rate);
    fixed = Number(global.fixed_amount);
    source = "override_global";
  } else if (plan && (Number(plan.affiliate_commission_rate ?? 0) > 0 || Number(plan.affiliate_commission_fixed ?? 0) > 0)) {
    rate = Number(plan.affiliate_commission_rate ?? 0);
    fixed = Number(plan.affiliate_commission_fixed ?? 0);
    source = "plan";
  } else {
    rate = Number(affiliate?.commission_rate ?? 0);
    source = "default";
  }

  const amount = Math.round((input.amount * rate) / 100 * 100) / 100 + fixed;
  return { rate, fixed, amount: Math.max(0, Math.round(amount * 100) / 100), source };
}

/** Cria (ou mantém) a comissão PENDENTE de uma transação recém-criada. */
export async function registerPendingCommission(input: {
  affiliateId: string;
  transactionId: string;
  planId?: string | null;
  amount: number;
}) {
  const resolved = await resolveCommission({
    affiliateId: input.affiliateId,
    planId: input.planId ?? null,
    amount: input.amount,
  });
  if (resolved.amount <= 0) return null;

  const { data, error } = await supabaseAdmin
    .from("affiliate_commissions")
    .upsert(
      {
        affiliate_id: input.affiliateId,
        transaction_id: input.transactionId,
        plan_id: input.planId ?? null,
        amount: resolved.amount,
        base_amount: input.amount,
        rate: resolved.rate,
        source: resolved.source,
        status: "PENDING",
      } as never,
      { onConflict: "transaction_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) return null;

  await recomputePendingBalance(input.affiliateId);
  return data?.id ?? null;
}

/** Aprova a comissão de uma transação paga e credita o saldo disponível. */
export async function approveCommissionForTransaction(tx: {
  id: string;
  affiliate_id: string;
  plan_id?: string | null;
  amount: number;
  user_id?: string | null;
}) {
  const { data: existing } = await supabaseAdmin
    .from("affiliate_commissions")
    .select("id,status,amount")
    .eq("transaction_id", tx.id)
    .maybeSingle();

  let commissionId = existing?.id ?? null;
  let amount = Number(existing?.amount ?? 0);

  if (existing && (existing.status === "APPROVED" || existing.status === "PAID" || existing.status === "AVAILABLE")) {
    return existing.id;
  }

  const resolved = await resolveCommission({
    affiliateId: tx.affiliate_id,
    planId: tx.plan_id ?? null,
    amount: Number(tx.amount),
  });

  if (resolved.amount <= 0) return null;

  if (!existing) {
    const { data } = await supabaseAdmin
      .from("affiliate_commissions")
      .insert({
        affiliate_id: tx.affiliate_id,
        transaction_id: tx.id,
        plan_id: tx.plan_id ?? null,
        amount: resolved.amount,
        base_amount: Number(tx.amount),
        rate: resolved.rate,
        source: resolved.source,
        status: "APPROVED",
        approved_at: new Date().toISOString(),
      } as never)
      .select("id")
      .maybeSingle();
    commissionId = data?.id ?? null;
    amount = resolved.amount;
  } else {
    await supabaseAdmin
      .from("affiliate_commissions")
      .update({ 
        status: "APPROVED", 
        amount: resolved.amount,
        approved_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      } as any)
      .eq("id", existing.id);
    amount = resolved.amount;
  }

  if (!commissionId || amount <= 0) return null;

  await supabaseAdmin.from("affiliate_conversions").upsert({
    affiliate_id: tx.affiliate_id,
    user_id: tx.user_id ?? null,
    transaction_id: tx.id,
    amount: tx.amount,
    commission_amount: amount,
    status: "APPROVED",
    converted_at: new Date().toISOString(),
  } as never, { onConflict: "transaction_id" });

  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id,total_sales,total_commission,available_balance")
    .eq("id", tx.affiliate_id)
    .maybeSingle();

  if (affiliate) {
    const balance = Number(affiliate.available_balance) + amount;
    await supabaseAdmin
      .from("affiliates")
      .update({
        total_sales: Number(affiliate.total_sales) + 1,
        total_commission: Number(affiliate.total_commission) + amount,
        available_balance: balance,
      })
      .eq("id", affiliate.id);

    await recordLedger({
      affiliateId: affiliate.id,
      type: "commission",
      amount,
      balanceAfter: balance,
      reason: `Comissão aprovada da venda ${tx.id}`,
    });

    await recordAffiliateEvent({
      affiliateId: tx.affiliate_id,
      userId: tx.user_id ?? null,
      eventType: "conversion",
      resourceId: tx.id,
      metadata: { amount: tx.amount, commission: amount }
    });

    await recomputePendingBalance(affiliate.id);
    await recomputeAffiliateTier(affiliate.id);
  }
  return commissionId;
}

/** Marca a indicação como cliente convertido. */
export async function markReferralConverted(userId: string) {
  await supabaseAdmin
    .from("affiliate_referrals")
    .update({ status: "customer", converted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .neq("status", "customer");
}

export async function recordLedger(input: {
  affiliateId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason?: string | null;
  createdBy?: string | null;
}) {
  await supabaseAdmin.from("affiliate_balance_ledger").insert({
    affiliate_id: input.affiliateId,
    type: input.type,
    amount: input.amount,
    balance_after: input.balanceAfter,
    reason: input.reason ?? null,
    created_by: input.createdBy ?? null,
  } as never);
}

/** Recalcula o saldo pendente a partir das comissões ainda não aprovadas. */
export async function recomputePendingBalance(affiliateId: string) {
  const { data } = await supabaseAdmin
    .from("affiliate_commissions")
    .select("amount")
    .eq("affiliate_id", affiliateId)
    .eq("status", "PENDING");
  const pending = (data ?? []).reduce((s, c) => s + Number(c.amount), 0);
  await supabaseAdmin
    .from("affiliates")
    .update({ pending_balance: Math.round(pending * 100) / 100 })
    .eq("id", affiliateId);
  return pending;
}

export async function recordAffiliateEvent(input: {
  affiliateId?: string | null;
  userId?: string | null;
  eventType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("affiliate_events").insert({
    affiliate_id: input.affiliateId ?? null,
    user_id: input.userId ?? null,
    event_type: input.eventType,
    resource_id: input.resourceId ?? null,
    metadata: (input.metadata ?? {}) as never,
  } as never);
}
