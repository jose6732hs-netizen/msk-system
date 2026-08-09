/** Pedidos: expiração de PIX (2 minutos) e recuperação de pagamentos pendentes. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const PIX_TTL_MS = 2 * 60 * 1000;

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

export async function getOrder(userId: string, transactionId: string) {
  await expireStalePix(userId);
  const { data } = await supabaseAdmin
    .from("transactions")
    .select(
      "id,identifier,status,amount,paid_at,expires_at,pix_code,pix_qrcode,purpose,plan_id,plans(name)",
    )
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Pedido não encontrado");
  const row = data as Record<string, any>;
  const expired =
    row["status"] === "EXPIRED" ||
    (!row["paid_at"] &&
      row["expires_at"] != null &&
      new Date(row["expires_at"]).getTime() <= Date.now());
  return { ...row, expired } as Record<string, any> & { expired: boolean; status: string };
}
