import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAccount } = await import("./account.server");
    return loadAccount(context.supabase as never, context.userId);
  });

export const getMyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ licenseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { revealToken } = await import("./account.server");
    const { logEvent } = await import("./license.server");
    const token = await revealToken(context.supabase as never, context.userId, data.licenseId);
    if (!token) throw new Error("Licença não encontrada");
    await logEvent({
      license_id: data.licenseId,
      user_id: context.userId,
      event_type: "token_revealed",
    });
    return { token };
  });

export const removeMyDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ deviceId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logEvent } = await import("./license.server");

    const { data: device } = await supabaseAdmin
      .from("license_devices")
      .select("id,license_id,licenses!inner(user_id)")
      .eq("id", data.deviceId)
      .maybeSingle();
    const owner = (device as { licenses?: { user_id: string } } | null)?.licenses?.user_id;
    if (!device || owner !== context.userId) throw new Error("Dispositivo não encontrado");

    await supabaseAdmin
      .from("license_devices")
      .update({ status: "removed" })
      .eq("id", data.deviceId);
    await logEvent({
      license_id: device.license_id,
      user_id: context.userId,
      event_type: "device_removed",
      metadata: { source: "painel" },
    });
    return { ok: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ name: data.name })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id,user_id,provider,provider_subscription_id")
      .eq("id", data.subscriptionId)
      .maybeSingle();
    if (!sub || sub.user_id !== context.userId) throw new Error("Assinatura não encontrada");

    // Cancela no gateway quando configurado; o acesso continua até expires_at.
    if (sub.provider_subscription_id) {
      try {
        const { getPaymentProvider } = await import("./payments/provider.server");
        await getPaymentProvider().cancelSubscription(sub.provider_subscription_id);
      } catch (e) {
        console.warn("[cancel] gateway:", (e as Error).message);
      }
    }

    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    return { ok: true };
  });

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPaymentProvider } = await import("./payments/provider.server");

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("id", data.planId)
      .eq("active", true)
      .maybeSingle();
    if (!plan) throw new Error("Plano indisponível");

    const email = (context.claims["email"] as string) ?? "";
    try {
      const result = await getPaymentProvider().createCheckout({
        planId: plan.id,
        planSlug: plan.slug,
        priceCents: Math.round(Number(plan.price) * 100),
        currency: plan.currency,
        userId: context.userId,
        email,
        returnUrl: process.env["PAYMENT_RETURN_URL"] ?? "/painel",
      });
      return { checkoutUrl: result.checkoutUrl };
    } catch (e) {
      throw new Error(
        "Gateway de pagamento ainda não configurado. Informe o gateway para ativar o checkout real.",
      );
    }
  });
export const getBillingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("name,email,document,phone")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      name: (data as any)?.name ?? "",
      email: (data as any)?.email ?? "",
      document: (data as any)?.document ?? "",
      phone: (data as any)?.phone ?? "",
    };
  });

/** Salva CPF/CNPJ e telefone validados no servidor para reuso nas próximas compras. */
export const saveBillingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const parsed = z
      .object({
        name: z.string().max(120).optional(),
        document: z.string().min(11).max(20),
        phone: z.string().min(10).max(20),
      })
      .parse(d);
    return parsed;
  })
  .handler(async ({ context, data }) => {
    const { onlyDigits, isValidDocument, isValidPhoneBR } = await import("./br");
    const document = onlyDigits(data.document);
    const phone = onlyDigits(data.phone);
    if (!isValidDocument(document)) throw new Error("CPF/CNPJ inválido.");
    if (!isValidPhoneBR(phone)) throw new Error("Telefone inválido. Use DDD + número.");
    const patch: Record<string, unknown> = { document, phone };
    if (data.name?.trim()) patch["name"] = data.name.trim();
    const { error } = await context.supabase.from("profiles").update(patch as never).eq("id", context.userId);
    if (error) throw error;
    return { ok: true, document, phone };
  });
