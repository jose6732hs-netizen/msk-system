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
  .replace(/gemini(?:[-_ ]\d+(?:\.\d+)?(?:[-_ ]flash(?:[-_ ]lite)?)?)/gi, "MSK IA")
  .replace(/B\.AI/gi, "MSK");

const normalizeIntent = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\brocho\b/g, "roxo")
  .replace(/\brox+o+\b/g, "roxo")
  .replace(/\bneon+n*\b/g, "neon")
  .replace(/[^a-z0-9#\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const hasEditIntent = (value: unknown) => {
  const text = normalizeIntent(value);
  if (!text) return false;

  if (/\b(mud(?:a|e|ar)|alter(?:a|e|ar)|troc(?:a|e|ar)|corrij(?:a|ir)|adicion(?:a|e|ar)|remov(?:a|e|er)|cri(?:a|e|ar)|fac(?:a|e|er)|implement(?:a|e|ar)|edit(?:a|e|ar)|ajust(?:a|e|ar)|coloqu(?:e|ar)|tir(?:a|e|ar)|exclu(?:a|ir)|delet(?:a|e|ar)|renome(?:ia|ie|ar)|configur(?:a|e|ar)|integr(?:a|e|ar)|conect(?:a|e|ar)|desenvolv(?:a|e|er)|mont(?:a|e|ar)|atualiz(?:a|e|ar)|apliqu(?:e|ar)|substitu(?:a|ir)|arrum(?:a|e|ar)|consert(?:a|e|ar)|ger(?:a|e|ar)|refator(?:a|e|ar)|otimiz(?:a|e|ar)|migr(?:a|e|ar)|prote(?:ja|ger)|bloque(?:ia|ie|ar)|liber(?:a|e|ar)|salv(?:a|e|ar)|cadastr(?:a|e|ar)|instal(?:a|e|ar)|importe|importar|use|usar)\b/.test(text)) return true;

  if (/\b(quero|preciso|necessito)\b.{0,48}\b(checkout|login|cadastro|dashboard|painel|pagina|site|sistema|saas|api|endpoint|banco|database|tabela|rls|webhook|pix|pagamento|assinatura|licenca|componente|botao|formulario|rota|funcao|edge function|arquivo|imagem|logo|copy|texto|cor|fonte|efeito|animacao|menu|navegacao)\b/.test(text)) return true;

  if (/\b(deve ser|tem que ficar|quero que fique|fica|ficar|deixa|deixar)\b.{0,52}\b(cor|fonte|texto|copy|botao|fundo|layout|imagem|logo|roxo|verde|azul|vermelho|amarelo|neon|tamanho|efeito|animacao)\b/.test(text)) return true;

  if (/\b(nao funciona|parou de funcionar|quebrou|esta quebrado|ta quebrado|deu erro|esta dando erro|ta dando erro|corrija o erro|conserte o erro|bug para corrigir|falha para corrigir)\b/.test(text)) return true;

  return false;
};

const isSocialOnly = (value: unknown) => {
  const text = normalizeIntent(value);
  return /^(oi+|ola+|opa+|ei+|hey+|hello+|e ai|bom dia|boa tarde|boa noite|obrigad[oa]|muito obrigad[oa]|valeu|vlw|tmj|entendi|beleza|blz|show|certo|ok|okay|perfeito|top|massa|fechou|combinado|saquei|tudo bem|tudo certo|como vai)(\s+(msk|agente))?$/.test(text);
};

const quickConversationReply = (value: unknown) => {
  const text = normalizeIntent(value);
  if (!text) return "";

  if (/^(oi+|ola+|opa+|ei+|hey+|hello+|e ai|bom dia|boa tarde|boa noite)(\s+(msk|agente))?$/.test(text)) {
    return "Oii! Tudo certo. Sou o MSK Desenvolvedor e estou pronto para trabalhar no seu projeto. Pode me dizer o que você quer criar, corrigir ou alterar.";
  }
  if (/^(obrigad[oa]|muito obrigad[oa]|valeu|vlw|tmj)(\s+.*)?$/.test(text)) {
    return "Por nada! Estou à disposição para continuar desenvolvendo seu projeto. Pode mandar a próxima alteração quando quiser.";
  }
  if (/^(entendi|beleza|blz|show|certo|ok|okay|perfeito|top|massa|fechou|combinado|saquei)(\s+.*)?$/.test(text)) {
    return "Perfeito. Pode mandar a próxima etapa. Vou manter o contexto deste projeto e preservar o que já está funcionando.";
  }
  if (/^(tudo bem|tudo certo|como vai|ta pronto|esta pronto|voce ta pronto|vc ta pronto)$/.test(text)) {
    return "Tudo certo e pronto por aqui. Posso trabalhar em código, interface, APIs, banco de dados, autenticação, checkout, multiusuário, efeitos, navegação e demais partes do projeto.";
  }
  return "";
};

type HistoryItem = { role: string; content: string };

const historyItems = (value: unknown): HistoryItem[] => (Array.isArray(value) ? value : [])
  .map((item: any) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: String(item?.content || "").trim().slice(0, 1400),
  }))
  .filter(item => item.content)
  .slice(-10);

const lastRole = (history: HistoryItem[], role: string) => [...history].reverse().find(item => item.role === role)?.content || "";

const assistantRequestedClarification = (history: HistoryItem[]) => {
  const last = normalizeIntent(lastRole(history, "assistant"));
  return /\b(qual|qual cor|qual texto|qual opcao|me diga|informe|envie|preciso de|confirme|escolha|qual deles|qual delas|onde exatamente|qual elemento)\b/.test(last);
};

const historyHasDevelopmentIntent = (history: HistoryItem[]) => history
  .filter(item => item.role === "user")
  .slice(-5)
  .some(item => hasEditIntent(item.content) || /\b(cor|fonte|copy|texto|botao|layout|checkout|pagamento|banco|login|erro|bug|site|pagina|componente|imagem|logo|menu|navegacao|efeito|animacao)\b/.test(normalizeIntent(item.content)));

const isContextualFollowup = (current: string, history: HistoryItem[]) => {
  const text = normalizeIntent(current);
  if (!text || isSocialOnly(current) || hasEditIntent(current)) return false;
  if (text.split(" ").length > 18) return false;
  if (!historyHasDevelopmentIntent(history)) return false;
  if (assistantRequestedClarification(history)) return true;
  return /^(e\s+)?(sim|nao|isso|essa|esse|aquele|aquela|primeira|segunda|terceira|roxo|roxo neon|verde|verde neon|azul|vermelho|amarelo|branco|preto|laranja|rosa|cinza|#[0-9a-f]{3,8})(\s+.*)?$/.test(text);
};

const activeSkillBlock = (value: any) => {
  const name = String(value?.name || "").trim().slice(0, 80);
  const prompt = String(value?.prompt || "").trim().slice(0, 2200);
  if (!name || !prompt) return "";
  return [
    `SKILL ESCOLHIDA PELO CLIENTE: ${name}`,
    `FOCO OBRIGATÓRIO DA SKILL: ${prompt}`,
    "A skill define a especialização desta execução e deve ser respeitada durante a análise, edição e revisão. Ela não autoriza ampliar o pedido do cliente nem misturar projetos.",
  ].join("\n");
};

const contextualCommand = (current: string, history: HistoryItem[], skill: any, followup: boolean) => {
  const recent = history.slice(-8).map(item => `${item.role === "assistant" ? "MSK" : "CLIENTE"}: ${item.content}`).join("\n");
  const skillBlock = activeSkillBlock(skill);
  if (!recent && !skillBlock) return current;
  return [
    "PEDIDO ATUAL DO CLIENTE:",
    current,
    "",
    recent ? "CONTEXTO RECENTE DESTA MESMA CONVERSA E DESTE MESMO PROJETO:" : "",
    recent,
    "",
    skillBlock,
    "",
    followup ? "REGRA DE CONTINUIDADE: a mensagem atual é uma resposta curta que completa o pedido anterior. Una as informações e execute o pedido completo; não trate a resposta como um novo pedido isolado." : "",
    "REGRA DE LINGUAGEM: entenda português informal, abreviações e erros ortográficos óbvios pelo contexto (por exemplo, 'rocho' = 'roxo' e 'neonn' = 'neon').",
    "REGRA DE AUTONOMIA: não peça ao cliente caminho de arquivo, nome de componente ou detalhe técnico que possa ser localizado com segurança dentro do repositório vinculado. Faça pergunta somente quando a ambiguidade realmente mudar o resultado ou envolver risco de dados/segurança/pagamento.",
  ].filter(Boolean).join("\n");
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

const attachmentArray = (value: unknown) => Array.isArray(value) ? value.slice(0, 8) : [];

async function analyzeAttachments(supabaseUrl: string, command: string, attachments: any[]) {
  if (!attachments.length) return { ok: true, context: "", attachment_count: 0 } as any;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!serviceRole) return { ok: false, error: "O leitor seguro de anexos está temporariamente indisponível.", code: "MSK_ATTACHMENT_SERVICE_UNAVAILABLE" };
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/msk-attachment-analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json" },
      body: JSON.stringify({ command, attachments }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) {
      return {
        ok: false,
        code: String(data?.code || "MSK_ATTACHMENT_ANALYSIS_FAILED"),
        error: String(data?.error || "O MSK não conseguiu ler um dos anexos agora."),
        status: response.status,
      };
    }
    return data;
  } catch {
    return { ok: false, code: "MSK_ATTACHMENT_ANALYSIS_FAILED", error: "O MSK não conseguiu ler os anexos agora. Tente novamente." };
  }
}

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

    const rawBody = await req.text();
    let parsed: any = {};
    try { parsed = rawBody ? JSON.parse(rawBody) : {}; } catch { parsed = {}; }

    const originalCommand = String(parsed?.client_original_command || parsed?.original_command || parsed?.message || parsed?.command || "").trim();
    const history = historyItems(parsed?.history);
    const followup = action === "run" && isContextualFollowup(originalCommand, history);
    const editIntent = action === "run" && (hasEditIntent(originalCommand) || followup);
    const attachments = action === "run" || action === "chat" ? attachmentArray(parsed?.attachments) : [];
    const conversational = action === "run" && !!originalCommand && !editIntent;
    const quickReply = conversational && !attachments.length ? quickConversationReply(originalCommand) : "";

    let attachmentInfo: any = { ok: true, context: "", attachment_count: 0 };
    if (attachments.length) {
      attachmentInfo = await analyzeAttachments(supabaseUrl, originalCommand, attachments);
      if (!attachmentInfo?.ok) {
        return json({
          ok: false,
          code: attachmentInfo.code || "MSK_ATTACHMENT_ANALYSIS_FAILED",
          error: cleanText(attachmentInfo.error || "O MSK não conseguiu ler os anexos agora."),
          message: cleanText(attachmentInfo.error || "O MSK não conseguiu ler os anexos agora."),
        }, Number(attachmentInfo.status || 422));
      }
    }

    const baseContextual = contextualCommand(originalCommand, history, parsed?.active_skill, followup);
    const attachmentContext = String(attachmentInfo?.context || "").trim();
    const augmented = attachmentContext
      ? `${baseContextual || "Analise os anexos enviados no contexto deste projeto."}\n\nCONTEXTO EXTRAÍDO DOS ANEXOS:\n${attachmentContext}`
      : baseContextual;

    const upstreamAction = quickReply ? "status" : conversational ? "chat" : action;
    if (action === "run" || action === "chat") {
      parsed.client_original_command = originalCommand;
      parsed.contextual_followup = followup;
      parsed.context_used = history.length > 0;
      if (upstreamAction === "chat") {
        parsed.message = augmented || originalCommand;
        parsed.command = augmented || originalCommand;
      } else if (upstreamAction === "run") {
        parsed.original_command = augmented || originalCommand;
        parsed.command = augmented || originalCommand;
        parsed.reinforced_command = `${String(parsed.reinforced_command || "").trim()}\n\n${augmented || originalCommand}`.trim();
      }
    }

    if (attachments.length) {
      delete parsed.attachments;
      parsed.attachment_count = Number(attachmentInfo?.attachment_count || attachments.length);
      parsed.attachment_context_used = true;
    }

    const upstream = await fetch(`${supabaseUrl}/functions/v1/msk-agent?action=${encodeURIComponent(upstreamAction)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(parsed),
    });

    const text = await upstream.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { error: "O MSK não conseguiu concluir esta operação agora. Tente novamente." }; }

    if (upstream.status === 546) {
      return json({
        ok: false,
        code: "MSK_EXECUTION_TIMEOUT",
        error: "A execução excedeu o tempo seguro. O MSK interrompeu o processamento para não deixar o projeto preso em uma etapa. Envie novamente o comando; nenhuma conclusão será exibida sem commit confirmado.",
        task_id: parsed?.task_id,
      }, 504);
    }

    if (action === "task-status" && upstream.ok && data?.task) {
      const status = String(data.task.status || "").toLowerCase();
      const updated = Date.parse(String(data.task.updated_at || ""));
      if (["analyzing", "editing", "refining", "finalizing"].includes(status) && Number.isFinite(updated) && Date.now() - updated > 125000) {
        data.task = {
          ...data.task,
          status: "failed",
          error: "A execução anterior excedeu o tempo seguro e foi encerrada para evitar um card preso. Nenhum resultado será marcado como concluído sem commit confirmado.",
        };
      }
    }

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
      const fallback = attachments.length
        ? "Recebi seus anexos, mas a análise completa ficou temporariamente indisponível. Nenhuma alteração foi feita. Tente novamente para eu ler o material antes de mexer no projeto."
        : "Entendi. Estou aqui como desenvolvedor do seu projeto. Posso te orientar e manter o contexto da conversa; quando você pedir uma alteração concreta, trabalho nos arquivos, código e banco sem fingir que concluí antes do commit.";
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
    if (attachments.length && publicData && typeof publicData === "object") {
      publicData.attachments_read = Number(attachmentInfo?.attachment_count || attachments.length);
      publicData.attachment_context_used = true;
    }
    if (followup && publicData && typeof publicData === "object") publicData.contextual_followup = true;
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