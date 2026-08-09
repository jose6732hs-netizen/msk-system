import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getAffiliateEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => 
    z.object({
      affiliateId: z.string().uuid().optional(),
      limit: z.number().default(50)
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    // Se não passar affiliateId, tenta pegar do usuário atual
    let affId = data.affiliateId;
    
    if (!affId) {
      const { data: aff } = await supabaseAdmin
        .from("affiliates")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      affId = aff?.id;
    }

    if (!affId) return [];

    const { data: events } = await supabaseAdmin
      .from("affiliate_events" as any)
      .select("*")
      .eq("affiliate_id", affId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    return (events as any[]) ?? [];
  });
