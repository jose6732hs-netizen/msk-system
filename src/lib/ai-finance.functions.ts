import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export type AiProviderFinanceRow = {
  provider: string;
  models: { model: string; commands: number; cost: number }[];
  commands: number;
  errors: number;
  successRate: number;
  tokensIn: number;
  tokensOut: number;
  tokens: number;
  cost: number;
  costShare: number;
  avgCost: number;
  avgLatency: number;
  revenueShare: number;
  profit: number;
  margin: number;
  lastAt: string | null;
};

/** Financeiro das IAs: comandos, custo em dólar e lucro já descontando o custo, por provedor. */
export const aiProviderFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [usageRes, subsRes, plansRes] = await Promise.all([
      supabaseAdmin
        .from("agent_api_usage")
        .select("provider, model, status, input_tokens, output_tokens, total_tokens, estimated_cost_usd, latency_ms, created_at, user_id")
        .gte("created_at", since)
        .limit(20000),
      supabaseAdmin.from("subscriptions").select("id, plan_id, status").eq("status", "active"),
      supabaseAdmin.from("plans").select("id, name, price, currency, duration_days, is_lifetime"),
    ]);
    if (usageRes.error) throw new Error(usageRes.error.message);
    if (subsRes.error) throw new Error(subsRes.error.message);
    if (plansRes.error) throw new Error(plansRes.error.message);

    // Receita: somente assinaturas ATIVAS, normalizadas para o período filtrado.
    const planById = new Map((plansRes.data ?? []).map((plan) => [plan.id, plan]));
    let dailyRevenue = 0;
    const activeSubs = subsRes.data ?? [];
    for (const sub of activeSubs) {
      const plan = planById.get(sub.plan_id);
      if (!plan) continue;
      const price = Number(plan.price ?? 0);
      const span = plan.is_lifetime ? 365 : Math.max(1, Number(plan.duration_days ?? 30));
      dailyRevenue += price / span;
    }
    const revenue = dailyRevenue * data.days;

    type Acc = {
      commands: number;
      errors: number;
      tokensIn: number;
      tokensOut: number;
      tokens: number;
      cost: number;
      latency: number;
      lastAt: string | null;
      models: Map<string, { commands: number; cost: number }>;
      users: Set<string>;
    };
    const map = new Map<string, Acc>();
    const rows = usageRes.data ?? [];

    for (const row of rows) {
      const provider = String(row.provider || "desconhecido").toLowerCase();
      const acc = map.get(provider) ?? {
        commands: 0, errors: 0, tokensIn: 0, tokensOut: 0, tokens: 0, cost: 0, latency: 0,
        lastAt: null as string | null, models: new Map(), users: new Set<string>(),
      };
      acc.commands += 1;
      if (String(row.status || "") === "error") acc.errors += 1;
      acc.tokensIn += Number(row.input_tokens ?? 0);
      acc.tokensOut += Number(row.output_tokens ?? 0);
      acc.tokens += Number(row.total_tokens ?? 0);
      acc.cost += Number(row.estimated_cost_usd ?? 0);
      acc.latency += Number(row.latency_ms ?? 0);
      if (row.user_id) acc.users.add(String(row.user_id));
      if (!acc.lastAt || row.created_at > acc.lastAt) acc.lastAt = row.created_at;
      const modelKey = String(row.model || "—");
      const model = acc.models.get(modelKey) ?? { commands: 0, cost: 0 };
      model.commands += 1;
      model.cost += Number(row.estimated_cost_usd ?? 0);
      acc.models.set(modelKey, model);
      map.set(provider, acc);
    }

    const totalCost = [...map.values()].reduce((sum, acc) => sum + acc.cost, 0);
    const totalCommands = [...map.values()].reduce((sum, acc) => sum + acc.commands, 0);

    const providers: AiProviderFinanceRow[] = [...map.entries()]
      .map(([provider, acc]) => {
        const costShare = totalCost > 0 ? acc.cost / totalCost : 0;
        const revenueShare = revenue * (totalCommands > 0 ? acc.commands / totalCommands : 0);
        const profit = revenueShare - acc.cost;
        return {
          provider,
          models: [...acc.models.entries()]
            .map(([model, value]) => ({ model, ...value }))
            .sort((a, b) => b.commands - a.commands)
            .slice(0, 6),
          commands: acc.commands,
          errors: acc.errors,
          successRate: acc.commands ? ((acc.commands - acc.errors) / acc.commands) * 100 : 0,
          tokensIn: acc.tokensIn,
          tokensOut: acc.tokensOut,
          tokens: acc.tokens,
          cost: acc.cost,
          costShare: costShare * 100,
          avgCost: acc.commands ? acc.cost / acc.commands : 0,
          avgLatency: acc.commands ? acc.latency / acc.commands : 0,
          revenueShare,
          profit,
          margin: revenueShare > 0 ? (profit / revenueShare) * 100 : 0,
          lastAt: acc.lastAt,
        };
      })
      .sort((a, b) => b.cost - a.cost);

    return {
      days: data.days,
      summary: {
        revenue,
        mrr: dailyRevenue * 30,
        activeSubscriptions: activeSubs.length,
        totalCost,
        totalCommands,
        profit: revenue - totalCost,
        margin: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0,
        costPerCommand: totalCommands ? totalCost / totalCommands : 0,
        arpu: activeSubs.length ? revenue / activeSubs.length : 0,
      },
      providers,
    };
  });
