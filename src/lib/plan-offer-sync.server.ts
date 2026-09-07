import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PRIMARY_PRODUCT_SLUG = "extensao-msk";
const SPECIAL_PLAN_PREFIXES = ["page-cloner-", "msk-agent", "msk-agente"];

function targetProductSlug(plan: Record<string, any>) {
  const slug = String(plan["slug"] ?? "").trim().toLowerCase();
  if (!slug) return null;
  if (slug === "msk-live" || slug.startsWith("msk-live-")) return "msk-live";
  if (SPECIAL_PLAN_PREFIXES.some((prefix) => slug.startsWith(prefix))) return null;
  return PRIMARY_PRODUCT_SLUG;
}

function periodicityType(unit: unknown) {
  const normalized = String(unit ?? "days").toLowerCase();
  const map: Record<string, string> = {
    minutes: "MINUTES",
    hours: "HOURS",
    days: "DAYS",
    weeks: "WEEKS",
    months: "MONTHS",
    lifetime: "MONTHS",
  };
  return map[normalized] ?? "DAYS";
}

async function uniqueOfferSlug(base: string, planId: string) {
  const normalized = base.trim().toLowerCase() || `oferta-${planId.slice(0, 8)}`;
  const { data } = await supabaseAdmin
    .from("offers")
    .select("id,plan_id")
    .eq("slug", normalized)
    .maybeSingle();
  if (!data || String((data as any).plan_id ?? "") === planId) return normalized;
  return `${normalized}-${planId.slice(0, 8)}`;
}

/**
 * Mantém a oferta atual ligada ao produto correto. Reparos históricos de
 * licenças/transações antigas não fazem parte do caminho crítico de Salvar.
 */
export async function syncPrimaryPlanOffer(planId: string, plan: Record<string, any>) {
  const productSlug = targetProductSlug(plan);
  if (!productSlug) return { synced: false as const, reason: "SPECIAL_PRODUCT" };

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id,slug,name")
    .eq("slug", productSlug)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error(`Produto ${productSlug} não encontrado para sincronizar a oferta.`);

  const { data: offers, error: offersError } = await supabaseAdmin
    .from("offers")
    .select("id,slug,product_id,plan_id")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (offersError) throw offersError;

  const rows = (offers ?? []) as Array<Record<string, any>>;
  const canonical = rows.find((row) => String(row["product_id"] ?? "") === String(product.id));
  const target = canonical ?? (rows.length === 1 ? rows[0] : null);

  const durationValue = Math.max(1, Number(plan["duration_value"] ?? plan["duration_days"] ?? 1));
  const payload = {
    product_id: product.id,
    plan_id: planId,
    name: String(plan["name"] ?? "Oferta MSK"),
    price: Number(plan["price"] ?? 0),
    currency: String(plan["currency"] ?? "BRL"),
    recurring: Boolean(plan["auto_renew"]),
    periodicity_type: periodicityType(plan["duration_unit"]),
    periodicity: Number.isFinite(durationValue) ? Math.round(durationValue) : 1,
    active: plan["active"] !== false,
    affiliate_commission_rate:
      plan["affiliate_commission_rate"] == null ? null : Number(plan["affiliate_commission_rate"]),
    sort_order: Number(plan["sort_order"] ?? 0),
  };

  let offerId: string;
  if (target) {
    const { error } = await supabaseAdmin.from("offers").update(payload as never).eq("id", target["id"]);
    if (error) throw error;
    offerId = String(target["id"]);
  } else {
    const slug = await uniqueOfferSlug(String(plan["slug"] ?? ""), planId);
    const { data: created, error } = await supabaseAdmin
      .from("offers")
      .insert({ ...payload, slug } as never)
      .select("id")
      .single();
    if (error) throw error;
    offerId = String(created.id);
  }

  // Estes updates existem apenas para registros legados. Eles podem afetar
  // muitas linhas e antes seguravam o botão Salvar. Executam em paralelo e
  // nunca transformam um plano já salvo em erro de tela.
  void Promise.all([
    supabaseAdmin
      .from("licenses")
      .update({ product_id: product.id } as never)
      .eq("plan_id", planId)
      .is("product_id", null),
    supabaseAdmin
      .from("transactions")
      .update({ product_id: product.id, offer_id: offerId } as never)
      .eq("plan_id", planId)
      .is("product_id", null),
  ])
    .then((results) => {
      for (const result of results) {
        if (result.error) console.error("[plan-offer-sync] reparo legado falhou:", result.error.message);
      }
    })
    .catch((error) => {
      console.error("[plan-offer-sync] reparo legado falhou:", String((error as Error).message).slice(0, 200));
    });

  return { synced: true as const, productId: String(product.id), offerId };
}
