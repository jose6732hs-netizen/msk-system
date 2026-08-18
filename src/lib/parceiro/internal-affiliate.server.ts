import { supabaseAdmin } from "@/integrations/supabase/client.server";

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
import { logAudit } from "@/lib/audit.server";
import { sendNotification } from "@/lib/notifications.functions";

/**
 * Registra uma comissão internamente no sistema e atualiza a carteira do afiliado.
 * Fluxo: Transação paga -> Identifica Afiliado -> Calcula -> Registra -> Atualiza Saldo.
 */
export async function processInternalCommission(transactionId: string) {
  // 1. Buscar transação
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("*, profiles:user_id(id)")
    .eq("id", transactionId)
    .single();

  if (!tx || tx.status !== "PAID" || tx.commission_registered) return null;

  // 2. Identificar Afiliado (Prioridade: Transação -> Perfil do Usuário)
  let affiliateId = tx.affiliate_id ?? null;
  if (!affiliateId && tx.user_id) {
    const { data: ref } = await supabaseAdmin
      .from("affiliate_referrals")
      .select("affiliate_id")
      .eq("user_id", tx.user_id)
      .maybeSingle();
    affiliateId = ref?.affiliate_id ?? null;
  }

  if (!affiliateId) return null;

  // 3. Obter configurações do afiliado
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id, commission_rate, user_id, total_sales, total_commission, available_balance, pending_balance")
    .eq("id", affiliateId)
    .single();

  if (!affiliate) return null;

  // 4. Calcular comissão
  const grossAmount = Number(tx.amount);
  const percentage = Number(affiliate.commission_rate || 30);
  const commissionAmount = Math.round((grossAmount * percentage) / 100 * 100) / 100;

  if (commissionAmount <= 0) return null;

  // 5. Verificar idempotência
  const { data: existing } = await supabaseAdmin
    .from("affiliate_commissions")
    .select("id,status")
    .eq("transaction_id", transactionId)
    .eq("affiliate_id", affiliateId)
    .maybeSingle();
  if (existing && ["AVAILABLE", "APPROVED", "PAID"].includes(existing.status)) return existing.id;

  // 6. Obter carteira
  const { data: wallet } = await supabaseAdmin
    .from("affiliate_wallets")
    .select("id, available_balance, total_earned")
    .eq("affiliate_id", affiliateId)
    .single();

  if (!wallet) return null;

  // 7. Obter regras de liberação
  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "affiliate_config")
    .maybeSingle();
  const holdDays = Number((settings?.value as any)?.commission_hold_days ?? 0);
  const isImmediate = holdDays <= 0;

  // 8. Registrar Comissão e Atualizar Carteira (Operação Atômica via RPC ou Sequencial Segura)
  const availableAt = isImmediate ? new Date().toISOString() : new Date(Date.now() + holdDays * 86400000).toISOString();
  
  const commissionPayload = {
      affiliate_id: affiliateId,
      user_id: tx.user_id,
      transaction_id: tx.id,
      gross_amount: grossAmount,
      commission_percentage: percentage,
      commission_amount: commissionAmount,
      amount: commissionAmount, // legacia compatibility
      status: isImmediate ? 'AVAILABLE' : 'PENDING',
      available_at: availableAt,
      wallet_id: wallet.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  const commissionQuery = existing
    ? supabaseAdmin.from("affiliate_commissions").update(commissionPayload as never).eq("id", existing.id)
    : supabaseAdmin.from("affiliate_commissions").insert(commissionPayload as never);
  const { data: commission, error: cErr } = await commissionQuery.select("id").single();

  if (cErr) throw cErr;

  // Atualizar saldo consolidado usado pelo painel do afiliado.
  const balancePatch: any = {
    total_earned: Number(wallet.total_earned) + commissionAmount,
    updated_at: new Date().toISOString()
  };

  if (isImmediate) {
    balancePatch.available_balance = Number(wallet.available_balance) + commissionAmount;
  } else {
    // pending_balance column might need addition or we use available_at to compute
    const { data: currWallet } = await supabaseAdmin.from("affiliate_wallets").select("pending_balance").eq("id", wallet.id).single();
    balancePatch.pending_balance = Number(currWallet?.pending_balance ?? 0) + commissionAmount;
  }

  await supabaseAdmin.from("affiliate_wallets").update(balancePatch).eq("id", wallet.id);

  const affiliatePatch: Record<string, number> = {
    total_sales: Number((affiliate as any).total_sales ?? 0) + 1,
    total_commission: Number((affiliate as any).total_commission ?? 0) + commissionAmount,
  };
  if (isImmediate) {
    affiliatePatch["available_balance"] = Number((affiliate as any).available_balance ?? 0) + commissionAmount;
  } else {
    affiliatePatch["pending_balance"] = Number((affiliate as any).pending_balance ?? 0) + commissionAmount;
  }
  await supabaseAdmin.from("affiliates").update(affiliatePatch as never).eq("id", affiliateId);

  // Registrar Transação de Carteira
  await supabaseAdmin.from("affiliate_wallet_transactions").insert({
    affiliate_id: affiliateId,
    wallet_id: wallet.id,
    type: 'commission',
    amount: commissionAmount,
    balance_before: wallet.available_balance,
    balance_after: isImmediate ? balancePatch.available_balance : wallet.available_balance,
    payment_id: tx.id,
    commission_id: commission.id,
    description: `Comissão venda #${tx.identifier || tx.id}`,
    status: 'completed'
  } as never);

  // Marcar transação como processada
  await supabaseAdmin.from("transactions").update({ commission_registered: true }).eq("id", tx.id);

  // Notificar afiliado
  if (affiliate.user_id) {
    const { sendProfessionalNotification } = await import("@/lib/notification-service.server");
    await sendProfessionalNotification({
      userId: affiliate.user_id,
      type: "commission_earned",
      title: "Venda aprovada",
      body: `💚 Comissão recebida: ${brl(commissionAmount)}\n💵 Venda aprovada: ${brl(grossAmount)}\n🏦 Valor creditado na sua carteira`,
      link: "/parceiro",
      recipientRole: "affiliate",
      transactionId: tx.id,
      metadata: { grossAmount, commissionAmount, transactionId: tx.id }
    }).catch(e => console.error("Push Affiliate fail:", e));
  }

  await logAudit({
    userId: affiliate.user_id,
    action: "affiliate.commission_earned",
    resource: "affiliate_commissions",
    resourceId: commission.id,
    metadata: { amount: commissionAmount, transactionId: tx.id }
  });

  return commission.id;
}
