/**
 * Regras de negócio de vendas: afiliados, revendedores, comissões,
 * trials e emissão de licença após pagamento confirmado.
 * Somente servidor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptToken, generateLicenseToken, hashToken, logEvent, maskToken } from "./license.server";
import { logAudit } from "./audit.server";
import { computeExpiry, createInvoice } from "./financial.server";
import { licenseRoleFromSlug } from "./license-purpose";

function objectMeta(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function lineForPlan(metadata: Record<string, any>, planId: string) {
  const lines = Array.isArray(metadata["line_items"])
    ? metadata["line_items"]
    : Array.isArray(metadata["lines"])
      ? metadata["lines"]
      : [];
  return lines.find((line: any) => String(line?.planId ?? line?.plan_id ?? "") === planId) ?? null;
}

async function purchaseSnapshot(transactionId: string | null | undefined, planId: string) {
  if (!transactionId) return null;
  const { data } = await supabaseAdmin
    .from("transactions")
    .select("metadata")
    .eq("id", transactionId)
    .maybeSingle();
  const metadata = objectMeta(data?.metadata);
  const line = lineForPlan(metadata, planId);
  if (!line) return null;
  const frozen = objectMeta(line?.snapshot);
  return {
    ...frozen,
    name: frozen["name"] ?? line?.name ?? null,
    slug: frozen["slug"] ?? line?.slug ?? null,
    soldPrice: frozen["soldPrice"] ?? line?.finalPrice ?? line?.unitPrice ?? null,
    role: frozen["role"] ?? line?.role ?? null,
    origin: line?.origin ?? null,
  } as Record<string, any>;
}

function exactChargedAmount(tx: { amount: unknown; metadata?: unknown }) {
  const metadata = objectMeta(tx.metadata);
  const cardTotal = nullableNumber(metadata["card_charged_total"]);
  return cardTotal !== null && cardTotal > 0 ? cardTotal : Number(tx.amount);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key, value: value as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

function randomCode(prefix: string) {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${prefix}${s}`;
}

export async function ensureAffiliate(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from("affiliates")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing;

  const commissions = await getSetting<{ affiliate: number }>("commissions", { affiliate: 30 });
  const { data, error } = await supabaseAdmin
    .from("affiliates")
    .insert({
      user_id: userId,
      code: randomCode("AF"),
      commission_rate: commissions.affiliate,
      status: "pending",
      verification_status: "PENDING",
    })
    .select("*")
    .single();
  if (error) throw error;
  await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "affiliate" } as never, {
    onConflict: "user_id,role",
  });
  await logAudit({ userId, action: "affiliate.created", resource: "affiliates", resourceId: data.id });
  return data;
}

export async function ensureReseller(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from("resellers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing;

  const tiers = await getSetting<{ slug: string; trials: number; discount: number }[]>(
    "reseller_tiers",
    [{ slug: "comum", trials: 10, discount: 0 }],
  );
  const base = tiers[0]!;
  const { data, error } = await supabaseAdmin
    .from("resellers")
    .insert({
      user_id: userId,
      code: randomCode("RV"),
      tier: base.slug,
      trials_available: base.trials,
      discount_rate: base.discount,
    } as any)
    .select("*")
    .single();
  if (error) throw error;
  await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "reseller" } as never, {
    onConflict: "user_id,role",
  });
  await logAudit({ userId, action: "reseller.created", resource: "resellers", resourceId: data.id });
  return data;
}

export async function findAffiliateByCode(code?: string | null) {
  if (!code) return null;
  const { data } = await supabaseAdmin
    .from("affiliates")
    .select("id,user_id,commission_rate,status")
    .eq("code", code.toUpperCase())
    .eq("status", "active")
    .maybeSingle();
  return data;
}

export async function findResellerByCode(code?: string | null) {
  if (!code) return null;
  const { data } = await supabaseAdmin
    .from("resellers")
    .select("id,user_id,tier,discount_rate,commission_rate,status")
    .eq("code", code.toUpperCase())
    .eq("status", "active")
    .maybeSingle();
  return data;
}

/** Emite licença usando o snapshot imutável da compra quando houver transação. */
export async function issueStandaloneLicense(input: {
  userId: string | null;
  planId: string;
  durationDays?: number | null;
  durationMinutes?: number | null;
  type?: string;
  resellerId?: string | null;
  transactionId?: string | null;
  maxDevices?: number | null;
  expiresAtOverride?: string | null;
  extraMetadata?: Record<string, unknown> | null;
}) {
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", input.planId)
    .maybeSingle();
  if (!plan) throw new Error("Plano não encontrado");

  const frozen = await purchaseSnapshot(input.transactionId, input.planId);
  const frozenFeatures = objectMeta(frozen?.["features"]);
  const frozenLifetime = frozen?.["isLifetime"];
  const isLifetime = typeof frozenLifetime === "boolean" ? frozenLifetime : Boolean(plan.is_lifetime);
  const frozenDurationValue = nullableNumber(frozen?.["durationValue"]);
  const frozenDurationDays = nullableNumber(frozen?.["durationDays"]);
  const frozenDurationUnit = frozen?.["durationUnit"] ? String(frozen["durationUnit"]) : null;
  const frozenMaxDevices = nullableNumber(frozen?.["maxDevices"]);
  const snapshotName = frozen?.["name"] ?? plan.name;
  const snapshotSlug = String(frozen?.["slug"] ?? plan.slug ?? "");
  const snapshotRole = String(frozen?.["role"] ?? licenseRoleFromSlug(snapshotSlug));

  const now = new Date();
  let expires: string | null = null;

  if (input.expiresAtOverride !== undefined && input.expiresAtOverride !== null) {
    expires = input.expiresAtOverride;
  } else if (input.durationMinutes) {
    expires = new Date(now.getTime() + input.durationMinutes * 60000).toISOString();
  } else if (input.durationDays) {
    expires = new Date(now.getTime() + input.durationDays * 86400000).toISOString();
  } else if (!isLifetime) {
    const rawUnit = String(
      frozenDurationUnit ?? (frozenDurationDays !== null ? "days" : (plan as any).duration_unit || "days"),
    ).toLowerCase();
    const unit = ({
      minute: "minutes",
      hour: "hours",
      day: "days",
      week: "weeks",
      month: "months",
    } as Record<string, string>)[rawUnit] ?? rawUnit;
    const value =
      frozenDurationValue ??
      frozenDurationDays ??
      nullableNumber((plan as any).duration_value) ??
      nullableNumber(plan.duration_days) ??
      30;
    expires = computeExpiry(unit, value, now);
  }

  // Produtos de entrega digital (ex.: ChatGPT Plus) começam a validade assim que o pagamento é aprovado.
  const isInstant = input.type === "trial" || input.type === "test" || snapshotRole === "delivery";
  const pendingDurationMs = !isInstant && expires ? new Date(expires).getTime() - now.getTime() : null;
  if (pendingDurationMs !== null) expires = null;

  const snapshotSoldPrice = nullableNumber(frozen?.["soldPrice"]) ?? Number(plan.price);
  const snapshotListPrice = nullableNumber(frozen?.["listPrice"]) ?? Number(plan.price);
  const snapshotCurrency = String(frozen?.["currency"] ?? plan.currency ?? "BRL");
  const snapshotDurationLabel = frozen?.["durationLabel"] ?? plan.duration_label ?? null;
  const snapshotDurationDays = frozenDurationDays ?? nullableNumber(plan.duration_days);
  const snapshotDurationValue = frozenDurationValue ?? nullableNumber((plan as any).duration_value);
  const snapshotDurationUnit = frozenDurationUnit ?? (plan as any).duration_unit ?? null;
  const snapshotFeatures = Object.keys(frozenFeatures).length ? frozenFeatures : objectMeta(plan.features);
  const maxDevices = input.maxDevices ?? frozenMaxDevices ?? nullableNumber(plan.max_devices);
  const delivery = objectMeta(snapshotFeatures["delivery"]);
  const deliveryMethod = ["panel", "email", "panel_email", "email_link"].includes(String(delivery["method"]))
    ? String(delivery["method"])
    : "panel_email";
  const deliveryLink = String(delivery["link"] ?? "").trim();
  const deliveryInstructions = String(delivery["instructions"] ?? "").trim();

  const token = generateLicenseToken();
  const { data, error } = await supabaseAdmin
    .from("licenses")
    .insert({
      user_id: input.userId,
      plan_id: plan.id,
      token_hash: await hashToken(token),
      token_encrypted: await encryptToken(token),
      token_last4: token.slice(-4),
      token_preview: maskToken(token),
      status: isInstant ? "active" : "inactive",
      type: input.type ?? "paid",
      activated_at: isInstant ? now.toISOString() : null,
      starts_at: now.toISOString(),
      expires_at: expires,
      max_devices: maxDevices,
      reseller_id: input.resellerId ?? null,
      transaction_id: input.transactionId ?? null,
      metadata: {
        plan_name_snapshot: snapshotName,
        plan_price_snapshot: snapshotSoldPrice,
        plan_list_price_snapshot: snapshotListPrice,
        plan_currency_snapshot: snapshotCurrency,
        plan_duration_label_snapshot: snapshotDurationLabel,
        plan_duration_snapshot: snapshotDurationDays,
        plan_duration_value_snapshot: snapshotDurationValue,
        plan_duration_unit_snapshot: snapshotDurationUnit,
        plan_is_lifetime_snapshot: isLifetime,
        plan_max_devices_snapshot: maxDevices,
        plan_slug_snapshot: snapshotSlug,
        features_snapshot: snapshotFeatures,
        license_role: snapshotRole,
        delivery_method: deliveryMethod,
        delivery_link: deliveryLink,
        delivery_instructions: deliveryInstructions,
        ...(frozen?.["origin"] ? { item_origin: String(frozen["origin"]) } : {}),
        ...(snapshotSoldPrice !== null ? { item_unit_price: snapshotSoldPrice } : {}),
        ...(pendingDurationMs !== null ? { pending_duration_ms: pendingDurationMs } : {}),
        ...(input.extraMetadata ?? {}),
      },
    } as never)
    .select("id")
    .single();

  if (error) throw error;

  await logEvent({
    license_id: data.id,
    user_id: input.userId,
    event_type: "license_created",
    metadata: { plan: snapshotSlug, type: input.type ?? "paid" },
  });
  return { licenseId: data.id, token };
}

/** Concede trial gratuito respeitando limites globais. */
export async function grantTrial(input: { userId: string; planId?: string | null; resellerId?: string | null }) {
  const cfg = await getSetting<{ duration_minutes: number; cooldown_hours: number; max_per_user: number }>(
    "trial",
    { duration_minutes: 15, cooldown_hours: 24, max_per_user: 1 },
  );

  const { data: previous } = await supabaseAdmin
    .from("licenses")
    .select("id,created_at")
    .eq("user_id", input.userId)
    .eq("type", "trial")
    .order("created_at", { ascending: false });

  const used = previous?.length ?? 0;
  if (used >= cfg.max_per_user) throw new Error("Você já utilizou o teste gratuito disponível.");
  const last = previous?.[0]?.created_at;
  if (last && Date.now() - new Date(last).getTime() < cfg.cooldown_hours * 3600000) {
    throw new Error("Aguarde o período de espera para solicitar um novo teste gratuito.");
  }

  let planId = input.planId ?? null;
  if (!planId) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    planId = plan?.id ?? null;
  }
  if (!planId && !input.planId) throw new Error("Nenhum plano disponível para o teste");

  if (input.resellerId) {
    const { data: reseller } = await supabaseAdmin
      .from("resellers")
      .select("id,trials_available,trials_used")
      .eq("id", input.resellerId)
      .maybeSingle();
    if (!reseller || reseller.trials_available <= 0) throw new Error("Revendedor sem trials disponíveis");
    await supabaseAdmin
      .from("resellers")
      .update({
        trials_available: reseller.trials_available - 1,
        trials_used: reseller.trials_used + 1,
      })
      .eq("id", reseller.id);
  }

  const result = await issueStandaloneLicense({
    userId: input.userId,
    planId: planId!,
    durationMinutes: cfg.duration_minutes,
    type: "trial",
    resellerId: input.resellerId ?? null,
    maxDevices: 1,
  });
  await supabaseAdmin.from("trials").insert({
    user_id: input.userId,
    reseller_id: input.resellerId ?? null,
    license_id: result.licenseId,
    expires_at: new Date(Date.now() + cfg.duration_minutes * 60000).toISOString(),
  } as never);
  await logAudit({
    userId: input.userId,
    action: "trial.granted",
    resource: "licenses",
    resourceId: result.licenseId,
  });
  return result;
}

async function finalizeIssuedLicense(input: {
  userId: string;
  transactionId: string;
  planId: string;
  quantity: number;
  source: "purchase" | "subscription";
  issued: { licenseId: string; token: string };
}) {
  const { signData } = await import("./license.server");
  const signature = await signData(
    JSON.stringify({
      licenseId: input.issued.licenseId,
      token: input.issued.token,
      userId: input.userId,
    }),
  );
  const { data: licenseSnapshot } = await supabaseAdmin
    .from("licenses")
    .select("metadata,expires_at")
    .eq("id", input.issued.licenseId)
    .maybeSingle();
  await supabaseAdmin
    .from("licenses")
    .update({
      metadata: { ...((licenseSnapshot?.metadata as Record<string, unknown> | null) ?? {}), signature },
    } as any)
    .eq("id", input.issued.licenseId);

  await supabaseAdmin.from("token_allowances").insert({
    user_id: input.userId,
    plan_id: input.planId,
    transaction_id: input.transactionId,
    source: input.source,
    total: Math.max(1, input.quantity),
    used: 1,
    period_end: licenseSnapshot?.expires_at ?? null,
  } as never);
}

/** Processa uma transação paga: comissões, saldo de revenda e todas as entregas do carrinho. */
export async function settlePaidTransaction(transactionId: string) {
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) throw new Error("Transação não encontrada");
  if (tx.status === "PAID" && tx.paid_at) return { alreadySettled: true };

  await supabaseAdmin
    .from("transactions")
    .update({ status: "PAID", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", tx.id);

  const amount = Number(tx.amount);
  const chargedAmount = exactChargedAmount(tx);

  if (tx.purpose === "deposit" && tx.reseller_id) {
    const { data: reseller } = await supabaseAdmin
      .from("resellers")
      .select("id,available_balance,total_deposited")
      .eq("id", tx.reseller_id)
      .maybeSingle();
    if (reseller) {
      await supabaseAdmin
        .from("resellers")
        .update({
          available_balance: Number(reseller.available_balance) + amount,
          total_deposited: Number(reseller.total_deposited) + amount,
        })
        .eq("id", reseller.id);
      await supabaseAdmin
        .from("reseller_deposits")
        .update({ status: "CREDITED", credited_at: new Date().toISOString() })
        .eq("transaction_id", tx.id);
      await applyTierUpgrade(reseller.id);
    }
    return { deposit: true };
  }

  {
    const { affiliateForUser, markReferralConverted, recordAffiliateEvent } = await import("./affiliate.server");
    const affiliateId = tx.affiliate_id ?? (tx.user_id ? await affiliateForUser(tx.user_id) : null);
    if (affiliateId && tx.purpose !== "deposit" && !tx.affiliate_id) {
      await supabaseAdmin.from("transactions").update({ affiliate_id: affiliateId }).eq("id", tx.id);
    }
    if (tx.user_id) {
      await markReferralConverted(tx.user_id);
      await recordAffiliateEvent({
        affiliateId,
        userId: tx.user_id,
        eventType: "conversion_confirmed",
        resourceId: tx.id,
      });
    }
  }

  if (tx.reseller_id && tx.purpose === "purchase") {
    const { data: reseller } = await supabaseAdmin
      .from("resellers")
      .select("id,available_balance,commission_rate")
      .eq("id", tx.reseller_id)
      .maybeSingle();
    if (reseller) {
      const commission = Math.round(amount * Number(reseller.commission_rate)) / 100;
      await supabaseAdmin
        .from("resellers")
        .update({ available_balance: Number(reseller.available_balance) + commission })
        .eq("id", reseller.id);
    }
  }

  let licenseId: string | null = null;
  if (tx.user_id && (tx.purpose === "purchase" || tx.purpose === "subscription")) {
    const source = tx.purpose === "subscription" ? "subscription" : "purchase";
    const metadata = objectMeta(tx.metadata);
    const lines = Array.isArray(metadata["line_items"]) ? metadata["line_items"] : [];

    if (lines.length) {
      // Carrinho/checkout combinado: cada produto pago recebe sua própria licença/entrega.
      for (const rawLine of lines) {
        const line = objectMeta(rawLine);
        const planId = String(line["planId"] ?? line["plan_id"] ?? "");
        if (!planId) continue;
        const quantity = Math.max(1, Number(line["quantity"] ?? 1) || 1);
        const issued = await issueStandaloneLicense({
          userId: tx.user_id,
          planId,
          type: source,
          transactionId: tx.id,
          resellerId: tx.reseller_id,
          extraMetadata: {
            item_label: String(line["name"] ?? "Produto MSK"),
            item_origin: String(line["origin"] ?? "cart"),
          },
        });
        if (!licenseId) licenseId = issued.licenseId;
        await finalizeIssuedLicense({
          userId: tx.user_id,
          transactionId: tx.id,
          planId,
          quantity,
          source,
          issued,
        });
      }
    } else if (tx.plan_id) {
      const quantity = Math.max(1, Number(metadata["quantity"] ?? 1) || 1);
      const issued = await issueStandaloneLicense({
        userId: tx.user_id,
        planId: tx.plan_id,
        type: source,
        transactionId: tx.id,
        resellerId: tx.reseller_id,
      });
      licenseId = issued.licenseId;
      await finalizeIssuedLicense({
        userId: tx.user_id,
        transactionId: tx.id,
        planId: tx.plan_id,
        quantity,
        source,
        issued,
      });
    }

    if (tx.subscription_id) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", tx.subscription_id);
    }
  }

  if (tx.user_id) {
    try {
      const { sendProfessionalNotification } = await import("./notification-service.server");
      await sendProfessionalNotification({
        userId: tx.user_id,
        type: "pix_approved",
        title: "Pagamento Confirmado",
        body: `Seu pagamento de R$ ${chargedAmount.toFixed(2)} foi processado com sucesso. Sua entrega já está no painel.`,
        link: "/painel",
        transactionId: tx.id,
      });
    } catch (e) {
      console.error("[settle] notificação de pagamento falhou:", (e as Error).message);
    }
  }

  await createInvoice({
    transactionId: tx.id,
    userId: tx.user_id,
    subscriptionId: tx.subscription_id,
    licenseId,
    amount: chargedAmount,
    currency: tx.currency ?? "BRL",
    method: tx.method,
    externalId: tx.provider_transaction_id,
    metadata: { purpose: tx.purpose, base_amount: amount },
  });

  await logAudit({
    userId: tx.user_id,
    action: "transaction.paid",
    resource: "transactions",
    resourceId: tx.id,
    metadata: { amount: chargedAmount, baseAmount: amount, purpose: tx.purpose },
  });
  return { settled: true };
}

/** Promove o revendedor de nível conforme o total depositado. */
export async function applyTierUpgrade(resellerId: string) {
  const tiers = await getSetting<
    { slug: string; name: string; trials: number; min_deposit: number; discount: number }[]
  >("reseller_tiers", []);
  const { data: reseller } = await supabaseAdmin
    .from("resellers")
    .select("id,tier,total_deposited,trials_available")
    .eq("id", resellerId)
    .maybeSingle();
  if (!reseller) return;

  const eligible = tiers
    .filter((t) => Number(reseller.total_deposited) >= Number(t.min_deposit))
    .sort((a, b) => Number(b.min_deposit) - Number(a.min_deposit))[0];
  if (!eligible || eligible.slug === reseller.tier) return;

  await supabaseAdmin
    .from("resellers")
    .update({
      tier: eligible.slug,
      discount_rate: eligible.discount,
      trials_available: Math.max(reseller.trials_available, eligible.trials),
    })
    .eq("id", reseller.id);
  await logAudit({
    action: "reseller.tier_upgraded",
    resource: "resellers",
    resourceId: reseller.id,
    metadata: { from: reseller.tier, to: eligible.slug },
  });
}

export function newIdentifier(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`.toUpperCase();
}
