import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, preflight } from "@/lib/license.server";
import { openApiSpec } from "@/lib/openapi.server";

/** GET /api/public/openapi — especificação OpenAPI 3.1 em JSON. */
export const Route = createFileRoute("/api/public/openapi")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      GET: ({ request }) =>
        new Response(JSON.stringify(openApiSpec(new URL(request.url).origin), null, 2), {
          status: 200,
          headers: {
            "content-type": "application/json",
            ...corsHeaders(request),
            "cache-control": "public, max-age=300",
          },
        }),
    },
  },
});