import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";

export type AffiliateTier = {
  id: string;
  name: string;
  min_sales: number;
  min_revenue: number;
  commission_rate: number;
  badge_color: string;
};

/**
 * Recalcula o nível (tier) do afiliado baseado no seu histórico real de conversões.
 * Se o afiliado atingir os requisitos de um nível superior, ele é promovido automaticamente.
 */
export async function recomputeAffiliateTier(affiliateId: string) {
  // 1. Buscar métricas reais do afiliado
  const { data: stats } = await supabaseAdmin
    .from("affiliate_conversions" as any)
    .select("amount")
    .eq("affiliate_id", affiliateId)
    .eq("status", "APPROVED");

  const salesCount = (stats as any[])?.length ?? 0;
  const totalRevenue = ((stats as any[]) ?? []).reduce((acc, curr) => acc + Number(curr.amount), 0);

  // 2. Buscar níveis disponíveis
  const { data: tiers } = await supabaseAdmin
    .from("affiliate_tiers" as any)
    .select("*")
    .order("min_sales", { ascending: false });

  if (!tiers || (tiers as any[]).length === 0) return null;

  // 3. Encontrar o melhor nível que o afiliado qualifica
  const newTier = (tiers as any[]).find(t => salesCount >= t.min_sales && totalRevenue >= t.min_revenue);
  
  if (!newTier) return null;

  // 4. Verificar nível atual
  const { data: currentAff } = await supabaseAdmin
    .from("affiliates" as any)
    .select("tier_id" as any)
    .eq("id", affiliateId)
    .single();

  if ((currentAff as any)?.tier_id !== newTier.id) {
    // Promoção!
    await supabaseAdmin
      .from("affiliates" as any)
      .update({ 
        tier_id: newTier.id,
        commission_rate: newTier.commission_rate // Atualiza a taxa base para a do novo nível
      } as any)
      .eq("id", affiliateId);

    await logAudit({
      action: "affiliate.tier_promoted",
      resource: "affiliates",
      resourceId: affiliateId,
      metadata: { 
        oldTierId: (currentAff as any)?.tier_id, 
        newTierId: newTier.id,
        sales: salesCount,
        revenue: totalRevenue
      }
    });

    return newTier as AffiliateTier;
  }

  return null;
}
