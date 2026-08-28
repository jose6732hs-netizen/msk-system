/** Pedidos: expiração de PIX (30 minutos) e recuperação de pagamentos pendentes. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeProductImage } from "./product-image";

export const PIX_TTL_MS = 30 * 60 * 1000;

export function pixExpiryFromNow() {
  return new Date(Date.now() + PIX_TTL_MS).toISOString();
}

const OPEN_STATUSES = ["PENDING", "WAITING_PAYMENT", "AWAITING_PAYMENT"];

/** Marca como EXPIRED todo PIX pendente cujo prazo já passou. Nunca toca em pagos. */
export async function expireStalePix(userId: string) {
  await supabaseAdmin
    .from("transactions")
    .update({ status: "EXPIRED", updated_at: new Date().toISOString() } as never)
    .eq("user_id", userId)
    .eq("method", "PIX")
    .in("status", OPEN_STATUSES)
    .is("paid_at", null)
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());
}

export async function listOrders(userId: string, limit = 40) {
  try {
    const { reconcileOpenTransactions } = await import("./reconcile.server");
    await reconcileOpenTransactions({ userId, hours: 72, limit: 10 });
  } catch {
    /* noop */
  }
  await expireStalePix(userId);
  const { data } = await supabaseAdmin
    .from("transactions")
    .select(
      "id,identifier,amount,status,method,purpose,created_at,paid_at,expires_at,pix_code,pix_qrcode,plan_id,plans(name,duration_label)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Record<string, any>[];
}

/** Pagamentos ainda recuperáveis (PIX válido) ou expirados aguardando novo PIX. */
export async function listPendingPayments(userId: string) {
  const orders = await listOrders(userId, 20);
  return orders.filter(
    (o) =>
      o["purpose"] === "purchase" &&
      (OPEN_STATUSES.includes(String(o["status"])) || o["status"] === "EXPIRED"),
  );
}

function objectMeta(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function getOrder(userId: string, transactionId: string) {
  // Confirma no gateway antes de expirar (webhook pode falhar/atrasar).
  try {
    const { reconcileTransaction } = await import("./reconcile.server");
    await reconcileTransaction(transactionId);
  } catch (e) {
    console.error("[orders] reconciliação falhou:", (e as Error).message);
  }
  const { data } = await supabaseAdmin
    .from("transactions")
    .select(
      "id,identifier,status,amount,paid_at,expires_at,pix_code,pix_qrcode,purpose,plan_id,metadata,plans(name,slug,image_url)",
    )
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Pedido não encontrado");

  const row = data as Record<string, any>;
  const metadata = objectMeta(row["metadata"]);
  const rawLines = Array.isArray(metadata["line_items"]) ? metadata["line_items"] : [];
  const planIds = [
    ...new Set(
      rawLines
        .map((line: any) => String(line?.planId ?? line?.plan_id ?? ""))
        .filter(Boolean),
    ),
  ];

  const planById = new Map<string, any>();
  if (planIds.length) {
    const { data: planRows } = await supabaseAdmin
      .from("plans")
      .select("id,name,slug,image_url")
      .in("id", planIds);
    for (const plan of planRows ?? []) planById.set(String(plan.id), plan);
  }

  const items = rawLines.map((line: any) => {
    const planId = String(line?.planId ?? line?.plan_id ?? "");
    const plan = planById.get(planId);
    const snapshot = objectMeta(line?.snapshot);
    const slug = String(line?.slug ?? snapshot["slug"] ?? plan?.slug ?? "");
    const name = String(line?.name ?? snapshot["name"] ?? plan?.name ?? "Produto MSK");
    const quantity = Math.max(1, Number(line?.quantity ?? 1));
    const unitPrice = Number(line?.unitPrice ?? line?.finalPrice ?? snapshot["soldPrice"] ?? 0);
    const snapshotImage = snapshot["imageUrl"] ?? snapshot["image_url"] ?? null;
    return {
      planId,
      name,
      slug,
      quantity,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      imageUrl: normalizeProductImage(snapshotImage ?? plan?.image_url, slug),
    };
  });

  if (!items.length && row["plans"]) {
    const plan = row["plans"] as Record<string, any>;
    items.push({
      planId: String(row["plan_id"] ?? ""),
      name: String(plan["name"] ?? "Produto MSK"),
      slug: String(plan["slug"] ?? ""),
      quantity: 1,
      unitPrice: Number(row["amount"] ?? 0),
      imageUrl: normalizeProductImage(plan["image_url"], plan["slug"]),
    });
  }

  const expired =
    row["status"] === "EXPIRED" ||
    (!row["paid_at"] &&
      row["expires_at"] != null &&
      new Date(row["expires_at"]).getTime() <= Date.now());

  // Não devolvemos metadata bruto porque o snapshot pode conter dados de entrega pós-pagamento.
  const { metadata: _privateMetadata, ...publicRow } = row;
  return { ...publicRow, items, expired } as Record<string, any> & {
    items: Array<{ planId: string; name: string; slug: string; quantity: number; unitPrice: number; imageUrl: string }>;
    expired: boolean;
    status: string;
  };
}
