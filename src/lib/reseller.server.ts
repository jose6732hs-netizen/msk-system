/**
 * Serviço de revenda: tabela de preços por nível, compra de licença com
 * desconto de saldo e página pública do revendedor. Somente servidor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";
import { issueStandaloneLicense } from "./commerce.server";
import { computeExpiry } from "./financial.server";

export async function listResellerPricing(tier: string) {
  const { data } = await supabaseAdmin
    .from("reseller_prices")
    .select("*")
    .eq("tier_slug", tier)
    .eq("active", true)
    .order("sort_order");
  return data ?? [];
}

export async function listTiers() {
  const { data } = await supabaseAdmin
    .from("reseller_tiers")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return data ?? [];
}

/**
 * Compra de licença pelo revendedor: valida saldo, desconta, emite a chave
 * e registra a venda. Em caso de falha após o débito, o saldo é restaurado.
 */
export async function purchaseLicenseAsReseller(input: {
  userId: string;
  priceId: string;
  customerName: string;
  customerEmail: string;
  salePrice?: number | null;
}) {
  const { data: reseller } = await supabaseAdmin
    .from("resellers")
    .select("id,tier,available_balance,status")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!reseller) throw new Error("Conta de revendedor não encontrada");
  if (reseller.status !== "active") throw new Error("Conta de revendedor inativa");

  const { data: price } = await supabaseAdmin
    .from("reseller_prices")
    .select("*")
    .eq("id", input.priceId)
    .eq("active", true)
    .maybeSingle();
  if (!price) throw new Error("Preço indisponível");
  if (price.tier_slug !== reseller.tier) throw new Error("Preço não pertence ao seu nível");

  const cost = Number(price.price);
  const balance = Number(reseller.available_balance);
  if (balance < cost) throw new Error("Saldo insuficiente. Faça um depósito para continuar.");

  // Débito imediato (reserva) — nunca confiar em valores vindos do cliente.
  const { error: debitError } = await supabaseAdmin
    .from("resellers")
    .update({ available_balance: balance - cost })
    .eq("id", reseller.id)
    .gte("available_balance", cost);
  if (debitError) throw debitError;

  try {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .insert({
        reseller_id: reseller.id,
        name: input.customerName,
        email: input.customerEmail.toLowerCase(),
      } as never)
      .select("id")
      .single();

    let planId = price.plan_id as string | null;
    if (!planId) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      planId = plan?.id ?? null;
    }
    if (!planId) throw new Error("Nenhum plano disponível");

    const expiresAt = computeExpiry(price.duration_unit, price.duration_value);
    const license = await issueStandaloneLicense({
      userId: input.userId,
      planId,
      type: "reseller",
      resellerId: reseller.id,
      expiresAtOverride: expiresAt,
    });

    const salePrice = input.salePrice ?? null;
    await supabaseAdmin.from("reseller_sales").insert({
      reseller_id: reseller.id,
      customer_id: customer?.id ?? null,
      license_id: license.licenseId,
      price_id: price.id,
      cost,
      sale_price: salePrice,
      profit: salePrice != null ? salePrice - cost : null,
      duration_label: price.duration_label,
      status: "COMPLETED",
    } as never);

    await logAudit({
      userId: input.userId,
      action: "reseller.license_sold",
      resource: "licenses",
      resourceId: license.licenseId,
      metadata: { cost, duration: price.duration_label, customer: input.customerEmail },
    });

    return {
      token: license.token,
      licenseId: license.licenseId,
      expiresAt,
      cost,
      durationLabel: price.duration_label,
    };
  } catch (e) {
    // Estorna o saldo reservado se a emissão falhar.
    const { data: current } = await supabaseAdmin
      .from("resellers")
      .select("available_balance")
      .eq("id", reseller.id)
      .maybeSingle();
    await supabaseAdmin
      .from("resellers")
      .update({ available_balance: Number(current?.available_balance ?? 0) + cost })
      .eq("id", reseller.id);
    throw e;
  }
}

/** Dados públicos da página /r/{slug}. */
export async function loadResellerPage(slug: string) {
  const { data: reseller } = await supabaseAdmin
    .from("resellers")
    .select("id,slug,code,display_name,tier,status")
    .eq("slug", slug.toLowerCase())
    .eq("status", "active")
    .maybeSingle();
  if (!reseller) return null;

  const [{ data: branding }, { data: plans }, { data: build }] = await Promise.all([
    supabaseAdmin.from("extension_branding").select("*").eq("reseller_id", reseller.id).maybeSingle(),
    supabaseAdmin.from("plans").select("id,name,price,duration_label,is_lifetime,features").eq("active", true).order("sort_order"),
    supabaseAdmin
      .from("extension_builds")
      .select("version,created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    reseller: {
      slug: reseller.slug,
      code: reseller.code,
      name: reseller.display_name ?? branding?.extension_name ?? "Revendedor Oficial",
      tier: reseller.tier,
    },
    branding: branding ?? null,
    plans: plans ?? [],
    latestVersion: build?.version ?? null,
  };
}
