import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "../audit.server";

/** Salva a senha de saque (apenas se não existir uma). */
export async function setWithdrawalPassword(userId: string, passwordHash: string) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id, withdrawal_password_hash")
    .eq("user_id", userId)
    .single();

  if (!affiliate) throw new Error("Conta de afiliado não encontrada.");

  const { error } = await supabaseAdmin
    .from("affiliates")
    .update({ withdrawal_password_hash: passwordHash } as never)
    .eq("id", affiliate.id);

  if (error) throw error;

  await logAudit({
    userId,
    action: "affiliate.withdrawal_password_set",
    resource: "affiliates",
    resourceId: affiliate.id
  });

  return { ok: true };
}

/** Salva/Atualiza a chave PIX do afiliado. */
export async function updatePixKey(userId: string, input: { type: string; key: string }) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!affiliate) throw new Error("Conta de afiliado não encontrada.");

  const { error } = await supabaseAdmin
    .from("affiliates")
    .update({ 
      pix_key_type: input.type,
      pix_key: input.key 
    } as never)
    .eq("id", affiliate.id);

  if (error) throw error;

  await logAudit({
    userId,
    action: "affiliate.pix_key_updated",
    resource: "affiliates",
    resourceId: affiliate.id,
    metadata: { type: input.type }
  });

  return { ok: true };
}

const MAX_ATTEMPTS = 3;

/** Solicita um saque usando o novo sistema de carteira interna. */
export async function requestWithdrawal(userId: string, input: { amount: number; passwordHash: string }) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select(
      "id, withdrawal_password_hash, pix_key, pix_key_type, status, withdrawal_attempts, withdrawal_blocked_at",
    )
    .eq("user_id", userId)
    .single();

  if (!affiliate) throw new Error("Conta de afiliado não encontrada.");
  if (affiliate.status !== "active") throw new Error("Sua conta está bloqueada ou inativa.");
  if ((affiliate as any).withdrawal_blocked_at)
    throw new Error("Saques bloqueados por segurança. Fale com o suporte para liberar.");
  if (!affiliate.withdrawal_password_hash) throw new Error("Defina uma senha de saque primeiro.");

  // Validação de senha
  if (affiliate.withdrawal_password_hash !== input.passwordHash) {
    const attempts = Number((affiliate as any).withdrawal_attempts ?? 0) + 1;
    const blocked = attempts >= MAX_ATTEMPTS;
    await supabaseAdmin
      .from("affiliates")
      .update({
        withdrawal_attempts: attempts,
        ...(blocked ? { withdrawal_blocked_at: new Date().toISOString() } : {}),
      } as never)
      .eq("id", affiliate.id);
    
    throw new Error(
      blocked
        ? "Senha incorreta 3 vezes. Saques bloqueados — fale com o suporte."
        : `Senha de saque incorreta. Tentativa ${attempts} de ${MAX_ATTEMPTS}.`,
    );
  }

  if (!affiliate.pix_key) throw new Error("Cadastre uma chave PIX para receber.");

  // 1. Obter carteira interna
  const { data: wallet } = await supabaseAdmin
    .from("affiliate_wallets")
    .select("id, available_balance")
    .eq("affiliate_id", affiliate.id)
    .single();

  if (!wallet) throw new Error("Carteira não encontrada.");
  
  const balance = Number(wallet.available_balance);
  if (input.amount < MIN_WITHDRAWAL) throw new Error(`O valor mínimo para saque é R$ ${MIN_WITHDRAWAL},00.`);
  if (balance < input.amount) throw new Error("Saldo insuficiente.");

  // 2. Registrar saque (Nova Tabela)
  const { data: withdrawal, error: wError } = await supabaseAdmin
    .from("affiliate_withdrawals")
    .insert({
      affiliate_id: affiliate.id,
      wallet_id: wallet.id,
      amount: input.amount,
      status: "pending",
      pix_key: affiliate.pix_key,
      pix_key_type: affiliate.pix_key_type,
    } as never)
    .select("id")
    .single();

  if (wError) throw wError;

  // 3. Deduzir saldo da carteira
  const nextBalance = balance - input.amount;
  await supabaseAdmin
    .from("affiliate_wallets")
    .update({ available_balance: nextBalance } as never)
    .eq("id", wallet.id);

  // 4. Registrar no extrato (Nova Tabela)
  await supabaseAdmin.from("affiliate_wallet_transactions").insert({
    affiliate_id: affiliate.id,
    wallet_id: wallet.id,
    type: "withdrawal",
    amount: -input.amount,
    balance_before: balance,
    balance_after: nextBalance,
    description: `Solicitação de saque #${withdrawal.id} PIX: ${affiliate.pix_key}`,
    status: 'completed'
  } as never);

  // Resetar tentativas após sucesso
  await supabaseAdmin.from("affiliates").update({ withdrawal_attempts: 0 } as never).eq("id", affiliate.id);

  await logAudit({
    userId,
    action: "affiliate.withdrawal_requested",
    resource: "affiliate_withdrawals",
    resourceId: withdrawal.id,
    metadata: { amount: input.amount },
  });

  return { ok: true, withdrawalId: withdrawal.id, balance: nextBalance, success: true };
}

/** Estado da carteira do parceiro usando tabelas internas. */
export async function loadWalletStatus(userId: string) {
  const { data: aff } = await supabaseAdmin
    .from("affiliates")
    .select("id, pix_key, pix_key_type, withdrawal_password_hash, withdrawal_attempts, withdrawal_blocked_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!aff) return null;

  const { data: wallet } = await supabaseAdmin
    .from("affiliate_wallets")
    .select("available_balance, pending_balance")
    .eq("affiliate_id", aff.id)
    .maybeSingle();

  return {
    balance: Number(wallet?.available_balance ?? 0),
    pendingBalance: Number(wallet?.pending_balance ?? 0),
    pixKey: aff.pix_key ?? null,
    pixKeyType: aff.pix_key_type ?? null,
    hasPassword: !!aff.withdrawal_password_hash,
    attempts: Number((aff as any).withdrawal_attempts ?? 0),
    blocked: !!(aff as any).withdrawal_blocked_at,
    withdrawalSuccess: false,
  };
}

/** Suporte/Super Admin: libera o saque e zera as tentativas. */
export async function resetWithdrawalSecurity(
  affiliateId: string,
  adminId: string,
  alsoClearPassword: boolean,
) {
  const { error } = await supabaseAdmin
    .from("affiliates")
    .update({
      withdrawal_attempts: 0,
      withdrawal_blocked_at: null,
      ...(alsoClearPassword ? { withdrawal_password_hash: null } : {}),
    } as never)
    .eq("id", affiliateId);
  if (error) throw error;

  await logAudit({
    userId: adminId,
    action: "affiliate.withdrawal_security_reset",
    resource: "affiliates",
    resourceId: affiliateId,
    metadata: { clearedPassword: alsoClearPassword },
  });

  return { ok: true };
}
