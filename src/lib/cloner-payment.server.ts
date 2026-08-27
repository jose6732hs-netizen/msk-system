import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";
import { getPublicClonerProduct, getSmartOfferForPlan, CLONER_SLUG } from "./cloner.server";
import { findAffiliateByCode, newIdentifier } from "./commerce.server";
import { buildSplits, recordPaymentEvent } from "./financial.server";
import { pixExpiryFromNow } from "./orders.server";

type BillingInput = {
  userId: string;
  email: string;
  name: string;
  document: string;
  phone: string;
  affiliateCode?: string | null;
};

type PreparedPayment = {
  transactionId: string;
  amount: number;
  title: string;
  subtitle: string;
};

function objectMeta(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

async function resolveAffiliate(userId: string, affiliateCode?: string | null) {
  const direct = await findAffiliateByCode(affiliateCode ?? null);
  if (direct?.id) return direct.id as string;
  const { affiliateForUser } = await import("./affiliate.server");
  return affiliateForUser(userId);
}

async function registerCommission(input: {
  affiliateId: string | null;
  transactionId: string;
  planId: string;
  amount: number;
}) {
  if (!input.affiliateId) return;
  const { registerPendingCommission } = await import("./affiliate.server");
  await registerPendingCommission({ ...input, affiliateId: input.affiliateId });
}

export async function prepareClonerPaymentOrder(
  input: BillingInput & { planId: string },
): Promise<PreparedPayment> {
  const product = await getPublicClonerProduct();
  const selected = product.plans.find((item: any) => item.id === input.planId);

  if (!selected) throw new Error("CLONER_PLAN_NOT_FOUND");
  if (!product.zipReady) throw new Error("CLONER_NOT_READY");
  if (!product.enabled || !selected.active || !(Number(selected.price) > 0)) {
    throw new Error("CLONER_PLAN_UNAVAILABLE");
  }

  const amount = Number(selected.price);
  const amountCents = Math.round(amount * 100);
  const affiliateId = await resolveAffiliate(input.userId, input.affiliateCode);
  const identifier = newIdentifier("CLN");
  const metadata = {
    product: CLONER_SLUG,
    cloner_plan_slug: selected.slug,
    cadence: selected.cadence,
    delivery: "license+private_zip",
    payment_prepared: true,
    lines: [
      {
        planId: selected.id,
        slug: selected.slug,
        name: selected.name,
        product: "cloner",
        originalPrice: amount,
        finalPrice: amount,
        discountPercent: 0,
      },
    ],
  };

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      identifier,
      user_id: input.userId,
      plan_id: selected.id,
      affiliate_id: affiliateId,
      reseller_id: null,
      purpose: "purchase",
      method: "PENDING",
      amount,
      currency: selected.currency ?? "BRL",
      status: "PENDING",
      metadata: metadata as never,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const splits = await buildSplits({ amountCents, affiliateId: null, resellerId: null });
  await supabaseAdmin.from("transactions").update({ splits: splits as never }).eq("id", tx.id);
  await registerCommission({ affiliateId, transactionId: tx.id, planId: selected.id, amount });

  await recordPaymentEvent({
    transactionId: tx.id,
    event: "CHECKOUT_PREPARED",
    status: "PENDING",
    amount,
    metadata: { product: CLONER_SLUG, planId: selected.id, cadence: selected.cadence },
  });

  await logAudit({
    userId: input.userId,
    action: "checkout.cloner_prepared",
    resource: "transactions",
    resourceId: tx.id,
    metadata: { planId: selected.id, amount },
  });

  return {
    transactionId: tx.id,
    amount,
    title: selected.name,
    subtitle: "Licença + ZIP liberados após a confirmação do pagamento",
  };
}

export async function prepareSmartBundlePaymentOrder(
  input: BillingInput & { mainPlanId: string; companionPlanId: string },
): Promise<PreparedPayment> {
  const offer: any = await getSmartOfferForPlan(input.userId, input.mainPlanId);
  if (!offer?.available || offer.companion?.id !== input.companionPlanId) {
    throw new Error("SMART_OFFER_UNAVAILABLE");
  }

  const affiliateId = await resolveAffiliate(input.userId, input.affiliateCode);
  const amount = Number(offer.total);
  const amountCents = Math.round(amount * 100);
  const identifier = newIdentifier("BND");
  const comboKey = `${offer.main.slug}+${offer.companion.slug}`;
  const metadata = {
    smart_bundle: true,
    product: CLONER_SLUG,
    delivery: "license+private_zip",
    payment_prepared: true,
    source_kind: offer.sourceKind,
    cadence: offer.cadence,
    main_plan_id: offer.main.id,
    companion_plan_id: offer.companion.id,
    plan_ids: [offer.main.id, offer.companion.id],
    discount_percent: offer.discountPercent,
    discount_amount: offer.savings,
    companion_original_price: offer.companion.originalPrice,
    companion_final_price: offer.companion.discountedPrice,
    combo_key: comboKey,
    lines: [
      {
        planId: offer.main.id,
        slug: offer.main.slug,
        name: offer.main.name,
        product: offer.main.kind,
        originalPrice: offer.main.price,
        finalPrice: offer.main.price,
        discountPercent: 0,
      },
      {
        planId: offer.companion.id,
        slug: offer.companion.slug,
        name: offer.companion.name,
        product: offer.companion.kind,
        originalPrice: offer.companion.originalPrice,
        finalPrice: offer.companion.discountedPrice,
        discountPercent: offer.discountPercent,
      },
    ],
  };

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      identifier,
      user_id: input.userId,
      plan_id: null,
      affiliate_id: affiliateId,
      reseller_id: null,
      purpose: "purchase",
      method: "PENDING",
      amount,
      currency: "BRL",
      status: "PENDING",
      metadata: metadata as never,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const splits = await buildSplits({ amountCents, affiliateId: null, resellerId: null });
  await supabaseAdmin.from("transactions").update({ splits: splits as never }).eq("id", tx.id);
  await registerCommission({ affiliateId, transactionId: tx.id, planId: offer.main.id, amount });

  await recordPaymentEvent({
    transactionId: tx.id,
    event: "CHECKOUT_PREPARED",
    status: "PENDING",
    amount,
    metadata: { product: CLONER_SLUG, smartBundle: true, comboKey },
  });

  await logAudit({
    userId: input.userId,
    action: "checkout.smart_bundle_prepared",
    resource: "transactions",
    resourceId: tx.id,
    metadata: { comboKey, amount, discountPercent: offer.discountPercent },
  });

  return {
    transactionId: tx.id,
    amount,
    title: `${offer.main.name} + ${offer.companion.name}`,
    subtitle: `${offer.companion.name} com ${offer.discountPercent}% OFF no item adicional`,
  };
}

function lineItemsFromMetadata(metadata: Record<string, any>) {
  const lines = Array.isArray(metadata["lines"]) ? metadata["lines"] : [];
  return lines
    .map((line: any) => ({
      title: String(line?.name ?? "MSK SISTEM"),
      unitPrice: Math.round(Number(line?.finalPrice ?? 0) * 100),
      quantity: 1,
      tangible: false,
    }))
    .filter((line: any) => line.unitPrice > 0);
}

export async function generateClonerPixForTransaction(userId: string, transactionId: string) {
  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .select("id,identifier,user_id,plan_id,amount,status,method,metadata,splits,pix_code,pix_qrcode,provider_transaction_id,checkout_url,expires_at")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tx) throw new Error("PAYMENT_NOT_FOUND");

  const status = String(tx.status ?? "").toUpperCase();
  if (status === "PAID") throw new Error("PAYMENT_ALREADY_PAID");

  if (String(tx.method).toUpperCase() === "PIX" && (tx.pix_code || tx.checkout_url)) {
    return {
      transactionId: tx.id,
      amount: Number(tx.amount),
      pixCode: tx.pix_code ?? null,
      qrCode: tx.pix_qrcode ?? null,
      checkoutUrl: tx.checkout_url ?? null,
      expiresAt: tx.expires_at ?? pixExpiryFromNow(),
    };
  }

  if (["PROCESSING", "AUTHORIZED"].includes(status)) {
    throw new Error("PAYMENT_IN_PROGRESS");
  }

  const { data: locked } = await supabaseAdmin
    .from("transactions")
    .update({ status: "PROCESSING", method: "PIX" } as never)
    .eq("id", tx.id)
    .in("status", ["PENDING", "FAILED"])
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
    let items = lineItemsFromMetadata(metadata);
    if (!items.length && tx.plan_id) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("name,price")
        .eq("id", tx.plan_id)
        .maybeSingle();
      if (plan) {
        items = [
          {
            title: plan.name,
            unitPrice: Math.round(Number(plan.price ?? tx.amount) * 100),
            quantity: 1,
            tangible: false,
          },
        ];
      }
    }
    if (!items.length) {
      items = [
        {
          title: "MSK SISTEM",
          unitPrice: Math.round(Number(tx.amount) * 100),
          quantity: 1,
          tangible: false,
        },
      ];
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
      splits: (Array.isArray(tx.splits) ? tx.splits : []) as any[],
      metadata: { transactionId: tx.id, product: CLONER_SLUG },
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
      metadata: { product: CLONER_SLUG, provider },
    });

    await logAudit({
      userId,
      action: "checkout.cloner_pix_created",
      resource: "transactions",
      resourceId: tx.id,
      metadata: { amount: Number(tx.amount) },
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
      .eq("status", "PROCESSING");
    console.error("[cloner-payment] falha ao gerar PIX:", (error as Error).message.slice(0, 300));
    throw error;
  }
}
