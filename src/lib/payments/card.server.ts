/**
 * Pagamento com CARTÃO DE CRÉDITO (AtomoPay) — somente servidor.
 *
 * Regras não negociáveis:
 *  - o valor-base vem SEMPRE da transação já gravada no banco;
 *  - o acréscimo do cartão é calculado no servidor e não altera o preço-base;
 *  - a transação pertence obrigatoriamente ao usuário autenticado;
 *  - PAN e CVV existem apenas em memória dentro desta função — nunca são
 *    gravados, logados ou devolvidos ao cliente;
 *  - a liberação do produto acontece apenas com status "paid" confirmado pela
 *    AtomoPay (resposta oficial da API ou webhook), nunca pelo frontend.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapAtomoStatus, atomoStatusMessage, cardBrand, maskPan } from "./atomo-status";

export type CardInput = {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
};

export type CardResult = {
  status: string;
  providerStatus: string;
  message: string;
  transactionId: string;
};

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Acréscimo comercial do cartão:
 * 5% do pedido + R$ 1,00, mínimo R$ 1,50 e máximo R$ 10,00.
 * O preço-base da licença permanece intacto em transactions.amount.
 */
export function calculateCardAmounts(baseAmount: number) {
  const base = roundMoney(Math.max(0, Number(baseAmount) || 0));
  const rawFee = roundMoney(base * 0.05 + 1);
  const feeAmount = roundMoney(Math.min(10, Math.max(1.5, rawFee)));
  const totalAmount = roundMoney(base + feeAmount);
  return { baseAmount: base, feeAmount, totalAmount };
}

/** Opções exibidas no checkout, sempre calculadas a partir da transação canônica. */
export async function getCardOptionsForTransaction(userId: string, transactionId: string) {
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id,user_id,amount,status,purpose")
    .eq("id", transactionId)
    .maybeSingle();

  if (!tx || tx.user_id !== userId || tx.purpose !== "purchase") {
    throw new Error("Pedido não encontrado.");
  }

  const { getAtomoSettings } = await import("./atomo-pay.server");
  const { loadCredentialsFor } = await import("./credentials.server");
  const settings = await getAtomoSettings();
  const creds = await loadCredentialsFor("atomopay").catch(() => null);
  const configured = !!creds;
  const enabled = configured && settings.cardEnabled;
  const amounts = calculateCardAmounts(Number(tx.amount));

  const installments = enabled
    ? Array.from({ length: settings.maxInstallments }, (_, i) => {
        const n = i + 1;
        return {
          installments: n,
          amount: roundMoney(amounts.totalAmount / n),
          interest: false,
        };
      })
    : [];

  return {
    enabled,
    configured,
    sandbox: settings.sandbox,
    ...amounts,
    installments,
    reason: enabled
      ? null
      : configured
        ? "Cartão de crédito desativado no painel Pagamentos > AtomoPay."
        : "Integração AtomoPay não configurada.",
  };
}

export async function payTransactionWithCard(input: {
  userId: string;
  transactionId: string;
  installments: number;
  card: CardInput;
}): Promise<CardResult> {
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id,identifier,user_id,amount,status,method,metadata,provider_transaction_id,pix_code,purpose")
    .eq("id", input.transactionId)
    .maybeSingle();

  if (!tx) throw new Error("Pedido não encontrado.");
  if (tx.user_id !== input.userId || tx.purpose !== "purchase") throw new Error("Pedido não encontrado.");

  const currentStatus = String(tx.status ?? "").toUpperCase();
  const currentMethod = String(tx.method ?? "PENDING").toUpperCase();

  if (currentStatus === "PAID") {
    return {
      status: "PAID",
      providerStatus: "paid",
      message: atomoStatusMessage("paid"),
      transactionId: tx.id,
    };
  }

  // Se já existe uma cobrança PIX real para este pedido, o cartão não pode
  // assumir a mesma transação. A trava é feita no servidor, não só na UI.
  if (
    currentMethod === "PIX" &&
    (Boolean(tx.provider_transaction_id) || Boolean(tx.pix_code))
  ) {
    throw new Error("PAYMENT_METHOD_LOCKED");
  }

  const { getAtomoSettings } = await import("./atomo-pay.server");
  const settings = await getAtomoSettings();
  if (!settings.cardEnabled) {
    throw new Error(
      "PAGAMENTO_CARTAO_INDISPONIVEL: habilite o cartão em Pagamentos > AtomoPay no painel administrativo.",
    );
  }

  // Trava atômica contra clique duplo / duas abas / corrida com geração de PIX.
  const { data: locked } = await supabaseAdmin
    .from("transactions")
    .update({ status: "PROCESSING", method: "CREDIT_CARD" } as never)
    .eq("id", tx.id)
    .in("status", ["PENDING", "FAILED"])
    .in("method", ["PENDING", "CREDIT_CARD", "CARD"])
    .select("id")
    .maybeSingle();
  if (!locked) {
    return {
      status: "PROCESSING",
      providerStatus: "prossessing",
      message: atomoStatusMessage("prossessing"),
      transactionId: tx.id,
    };
  }

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name,email,phone,document")
      .eq("id", input.userId)
      .maybeSingle();

    const { getAtomoSettings } = await import("./atomo-pay.server");
    const currentSettings = await getAtomoSettings();
    const { AtomoPayService } = await import("./atomo-pay.server");
    const { loadCredentialsFor } = await import("./credentials.server");
    const { absoluteUrl } = await import("../app-url.server");
    const service = await AtomoPayService.create();
    const creds = await loadCredentialsFor("atomopay");
    const base = await absoluteUrl("/api/public/webhooks/atomopay").catch(() => "");
    const callbackUrl =
      base && creds?.webhookSecret
        ? `${base}?secret=${encodeURIComponent(creds.webhookSecret)}`
        : base;

    const amounts = calculateCardAmounts(Number(tx.amount));
    const amountCents = Math.round(amounts.totalAmount * 100);
    const installments = Math.min(
      currentSettings.maxInstallments,
      Math.max(1, Math.round(input.installments)),
    );

    const result = await service.createCard({
      identifier: tx.identifier,
      amountCents,
      installments,
      customer: {
        name: profile?.name || profile?.email || "Cliente MSK",
        email: profile?.email || "cliente@msksystem.online",
        phone: profile?.phone ?? "",
        document: { number: profile?.document ?? "", type: "CPF" },
      },
      items: [
        {
          title: "MSK SISTEM",
          unitPrice: amountCents,
          quantity: 1,
          tangible: false,
        },
      ],
      card: input.card,
      ...(callbackUrl ? { callbackUrl } : {}),
      metadata: { transactionId: tx.id },
    });

    const internal = mapAtomoStatus(result.providerStatus);
    const meta = (tx.metadata ?? {}) as Record<string, unknown>;

    await supabaseAdmin
      .from("transactions")
      .update({
        provider: "atomopay",
        provider_transaction_id: result.transactionHash || tx.provider_transaction_id,
        status: internal === "UNKNOWN" ? "PROCESSING" : internal,
        metadata: {
          ...meta,
          card_base_amount: amounts.baseAmount,
          card_fee_amount: amounts.feeAmount,
          card_charged_total: amounts.totalAmount,
          card: {
            brand: cardBrand(input.card.number),
            last4: result.cardLast4,
            installments: result.installments,
          },
          provider_status: result.providerStatus,
        } as never,
      } as never)
      .eq("id", tx.id);

    const { recordPaymentEvent } = await import("@/lib/financial.server");
    await recordPaymentEvent({
      transactionId: tx.id,
      externalId: result.transactionHash,
      event: "CARD_SUBMITTED",
      status: internal,
      amount: amounts.baseAmount,
      metadata: {
        provider: "atomopay",
        provider_status: result.providerStatus,
        installments: result.installments,
        card_last4: result.cardLast4,
        card_base_amount: amounts.baseAmount,
        card_fee_amount: amounts.feeAmount,
        card_charged_total: amounts.totalAmount,
      },
    });

    if (internal === "PAID") {
      const { finalizePaidTransaction } = await import("./settle.server");
      const { settlePaidTransaction } = await import("@/lib/commerce.server");
      await settlePaidTransaction(tx.id).catch((e) =>
        console.error("[card] settlePaidTransaction:", (e as Error).message),
      );
      await finalizePaidTransaction(tx.id);
    }

    return {
      status: internal,
      providerStatus: result.providerStatus,
      message: atomoStatusMessage(result.providerStatus),
      transactionId: tx.id,
    };
  } catch (e) {
    await supabaseAdmin
      .from("transactions")
      .update({ status: "PENDING" } as never)
      .eq("id", tx.id)
      .eq("method", "CREDIT_CARD");
    const safe = String((e as Error).message ?? "").replace(/\d{12,19}/g, (m) => maskPan(m));
    console.error("[card] falha ao processar cartão:", safe.slice(0, 300));
    throw new Error(
      safe.startsWith("PAGAMENTO_CARTAO_INDISPONIVEL")
        ? safe
        : "Não foi possível processar o cartão. Confira os dados ou tente outro meio de pagamento.",
    );
  }
}