import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calculateCreditPrice } from "./credit-pricing";
import { hashValue } from "./license.server";
import { newIdentifier } from "./commerce.server";
import { logAudit } from "./audit.server";

function objectMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadCreditPurchaseOverview(userId: string) {
  const [{ data: profile }, { data: recentTrial }, { data: purchases }] = await Promise.all([
    supabaseAdmin.from("profiles").select("name,email,phone,document").eq("id", userId).maybeSingle(),
    supabaseAdmin
      .from("credit_trials")
      .select("id,status,quantity,created_at,available_again_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("available_again_at", new Date().toISOString())
      .order("available_again_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("transactions")
      .select("id,identifier,amount,status,method,created_at,paid_at,metadata")
      .eq("user_id", userId)
      .eq("purpose", "credit_purchase")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return {
    profile: profile ?? null,
    trial: recentTrial
      ? { available: false, nextAvailableAt: recentTrial.available_again_at }
      : { available: true, nextAvailableAt: null },
    purchases: (purchases ?? []).map((row) => {
      const metadata = objectMeta(row.metadata);
      return {
        id: row.id,
        identifier: row.identifier,
        amount: Number(row.amount),
        credits: Number(metadata["credit_quantity"] ?? 0),
        status: row.status,
        deliveryStatus: String(metadata["delivery_status"] ?? (row.paid_at ? "awaiting_key" : "awaiting_payment")),
        createdAt: row.created_at,
        paidAt: row.paid_at,
      };
    }),
  };
}

export async function claimCreditTrial(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name,email")
    .eq("id", userId)
    .maybeSingle();
  const name = String(profile?.name ?? "").trim();
  const email = String(profile?.email ?? "").trim().toLowerCase();
  if (!name || !email) throw new Error("Complete seu nome e e-mail no perfil antes de solicitar o teste.");
  const emailHash = await hashValue(email);
  const { data, error } = await supabaseAdmin.rpc("claim_credit_trial", {
    p_user_id: userId,
    p_name: name,
    p_email: email,
    p_email_hash: emailHash,
  });
  if (error) {
    if (error.message.includes("TRIAL_COOLDOWN")) {
      throw new Error("Seu teste grátis já foi liberado. Ele ficará disponível novamente após 24 horas.");
    }
    throw error;
  }
  await logAudit({ userId, action: "credit_trial.claimed", resource: "credit_trials", resourceId: data?.[0]?.trial_id ?? null });
  return { ok: true, credits: 4, nextAvailableAt: data?.[0]?.available_again_at ?? null };
}

export async function prepareCreditPurchase(userId: string, requestedQuantity: number) {
  const price = calculateCreditPrice(requestedQuantity);
  if (price.quantity !== requestedQuantity) throw new Error("Escolha uma quantidade válida em passos de 5 créditos.");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name,email,phone,document")
    .eq("id", userId)
    .maybeSingle();
  const name = String(profile?.name ?? "").trim();
  const email = String(profile?.email ?? "").trim();
  if (!name || !email) throw new Error("Complete seu nome e e-mail antes de gerar o PIX.");

  const identifier = newIdentifier("MSKC");
  const { data: transaction, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      identifier,
      user_id: userId,
      purpose: "credit_purchase",
      method: "PENDING",
      amount: price.total,
      currency: "BRL",
      status: "PENDING",
      metadata: {
        product: "msk_credits",
        credit_quantity: price.quantity,
        credit_unit_price: price.unitPrice,
        customer_name: name,
        customer_email: email,
        delivery_status: "awaiting_payment",
        manual_key_delivery: true,
      },
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  await logAudit({ userId, action: "credit_purchase.created", resource: "transactions", resourceId: transaction.id, metadata: price });
  return { transactionId: transaction.id, identifier, amount: price.total, ...price };
}

export async function listPendingCreditKeys() {
  const { data } = await supabaseAdmin
    .from("transactions")
    .select("id,user_id,identifier,amount,status,created_at,paid_at,metadata")
    .eq("purpose", "credit_purchase")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false });
  const rows = data ?? [];
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))] as string[];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id,name,email").in("id", userIds)
    : { data: [] };
  const byUser = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return rows.map((row) => ({ ...row, profile: row.user_id ? byUser.get(row.user_id) ?? null : null }));
}

export async function markCreditKeyDelivered(transactionId: string, adminId: string) {
  const { data: row } = await supabaseAdmin
    .from("transactions")
    .select("id,paid_at,metadata")
    .eq("id", transactionId)
    .eq("purpose", "credit_purchase")
    .maybeSingle();
  if (!row?.paid_at) throw new Error("O pagamento ainda não foi confirmado.");
  const metadata = objectMeta(row.metadata);
  const { error } = await supabaseAdmin
    .from("transactions")
    .update({ metadata: { ...metadata, delivery_status: "key_delivered", key_delivered_at: new Date().toISOString(), key_delivered_by: adminId }, updated_at: new Date().toISOString() } as never)
    .eq("id", transactionId);
  if (error) throw error;
  await logAudit({ userId: adminId, action: "credit_purchase.key_delivered", resource: "transactions", resourceId: transactionId });
  return { ok: true };
}