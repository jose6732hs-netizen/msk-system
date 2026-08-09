import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setAffiliateWithdrawalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      passwordHash: z.string().min(6).max(128), // Hash da senha de 6 dígitos
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { setWithdrawalPassword } = await import("./wallet.server");
    return setWithdrawalPassword(context.userId, data.passwordHash);
  });

export const updateAffiliatePixKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      type: z.string().min(2).max(20),
      key: z.string().min(3).max(100),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { updatePixKey } = await import("./wallet.server");
    return updatePixKey(context.userId, data);
  });

export const requestAffiliateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().min(20),
      passwordHash: z.string().min(6).max(128),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { requestWithdrawal } = await import("./wallet.server");
    return requestWithdrawal(context.userId, data);
  });
