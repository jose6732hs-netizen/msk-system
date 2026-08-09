import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, jsonResponse, preflight } from "@/lib/license.server";

/** Compat: build legado da extensão. Fail-closed em qualquer erro. */
export const Route = createFileRoute("/api/public/ext/runtime/manifest")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      GET: async ({ request }) => {
        try {
          const { buildRuntimeManifest } = await import("@/lib/runtime-manifest.server");
          const origin = new URL(request.url).origin;
            const chromeId = request.headers.get("origin")?.match(/^chrome-extension:\/\/([a-p]{32})$/)?.[1];
            return new Response(JSON.stringify(await buildRuntimeManifest(origin, chromeId)), {
            status: 200,
            headers: {
              "content-type": "application/json",
              ...corsHeaders(request),
              "cache-control": "public, max-age=60",
            },
          });
        } catch {
          return jsonResponse(
            { schema: 1, enabled: false, mode: "direct-api", files: [], message: "" },
            200,
            request,
          );
        }
      },
    },
  },
});