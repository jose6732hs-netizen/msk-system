import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleValidation } from "@/lib/license-validate.server";

const AGENT_PRODUCT = "msk-agent";

async function asMskAgentRequest(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  return new Request(request.url, {
    method: "POST",
    headers,
    // O produto é fixado no servidor para impedir que a extensão troque o escopo
    // e tente validar uma licença pertencente a outro produto MSK.
    body: JSON.stringify({ ...body, product: AGENT_PRODUCT }),
  });
}

/**
 * Validação da extensão MSK Agente.
 *
 * Este endpoint usa o mesmo banco/segredo de licenças do MSK System e mantém
 * compatibilidade com a tela de KEY da extensão: token + installation_id,
 * sem exigir login ou e-mail no primeiro desbloqueio.
 */
export const Route = createFileRoute("/api/agent/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: async ({ request }) =>
        handleValidation(await asMskAgentRequest(request), "msk-agent-extension", 120, "agent"),
    },
  },
});
