/**
 * Handler compartilhado de webhooks (Amplo Pay, SigiloPay e AtomoPay).
 * Autenticidade aceita duas formas usadas pelos gateways:
 *  - assinatura HMAC-SHA256 do corpo bruto em header;
 *  - token compartilhado (header OU campo `token` do payload, padrão SigiloPay).
 */
import type { ProviderId } from "./credentials.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type GatewayWebhook = {
  event?: string;
  type?: string;
  status?: string;
  token?: string;
  transactionId?: string;
  identifier?: string;
  transaction?: { id?: string; identifier?: string; status?: string; amount?: number };
  client?: { email?: string; name?: string };
  [k: string]: unknown;
};

const PAID_EVENTS = [
  "TRANSACTION_PAID",
  "PAGO",
  "PAID",
  "APPROVED",
  "COMPLETED",
  "OK",
  "SUBSCRIPTION_RENEWED",
];
const FAIL_EVENTS = [
  "TRANSACTION_CANCELED",
  "TRANSACTION_CANCELLED",
  "CANCELED",
  "CANCELLED",
  "REJECTED",
  "FAILED",
  // Vocabulário AtomoPay
  "REFUSED",
  "ANTIFRAUD",
];
const REFUND_EVENTS = ["TRANSACTION_REFUNDED", "REFUNDED"];
const CHARGEBACK_EVENTS = [
  "TRANSACTION_CHARGED_BACK",
  "CHARGEBACK",
  "CHARGED_BACK",
  "CHARGEDBACK",
];


export async function handleGatewayWebhook(provider: ProviderId, request: Request) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadCredentialsFor } = await import("./credentials.server");
    const { settlePaidTransaction } = await import("@/lib/commerce.server");
    const { logAudit } = await import("@/lib/audit.server");
    const { mapGatewayStatus, recordPaymentEvent, reverseTransaction } = await import(
      "@/lib/financial.server"
    );

    const rawBody = await request.text();
    const creds = await loadCredentialsFor(provider).catch(() => null);
    const secret = creds?.webhookSecret ?? null;

    let payload: GatewayWebhook;
    try {
      payload = JSON.parse(rawBody) as GatewayWebhook;
    } catch {
      return json({ error: "INVALID_PAYLOAD" }, 400);
    }

    const urlSecret = (() => {
      try {
        return (new URL(request.url).searchParams.get("secret") ?? "").trim();
      } catch {
        return "";
      }
    })();

    const headerToken = (
      request.headers.get("x-webhook-signature") ||
      request.headers.get("x-signature") ||
      request.headers.get(`x-${provider}-signature`) ||
      request.headers.get("x-webhook-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      ""
    )
      .replace(/^sha256=/, "")
      .trim();
    const bodyToken = String(payload.token ?? "").trim();
    const expected = secret ? await hmacHex(secret, rawBody) : "";

    const isMatch =
      !!secret &&
      (timingSafeEqual(headerToken.toLowerCase(), expected) ||
        timingSafeEqual(headerToken, secret) ||
        timingSafeEqual(bodyToken, secret) ||
        timingSafeEqual(urlSecret, secret));

    const providerTxId =
      (payload.transactionId ? String(payload.transactionId) : null) ??
      (payload.transaction?.id ? String(payload.transaction.id) : null) ??
      ((payload as Record<string, unknown>)["transaction_hash"]
        ? String((payload as Record<string, unknown>)["transaction_hash"])
        : null) ??
      ((payload as Record<string, unknown>)["hash"]
        ? String((payload as Record<string, unknown>)["hash"])
        : null);

    /**
     * A AtomoPay não publica assinatura de webhook. Em vez de confiar no corpo
     * recebido, consultamos a própria API (server-to-server) e usamos o status
     * oficial como fonte da verdade. Um POST forjado nunca marca como pago.
     */
    let verifiedStatus: string | null = null;
    if (!isMatch) {
      if (provider === "atomopay" && providerTxId) {
        try {
          const { AtomoPayService } = await import("./atomo-pay.server");
          const service = await AtomoPayService.create();
          const remote = (await service.getTransaction(providerTxId)) as Record<string, unknown>;
          verifiedStatus = String(remote?.["status"] ?? "") || null;
        } catch (e) {
          console.error("[atomopay] falha ao verificar transação:", (e as Error).message);
        }
      }
      if (!verifiedStatus) {
        await logAudit({
          action: "webhook.invalid_signature",
          resource: provider,
          result: "failure",
        });
        return json({ error: secret ? "INVALID_SIGNATURE" : "WEBHOOK_UNVERIFIED" }, 401);
      }
    }

    // Status bruto do provedor (grafia original preservada) + status do evento.
    const providerStatus = String(
      verifiedStatus ??
        payload.status ??
        payload.transaction?.status ??
        payload.event ??
        payload.type ??
        "unknown",
    );
    const eventType = String(
      verifiedStatus ??
        payload.event ??
        payload.type ??
        payload.transaction?.status ??
        payload.status ??
        "UNKNOWN",
    ).toUpperCase();
    const identifier =
      (payload.identifier ? String(payload.identifier) : null) ??
      (payload.transaction?.identifier ? String(payload.transaction.identifier) : null);
    const eventId = `${eventType}:${providerTxId ?? identifier ?? (await sha256(rawBody)).slice(0, 32)}`;


    // Idempotência
    const { data: existing } = await supabaseAdmin
      .from("webhook_events")
      .select("id,processed")
      .eq("provider", provider)
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing?.processed) return json({ received: true, duplicate: true });

    const eventRowId =
      existing?.id ??
      (
        await supabaseAdmin
          .from("webhook_events")
          .insert({
            provider,
            event_id: eventId,
            event_type: eventType,
            payload_hash: await sha256(rawBody),
            token_hash: await sha256(headerToken || bodyToken),
            payload: payload as never,
            received_at: new Date().toISOString(),
            processing_status: "PROCESSING",
            transaction_id: providerTxId,
          } as never)
          .select("id")
          .single()
      ).data?.id;

    try {
      let query = supabaseAdmin.from("transactions").select("id,status,amount,identifier,user_id");
      query = identifier
        ? query.eq("identifier", identifier)
        : query.eq("provider_transaction_id", providerTxId ?? "");
      let { data: tx } = await query.maybeSingle();
      if (!tx && providerTxId) {
        const { data: byProvider } = await supabaseAdmin
          .from("transactions")
          .select("id,status,amount,identifier,user_id")
          .eq("provider_transaction_id", providerTxId)
          .maybeSingle();
        tx = byProvider;
      }
      if (!tx) throw new Error(`Transação não localizada (${identifier ?? providerTxId})`);

      if (providerTxId) {
        await supabaseAdmin
          .from("transactions")
          .update({
            provider,
            provider_transaction_id: providerTxId,
            raw: payload as never,
          } as never)
          .eq("id", tx.id);
      }

      await recordPaymentEvent({
        transactionId: tx.id,
        webhookEventId: eventRowId ?? null,
        externalId: providerTxId,
        event: eventType,
        status: mapGatewayStatus(eventType),
        metadata: { identifier, provider },
      });

      if (PAID_EVENTS.includes(eventType)) {
        const { finalizePaidTransaction } = await import("@/lib/payments/settle.server");
        // Uma falha na liquidação legada não pode impedir a entrega das licenças.
        await settlePaidTransaction(tx.id).catch((e) =>
          console.error("[webhook] settlePaidTransaction:", (e as Error).message),
        );
        await finalizePaidTransaction(tx.id);
      } else if (FAIL_EVENTS.includes(eventType)) {
        await supabaseAdmin.from("transactions").update({ status: "FAILED" }).eq("id", tx.id);
      } else if (REFUND_EVENTS.includes(eventType)) {
        await reverseTransaction(tx.id, "refund");
      } else if (CHARGEBACK_EVENTS.includes(eventType)) {
        await reverseTransaction(tx.id, "chargeback");
      } else {
        await supabaseAdmin
          .from("transactions")
          .update({ status: mapGatewayStatus(eventType) })
          .eq("id", tx.id);
      }

      await supabaseAdmin
        .from("webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_status: "PROCESSED",
        } as never)
        .eq("id", eventRowId!);
      return json({ received: true });
    } catch (e) {
      const message = (e as Error).message;
      console.error(`[${provider}] erro ao processar webhook:`, message);
      await supabaseAdmin
        .from("webhook_events")
        .update({ error: message, processing_status: "FAILED" } as never)
        .eq("id", eventRowId!);
      return json({ error: "PROCESSING_ERROR", message }, 202);
    }
  } catch (e) {
    console.error(`[${provider}] erro inesperado no webhook:`, e);
    return json({ error: "WEBHOOK_ERROR", message: (e as Error).message }, 202);
  }
}
