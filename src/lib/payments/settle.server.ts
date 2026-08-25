/**
 * Pós-pagamento único: entrega de combos, comissão e notificações.
 * Chamado pelo webhook e pela reconciliação — idempotente por transação.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function asMeta(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Combos usam transaction.plan_id = null porque carregam dois planos.
 * Por isso a liquidação genérica não consegue emitir as licenças sozinha.
 * Esta etapa garante, no servidor, uma licença por plan_id assim que o PIX
 * é confirmado — mesmo que o cliente feche a página antes da tela de entrega.
 */
async function ensureSmartBundleLicenses(tx: {
  id: string;
  user_id: string | null;
  metadata: unknown;
}) {
  const metadata = asMeta(tx.metadata);
  if (metadata["smart_bundle"] !== true || !tx.user_id) return;

  const rawIds = Array.isArray(metadata["plan_ids"]) ? metadata["plan_ids"] : [];
  const planIds = [
    ...new Set(rawIds.filter((value): value is string => typeof value === "string" && value.length > 0)),
  ];
  if (!planIds.length) return;

  const { issueStandaloneLicense } = await import("@/lib/commerce.server");

  for (const planId of planIds) {
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("licenses")
      .select("id")
      .eq("transaction_id", tx.id)
      .eq("plan_id", planId)
      .limit(1);

    if (lookupError) {
      console.error("[settle] consulta licença do combo falhou:", lookupError.message);
      continue;
    }
    if (existing?.length) continue;

    try {
      await issueStandaloneLicense({
        userId: tx.user_id,
        planId,
        type: "paid",
        transactionId: tx.id,
        maxDevices: 1,
      });
    } catch (e) {
      console.error("[settle] emissão de licença do combo falhou:", e);
    }
  }
}

export async function finalizePaidTransaction(transactionId: string) {
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id,user_id,amount,identifier,affiliate_id,metadata")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) return;

  const metadata = asMeta(tx.metadata);

  // A entrega do combo vem ANTES da trava de notificações. Assim uma tentativa
  // anterior que já notificou, mas falhou ao emitir licença, é autorreparada.
  await ensureSmartBundleLicenses({
    id: tx.id,
    user_id: tx.user_id,
    metadata,
  });

  if (metadata["settled_notified"] === true) return;

  const gross = brl(Number(tx.amount));

  // 1. Comissão do afiliado (também envia o push de comissão ao afiliado).
  const { processInternalCommission } = await import("@/lib/parceiro/internal-affiliate.server");
  await processInternalCommission(transactionId).catch((e) =>
    console.error("[settle] comissão falhou:", e),
  );

  const { sendProfessionalNotification, notifyAdmins } = await import(
    "@/lib/notification-service.server"
  );

  const isSmartBundle = metadata["smart_bundle"] === true;

  // 2. Comprador
  if (tx.user_id) {
    await sendProfessionalNotification({
      userId: tx.user_id,
      type: "pix_approved",
      title: "Pagamento confirmado",
      body: isSmartBundle
        ? `✅ Pagamento aprovado\n💵 Valor: ${gross}\n🎁 Suas duas licenças do combo já estão liberadas`
        : `✅ Pagamento aprovado\n💵 Valor: ${gross}\n🔑 Sua licença já está liberada`,
      link: isSmartBundle ? "/painel" : "/painel",
      recipientRole: "user",
      transactionId: tx.id,
    }).catch((e) => console.error("[settle] push comprador:", e));
  }

  // 3. Administradores (valor bruto)
  await notifyAdmins({
    type: "sale_approved",
    title: isSmartBundle ? "Combo aprovado" : "Venda aprovada",
    body: isSmartBundle
      ? `✅ Combo inteligente aprovado\n💵 Valor bruto: ${gross}`
      : `✅ Venda aprovada\n💵 Valor bruto: ${gross}`,
    link: "/admin",
    transactionId: tx.id,
    metadata: {
      transactionId: tx.id,
      amount: Number(tx.amount),
      smartBundle: isSmartBundle,
    },
  }).catch((e) => console.error("[settle] push admin:", e));

  await supabaseAdmin
    .from("transactions")
    .update({
      metadata: { ...metadata, settled_notified: true } as never,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", tx.id);
}
