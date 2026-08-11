import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";

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
  let affiliateId = tx.affiliate_id;
  if (!affiliateId && tx.user_id) {
    const { data: ref } = await supabaseAdmin
      .from("affiliate_referrals")
      .select("affiliate_id")
      .eq("user_id", tx.user_id)
      .maybeSingle();
    affiliateId = ref?.affiliate_id;
  }

  if (!affiliateId) return null;

  // 3. Obter configurações do afiliado
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id, commission_rate, user_id")
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
    .select("id")
    .eq("transaction_id", transactionId)
    .eq("affiliate_id", affiliateId)
    .maybeSingle();
  if (existing) return existing.id;

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
  
  const { data: commission, error: cErr } = await supabaseAdmin
    .from("affiliate_commissions")
    .insert({
      affiliate_id: affiliateId,
      user_id: tx.user_id,
      transaction_id: tx.id,
      gross_amount: grossAmount,
      commission_percentage: percentage,
      commission_amount: commissionAmount,
      amount: commissionAmount, // legacia compatibility
      status: isImmediate ? 'AVAILABLE' : 'PENDING',
      available_at: availableAt,
      wallet_id: wallet.id
    } as never)
    .select("id")
    .single();

  if (cErr) throw cErr;

  // Atualizar Saldo da Carteira
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

  await logAudit({
    userId: affiliate.user_id,
    action: "affiliate.commission_earned",
    resource: "affiliate_commissions",
    resourceId: commission.id,
    metadata: { amount: commissionAmount, transactionId: tx.id }
  });

  return commission.id;
}
