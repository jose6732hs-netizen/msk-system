import { handleAccountTokenValidation } from "./account-license-validate.server";
import { scopeFromProductIdentifier, type LicenseScope } from "./license-scope.server";

async function responseCode(response: Response) {
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    return String(body?.["code"] ?? body?.["error"] ?? "").trim().toUpperCase();
  } catch {
    return "";
  }
}

/**
 * Validação do banco central de licenças MSK com SEPARAÇÃO POR PRODUTO.
 *
 * Quando o cliente informa o produto (ex.: `msk-live`, `msk-clonador`), a
 * licença precisa pertencer exatamente àquele produto — token do MSK LIVE não
 * valida no Agente, token do Clonador não valida no LIVE, e assim por diante.
 *
 * Sem produto informado, o endpoint continua servindo os clientes legados da
 * extensão/agente, que compartilham o mesmo executável.
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

  const agentResponse = await handleAccountTokenValidation(
    request.clone(),
    `${bucket}-agent`,
    limit,
    ["agent"],
  );

  if ((await responseCode(agentResponse)) !== "LICENSE_PRODUCT_MISMATCH") {
    return agentResponse;
  }

  return handleAccountTokenValidation(request, `${bucket}-extension`, limit, ["extension"]);
}
