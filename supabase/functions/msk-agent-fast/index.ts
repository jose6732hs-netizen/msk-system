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
    if (url.searchParams.get("action") === "run") {
      const preflight = await fetch(`${base}/functions/v1/msk-agent-preflight?action=preflight`, {
        method: "POST",
        headers,
        body,
      });
      const preflightText = await preflight.text();
      let preflightData: any = {};
      try { preflightData = preflightText ? JSON.parse(preflightText) : {}; } catch {}
      if (!preflight.ok || preflightData?.ready !== true) {
        return new Response(preflightText || JSON.stringify({ ready: false, blockers: [{ code: "PREFLIGHT_FAILED", message: "O pre-flight não autorizou o envio." }], warnings: [] }), {
          status: preflight.status || 409,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (preflightData?.context?.force_pr === true) {
        let directCommit = true;
        try { directCommit = JSON.parse(body || "{}")?.direct_commit !== false; } catch {}
        if (directCommit) {
          return json({
            ready: false,
            blockers: [{ code: "BRANCH_PROTECTED", message: "A branch é protegida. Reenvie a tarefa em modo branch/PR.", action: "Usar Pull Request" }],
            warnings: preflightData?.warnings || [],
            context: preflightData?.context || null,
          }, 409);
        }
      }
    }

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
      error: "A rota de execução ficou temporariamente indisponível; tente novamente.",
    }, 503);
  }
});
