import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export const adminAffiliates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ search: z.string().max(120).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadAdminAffiliates } = await import("./admin-affiliates.server");
    return loadAdminAffiliates(data.search ?? "");
  });

export const adminUpdateAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        affiliateId: z.string().uuid(),
        commissionRate: z.number().min(0).max(90).optional(),
        goalAmount: z.number().min(0).max(1000000).optional(),
        status: z.enum(["active", "blocked"]).optional(),
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { updateAffiliate } = await import("./admin-affiliates.server");
    return updateAffiliate(data, context.userId);
  });

export const adminAdjustAffiliateBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        affiliateId: z.string().uuid(),
        amount: z.number().min(-100000).max(100000),
        reason: z.string().min(3).max(240),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { adjustAffiliateBalance } = await import("./admin-affiliates.server");
    return adjustAffiliateBalance(data, context.userId);
  });

export const adminSaveCommissionOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        affiliateId: z.string().uuid().nullable().optional(),
        planId: z.string().uuid().nullable().optional(),
        rate: z.number().min(0).max(90).nullable().optional(),
        fixedAmount: z.number().min(0).max(100000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveCommissionOverride } = await import("./admin-affiliates.server");
    return saveCommissionOverride(
      {
        affiliateId: data.affiliateId ?? null,
        planId: data.planId ?? null,
        rate: data.rate ?? null,
        fixedAmount: data.fixedAmount ?? null,
      },
      context.userId,
    );
  });

export const adminDeleteCommissionOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { deleteCommissionOverride } = await import("./admin-affiliates.server");
    return deleteCommissionOverride(data.id, context.userId);
  });

export const adminSaveAffiliateGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        balance: z.number().min(0),
        commission: z.number().min(0),
        sales: z.number().min(0),
        referrals: z.number().min(0),
        monthly: z.number().min(0),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveAffiliateGoals } = await import("./admin-affiliates.server");
    return saveAffiliateGoals(data, context.userId);
  });

export const adminApproveAffiliateDocs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ affiliateId: z.string().uuid(), approve: z.boolean(), reason: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { approveAffiliateDocs } = await import("./admin-affiliates.server");
    return approveAffiliateDocs(data.affiliateId, data.approve, data.reason, context.userId);
  });

export const adminSaveAppUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveAppUrl } = await import("./admin-affiliates.server");
    return saveAppUrl(data.url, context.userId);
  });
