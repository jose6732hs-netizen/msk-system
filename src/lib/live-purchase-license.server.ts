import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptToken, hashToken } from "./license.server";

const LIVE_PRODUCT_SLUG = "msk-live";
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makePaidLiveToken() {
  const groups: string[] = [];
  for (let group = 0; group < 4; group += 1) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    let part = "";
    for (let index = 0; index < bytes.length; index += 1) {
      part += TOKEN_ALPHABET[bytes[index]! % TOKEN_ALPHABET.length];
    }
    groups.push(part);
  }
  return `MSKLIVE-${groups.join("-")}`;
}

/**
 * Converte uma licença recém-emitida pelo checkout para o namespace exclusivo
 * do MSK LIVE e fixa o vínculo com o produto correto antes da entrega.
 */
export async function finalizePaidLiveLicense(licenseId: string) {
  const [{ data: product, error: productError }, { data: license, error: licenseError }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id,slug,active")
      .eq("slug", LIVE_PRODUCT_SLUG)
      .maybeSingle(),
    supabaseAdmin
      .from("licenses")
      .select("id,metadata")
      .eq("id", licenseId)
      .maybeSingle(),
  ]);

  if (productError) throw productError;
  if (licenseError) throw licenseError;
  if (!product) throw new Error("Produto MSK LIVE não encontrado no banco.");
  if (!license) throw new Error("Licença MSK LIVE recém-emitida não encontrada.");

  const token = makePaidLiveToken();
  const last4 = token.slice(-4);
  const metadata =
    license.metadata && typeof license.metadata === "object" && !Array.isArray(license.metadata)
      ? (license.metadata as Record<string, unknown>)
      : {};

  const { error } = await supabaseAdmin
    .from("licenses")
    .update({
      product_id: product.id,
      token_hash: await hashToken(token),
      token_encrypted: await encryptToken(token),
      token_last4: last4,
      token_preview: `MSKLIVE-****-****-****-${last4}`,
      metadata: {
        ...metadata,
        product_slug: LIVE_PRODUCT_SLUG,
        token_namespace: "MSKLIVE",
        generated_by: "paid-purchase",
      },
    } as never)
    .eq("id", licenseId);

  if (error) throw error;
  return { token, licenseId, productId: String(product.id) };
}
