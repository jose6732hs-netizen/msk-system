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

type DeliveryLine = {
  planId: string;
  name?: string | undefined;
  slug?: string | undefined;
  quantity: number;
  unitPrice?: number | undefined;
  role?: string | undefined;
  origin?: string | undefined;
};

/**
 * Lê a composição do pedido (compra simples, carrinho em lote, order bump ou combo)
 * e devolve UMA linha por produto — é isso que garante licenças separadas e
 * identificadas por função, mesmo quando a pessoa comprou duas ofertas juntas.
 */
function deliveryLines(metadata: Record<string, unknown>, planId: string | null): DeliveryLine[] {
  const out: DeliveryLine[] = [];

  const raw = Array.isArray(metadata["line_items"])
    ? (metadata["line_items"] as any[])
    : Array.isArray(metadata["lines"])
      ? (metadata["lines"] as any[])
      : [];

  for (const line of raw) {
    const id = String(line?.planId ?? line?.plan_id ?? "");
    if (!id) continue;
    out.push({
      planId: id,
      name: line?.name ? String(line.name) : undefined,
      slug: line?.slug ? String(line.slug) : undefined,
      quantity: Math.max(1, Number(line?.quantity ?? 1)),
      unitPrice: Number(line?.finalPrice ?? line?.unitPrice ?? 0) || undefined,
      role: line?.role ? String(line.role) : undefined,
      origin: line?.origin ? String(line.origin) : undefined,
    });
  }

  if (!out.length) {
    const ids = Array.isArray(metadata["plan_ids"]) ? (metadata["plan_ids"] as unknown[]) : [];
    for (const id of ids) {
      if (typeof id === "string" && id) out.push({ planId: id, quantity: 1 });
    }
  }

  if (!out.length && planId) out.push({ planId, quantity: 1 });

  // Agrupa por plano preservando a origem da primeira ocorrência.
  const merged = new Map<string, DeliveryLine>();
  for (const line of out) {
    const current = merged.get(line.planId);
    if (current) current.quantity += line.quantity;
    else merged.set(line.planId, { ...line });
  }
  return [...merged.values()];
}

/**
 * Emite as licenças do pedido — uma por unidade comprada — de forma idempotente.
 * Cada licença recebe metadados com a função (extensão, clonador, agente),
 * o rótulo do item e a origem (compra, carrinho, oferta adicional).
 */
async function ensureTransactionLicenses(tx: {
  id: string;
  user_id: string | null;
  plan_id?: string | null;
  metadata: unknown;
}) {
  if (!tx.user_id) return;
  const metadata = asMeta(tx.metadata);
  const lines = deliveryLines(metadata, tx.plan_id ?? null);
  if (!lines.length) return;

  const { issueStandaloneLicense } = await import("@/lib/commerce.server");
  const { licenseRoleFromSlug, licensePurpose } = await import("@/lib/license-purpose");

  for (const line of lines) {
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("licenses")
      .select("id")
      .eq("transaction_id", tx.id)
      .eq("plan_id", line.planId);

    if (lookupError) {
      console.error("[settle] consulta de licenças do pedido falhou:", lookupError.message);
      continue;
    }

    const missing = line.quantity - (existing?.length ?? 0);
    if (missing <= 0) continue;

    const role = line.role ?? licenseRoleFromSlug(line.slug);
    const purpose = licensePurpose({ slug: line.slug ?? null, role });

    for (let i = 0; i < missing; i += 1) {
      try {
        await issueStandaloneLicense({
          userId: tx.user_id,
          planId: line.planId,
          type: "paid",
          transactionId: tx.id,
          maxDevices: 1,
          extraMetadata: {
            license_role: purpose.role,
            license_purpose: purpose.label,
            license_purpose_description: purpose.description,
            item_label: line.name ?? purpose.label,
            item_origin: line.origin ?? (metadata["smart_bundle"] === true ? "bundle" : "single"),
            item_unit_price: line.unitPrice ?? null,
            item_index: (existing?.length ?? 0) + i + 1,
            item_quantity: line.quantity,
          },
        });
      } catch (e) {
        console.error("[settle] emissão de licença do item falhou:", e);
      }
    }
  }
}


export async function finalizePaidTransaction(transactionId: string) {
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id,user_id,plan_id,amount,identifier,affiliate_id,metadata")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) return;

  const metadata = asMeta(tx.metadata);

  // A entrega do combo vem ANTES da trava de notificações. Assim uma tentativa
  // anterior que já notificou, mas falhou ao emitir licença, é autorreparada.
  console.info("[settle] entregando licenças do pedido", tx.identifier);
  await ensureTransactionLicenses({
    id: tx.id,
    user_id: tx.user_id,
    plan_id: (tx as { plan_id?: string | null }).plan_id ?? null,
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
