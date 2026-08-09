import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Visão consolidada da aba "Gerar token" (saldo, tokens e teste). */
export const getTokenOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAllowances, loadTenantTokens, loadTrialStatus } = await import("./tokens.server");
    const [allowance, tokens, trial] = await Promise.all([
      loadAllowances(context.userId),
      loadTenantTokens(context.userId),
      loadTrialStatus(context.userId),
    ]);
    return {
      allowance: {
        total: allowance.total,
        used: allowance.used,
        available: allowance.available,
        renewal: allowance.renewal,
      },
      tokens,
      trial,
      server_time: new Date().toISOString(),
    };
  });

export const generateToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateTenantToken } = await import("./tokens.server");
    return generateTenantToken(context.userId);
  });

export const revealToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ licenseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { revealTenantToken } = await import("./tokens.server");
    return { token: await revealTenantToken(context.userId, data.licenseId) };
  });

export const startFreeTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ installationId: z.string().max(128).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { startTrial } = await import("./tokens.server");
    const headers = getRequest().headers;
    const ip =
      headers.get("cf-connecting-ip") ||
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    return startTrial({
      userId: context.userId,
      ip,
      installationId: data.installationId ?? null,
    });
  });
