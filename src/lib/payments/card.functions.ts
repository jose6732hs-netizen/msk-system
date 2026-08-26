/**
 * Server functions do cartão de crédito.
 * O cartão trafega apenas cliente -> nosso backend (HTTPS) -> provedor.
 * Nada de PAN/CVV é persistido, logado ou devolvido.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CARD_CONFIRMATION_PENDING, CARD_PUBLIC_ERROR } from "./public-messages";

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

function safeCardLog(error: unknown) {
  return String(error instanceof Error ? error.message : error ?? "unknown_card_error")
    .replace(/\d{12,19}/g, "[card-redacted]")
    .replace(/cvv\s*[:=]\s*\d{3,4}/gi, "cvv=[redacted]")
    .slice(0, 300);
}

export const getCardCheckoutOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { getCardOptionsForTransaction } = await import("./card.server");
    return getCardOptionsForTransaction(context.userId, data.transactionId);
  });

export const payWithCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cardSchema.parse(d))
  .handler(async ({ context, data }) => {
    try {
      const { payTransactionWithCard } = await import("./card.server");
      return await payTransactionWithCard({
        userId: context.userId,
        transactionId: data.transactionId,
        installments: data.installments,
        card: data.card,
      });
    } catch (error) {
      const safeMessage = safeCardLog(error);
      console.error("[payment][card] falha:", safeMessage);
      throw new Error(
        safeMessage === CARD_CONFIRMATION_PENDING
          ? CARD_CONFIRMATION_PENDING
          : CARD_PUBLIC_ERROR,
      );
    }
  });