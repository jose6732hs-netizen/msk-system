import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveLicenseSnapshot } from "./license-entitlements.server";
import { resolveLicenseProductBinding, resolveProductIdentifier } from "./license-product.server";

/**
 * Escopo = PARA QUAL PRODUTO a licença vale.
 * Cada produto valida apenas o próprio token: MSK LIVE só no MSK LIVE,
 * Clonador só no Clonador, Agente só no Agente, e assim por diante.
 */
export type LicenseScope = "live" | "cloner" | "agent" | "extension" | "delivery";

const SCOPES: LicenseScope[] = ["live", "cloner", "agent", "extension", "delivery"];

export function isLicenseScope(value: unknown): value is LicenseScope {
  return typeof value === "string" && (SCOPES as string[]).includes(value);
}

/** Traduz o slug do produto (tabela products) para o escopo de validação. */
export function scopeFromProductSlug(slug?: string | null): LicenseScope | null {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "msk-live" || s.startsWith("msk-live")) return "live";
  if (s.includes("clon")) return "cloner";
  if (s.includes("agent")) return "agent";
  if (s.includes("chatgpt") || s.includes("gpt")) return "delivery";
  if (s.includes("extens")) return "extension";
  return null;
}

/**
 * Resolve o escopo real da licença no banco:
 * 1) products.slug via licenses.product_id (vínculo oficial);
 * 2) reconciliação por transação/oferta/plano (persistindo product_id);
 * 3) fallback pelo snapshot/role para licenças realmente legadas.
 */
export async function resolveLicenseScope(
  license: any,
  expectedProductIdentifier?: string | null,
): Promise<{ scope: LicenseScope; productSlug: string | null; source: string }> {
  const snapshot = resolveLicenseSnapshot(license);

  const binding = await resolveLicenseProductBinding({
    licenseId: String(license?.id ?? ""),
    planId: license?.plan_id ?? null,
    expectedProductIdentifier: expectedProductIdentifier ?? null,
  });

  const bySlug = scopeFromProductSlug(binding.product?.slug);
  if (bySlug) {
    return { scope: bySlug, productSlug: binding.product?.slug ?? null, source: binding.source };
  }

  return {
    scope: (isLicenseScope(snapshot.role) ? snapshot.role : "extension") as LicenseScope,
    productSlug: binding.product?.slug ?? null,
    source: binding.product ? binding.source : "snapshot",
  };
}

/** Escopo esperado a partir do identificador de produto enviado/fixado pelo endpoint. */
export async function scopeFromProductIdentifier(identifier?: string | null) {
  const direct = scopeFromProductSlug(identifier);
  if (direct) return direct;
  const product = await resolveProductIdentifier(identifier);
  return scopeFromProductSlug(product?.slug ?? null);
}

/** Nome amigável do produto para as mensagens de erro. */
export function scopeLabel(scope: LicenseScope) {
  switch (scope) {
    case "live":
      return "MSK LIVE";
    case "cloner":
      return "MSK Clonador";
    case "agent":
      return "MSK Agente";
    case "delivery":
      return "Entrega digital";
    default:
      return "Extensão MSK";
  }
}

/** Só para diagnóstico administrativo. */
export async function licenseScopeById(licenseId: string) {
  const { data } = await supabaseAdmin
    .from("licenses")
    .select("id,plan_id,product_id,metadata,plans(slug,name,features)")
    .eq("id", licenseId)
    .maybeSingle();
  if (!data) return null;
  return resolveLicenseScope(data);
}
