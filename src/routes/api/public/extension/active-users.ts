import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, preflight } from "@/lib/license.server";

export const Route = createFileRoute("/api/public/extension/active-users")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      GET: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
          const { count } = await (supabaseAdmin as any)
            .from("extension_installations")
            .select("installation_id", { count: "exact", head: true })
            .gte("last_seen_at", since);
          return jsonResponse({ active: Number(count ?? 0) }, 200, request);
        } catch {
          return jsonResponse({ active: 0 }, 200, request);
        }
      },
    },
  },
});
