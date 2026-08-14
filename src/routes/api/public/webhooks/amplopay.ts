import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
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

type AmploWebhook = {
  event?: string;
  type?: string;
  status?: string;
  transactionId?: string;
  identifier?: string;
  paymentMethod?: string;
  totalValue?: number;
  amount?: number;
  client?: { email?: string; name?: string };
  [k: string]: unknown;
};

export const Route = createFileRoute("/api/public/webhooks/amplopay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { loadCredentials } = await import("@/lib/payments/amplo-pay.server");
        const { settlePaidTransaction } = await import("@/lib/commerce.server");
        const { logAudit } = await import("@/lib/audit.server");
        const { mapGatewayStatus, recordPaymentEvent, reverseTransaction } = await import(
          "@/lib/financial.server"
        );

        const rawBody = await request.text();
        const creds = await loadCredentials().catch((err: unknown) => {
          console.error("[amplopay] falha ao carregar credenciais:", err);
          return null;
        });
        const secret = creds?.webhookSecret;

        // 1. Autenticidade: HMAC do corpo bruto OU token compartilhado no header.
        if (!secret) {
          console.error("[amplopay] webhook secret não configurado");
          return json({ error: "WEBHOOK_SECRET_NOT_CONFIGURED" }, 503);
        }
        const provided = (
          request.headers.get("x-webhook-signature") ||
          request.headers.get("x-signature") ||
          request.headers.get("x-amplopay-signature") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          ""
        )
          .replace(/^sha256=/, "")
          .trim();
        const expected = await hmacHex(secret, rawBody);
        const expectedLegacy = await hmacHex(secret, rawBody.replace(/[\n\r\t]/g, ""));
        
        const isMatch = timingSafeEqual(provided.toLowerCase(), expected) || 
                       timingSafeEqual(provided, secret) || 
                       timingSafeEqual(provided.toLowerCase(), expectedLegacy);

        if (!provided || !isMatch) {
          await logAudit({ action: "webhook.invalid_signature", resource: "amplopay", result: "failure" });
          return json({ error: "INVALID_SIGNATURE" }, 401);
        }


        let payload: AmploWebhook;
        try {
          payload = JSON.parse(rawBody) as AmploWebhook;
        } catch {
          return json({ error: "INVALID_PAYLOAD" }, 400);
        }

        const eventType = String(payload.event ?? payload.type ?? payload.status ?? "UNKNOWN").toUpperCase();
        const providerTxId = payload.transactionId ? String(payload.transactionId) : null;
        const identifier = payload.identifier ? String(payload.identifier) : null;
        const eventId = `${eventType}:${providerTxId ?? identifier ?? (await sha256(rawBody)).slice(0, 32)}`;

        // 2. Idempotência
        const { data: existing } = await supabaseAdmin
          .from("webhook_events")
          .select("id,processed")
          .eq("provider", "amplopay")
          .eq("event_id", eventId)
          .maybeSingle();
        if (existing?.processed) return json({ received: true, duplicate: true });

        const eventRowId =
          existing?.id ??
          (
            await supabaseAdmin
              .from("webhook_events")
              .insert({
                provider: "amplopay",
                event_id: eventId,
                event_type: eventType,
                payload_hash: await sha256(rawBody),
                token_hash: await sha256(provided),
                payload: payload as any,
                received_at: new Date().toISOString(),
                processing_status: "PROCESSING",
                transaction_id: providerTxId,
              } as any)
              .select("id")
              .single()
          ).data?.id;

        try {
          // 3. Localizar a transação registrada no checkout.
          let query = supabaseAdmin.from("transactions").select("id,status,amount,identifier");
          query = identifier
            ? query.eq("identifier", identifier)
            : query.eq("provider_transaction_id", providerTxId ?? "");
          const { data: tx } = await query.maybeSingle();
          if (!tx) throw new Error(`Transação não localizada (${identifier ?? providerTxId})`);

          if (providerTxId) {
            await supabaseAdmin
              .from("transactions")
              .update({ provider_transaction_id: providerTxId, raw: payload as any } as any)
              .eq("id", tx.id);
          }

          const paidEvents = ["TRANSACTION_PAID", "PAID", "APPROVED", "COMPLETED", "SUBSCRIPTION_RENEWED"];
          const failEvents = ["TRANSACTION_CANCELED", "TRANSACTION_CANCELLED", "CANCELED", "REJECTED", "FAILED"];
          const refundEvents = ["TRANSACTION_REFUNDED", "REFUNDED"];
          const chargebackEvents = ["TRANSACTION_CHARGED_BACK", "CHARGEBACK", "CHARGED_BACK"];

          await recordPaymentEvent({
            transactionId: tx.id,
            webhookEventId: eventRowId ?? null,
            externalId: providerTxId,
            event: eventType,
            status: mapGatewayStatus(eventType),
            metadata: { identifier },
          });

          if (paidEvents.includes(eventType)) {
            const { processInternalCommission } = await import("@/lib/parceiro/internal-affiliate.server");
            const { sendProfessionalNotification, notifyAdmins } = await import(
              "@/lib/notification-service.server"
            );

            await settlePaidTransaction(tx.id);
            await processInternalCommission(tx.id).catch(err => console.error("[webhook] Erro comissão:", err));

            const gross = Number(tx.amount).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });

            // Notificação de venda (valor bruto) para todos os administradores
            await notifyAdmins({
              type: "sale_approved",
              title: "Venda aprovada",
              body: `✅ Venda aprovada\n💵 Valor bruto: ${gross}`,
              link: "/admin",
              transactionId: tx.id,
              metadata: { transactionId: tx.id, amount: Number(tx.amount) },
            }).catch(e => console.error("Push Admin fail:", e));

            // Notificação de compra confirmada para o comprador
            const { data: paidTx } = await supabaseAdmin
              .from("transactions")
              .select("user_id")
              .eq("id", tx.id)
              .maybeSingle();
            if (paidTx?.user_id) {
              await sendProfessionalNotification({
                userId: paidTx.user_id,
                type: "pix_approved",
                title: "Pagamento confirmado",
                body: `✅ Pagamento aprovado\n💵 Valor: ${gross}\n🔑 Sua licença já está liberada`,
                link: "/painel",
                recipientRole: "user",
                transactionId: tx.id,
              }).catch(e => console.error("Push comprador fail:", e));
            }
          } else if (failEvents.includes(eventType)) {
            await supabaseAdmin.from("transactions").update({ status: "FAILED" }).eq("id", tx.id);
          } else if (refundEvents.includes(eventType)) {
            await reverseTransaction(tx.id, "refund");
          } else if (chargebackEvents.includes(eventType)) {
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
            } as any)
            .eq("id", eventRowId!);
          return json({ received: true });
        } catch (e) {
          const message = (e as Error).message;
          console.error("[amplopay] erro ao processar webhook:", message);
          await supabaseAdmin
            .from("webhook_events")
            .update({ error: message, processing_status: "FAILED" } as any)
            .eq("id", eventRowId!);
          return json({ error: "PROCESSING_ERROR", message }, 202);
        }
        } catch (e) {
          console.error("[amplopay] erro inesperado no webhook:", e);
          return json({ error: "WEBHOOK_ERROR", message: (e as Error).message }, 202);
        }
      },
    },
  },
});
