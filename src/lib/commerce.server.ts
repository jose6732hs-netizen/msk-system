/**
 * Regras de negócio de vendas: afiliados, revendedores, comissões,
 * trials e emissão de licença após pagamento confirmado.
 * Somente servidor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptToken, generateLicenseToken, hashToken, logEvent, maskToken } from "./license.server";
import { logAudit } from "./audit.server";
import { computeExpiry, createInvoice } from "./financial.server";

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

  const commissions = await getSetting<{ affiliate: number }>("commissions", { affiliate: 60 });
  const { data, error } = await supabaseAdmin
    .from("affiliates")
    .insert({ user_id: userId, code: randomCode("AF"), commission_rate: commissions.affiliate })
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

/** Emite licença avulsa (trial, revenda ou teste sem usuário). */
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
}) {
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", input.planId)
    .maybeSingle();
  if (!plan) throw new Error("Plano não encontrado");

  const now = new Date();
  let expires: string | null = null;
  if (input.expiresAtOverride !== undefined && input.expiresAtOverride !== null)
    expires = input.expiresAtOverride;
  else if (input.durationMinutes) expires = new Date(now.getTime() + input.durationMinutes * 60000).toISOString();
  else if (input.durationDays) expires = new Date(now.getTime() + input.durationDays * 86400000).toISOString();
  else if (!plan.is_lifetime)
    expires = computeExpiry(
      (plan as { duration_unit?: string }).duration_unit ?? "days",
      Number((plan as { duration_value?: number }).duration_value ?? plan.duration_days ?? 30),
      now,
    );

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
      status: input.type === "trial" || input.type === "test" ? "active" : "inactive",
      type: input.type ?? "paid",
      activated_at: input.type === "trial" || input.type === "test" ? now.toISOString() : null,
      starts_at: now.toISOString(),
      expires_at: expires,
      max_devices: input.maxDevices ?? plan.max_devices,
      
      reseller_id: input.resellerId ?? null,
      transaction_id: input.transactionId ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw error;

  await logEvent({
    license_id: data.id,
    user_id: input.userId,
    event_type: "license_created",
    metadata: { plan: plan.slug, type: input.type ?? "paid" },
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
    throw new Error("Aguarde o período de espera para solicitar um novo teste.");
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
    planId,
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
  await logAudit({ userId: input.userId, action: "trial.granted", resource: "licenses", resourceId: result.licenseId });
  return result;
}

/** Processa uma transação paga: comissões, saldo de revenda e licença. */
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

  // Depósito de revendedor: credita saldo.
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

  // Comissão de afiliado (calculada e aprovada no servidor).
  {
    const { approveCommissionForTransaction, affiliateForUser, markReferralConverted, recordAffiliateEvent } = await import(
      "./affiliate.server"
    );
    const { sendNotification } = await import("./notifications.functions");
    
    const affiliateId = tx.affiliate_id ?? (tx.user_id ? await affiliateForUser(tx.user_id) : null);
    if (affiliateId && tx.purpose !== "deposit") {
      if (!tx.affiliate_id) {
        await supabaseAdmin.from("transactions").update({ affiliate_id: affiliateId }).eq("id", tx.id);
      }
      const commissionId = await approveCommissionForTransaction({
        id: tx.id,
        affiliate_id: affiliateId,
        plan_id: tx.plan_id,
        amount,
        user_id: tx.user_id,
      });

      // Notificar afiliado sobre a venda
      const { data: affProfile } = await supabaseAdmin.from("affiliates").select("user_id").eq("id", affiliateId).single();
      if (affProfile?.user_id && commissionId) {
        const { data: comm } = await supabaseAdmin.from("affiliate_commissions").select("amount").eq("id", commissionId).single();
        if (comm) {
          await (sendNotification as any)({
            data: {
              title: "Nova Venda!",
              body: `Você recebeu uma comissão de R$ ${Number(comm.amount).toFixed(2)}.`,
              emoji: "💰",
              userIds: [affProfile.user_id],
              link: "/parceiros"
            },
            context: { supabase: supabaseAdmin, userId: "system" }
          });
        }
      }
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

  // Comissão de revendedor sobre venda indicada.
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

  // Licença do comprador.
  let licenseId: string | null = null;
  if (tx.user_id && tx.plan_id && (tx.purpose === "purchase" || tx.purpose === "subscription")) {
    const issued = await issueStandaloneLicense({
      userId: tx.user_id,
      planId: tx.plan_id,
      type: tx.purpose === "subscription" ? "subscription" : "paid",
      transactionId: tx.id,
      resellerId: tx.reseller_id,
    });
    licenseId = issued.licenseId;

    // Assinar os dados da licença para entrega segura
    const { signData } = await import("./license.server");
    const signature = await signData(JSON.stringify({ 
      licenseId: issued.licenseId, 
      token: issued.token,
      userId: tx.user_id 
    }));
    
    // Podemos armazenar a assinatura ou enviá-la no log
    await supabaseAdmin.from("licenses").update({ 
      metadata: { signature } 
    } as any).eq("id", issued.licenseId);


    // Saldo de tokens do tenant conforme a quantidade adquirida (1 já emitido acima).
    const quantity = Math.max(
      1,
      Number((tx.metadata as Record<string, unknown> | null)?.["quantity"] ?? 1) || 1,
    );
    const { data: issuedLicense } = await supabaseAdmin
      .from("licenses")
      .select("expires_at")
      .eq("id", issued.licenseId)
      .maybeSingle();
    await supabaseAdmin.from("token_allowances").insert({
      user_id: tx.user_id,
      plan_id: tx.plan_id,
      transaction_id: tx.id,
      source: tx.purpose === "subscription" ? "subscription" : "purchase",
      total: quantity,
      used: 1,
      period_end: issuedLicense?.expires_at ?? null,
    } as never);

    if (tx.subscription_id) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", tx.subscription_id);
    }
  }

  // Fatura de toda transação confirmada.
  if (tx.user_id) {
    const { sendNotification } = await import("./notifications.functions");
    await (sendNotification as any)({
      data: {
        title: "Pagamento Confirmado",
        body: `Seu pagamento de R$ ${amount.toFixed(2)} foi processado com sucesso. Aproveite seu acesso!`,
        emoji: "✅",
        userIds: [tx.user_id],
        link: "/painel"
      },
      context: { supabase: supabaseAdmin, userId: "system" }
    });
  }
  
  await createInvoice({
    transactionId: tx.id,
    userId: tx.user_id,
    subscriptionId: tx.subscription_id,
    licenseId,
    amount,
    currency: tx.currency ?? "BRL",
    method: tx.method,
    externalId: tx.provider_transaction_id,
    metadata: { purpose: tx.purpose },
  });

  await logAudit({
    userId: tx.user_id,
    action: "transaction.paid",
    resource: "transactions",
    resourceId: tx.id,
    metadata: { amount, purpose: tx.purpose },
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