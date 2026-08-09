import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders } from "@/lib/license.server";

/**
 * Caminho legado hardcoded no build antigo da extensão (/ext/runtime/manifest).
 * Redireciona para o endpoint público oficial, eliminando o 404.
 */
export const Route = createFileRoute("/ext/runtime/manifest")({
  server: {
    handlers: {
      OPTIONS: ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        return Response.redirect(`${origin}/api/public/ext/runtime/manifest`, 302);
      },
    },
  },
});