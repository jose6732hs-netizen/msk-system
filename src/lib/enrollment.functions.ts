import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Inscreve o usuário logado como afiliado. */
export const enrollAsAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureAffiliate } = await import("./commerce.server");
    const affiliate = await ensureAffiliate(context.userId);
    return { success: true, affiliateId: affiliate.id };
  });
