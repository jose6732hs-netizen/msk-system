// Camada única de adapters de IA do MSK.
// Todas as IAs entram e saem no MESMO formato interno, e SOMENTE a IA marcada
// como ativa/principal no Super Admin é usada em cada comando (sem fallback
// automático para outro provedor).

export type ProviderId =
  | "synterolink"
  | "omniroute"
  | "openrouter"
  | "openai"
  | "gemini"
  | "groq"
  | "mistral"
  | "manus"
  | "bai";

export type ProviderFamily = "openai" | "anthropic" | "responses";

export type ProviderMeta = {
  id: ProviderId;
  label: string;
  family: ProviderFamily;
  root: string;
  defaultModel: string;
  customBase: boolean;
};

export type ProviderConfig = {
  provider: ProviderId;
  label: string;
  family: ProviderFamily;
  apiKey: string;
  model: string;
  endpoint: string;
};

export type ChatMessage = { role: "system" | "assistant" | "user"; content: string };

export const PROVIDER_CATALOG: Record<ProviderId, ProviderMeta> = {
  synterolink: { id: "synterolink", label: "Claude · SynteroLink", family: "anthropic", root: "https://api.synterolink.com", defaultModel: "claude-sonnet-4-6", customBase: true },
  omniroute: { id: "omniroute", label: "OmniRoute", family: "openai", root: "https://ai.msksystem.online/v1", defaultModel: "z-ai/glm-5.2", customBase: true },
  openrouter: { id: "openrouter", label: "OpenRouter", family: "openai", root: "https://openrouter.ai/api/v1", defaultModel: "z-ai/glm-5.2", customBase: false },
  openai: { id: "openai", label: "OpenAI", family: "openai", root: "https://api.openai.com/v1", defaultModel: "gpt-5.5", customBase: false },
  gemini: { id: "gemini", label: "Google Gemini", family: "openai", root: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.5-flash", customBase: false },
  groq: { id: "groq", label: "Groq", family: "openai", root: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", customBase: false },
  mistral: { id: "mistral", label: "Mistral AI", family: "openai", root: "https://api.mistral.ai/v1", defaultModel: "codestral-latest", customBase: false },
  manus: { id: "manus", label: "Manus AI", family: "responses", root: "https://api.manus.im/v1", defaultModel: "manus-agent-v1", customBase: true },
  bai: { id: "bai", label: "B.AI", family: "openai", root: "https://api.b.ai/v1", defaultModel: "deepseek-v4-flash", customBase: false },
};

/** Reconhece o provedor a partir de qualquer rótulo/id salvo no painel. */
export function normalizeProviderId(value: unknown, fallback: ProviderId = "bai"): ProviderId {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[.\s_-]+/g, "");
  if (!raw) return fallback;
  if (raw.includes("syntero") || raw.includes("claude") || raw.includes("anthropic")) return "synterolink";
  if (raw.includes("openrouter")) return "openrouter";
  if (raw.includes("omniroute") || raw === "omni") return "omniroute";
  if (raw.includes("gemini") || raw.includes("google")) return "gemini";
  if (raw.includes("groq")) return "groq";
  if (raw.includes("mistral") || raw.includes("codestral")) return "mistral";
  if (raw.includes("manus")) return "manus";
  if (raw.includes("openai") || raw.includes("gpt")) return "openai";
  if (raw.includes("bai") || raw.includes("deepseek")) return "bai";
  return fallback;
}

function normalizeModel(provider: ProviderId, value: unknown) {
  let model = String(value ?? "").trim();
  // Sufixos de roteamento que NÃO funcionam em chamadas comuns de chat
  // (ex.: ":batch" no OpenRouter exige a API de lotes e devolve 404).
  model = model.replace(/:(batch|nitro)$/i, "");
  if (model && model.length <= 180 && /^[A-Za-z0-9._:/@+-]+$/.test(model)) return model;
  return PROVIDER_CATALOG[provider].defaultModel;
}

/**
 * Modelos reserva por provedor, tentados NESTA ORDEM quando o modelo
 * configurado é recusado pelo provedor (404/400/422 de modelo inválido,
 * descontinuado ou exclusivo de outra API). Custo zero de descoberta:
 * só roda depois de uma recusa real.
 */
export const MODEL_FALLBACKS: Record<ProviderId, string[]> = {
  synterolink: ["claude-sonnet-4-6", "claude-sonnet-4-5"],
  omniroute: ["z-ai/glm-5.2"],
  openrouter: ["z-ai/glm-5.2", "meta-llama/llama-3.3-70b-instruct", "google/gemini-2.0-flash-001"],
  openai: ["gpt-5.5", "gpt-4.1", "gpt-4o"],
  gemini: ["gemini-2.5-flash", "gemini-2.0-flash"],
  groq: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "qwen/qwen3-32b"],
  mistral: ["codestral-latest", "mistral-large-latest", "mistral-small-latest"],
  manus: ["manus-agent-v1"],
  bai: ["deepseek-v4-flash"],
};

/** Aceita raiz ("https://host/v1"), endpoint completo ou vazio e devolve o endpoint final. */
export function resolveEndpoint(provider: ProviderId, value: unknown) {
  const meta = PROVIDER_CATALOG[provider];
  let raw = String(value ?? "").trim();
  if (!raw) raw = meta.root;
  raw = raw.replace(/\/+$/, "");
  const root = raw
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/messages$/i, "")
    .replace(/\/responses$/i, "");
  let url: URL;
  try {
    url = new URL(root);
  } catch {
    return endpointFor(provider, meta.root);
  }
  if (!/^https?:$/.test(url.protocol)) return endpointFor(provider, meta.root);
  return endpointFor(provider, root);
}

function endpointFor(provider: ProviderId, root: string) {
  const family = PROVIDER_CATALOG[provider].family;
  const base = root.replace(/\/+$/, "");
  if (family === "anthropic") return /\/v\d+$/i.test(base) ? `${base}/messages` : `${base}/v1/messages`;
  if (family === "responses") return `${base}/responses`;
  return `${base}/chat/completions`;
}

export function buildProviderConfig(input: {
  provider: unknown;
  apiKey: string;
  model?: unknown;
  baseUrl?: unknown;
}): ProviderConfig {
  const provider = normalizeProviderId(input.provider);
  const meta = PROVIDER_CATALOG[provider];
  return {
    provider,
    label: meta.label,
    family: meta.family,
    apiKey: String(input.apiKey || "").trim(),
    model: normalizeModel(provider, input.model),
    endpoint: resolveEndpoint(provider, meta.customBase ? input.baseUrl : ""),
  };
}

/** Payload de saída padronizado, independente do provedor. */
export function buildProviderRequest(cfg: ProviderConfig, options: {
  messages: ChatMessage[];
  maxTokens: number;
  jsonMode: boolean;
  forceReasoningStyle?: boolean;

}): { url: string; headers: Record<string, string>; body: unknown } {
  const maxTokens = Math.max(256, Math.min(Number(options.maxTokens || 4000), 18000));
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (cfg.family === "anthropic") {
    headers["x-api-key"] = cfg.apiKey;
    headers["authorization"] = `Bearer ${cfg.apiKey}`;
    headers["anthropic-version"] = "2023-06-01";
    const system = options.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const messages = options.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    if (!messages.length) messages.push({ role: "user", content: system || "" });
    return {
      url: cfg.endpoint,
      headers,
      body: {
        model: cfg.model,
        max_tokens: maxTokens,
        temperature: 0,
        stream: false,
        ...(system ? { system: options.jsonMode ? `${system}\n\nResponda SOMENTE com JSON válido, sem markdown.` : system } : {}),
        messages,
      },
    };
  }

  headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://msksystem.online";
    headers["X-Title"] = "MSK Agente";
  }

  if (cfg.family === "responses") {
    const input = options.messages
      .map((m) => `${m.role === "user" ? "Cliente" : m.role === "assistant" ? "Contexto" : "Sistema"}: ${m.content}`)
      .join("\n\n");
    return {
      url: cfg.endpoint,
      headers,
      body: { model: cfg.model, max_output_tokens: maxTokens, input: options.jsonMode ? `${input}\n\nResponda SOMENTE com JSON válido, sem markdown.` : input },
    };
  }

  const reasoning = isReasoningModel(cfg.model) || options.forceReasoningStyle === true;
  // Modelos de raciocínio (gpt-5.x, o1/o3/o4) consomem tokens pensando ANTES de
  // escrever: sem folga extra a resposta volta vazia/truncada (finish_reason
  // "length"). Eles também recusam temperature != 1 e o campo max_tokens.
  const budget = reasoning ? Math.min(32000, Math.max(maxTokens * 3, 8000)) : maxTokens;
  return {
    url: cfg.endpoint,
    headers,
    body: {
      model: cfg.model,
      messages: options.messages,
      ...(reasoning ? { max_completion_tokens: budget } : { max_tokens: budget, temperature: 0 }),
      ...(reasoning && cfg.provider === "openrouter" ? { reasoning: { effort: "low" } } : {}),
      stream: false,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    },
  };
}

/** gpt-5.x, o1/o3/o4 e similares: raciocínio interno com regras próprias de payload. */
export function isReasoningModel(model: string) {
  const id = String(model || "").toLowerCase().split("/").pop() || "";
  return /^(gpt-5|o[1345](\b|-)|gpt-o)/.test(id) || /(^|[^a-z])(thinking|reason)/.test(id);
}

/** Converte a resposta de qualquer IA para { id, text }. */
export function extractProviderText(cfg: ProviderConfig, payload: any): { id: string; text: string; finishReason: string } {
  const id = String(payload?.id || payload?.response_id || "");
  const finishReason = String(
    payload?.choices?.[0]?.finish_reason || payload?.choices?.[0]?.native_finish_reason || payload?.stop_reason || payload?.status || "",
  );

  if (cfg.family === "anthropic") {
    const parts = Array.isArray(payload?.content) ? payload.content : [];
    const text = parts.map((part: any) => String(part?.text || part?.content || "")).join("").trim();
    return { id, finishReason, text: text || String(payload?.completion || "").trim() };
  }

  if (cfg.family === "responses") {
    if (typeof payload?.output_text === "string" && payload.output_text.trim()) return { id, finishReason, text: payload.output_text.trim() };
    const output = Array.isArray(payload?.output) ? payload.output : [];
    const text = output
      .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
      .filter((part: any) => part?.type === "output_text" || typeof part?.text === "string")
      .map((part: any) => String(part?.text || ""))
      .join("")
      .trim();
    if (text) return { id, finishReason, text };
  }

  const message = payload?.choices?.[0]?.message;
  const raw = typeof message?.content === "string"
    ? message.content
    : Array.isArray(message?.content)
      ? message.content.map((part: any) => String(part?.text || part?.content || "")).join("")
      : String(payload?.choices?.[0]?.text || "");
  // Alguns roteadores devolvem só o campo de raciocínio quando o texto final vem vazio.
  const fallback = typeof message?.reasoning_content === "string"
    ? message.reasoning_content
    : typeof message?.reasoning === "string"
      ? message.reasoning
      : "";
  return { id, finishReason, text: String(raw || "").trim() || String(fallback || "").trim() };
}
