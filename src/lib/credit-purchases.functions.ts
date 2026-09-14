import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export const getCreditPurchaseOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadCreditPurchaseOverview } = await import("./credit-purchases.server");
    return loadCreditPurchaseOverview(context.userId);
  });

export const requestCreditTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { claimCreditTrial } = await import("./credit-purchases.server");
    return claimCreditTrial(context.userId);
  });

export const createCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ quantity: z.number().int().min(40).max(1000) }).parse(input))
  .handler(async ({ context, data }) => {
    const { prepareCreditPurchase } = await import("./credit-purchases.server");
    return prepareCreditPurchase(context.userId, data.quantity);
  });

export const adminCreditPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { listPendingCreditKeys } = await import("./credit-purchases.server");
    return listPendingCreditKeys();
  });

export const adminMarkCreditKeyDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ transactionId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { markCreditKeyDelivered } = await import("./credit-purchases.server");
    return markCreditKeyDelivered(data.transactionId, context.userId);
  });