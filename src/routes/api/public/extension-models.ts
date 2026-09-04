import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Catálogo público de modelos que o Super Admin liberou para a extensão.
 * Nunca expõe API Keys — somente id do provedor, id do modelo e rótulo.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/extension-models")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const url = process.env['SUPABASE_URL'];
        const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
        if (!url || !key) return Response.json({ ok: false, models: [] }, { status: 503, headers: CORS });


        const supabase = createClient(url, key, {
          auth: { persistSession: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const { data, error } = await supabase
          .from("msk_extension_models")
          .select("provider_id, model_id, label, focus, is_free, note, sort_order")
          .eq("visible", true)
          .order("sort_order", { ascending: true });

        if (error) return Response.json({ ok: false, models: [], error: error.message }, { status: 500 });

        return Response.json(
          {
            ok: true,
            models: (data ?? []).map((row) => ({
              provider: row.provider_id,
              model: row.model_id,
              label: row.label,
              focus: row.focus,
              free: row.is_free,
              note: row.note,
            })),
          },
          { headers: { "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
