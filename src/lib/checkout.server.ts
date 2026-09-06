import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pixExpiryFromNow } from "./orders.server";
import { AmploPayService } from "./payments/amplo-pay.server";
import { findAffiliateByCode, findResellerByCode, newIdentifier } from "./commerce.server";
import { logAudit } from "./audit.server";
import { buildSplits, mapGatewayStatus, recordPaymentEvent } from "./financial.server";

function periodicityFromPlan(plan: { duration_unit?: string | null; duration_value?: number | null }) {
  const rawUnit = (plan.duration_unit ?? "months").toLowerCase();
  const unit = ({ day: "days", week: "weeks", month: "months" } as Record<string, string>)[rawUnit] ?? rawUnit;
  const value = Number(plan.duration_value ?? 1) || 1;
  if (unit === "days") return { periodicityType: "DAYS" as const, periodicity: value };
  if (unit === "weeks") return { periodicityType: "WEEKS" as const, periodicity: value };
  if (unit === "months") return { periodicityType: "MONTHS" as const, periodicity: value };
  return { periodicityType: "MONTHS" as const, periodicity: 1 };
}

/**
 * Assinatura recorrente (PIX ou cartão). Sempre criada no servidor:
 * o preço vem do banco e nunca do cliente.
 */
export async function createSubscriptionCheckout(input: {
  userId: string;
  email: string;
  name: string;
  planId: string;
  method: "PIX" | "CARD";
  clientIp?: string | null;
  card?:
    | { number: string; holderName: string; expiresAt: string; cvv: string; installments?: number | undefined }
    | undefined;
  affiliateCode?: string | null;
  resellerCode?: string | null;
  document: string;
  phone: string;
}) {
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", input.planId)
    .eq("active", true)
    .maybeSingle();
  if (!plan) throw new Error("Plano indisponível");
  if (plan.is_lifetime) throw new Error("Planos vitalícios não possuem assinatura recorrente");
  if (input.method === "CARD" && !input.card) throw new Error("Dados do cartão obrigatórios");

  const affiliate = await findAffiliateByCode(input.affiliateCode);
  const reseller = await findResellerByCode(input.resellerCode);
  const price = Number(plan.price);
  const amountCents = Math.round(price * 100);
  const identifier = newIdentifier("SUB");
  const { periodicityType, periodicity } = periodicityFromPlan(plan as never);
  const { affiliateForUser, registerPendingCommission } = await import("./affiliate.server");
  const affiliateId = affiliate?.id ?? (await affiliateForUser(input.userId));

  const { data: subscription, error: subError } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: input.userId,
      plan_id: plan.id,
      status: "pending",
      provider: "amplopay",
    } as never)
    .select("id")
    .single();
  if (subError) throw subError;

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      identifier,
      user_id: input.userId,
      plan_id: plan.id,
      subscription_id: subscription.id,
      affiliate_id: affiliateId,
      reseller_id: reseller?.id ?? null,
      purpose: "subscription",
      method: input.method,
      amount: price,
      currency: plan.currency,
      status: "PENDING",
      metadata: { plan: plan.slug, periodicityType, periodicity } as never,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Split desativado para afiliados conforme nova regra de carteira interna.
  // Somente manter splits se houver revendedor (reseller).
  const splits = await buildSplits({
    amountCents,
    affiliateId: null, // NÃO ENVIAR AFILIADO PARA SPLIT
    resellerId: reseller?.id ?? null,
  });
  await supabaseAdmin.from("transactions").update({ splits: splits as never }).eq("id", tx.id);
  if (affiliateId) {
    await registerPendingCommission({
      affiliateId,
      transactionId: tx.id,
      planId: plan.id,
      amount: price,
    });
  }

  const customer = { name: input.name || input.email, email: input.email, phone: input.phone, document: { number: input.document, type: input.document.length === 14 ? "CNPJ" as const : "CPF" as const } };

  try {
    // PIX sempre passa pelo gateway ativo (o mesmo de todas as outras ofertas).
    // Cartão continua no provedor que suporta recorrência com cartão.
    let providerUsed = "amplopay";
    let result: any;

    if (input.method === "PIX") {
      const { createPixWithFailover } = await import("./payments/gateway.server");
      const pix = await createPixWithFailover({
        identifier,
        amountCents,
        customer,
        items: [{ title: plan.name, unitPrice: amountCents, quantity: 1, tangible: false }],
        splits,
        metadata: { transactionId: tx.id, subscriptionId: subscription.id, periodicityType, periodicity },
      });
      providerUsed = pix.provider;
      result = { ...pix.result, pix: { ...(pix.result.pix ?? {}), code: pix.pixCode ?? pix.result.pix?.code } };
    } else {
      const service = await AmploPayService.create();
      result = await service.createCardSubscription({
        identifier,
        amountCents,
        customer,
        clientIp: input.clientIp || "0.0.0.0",
        productName: plan.name,
        periodicityType,
        periodicity,
        card: input.card!,
        splits,
        metadata: { transactionId: tx.id },
      });
    }

    const providerId = result.transactionId ?? result.id ?? null;
    const status = mapGatewayStatus(result.status);
    const pixCode = (result as { pix?: { code?: string } }).pix?.code ?? null;
    const qr =
      (result as { pix?: { base64?: string; image?: string } }).pix?.base64 ??
      (result as { pix?: { image?: string } }).pix?.image ??
      null;

    await supabaseAdmin
      .from("transactions")
      .update({
        provider: providerUsed,
        provider_transaction_id: providerId,
        external_id: result.subscriptionId ?? null,
        pix_code: pixCode,
        pix_qrcode: qr,
        checkout_url: result.order?.url ?? null,
        expires_at: input.method === "PIX" ? pixExpiryFromNow() : null,
        status: "PENDING",
        raw: result as any,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", tx.id);

    await supabaseAdmin
      .from("subscriptions")
      .update({ provider: providerUsed, provider_subscription_id: result.subscriptionId ?? providerId } as never)
      .eq("id", subscription.id);


    await recordPaymentEvent({
      transactionId: tx.id,
      externalId: providerId,
      event: "SUBSCRIPTION_CREATED",
      status,
      amount: price,
      metadata: { method: input.method },
    });

    await logAudit({
      userId: input.userId,
      action: "checkout.subscription_created",
      resource: "transactions",
      resourceId: tx.id,
      metadata: { plan: plan.slug, method: input.method },
    });

    return {
      transactionId: tx.id,
      subscriptionId: subscription.id,
      identifier,
      amount: price,
      pixCode,
      qrCode: qr,
      status,
    };
  } catch (e) {
    await supabaseAdmin
      .from("transactions")
      .update({ status: "FAILED", metadata: { error: (e as Error).message } as never })
      .eq("id", tx.id);
    await supabaseAdmin.from("subscriptions").update({ status: "cancelled" }).eq("id", subscription.id);
    throw e;
  }
}

export async function createPixCheckout(input: {
  userId: string;
  email: string;
  name: string;
  planId?: string | null; // Agora opcional se houver carrinho
  items?: { planId: string; quantity: number }[] | null;
  /** Order bump aceito no checkout (oferta inteligente): item adicional com desconto. */
  companion?: { mainPlanId: string; companionPlanId: string } | null;

  affiliateCode?: string | null;
  resellerCode?: string | null;
  document: string;
  phone: string;
}) {
  const { loadCart } = await import("./cart.server");

  const { licenseRoleFromSlug } = await import("./license-purpose");

  let finalPrice = 0;
  let planName = "";
  let planSlug = "";
  let items: any[] = [];
  let isBulk = false;
  /** Cada linha vira uma licença separada e identificada na entrega. */
  const lineItems: {
    planId: string;
    name: string;
    slug: string;
    quantity: number;
    unitPrice: number;
    role: string;
    origin: "single" | "cart" | "bump";
  }[] = [];


  if (!input.planId && input.items?.length) {
    // Lote enviado pelo carrinho do navegador (fonte de verdade: tabela plans).
    isBulk = true;
    const ids = [...new Set(input.items.map((i) => i.planId))];
    const { data: rows } = await supabaseAdmin
      .from("plans")
      .select("id,name,slug,price")
      .in("id", ids)
      .eq("active", true);
    const byId = new Map((rows ?? []).map((p: any) => [p.id, p]));
    for (const line of input.items) {
      const plan = byId.get(line.planId);
      if (!plan) throw new Error("Um dos planos do carrinho não está mais disponível.");
      finalPrice += Number(plan.price) * line.quantity;
      items.push({
        title: plan.name,
        unitPrice: Math.round(Number(plan.price) * 100),
        quantity: line.quantity,
        tangible: false,
      });
      lineItems.push({
        planId: plan.id,
        name: plan.name,
        slug: plan.slug,
        quantity: line.quantity,
        unitPrice: Number(plan.price),
        role: licenseRoleFromSlug(plan.slug),
        origin: "cart",
      });
    }
    planName = items.length === 1 ? String(items[0].title) : `${items.length} Planos MSK`;
    planSlug = "cart_bulk";
  } else if (!input.planId) {
    const cart = await loadCart(input.userId);
    if (!cart.lines.length) throw new Error("Seu carrinho está vazio.");
    isBulk = true;
    finalPrice = cart.total;
    planName = cart.lines.length === 1 ? (cart.lines[0]?.name ?? "Plano MSK") : `${cart.lines.length} Planos MSK`;
    planSlug = "cart_bulk";
    items = cart.lines.map((l) => ({
      title: l.name,
      unitPrice: Math.round(l.price * 100),
      quantity: l.quantity,
      tangible: false,
    }));
    for (const l of cart.lines as any[]) {
      lineItems.push({
        planId: String(l.planId),
        name: String(l.name),
        slug: String(l.slug ?? ""),
        quantity: Number(l.quantity ?? 1),
        unitPrice: Number(l.price ?? 0),
        role: licenseRoleFromSlug(l.slug),
        origin: "cart",
      });
    }
  } else {
    const planId = input.planId;
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("id", planId)
      .eq("active", true)
      .maybeSingle();
    if (!plan) throw new Error("Plano indisponível");

    const reseller = await findResellerByCode(input.resellerCode);
    const discount = reseller ? Number(reseller.discount_rate) : 0;
    finalPrice = Math.max(0, Number(plan.price) * (1 - discount / 100));
    planName = plan.name;
    planSlug = plan.slug;
    items = [{ title: plan.name, unitPrice: Math.round(finalPrice * 100), quantity: 1, tangible: false }];
    lineItems.push({
      planId: plan.id,
      name: plan.name,
      slug: plan.slug,
      quantity: 1,
      unitPrice: finalPrice,
      role: licenseRoleFromSlug(plan.slug),
      origin: "single",
    });
  }

  // Order bump aceito ("quero adquirir também essa oferta"): o preço com desconto
  // é sempre recalculado no servidor e somado ao total bruto do pedido.
  let companionMeta: Record<string, unknown> | null = null;
  if (input.companion?.companionPlanId && input.companion.mainPlanId) {
    const { getSmartOfferForPlan } = await import("./cloner.server");
    const offer: any = await getSmartOfferForPlan(input.userId, input.companion.mainPlanId);
    if (offer?.available && offer.companion?.id === input.companion.companionPlanId) {
      const companionPrice = Number(offer.companion.discountedPrice ?? 0);
      if (companionPrice > 0) {
        finalPrice += companionPrice;
        items.push({
          title: `${offer.companion.name} (${offer.discountPercent}% OFF)`,
          unitPrice: Math.round(companionPrice * 100),
          quantity: 1,
          tangible: false,
        });
        lineItems.push({
          planId: String(offer.companion.id),
          name: String(offer.companion.name),
          slug: String(offer.companion.slug ?? ""),
          quantity: 1,
          unitPrice: companionPrice,
          role: licenseRoleFromSlug(offer.companion.slug),
          origin: "bump",
        });
        isBulk = true;
        planName = `${planName} + ${offer.companion.name}`;
        companionMeta = {
          companion_plan_id: offer.companion.id,
          companion_final_price: companionPrice,
          companion_original_price: Number(offer.companion.originalPrice ?? 0),
          discount_percent: offer.discountPercent,
          plan_ids: [input.companion.mainPlanId, offer.companion.id],
        };
      }
    }
  }


  const amountCents = Math.round(finalPrice * 100);

  const identifier = newIdentifier("MSK");
  const { affiliateForUser, registerPendingCommission } = await import("./affiliate.server");
  const affiliate = await findAffiliateByCode(input.affiliateCode);
  const affiliateId = affiliate?.id ?? (await affiliateForUser(input.userId));

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      identifier,
      user_id: input.userId,
      plan_id: isBulk ? null : (input.planId ?? null),
      affiliate_id: affiliateId,
      reseller_id: null,
      purpose: "purchase",
      method: "PIX",
      amount: finalPrice,
      currency: "BRL",
      status: "PENDING",
      metadata: {
        plan: planSlug,
        bulk: isBulk,
        // Cada linha gera uma licença separada e rotulada na liquidação.
        line_items: lineItems,
        ...(companionMeta ?? {}),
      } as never,

    })
    .select("id")
    .single();
  if (error) throw error;

  try {
    // Split desativado para afiliados (carteira interna)
    const splits = await buildSplits({
      amountCents,
      affiliateId: null,
      resellerId: null,
    });
    await supabaseAdmin.from("transactions").update({ splits: splits as never }).eq("id", tx.id);
    if (affiliateId) {
      await registerPendingCommission({
        affiliateId,
        transactionId: tx.id,
        planId: isBulk ? null : input.planId!,
        amount: finalPrice,
      });
    }
    const { createPixWithFailover } = await import("./payments/gateway.server");
    const { provider, result, pixCode } = await createPixWithFailover({
      identifier,
      amountCents,
      customer: {
        name: input.name || input.email,
        email: input.email,
        phone: input.phone,
        document: { number: input.document, type: input.document.length === 14 ? "CNPJ" : "CPF" },
      },
      items,
      splits,
      metadata: { transactionId: tx.id },
    });

    const qr = result.pix?.base64 ?? result.pix?.image ?? null;
    const providerId = result.transactionId ?? result.id ?? null;

    await supabaseAdmin
      .from("transactions")
      .update({
        provider,
        provider_transaction_id: providerId,
        pix_code: pixCode,
        pix_qrcode: qr,
        expires_at: pixExpiryFromNow(),
        checkout_url: result.order?.url ?? null,
        raw: result as any,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", tx.id);


    if (isBulk) {
      const { clearCart } = await import("./cart.server");
      await clearCart(input.userId);
    }

    await logAudit({
      userId: input.userId,
      action: "checkout.pix_created",
      resource: "transactions",
      resourceId: tx.id,
      metadata: { amount: finalPrice, plan: planSlug, bulk: isBulk },
    });

    // Notificações de "venda gerada" (comprador + administradores) — nunca quebram o checkout.
    try {
      const { sendProfessionalNotification, notifyAdmins } = await import(
        "./notification-service.server"
      );

      const { data: planData } = await supabaseAdmin.from("plans").select("name").eq("id", input.planId || "").single();
      const planName = planData?.name || "Premium";

      const gross = Number(finalPrice).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      await sendProfessionalNotification({
        userId: input.userId,
        type: "pix_created",
        title: "PIX gerado",
        body: `🧾 PIX gerado: ${gross}\n📦 Plano: ${planName}\n⏱️ Pague em até 2 minutos para liberar sua licença`,
        link: "/painel",
        recipientRole: "user",
        transactionId: tx.id,
      }).catch(() => {});
      await notifyAdmins({
        type: "pix_created",
        title: "Nova venda gerada",
        body: `🧾 Nova venda gerada\n💵 Valor bruto: ${gross}`,
        link: "/admin",
        transactionId: tx.id,
        metadata: { transactionId: tx.id, amount: Number(finalPrice) },
      }).catch(() => {});

      // Afiliado dono do link: mensagem própria (nunca a do comprador).
      if (affiliateId) {
        const { data: aff } = await supabaseAdmin
          .from("affiliates")
          .select("user_id,commission_rate")
          .eq("id", affiliateId)
          .maybeSingle();
        if (aff?.user_id && aff.user_id !== input.userId) {
          const estimated = Number(finalPrice) * (Number(aff.commission_rate || 30) / 100);
          await sendProfessionalNotification({
            userId: aff.user_id,
            type: "pix_created",
            title: "Venda gerada pelo seu link",
            body: `🧾 Venda gerada: ${gross}\n⏳ Aguardando o pagamento do cliente\n💚 Comissão prevista: ${estimated.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
            link: "/parceiro",
            recipientRole: "affiliate",
            transactionId: tx.id,
            metadata: { transactionId: tx.id, amount: Number(finalPrice) },
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("[checkout] notificação pix_created falhou:", e);
    }


    return {
      transactionId: tx.id,
      identifier,
      amount: finalPrice,
      pixCode,
      qrCode: qr,
      checkoutUrl: result.order?.url ?? null,
    };
  } catch (e) {
    await supabaseAdmin
      .from("transactions")
      .update({ status: "FAILED", metadata: { error: (e as Error).message } as never })
      .eq("id", tx.id);
    throw e;
  }
}

export async function createDepositCheckout(input: {
  userId: string;
  email: string;
  name: string;
  amount: number;
}) {
  const { data: reseller } = await supabaseAdmin
    .from("resellers")
    .select("id")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!reseller) throw new Error("Conta de revendedor não encontrada");

  const identifier = newIdentifier("DEP");
  const amountCents = Math.round(input.amount * 100);

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      identifier,
      user_id: input.userId,
      reseller_id: reseller.id,
      purpose: "deposit",
      method: "PIX",
      amount: input.amount,
      status: "PENDING",
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabaseAdmin
    .from("reseller_deposits")
    .insert({ reseller_id: reseller.id, transaction_id: tx.id, amount: input.amount });

  const { createPixWithFailover } = await import("./payments/gateway.server");
  const { provider, result, pixCode } = await createPixWithFailover({
    identifier,
    amountCents,
    customer: { name: input.name || input.email, email: input.email },
    items: [{ title: "Depósito de saldo", unitPrice: amountCents, quantity: 1, tangible: false }],
    metadata: { transactionId: tx.id, purpose: "deposit" },
  });

    await supabaseAdmin
      .from("transactions")
      .update({
        provider,
        provider_transaction_id: result.transactionId ?? result.id ?? null,
        pix_code: pixCode,
        pix_qrcode: result.pix?.base64 ?? result.pix?.image ?? null,
        expires_at: pixExpiryFromNow(),
        raw: result as any,
      } as any)
      .eq("id", tx.id);


  return {
    transactionId: tx.id,
    pixCode: result.pix?.code ?? null,
    qrCode: result.pix?.base64 ?? result.pix?.image ?? null,
    amount: input.amount,
  };
}

export async function getTransactionStatus(userId: string, transactionId: string) {
  const { getOrder } = await import("./orders.server");
  return getOrder(userId, transactionId);
}

export async function requestWithdrawal(input: {
  userId: string;
  amount: number;
  pixKey: string;
  pixKeyType: string;
  origin: "affiliate" | "reseller";
}) {
  const table = input.origin === "affiliate" ? "affiliates" : "resellers";
  const { data: account } = await supabaseAdmin
    .from(table)
    .select("id,available_balance")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!account) throw new Error("Conta financeira não encontrada");
  if (Number(account.available_balance) < input.amount) throw new Error("Saldo insuficiente");

  const identifier = newIdentifier("WD");
  const { data: wd, error } = await supabaseAdmin
    .from("withdrawals")
    .insert({
      identifier,
      user_id: input.userId,
      amount: input.amount,
      pix_key: input.pixKey,
      pix_key_type: input.pixKeyType,
      ...(input.origin === "affiliate" ? { affiliate_id: account.id } : { reseller_id: account.id }),
    })
    .select("id")
    .single();
  if (error) throw error;

  // Reserva o valor imediatamente para evitar saque duplicado.
  await supabaseAdmin
    .from(table)
    .update({ available_balance: Number(account.available_balance) - input.amount })
    .eq("id", account.id);

  await logAudit({
    userId: input.userId,
    action: "withdrawal.requested",
    resource: "withdrawals",
    resourceId: wd.id,
    metadata: { amount: input.amount, origin: input.origin },
  });
  return { withdrawalId: wd.id, status: "PENDING" };
}