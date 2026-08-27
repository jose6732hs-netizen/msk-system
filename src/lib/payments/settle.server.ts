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

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type DeliveryLine = {
  planId: string;
  name?: string | undefined;
  slug?: string | undefined;
  quantity: number;
  unitPrice?: number | undefined;
  role?: string | undefined;
  origin?: string | undefined;
  snapshot?: Record<string, unknown> | undefined;
};

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
    const snapshot = asMeta(line?.snapshot);
    out.push({
      planId: id,
      name: line?.name ? String(line.name) : undefined,
      slug: line?.slug ? String(line.slug) : undefined,
      quantity: Math.max(1, Number(line?.quantity ?? 1)),
      unitPrice: Number(line?.finalPrice ?? line?.unitPrice ?? 0) || undefined,
      role: line?.role ? String(line.role) : undefined,
      origin: line?.origin ? String(line.origin) : undefined,
      ...(Object.keys(snapshot).length ? { snapshot } : {}),
    });
  }

  if (!out.length) {
    const ids = Array.isArray(metadata["plan_ids"]) ? (metadata["plan_ids"] as unknown[]) : [];
    for (const id of ids) {
      if (typeof id === "string" && id) out.push({ planId: id, quantity: 1 });
    }
  }
  if (!out.length && planId) out.push({ planId, quantity: 1 });

  const merged = new Map<string, DeliveryLine>();
  for (const line of out) {
    const current = merged.get(line.planId);
    if (current) current.quantity += line.quantity;
    else merged.set(line.planId, { ...line });
  }
  return [...merged.values()];
}

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
    const snapshotMaxDevices = numberOrNull(line.snapshot?.["maxDevices"]);

    for (let i = 0; i < missing; i += 1) {
      try {
        await issueStandaloneLicense({
          userId: tx.user_id,
          planId: line.planId,
          type: "paid",
          transactionId: tx.id,
          ...(snapshotMaxDevices !== null ? { maxDevices: snapshotMaxDevices } : {}),
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

  console.info("[settle] entregando licenças do pedido", tx.identifier);
  await ensureTransactionLicenses({
    id: tx.id,
    user_id: tx.user_id,
    plan_id: (tx as { plan_id?: string | null }).plan_id ?? null,
    metadata,
  });

  if (metadata["settled_notified"] === true) return;

  if (tx.user_id) {
    const { sendPurchaseApprovedEmail } = await import("@/lib/transactional-email.server");
    await sendPurchaseApprovedEmail(tx.id).catch((e) =>
      console.error("[settle] e-mail de compra aprovada falhou:", e),
    );
  }

  const cardChargedTotal = numberOrNull(metadata["card_charged_total"]);
  const customerAmount = cardChargedTotal !== null && cardChargedTotal > 0
    ? cardChargedTotal
    : Number(tx.amount);
  const paidLabel = brl(customerAmount);
  const baseLabel = brl(Number(tx.amount));

  const { processInternalCommission } = await import("@/lib/parceiro/internal-affiliate.server");
  await processInternalCommission(transactionId).catch((e) =>
    console.error("[settle] comissão falhou:", e),
  );

  const { sendProfessionalNotification, notifyAdmins } = await import(
    "@/lib/notification-service.server"
  );

  const isSmartBundle = metadata["smart_bundle"] === true;

  if (tx.user_id) {
    await sendProfessionalNotification({
      userId: tx.user_id,
      type: "pix_approved",
      title: "Pagamento confirmado",
      body: isSmartBundle
        ? `✅ Pagamento aprovado\n💵 Valor pago: ${paidLabel}\n🎁 Suas licenças do pedido já estão liberadas`
        : `✅ Pagamento aprovado\n💵 Valor pago: ${paidLabel}\n🔑 Sua licença já está liberada`,
      link: "/painel",
      recipientRole: "user",
      transactionId: tx.id,
    }).catch((e) => console.error("[settle] push comprador:", e));
  }

  await notifyAdmins({
    type: "sale_approved",
    title: isSmartBundle ? "Combo aprovado" : "Venda aprovada",
    body: cardChargedTotal !== null && Math.abs(customerAmount - Number(tx.amount)) > 0.009
      ? `✅ ${isSmartBundle ? "Combo inteligente" : "Venda"} aprovado\n💵 Produto: ${baseLabel}\n💳 Total cobrado: ${paidLabel}`
      : `✅ ${isSmartBundle ? "Combo inteligente" : "Venda"} aprovado\n💵 Valor: ${paidLabel}`,
    link: "/admin",
    transactionId: tx.id,
    metadata: {
      transactionId: tx.id,
      baseAmount: Number(tx.amount),
      chargedAmount: customerAmount,
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
