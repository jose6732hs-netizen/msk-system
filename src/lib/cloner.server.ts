import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "./license.server";
import { findAffiliateByCode, findResellerByCode, getSetting, issueStandaloneLicense, newIdentifier, setSetting } from "./commerce.server";
import { logAudit } from "./audit.server";
import { pixExpiryFromNow } from "./orders.server";
import { buildSplits } from "./financial.server";

export const CLONER_SLUG = "page-cloner";
export const CLONER_PREFIX = "page-cloner-";
const SETTING_KEY = "page_cloner_checkout";
const BUCKET = "extension-builds";
const SIGNED_DOWNLOAD_SECONDS = 300;

type Cadence = "daily" | "weekly" | "monthly";
type ProductKind = "primary" | "cloner";

export type ClonerConfig = {
  enabled: boolean;
  smart_offers_enabled: boolean;
  smart_discount_percent: number;
  title: string;
  subtitle: string;
  description: string;
  share_text: string;
  zip_storage_path: string | null;
  zip_file_name: string | null;
  zip_size_bytes: number | null;
};

const DEFAULT_CONFIG: ClonerConfig = {
  enabled: false,
  smart_offers_enabled: true,
  smart_discount_percent: 10,
  title: "MSK Clonador de Páginas",
  subtitle: "Clone páginas com rapidez e leve a estrutura para o seu projeto.",
  description: "Pagamento via PIX. A licença e o arquivo ZIP são liberados somente após a confirmação do pagamento.",
  share_text: "Conheça o MSK Clonador de Páginas e libere sua licença pelo PIX.",
  zip_storage_path: null,
  zip_file_name: null,
  zip_size_bytes: null,
};

const PLAN_DEFS: Array<{ cadence: Cadence; slug: string; name: string; price: number; durationLabel: string; durationValue: number; durationDays: number; sortOrder: number; badge: string; tagline: string }> = [
  { cadence: "daily", slug: "page-cloner-daily", name: "Clonador Diário", price: 7.9, durationLabel: "1 dia", durationValue: 1, durationDays: 1, sortOrder: 991, badge: "Acesso rápido", tagline: "Ideal para uma clonagem rápida." },
  { cadence: "weekly", slug: "page-cloner-weekly", name: "Clonador Semanal", price: 19.9, durationLabel: "7 dias", durationValue: 7, durationDays: 7, sortOrder: 992, badge: "Mais vendido", tagline: "Mais liberdade para testar e publicar." },
  { cadence: "monthly", slug: "page-cloner-monthly", name: "Clonador Mensal", price: 49.9, durationLabel: "30 dias", durationValue: 30, durationDays: 30, sortOrder: 993, badge: "Melhor valor", tagline: "Para escalar com liberdade durante o mês." },
];

const PRIMARY_SLUG: Record<Cadence, string> = { daily: "daily", weekly: "weekly", monthly: "monthly" };
const planColumns = "id,name,slug,description,price,currency,active,is_lifetime,duration_label,duration_days,duration_value,duration_unit,max_devices,updated_at,features,highlights";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const meta = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as any : {};

async function config() {
  const saved = await getSetting<Partial<ClonerConfig>>(SETTING_KEY, {});
  const raw = Number(saved?.smart_discount_percent ?? DEFAULT_CONFIG.smart_discount_percent);
  return {
    ...DEFAULT_CONFIG,
    ...(saved ?? {}),
    smart_discount_percent: Number.isFinite(raw) ? Math.min(50, Math.max(1, raw)) : 10,
  } as ClonerConfig;
}

function cadence(plan: any): Cadence | null {
  const slug = String(plan?.slug ?? "").toLowerCase();
  if (slug === "daily" || slug.endsWith("-daily")) return "daily";
  if (slug === "weekly" || slug.endsWith("-weekly")) return "weekly";
  if (slug === "monthly" || slug.endsWith("-monthly")) return "monthly";
  const days = Number(plan?.duration_days ?? 0);
  const label = String(plan?.duration_label ?? "").toLowerCase();
  if (days === 1 || /\b1\s*dia\b/.test(label)) return "daily";
  if (days === 7 || /7\s*dias|seman/.test(label)) return "weekly";
  if ((days >= 28 && days <= 31) || /30\s*dias|mensal|m[eê]s/.test(label)) return "monthly";
  return null;
}

function kind(plan: any): ProductKind {
  return String(plan?.slug ?? "").startsWith(CLONER_PREFIX) ? "cloner" : "primary";
}

async function ensureClonerPlans(cfg?: ClonerConfig) {
  const effective = cfg ?? await config();
  const slugs = PLAN_DEFS.map((item) => item.slug);
  const { data: existing, error } = await supabaseAdmin.from("plans").select(planColumns).in("slug", slugs);
  if (error) throw new Error(error.message);
  const bySlug = new Map((existing ?? []).map((row: any) => [String(row.slug), row]));

  for (const def of PLAN_DEFS) {
    const row = bySlug.get(def.slug) as any | undefined;
    if (!row) {
      const { data: created, error: createError } = await supabaseAdmin.from("plans").insert({
        name: def.name,
        slug: def.slug,
        description: `${def.tagline} Licença individual para a extensão de clonagem.`,
        price: def.price,
        currency: "BRL",
        active: !!effective.enabled && !!effective.zip_storage_path,
        is_lifetime: false,
        duration_label: def.durationLabel,
        duration_value: def.durationValue,
        duration_unit: "days",
        duration_days: def.durationDays,
        max_devices: 1,
        max_activations: 3,
        allow_trial: false,
        auto_renew: false,
        features: { page_cloner: true, hidden_from_plans: true, cadence: def.cadence },
        highlights: ["Clonagem de páginas", `Acesso por ${def.durationLabel}`, "Licença individual", "Download liberado após pagamento"],
        sort_order: def.sortOrder,
      } as never).select(planColumns).single();
      if (createError) throw new Error(createError.message);
      bySlug.set(def.slug, created as any);
    } else {
      const { error: repairError } = await supabaseAdmin.from("plans").update({
        duration_label: def.durationLabel,
        duration_value: def.durationValue,
        duration_unit: "days",
        duration_days: def.durationDays,
        is_lifetime: false,
        auto_renew: false,
        allow_trial: false,
        max_devices: 1,
        features: { ...meta(row.features), page_cloner: true, hidden_from_plans: true, cadence: def.cadence },
      } as never).eq("id", row.id);
      if (repairError) throw new Error(repairError.message);
    }
  }

  const { data: rows, error: rowsError } = await supabaseAdmin.from("plans").select(planColumns).in("slug", slugs).order("sort_order");
  if (rowsError) throw new Error(rowsError.message);
  return (rows ?? []) as any[];
}

function publicPlan(row: any) {
  const def = PLAN_DEFS.find((item) => item.slug === row.slug);
  return {
    id: row.id,
    slug: row.slug,
    cadence: def?.cadence ?? cadence(row),
    name: row.name,
    description: row.description,
    price: Number(row.price ?? 0),
    currency: row.currency ?? "BRL",
    active: !!row.active,
    durationLabel: row.duration_label,
    durationDays: row.duration_days,
    badge: def?.badge ?? "Clonador",
    tagline: def?.tagline ?? row.description,
  };
}

export async function getPublicClonerProduct() {
  const cfg = await config();
  const rows = await ensureClonerPlans(cfg);
  const plans = rows.map(publicPlan);
  return {
    enabled: !!cfg.enabled && !!cfg.zip_storage_path && plans.some((item) => item.active && item.price > 0),
    configured: plans.length === 3,
    title: cfg.title,
    subtitle: cfg.subtitle,
    description: cfg.description,
    shareText: cfg.share_text,
    smartOffersEnabled: !!cfg.smart_offers_enabled,
    smartDiscountPercent: cfg.smart_discount_percent,
    plans,
    zipReady: !!cfg.zip_storage_path,
    zipFileName: cfg.zip_file_name,
    zipSizeBytes: cfg.zip_size_bytes,
  };
}

async function recordEvent(input: { event: string; status?: string; transactionId?: string | null; amount?: number | null; metadata?: Record<string, unknown> }) {
  const { error } = await supabaseAdmin.from("payment_events").insert({
    event: input.event,
    status: input.status ?? "INFO",
    transaction_id: input.transactionId ?? null,
    amount: input.amount ?? null,
    metadata: (input.metadata ?? {}) as never,
  } as never);
  if (error) console.error("[cloner] evento:", error.message);
}

export async function trackPublicClonerEvent(event: "cloner.view" | "cloner.share", metadata?: Record<string, unknown>) {
  await recordEvent({ event, metadata: { product: CLONER_SLUG, ...(metadata ?? {}) } });
  return { ok: true };
}

async function loadPlan(id: string) {
  const { data, error } = await supabaseAdmin.from("plans").select(planColumns).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as any | null;
}

async function ownsUsable(userId: string, planId: string) {
  const { data } = await supabaseAdmin.from("licenses").select("id,status,expires_at").eq("user_id", userId).eq("plan_id", planId).in("status", ["active", "inactive"]).order("created_at", { ascending: false }).limit(1);
  const row = data?.[0] as any | undefined;
  if (!row) return false;
  if (row.status === "inactive") return true;
  return !row.expires_at || new Date(row.expires_at).getTime() > Date.now();
}

async function resolveOffer(userId: string, mainPlanId: string, logShown: boolean) {
  const cfg = await config();
  if (!cfg.smart_offers_enabled) return { available: false as const, reason: "DISABLED" };
  const clonerPlans = await ensureClonerPlans(cfg);
  const main = await loadPlan(mainPlanId);
  if (!main || !main.active || Number(main.price) <= 0) return { available: false as const, reason: "MAIN_UNAVAILABLE" };
  const mainSlug = String(main.slug ?? "").toLowerCase();
  if (mainSlug === "msk-live" || mainSlug.startsWith("msk-live-")) {
    return { available: false as const, reason: "PRODUCT_ISOLATED" };
  }
  const period = cadence(main);
  if (!period) return { available: false as const, reason: "UNSUPPORTED_PERIOD" };
  const sourceKind = kind(main);

  let companion: any | null = null;
  if (sourceKind === "primary") {
    if (!cfg.enabled || !cfg.zip_storage_path) return { available: false as const, reason: "CLONER_NOT_READY" };
    companion = clonerPlans.find((item) => item.slug === `${CLONER_PREFIX}${period}`) ?? null;
  } else {
    const { data } = await supabaseAdmin.from("plans").select(planColumns).eq("slug", PRIMARY_SLUG[period]).eq("active", true).maybeSingle();
    companion = data ?? null;
  }
  if (!companion || !companion.active || Number(companion.price) <= 0) return { available: false as const, reason: "COMPANION_UNAVAILABLE" };
  if (await ownsUsable(userId, companion.id)) return { available: false as const, reason: "ALREADY_OWNED" };

  const discountPercent = cfg.smart_discount_percent;
  const original = Number(companion.price);
  const discounted = money(original * (1 - discountPercent / 100));
  const savings = money(original - discounted);
  const offer = {
    available: true as const,
    sourceKind,
    cadence: period,
    discountPercent,
    savings,
    total: money(Number(main.price) + discounted),
    main: { id: main.id, name: main.name, slug: main.slug, price: Number(main.price), currency: main.currency ?? "BRL", durationLabel: main.duration_label, kind: sourceKind },
    companion: { id: companion.id, name: companion.name, slug: companion.slug, originalPrice: original, discountedPrice: discounted, currency: companion.currency ?? "BRL", durationLabel: companion.duration_label, kind: sourceKind === "primary" ? "cloner" : "primary" },
  };
  if (logShown) await recordEvent({ event: "smart.offer_shown", metadata: { product: CLONER_SLUG, userId, sourceKind, cadence: period, mainPlanId: main.id, companionPlanId: companion.id, discountPercent } });
  return offer;
}

export async function getSmartOfferForPlan(userId: string, mainPlanId: string) {
  return resolveOffer(userId, mainPlanId, true);
}

export async function createSmartBundleCheckout(input: { userId: string; email: string; name: string; mainPlanId: string; companionPlanId: string; document: string; phone: string; affiliateCode?: string | null; resellerCode?: string | null }) {
  const offer = await resolveOffer(input.userId, input.mainPlanId, false);
  if (!offer.available || offer.companion.id !== input.companionPlanId) throw new Error("Esta oferta inteligente não está mais disponível.");

  const affiliate = await findAffiliateByCode(input.affiliateCode);
  const reseller = await findResellerByCode(input.resellerCode);
  const { affiliateForUser, registerPendingCommission } = await import("./affiliate.server");
  const affiliateId = affiliate?.id ?? await affiliateForUser(input.userId);
  const amount = offer.total;
  const amountCents = Math.round(amount * 100);
  const identifier = newIdentifier("BND");
  const comboKey = `${offer.main.slug}+${offer.companion.slug}`;
  const metadata = {
    smart_bundle: true,
    product: CLONER_SLUG,
    delivery: "license+private_zip",
    source_kind: offer.sourceKind,
    cadence: offer.cadence,
    main_plan_id: offer.main.id,
    companion_plan_id: offer.companion.id,
    plan_ids: [offer.main.id, offer.companion.id],
    discount_percent: offer.discountPercent,
    discount_amount: offer.savings,
    companion_original_price: offer.companion.originalPrice,
    companion_final_price: offer.companion.discountedPrice,
    combo_key: comboKey,
    lines: [
      { planId: offer.main.id, slug: offer.main.slug, name: offer.main.name, product: offer.main.kind, originalPrice: offer.main.price, finalPrice: offer.main.price, discountPercent: 0 },
      { planId: offer.companion.id, slug: offer.companion.slug, name: offer.companion.name, product: offer.companion.kind, originalPrice: offer.companion.originalPrice, finalPrice: offer.companion.discountedPrice, discountPercent: offer.discountPercent },
    ],
  };

  const { data: tx, error } = await supabaseAdmin.from("transactions").insert({
    identifier,
    user_id: input.userId,
    plan_id: null,
    affiliate_id: affiliateId,
    reseller_id: reseller?.id ?? null,
    purpose: "purchase",
    method: "PIX",
    amount,
    currency: "BRL",
    status: "PENDING",
    metadata: metadata as never,
  }).select("id").single();
  if (error) throw new Error(error.message);

  try {
    const splits = await buildSplits({ amountCents, affiliateId: null, resellerId: reseller?.id ?? null });
    await supabaseAdmin.from("transactions").update({ splits: splits as never }).eq("id", tx.id);
    if (affiliateId) await registerPendingCommission({ affiliateId, transactionId: tx.id, planId: offer.main.id, amount });

    const { createPixWithFailover } = await import("./payments/gateway.server");
    const { provider, result, pixCode } = await createPixWithFailover({
      identifier,
      amountCents,
      customer: { name: input.name || input.email, email: input.email, phone: input.phone, document: { number: input.document, type: input.document.length === 14 ? "CNPJ" : "CPF" } },
      items: [
        { title: offer.main.name, unitPrice: Math.round(offer.main.price * 100), quantity: 1, tangible: false },
        { title: `${offer.companion.name} (${offer.discountPercent}% OFF)`, unitPrice: Math.round(offer.companion.discountedPrice * 100), quantity: 1, tangible: false },
      ],
      splits,
      metadata: { transactionId: tx.id, smartBundle: true },
    });
    const qr = result.pix?.base64 ?? result.pix?.image ?? null;
    const providerId = result.transactionId ?? result.id ?? null;
    await supabaseAdmin.from("transactions").update({ provider, provider_transaction_id: providerId, pix_code: pixCode, pix_qrcode: qr, expires_at: pixExpiryFromNow(), checkout_url: result.order?.url ?? null, raw: result as never, updated_at: new Date().toISOString() } as never).eq("id", tx.id);

    await Promise.all([
      recordEvent({ event: "smart.offer_accepted", status: "PENDING", transactionId: tx.id, amount, metadata: { product: CLONER_SLUG, comboKey, cadence: offer.cadence, discountPercent: offer.discountPercent } }),
      recordEvent({ event: "smart.bundle_pix", status: "PENDING", transactionId: tx.id, amount, metadata: { product: CLONER_SLUG, comboKey, cadence: offer.cadence } }),
      recordEvent({ event: "cloner.pix_generated", status: "PENDING", transactionId: tx.id, amount, metadata: { product: CLONER_SLUG, smartBundle: true, comboKey } }),
    ]);
    await logAudit({ userId: input.userId, action: "checkout.smart_bundle_pix_created", resource: "transactions", resourceId: tx.id, metadata: { comboKey, amount, discountPercent: offer.discountPercent } });
    return { transactionId: tx.id, identifier, amount, pixCode, qrCode: qr, checkoutUrl: result.order?.url ?? null, offer };
  } catch (e) {
    await supabaseAdmin.from("transactions").update({ status: "FAILED", metadata: { ...metadata, error: (e as Error).message } as never }).eq("id", tx.id);
    throw e;
  }
}

export async function createClonerCheckout(input: { userId: string; email: string; name: string; planId: string; document: string; phone: string; affiliateCode?: string | null }) {
  const product = await getPublicClonerProduct();
  const selected = product.plans.find((item) => item.id === input.planId);
  if (!selected) throw new Error("Plano do Clonador inválido.");
  if (!product.zipReady) throw new Error("O arquivo da ferramenta ainda não foi publicado pelo administrador.");
  if (!product.enabled || !selected.active || !(selected.price > 0)) throw new Error("Este plano do Clonador está indisponível no momento.");

  const { createPixCheckout } = await import("./checkout.server");
  const result = await createPixCheckout({ userId: input.userId, email: input.email, name: input.name, planId: selected.id, affiliateCode: input.affiliateCode ?? null, resellerCode: null, document: input.document, phone: input.phone });
  const { data: tx } = await supabaseAdmin.from("transactions").select("metadata").eq("id", result.transactionId).maybeSingle();
  await supabaseAdmin.from("transactions").update({ metadata: { ...meta(tx?.metadata), product: CLONER_SLUG, cloner_plan_slug: selected.slug, cadence: selected.cadence, delivery: "license+private_zip" } as never }).eq("id", result.transactionId);
  await recordEvent({ event: "cloner.pix_generated", status: "PENDING", transactionId: result.transactionId, amount: result.amount, metadata: { product: CLONER_SLUG, planId: selected.id, cadence: selected.cadence } });
  return { ...result, productTitle: product.title, selectedPlan: selected };
}

function planIds(tx: any) {
  const m = meta(tx.metadata);
  const ids = Array.isArray(m.plan_ids) ? m.plan_ids.filter((value: unknown) => typeof value === "string") : [];
  if (typeof tx.plan_id === "string") ids.push(tx.plan_id);
  return [...new Set(ids)] as string[];
}

async function paidClonerTransaction(userId: string, transactionId: string) {
  try { const { reconcileTransaction } = await import("./reconcile.server"); await reconcileTransaction(transactionId); } catch { /* status local continua sendo a trava */ }
  const { data: tx, error } = await supabaseAdmin.from("transactions").select("id,user_id,plan_id,status,paid_at,amount,currency,created_at,metadata").eq("id", transactionId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!tx) throw new Error("Compra não encontrada.");
  const clonerPlans = await ensureClonerPlans(await config());
  const clonerIds = new Set(clonerPlans.map((item) => item.id));
  if (!planIds(tx).some((id) => clonerIds.has(id))) throw new Error("Esta compra não pertence ao Clonador de Páginas.");
  if (String(tx.status).toUpperCase() !== "PAID" || !tx.paid_at) return { paid: false as const, transaction: tx };
  return { paid: true as const, transaction: tx };
}

async function ensureLicense(tx: any, planId: string) {
  const fields = "id,plan_id,token_encrypted,token_preview,status,activated_at,expires_at,metadata,plans(name,is_lifetime,duration_label,slug)";
  const { data: current, error } = await supabaseAdmin.from("licenses").select(fields).eq("transaction_id", tx.id).eq("plan_id", planId).order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  if (current?.[0]) return current[0] as any;
  if (!tx.user_id) throw new Error("Não foi possível vincular a licença à compra.");
  await issueStandaloneLicense({ userId: tx.user_id, planId, type: "paid", transactionId: tx.id, maxDevices: 1 });
  const { data: created, error: createdError } = await supabaseAdmin.from("licenses").select(fields).eq("transaction_id", tx.id).eq("plan_id", planId).order("created_at", { ascending: false }).limit(1);
  if (createdError) throw new Error(createdError.message);
  if (!created?.[0]) throw new Error("Licença ainda não foi gerada. Tente novamente em alguns segundos.");
  return created[0] as any;
}

async function serializeLicense(row: any) {
  if (!row.token_encrypted) throw new Error("Token da licença indisponível.");
  const token = await decryptToken(row.token_encrypted);
  if (!token) throw new Error("Não foi possível revelar a licença.");
  const plan = row.plans as any;
  return {
    id: row.id,
    planId: row.plan_id,
    token,
    preview: row.token_preview,
    status: row.status,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    planName: plan?.name ?? "Licença MSK",
    planSlug: plan?.slug ?? null,
    durationLabel: plan?.duration_label ?? null,
    isLifetime: !!plan?.is_lifetime,
    pendingDurationMs: Number(meta(row.metadata).pending_duration_ms ?? 0) || null,
    product: String(plan?.slug ?? "").startsWith(CLONER_PREFIX) ? "cloner" : "primary",
  };
}

export async function getClonerDelivery(userId: string, transactionId: string) {
  const purchase = await paidClonerTransaction(userId, transactionId);
  if (!purchase.paid) return { paid: false as const, status: purchase.transaction.status, amount: Number(purchase.transaction.amount) };
  const ids = planIds(purchase.transaction);
  if (!ids.length) throw new Error("A compra paga não possui planos para entrega.");
  const licenses = [];
  for (const id of ids) licenses.push(await serializeLicense(await ensureLicense(purchase.transaction, id)));
  const clonerLicense = licenses.find((item) => item.product === "cloner") ?? licenses[0]!;
  const cfg = await config();
  const { data: prior } = await supabaseAdmin.from("payment_events").select("id").eq("event", "cloner.delivery_view").eq("transaction_id", transactionId).limit(1);
  if (!prior?.length) await recordEvent({ event: "cloner.delivery_view", status: "PAID", transactionId, amount: Number(purchase.transaction.amount), metadata: { product: CLONER_SLUG, smartBundle: !!meta(purchase.transaction.metadata).smart_bundle } });
  return {
    paid: true as const,
    status: "PAID",
    title: cfg.title,
    amount: Number(purchase.transaction.amount),
    currency: purchase.transaction.currency ?? "BRL",
    paidAt: purchase.transaction.paid_at,
    smartBundle: !!meta(purchase.transaction.metadata).smart_bundle,
    savings: Number(meta(purchase.transaction.metadata).discount_amount ?? 0),
    licenses,
    license: clonerLicense,
    file: { ready: !!cfg.zip_storage_path, name: cfg.zip_file_name, sizeBytes: cfg.zip_size_bytes },
  };
}

export async function issueClonerDownload(userId: string, transactionId: string) {
  const purchase = await paidClonerTransaction(userId, transactionId);
  if (!purchase.paid) throw new Error("O arquivo só é liberado após o pagamento confirmado.");
  const cfg = await config();
  if (!cfg.zip_storage_path || !cfg.zip_file_name) throw new Error("Arquivo da ferramenta indisponível. Fale com o suporte.");
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(cfg.zip_storage_path, SIGNED_DOWNLOAD_SECONDS, { download: cfg.zip_file_name });
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Não foi possível gerar o download.");
  await recordEvent({ event: "cloner.download", status: "PAID", transactionId, amount: Number(purchase.transaction.amount), metadata: { product: CLONER_SLUG, file: cfg.zip_file_name } });
  return { url: data.signedUrl, fileName: cfg.zip_file_name, expiresIn: SIGNED_DOWNLOAD_SECONDS };
}

export async function createClonerUploadUrl(input: { fileName: string }) {
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!/\.zip$/i.test(safe)) throw new Error("O arquivo precisa ser .zip.");
  const path = `cloner/${Date.now()}-${safe}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token, signedUrl: data.signedUrl };
}

export async function registerClonerZip(input: { storagePath: string; fileName: string; sizeBytes: number }, adminId: string) {
  if (!input.storagePath.startsWith("cloner/")) throw new Error("Caminho do arquivo inválido.");
  if (!/\.zip$/i.test(input.fileName)) throw new Error("O arquivo precisa ser .zip.");
  const old = await config();
  await setSetting(SETTING_KEY, { ...old, zip_storage_path: input.storagePath, zip_file_name: input.fileName, zip_size_bytes: input.sizeBytes });
  if (old.zip_storage_path && old.zip_storage_path !== input.storagePath) {
    try { await supabaseAdmin.storage.from(BUCKET).remove([old.zip_storage_path]); } catch { /* limpeza não bloqueia o novo upload */ }
  }
  await logAudit({ userId: adminId, action: "cloner.zip_uploaded", resource: "app_settings", metadata: { fileName: input.fileName, sizeBytes: input.sizeBytes } });
  return { ok: true, fileName: input.fileName, sizeBytes: input.sizeBytes };
}

async function fetchByIds(ids: string[]) {
  const rows: Record<string, any>[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabaseAdmin.from("transactions").select("id,user_id,plan_id,status,amount,paid_at,created_at,provider,method,metadata").in("id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Record<string, any>[]));
  }
  return rows;
}

async function clonerTransactions(ids: string[]) {
  const direct: Record<string, any>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from("transactions").select("id,user_id,plan_id,status,amount,paid_at,created_at,provider,method,metadata").in("plan_id", ids).order("created_at", { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    direct.push(...((data ?? []) as Record<string, any>[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  const { data: bundleEvents } = await supabaseAdmin.from("payment_events").select("transaction_id").eq("event", "smart.bundle_pix").not("transaction_id", "is", null);
  const bundleIds = [...new Set((bundleEvents ?? []).map((row: any) => row.transaction_id).filter(Boolean))] as string[];
  const bundles = bundleIds.length ? await fetchByIds(bundleIds) : [];
  const unique = new Map<string, any>();
  for (const row of [...direct, ...bundles]) unique.set(String((row as any).id), row);
  return [...unique.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function eventCount(event: string) {
  const { count } = await supabaseAdmin.from("payment_events").select("id", { count: "exact", head: true }).eq("event", event);
  return count ?? 0;
}

export async function getAdminCloner() {
  const cfg = await config();
  const plans = await ensureClonerPlans(cfg);
  const transactions = await clonerTransactions(plans.map((item) => item.id));
  const [views, shares, pixGenerated, downloads, offerShown, offerAccepted] = await Promise.all([
    eventCount("cloner.view"), eventCount("cloner.share"), eventCount("cloner.pix_generated"), eventCount("cloner.download"), eventCount("smart.offer_shown"), eventCount("smart.offer_accepted"),
  ]);
  const paid = transactions.filter((row) => String(row.status).toUpperCase() === "PAID" || !!row.paid_at);
  const bundles = paid.filter((row) => !!meta(row.metadata).smart_bundle);
  const comboCounts = new Map<string, number>();
  for (const row of bundles) { const key = String(meta(row.metadata).combo_key ?? "Combo inteligente"); comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1); }
  const topCombo = [...comboCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const userIds = [...new Set(transactions.map((row) => row.user_id).filter(Boolean))] as string[];
  const profiles = new Map<string, { email: string | null; name: string | null }>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await supabaseAdmin.from("profiles").select("id,email,name").in("id", userIds.slice(i, i + 200));
    for (const profile of data ?? []) profiles.set(profile.id, { email: profile.email, name: profile.name });
  }
  return {
    config: cfg,
    plans: plans.map(publicPlan),
    checkoutPath: "/clonagem",
    metrics: {
      views,
      shares,
      pixGenerated,
      paid: paid.length,
      revenue: paid.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      downloads,
      conversion: pixGenerated > 0 ? paid.length / pixGenerated * 100 : 0,
      offerShown,
      offerAccepted,
      offerAcceptance: offerShown > 0 ? offerAccepted / offerShown * 100 : 0,
      bundlePaid: bundles.length,
      upsellRevenue: bundles.reduce((sum, row) => sum + Number(meta(row.metadata).companion_final_price ?? 0), 0),
      discountsGranted: bundles.reduce((sum, row) => sum + Number(meta(row.metadata).discount_amount ?? 0), 0),
      topCombo: topCombo ? { key: topCombo[0], sales: topCombo[1] } : null,
    },
    recentSales: transactions.slice(0, 40).map((row) => ({ ...row, profile: row.user_id ? profiles.get(row.user_id) ?? null : null, smartBundle: !!meta(row.metadata).smart_bundle, comboKey: meta(row.metadata).combo_key ?? null })),
  };
}

export async function saveAdminCloner(input: { enabled: boolean; smartOffersEnabled: boolean; smartDiscountPercent: number; title: string; subtitle: string; description: string; shareText: string; plans: Array<{ id: string; price: number; active: boolean }> }, adminId: string) {
  const cfg = await config();
  const current = await ensureClonerPlans(cfg);
  if (input.enabled && !cfg.zip_storage_path) throw new Error("Envie o arquivo ZIP antes de ativar o checkout.");
  const ids = new Set(current.map((item) => item.id));
  for (const item of input.plans) {
    if (!ids.has(item.id)) throw new Error("Plano do Clonador inválido.");
    if (!Number.isFinite(item.price) || item.price <= 0) throw new Error("Todos os planos precisam ter preço maior que zero.");
    const { error } = await supabaseAdmin.from("plans").update({ price: money(item.price), active: !!input.enabled && !!item.active, updated_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) throw new Error(error.message);
  }
  const next: ClonerConfig = {
    ...cfg,
    enabled: !!input.enabled,
    smart_offers_enabled: !!input.smartOffersEnabled,
    smart_discount_percent: Math.min(50, Math.max(1, input.smartDiscountPercent)),
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    description: input.description.trim(),
    share_text: input.shareText.trim(),
  };
  await setSetting(SETTING_KEY, next);
  await logAudit({ userId: adminId, action: "cloner.checkout_updated", resource: "plans", metadata: { enabled: next.enabled, smartOffersEnabled: next.smart_offers_enabled, smartDiscountPercent: next.smart_discount_percent, plans: input.plans } });
  return { ok: true, enabled: next.enabled, smartOffersEnabled: next.smart_offers_enabled };
}
