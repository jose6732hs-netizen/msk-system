import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";
import { findAffiliateByCode, findResellerByCode, newIdentifier } from "./commerce.server";
import { buildSplits, recordPaymentEvent } from "./financial.server";
import { pixExpiryFromNow } from "./orders.server";

type PrepareInput = {
  userId: string;
  planId?: string | null;
  items?: { planId: string; quantity: number }[] | null;
  companion?: { mainPlanId: string; companionPlanId: string } | null;
  affiliateCode?: string | null;
  resellerCode?: string | null;
};

type PlanSnapshot = {
  name: string;
  slug: string;
  soldPrice: number;
  listPrice: number;
  currency: string;
  features: Record<string, unknown>;
  isLifetime: boolean;
  durationLabel: string | null;
  durationDays: number | null;
  durationValue: number | null;
  durationUnit: string | null;
  maxDevices: number | null;
};

type PreparedLine = {
  planId: string;
  name: string;
  slug: string;
  quantity: number;
  unitPrice: number;
  role: string;
  origin: "single" | "cart" | "bump";
  snapshot: PlanSnapshot;
};

const PLAN_COLUMNS =
  "id,name,slug,price,currency,active,is_lifetime,duration_label,duration_days,duration_value,duration_unit,max_devices,features";

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function objectMeta(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function planSnapshot(plan: any, soldPrice: number): PlanSnapshot {
  return {
    name: String(plan?.name ?? "MSK SISTEM"),
    slug: String(plan?.slug ?? ""),
    soldPrice: roundMoney(soldPrice),
    listPrice: roundMoney(Number(plan?.price ?? soldPrice)),
    currency: String(plan?.currency ?? "BRL"),
    features: objectMeta(plan?.features),
    isLifetime: Boolean(plan?.is_lifetime),
    durationLabel: plan?.duration_label ? String(plan.duration_label) : null,
    durationDays: Number.isFinite(Number(plan?.duration_days)) ? Number(plan.duration_days) : null,
    durationValue: Number.isFinite(Number(plan?.duration_value)) ? Number(plan.duration_value) : null,
    durationUnit: plan?.duration_unit ? String(plan.duration_unit) : null,
    maxDevices: Number.isFinite(Number(plan?.max_devices)) ? Number(plan.max_devices) : null,
  };
}

async function loadPlans(ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const { data } = await supabaseAdmin
    .from("plans")
    .select(PLAN_COLUMNS)
    .in("id", [...new Set(ids)])
    .eq("active", true);
  return new Map((data ?? []).map((plan: any) => [String(plan.id), plan]));
}

async function resolveAffiliate(userId: string, code?: string | null) {
  const direct = await findAffiliateByCode(code ?? null);
  if (direct?.id) return direct.id as string;
  const { affiliateForUser } = await import("./affiliate.server");
  return affiliateForUser(userId);
}

/**
 * Cria somente o pedido interno. Nenhum gateway é chamado aqui.
 * Também congela preço, duração e recursos de cada item no momento da compra.
 */
export async function preparePurchasePaymentOrder(input: PrepareInput) {
  const { licenseRoleFromSlug } = await import("./license-purpose");
  const { loadCart } = await import("./cart.server");

  let amount = 0;
  let basePlanId: string | null = null;
  let title = "Pedido MSK";
  let resellerId: string | null = null;
  const lineItems: PreparedLine[] = [];

  if (!input.planId && input.items?.length) {
    const byId = await loadPlans(input.items.map((item) => item.planId));
    const reseller = await findResellerByCode(input.resellerCode ?? null);
    const discountRate = reseller ? Math.max(0, Number(reseller.discount_rate ?? 0)) : 0;
    const priceRatio = Math.max(0, 1 - discountRate / 100);
    resellerId = reseller?.id ?? null;

    for (const requested of input.items) {
      const plan = byId.get(requested.planId) as any;
      if (!plan) throw new Error("PLAN_UNAVAILABLE");
      const quantity = Math.max(1, Math.min(20, Number(requested.quantity) || 1));
      const unitPrice = roundMoney(Number(plan.price) * priceRatio);
      amount += unitPrice * quantity;
      lineItems.push({
        planId: String(plan.id),
        name: String(plan.name),
        slug: String(plan.slug ?? ""),
        quantity,
        unitPrice,
        role: licenseRoleFromSlug(plan.slug),
        origin: "cart",
        snapshot: planSnapshot(plan, unitPrice),
      });
    }

    title = lineItems.length === 1 ? lineItems[0]!.name : `${lineItems.length} produtos MSK`;
  } else if (input.planId) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select(PLAN_COLUMNS)
      .eq("id", input.planId)
      .eq("active", true)
      .maybeSingle();
    if (!plan) throw new Error("PLAN_UNAVAILABLE");

    const reseller = await findResellerByCode(input.resellerCode ?? null);
    const discountRate = reseller ? Number(reseller.discount_rate ?? 0) : 0;
    resellerId = reseller?.id ?? null;
    amount = roundMoney(Math.max(0, Number(plan.price) * (1 - discountRate / 100)));
    basePlanId = plan.id;
    title = plan.name;
    lineItems.push({
      planId: plan.id,
      name: plan.name,
      slug: plan.slug,
      quantity: 1,
      unitPrice: amount,
      role: licenseRoleFromSlug(plan.slug),
      origin: "single",
      snapshot: planSnapshot(plan, amount),
    });
  } else {
    const cart = await loadCart(input.userId);
    if (!cart.lines.length) throw new Error("CART_EMPTY");
    amount = Number(cart.total);
    title = cart.lines.length === 1 ? cart.lines[0]!.name : `${cart.lines.length} produtos MSK`;

    const byId = await loadPlans(cart.lines.map((line) => line.planId));
    const ratio = cart.subtotal > 0 ? cart.total / cart.subtotal : 1;
    for (const line of cart.lines) {
      const plan = byId.get(line.planId);
      if (!plan) throw new Error("PLAN_UNAVAILABLE");
      const unitPrice = roundMoney(line.price * ratio);
      lineItems.push({
        planId: line.planId,
        name: line.name,
        slug: line.slug,
        quantity: line.quantity,
        unitPrice,
        role: licenseRoleFromSlug(line.slug),
        origin: "cart",
        snapshot: planSnapshot(plan, unitPrice),
      });
    }

    const reseller = await findResellerByCode(input.resellerCode ?? cart.resellerCode ?? null);
    resellerId = reseller?.id ?? null;
  }

  let companionMeta: Record<string, unknown> | null = null;
  if (input.companion?.mainPlanId && input.companion.companionPlanId) {
    const hasMainPlan = lineItems.some((line) => line.planId === input.companion!.mainPlanId);
    const companionAlreadyInOrder = lineItems.some(
      (line) => line.planId === input.companion!.companionPlanId,
    );
    if (!hasMainPlan || companionAlreadyInOrder) throw new Error("INVALID_COMPANION");

    const { getSmartOfferForPlan } = await import("./cloner.server");
    const offer: any = await getSmartOfferForPlan(input.userId, input.companion.mainPlanId);
    if (!offer?.available || String(offer.companion?.id) !== input.companion.companionPlanId) {
      throw new Error("INVALID_COMPANION");
    }

    const companionPrice = roundMoney(Number(offer.companion.discountedPrice ?? 0));
    if (!(companionPrice > 0)) throw new Error("INVALID_COMPANION");
    const companionPlans = await loadPlans([String(offer.companion.id)]);
    const companionPlan = companionPlans.get(String(offer.companion.id));
    if (!companionPlan) throw new Error("INVALID_COMPANION");

    amount += companionPrice;
    lineItems.push({
      planId: String(offer.companion.id),
      name: String(offer.companion.name),
      slug: String(offer.companion.slug ?? ""),
      quantity: 1,
      unitPrice: companionPrice,
      role: licenseRoleFromSlug(offer.companion.slug),
      origin: "bump",
      snapshot: planSnapshot(companionPlan, companionPrice),
    });
    title = `${title} + ${offer.companion.name}`;
    companionMeta = {
      companion_plan_id: offer.companion.id,
      companion_final_price: companionPrice,
      companion_original_price: Number(offer.companion.originalPrice ?? 0),
      discount_percent: Number(offer.discountPercent ?? 0),
      plan_ids: [input.companion.mainPlanId, offer.companion.id],
    };
  }

  amount = roundMoney(amount);
  if (!(amount > 0) || !lineItems.length) throw new Error("INVALID_AMOUNT");

  const amountCents = Math.round(amount * 100);
  const affiliateId = await resolveAffiliate(input.userId, input.affiliateCode ?? null);
  const identifier = newIdentifier("MSK");
  const isBulk =
    !basePlanId ||
    lineItems.length > 1 ||
    lineItems.some((line) => line.quantity > 1) ||
    !!companionMeta;
  const transactionPlanId = isBulk ? null : basePlanId;

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      identifier,
      user_id: input.userId,
      plan_id: transactionPlanId,
      affiliate_id: affiliateId,
      reseller_id: resellerId,
      purpose: "purchase",
      method: "PENDING",
      amount,
      currency: "BRL",
      status: "PENDING",
      metadata: {
        payment_prepared: true,
        purchase_snapshot_version: 1,
        bulk: isBulk,
        line_items: lineItems,
        ...(companionMeta ?? {}),
      } as never,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const splits = await buildSplits({ amountCents, affiliateId: null, resellerId });
  await supabaseAdmin.from("transactions").update({ splits: splits as never }).eq("id", tx.id);

  if (affiliateId) {
    const { registerPendingCommission } = await import("./affiliate.server");
    await registerPendingCommission({ affiliateId, transactionId: tx.id, planId: transactionPlanId, amount });
  }

  await recordPaymentEvent({
    transactionId: tx.id,
    event: "CHECKOUT_PREPARED",
    status: "PENDING",
    amount,
    metadata: { bulk: isBulk, items: lineItems.length },
  });

  await logAudit({
    userId: input.userId,
    action: "checkout.purchase_prepared",
    resource: "transactions",
    resourceId: tx.id,
    metadata: { amount, bulk: isBulk, items: lineItems.length },
  });

  return {
    transactionId: tx.id,
    amount,
    title,
    subtitle: "Escolha PIX ou cartão para concluir sua compra",
  };
}

/** Gera PIX apenas depois que o comprador escolhe PIX no checkout interno. */
export async function generatePurchasePixForTransaction(userId: string, transactionId: string) {
  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .select("id,identifier,user_id,plan_id,amount,status,method,metadata,splits,pix_code,pix_qrcode,provider,provider_transaction_id,checkout_url,expires_at")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .eq("purpose", "purchase")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tx) throw new Error("PAYMENT_NOT_FOUND");

  const status = String(tx.status ?? "").toUpperCase();
  const method = String(tx.method ?? "").toUpperCase();
  if (status === "PAID") throw new Error("PAYMENT_ALREADY_PAID");

  if (method === "PIX" && (tx.pix_code || tx.checkout_url)) {
    return {
      transactionId: tx.id,
      amount: Number(tx.amount),
      pixCode: tx.pix_code ?? null,
      qrCode: tx.pix_qrcode ?? null,
      checkoutUrl: tx.checkout_url ?? null,
      expiresAt: tx.expires_at ?? pixExpiryFromNow(),
    };
  }

  if (tx.provider_transaction_id && method !== "PIX") throw new Error("PAYMENT_METHOD_LOCKED");
  if (["PROCESSING", "AUTHORIZED"].includes(status) && method !== "PIX") {
    throw new Error("PAYMENT_IN_PROGRESS");
  }

  const { data: locked } = await supabaseAdmin
    .from("transactions")
    .update({ status: "PROCESSING", method: "PIX" } as never)
    .eq("id", tx.id)
    .in("status", ["PENDING", "FAILED"])
    .in("method", ["PENDING", "PIX"])
    .select("id")
    .maybeSingle();
  if (!locked) throw new Error("PAYMENT_IN_PROGRESS");

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name,email,phone,document")
      .eq("id", userId)
      .maybeSingle();

    const phone = String(profile?.phone ?? "").replace(/\D/g, "");
    const document = String(profile?.document ?? "").replace(/\D/g, "");
    if (phone.length < 10 || (document.length !== 11 && document.length !== 14)) {
      throw new Error("BILLING_INCOMPLETE");
    }

    const metadata = objectMeta(tx.metadata);
    const rawLines = Array.isArray(metadata.line_items) ? metadata.line_items : [];
    let items = rawLines
      .map((line: any) => ({
        title: String(line?.name ?? "MSK SISTEM"),
        unitPrice: Math.max(1, Math.round(Number(line?.unitPrice ?? 0) * 100)),
        quantity: Math.max(1, Number(line?.quantity ?? 1)),
        tangible: false,
      }))
      .filter((line: any) => line.unitPrice > 0);

    if (!items.length) {
      items = [{ title: "MSK SISTEM", unitPrice: Math.round(Number(tx.amount) * 100), quantity: 1, tangible: false }];
    }

    const { createPixWithFailover } = await import("./payments/gateway.server");
    const { provider, result, pixCode } = await createPixWithFailover({
      identifier: tx.identifier,
      amountCents: Math.round(Number(tx.amount) * 100),
      customer: {
        name: profile?.name || profile?.email || "Cliente MSK",
        email: profile?.email || "cliente@msksystem.online",
        phone,
        document: { number: document, type: document.length === 14 ? "CNPJ" : "CPF" },
      },
      items,
      splits: Array.isArray(tx.splits) ? tx.splits : [],
      metadata: { transactionId: tx.id },
    });

    const qrCode = result.pix?.base64 ?? result.pix?.image ?? null;
    const providerId = result.transactionId ?? result.id ?? null;
    const expiresAt = pixExpiryFromNow();

    await supabaseAdmin
      .from("transactions")
      .update({
        provider,
        provider_transaction_id: providerId,
        pix_code: pixCode,
        pix_qrcode: qrCode,
        checkout_url: result.order?.url ?? null,
        expires_at: expiresAt,
        status: "PENDING",
        method: "PIX",
        raw: result as never,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", tx.id);

    await recordPaymentEvent({
      transactionId: tx.id,
      externalId: providerId,
      event: "PIX_CREATED",
      status: "PENDING",
      amount: Number(tx.amount),
      metadata: { provider },
    });

    await logAudit({
      userId,
      action: "checkout.purchase_pix_created",
      resource: "transactions",
      resourceId: tx.id,
      metadata: { amount: Number(tx.amount), provider },
    });

    return {
      transactionId: tx.id,
      amount: Number(tx.amount),
      pixCode,
      qrCode,
      checkoutUrl: result.order?.url ?? null,
      expiresAt,
    };
  } catch (error) {
    await supabaseAdmin
      .from("transactions")
      .update({ status: "PENDING", method: "PENDING" } as never)
      .eq("id", tx.id)
      .eq("status", "PROCESSING")
      .is("provider_transaction_id", null);
    console.error("[purchase-payment] falha ao gerar PIX:", String((error as Error).message).slice(0, 300));
    throw error;
  }
}
