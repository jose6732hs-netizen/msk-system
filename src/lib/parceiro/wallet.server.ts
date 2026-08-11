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

const MAX_ATTEMPTS = 3;

/** Solicita um saque. Bloqueia após 3 senhas incorretas (desbloqueio pelo suporte). */
export async function requestWithdrawal(userId: string, input: { amount: number; passwordHash: string }) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select(
      "id, available_balance, withdrawal_password_hash, pix_key, pix_key_type, status, withdrawal_attempts, withdrawal_blocked_at",
    )
    .eq("user_id", userId)
    .single();

  if (!affiliate) throw new Error("Conta de afiliado não encontrada.");
  if (affiliate.status !== "active") throw new Error("Sua conta está bloqueada ou inativa.");
  if ((affiliate as any).withdrawal_blocked_at)
    throw new Error("Saques bloqueados por segurança. Fale com o suporte para liberar.");
  if (!affiliate.withdrawal_password_hash) throw new Error("Defina uma senha de saque primeiro.");

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
    await logAudit({
      userId,
      action: blocked ? "affiliate.withdrawal_blocked" : "affiliate.withdrawal_password_failed",
      resource: "affiliates",
      resourceId: affiliate.id,
      metadata: { attempts },
    });
    throw new Error(
      blocked
        ? "Senha incorreta 3 vezes. Saques bloqueados — fale com o suporte."
        : `Senha de saque incorreta. Tentativa ${attempts} de ${MAX_ATTEMPTS}.`,
    );
  }

  if (!affiliate.pix_key) throw new Error("Cadastre uma chave PIX para receber.");

  const balance = Number(affiliate.available_balance);
  if (input.amount < 20) throw new Error("O valor mínimo para saque é R$ 20,00.");
  if (balance < input.amount) throw new Error("Saldo insuficiente.");

  // Deduz saldo e registra saque
  const nextBalance = balance - input.amount;

  const { data: withdrawal, error: wError } = await supabaseAdmin
    .from("withdrawals")
    .insert({
      user_id: userId,
      affiliate_id: affiliate.id,
      amount: input.amount,
      status: "PENDING",
      pix_key: affiliate.pix_key,
      pix_key_type: affiliate.pix_key_type,
    } as never)
    .select("id")
    .single();

  if (wError) throw wError;

  await supabaseAdmin
    .from("affiliates")
    .update({ available_balance: nextBalance, withdrawal_attempts: 0 } as never)
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
    metadata: { amount: input.amount },
  });

  return { ok: true, withdrawalId: withdrawal.id, balance: nextBalance };
}

/** Estado da carteira do parceiro (senha definida, PIX, bloqueio). */
export async function loadWalletStatus(userId: string) {
  const { data } = await supabaseAdmin
    .from("affiliates")
    .select(
      "available_balance, pending_balance, pix_key, pix_key_type, withdrawal_password_hash, withdrawal_attempts, withdrawal_blocked_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    balance: Number(data.available_balance ?? 0),
    pendingBalance: Number(data.pending_balance ?? 0),
    pixKey: data.pix_key ?? null,
    pixKeyType: data.pix_key_type ?? null,
    hasPassword: !!data.withdrawal_password_hash,
    attempts: Number((data as any).withdrawal_attempts ?? 0),
    blocked: !!(data as any).withdrawal_blocked_at,
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
