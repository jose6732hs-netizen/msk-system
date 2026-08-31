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

const hasEditIntent = (value: unknown) => {
  const text = normalizeIntent(value);
  if (!text) return false;

  // Pedido explícito de implementação/alteração.
  if (/\b(mud(?:a|e|ar)|alter(?:a|e|ar)|troc(?:a|e|ar)|corrij(?:a|ir)|adicion(?:a|e|ar)|remov(?:a|e|er)|cri(?:a|e|ar)|fac(?:a|e|er)|implement(?:a|e|ar)|edit(?:a|e|ar)|ajust(?:a|e|ar)|coloqu(?:e|ar)|tir(?:a|e|ar)|exclu(?:a|ir)|delet(?:a|e|ar)|renome(?:ia|ie|ar)|configur(?:a|e|ar)|integr(?:a|e|ar)|conect(?:a|e|ar)|desenvolv(?:a|e|er)|mont(?:a|e|ar)|atualiz(?:a|e|ar)|apliqu(?:e|ar)|substitu(?:a|ir)|arrum(?:a|e|ar)|consert(?:a|e|ar)|ger(?:a|e|ar)|refator(?:a|e|ar)|otimiz(?:a|e|ar)|migr(?:a|e|ar)|prote(?:ja|ger)|bloque(?:ia|ie|ar)|liber(?:a|e|ar)|salv(?:a|e|ar)|cadastr(?:a|e|ar))\b/.test(text)) return true;

  // Intenção natural: "quero um checkout", "preciso de login", etc.
  if (/\b(quero|preciso|necessito)\b.{0,32}\b(checkout|login|cadastro|dashboard|painel|pagina|site|sistema|saas|api|endpoint|banco|database|tabela|rls|webhook|pix|pagamento|assinatura|licenca|componente|botao|formulario|rota|funcao|edge function)\b/.test(text)) return true;

  // Relato claro de bug também é trabalho de desenvolvimento.
  if (/\b(nao funciona|parou de funcionar|quebrou|esta quebrado|ta quebrado|deu erro|esta dando erro|ta dando erro|bug|falha)\b/.test(text)) return true;

  return false;
};

const quickConversationReply = (value: unknown) => {
  const text = normalizeIntent(value);
  if (!text) return "";

  if (/^(oi+|ola+|opa+|ei+|hey+|hello+|e ai|bom dia|boa tarde|boa noite)(\s+(msk|agente))?$/.test(text)) {
    return "Oii! Tudo certo. Sou o MSK Desenvolvedor e estou pronto para trabalhar no seu projeto. Pode me dizer o que você quer criar, corrigir ou alterar.";
  }
  if (/^(obrigad[oa]|muito obrigad[oa]|valeu|vlw|tmj|agradeco|agradecido|thanks)(\s+.*)?$/.test(text)) {
    return "Por nada! Estou à disposição para continuar desenvolvendo seu projeto. Pode mandar a próxima alteração quando quiser.";
  }
  if (/^(entendi|beleza|blz|show|certo|ok|okay|perfeito|top|massa|fechou|combinado|saquei)(\s+.*)?$/.test(text)) {
    return "Perfeito. Pode mandar a próxima etapa. Vou tratar tudo pelo lado de desenvolvimento e preservar o que já está funcionando no projeto.";
  }
  if (/^(tudo bem|tudo certo|como vai|ta pronto|esta pronto|voce ta pronto|vc ta pronto)$/.test(text)) {
    return "Tudo certo e pronto por aqui. Posso trabalhar em código, interface, APIs, banco de dados, autenticação, checkout, multiusuário e demais partes do seu projeto.";
  }
  return "";
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
    const conversational = action === "run" && !!command && !hasEditIntent(command);
    const quickReply = conversational ? quickConversationReply(command) : "";

    // Conversa curta só precisa validar a sessão/projeto; conversa aberta usa a IA em modo desenvolvedor.
    const upstreamAction = quickReply ? "status" : conversational ? "chat" : action;
    const upstream = await fetch(`${supabaseUrl}/functions/v1/msk-agent?action=${encodeURIComponent(upstreamAction)}`, {
      method: "POST",
      headers,
      body,
    });

    const text = await upstream.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { error: "O MSK não conseguiu concluir esta operação agora. Tente novamente." }; }

    if (quickReply && upstream.ok) {
      return json({
        ok: true,
        connected: data?.connected !== false,
        repository: data?.repository || "",
        mode: "chat",
        no_edit: true,
        developer_mode: true,
        assistant_message: quickReply,
        message: quickReply,
        model: "MSK-IA",
        provider: "MSK",
      }, 200);
    }

    if (conversational && !upstream.ok) {
      // Nunca deixa conversa simples sem retorno, mas também não finge que editou código.
      const fallback = "Entendi. Estou aqui como desenvolvedor do seu projeto. Posso te orientar e, quando você pedir uma alteração concreta, trabalho nos arquivos, código e banco de dados sem marcar nada como concluído antes da aplicação real.";
      return json({
        ok: true,
        connected: data?.connected !== false,
        mode: "chat",
        no_edit: true,
        developer_mode: true,
        degraded: true,
        assistant_message: fallback,
        message: fallback,
        model: "MSK-IA",
        provider: "MSK",
      }, 200);
    }

    const publicData = sanitize(data, upstream.status);
    if (conversational && publicData && typeof publicData === "object") {
      publicData.mode = "chat";
      publicData.no_edit = true;
      publicData.developer_mode = true;
    }
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
