const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license, x-msk-installation-id, x-msk-extension-version, x-msk-extension-id, x-msk-build-id, x-msk-integrity-root, x-msk-build-fingerprint, x-msk-device-session, x-msk-proof-version, x-msk-timestamp, x-msk-counter, x-msk-body-sha256, x-msk-signature, x-msk-target, x-msk-action",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const cleanText = (value: unknown) => String(value ?? "")
  .replace(/deepseek(?:\s*v4\s*flash|[-_ ]v4[-_ ]flash)?/gi, "MSK IA")
  .replace(/B\.AI/gi, "MSK");

const normalizeIntent = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const isSimpleConversation = (value: unknown) => {
  const text = normalizeIntent(value);
  if (!text || text.split(" ").length > 10) return false;

  const editIntent = /\b(mud(?:a|e|ar)|alter(?:a|e|ar)|troc(?:a|e|ar)|corrij(?:a|ir)|adicion(?:a|e|ar)|remov(?:a|e|er)|cri(?:a|e|ar)|fac(?:a|er)|implement(?:a|e|ar)|edit(?:a|e|ar)|ajust(?:a|e|ar)|coloqu(?:e|ar)|tir(?:a|e|ar)|exclu(?:a|ir)|delet(?:a|e|ar)|renome(?:ia|ie|ar))\b/.test(text);
  if (editIntent) return false;

  return /^(oi+|ola+|opa+|ei+|hey+|hello+|e ai|bom dia|boa tarde|boa noite|tudo bem|tudo certo|como vai|ta pronto|esta pronto|vc ta pronto|voce ta pronto)(\s+(msk|agente))?(\s+(tudo bem|tudo certo|ta pronto|esta pronto))?$/.test(text);
};

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
    for (const name of ["authorization", "apikey", "x-msk-session", "x-msk-license", "x-msk-installation-id", "x-msk-extension-version", "x-msk-extension-id", "x-msk-build-id", "x-msk-integrity-root", "x-msk-build-fingerprint", "x-msk-device-session", "x-msk-proof-version", "x-msk-timestamp", "x-msk-counter", "x-msk-body-sha256", "x-msk-signature", "x-msk-target", "x-msk-action"]) {
      const value = req.headers.get(name);
      if (value) headers[name] = value;
    }

    const body = await req.text();
    let parsed: any = {};
    try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = {}; }

    const command = String(parsed?.original_command || parsed?.message || parsed?.command || "").trim();
    const simpleConversation = action === "run" && isSimpleConversation(command);

    const upstreamAction = simpleConversation ? "status" : action;
    const upstream = await fetch(`${supabaseUrl}/functions/v1/msk-agent?action=${encodeURIComponent(upstreamAction)}`, {
      method: "POST",
      headers,
      body,
    });

    const text = await upstream.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { error: "O MSK não conseguiu concluir esta operação agora. Tente novamente." }; }

    if (simpleConversation && upstream.ok) {
      const reply = "Oii! Estou pronto para mexer no seu projeto. Me diga o que você quer alterar.";
      return json({
        ok: true,
        connected: data?.connected !== false,
        repository: data?.repository || "",
        mode: "chat",
        no_edit: true,
        assistant_message: reply,
        message: reply,
        model: "MSK-IA",
        provider: "MSK",
      }, 200);
    }

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
