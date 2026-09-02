import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-license",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Secret ausente no servidor: ${name}`);
  return value;
};

const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
const supabaseUrl = required("SUPABASE_URL");
const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

const SAAS_SUPABASE_URL = "https://zjrrymncmiyftyogejjr.supabase.co";
const SAAS_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T4c9lObE149Nozgc9xQqvg_C46uHzYA";
const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), c => c.charCodeAt(0));

const PROVIDERS = {
  bai: {
    label: "B.AI",
    baseUrl: "https://api.b.ai/v1/chat/completions",
    defaultModel: "deepseek-v4-flash",
    custom: false,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openai/gpt-5.5",
    custom: false,
  },
  omniroute: {
    label: "OmniRoute",
    baseUrl: "http://127.0.0.1:20128/v1/chat/completions",
    defaultModel: "z-ai/glm-5.2",
    custom: true,
  },
} as const;
type ProviderId = keyof typeof PROVIDERS;

function normalizeProvider(value: unknown): ProviderId {
  const raw = String(value || "bai").trim().toLowerCase();
  if (raw.includes("omniroute") || raw === "omni_route") return "omniroute";
  if (raw.includes("openrouter") || raw === "open_router") return "openrouter";
  return "bai";
}
function normalizeModel(provider: ProviderId, value: unknown) {
  const model = String(value || "").trim();
  if (model && model.length <= 160 && /^[A-Za-z0-9._:/@+\-]+$/.test(model)) return model;
  return PROVIDERS[provider].defaultModel;
}

/** Aceita "https://host/v1" ou o endpoint completo e devolve raiz + endpoints OpenAI-compatible. */
function resolveEndpoints(provider: ProviderId, value: unknown) {
  const fallback = PROVIDERS[provider].baseUrl;
  let raw = String(value || "").trim();
  if (!PROVIDERS[provider].custom || !raw) raw = fallback;
  raw = raw.replace(/\/+$/, "");
  const root = raw.replace(/\/chat\/completions$/i, "");
  let url: URL;
  try { url = new URL(root); } catch {
    const error = new Error("Base URL inválida. Use algo como http://127.0.0.1:20128/v1");
    (error as any).status = 400;
    throw error;
  }
  if (!/^https?:$/.test(url.protocol)) {
    const error = new Error("Base URL precisa começar com http:// ou https://");
    (error as any).status = 400;
    throw error;
  }
  return { root, chatUrl: `${root}/chat/completions`, modelsUrl: `${root}/models` };
}


async function encryptionMaterial() {
  const configured = Deno.env.get("MSK_TOKEN_ENCRYPTION_KEY")?.trim() || "";
  if (configured) {
    const candidate = /^[A-Za-z0-9_-]{43,44}$/.test(configured) ? fromB64url(configured) : encoder.encode(configured);
    if (candidate.length === 32) return candidate;
  }
  const serverSecret = Deno.env.get("MSK_STATE_SECRET")?.trim() || serviceRole;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`msk-ai-settings:v1:${serverSecret}`)));
}
async function encryptionKey() {
  return crypto.subtle.importKey("raw", await encryptionMaterial(), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(value)));
  return b64url(new Uint8Array([...iv, ...cipher]));
}
async function decrypt(value: string) {
  const raw = fromB64url(value);
  const iv = raw.slice(0, 12);
  const cipher = raw.slice(12);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await encryptionKey(), cipher));
}

function bearer(req: Request) {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

async function currentAdmin(req: Request) {
  const token = bearer(req);
  if (!token || token.split(".").length !== 3) return null;
  const saas = createClient(SAAS_SUPABASE_URL, SAAS_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await saas.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: roles, error: rolesError } = await saas
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .in("role", ["admin", "super_admin"]);
  if (rolesError || !roles?.length) return null;
  return { id: data.user.id, kind: "admin" as const };
}

async function currentUser(req: Request) {
  const token = bearer(req);
  if (!token || token.startsWith("sb_publishable_")) return null;

  try {
    const local = await db.auth.getUser(token);
    if (!local.error && local.data.user) return { id: local.data.user.id, kind: "local" as const };
  } catch {}

  for (const origin of ["https://msksystem.online", "https://msk-system.lovable.app"]) {
    try {
      const response = await fetch(`${origin}/api/extension/license-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      if (data?.ok && data?.active && /^[0-9a-f-]{36}$/i.test(String(data.user_id))) {
        return { id: String(data.user_id), kind: "license" as const };
      }
    } catch {}
  }
  return null;
}

function safeMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  let budget = 0;
  const out: Array<{ role: string; content: string }> = [];
  for (const item of value.slice(-24)) {
    const role = ["system", "assistant", "user"].includes(String(item?.role)) ? String(item.role) : "user";
    const content = String(item?.content || "").slice(0, 120000);
    if (!content) continue;
    budget += content.length;
    if (budget > 220000) break;
    out.push({ role, content });
  }
  return out;
}

async function validateProviderKey(provider: ProviderId, apiKey: string, model: string, chatUrl?: string) {
  const cfg = PROVIDERS[provider];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = "https://msksystem.online";
      headers["X-Title"] = "MSK Agente";
    }
    const response = await fetch(chatUrl || cfg.baseUrl, {
      method: "POST",

      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply only OK" }],
        max_tokens: 8,
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body: any = null;
    try { body = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) {
      const message = String(body?.error?.message || body?.message || `A IA respondeu HTTP ${response.status}`).slice(0, 300);
      const error = new Error(message);
      (error as any).status = [400, 401, 403, 404].includes(response.status) ? 400 : 502;
      throw error;
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("A IA demorou demais para validar a chave. Tente novamente.");
      (timeoutError as any).status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const countBy = (rows: any[], field: string) => {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row?.[field] || "unknown");
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "editor-chat") {
      const who = (await currentAdmin(req)) || (await currentUser(req));
      if (!who) return json({ error: { message: "Sessão MSK necessária para usar a IA do editor." } }, 401);

      const requestedProject = String(body?.lovable_project_id || body?.projectId || "").trim();
      if (requestedProject && requestedProject !== "2763a21e-c47d-4e62-bc58-ab51fe5dc2d5") {
        return json({ error: { message: "Projeto Lovable não autorizado para este editor." } }, 403);
      }

      const messages = safeMessages(body?.messages);
      if (!messages.length) return json({ error: { message: "Nenhuma mensagem válida foi enviada à IA." } }, 400);

      const { data: cfg, error } = await db
        .from("msk_ai_settings")
        .select("provider,model,api_base_url,api_key_ciphertext,active")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw error;
      if (!cfg?.active || !cfg?.api_key_ciphertext) {
        return json({ error: { message: "Nenhuma API de IA ativa foi configurada no painel MSK." } }, 503);
      }

      const provider = String(cfg.provider || "B.AI");
      const model = String(cfg.model || "deepseek-v4-flash");
      const openrouter = provider.toLowerCase().includes("openrouter");
      const baseUrl = String(cfg.api_base_url || (openrouter ? PROVIDERS.openrouter.baseUrl : PROVIDERS.bai.baseUrl));
      const apiKey = await decrypt(String(cfg.api_key_ciphertext));
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
      if (openrouter) {
        headers["HTTP-Referer"] = "https://msksystem.online";
        headers["X-Title"] = "MSK Agente Editor";
      }

      const upstreamBody: Record<string, unknown> = {
        model,
        messages,
        max_tokens: Math.max(256, Math.min(18000, Number(body?.max_tokens || body?.max_completion_tokens || 8000))),
        temperature: Number.isFinite(Number(body?.temperature)) ? Math.max(0, Math.min(1.5, Number(body.temperature))) : 0,
        stream: false,
      };
      if (body?.response_format && typeof body.response_format === "object") upstreamBody.response_format = body.response_format;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90_000);
      try {
        let upstream = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(upstreamBody),
          signal: controller.signal,
        });
        if (!upstream.ok && upstreamBody.response_format && [400, 404, 422].includes(upstream.status)) {
          delete upstreamBody.response_format;
          upstream = await fetch(baseUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(upstreamBody),
            signal: controller.signal,
          });
        }
        const raw = await upstream.text();
        let parsed: any = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch {}
        if (!upstream.ok) {
          const detail = String(parsed?.error?.message || parsed?.message || `Provedor respondeu HTTP ${upstream.status}`).slice(0, 500);
          return json({ error: { message: detail, type: "msk_upstream_error", provider: "MSK" } }, upstream.status === 429 ? 429 : 502);
        }
        if (!parsed?.choices?.[0]?.message) return json({ error: { message: "A IA respondeu sem conteúdo utilizável." } }, 502);
        return json({ ...parsed, model: "MSK-IA", provider: "MSK" });
      } finally {
        clearTimeout(timer);
      }
    }

    const admin = await currentAdmin(req);
    if (!admin) return json({ error: "Acesso restrito a administradores." }, 403);

    if (action === "agent-errors") {
      const days = Math.max(1, Math.min(90, Number(body?.days || 7)));
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await db.from("msk_agent_errors")
        .select("id,task_id,user_id,lovable_project_id,repository,branch_name,stage,code,message,retryable,attempt,created_at")
        .gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      const rows = data || [];
      const internal = rows.filter((r: any) => r.code === "INTERNAL_ERROR");
      const total = rows.length;
      const internalRate = total ? (internal.length / total) * 100 : 0;
      return json({
        ok: true, days,
        summary: { total, internal: internal.length, internalRate, retryable: rows.filter((r: any) => r.retryable).length, alert: total >= 5 && internalRate > 5 },
        byCode: countBy(rows, "code").slice(0, 20),
        byStage: countBy(rows, "stage").slice(0, 20),
        recent: rows.slice(0, 100).map((r: any) => ({ id: r.id, taskId: r.task_id, userId: r.user_id, projectId: r.lovable_project_id, repository: r.repository, branch: r.branch_name, stage: r.stage, code: r.code, message: r.message, retryable: !!r.retryable, attempt: Number(r.attempt || 0), createdAt: r.created_at })),
      });
    }

    if (action === "agent-error-detail") {
      const id = String(body?.errorId || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "ID de erro inválido." }, 400);
      const { data, error } = await db.from("msk_agent_errors").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Erro não encontrado." }, 404);
      return json({ ok: true, error: data });
    }

    if (action === "ai-global-status") {
      const { data, error } = await db.from("msk_ai_settings").select("provider,model,api_base_url,api_key_ciphertext,api_key_last4,active,updated_at").eq("id", "default").maybeSingle();
      if (error) throw error;
      const providerId = normalizeProvider(data?.provider);
      const storedBase = String(data?.api_base_url || PROVIDERS[providerId].baseUrl).replace(/\/chat\/completions$/i, "");
      return json({
        configured: !!(data?.active && data?.api_key_ciphertext && data?.api_key_last4),
        provider: data?.provider || "B.AI",
        providerId,
        baseUrl: storedBase,
        model: data?.model || PROVIDERS[providerId].defaultModel,
        keyMasked: data?.api_key_last4 ? `••••${data.api_key_last4}` : null,
        updatedAt: data?.updated_at || null,
      });
    }

    // Lista os modelos disponíveis no provedor (GET {BASE_URL}/models).
    if (action === "ai-global-models" || action === "ai-global-test") {
      const provider = normalizeProvider(body?.provider);
      const endpoints = resolveEndpoints(provider, body?.baseUrl);
      let apiKey = String(body?.apiKey || "").trim();
      if (!apiKey) {
        const { data } = await db.from("msk_ai_settings").select("api_key_ciphertext,provider").eq("id", "default").maybeSingle();
        if (data?.api_key_ciphertext && normalizeProvider(data.provider) === provider) {
          apiKey = await decrypt(String(data.api_key_ciphertext)).catch(() => "");
        }
      }
      if (!apiKey) return json({ error: "Informe a Secret Key deste provedor primeiro." }, 400);

      if (action === "ai-global-test") {
        await validateProviderKey(provider, apiKey, normalizeModel(provider, body?.model), endpoints.chatUrl);
        return json({ ok: true, tested: true });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(endpoints.modelsUrl, { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal });
        if (!response.ok) {
          return json({
            error: response.status === 401 || response.status === 403
              ? "Secret Key recusada pelo provedor."
              : `O provedor respondeu HTTP ${response.status} ao listar modelos.`,
          }, 400);
        }
        const payload = await response.json().catch(() => ({}));
        const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
        const models = [...new Set(list.map((m: any) => String(m?.id || m?.name || "").replace(/^models\//, "")).filter(Boolean))].sort();
        return json({ ok: true, models });
      } catch (error: any) {
        if (error?.name === "AbortError") return json({ error: "O provedor demorou demais para responder." }, 504);
        return json({ error: "Não foi possível falar com o provedor nesta Base URL." }, 502);
      } finally {
        clearTimeout(timer);
      }
    }

    if (action === "ai-global-save") {
      const apiKey = String(body?.apiKey || "").trim();
      if (apiKey.length < 16 || apiKey.length > 600) return json({ error: "API key inválida." }, 400);
      const provider = normalizeProvider(body?.provider);
      const model = normalizeModel(provider, body?.model);
      const endpoints = resolveEndpoints(provider, body?.baseUrl);
      await validateProviderKey(provider, apiKey, model, endpoints.chatUrl);
      const ciphertext = await encrypt(apiKey);
      const now = new Date().toISOString();
      const last4 = apiKey.slice(-4);
      const cfg = PROVIDERS[provider];
      const { data: saved, error } = await db.from("msk_ai_settings").upsert({
        id: "default",
        provider: cfg.label,
        model,
        api_base_url: endpoints.chatUrl,
        api_key_ciphertext: ciphertext,
        api_key_last4: last4,
        active: true,
        updated_by: admin.id,
        updated_at: now,
      }, { onConflict: "id" }).select("id,provider,model,api_base_url,api_key_ciphertext,api_key_last4,active,updated_at").single();
      if (error) throw error;
      if (!saved?.active || !saved.api_key_ciphertext || saved.api_key_last4 !== last4) {
        const persistenceError = new Error("A chave foi validada, mas o banco não confirmou a gravação.");
        (persistenceError as any).status = 500;
        throw persistenceError;
      }
      return json({ ok: true, configured: true, provider: saved.provider, providerId: provider, baseUrl: endpoints.root, model: saved.model, keyMasked: `••••${saved.api_key_last4}`, updatedAt: saved.updated_at || now });
    }


    if (action === "ai-global-delete") {
      const { error } = await db.from("msk_ai_settings").delete().eq("id", "default");
      if (error) throw error;
      return json({ ok: true, configured: false });
    }

    return json({ error: "Ação não reconhecida." }, 400);
  } catch (error: any) {
    const raw = String(error?.message || "Falha interna ao configurar a IA.");
    console.error("msk-ai-settings", raw);
    const status = Number(error?.status || 500);
    const safeMessage = /MSK_(?:TOKEN_ENCRYPTION_KEY|STATE_SECRET)|Secret ausente/i.test(raw) ? "A configuração segura da IA está temporariamente indisponível." : raw.slice(0, 500);
    return json({ error: safeMessage }, status >= 400 && status <= 599 ? status : 500);
  }
});