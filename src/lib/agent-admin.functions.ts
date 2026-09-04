import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

// Multi-API admin must always use the current backend. A stale environment
// override previously routed OmniRoute saves to legacy msk-ai-settings, where
// unknown providers were normalized as B.AI.
const AGENT_AI_SETTINGS_URL =
  "https://iybjfmhqbblrppqoodyf.supabase.co/functions/v1/msk-ai-admin-v2";
const AGENT_SUPABASE_PUBLISHABLE_KEY =
  process.env['MSK_AGENT_SUPABASE_PUBLISHABLE_KEY']?.trim() ||
  "sb_publishable_-aERipV8XmdiDq9UMERZUA_OIyOeyzD";

export const agentAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadAgentAdmin } = await import("./agent-admin.server");
    return loadAgentAdmin();
  });

export type AgentAiProviderId =
  | "bai"
  | "openrouter"
  | "openai"
  | "gemini"
  | "groq"
  | "manus"
  | "mistral"
  | "omniroute"
  | "synterolink";

export type AgentAiProviderStatus = {
  providerId: AgentAiProviderId;
  provider: string;
  model: string;
  models: string[];
  baseUrl: string;
  configured: boolean;
  active: boolean;
  primary: boolean;
  keyMasked: string | null;
  updatedAt: string | null;
};

const DEFAULT_MODELS: Record<AgentAiProviderId, string> = {
  bai: "deepseek-v4-flash",
  openrouter: "z-ai/glm-5.2",
  openai: "gpt-5.5",
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  manus: "manus-agent-v1",
  mistral: "codestral-latest",
  omniroute: "z-ai/glm-5.2",
  synterolink: "claude-sonnet-4-6",
};

function normalizeProviderId(value: unknown): AgentAiProviderId {
  const raw = String(value || "bai").trim().toLowerCase().replace(/[.\s_-]+/g, "");
  if (raw.includes("synterolink") || raw.includes("syntero") || raw.includes("claudeproxy") || raw === "claude") return "synterolink";
  if (raw.includes("openrouter")) return "openrouter";
  if (raw === "openai" || raw.includes("openaiofficial")) return "openai";
  if (raw.includes("omniroute") || raw.includes("omniroad") || raw === "omni") return "omniroute";
  if (raw.includes("gemini") || raw.includes("google")) return "gemini";
  if (raw.includes("groq")) return "groq";
  if (raw.includes("manus")) return "manus";
  if (raw.includes("mistral")) return "mistral";
  return "bai";
}

function firstRow(data: unknown): Record<string, any> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, any> | undefined) ?? null;
  return data && typeof data === "object" ? (data as Record<string, any>) : null;
}

function normalizeProviderRow(value: any): AgentAiProviderStatus {
  const providerId = normalizeProviderId(value?.providerId || value?.provider_id || value?.provider);
  return {
    providerId,
    provider: String(value?.provider || providerId),
    model: String(value?.model || DEFAULT_MODELS[providerId]),
    models: Array.isArray(value?.models) && value.models.length ? value.models.map(String) : [DEFAULT_MODELS[providerId]],
    baseUrl: String(value?.baseUrl || value?.base_url || ""),
    configured: !!value?.configured,
    active: !!value?.active,
    primary: !!value?.primary,
    keyMasked: value?.keyMasked ? String(value.keyMasked) : value?.key_masked ? String(value.key_masked) : null,
    updatedAt: value?.updatedAt ? String(value.updatedAt) : value?.updated_at ? String(value.updated_at) : null,
  };
}

function normalizeStatus(data: unknown) {
  const row = firstRow(data);
  const providerId = normalizeProviderId(row?.['providerId'] || row?.['provider_id'] || row?.['provider']);
  const providers = Array.isArray(row?.['providers']) ? row!['providers'].map(normalizeProviderRow) : [];
  return {
    configured: !!row?.['configured'],
    provider: String(row?.['provider'] || "B.AI"),
    providerId,
    model: String(row?.['model'] || DEFAULT_MODELS[providerId]),
    keyMasked: row?.['keyMasked'] ? String(row['keyMasked']) : row?.['key_masked'] ? String(row['key_masked']) : null,
    updatedAt: row?.['updatedAt'] ? String(row['updatedAt']) : row?.['updated_at'] ? String(row['updated_at']) : null,
    primaryProviderId: normalizeProviderId(row?.['primaryProviderId'] || row?.['primary_provider_id'] || providerId),
    providers,
  };

}

async function agentAiRequest(action: string, payload: Record<string, unknown> = {}) {
  const request = getRequest();
  const authorization = request?.headers?.get("authorization")?.trim() || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Sessão administrativa inválida. Entre novamente no painel.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(AGENT_AI_SETTINGS_URL, {
      method: "POST",
      headers: {
        Authorization: authorization,
        apikey: AGENT_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body: any = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const message = typeof body?.error === "string" ? body.error : body?.error?.message || body?.message;
      throw new Error(String(message || `HTTP ${response.status}`).slice(0, 500));
    }
    return body || {};
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("O backend do MSK demorou demais para responder. Tente novamente.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const agentErrorAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ days: z.number().int().min(1).max(90).default(7) }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return agentAiRequest("agent-errors", { days: data.days });
  });

export const agentErrorDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ errorId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return agentAiRequest("agent-error-detail", { errorId: data.errorId });
  });

const providerSchema = z.enum([
  "bai",
  "openrouter",
  "openai",
  "gemini",
  "groq",
  "manus",
  "mistral",
  "omniroute",
  "synterolink",
]);

export const agentAiSettingsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return normalizeStatus(await agentAiRequest("ai-global-status"));
  });

export const agentAiSettingsSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      apiKey: z.string().min(8).max(1200),
      provider: providerSchema,
      model: z.string().trim().min(2).max(180),
      baseUrl: z.string().trim().max(500).optional().default(""),
      makePrimary: z.boolean().optional().default(false),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return normalizeStatus(
      await agentAiRequest("ai-global-save", {
        ...data,
        apiKey: data.apiKey.trim(),
        model: data.model.trim(),
        baseUrl: data.baseUrl.trim(),
      }),
    );
  });

export const agentAiProviderToggle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: providerSchema, active: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return normalizeStatus(await agentAiRequest("ai-provider-toggle", data));
  });

export const agentAiProviderPrimary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: providerSchema }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return normalizeStatus(await agentAiRequest("ai-provider-primary", data));
  });

export const agentAiProviderModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: providerSchema, model: z.string().trim().min(2).max(180) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return normalizeStatus(await agentAiRequest("ai-provider-model", data));
  });

export const agentAiSettingsDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: providerSchema }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return normalizeStatus(await agentAiRequest("ai-global-delete", data));
  });
