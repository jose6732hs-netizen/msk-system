/**
 * Server functions do cartão de crédito (AtomoPay).
 * O cartão trafega apenas cliente -> nosso backend (HTTPS) -> AtomoPay.
 * Nada de PAN/CVV é persistido, logado ou devolvido.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cardSchema = z.object({
  transactionId: z.string().uuid(),
  installments: z.number().int().min(1).max(12),
  card: z.object({
    number: z.string().min(12).max(25),
    holderName: z.string().min(2).max(60),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(2024).max(2099),
    cvv: z.string().min(3).max(4),
  }),
});

export const getCardCheckoutOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ amount: z.number().min(0) }).parse(d))
  .handler(async ({ data }) => {
    const { getCardOptions } = await import("./card.server");
    return getCardOptions(data.amount);
  });

export const payWithCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cardSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { payTransactionWithCard } = await import("./card.server");
    return payTransactionWithCard({
      userId: context.userId,
      transactionId: data.transactionId,
      installments: data.installments,
      card: data.card,
    });
  });
