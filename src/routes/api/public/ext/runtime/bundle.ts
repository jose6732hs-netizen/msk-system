import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, preflight } from "@/lib/license.server";

export const Route = createFileRoute("/api/public/ext/runtime/bundle")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      GET: async ({ request }) => {
        let body = "/* runtime indisponível */\n";
        try {
          const { buildRuntimeBundle } = await import("@/lib/runtime-manifest.server");
          body = await buildRuntimeBundle(new URL(request.url).origin);
        } catch {
          // fail-closed: bundle vazio
        }
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            ...corsHeaders(request),
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});