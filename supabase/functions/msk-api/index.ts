const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authorization = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || "";
  const contentType = req.headers.get("content-type") || "application/json";
  const body = await req.text();

  const upstream = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/msk-ai-settings`, {
    method: "POST",
    headers: {
      authorization,
      apikey,
      "content-type": contentType,
      "x-client-info": "msk-api-compat/1.0",
    },
    body,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...cors, "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
});
