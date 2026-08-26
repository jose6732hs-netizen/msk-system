import { handleAccountTokenValidation } from "./account-license-validate.server";

async function responseCode(response: Response) {
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    return String(body?.code ?? body?.error ?? "").trim().toUpperCase();
  } catch {
    return "";
  }
}

/**
 * Validação unificada do banco central de licenças MSK.
 *
 * Existe UMA tabela/registro de licenças no SaaS. Este adaptador mantém
 * compatibilidade com licenças emitidas historicamente como `agent` ou
 * `extension`, sem exigir que o cliente escolha produto/rota e sem qualquer
 * vínculo com IP, navegador ou instalação.
 *
 * Só tenta a classificação alternativa quando o servidor confirma
 * LICENSE_PRODUCT_MISMATCH. Token inválido, e-mail incorreto, expiração,
 * revogação e rate limit nunca são contornados.
 */
export async function handleUnifiedLicenseValidation(
  request: Request,
  bucket: string,
  limit: number,
) {
  const agentResponse = await handleAccountTokenValidation(
    request.clone(),
    `${bucket}-agent`,
    limit,
    "agent",
  );

  if ((await responseCode(agentResponse)) !== "LICENSE_PRODUCT_MISMATCH") {
    return agentResponse;
  }

  return handleAccountTokenValidation(
    request,
    `${bucket}-extension`,
    limit,
    "extension",
  );
}
