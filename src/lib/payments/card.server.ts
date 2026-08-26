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

function objectMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function realCardRequestStarted(metadata: unknown) {
  const meta = objectMeta(metadata);
  return Boolean(meta["charge_request_started_at"]);
}

function isDefinitiveProviderRejection(message: string) {
  return /^ATOMOPAY_HTTP_4\d\d:/i.test(message);
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
    .select("id,user_id,amount,status,method,purpose,provider_transaction_id,metadata")
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
  const status = String(tx.status ?? "").toUpperCase();
  const method = String(tx.method ?? "PENDING").toUpperCase();
  const requestStarted = realCardRequestStarted(tx.metadata);
  const awaitingConfirmation =
    method === "CREDIT_CARD" &&
    (status === "AUTHORIZED" ||
      Boolean(tx.provider_transaction_id) ||
      (status === "PROCESSING" && requestStarted));
  const terminal = ["PAID", "CANCELED", "REFUNDED", "CHARGED_BACK", "EXPIRED"].includes(status);
  const enabled = configured && settings.cardEnabled && !awaitingConfirmation && !terminal;
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
    awaitingConfirmation,
    reason: enabled
      ? null
      : awaitingConfirmation
        ? "Pagamento já enviado e aguardando confirmação do gateway."
        : terminal
          ? "Este pedido não aceita uma nova cobrança."
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

  let currentStatus = String(tx.status ?? "").toUpperCase();
  let currentMethod = String(tx.method ?? "PENDING").toUpperCase();
  const initialMeta = objectMeta(tx.metadata);
  const requestPreviouslyStarted = realCardRequestStarted(initialMeta);

  if (currentStatus === "PAID") {
    return {
      status: "PAID",
      providerStatus: "paid",
      message: atomoStatusMessage("paid"),
      transactionId: tx.id,
    };
  }

  if (["CANCELED", "REFUNDED", "CHARGED_BACK", "EXPIRED"].includes(currentStatus)) {
    throw new Error("PAYMENT_TERMINAL");
  }

  // Só bloquear reenvio quando houver evidência de que o POST de cobrança
  // realmente começou. PROCESSING sem external id e sem esta marca é estado
  // legado/stale e deve ser recuperado, nunca virar loop infinito.
  if (
    currentMethod === "CREDIT_CARD" &&
    (currentStatus === "AUTHORIZED" ||
      Boolean(tx.provider_transaction_id) ||
      (currentStatus === "PROCESSING" && requestPreviouslyStarted))
  ) {
    return {
      status: currentStatus === "AUTHORIZED" ? "AUTHORIZED" : "PROCESSING",
      providerStatus: String(initialMeta["provider_status"] ?? "processing"),
      message: atomoStatusMessage("processing"),
      transactionId: tx.id,
    };
  }

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

  // Recupera pedidos presos pela implementação antiga, que marcava PROCESSING
  // antes de chegar ao POST /transactions.
  if (
    currentMethod === "CREDIT_CARD" &&
    currentStatus === "PROCESSING" &&
    !tx.provider_transaction_id &&
    !requestPreviouslyStarted
  ) {
    const { data: recovered } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "PENDING",
        method: "PENDING",
        metadata: {
          ...initialMeta,
          reconciliation_required: false,
          reconciliation_reason: "STALE_CARD_PROCESSING_RECOVERED",
        } as never,
      } as never)
      .eq("id", tx.id)
      .eq("status", "PROCESSING")
      .eq("method", "CREDIT_CARD")
      .is("provider_transaction_id", null)
      .select("id")
      .maybeSingle();

    if (!recovered) {
      return {
        status: "PROCESSING",
        providerStatus: "processing",
        message: atomoStatusMessage("processing"),
        transactionId: tx.id,
      };
    }
    currentStatus = "PENDING";
    currentMethod = "PENDING";
  }

  const { data: locked } = await supabaseAdmin
    .from("transactions")
    .update({ status: "PROCESSING", method: "CREDIT_CARD", provider: "atomopay" } as never)
    .eq("id", tx.id)
    .in("status", ["PENDING", "FAILED"])
    .in("method", ["PENDING", "CREDIT_CARD", "CARD"])
    .select("id")
    .maybeSingle();
  if (!locked) {
    return {
      status: "PROCESSING",
      providerStatus: "processing",
      message: atomoStatusMessage("processing"),
      transactionId: tx.id,
    };
  }

  let gatewayRequestStarted = false;
  let gatewayResultReceived = false;
  let gatewayExternalId: string | null = null;
  let gatewayProviderStatus: string | null = null;
  let gatewayInternalStatus: string | null = null;

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name,email,phone,document")
      .eq("id", input.userId)
      .maybeSingle();

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
      onTransactionRequestStart: async () => {
        gatewayRequestStarted = true;
        const startedAt = new Date().toISOString();
        await supabaseAdmin
          .from("transactions")
          .update({
            provider: "atomopay",
            metadata: {
              ...initialMeta,
              card_base_amount: amounts.baseAmount,
              card_fee_amount: amounts.feeAmount,
              card_charged_total: amounts.totalAmount,
              charge_request_started_at: startedAt,
              reconciliation_required: false,
              reconciliation_reason: null,
            } as never,
          } as never)
          .eq("id", tx.id)
          .eq("status", "PROCESSING")
          .eq("method", "CREDIT_CARD");
      },
    });

    gatewayResultReceived = true;
    gatewayExternalId = result.transactionHash || null;
    gatewayProviderStatus = result.providerStatus;
    const internal = mapAtomoStatus(result.providerStatus);
    gatewayInternalStatus = internal === "UNKNOWN" ? "PROCESSING" : internal;

    await supabaseAdmin
      .from("transactions")
      .update({
        provider: "atomopay",
        provider_transaction_id: result.transactionHash || tx.provider_transaction_id,
        status: internal === "UNKNOWN" ? "PROCESSING" : internal,
        metadata: {
          ...initialMeta,
          card_base_amount: amounts.baseAmount,
          card_fee_amount: amounts.feeAmount,
          card_charged_total: amounts.totalAmount,
          charge_request_started_at: new Date().toISOString(),
          card: {
            brand: cardBrand(input.card.number),
            last4: result.cardLast4,
            installments: result.installments,
          },
          provider_status: result.providerStatus,
          reconciliation_required: false,
          reconciliation_reason: null,
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
    const safe = String((e as Error).message ?? "").replace(/\d{12,19}/g, (m) => maskPan(m));
    const definitiveRejection = gatewayRequestStarted && isDefinitiveProviderRejection(safe);

    if (!gatewayRequestStarted) {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "PENDING",
          method: "PENDING",
          provider: null,
          metadata: {
            ...initialMeta,
            reconciliation_required: false,
            reconciliation_reason: "CARD_PRE_REQUEST_FAILED",
          } as never,
        } as never)
        .eq("id", tx.id)
        .eq("status", "PROCESSING")
        .eq("method", "CREDIT_CARD");
    } else if (definitiveRejection) {
      // Resposta 4xx significa que a Átomo recebeu e rejeitou a solicitação;
      // não existe motivo para prender o usuário em confirmação infinita.
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "FAILED",
          method: "CREDIT_CARD",
          provider: "atomopay",
          metadata: {
            ...initialMeta,
            provider_status: "refused",
            charge_request_started_at: null,
            reconciliation_required: false,
            reconciliation_reason: "GATEWAY_REJECTED_REQUEST",
          } as never,
        } as never)
        .eq("id", tx.id);
    } else {
      const reconciliationStatus =
        gatewayResultReceived && gatewayInternalStatus
          ? gatewayInternalStatus
          : "PROCESSING";
      await supabaseAdmin
        .from("transactions")
        .update({
          status: reconciliationStatus,
          method: "CREDIT_CARD",
          provider: "atomopay",
          ...(gatewayExternalId ? { provider_transaction_id: gatewayExternalId } : {}),
          metadata: {
            ...initialMeta,
            provider_status: gatewayProviderStatus ?? initialMeta["provider_status"] ?? "unknown",
            charge_request_started_at: new Date().toISOString(),
            reconciliation_required: true,
            reconciliation_reason: gatewayResultReceived
              ? "LOCAL_FINALIZATION_FAILED"
              : "GATEWAY_RESPONSE_UNCERTAIN",
          } as never,
        } as never)
        .eq("id", tx.id);
    }

    console.error("[card] falha ao processar cartão:", safe.slice(0, 300));
    throw new Error(
      gatewayRequestStarted && !definitiveRejection
        ? "Pagamento enviado para confirmação. Não tente novamente agora; aguarde a atualização automática."
        : safe.startsWith("PAGAMENTO_CARTAO_INDISPONIVEL")
          ? safe
          : "Não foi possível processar o cartão. Confira os dados ou tente outro meio de pagamento.",
    );
  }
}