import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Dados reais e imutáveis da compra aprovada. */
export const getPurchaseSuccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveLicenseSnapshot } = await import("./license-entitlements.server");

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id,status,user_id,amount,method,metadata")
      .eq("id", data.transactionId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!tx) throw new Error("Transação não encontrada.");
    if (String(tx.status ?? "").toUpperCase() !== "PAID") {
      throw new Error("Pagamento ainda não confirmado.");
    }

    const { data: licenseRows, error } = await supabaseAdmin
      .from("licenses")
      .select(`
        *,
        plans:plan_id (
          id,
          name,
          slug,
          price,
          currency,
          duration_label,
          duration_days,
          duration_value,
          duration_unit,
          max_devices,
          features,
          is_lifetime
        )
      `)
      .eq("transaction_id", tx.id)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!licenseRows?.length) {
      throw new Error("Licença ainda não gerada. Tente novamente em alguns segundos.");
    }

    const licenses = (licenseRows as any[]).map((license) => {
      const resolved = resolveLicenseSnapshot(license);
      return {
        ...license,
        resolved_plan: resolved,
        // Compatibilidade com a tela atual: plans passa a representar o snapshot
        // histórico comprado, e não a oferta que pode ter sido editada depois.
        plans: {
          ...(license.plans ?? {}),
          id: resolved.id,
          name: resolved.name,
          slug: resolved.slug,
          price: resolved.price,
          currency: resolved.currency,
          duration_label: resolved.durationLabel,
          is_lifetime: resolved.isLifetime,
          max_devices: resolved.maxDevices,
          features: resolved.features,
        },
      };
    });

    const metadata = asMeta(tx.metadata);
    const chargedTotal = numberOrNull(metadata["card_charged_total"]);
    const baseAmount = Number(tx.amount ?? 0);
    const amountPaid = chargedTotal !== null && chargedTotal > 0 ? chargedTotal : baseAmount;

    return {
      transactionId: tx.id,
      method: String(tx.method ?? ""),
      baseAmount,
      amountPaid,
      cardFeeAmount: numberOrNull(metadata["card_fee_amount"]) ?? 0,
      licenses,
    };
  });
