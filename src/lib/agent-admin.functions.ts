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

async function invokeAiSettings(
  context: any,
  action: "ai-global-status" | "ai-global-save" | "ai-global-delete",
  payload: Record<string, unknown> = {},
) {
  await assertAdmin(context.supabase, context.userId);
  const { data, error } = await context.supabase.functions.invoke("msk-ai-settings", {
    body: { action, ...payload },
  });

  if (error) {
    let detail = error.message || "Falha ao acessar a configuração da IA.";
    const response = (error as any)?.context;
    if (response && typeof response.json === "function") {
      try {
        const body = await response.json();
        detail = String(body?.error || body?.message || detail);
      } catch {
        // Mantém a mensagem original quando o corpo não for JSON.
      }
    }
    throw new Error(detail);
  }

  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const agentAiSettingsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => invokeAiSettings(context, "ai-global-status"));

export const agentAiSettingsSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ apiKey: z.string().min(16).max(600) }).parse(data))
  .handler(async ({ context, data }) => invokeAiSettings(context, "ai-global-save", { apiKey: data.apiKey }));

export const agentAiSettingsDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => invokeAiSettings(context, "ai-global-delete"));
