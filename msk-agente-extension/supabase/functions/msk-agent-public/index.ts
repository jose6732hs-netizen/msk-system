const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const cleanText = (value: unknown) => String(value ?? "")
  .replace(/deepseek(?:\s*v4\s*flash|[-_ ]v4[-_ ]flash)?/gi, "MSK IA")
  .replace(/B\.AI/gi, "MSK");

const sanitize = (data: any, upstreamStatus: number) => {
  const source = data && typeof data === "object" ? { ...data } : { error: cleanText(data) };
  const raw = `${source.code || ""} ${source.error || ""} ${source.message || ""}`;
  const githubInternal = /GITHUB_APP_PRIVATE_KEY_INVALID|GITHUB_APP_CREDENTIALS_INVALID|GITHUB_APP_PRIVATE_KEY|PRIVATE\s*KEY|chave\s+privada|ASN\.?1|PKCS|RSA\s+PRIVATE|incorrect length|constructed/i.test(raw);
  const aiInternal = /Nenhuma API da IA foi configurada|Cadastre a chave no painel|BAI_API_KEY|api_key_ciphertext|MSK_TOKEN_ENCRYPTION_KEY|MSK_AI_UNAVAILABLE_INTERNAL|B\.AI\s*\d{3}/i.test(raw);

  if ("provider" in source) source.provider = "MSK";
  if ("model" in source) source.model = "MSK-IA";
  for (const key of ["assistant_message", "message", "summary", "error"]) {
    if (typeof source[key] === "string") source[key] = cleanText(source[key]);
  }

  if (githubInternal) {
    return {
      ...source,
      ok: false,
      connected: false,
      code: "GITHUB_TEMPORARILY_UNAVAILABLE",
      error: "Não foi possível concluir a conexão com o GitHub agora. Tente novamente em instantes.",
      message: "Não foi possível concluir a conexão com o GitHub agora. Tente novamente em instantes.",
      status: upstreamStatus || 500,
    };
  }

  if (aiInternal) {
    return {
      ...source,
      ok: false,
      code: "MSK_AI_TEMPORARILY_UNAVAILABLE",
      error: "A inteligência MSK está temporariamente indisponível. Tente novamente em instantes.",
      message: "A inteligência MSK está temporariamente indisponível. Tente novamente em instantes.",
      status: upstreamStatus || 500,
    };
  }

  return source;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const action = new URL(req.url).searchParams.get("action") || "status";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (!supabaseUrl) return json({ ok: false, code: "MSK_UNAVAILABLE", error: "O MSK está temporariamente indisponível." }, 503);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    for (const name of ["authorization", "apikey", "x-msk-session", "x-msk-license"]) {
      const value = req.headers.get(name);
      if (value) headers[name] = value;
    }

    const body = await req.text();
    const upstream = await fetch(`${supabaseUrl}/functions/v1/msk-agent?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers,
      body,
    });

    const text = await upstream.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { error: "O MSK não conseguiu concluir esta operação agora. Tente novamente." }; }

    const publicData = sanitize(data, upstream.status);
    return json(publicData, upstream.status);
  } catch (error) {
    console.error("MSK public gateway internal error", error instanceof Error ? error.message : "unknown");
    return json({
      ok: false,
      code: "MSK_TEMPORARILY_UNAVAILABLE",
      error: "O MSK está temporariamente indisponível. Tente novamente em instantes.",
    }, 503);
  }
});
