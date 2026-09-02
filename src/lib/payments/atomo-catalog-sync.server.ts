/**
 * Sincroniza TODAS as ofertas do MSK com a AtomoPay.
 *
 * Objetivo: cada plano/oferta criado no painel MSK precisa aparecer como
 * produto + oferta dentro da conta AtomoPay, e o valor precisa estar
 * pré-aprovado (usando o mesmo split de ticket usado pelo PIX) para que
 * nenhuma cobrança caia em análise manual na hora da venda.
 *
 * Somente servidor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AtomoPayService } from "./atomo-pay.server";
import { calculateCardAmounts } from "./card.server";

const MAP_KEY = "atomopay_plan_catalog";

type PlanMapping = {
  planId: string;
  slug: string;
  name: string;
  price: number;
  productHash: string;
  offerHash: string;
  approved: boolean;
  syncedAt: string;
};

type MapState = Record<string, PlanMapping>;

function unwrap(value: any) {
  return value?.data ?? value ?? {};
}

function offerPrice(offer: any) {
  return Number(offer?.price ?? offer?.amount ?? offer?.value ?? 0);
}

function offerApproved(offer: any) {
  const status = offer?.status;
  if (status === undefined || status === null) return true;
  return Number(status) === 1;
}

function productTitleFor(plan: Record<string, any>) {
  return `MSK · ${String(plan["name"] ?? plan["slug"] ?? "Plano").trim()}`.slice(0, 60);
}

async function loadMap(): Promise<MapState> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", MAP_KEY)
    .maybeSingle();
  return ((data?.value ?? {}) as MapState) ?? {};
}

async function saveMap(state: MapState) {
  await supabaseAdmin.from("app_settings").upsert(
    { key: MAP_KEY, value: state as never, updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

/** Garante produto + oferta na AtomoPay para um plano específico. */
async function syncPlan(
  service: AtomoPayService,
  plan: Record<string, any>,
  products: any[],
): Promise<PlanMapping> {
  const title = productTitleFor(plan);
  const priceCents = Math.max(1, Math.round(Number(plan["price"] ?? 0) * 100));

  let product = products.find(
    (item) => String(item?.title ?? item?.name ?? "").trim() === title,
  );
  if (!product) {
    product = unwrap(
      await service.createProduct({
        title,
        amount: priceCents,
        salePage: "https://msksystem.online/planos",
      }),
    );
    products.push(product);
  }

  const productHash = String(product?.hash ?? product?.product_hash ?? "");
  if (!productHash) throw new Error("ATOMOPAY_PRODUCT_HASH_MISSING");

  // Ofertas atuais do produto (a listagem geral nem sempre traz as ofertas).
  const detail = unwrap(await service.getProduct(productHash).catch(() => null));
  const offers: any[] = Array.isArray(detail?.offers)
    ? detail.offers
    : Array.isArray(product?.offers)
      ? product.offers
      : [];

  let offer = offers.find((item) => item?.hash && offerPrice(item) === priceCents);
  if (!offer) {
    offer = unwrap(
      await service.createOffer(productHash, { title: title.slice(0, 60), amount: priceCents }),
    );
  }

  const offerHash = String(offer?.hash ?? offer?.offer_hash ?? "");
  if (!offerHash) throw new Error("ATOMOPAY_OFFER_HASH_MISSING");

  // Pré-aquece o catálogo de cobrança (PIX e cartão) para que a venda real
  // nunca dependa de aprovação manual do ticket.
  const cardTotalCents = Math.round(calculateCardAmounts(Number(plan["price"] ?? 0)).totalAmount * 100);
  for (const amount of new Set([priceCents, cardTotalCents])) {
    await service.resolveApprovedCatalog(amount).catch(() => null);
  }

  return {
    planId: String(plan["id"]),
    slug: String(plan["slug"] ?? ""),
    name: String(plan["name"] ?? ""),
    price: Number(plan["price"] ?? 0),
    productHash,
    offerHash,
    approved: offerApproved(offer),
    syncedAt: new Date().toISOString(),
  };
}

/** Sincroniza todos os planos ativos com a AtomoPay. */
export async function syncAllPlansToAtomo() {
  const service = await AtomoPayService.create();
  const { data: plans, error } = await supabaseAdmin
    .from("plans")
    .select("id,slug,name,price,active")
    .order("price", { ascending: true });
  if (error) throw error;

  const listed = unwrap(await service.listProducts());
  const products: any[] = Array.isArray(listed)
    ? listed
    : Array.isArray(listed?.data)
      ? listed.data
      : Array.isArray(listed?.products)
        ? listed.products
        : [];

  const state = await loadMap();
  const results: { plan: string; ok: boolean; approved: boolean; error?: string }[] = [];

  for (const plan of (plans ?? []) as Record<string, any>[]) {
    if (plan["active"] === false) continue;
    if (!Number(plan["price"])) continue;
    try {
      const mapping = await syncPlan(service, plan, products);
      state[mapping.planId] = mapping;
      results.push({ plan: mapping.name, ok: true, approved: mapping.approved });
    } catch (e) {
      results.push({
        plan: String(plan["name"] ?? plan["slug"] ?? plan["id"]),
        ok: false,
        approved: false,
        error: String((e as Error).message ?? e).slice(0, 200),
      });
    }
  }

  await saveMap(state);

  return {
    total: results.length,
    synced: results.filter((r) => r.ok).length,
    pendingApproval: results.filter((r) => r.ok && !r.approved).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

/** Sincroniza um único plano (usado logo após salvar no painel). */
export async function syncPlanToAtomo(planId: string) {
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id,slug,name,price,active")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || (plan as any).active === false || !Number((plan as any).price)) {
    return { synced: false as const };
  }
  const service = await AtomoPayService.create();
  const listed = unwrap(await service.listProducts());
  const products: any[] = Array.isArray(listed) ? listed : (listed?.data ?? listed?.products ?? []);
  const mapping = await syncPlan(service, plan as Record<string, any>, products);
  const state = await loadMap();
  state[mapping.planId] = mapping;
  await saveMap(state);
  return { synced: true as const, mapping };
}

/** Estado atual do espelhamento MSK → AtomoPay. */
export async function getAtomoCatalogMap() {
  const state = await loadMap();
  return Object.values(state).sort((a, b) => a.price - b.price);
}
