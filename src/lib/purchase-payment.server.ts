import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";
import { findAffiliateByCode, findResellerByCode, newIdentifier } from "./commerce.server";
import { buildSplits, recordPaymentEvent } from "./financial.server";
import { pixExpiryFromNow } from "./orders.server";

type PrepareInput = {
  userId: string;
  planId?: string | null;
  affiliateCode?: string | null;
  resellerCode?: string | null;
};

function objectMeta(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

async function resolveAffiliate(userId: string, code?: string | null) {
  const direct = await findAffiliateByCode(code ?? null);
  if (direct?.id) return direct.id as string;
  const { affiliateForUser } = await import("./affiliate.server");
  return affiliateForUser(userId);
}

/**
 * Cria somente o pedido interno. Nenhum gateway é chamado aqui.
 * Isso permite mostrar PIX e cartão antes de abrir qualquer cobrança externa.
 */
export async function preparePurchasePaymentOrder(input: PrepareInput) {
  const { licenseRoleFromSlug } = await import("./license-purpose");
  const { loadCart } = await import("./cart.server");

  let amount = 0;
  let planId: string | null = null;
  let title = "Pedido MSK";
  let resellerId: string | null = null;
  const lineItems: Array<{
    planId: string;
    name: string;
    slug: string;
    quantity: number;
    unitPrice: number;
    role: string;
    origin: "single" | "cart";
  }> = [];

  if (input.planId) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id,name,slug,price,currency,active")
      .eq("id", input.planId)
      .eq("active", true)
      .maybeSingle();
    if (!plan) throw new Error("PLAN_UNAVAILABLE");

    const reseller = await findResellerByCode(input.resellerCode ?? null);
    const discountRate = reseller ? Number(reseller.discount_rate ?? 0) : 0;
    resellerId = reseller?.id ?? null;
    amount = Math.max(0, Number(plan.price) * (1 - discountRate / 100));
    planId = plan.id;
    title = plan.name;
    lineItems.push({
      planId: plan.id,
      name: plan.name,
      slug: plan.slug,
      quantity: 1,
      unitPrice: amount,
      role: licenseRoleFromSlug(plan.slug),
      origin: "single",
    });
  } else {
    const cart = await loadCart(input.userId);
    if (!cart.lines.length) throw new Error("CART_EMPTY");
    amount = Number(cart.total);
    title = cart.lines.length === 1 ? cart.lines[0]!.name : `${cart.lines.length} produtos MSK`;

    const ratio = cart.subtotal > 0 ? cart.total / cart.subtotal : 1;
    for (const line of cart.lines) {
      lineItems.push({
        planId: line.planId,
        name: line.name,
        slug: line.slug,
        quantity: line.quantity,
        unitPrice: Math.round(line.price * ratio * 100) / 100,
        role: licenseRoleFromSlug(line.slug),
        origin: "cart",
      });
    }

    const reseller = await findResellerByCode(input.resellerCode ?? cart.resellerCode ?? null);
    resellerId = reseller?.id ?? null;
  }

  if (!(amount > 0)) throw new Error("INVALID_AMOUNT");

  const amountCents = Math.round(amount * 100);
  const affiliateId = await resolveAffiliate(input.userId, input.affiliateCode ?? null);
  const identifier = newIdentifier("MSK");
  const isBulk = !planId;

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      identifier,
      user_id: input.userId,
      plan_id: planId,
      affiliate_id: affiliateId,
      reseller_id: resellerId,
      purpose: "purchase",
      method: "PENDING",
      amount,
      currency: "BRL",
      status: "PENDING",
      metadata: {
        payment_prepared: true,
        bulk: isBulk,
        line_items: lineItems,
      } as never,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const splits = await buildSplits({
    amountCents,
    affiliateId: null,
    resellerId,
  });
  await supabaseAdmin.from("transactions").update({ splits: splits as never }).eq("id", tx.id);

  if (affiliateId) {
    const { registerPendingCommission } = await import("./affiliate.server");
    await registerPendingCommission({
      affiliateId,
      transactionId: tx.id,
      planId,
      amount,
    });
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

  // Se já existe uma cobrança externa de cartão, nunca cria PIX no mesmo pedido.
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
      items = [{
        title: "MSK SISTEM",
        unitPrice: Math.round(Number(tx.amount) * 100),
        quantity: 1,
        tangible: false,
      }];
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
    // Só volta para PENDING se não houve identificador externo persistido.
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
