/**
 * Serviços financeiros compartilhados: faturas, eventos de pagamento,
 * cálculo de expiração, splits e estornos. Somente servidor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";
import type { AmploSplit } from "./payments/amplo-pay.server";

export type DurationUnit = "minutes" | "hours" | "days" | "weeks" | "months" | "lifetime";

const UNIT_MS: Record<Exclude<DurationUnit, "lifetime" | "months">, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
};

/** Calcula a expiração a partir de uma unidade + valor. Vitalício retorna null. */
export function computeExpiry(unit: string, value: number, from = new Date()): string | null {
  const u = (unit || "days") as DurationUnit;
  if (u === "lifetime") return null;
  if (u === "months") {
    const d = new Date(from);
    d.setMonth(d.getMonth() + value);
    return d.toISOString();
  }
  const ms = UNIT_MS[u as keyof typeof UNIT_MS] ?? UNIT_MS.days;
  return new Date(from.getTime() + value * ms).toISOString();
}

/** Estado do gateway → estado interno. HTTP 200 nunca significa "pago". */
export function mapGatewayStatus(raw: string | null | undefined): string {
  const s = String(raw ?? "").toUpperCase();
  if (["PAID", "OK", "APPROVED", "COMPLETED", "TRANSACTION_PAID"].includes(s)) return "PAID";
  if (["PENDING", "WAITING_PAYMENT", "PROCESSING", "TRANSACTION_CREATED"].includes(s)) return "PENDING";
  if (["FAILED", "ERROR"].includes(s)) return "FAILED";
  if (["REJECTED", "DENIED"].includes(s)) return "REJECTED";
  if (["CANCELED", "CANCELLED", "TRANSACTION_CANCELED"].includes(s)) return "CANCELED";
  if (["REFUNDED", "TRANSACTION_REFUNDED"].includes(s)) return "REFUNDED";
  if (["CHARGED_BACK", "CHARGEBACK", "TRANSACTION_CHARGED_BACK"].includes(s)) return "CHARGED_BACK";
  return s || "UNKNOWN";
}

export async function recordPaymentEvent(input: {
  transactionId?: string | null;
  webhookEventId?: string | null;
  externalId?: string | null;
  event: string;
  status: string;
  amount?: number | null;
  metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("payment_events").insert({
    transaction_id: input.transactionId ?? null,
    webhook_event_id: input.webhookEventId ?? null,
    external_id: input.externalId ?? null,
    event: input.event,
    status: input.status,
    amount: input.amount ?? null,
    metadata: (input.metadata ?? {}) as never,
  } as never);
}

function invoiceNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `INV-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Cria a fatura de uma transação confirmada (idempotente por transação). */
export async function createInvoice(input: {
  transactionId: string;
  userId?: string | null;
  subscriptionId?: string | null;
  licenseId?: string | null;
  amount: number;
  currency?: string;
  method?: string | null;
  externalId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data: existing } = await supabaseAdmin
    .from("invoices")
    .select("id")
    .eq("transaction_id", input.transactionId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabaseAdmin
    .from("invoices")
    .insert({
      number: invoiceNumber(),
      user_id: input.userId ?? null,
      transaction_id: input.transactionId,
      subscription_id: input.subscriptionId ?? null,
      license_id: input.licenseId ?? null,
      external_id: input.externalId ?? null,
      amount: input.amount,
      currency: input.currency ?? "BRL",
      method: input.method ?? null,
      status: "PAID",
      paid_at: new Date().toISOString(),
      metadata: (input.metadata ?? {}) as never,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Monta os splits (em centavos) para produtor, afiliado e revendedor. */
export async function buildSplits(input: {
  amountCents: number;
  affiliateId?: string | null;
  resellerId?: string | null;
  affiliateRate?: number | null;
}): Promise<AmploSplit[]> {
  const splits: AmploSplit[] = [];
  const { data: adminSettings } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "commission_split_config")
    .maybeSingle();
  
  const splitConfig = (adminSettings?.value as any) || {};

  if (input.affiliateId) {
    const { data: aff } = await supabaseAdmin
      .from("affiliates")
      .select("commission_rate,producer_id:user_id,id")
      .eq("id", input.affiliateId)
      .maybeSingle();
    
    // Prioridade: Configuração específica do Super Admin > Taxa do afiliado
    let rate = Number(aff?.commission_rate ?? 0);
    let fixedAmount = 0;

    if (splitConfig.affiliates) {
       const affConfig = splitConfig.affiliates[aff?.id || ""] || splitConfig.default_affiliate;
       if (affConfig) {
          if (affConfig.type === 'fixed') fixedAmount = Math.round(Number(affConfig.value) * 100);
          else rate = Number(affConfig.value);
       }
    }

    const producerId = (aff as { producer_id?: string } | null)?.producer_id;
    const value = fixedAmount > 0 ? fixedAmount : Math.floor((input.amountCents * rate) / 100);
    
    if (producerId && value > 0) splits.push({ producerId, amount: value });
  }

  if (input.resellerId) {
    const { data: rv } = await supabaseAdmin
      .from("resellers")
      .select("commission_rate,producer_id:user_id,id")
      .eq("id", input.resellerId)
      .maybeSingle();
    
    let rate = Number(rv?.commission_rate ?? 0);
    let fixedAmount = 0;

    if (splitConfig.resellers) {
       const resConfig = splitConfig.resellers[rv?.id || ""] || splitConfig.default_reseller;
       if (resConfig) {
          if (resConfig.type === 'fixed') fixedAmount = Math.round(Number(resConfig.value) * 100);
          else rate = Number(resConfig.value);
       }
    }

    const producerId = (rv as { producer_id?: string } | null)?.producer_id;
    const value = fixedAmount > 0 ? fixedAmount : Math.floor((input.amountCents * rate) / 100);
    
    if (producerId && value > 0) splits.push({ producerId, amount: value });
  }

  const total = splits.reduce((s, x) => s + x.amount, 0);
  if (total > input.amountCents) throw new Error("SPLIT_EXCEDE_TRANSACAO");
  return splits;
}

/** Reverte comissões e ajusta a licença após estorno/chargeback. */
export async function reverseTransaction(transactionId: string, reason: "refund" | "chargeback") {
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) return;

  const newStatus = reason === "refund" ? "REFUNDED" : "CHARGED_BACK";
  await supabaseAdmin
    .from("transactions")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", tx.id);

  // Reverte comissões de afiliado ainda não pagas.
  const { data: commissions } = await supabaseAdmin
    .from("affiliate_commissions")
    .select("id,affiliate_id,amount,status")
    .eq("transaction_id", tx.id);
  for (const c of commissions ?? []) {
    if (c.status === "PAID") continue;
    await supabaseAdmin.from("affiliate_commissions").update({ status: "REVERSED" }).eq("id", c.id);
    const { data: aff } = await supabaseAdmin
      .from("affiliates")
      .select("id,available_balance,total_commission")
      .eq("id", c.affiliate_id)
      .maybeSingle();
    if (aff) {
      await supabaseAdmin
        .from("affiliates")
        .update({
          available_balance: Math.max(0, Number(aff.available_balance) - Number(c.amount)),
          total_commission: Math.max(0, Number(aff.total_commission) - Number(c.amount)),
        })
        .eq("id", aff.id);
    }
  }

  // Ação sobre a licença conforme configuração do Super Admin.
  const { data: setting } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "refund_policy")
    .maybeSingle();
  const policy =
    ((setting?.value as { on_refund?: string; on_chargeback?: string } | null) ?? {})[
      reason === "refund" ? "on_refund" : "on_chargeback"
    ] ?? (reason === "refund" ? "suspended" : "revoked");

  await supabaseAdmin
    .from("licenses")
    .update({
      status: policy as "active" | "expired" | "inactive" | "revoked" | "suspended",
      revoked_at: policy === "revoked" ? new Date().toISOString() : null,
      revocation_reason: reason,
    })
    .eq("transaction_id", tx.id);

  await supabaseAdmin
    .from("invoices")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("transaction_id", tx.id);

  await logAudit({
    userId: tx.user_id,
    action: `transaction.${reason}`,
    resource: "transactions",
    resourceId: tx.id,
    metadata: { policy },
  });
}
