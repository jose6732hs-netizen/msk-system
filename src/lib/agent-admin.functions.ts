import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export const agentAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadAgentAdmin } = await import("./agent-admin.server");
    return loadAgentAdmin();
  });

function firstRow(data: unknown): Record<string, any> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, any> | undefined) ?? null;
  return data && typeof data === "object" ? (data as Record<string, any>) : null;
}

function normalizeStatus(data: unknown) {
  const row = firstRow(data);
  return {
    configured: !!row?.configured,
    provider: String(row?.provider || "B.AI"),
    model: String(row?.model || "deepseek-v4-flash"),
    keyMasked: row?.key_masked ? String(row.key_masked) : null,
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
  };
}

async function validateBaiKey(apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.b.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [{ role: "user", content: "Reply only OK" }],
        max_tokens: 8,
        temperature: 0,
        stream: false,
      }),
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
      const providerMessage = String(
        body?.error?.message || body?.message || `A IA respondeu HTTP ${response.status}`,
      ).slice(0, 300);
      throw new Error(providerMessage);
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("A IA demorou demais para validar a chave. Tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const agentAiSettingsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any).rpc("msk_ai_settings_status");
    if (error) throw error;
    return normalizeStatus(data);
  });

export const agentAiSettingsSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ apiKey: z.string().min(16).max(600) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const apiKey = data.apiKey.trim();

    // Valida a credencial no servidor antes de substituir a configuração atual.
    await validateBaiKey(apiKey);

    const { data: saved, error } = await (context.supabase as any).rpc("msk_ai_settings_save", {
      p_api_key: apiKey,
      p_provider: "B.AI",
      p_model: "deepseek-v4-flash",
      p_base_url: "https://api.b.ai/v1/chat/completions",
    });
    if (error) throw error;

    const normalized = normalizeStatus(saved);
    if (!normalized.configured || !normalized.keyMasked) {
      throw new Error("A chave foi validada, mas o banco não confirmou a gravação.");
    }
    return { ok: true, ...normalized };
  });

export const agentAiSettingsDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as any).rpc("msk_ai_settings_delete");
    if (error) throw error;
    return { ok: true, configured: false };
  });
