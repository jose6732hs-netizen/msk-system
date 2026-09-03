import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

const AI_ADMIN_URL =
  process.env['MSK_MULTI_AI_ADMIN_URL']?.trim() ||
  "https://iybjfmhqbblrppqoodyf.supabase.co/functions/v1/msk-ai-admin-v2";
const AI_SUPABASE_KEY =
  process.env['MSK_AGENT_SUPABASE_PUBLISHABLE_KEY']?.trim() ||
  "sb_publishable_-aERipV8XmdiDq9UMERZUA_OIyOeyzD";

const providerId = z.enum(["bai", "openrouter", "gemini", "groq", "manus", "mistral", "claude"]);
export type AiProviderId = z.infer<typeof providerId>;

export type AiProviderRow = {
  id: AiProviderId;
  label: string;
  api_base_url: string;
  model: string | null;
  models: string[];
  configured: boolean;
  key_masked: string | null;
  enabled: boolean;
  is_primary: boolean;
  last_status: string | null;
  last_checked_at: string | null;
  updated_at: string | null;
};

const BASE_URLS: Record<AiProviderId, string> = {
  bai: "https://api.b.ai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  manus: "https://api.manus.im/v1/responses",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  claude: "https://api.synterolink.com/v1/chat/completions",
};

async function adminRequest(action: string, payload: Record<string, unknown> = {}) {
  const request = getRequest();
  const authorization = request?.headers?.get("authorization")?.trim() || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Sessão administrativa inválida. Entre novamente no painel.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(AI_ADMIN_URL, {
      method: "POST",
      headers: { Authorization: authorization, apikey: AI_SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body: any = null;
    try { body = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) throw new Error(String(typeof body?.error === "string" ? body.error : body?.error?.message || body?.message || "O servidor multi-IA não confirmou a operação.").slice(0, 400));
    return body || {};
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("O servidor multi-IA demorou demais para responder.");
    throw error;
  } finally { clearTimeout(timer); }
}

function mapRows(data: any): AiProviderRow[] {
  return (Array.isArray(data?.providers) ? data.providers : []).flatMap((row: any) => {
    const parsed = providerId.safeParse(row.providerId || row.provider_id);
    if (!parsed.success) return [];
    const id = parsed.data;
    return [{
      id,
      label: String(row.provider || id),
      api_base_url: BASE_URLS[id],
      model: row.model ? String(row.model) : null,
      models: Array.isArray(row.models) ? row.models.map(String) : [],
      configured: !!row.configured,
      key_masked: row.keyMasked ? String(row.keyMasked) : null,
      enabled: !!row.active,
      is_primary: !!row.primary,
      last_status: row.configured ? (row.active ? "active" : "paused") : null,
      last_checked_at: row.updatedAt ? String(row.updatedAt) : null,
      updated_at: row.updatedAt ? String(row.updatedAt) : null,
    };
  });
}

export const aiProvidersStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return mapRows(await adminRequest("ai-global-status"));
  });

export const aiProviderSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: providerId, apiKey: z.string().trim().min(8).max(600), model: z.string().trim().min(2).max(160) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    await adminRequest("ai-global-save", { provider: data.id, apiKey: data.apiKey, model: data.model, makePrimary: false });
    return { ok: true as const };
  });

export const aiProviderSetPrimary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: providerId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    await adminRequest("ai-provider-primary", { provider: data.id });
    return { ok: true as const };
  });

export const aiProviderSetEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: providerId, enabled: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    await adminRequest("ai-provider-toggle", { provider: data.id, active: data.enabled });
    return { ok: true as const };
  });

export const aiProviderDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: providerId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    await adminRequest("ai-global-delete", { provider: data.id });
    return { ok: true as const };
  });

export const aiProviderModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: providerId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const rows = mapRows(await adminRequest("ai-global-status"));
    const row = rows.find((item) => item.id === data.id);
    return row ? { ok: true as const, models: row.models } : { ok: false as const, error: "Provedor não encontrado." };
  });
