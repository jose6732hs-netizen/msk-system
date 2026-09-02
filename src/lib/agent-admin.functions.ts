import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

const AGENT_AI_SETTINGS_URL =
  process.env['MSK_AGENT_AI_SETTINGS_URL']?.trim() ||
  "https://iybjfmhqbblrppqoodyf.supabase.co/functions/v1/msk-ai-settings";
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

function firstRow(data: unknown): any {
  if (Array.isArray(data)) return (data[0] as Record<string, any> | undefined) ?? null;
  return data && typeof data === "object" ? (data as any) : null;
}

function normalizeStatus(data: unknown) {
  const row = firstRow(data);
  const providerId = String(row?.providerId || row?.provider_id || "").toLowerCase();
  return {
    configured: !!row?.configured,
    provider: String(row?.provider || "B.AI"),
    providerId: providerId.includes("omniroute")
      ? ("omniroute" as const)
      : providerId.includes("openrouter")
        ? ("openrouter" as const)
        : ("bai" as const),
    baseUrl: row?.baseUrl ? String(row.baseUrl) : row?.base_url ? String(row.base_url) : "",
    model: String(row?.model || "deepseek-v4-flash"),
    keyMasked: row?.keyMasked ? String(row.keyMasked) : row?.key_masked ? String(row.key_masked) : null,
    updatedAt: row?.updatedAt ? String(row.updatedAt) : row?.updated_at ? String(row.updated_at) : null,
  };
}


async function agentAiRequest(action: string, payload: Record<string, unknown> = {}) {
  const request = getRequest();
  const authorization = request?.headers?.get("authorization")?.trim() || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Sessão administrativa inválida. Entre novamente no painel.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(AGENT_AI_SETTINGS_URL, {
      method: "POST",
      headers: { Authorization: authorization, apikey: AGENT_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body: any = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    if (!response.ok) throw new Error(String(body?.error || body?.message || "O backend do MSK Agente não confirmou a operação.").slice(0, 400));
    return body || {};
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("O backend do MSK Agente demorou demais para responder. Tente novamente.");
    throw error;
  } finally { clearTimeout(timer); }
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

export const agentAiSettingsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return normalizeStatus(await agentAiRequest("ai-global-status"));
  });

export const agentAiSettingsSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ apiKey: z.string().min(16).max(600) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const apiKey = data.apiKey.trim();
    const saved = await agentAiRequest("ai-global-save", { apiKey });
    const normalized = normalizeStatus(saved);
    if (!normalized.configured || !normalized.keyMasked) throw new Error("A chave foi validada, mas o backend do MSK Agente não confirmou a gravação.");
    return { ok: true, ...normalized };
  });

export const agentAiSettingsDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    await agentAiRequest("ai-global-delete");
    return { ok: true, configured: false };
  });
