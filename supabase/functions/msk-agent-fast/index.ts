const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license, x-msk-installation-id, x-msk-extension-version, x-msk-extension-id, x-msk-build-id, x-msk-integrity-root, x-msk-build-fingerprint, x-msk-device-session, x-msk-proof-version, x-msk-timestamp, x-msk-counter, x-msk-body-sha256, x-msk-signature, x-msk-target, x-msk-action",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!base) return json({ ok: false, code: "MSK_UNAVAILABLE", error: "MSK indisponível." }, 503);

  const url = new URL(req.url);
  const body = await req.text();
  const headers = new Headers();
  for (const name of [
    "authorization", "apikey", "content-type", "x-msk-session", "x-msk-license",
    "x-msk-installation-id", "x-msk-extension-version", "x-msk-extension-id",
    "x-msk-build-id", "x-msk-integrity-root", "x-msk-build-fingerprint",
    "x-msk-device-session", "x-msk-proof-version", "x-msk-timestamp",
    "x-msk-counter", "x-msk-body-sha256", "x-msk-signature", "x-msk-target",
    "x-msk-action",
  ]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");

  try {
    const upstream = await fetch(`${base}/functions/v1/msk-agent?${url.searchParams.toString()}`, {
      method: "POST",
      headers,
      body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch {
    return json({
      ok: false,
      code: "MSK_FAST_PROXY_ERROR",
      retryable: true,
      error: "A rota rápida ficou temporariamente indisponível; tente novamente.",
    }, 503);
  }
});
