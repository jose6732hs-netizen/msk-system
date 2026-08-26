/**
 * Pagamento com CARTÃO DE CRÉDITO (AtomoPay) — somente servidor.
 *
 * Regras não negociáveis:
 *  - o valor cobrado vem SEMPRE da transação já gravada no banco (nunca do
 *    navegador);
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

/** Opções exibidas no checkout (parcelas reais e disponibilidade do cartão). */
export async function getCardOptions(amount: number) {
  const { getAtomoSettings } = await import("./atomo-pay.server");
  const { loadCredentialsFor } = await import("./credentials.server");
  const settings = await getAtomoSettings();
  const creds = await loadCredentialsFor("atomopay").catch(() => null);
  const configured = !!creds;
  const enabled = configured && settings.cardEnabled;

  const installments = enabled
    ? Array.from({ length: settings.maxInstallments }, (_, i) => {
        const n = i + 1;
        return { installments: n, amount: Math.round((amount / n) * 100) / 100, interest: false };
      })
    : [];

  return {
    enabled,
    configured,
    sandbox: settings.sandbox,
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
    .select("id,identifier,user_id,amount,status,method,metadata,provider_transaction_id,pix_code")
    .eq("id", input.transactionId)
    .maybeSingle();

  if (!tx) throw new Error("Pedido não encontrado.");
  if (tx.user_id !== input.userId) throw new Error("Pedido não encontrado.");

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
  // O filtro de method garante que, se o PIX assumir a transação entre a leitura
  // e este update, o cartão não consegue prosseguir.
  // Uma tentativa recusada pode ser refeita com outro cartão; estados
  // PROCESSING/AUTHORIZED/PAID continuam bloqueados contra duplicidade.
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

    const amountCents = Math.round(Number(tx.amount) * 100);
    const installments = Math.min(
      settings.maxInstallments,
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
      amount: Number(tx.amount),
      metadata: {
        provider: "atomopay",
        provider_status: result.providerStatus,
        installments: result.installments,
        card_last4: result.cardLast4,
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
