import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

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

export const getClonerProduct = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClonerProduct } = await import("./cloner.server");
  const { enrichClonerPlans } = await import("./cloner-plan-overrides.server");
  return enrichClonerPlans(await getPublicClonerProduct());
});

export const trackClonerPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        event: z.enum(["cloner.view", "cloner.share"]),
        visitorId: z.string().max(120).optional(),
        source: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { trackPublicClonerEvent } = await import("./cloner.server");
    return trackPublicClonerEvent(data.event, {
      visitorId: data.visitorId ?? null,
      source: data.source ?? null,
    });
  });

export const getSmartOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { getSmartOfferForPlan } = await import("./cloner.server");
    const { enrichSmartOffer } = await import("./cloner-plan-overrides.server");
    return enrichSmartOffer(await getSmartOfferForPlan(context.userId, data.planId));
  });

export const startSmartBundleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mainPlanId: z.string().uuid(),
        companionPlanId: z.string().uuid(),
        affiliateCode: z.string().max(24).optional(),
        resellerCode: z.string().max(24).optional(),
        ...billingSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { createSmartBundleCheckout } = await import("./cloner.server");
    return createSmartBundleCheckout({
      userId: context.userId,
      email: email(context.claims),
      name: name(context.claims),
      mainPlanId: data.mainPlanId,
      companionPlanId: data.companionPlanId,
      document: data.document,
      phone: data.phone,
      affiliateCode: data.affiliateCode ?? null,
      resellerCode: data.resellerCode ?? null,
    });
  });

export const startClonerCheckout = createServerFn({ method: "POST" })
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
    const { createClonerCheckout } = await import("./cloner.server");
    return createClonerCheckout({
      userId: context.userId,
      email: email(context.claims),
      name: name(context.claims),
      planId: data.planId,
      document: data.document,
      phone: data.phone,
      affiliateCode: data.affiliateCode ?? null,
    });
  });

export const getPaidClonerDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { getClonerDelivery } = await import("./cloner.server");
    return getClonerDelivery(context.userId, data.transactionId);
  });

export const getPaidClonerDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ transactionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { issueClonerDownload } = await import("./cloner.server");
    return issueClonerDownload(context.userId, data.transactionId);
  });

export const adminGetCloner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getAdminCloner } = await import("./cloner.server");
    const { enrichClonerPlans } = await import("./cloner-plan-overrides.server");
    return enrichClonerPlans(await getAdminCloner());
  });

export const adminSaveCloner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        smartOffersEnabled: z.boolean(),
        smartDiscountPercent: z.number().min(1).max(50),
        title: z.string().trim().min(3).max(100),
        subtitle: z.string().trim().min(3).max(220),
        description: z.string().trim().min(3).max(1200),
        shareText: z.string().trim().min(3).max(500),
        plans: z
          .array(
            z.object({
              id: z.string().uuid(),
              price: z.number().positive().max(100000),
              active: z.boolean(),
              imageUrl: z.string().max(4000).nullable().optional(),
            }),
          )
          .length(3),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveAdminCloner } = await import("./cloner.server");
    const { saveClonerPlanOverrides } = await import("./cloner-plan-overrides.server");
    const result = await saveAdminCloner(data, context.userId);
    await saveClonerPlanOverrides(data.plans.map((p) => ({ id: p.id, price: p.price, active: p.active, imageUrl: p.imageUrl ?? null })));
    return result;
  });

export const adminCreateClonerUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        fileName: z.string().min(5).max(160).regex(/\.zip$/i, "O arquivo precisa ser .zip"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { createClonerUploadUrl } = await import("./cloner.server");
    return createClonerUploadUrl(data);
  });

export const adminRegisterClonerZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        storagePath: z.string().min(8).max(320),
        fileName: z.string().min(5).max(160).regex(/\.zip$/i),
        sizeBytes: z.number().int().min(1).max(300 * 1024 * 1024),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { registerClonerZip } = await import("./cloner.server");
    return registerClonerZip(data, context.userId);
  });
