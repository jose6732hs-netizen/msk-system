import { createFileRoute } from "@tanstack/react-router";
import { supabaseServer } from "@/integrations/supabase/client.server";
import { compileGlobalTraining } from "@/lib/ai-global-training.server";
import { findLicenseByToken, isTrustedExtensionOrigin, rateLimit } from "@/lib/license.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type IncomingMessage = { role?: string; content?: unknown };

function cors(request: Request) {
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

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(request) },
  });
}

function credential(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() ?? "";
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
      if (part?.type === "image" || part?.type === "image_url" || part?.type === "document") {
        return "[Anexo multimodal fornecido pelo cliente e já descrito/contextualizado pela extensão MSK]";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

async function handle(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) return json(request, { ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);

  const token = credential(request);
  if (!token) return json(request, { ok: false, code: "LICENSE_REQUIRED", error: "Licença MSK necessária." }, 401);
  const license = (await findLicenseByToken(token)) as any;
  if (!activeLicense(license)) return json(request, { ok: false, code: "LICENSE_INVALID", error: "Licença MSK inválida ou expirada." }, 401);
  if (!(await rateLimit("extension-ai-inference", String(license.id), 240))) {
    return json(request, { ok: false, code: "RATE_LIMITED", error: "Muitas solicitações. Aguarde alguns segundos." }, 429);
  }

  let payload: { system?: string; messages?: IncomingMessage[]; max_tokens?: number; temperature?: number };
  try { payload = (await request.json()) as any; }
  catch { return json(request, { ok: false, code: "INVALID_JSON", error: "Requisição inválida." }, 400); }

  const messages = (Array.isArray(payload.messages) ? payload.messages : [])
    .filter((m) => m && ["user", "assistant"].includes(String(m.role || "")))
    .slice(-16)
    .map((m) => ({ role: String(m.role), content: textFromContent(m.content).slice(0, 120000) }))
    .filter((m) => m.content.trim().length > 0);
  if (!messages.length) return json(request, { ok: false, code: "EMPTY_PROMPT", error: "Envie uma mensagem." }, 400);

  const { data: trainingRows } = await (supabaseServer as any).rpc("msk_ai_global_training_runtime");
  const training = compileGlobalTraining((trainingRows ?? []) as any[]).text;
  const requestedSystem = String(payload.system || "").slice(0, 80000);
  const system = [
    "Você é o MSK Cloud AI, motor oficial do MSK Agente.",
    "Siga o pedido do cliente com precisão. Trabalhe apenas no escopo pedido; não reescreva partes não solicitadas.",
    "Para edição simples, produza o menor patch possível. Para diagnóstico, encontre a causa real antes de modificar arquivos.",
    "Prompts grandes e claros devem ser decompostos internamente e concluídos sem parar apenas pelo tamanho.",
    requestedSystem,
    training ? `\n=== TREINAMENTO GLOBAL MSK ===\n${training}\n=== FIM TREINAMENTO GLOBAL ===` : "",
  ].filter(Boolean).join("\n\n");

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(request, { ok: false, code: "AI_PROVIDER_NOT_CONFIGURED", error: "Provider MSK não configurado." }, 503);
  const model = process.env["MSK_EXTENSION_AI_MODEL"] || DEFAULT_MODEL;
  const maxTokens = Math.min(16000, Math.max(512, Number(payload.max_tokens || 8000)));

  const aiRes = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: Number.isFinite(payload.temperature) ? payload.temperature : 0.15, messages: [{ role: "system", content: system }, ...messages] }),
  });

  if (!aiRes.ok) {
    const detail = (await aiRes.text().catch(() => "")).slice(0, 500);
    console.error("[MSK Extension AI] gateway failure", aiRes.status, detail);
    const code = aiRes.status === 429 ? "AI_RATE_LIMITED" : aiRes.status === 402 ? "AI_CREDITS_EXHAUSTED" : "AI_GATEWAY_FAILED";
    return json(request, { ok: false, code, error: code === "AI_RATE_LIMITED" ? "Muitas solicitações. Tentando novamente em instantes." : "A IA MSK ficou indisponível temporariamente." }, aiRes.status === 429 ? 429 : 502);
  }

  const data = (await aiRes.json()) as any;
  const reply = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!reply) return json(request, { ok: false, code: "EMPTY_AI_RESPONSE", error: "A IA não retornou conteúdo." }, 502);

  const usage = data?.usage || {};
  try {
    await (supabaseServer as any).from("agent_usage").insert({
      user_id: license.user_id,
      model,
      input_tokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
      output_tokens: Number(usage.completion_tokens || usage.output_tokens || 0),
      estimated_cost_usd: 0,
    });
  } catch {}

  // Compatível com o formato Anthropic usado por versões anteriores da extensão e com clientes MSK novos.
  return json(request, {
    ok: true,
    model,
    reply,
    content: [{ type: "text", text: reply }],
    usage,
  });
}

export const Route = createFileRoute("/api/extension/agent")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
      POST: ({ request }) => handle(request),
    },
  },
});
