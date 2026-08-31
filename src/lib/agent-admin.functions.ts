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
  const { data, error } = await context.supabase.functions.invoke("msk-api", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || "Falha ao acessar a configuração da IA.");
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
