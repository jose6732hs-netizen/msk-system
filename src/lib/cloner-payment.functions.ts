import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAYMENT_PUBLIC_ERROR, PIX_PUBLIC_ERROR } from "@/lib/payments/public-messages";

const email = (claims: Record<string, unknown>) => (claims["email"] as string) ?? "";
const name = (claims: Record<string, unknown>) =>
  ((claims["user_metadata"] as Record<string, unknown> | undefined)?.["name"] as string) ?? "";

const billingSchema = {
  document: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11 || v.length === 14, "CPF/CNPJ inválido"),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10 && v.length <= 13, "Telefone inválido"),
};

function safeLog(scope: string, error: unknown) {
  const message = String(error instanceof Error ? error.message : error ?? "unknown")
    .replace(/\d{12,19}/g, "[redacted]")
    .slice(0, 400);
  console.error(`[cloner-payment][${scope}]`, message);
}

export const prepareClonerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        affiliateCode: z.string().max(24).optional(),
        ...billingSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    try {
      const { prepareClonerPaymentOrder } = await import("./cloner-payment.server");
      return await prepareClonerPaymentOrder({
        userId: context.userId,
        email: email(context.claims),
        name: name(context.claims),
        planId: data.planId,
        document: data.document,
        phone: data.phone,
        affiliateCode: data.affiliateCode ?? null,
      });
    } catch (error) {
      safeLog("prepare-single", error);
      throw new Error(PAYMENT_PUBLIC_ERROR);
    }
  });

export const prepareSmartBundlePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mainPlanId: z.string().uuid(),
        companionPlanId: z.string().uuid(),
        affiliateCode: z.string().max(24).optional(),
        ...billingSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    try {
      const { prepareSmartBundlePaymentOrder } = await import("./cloner-payment.server");
      return await prepareSmartBundlePaymentOrder({
        userId: context.userId,
        email: email(context.claims),
        name: name(context.claims),
        mainPlanId: data.mainPlanId,
        companionPlanId: data.companionPlanId,
        document: data.document,
        phone: data.phone,
        affiliateCode: data.affiliateCode ?? null,
      });
    } catch (error) {
      safeLog("prepare-bundle", error);
      throw new Error(PAYMENT_PUBLIC_ERROR);
    }
  });

export const generateClonerPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    try {
      const { generateClonerPixForTransaction } = await import("./cloner-payment.server");
      return await generateClonerPixForTransaction(context.userId, data.transactionId);
    } catch (error) {
      safeLog("pix", error);
      throw new Error(PIX_PUBLIC_ERROR);
    }
  });
