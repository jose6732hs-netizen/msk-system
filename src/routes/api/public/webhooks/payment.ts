import { createFileRoute } from "@tanstack/react-router";
import { getPaymentProvider, type NormalizedEvent } from "@/lib/payments/provider.server";
import { issueOrRenewLicense, logEvent } from "@/lib/license.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/public/webhooks/payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const provider = getPaymentProvider();
        const rawBody = await request.text();

        // 1. Autenticidade — nunca confiar no corpo sem verificar a assinatura.
        let valid = false;
        try {
          valid = await provider.verifyWebhook(request, rawBody);
        } catch (e) {
          console.error("[webhook] verificação falhou:", (e as Error).message);
          return json({ error: "WEBHOOK_SECRET_NOT_CONFIGURED" }, 500);
        }
        if (!valid) return json({ error: "INVALID_SIGNATURE" }, 401);

        let event: NormalizedEvent;
        try {
          event = provider.parseWebhook(rawBody);
        } catch {
          return json({ error: "INVALID_PAYLOAD" }, 400);
        }

        // 2. Idempotência
        const payloadHash = await sha256(rawBody);
        const { data: existing } = await supabaseAdmin
          .from("webhook_events")
          .select("id,processed")
          .eq("provider", provider.id)
          .eq("event_id", event.eventId)
          .maybeSingle();
        if (existing?.processed) return json({ received: true, duplicate: true });

        const eventRowId =
          existing?.id ??
          (
            await supabaseAdmin
              .from("webhook_events")
              .insert({
                provider: provider.id,
                event_id: event.eventId,
                event_type: event.type,
                payload_hash: payloadHash,
              })
              .select("id")
              .single()
          ).data?.id;

        await logEvent({
          event_type: "webhook_received",
          metadata: { type: event.type, provider: provider.id },
        });

        try {
          await processEvent(event, provider.id);
          await supabaseAdmin
            .from("webhook_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("id", eventRowId!);
          return json({ received: true });
        } catch (e) {
          const message = (e as Error).message;
          console.error("[webhook] erro ao processar:", message);
          await supabaseAdmin
            .from("webhook_events")
            .update({ error: message })
            .eq("id", eventRowId!);
          return json({ error: "PROCESSING_ERROR" }, 500);
        }
      },
    },
  },
});

async function processEvent(event: NormalizedEvent, providerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Localizar usuário (por id ou e-mail já cadastrado).
  let userId = event.userId ?? null;
  if (!userId && event.email) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", event.email.toLowerCase())
      .maybeSingle();
    userId = data?.id ?? null;
  }

  // Localizar plano
  let planId = event.planId ?? null;
  if (!planId && event.planSlug) {
    const { data } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("slug", event.planSlug)
      .maybeSingle();
    planId = data?.id ?? null;
  }

  const subKey = event.providerSubscriptionId ?? event.providerPaymentId ?? event.eventId;

  switch (event.type) {
    case "payment.created":
    case "payment.pending":
    case "payment.failed": {
      await supabaseAdmin.from("payments").upsert(
        {
          user_id: userId,
          plan_id: planId,
          provider: providerId,
          provider_payment_id: event.providerPaymentId ?? event.eventId,
          amount: event.amount ?? 0,
          currency: event.currency ?? "BRL",
          status: event.type.replace("payment.", ""),
          raw: event.raw as never,
        },
        { onConflict: "provider,provider_payment_id" },
      );
      return;
    }

    case "payment.paid":
    case "subscription.created":
    case "subscription.renewed": {
      if (!userId) throw new Error("Usuário não encontrado para o webhook");
      if (!planId) throw new Error("Plano não encontrado para o webhook");

      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("*")
        .eq("id", planId)
        .single();

      const now = new Date();
      const periodEnd =
        plan && !plan.is_lifetime && plan.duration_days
          ? new Date(now.getTime() + plan.duration_days * 86400000).toISOString()
          : null;

      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            plan_id: planId,
            status: "active",
            provider: providerId,
            provider_subscription_id: subKey,
            provider_customer_id: event.providerCustomerId ?? null,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd,
            cancel_at_period_end: false,
            cancelled_at: null,
          },
          { onConflict: "provider,provider_subscription_id" },
        )
        .select("id")
        .single();
      if (!sub) throw new Error("Falha ao criar assinatura");

      await supabaseAdmin.from("payments").upsert(
        {
          user_id: userId,
          plan_id: planId,
          subscription_id: sub.id,
          provider: providerId,
          provider_payment_id: event.providerPaymentId ?? event.eventId,
          amount: event.amount ?? plan?.price ?? 0,
          currency: event.currency ?? plan?.currency ?? "BRL",
          status: "paid",
          raw: event.raw as never,
        },
        { onConflict: "provider,provider_payment_id" },
      );

      const result = await issueOrRenewLicense({
        userId,
        planId,
        subscriptionId: sub.id,
      });
      await logEvent({
        license_id: result.licenseId,
        user_id: userId,
        event_type: "payment_confirmed",
        metadata: { created: result.created },
      });
      return;
    }

    case "subscription.cancelled": {
      // Cancelamento NÃO revoga: a licença segue válida até expires_at.
      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancel_at_period_end: true,
          cancelled_at: new Date().toISOString(),
        })
        .eq("provider", providerId)
        .eq("provider_subscription_id", subKey);
      return;
    }

    case "subscription.expired": {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("provider", providerId)
        .eq("provider_subscription_id", subKey)
        .select("id")
        .maybeSingle();
      if (sub) {
        await supabaseAdmin
          .from("licenses")
          .update({ status: "expired" })
          .eq("subscription_id", sub.id);
      }
      return;
    }

    default:
      return;
  }
}