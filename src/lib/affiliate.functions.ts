import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rangeSchema = z.object({
  range: z.enum(["7d", "30d", "90d", "year", "custom"]).default("30d"),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** Registra o clique em um link de afiliado (público). */
export const trackAffiliateVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(3).max(24),
        visitorId: z.string().min(6).max(80),
        landingPath: z.string().max(200).optional(),
        referer: z.string().max(300).optional(),
        utm: z
          .object({
            source: z.string().max(100).optional().nullable(),
            medium: z.string().max(100).optional().nullable(),
            campaign: z.string().max(100).optional().nullable(),
            content: z.string().max(100).optional().nullable(),
            term: z.string().max(100).optional().nullable(),
          })
          .optional()
          .nullable(),
        deviceType: z.string().max(50).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { trackVisit } = await import("./affiliate.server");
    return trackVisit({
      code: data.code,
      visitorId: data.visitorId,
      landingPath: data.landingPath ?? null,
      referer: data.referer ?? null,
      deviceType: data.deviceType ?? null,
      ...(data.utm && {
        utm: {
          source: data.utm.source ?? null,
          medium: data.utm.medium ?? null,
          campaign: data.utm.campaign ?? null,
          content: data.utm.content ?? null,
          term: data.utm.term ?? null,
        },
      }),
    });
  });

/** Vincula o usuário autenticado ao afiliado que o indicou. */
export const linkAffiliateReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().min(3).max(24), visitorId: z.string().max(80).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { attachReferral } = await import("./affiliate.server");
    return attachReferral({
      code: data.code,
      userId: context.userId,
      visitorId: data.visitorId ?? null,
    });
  });

/** Painel do afiliado (somente os próprios dados). */
export const affiliateOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { loadAffiliateOverview } = await import("./affiliate-dashboard.server");
    return loadAffiliateOverview(context.userId, {
      range: data.range,
      from: data.from ?? null,
      to: data.to ?? null,
    });
  });

/** Recalcula saldo/pendências e devolve o painel atualizado. */
export const refreshAffiliateBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recomputePendingBalance } = await import("./affiliate.server");
    const { loadAffiliateOverview } = await import("./affiliate-dashboard.server");
    const { data: affiliate } = await supabaseAdmin
      .from("affiliates")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (affiliate) await recomputePendingBalance(affiliate.id);
    return loadAffiliateOverview(context.userId, {
      range: data.range,
      from: data.from ?? null,
      to: data.to ?? null,
    });
  });

/** Envia documentos para análise de afiliação (Simplificado: apenas selfie com documento). */
export const submitAffiliateDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => 
    z.object({
      selfie: z.string(),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: affiliate } = await supabaseAdmin
      .from("affiliates")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!affiliate) throw new Error("Afiliado não encontrado");

    const now = new Date().toISOString();

    // Inserir o documento de selfie
    const docs = [
      { affiliate_id: affiliate.id, type: 'SELFIE', file_path: data.selfie, status: 'PENDING' },
    ];

    const { error: docsError } = await supabaseAdmin
      .from("affiliate_documents")
      .upsert(docs as any, { onConflict: 'affiliate_id,type' });

    if (docsError) throw docsError;

    // Atualizar status da afiliação
    const { error: affiliateError } = await supabaseAdmin
      .from("affiliates")
      .update({ 
        verification_status: 'PENDING',
        verification_submitted_at: now
      } as any)
      .eq("id", affiliate.id);

    if (affiliateError) throw affiliateError;

    return { success: true };
  });
