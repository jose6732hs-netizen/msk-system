import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "./license.server";
import { getSetting, issueStandaloneLicense, setSetting } from "./commerce.server";
import { logAudit } from "./audit.server";

export const CLONER_SLUG = "page-cloner";
const SETTING_KEY = "page_cloner_checkout";
const BUCKET = "extension-builds";
const SIGNED_DOWNLOAD_SECONDS = 300;

export type ClonerConfig = {
  enabled: boolean;
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
  title: "MSK Clonador de Páginas",
  subtitle: "Clone páginas com rapidez e leve a estrutura para o seu projeto.",
  description: "Pagamento único via PIX. A licença e o arquivo ZIP são liberados somente após a confirmação do pagamento.",
  share_text: "Conheça o MSK Clonador de Páginas e libere sua licença pelo PIX.",
  zip_storage_path: null,
  zip_file_name: null,
  zip_size_bytes: null,
};

async function config() {
  const saved = await getSetting<Partial<ClonerConfig>>(SETTING_KEY, {});
  return { ...DEFAULT_CONFIG, ...(saved ?? {}) } as ClonerConfig;
}

async function plan() {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("id,name,slug,description,price,currency,active,is_lifetime,duration_label,duration_days,duration_value,duration_unit,max_devices,updated_at")
    .eq("slug", CLONER_SLUG)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function ensurePlan() {
  const existing = await plan();
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("plans")
    .insert({
      name: "MSK Clonador de Páginas",
      slug: CLONER_SLUG,
      description: DEFAULT_CONFIG.description,
      price: 0,
      currency: "BRL",
      active: false,
      is_lifetime: true,
      duration_label: "Vitalício",
      duration_value: 0,
      duration_unit: "lifetime",
      duration_days: null,
      max_devices: 1,
      max_activations: 3,
      allow_trial: false,
      auto_renew: false,
      features: { page_cloner: true, hidden_from_plans: true },
      highlights: ["Clonagem de páginas", "Licença individual", "Download após pagamento"],
      sort_order: 999,
    } as never)
    .select("id,name,slug,description,price,currency,active,is_lifetime,duration_label,duration_days,duration_value,duration_unit,max_devices,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getPublicClonerProduct() {
  const [cfg, row] = await Promise.all([config(), plan()]);
  return {
    enabled: !!cfg.enabled && !!row?.active && Number(row?.price ?? 0) > 0 && !!cfg.zip_storage_path,
    configured: !!row,
    title: cfg.title,
    subtitle: cfg.subtitle,
    description: cfg.description,
    shareText: cfg.share_text,
    planId: row?.id ?? null,
    price: Number(row?.price ?? 0),
    currency: row?.currency ?? "BRL",
    zipReady: !!cfg.zip_storage_path,
    zipFileName: cfg.zip_file_name,
    zipSizeBytes: cfg.zip_size_bytes,
  };
}

async function recordEvent(input: {
  event: string;
  status?: string;
  transactionId?: string | null;
  amount?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin
    .from("payment_events")
    .insert({
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

export async function createClonerCheckout(input: {
  userId: string;
  email: string;
  name: string;
  document: string;
  phone: string;
  affiliateCode?: string | null;
}) {
  const product = await getPublicClonerProduct();
  if (!product.planId || !product.configured) throw new Error("Checkout do clonador ainda não foi configurado.");
  if (!product.zipReady) throw new Error("O arquivo da ferramenta ainda não foi publicado pelo administrador.");
  if (!product.enabled) throw new Error("Checkout do clonador está indisponível no momento.");
  if (!(product.price > 0)) throw new Error("Defina um preço válido para o clonador no Super Admin.");

  const { createPixCheckout } = await import("./checkout.server");
  const result = await createPixCheckout({
    userId: input.userId,
    email: input.email,
    name: input.name,
    planId: product.planId,
    affiliateCode: input.affiliateCode ?? null,
    resellerCode: null,
    document: input.document,
    phone: input.phone,
  });

  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("metadata")
    .eq("id", result.transactionId)
    .maybeSingle();

  await supabaseAdmin
    .from("transactions")
    .update({
      metadata: {
        ...(((tx?.metadata ?? {}) as Record<string, unknown>)),
        product: CLONER_SLUG,
        delivery: "license+private_zip",
      },
    } as never)
    .eq("id", result.transactionId);

  await recordEvent({
    event: "cloner.pix_generated",
    status: "PENDING",
    transactionId: result.transactionId,
    amount: result.amount,
    metadata: { product: CLONER_SLUG },
  });

  return { ...result, productTitle: product.title };
}

async function paidClonerTransaction(userId: string, transactionId: string) {
  try {
    const { reconcileTransaction } = await import("./reconcile.server");
    await reconcileTransaction(transactionId);
  } catch {
    // O status local abaixo continua sendo a trava final.
  }

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .select("id,user_id,plan_id,status,paid_at,amount,currency,created_at,metadata")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tx) throw new Error("Compra não encontrada.");

  const clonerPlan = await plan();
  if (!clonerPlan || tx.plan_id !== clonerPlan.id) throw new Error("Esta compra não pertence ao Clonador de Páginas.");
  if (String(tx.status).toUpperCase() !== "PAID" || !tx.paid_at) {
    return { paid: false as const, transaction: tx };
  }
  return { paid: true as const, transaction: tx, clonerPlan };
}

async function ensureLicenseForPaidTransaction(tx: {
  id: string;
  user_id: string | null;
  plan_id: string | null;
}) {
  const { data: current, error } = await supabaseAdmin
    .from("licenses")
    .select("id,token_encrypted,token_preview,status,activated_at,expires_at,metadata,plans(name,is_lifetime,duration_label)")
    .eq("transaction_id", tx.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (current) return current;
  if (!tx.user_id || !tx.plan_id) throw new Error("Não foi possível vincular a licença à compra.");

  await issueStandaloneLicense({
    userId: tx.user_id,
    planId: tx.plan_id,
    type: "paid",
    transactionId: tx.id,
    maxDevices: 1,
  });

  const { data: created, error: createdError } = await supabaseAdmin
    .from("licenses")
    .select("id,token_encrypted,token_preview,status,activated_at,expires_at,metadata,plans(name,is_lifetime,duration_label)")
    .eq("transaction_id", tx.id)
    .maybeSingle();
  if (createdError) throw new Error(createdError.message);
  if (!created) throw new Error("Licença ainda não foi gerada. Tente novamente em alguns segundos.");
  return created;
}

export async function getClonerDelivery(userId: string, transactionId: string) {
  const purchase = await paidClonerTransaction(userId, transactionId);
  if (!purchase.paid) {
    return {
      paid: false as const,
      status: purchase.transaction.status,
      amount: Number(purchase.transaction.amount),
    };
  }

  const cfg = await config();
  const license = await ensureLicenseForPaidTransaction(purchase.transaction);
  if (!license.token_encrypted) throw new Error("Token da licença indisponível.");
  const token = await decryptToken(license.token_encrypted);
  if (!token) throw new Error("Não foi possível revelar a licença.");

  const { data: prior } = await supabaseAdmin
    .from("payment_events")
    .select("id")
    .eq("event", "cloner.delivery_view")
    .eq("transaction_id", transactionId)
    .limit(1);
  if (!prior?.length) {
    await recordEvent({
      event: "cloner.delivery_view",
      status: "PAID",
      transactionId,
      amount: Number(purchase.transaction.amount),
      metadata: { product: CLONER_SLUG },
    });
  }

  return {
    paid: true as const,
    status: "PAID",
    title: cfg.title,
    amount: Number(purchase.transaction.amount),
    currency: purchase.transaction.currency ?? "BRL",
    paidAt: purchase.transaction.paid_at,
    license: {
      id: license.id,
      token,
      preview: license.token_preview,
      status: license.status,
      activatedAt: license.activated_at,
      expiresAt: license.expires_at,
      planName: (license.plans as any)?.name ?? cfg.title,
      durationLabel: (license.plans as any)?.duration_label ?? null,
      isLifetime: !!(license.plans as any)?.is_lifetime,
      pendingDurationMs: Number(((license.metadata ?? {}) as Record<string, any>)["pending_duration_ms"] ?? 0) || null,
    },
    file: {
      ready: !!cfg.zip_storage_path,
      name: cfg.zip_file_name,
      sizeBytes: cfg.zip_size_bytes,
    },
  };
}

export async function issueClonerDownload(userId: string, transactionId: string) {
  const purchase = await paidClonerTransaction(userId, transactionId);
  if (!purchase.paid) throw new Error("O arquivo só é liberado após o pagamento confirmado.");
  const cfg = await config();
  if (!cfg.zip_storage_path || !cfg.zip_file_name) throw new Error("Arquivo da ferramenta indisponível. Fale com o suporte.");

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(cfg.zip_storage_path, SIGNED_DOWNLOAD_SECONDS, { download: cfg.zip_file_name });
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Não foi possível gerar o download.");

  await recordEvent({
    event: "cloner.download",
    status: "PAID",
    transactionId,
    amount: Number(purchase.transaction.amount),
    metadata: { product: CLONER_SLUG, file: cfg.zip_file_name },
  });

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

export async function registerClonerZip(
  input: { storagePath: string; fileName: string; sizeBytes: number },
  adminId: string,
) {
  if (!input.storagePath.startsWith("cloner/")) throw new Error("Caminho do arquivo inválido.");
  if (!/\.zip$/i.test(input.fileName)) throw new Error("O arquivo precisa ser .zip.");
  const old = await config();
  const next: ClonerConfig = {
    ...old,
    zip_storage_path: input.storagePath,
    zip_file_name: input.fileName,
    zip_size_bytes: input.sizeBytes,
  };
  await setSetting(SETTING_KEY, next);

  if (old.zip_storage_path && old.zip_storage_path !== input.storagePath) {
    await supabaseAdmin.storage.from(BUCKET).remove([old.zip_storage_path]).catch(() => undefined);
  }

  await logAudit({
    userId: adminId,
    action: "cloner.zip_uploaded",
    resource: "app_settings",
    metadata: { fileName: input.fileName, sizeBytes: input.sizeBytes },
  });
  return { ok: true, fileName: input.fileName, sizeBytes: input.sizeBytes };
}

async function fetchPlanTransactions(planId: string) {
  const rows: Record<string, any>[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("id,user_id,status,amount,paid_at,created_at,provider,method")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Record<string, any>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function eventCount(event: string) {
  const { count } = await supabaseAdmin
    .from("payment_events")
    .select("id", { count: "exact", head: true })
    .eq("event", event);
  return count ?? 0;
}

export async function getAdminCloner() {
  const [cfg, clonerPlan] = await Promise.all([config(), ensurePlan()]);
  const [transactions, views, shares, pixGenerated, downloads] = await Promise.all([
    fetchPlanTransactions(clonerPlan.id),
    eventCount("cloner.view"),
    eventCount("cloner.share"),
    eventCount("cloner.pix_generated"),
    eventCount("cloner.download"),
  ]);

  const paid = transactions.filter((t) => String(t.status).toUpperCase() === "PAID" || !!t.paid_at);
  const revenue = paid.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const userIds = [...new Set(transactions.map((t) => t.user_id).filter(Boolean))] as string[];
  const profiles = new Map<string, { email: string | null; name: string | null }>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await supabaseAdmin.from("profiles").select("id,email,name").in("id", userIds.slice(i, i + 200));
    for (const p of data ?? []) profiles.set(p.id, { email: p.email, name: p.name });
  }

  return {
    config: cfg,
    plan: clonerPlan,
    checkoutPath: "/clonagem",
    metrics: {
      views,
      shares,
      pixGenerated,
      paid: paid.length,
      revenue,
      downloads,
      conversion: pixGenerated > 0 ? (paid.length / pixGenerated) * 100 : 0,
    },
    recentSales: transactions.slice(0, 30).map((t) => ({
      ...t,
      profile: t.user_id ? profiles.get(t.user_id) ?? null : null,
    })),
  };
}

export async function saveAdminCloner(
  input: {
    enabled: boolean;
    title: string;
    subtitle: string;
    description: string;
    shareText: string;
    price: number;
  },
  adminId: string,
) {
  const current = await ensurePlan();
  const cfg = await config();
  const canEnable = input.enabled && input.price > 0 && !!cfg.zip_storage_path;
  if (input.enabled && !cfg.zip_storage_path) throw new Error("Envie o arquivo ZIP antes de ativar o checkout.");
  if (input.enabled && !(input.price > 0)) throw new Error("Informe um preço maior que zero antes de ativar.");

  const { error } = await supabaseAdmin
    .from("plans")
    .update({
      name: input.title.trim(),
      description: input.description.trim(),
      price: input.price,
      currency: "BRL",
      active: canEnable,
      is_lifetime: true,
      duration_label: "Vitalício",
      duration_value: 0,
      duration_unit: "lifetime",
      duration_days: null,
      max_devices: 1,
      allow_trial: false,
      auto_renew: false,
      features: { page_cloner: true, hidden_from_plans: true },
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", current.id);
  if (error) throw new Error(error.message);

  const nextConfig: ClonerConfig = {
    ...cfg,
    enabled: canEnable,
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    description: input.description.trim(),
    share_text: input.shareText.trim(),
  };
  await setSetting(SETTING_KEY, nextConfig);

  await logAudit({
    userId: adminId,
    action: "cloner.checkout_updated",
    resource: "plans",
    resourceId: current.id,
    metadata: { enabled: canEnable, price: input.price },
  });
  return { ok: true, enabled: canEnable };
}
