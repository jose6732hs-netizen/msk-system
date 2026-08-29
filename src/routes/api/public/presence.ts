import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { jsonResponse, preflight } from "@/lib/license.server";

function client() {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Presença real (sem dados de usuários no retorno): apenas { online: n }.
 * GET  -> contagem atual
 * POST -> heartbeat da sessão + contagem atual
 */
export const Route = createFileRoute("/api/public/presence")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      GET: async ({ request }) => {
        try {
          const { data } = await client().rpc("presence_online_count" as never);
          return jsonResponse({ online: Number(data ?? 0) }, 200, request);
        } catch {
          return jsonResponse({ online: 0 }, 200, request);
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as { session_id?: string };
          const sessionId = String(body.session_id ?? "").trim();
          if (sessionId.length < 8 || sessionId.length > 100) {
            return jsonResponse({ online: 0 }, 400, request);
          }
          const { data } = await client().rpc("presence_heartbeat" as never, {
            _session_id: sessionId,
          } as never);
          return jsonResponse({ online: Number(data ?? 0) }, 200, request);
        } catch {
          return jsonResponse({ online: 0 }, 200, request);
        }
      },
    },
  },
});
