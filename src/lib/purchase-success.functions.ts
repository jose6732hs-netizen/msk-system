import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Dados da tela pós-pagamento. Suporta uma ou várias licenças do mesmo pedido
 * sem usar maybeSingle em licenses, que falharia em compras em lote/order bump.
 */
export const getPurchaseSuccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const { data: licenses, error } = await supabaseAdmin
      .from("licenses")
      .select(`
        *,
        plans:plan_id (
          id,
          name,
          slug,
          features,
          is_lifetime
        )
      `)
      .eq("transaction_id", tx.id)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!licenses?.length) {
      throw new Error("Licença ainda não gerada. Tente novamente em alguns segundos.");
    }

    const metadata = asMeta(tx.metadata);
    const chargedTotal = Number(metadata["card_charged_total"] ?? 0);
    const baseAmount = Number(tx.amount ?? 0);
    const amountPaid = chargedTotal > 0 ? chargedTotal : baseAmount;

    return {
      transactionId: tx.id,
      method: String(tx.method ?? ""),
      baseAmount,
      amountPaid,
      cardFeeAmount: Number(metadata["card_fee_amount"] ?? 0),
      licenses,
    };
  });