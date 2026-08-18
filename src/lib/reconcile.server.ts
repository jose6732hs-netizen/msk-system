/** Reconciliação de pagamentos direto no gateway (fallback quando o webhook não chega). */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AmploPayService } from "./payments/amplo-pay.server";
import { mapGatewayStatus, recordPaymentEvent } from "./financial.server";

const OPEN_STATUSES = ["PENDING", "WAITING_PAYMENT", "AWAITING_PAYMENT", "PROCESSING", "EXPIRED"];

function pickStatus(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, any>;
  const candidates = [
    obj["status"],
    obj["transactionStatus"],
    obj["data"]?.["status"],
    obj["transaction"]?.["status"],
    Array.isArray(obj["data"]) ? obj["data"][0]?.["status"] : null,
  ];
  const found = candidates.find((c) => typeof c === "string" && c.length > 0);
  return found ? String(found) : null;
}

/** Confirma no gateway o estado real de uma transação e liquida se estiver paga. */
export async function reconcileTransaction(transactionId: string) {
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id,status,amount,provider_transaction_id,identifier,paid_at,user_id")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) return { ok: false, reason: "NOT_FOUND" as const };
  if (tx.status === "PAID" && tx.paid_at) return { ok: true, status: "PAID" as const, changed: false };
  if (!tx.provider_transaction_id) return { ok: false, reason: "NO_PROVIDER_ID" as const };

  let remote: Record<string, unknown> | null = null;
  try {
    const service = await AmploPayService.create();
    remote = await service.getTransaction(tx.provider_transaction_id);
  } catch (e) {
    console.error("[reconcile] falha ao consultar gateway:", (e as Error).message);
    return { ok: false, reason: "GATEWAY_ERROR" as const };
  }

  const status = mapGatewayStatus(pickStatus(remote));
  if (status !== "PAID") return { ok: true, status, changed: false };

  await settleFromGateway(tx.id, Number(tx.amount), remote);
  return { ok: true, status: "PAID" as const, changed: true };
}

/** Liquidação completa (licença + comissão + notificações), idempotente. */
export async function settleFromGateway(
  transactionId: string,
  amount: number,
  remote?: unknown,
) {
  const { settlePaidTransaction } = await import("./commerce.server");
  const result = await settlePaidTransaction(transactionId);
  if ((result as { alreadySettled?: boolean })?.alreadySettled) return;

  await supabaseAdmin
    .from("transactions")
    .update({ raw: (remote ?? {}) as never, updated_at: new Date().toISOString() } as never)
    .eq("id", transactionId);

  await recordPaymentEvent({
    transactionId,
    event: "gateway.reconciled",
    status: "PAID",
    amount,
  }).catch(() => {});

  const { processInternalCommission } = await import("./parceiro/internal-affiliate.server");
  await processInternalCommission(transactionId).catch((e) =>
    console.error("[reconcile] comissão:", e),
  );

  const gross = Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const { sendProfessionalNotification, notifyAdmins } = await import(
    "./notification-service.server"
  );
  await notifyAdmins({
    type: "sale_approved",
    title: "Venda aprovada",
    body: `✅ Venda aprovada\n💵 Valor bruto: ${gross}`,
    link: "/admin",
    transactionId,
    metadata: { transactionId, amount },
  }).catch(() => {});

  const { data: paidTx } = await supabaseAdmin
    .from("transactions")
    .select("user_id")
    .eq("id", transactionId)
    .maybeSingle();
  if (paidTx?.user_id) {
    await sendProfessionalNotification({
      userId: paidTx.user_id,
      type: "pix_approved",
      title: "Pagamento confirmado",
      body: `✅ Pagamento aprovado\n💵 Valor: ${gross}\n🔑 Sua licença já está liberada`,
      link: "/painel",
      recipientRole: "user",
      transactionId,
    }).catch(() => {});
  }
}

/** Reconcilia transações em aberto (opcionalmente de um usuário) nas últimas horas. */
export async function reconcileOpenTransactions(input: {
  userId?: string | null;
  hours?: number;
  limit?: number;
}) {
  const since = new Date(Date.now() - (input.hours ?? 72) * 3600_000).toISOString();
  let query = supabaseAdmin
    .from("transactions")
    .select("id")
    .in("status", OPEN_STATUSES)
    .is("paid_at", null)
    .not("provider_transaction_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 25);
  if (input.userId) query = query.eq("user_id", input.userId);

  const { data } = await query;
  let updated = 0;
  for (const row of data ?? []) {
    const res = await reconcileTransaction((row as { id: string }).id).catch(() => null);
    if (res && "changed" in res && res.changed) updated += 1;
  }
  return { checked: data?.length ?? 0, updated };
}
