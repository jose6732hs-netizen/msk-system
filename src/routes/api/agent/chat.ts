import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/integrations/supabase/client.server";
import { compileGlobalTraining } from "@/lib/ai-global-training.server";
import { findLicenseByToken, isTrustedExtensionOrigin, rateLimit } from "@/lib/license.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const SITE_SYSTEM_PROMPT = [
  "Você é o MSK Agente, o agente técnico oficial do MSK SISTEM.",
  "Responda sempre em português do Brasil, de forma curta, técnica e profissional.",
  "Seu papel: ajudar o usuário a entender, planejar e preparar alterações no projeto dele.",
  "Nunca afirme que editou, publicou, fez merge ou executou qualquer ação: você apenas planeja e explica.",
  "Ações destrutivas, merge ou publicação exigem confirmação explícita do usuário e execução pelo backend.",
  "Se faltar informação, peça o que precisa em vez de supor.",
].join("\n");

type ChatMessage = { role: "user" | "assistant"; content: unknown };

function extensionCors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = !origin || isTrustedExtensionOrigin(origin);
  return {
    ...(origin && allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "authorization, content-type, x-api-key, anthropic-version, x-msk-extension-version, x-msk-installation-id, x-msk-extension-id",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function isExtensionRequest(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  return Boolean(
    request.headers.get("x-msk-extension-version") ||
      request.headers.get("x-msk-installation-id") ||
      request.headers.get("x-api-key") ||
      origin.startsWith("chrome-extension://") ||
      origin.startsWith("moz-extension://"),
  );
}

function bearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function extensionCredential(request: Request) {
  return bearer(request) || request.headers.get("x-api-key")?.trim() || "";
}

function activeLicense(row: any) {
  if (!row || String(row.status).toLowerCase() !== "active" || row.revoked_at) return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  return true;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: any) => {
      if (typeof part === "string") return part;
      if (part?.type === "text" && typeof part.text === "string") return part.text;
      if (["image", "image_url", "document"].includes(String(part?.type || ""))) {
        return "[Anexo multimodal fornecido pelo cliente e já contextualizado pela extensão MSK]";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

async function callGateway(system: string, messages: Array<{ role: string; content: string }>, maxTokens = 8000, temperature = 0.15) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false as const, status: 503, code: "AI_PROVIDER_NOT_CONFIGURED", error: "Provider MSK não configurado." };

  const model = process.env["MSK_EXTENSION_AI_MODEL"] || DEFAULT_MODEL;
  const aiRes = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(16000, Math.max(512, Number(maxTokens || 8000))),
      temperature: Number.isFinite(temperature) ? temperature : 0.15,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!aiRes.ok) {
    const detail = (await aiRes.text().catch(() => "")).slice(0, 500);
    console.error("[MSK AI] gateway failure", aiRes.status, detail);
    const code = aiRes.status === 429 ? "AI_RATE_LIMITED" : aiRes.status === 402 ? "AI_CREDITS_EXHAUSTED" : "AI_GATEWAY_FAILED";
    return {
      ok: false as const,
      status: aiRes.status === 429 ? 429 : 502,
      code,
      error: code === "AI_RATE_LIMITED" ? "Muitas solicitações. Tentando novamente em instantes." : "A IA MSK ficou indisponível temporariamente.",
    };
  }

  const data = (await aiRes.json()) as any;
  const reply = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!reply) return { ok: false as const, status: 502, code: "EMPTY_AI_RESPONSE", error: "A IA não retornou conteúdo." };
  return { ok: true as const, model, reply, usage: data?.usage || {} };
}

async function extensionChat(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const cors = extensionCors(request);
  if (origin && !isTrustedExtensionOrigin(origin)) return json({ ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403, cors);

  const token = extensionCredential(request);
  if (!token) return json({ ok: false, code: "LICENSE_REQUIRED", error: "Licença MSK necessária." }, 401, cors);
  const license = (await findLicenseByToken(token)) as any;
  if (!activeLicense(license)) return json({ ok: false, code: "LICENSE_INVALID", error: "Licença MSK inválida ou expirada." }, 401, cors);
  if (!(await rateLimit("extension-ai-inference", String(license.id), 240))) {
    return json({ ok: false, code: "RATE_LIMITED", error: "Muitas solicitações. Tentando novamente em instantes." }, 429, cors);
  }

  let payload: { system?: string; messages?: ChatMessage[]; max_tokens?: number; temperature?: number };
  try {
    payload = (await request.json()) as any;
  } catch {
    return json({ ok: false, code: "INVALID_JSON", error: "Requisição inválida." }, 400, cors);
  }

  const messages = (Array.isArray(payload.messages) ? payload.messages : [])
    .filter((m) => m && ["user", "assistant"].includes(String(m.role || "")))
    .slice(-16)
    .map((m) => ({ role: String(m.role), content: textFromContent(m.content).slice(0, 120000) }))
    .filter((m) => m.content.trim().length > 0);
  if (!messages.length) return json({ ok: false, code: "EMPTY_PROMPT", error: "Envie uma mensagem." }, 400, cors);

  const { data: trainingRows } = await (supabaseServer as any).rpc("msk_ai_global_training_runtime");
  const training = compileGlobalTraining((trainingRows ?? []) as any[]).text;
  const requestedSystem = String(payload.system || "").slice(0, 80000);
  const system = [
    "Você é o MSK Cloud AI, motor oficial do MSK Agente.",
    "Siga o pedido do cliente com precisão e trabalhe somente no escopo solicitado.",
    "Edição simples exige o menor patch possível: não reescreva página, imports, estado, handlers, loaders ou arquitetura se isso não foi pedido.",
    "Antes de propor arquivo alterado, confirme que o alvo existe no projeto recebido. Nunca invente exports, funções, APIs, rotas ou componentes.",
    "Para diagnóstico, encontre a causa real antes de modificar arquivos. Se uma tentativa falhar, use a evidência do erro para corrigir e continue a mesma tarefa.",
    "Prompts longos e claros devem ser decompostos internamente e concluídos; só pergunte quando faltar uma decisão real de produto do cliente.",
    requestedSystem,
    training ? `\n=== TREINAMENTO GLOBAL MSK ===\n${training}\n=== FIM TREINAMENTO GLOBAL ===` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await callGateway(system, messages, Number(payload.max_tokens || 8000), Number(payload.temperature ?? 0.15));
  if (!result.ok) return json({ ok: false, code: result.code, error: result.error }, result.status, cors);

  try {
    await (supabaseServer as any).from("agent_usage").insert({
      user_id: license.user_id,
      model: result.model,
      input_tokens: Number(result.usage?.prompt_tokens || result.usage?.input_tokens || 0),
      output_tokens: Number(result.usage?.completion_tokens || result.usage?.output_tokens || 0),
      estimated_cost_usd: 0,
    });
  } catch {}

  return json(
    {
      ok: true,
      model: result.model,
      reply: result.reply,
      content: [{ type: "text", text: result.reply }],
      usage: result.usage,
    },
    200,
    cors,
  );
}

async function siteChat(request: Request) {
  const token = bearer(request);
  if (!token) return json({ error: "Sessão não encontrada. Entre novamente." }, 401);

  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json({ error: "Backend indisponível no momento." }, 500);

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (SUPABASE_PUBLISHABLE_KEY.startsWith("sb_") && headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
        if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);
  const userId = userData.user.id;
  const nowIso = new Date().toISOString();
  const [licenses, roles] = await Promise.all([
    supabase.from("licenses").select("id, status, starts_at, expires_at, plan_id").eq("user_id", userId).eq("status", "active").lte("starts_at", nowIso).or(`expires_at.is.null,expires_at.gt.${nowIso}`).limit(50),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles.data ?? []).some((r: { role: string }) => ["admin", "super_admin"].includes(r.role));
  let hasChatLicense = false;
  const planIds = Array.from(new Set((licenses.data ?? []).map((l) => l.plan_id).filter(Boolean)));
  if (!isAdmin && planIds.length > 0) {
    const { data: plans } = await supabase.from("plans").select("id, status, features").in("id", planIds);
    hasChatLicense = (plans ?? []).some((p) => {
      if (p.status !== "active") return false;
      const f = p.features as Record<string, unknown> | null;
      return !!f && f["chat"] === true;
    });
  }
  if (!hasChatLicense && !isAdmin) return json({ error: "Seu plano atual não inclui o MSK Agente.", requiresPlan: true }, 403);

  let payload: { messages?: ChatMessage[] };
  try {
    payload = (await request.json()) as any;
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  const messages = (payload.messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-12)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  if (!messages.length) return json({ error: "Envie uma mensagem." }, 400);

  const result = await callGateway(SITE_SYSTEM_PROMPT, messages, 4000, 0.2);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ reply: result.reply });
}

export const Route = createFileRoute("/api/agent/chat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: extensionCors(request) }),
      POST: ({ request }) => (isExtensionRequest(request) ? extensionChat(request) : siteChat(request)),
    },
  },
});
