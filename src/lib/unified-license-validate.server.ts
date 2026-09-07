import { handleAccountTokenValidation } from "./account-license-validate.server";
import { scopeFromProductIdentifier, type LicenseScope } from "./license-scope.server";

/**
 * Validação do banco central de licenças MSK com SEPARAÇÃO POR PRODUTO.
 *
 * Quando o cliente informa o produto (ex.: `msk-live`, `msk-clonador`), a
 * licença precisa pertencer exatamente àquele produto — token do MSK LIVE não
 * valida no Agente, token do Clonador não valida no LIVE, e assim por diante.
 *
 * Sem produto informado, clientes antigos da extensão/agente são resolvidos em
 * UMA única validação. Antes o backend fazia uma validação completa como agent
 * e, em caso de mismatch, repetia todo o pipeline como extension.
 */
export async function handleUnifiedLicenseValidation(
  request: Request,
  bucket: string,
  limit: number,
  fixedProduct?: string | null,
) {
  const body = (await request.clone().json().catch(() => null)) as Record<string, unknown> | null;
  const requestedProduct = fixedProduct ?? (body?.["product"] ? String(body["product"]) : null);
  const requestedScope: LicenseScope | null = await scopeFromProductIdentifier(requestedProduct);

  if (requestedScope) {
    return handleAccountTokenValidation(request, `${bucket}-${requestedScope}`, limit, [
      requestedScope,
    ]);
  }

  // Compatibilidade histórica: Agent + Extensão Principal compartilhavam o
  // mesmo executável. Resolver os dois escopos num único passe evita duplicar
  // lookup de token, produto, perfil, status e telemetria.
  return handleAccountTokenValidation(request, `${bucket}-legacy`, limit, [
    "agent",
    "extension",
  ]);
}
