import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PRIMARY_PRODUCT_SLUG = "extensao-msk";
const SPECIAL_PLAN_PREFIXES = ["page-cloner-", "msk-agent", "msk-agente"];

function isPrimaryExtensionPlan(plan: Record<string, any>) {
  const slug = String(plan["slug"] ?? "").trim().toLowerCase();
  if (!slug) return false;
  return !SPECIAL_PLAN_PREFIXES.some((prefix) => slug.startsWith(prefix));
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
 * Mantém plano, oferta, transação e licença apontando para o mesmo produto.
 * Clonador e MSK Agente usam fluxos próprios e são deliberadamente ignorados.
 */
export async function syncPrimaryPlanOffer(planId: string, plan: Record<string, any>) {
  if (!isPrimaryExtensionPlan(plan)) return { synced: false as const, reason: "SPECIAL_PRODUCT" };

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id,slug,name")
    .eq("slug", PRIMARY_PRODUCT_SLUG)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("Produto Extensão MSK não encontrado para sincronizar a oferta.");

  const { data: offers, error: offersError } = await supabaseAdmin
    .from("offers")
    .select("id,slug,product_id,plan_id")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (offersError) throw offersError;

  const rows = (offers ?? []) as Array<Record<string, any>>;
  const canonical = rows.find((row) => String(row["product_id"] ?? "") === String(product.id));
  // Se existe uma única oferta antiga para este plano, ela é a própria oferta
  // da aba Planos & Ofertas e pode ser reparada sem trocar seu id/slug.
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

  // Repara registros legados do MESMO plano que ainda não tinham produto.
  const { error: licenseError } = await supabaseAdmin
    .from("licenses")
    .update({ product_id: product.id } as never)
    .eq("plan_id", planId)
    .is("product_id", null);
  if (licenseError) throw licenseError;

  const { error: txError } = await supabaseAdmin
    .from("transactions")
    .update({ product_id: product.id, offer_id: offerId } as never)
    .eq("plan_id", planId)
    .is("product_id", null);
  if (txError) throw txError;

  return { synced: true as const, productId: String(product.id), offerId };
}
