import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAYMENT_PUBLIC_ERROR, PIX_PUBLIC_ERROR } from "@/lib/payments/public-messages";

function paymentLog(scope: string, error: unknown) {
  const message = String(error instanceof Error ? error.message : error ?? "unknown_payment_error")
    .replace(/\d{12,19}/g, "[card-redacted]")
    .replace(/cvv\s*[:=]\s*\d{3,4}/gi, "cvv=[redacted]")
    .slice(0, 500);
  console.error(`[payment][${scope}]`, message);
}

export const preparePurchasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid().optional(),
        items: z
          .array(z.object({ planId: z.string().uuid(), quantity: z.number().int().min(1).max(20) }))
          .max(20)
          .optional(),
        companion: z
          .object({ mainPlanId: z.string().uuid(), companionPlanId: z.string().uuid() })
          .optional(),
        affiliateCode: z.string().max(24).optional(),
        resellerCode: z.string().max(24).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    try {
      const { preparePurchasePaymentOrder } = await import("./purchase-payment.server");
      return await preparePurchasePaymentOrder({
        userId: context.userId,
        planId: data.planId ?? null,
        items: data.items ?? null,
        companion: data.companion ?? null,
        affiliateCode: data.affiliateCode ?? null,
        resellerCode: data.resellerCode ?? null,
      });
    } catch (error) {
      paymentLog("prepare-purchase", error);
      throw new Error(PAYMENT_PUBLIC_ERROR);
    }
  });

export const generatePurchasePixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      const { generatePurchasePixForTransaction } = await import("./purchase-payment.server");
      return await generatePurchasePixForTransaction(context.userId, data.transactionId);
    } catch (error) {
      paymentLog("purchase-pix", error);
      throw new Error(PIX_PUBLIC_ERROR);
    }
  });
