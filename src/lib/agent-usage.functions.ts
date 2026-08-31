import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export const agentUsageAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(120).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadAgentUsageAnalytics } = await import("./agent-usage.server");
    return loadAgentUsageAnalytics(data.days);
  });

export const agentHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadAgentHealth } = await import("./agent-usage.server");
    const health = await loadAgentHealth();

    const { data: aiData } = await (context.supabase as any).rpc("msk_ai_settings_status");
    const aiRow = Array.isArray(aiData) ? aiData[0] : aiData;
    const aiConfigured = !!aiRow?.configured;

    const checks = (health.checks ?? []).map((check: any) =>
      check.key === "gateway"
        ? {
            ...check,
            status: aiConfigured ? "up" : "down",
            detail: aiConfigured ? "IA do MSK configurada no SaaS" : "Chave da IA não configurada",
          }
        : check,
    );

    const overall = checks.some((c: any) => c.status === "down")
      ? "down"
      : checks.some((c: any) => c.status === "degraded")
        ? "degraded"
        : "up";

    return { ...health, checks, overall };
  });
