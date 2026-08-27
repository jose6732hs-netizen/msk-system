import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
};

export type LicenseProductBinding = {
  product: ProductRow | null;
  source: "license" | "transaction" | "transaction_offer" | "expected_offer" | "plan_offer" | "none";
  ambiguous: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadProduct(productId: string | null | undefined): Promise<ProductRow | null> {
  if (!productId) return null;
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id,slug,name")
    .eq("id", productId)
    .maybeSingle();
  if (error) {
    console.error("[license-product] Falha ao carregar produto:", error.message);
    return null;
  }
  return (data as ProductRow | null) ?? null;
}

export async function resolveProductIdentifier(identifier?: string | null): Promise<ProductRow | null> {
  const value = String(identifier ?? "").trim();
  if (!value) return null;

  let query = supabaseAdmin.from("products").select("id,slug,name");
  query = UUID_RE.test(value) ? query.eq("id", value) : query.eq("slug", value);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[license-product] Falha ao resolver produto esperado:", error.message);
    return null;
  }
  return (data as ProductRow | null) ?? null;
}

async function persistBinding(licenseId: string, productId: string) {
  const { data, error } = await supabaseAdmin
    .from("licenses")
    .update({ product_id: productId } as never)
    .eq("id", licenseId)
    .is("product_id", null)
    .select("product_id")
    .maybeSingle();

  if (error) {
    console.error(`[license-product] Falha ao vincular produto à licença ${licenseId}:`, error.message);
    return null;
  }

  if ((data as any)?.product_id) return String((data as any).product_id);

  const { data: current } = await supabaseAdmin
    .from("licenses")
    .select("product_id")
    .eq("id", licenseId)
    .maybeSingle();
  return (current as any)?.product_id ? String((current as any).product_id) : null;
}

async function productFromOffer(offerId?: string | null) {
  if (!offerId) return null;
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select("product_id")
    .eq("id", offerId)
    .maybeSingle();
  if (error) {
    console.error("[license-product] Falha ao resolver produto da oferta:", error.message);
    return null;
  }
  return (data as any)?.product_id ? String((data as any).product_id) : null;
}

/**
 * Resolve o produto real de uma licença sem usar role/nome de plano como identidade.
 * Prioridade: vínculo explícito da licença -> transação/oferta -> oferta do produto
 * esperado para o plano -> único produto associado ao plano.
 *
 * Quando a licença é legada e o vínculo é inequívoco, product_id é persistido para
 * que as próximas validações não precisem inferir novamente.
 */
export async function resolveLicenseProductBinding(input: {
  licenseId: string;
  planId?: string | null;
  expectedProductIdentifier?: string | null;
}): Promise<LicenseProductBinding> {
  const { data: licenseRow, error: licenseError } = await supabaseAdmin
    .from("licenses")
    .select("id,product_id,transaction_id,plan_id")
    .eq("id", input.licenseId)
    .maybeSingle();

  if (licenseError || !licenseRow) {
    if (licenseError) console.error("[license-product] Falha ao ler vínculo da licença:", licenseError.message);
    return { product: null, source: "none", ambiguous: false };
  }

  const explicitProductId = (licenseRow as any).product_id ? String((licenseRow as any).product_id) : null;
  if (explicitProductId) {
    return { product: await loadProduct(explicitProductId), source: "license", ambiguous: false };
  }

  const transactionId = (licenseRow as any).transaction_id ? String((licenseRow as any).transaction_id) : null;
  if (transactionId) {
    const { data: tx, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("product_id,offer_id")
      .eq("id", transactionId)
      .maybeSingle();

    if (txError) {
      console.error("[license-product] Falha ao resolver transação da licença:", txError.message);
    } else if (tx) {
      let productId = (tx as any).product_id ? String((tx as any).product_id) : null;
      let source: LicenseProductBinding["source"] = "transaction";
      if (!productId && (tx as any).offer_id) {
        productId = await productFromOffer(String((tx as any).offer_id));
        source = "transaction_offer";
      }
      if (productId) {
        const stored = await persistBinding(input.licenseId, productId);
        const finalId = stored ?? productId;
        return { product: await loadProduct(finalId), source, ambiguous: false };
      }
    }
  }

  const planId = String((licenseRow as any).plan_id ?? input.planId ?? "").trim();
  if (!planId) return { product: null, source: "none", ambiguous: false };

  // O identificador é definido pelo endpoint no servidor (não confiamos no cliente).
  // Se o plano participa de uma oferta desse produto, o vínculo é seguro mesmo em
  // licenças antigas que ainda não tinham product_id preenchido.
  const expected = await resolveProductIdentifier(input.expectedProductIdentifier);
  if (expected) {
    const { data: expectedOffer, error: expectedOfferError } = await supabaseAdmin
      .from("offers")
      .select("id")
      .eq("plan_id", planId)
      .eq("product_id", expected.id)
      .limit(1)
      .maybeSingle();
    if (expectedOfferError) {
      console.error("[license-product] Falha ao conferir oferta esperada:", expectedOfferError.message);
    } else if (expectedOffer) {
      const stored = await persistBinding(input.licenseId, expected.id);
      const finalId = stored ?? expected.id;
      return { product: finalId === expected.id ? expected : await loadProduct(finalId), source: "expected_offer", ambiguous: false };
    }
  }

  const { data: offers, error: offersError } = await supabaseAdmin
    .from("offers")
    .select("product_id")
    .eq("plan_id", planId);
  if (offersError) {
    console.error("[license-product] Falha ao conferir ofertas do plano:", offersError.message);
    return { product: null, source: "none", ambiguous: false };
  }

  const productIds = [...new Set((offers ?? []).map((row: any) => String(row.product_id ?? "")).filter(Boolean))];
  if (productIds.length === 1) {
    const productId = productIds[0]!;
    const stored = await persistBinding(input.licenseId, productId);
    const finalId = stored ?? productId;
    return { product: await loadProduct(finalId), source: "plan_offer", ambiguous: false };
  }

  return { product: null, source: "none", ambiguous: productIds.length > 1 };
}
