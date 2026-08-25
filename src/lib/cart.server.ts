/** Carrinho persistente por usuário — fonte de verdade no banco. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CartLine = {
  id: string;
  planId: string;
  quantity: number;
  name: string;
  slug: string;
  description: string;
  durationLabel: string;
  price: number;
  lineTotal: number;
  highlights: string[];
  isLifetime: boolean;
  imageUrl: string | null;
};

export async function loadCart(userId: string) {
  const { data: items } = await supabaseAdmin
    .from("cart_items")
    .select("id,plan_id,quantity,affiliate_code,reseller_code,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const rows = (items ?? []) as Record<string, any>[];
  if (!rows.length) {
    return {
      lines: [] as CartLine[],
      subtotal: 0,
      discount: 0,
      total: 0,
      resellerCode: null as string | null,
      affiliateCode: null as string | null,
    };
  }

  const { data: plans } = await supabaseAdmin
    .from("plans")
    .select("id,name,slug,description,price,duration_label,highlights,is_lifetime,active,image_url")
    .in("id", rows.map((r) => r["plan_id"]));
  const byId = new Map((plans ?? []).map((p: any) => [p.id, p]));

  const resellerCode = rows.find((r) => r["reseller_code"])?.["reseller_code"] ?? null;
  const affiliateCode = rows.find((r) => r["affiliate_code"])?.["affiliate_code"] ?? null;

  let discountRate = 0;
  if (resellerCode) {
    const { data: reseller } = await supabaseAdmin
      .from("resellers")
      .select("discount_rate,status")
      .eq("code", String(resellerCode).toUpperCase())
      .maybeSingle();
    if (reseller && reseller.status === "active") discountRate = Number(reseller.discount_rate ?? 0);
  }

  const lines: CartLine[] = rows
    .filter((r) => byId.get(r["plan_id"])?.active)
    .map((r) => {
      const plan = byId.get(r["plan_id"]) as Record<string, any>;
      const quantity = Number(r["quantity"] ?? 1);
      const price = Number(plan["price"] ?? 0);
      return {
        id: r["id"],
        planId: plan["id"],
        quantity,
        name: plan["name"],
        slug: plan["slug"],
        description: plan["description"] ?? "",
        durationLabel: plan["is_lifetime"] ? "Acesso vitalício" : (plan["duration_label"] ?? ""),
        price,
        lineTotal: price * quantity,
        highlights: (plan["highlights"] ?? []) as string[],
        isLifetime: !!plan["is_lifetime"],
        imageUrl: plan["image_url"] ?? null,
      };
    });

  const subtotal = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const discount = Number(((subtotal * discountRate) / 100).toFixed(2));
  return {
    lines,
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    resellerCode,
    affiliateCode,
  };
}

export async function addToCart(input: {
  userId: string;
  planId: string;
  quantity?: number;
  affiliateCode?: string | null;
  resellerCode?: string | null;
}) {
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id,active")
    .eq("id", input.planId)
    .maybeSingle();
  if (!plan || !plan.active) throw new Error("Plano indisponível");

  const { data: existing } = await supabaseAdmin
    .from("cart_items")
    .select("id,quantity")
    .eq("user_id", input.userId)
    .eq("plan_id", input.planId)
    .maybeSingle();

  const quantity = Math.min(20, Math.max(1, input.quantity ?? 1));

  if (existing) {
    await supabaseAdmin
      .from("cart_items")
      .update({ quantity: Math.min(20, Number(existing.quantity) + quantity) } as never)
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("cart_items").insert({
      user_id: input.userId,
      plan_id: input.planId,
      quantity,
      affiliate_code: input.affiliateCode ?? null,
      reseller_code: input.resellerCode ?? null,
    } as never);
  }
  return loadCart(input.userId);
}

export async function setCartQuantity(userId: string, itemId: string, quantity: number) {
  if (quantity <= 0) return removeFromCart(userId, itemId);
  await supabaseAdmin
    .from("cart_items")
    .update({ quantity: Math.min(20, quantity) } as never)
    .eq("id", itemId)
    .eq("user_id", userId);
  return loadCart(userId);
}

export async function removeFromCart(userId: string, itemId: string) {
  await supabaseAdmin.from("cart_items").delete().eq("id", itemId).eq("user_id", userId);
  return loadCart(userId);
}

export async function clearCart(userId: string) {
  await supabaseAdmin.from("cart_items").delete().eq("user_id", userId);
  return loadCart(userId);
}

export async function clearPlanFromCart(userId: string, planId: string) {
  await supabaseAdmin.from("cart_items").delete().eq("user_id", userId).eq("plan_id", planId);
}
