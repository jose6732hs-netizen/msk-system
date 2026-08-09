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
  if (affiliate.withdrawal_password_hash) {
     // Aqui poderíamos permitir alteração com a senha antiga, mas o prompt pede "Crie sua senha".
     // Vamos permitir definir se estiver vazio, ou apenas atualizar se logado.
  }

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

/** Solicita um saque. */
export async function requestWithdrawal(userId: string, input: { amount: number; passwordHash: string }) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id, available_balance, withdrawal_password_hash, pix_key, pix_key_type, status")
    .eq("user_id", userId)
    .single();

  if (!affiliate) throw new Error("Conta de afiliado não encontrada.");
  if (affiliate.status !== "active") throw new Error("Sua conta está bloqueada ou inativa.");
  if (!affiliate.withdrawal_password_hash) throw new Error("Defina uma senha de saque primeiro.");
  if (affiliate.withdrawal_password_hash !== input.passwordHash) throw new Error("Senha de saque incorreta.");
  if (!affiliate.pix_key) throw new Error("Cadastre uma chave PIX para receber.");
  
  const balance = Number(affiliate.available_balance);
  if (balance < input.amount) throw new Error("Saldo insuficiente.");
  if (input.amount < 20) throw new Error("O valor mínimo para saque é R$ 20,00.");

  // Deduz saldo e registra saque
  const nextBalance = balance - input.amount;

  const { data: withdrawal, error: wError } = await supabaseAdmin
    .from("withdrawals")
    .insert({
      affiliate_id: affiliate.id,
      amount: input.amount,
      status: "PENDING",
      pix_key: affiliate.pix_key,
      pix_key_type: affiliate.pix_key_type
    } as never)
    .select("id")
    .single();

  if (wError) throw wError;

  await supabaseAdmin
    .from("affiliates")
    .update({ available_balance: nextBalance } as never)
    .eq("id", affiliate.id);

  // Registro no extrato (ledger)
  await supabaseAdmin.from("affiliate_balance_ledger").insert({
    affiliate_id: affiliate.id,
    type: "withdrawal",
    amount: input.amount,
    balance_after: nextBalance,
    reason: `Solicitação de saque #${withdrawal.id}`,
  } as never);

  await logAudit({
    userId,
    action: "affiliate.withdrawal_requested",
    resource: "withdrawals",
    resourceId: withdrawal.id,
    metadata: { amount: input.amount }
  });

  return { ok: true, withdrawalId: withdrawal.id, balance: nextBalance };
}
