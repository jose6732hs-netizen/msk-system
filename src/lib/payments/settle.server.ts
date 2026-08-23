/**
 * Pós-pagamento único: comissão do afiliado + notificações (comprador, afiliado, admins).
 * Chamado pelo webhook e pela reconciliação — idempotente por transação.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function finalizePaidTransaction(transactionId: string) {
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id,user_id,amount,identifier,affiliate_id,metadata")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) return;

  const meta = (tx.metadata ?? {}) as Record<string, unknown>;
  if (meta["settled_notified"] === true) return;

  const gross = brl(Number(tx.amount));

  // 1. Comissão do afiliado (também envia o push de comissão ao afiliado).
  const { processInternalCommission } = await import("@/lib/parceiro/internal-affiliate.server");
  await processInternalCommission(transactionId).catch((e) =>
    console.error("[settle] comissão falhou:", e),
  );

  const { sendProfessionalNotification, notifyAdmins } = await import(
    "@/lib/notification-service.server"
  );

  // 2. Comprador
  if (tx.user_id) {
    await sendProfessionalNotification({
      userId: tx.user_id,
      type: "pix_approved",
      title: "Pagamento confirmado",
      body: `✅ Pagamento aprovado\n💵 Valor: ${gross}\n🔑 Sua licença já está liberada`,
      link: "/painel",
      recipientRole: "user",
      transactionId: tx.id,
    }).catch((e) => console.error("[settle] push comprador:", e));
  }

  // 3. Administradores (valor bruto)
  await notifyAdmins({
    type: "sale_approved",
    title: "Venda aprovada",
    body: `✅ Venda aprovada\n💵 Valor bruto: ${gross}`,
    link: "/admin",
    transactionId: tx.id,
    metadata: { transactionId: tx.id, amount: Number(tx.amount) },
  }).catch((e) => console.error("[settle] push admin:", e));

  await supabaseAdmin
    .from("transactions")
    .update({
      metadata: { ...meta, settled_notified: true } as never,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", tx.id);
}
