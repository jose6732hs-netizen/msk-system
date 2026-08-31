import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AgentUsageInput = {
  userId?: string | null;
  installationId?: string | null;
  provider?: string;
  model?: string | null;
  action?: string;
  source?: string;
  promptChars?: number;
  replyChars?: number;
  inputTokens?: number;
  outputTokens?: number;
  status?: "success" | "error" | "blocked";
  httpStatus?: number | null;
  latencyMs?: number;
  errorMessage?: string | null;
  extensionVersion?: string | null;
  browser?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAgentUsage(input: AgentUsageInput) {
  const inputTokens = Math.max(0, Math.round(input.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.round(input.outputTokens ?? 0));
  try {
    await supabaseAdmin.from("agent_api_usage").insert({
      user_id: input.userId ?? null,
      installation_id: input.installationId ?? null,
      provider: input.provider ?? "lovable-ai",
      model: input.model ?? null,
      action: input.action ?? "chat",
      source: input.source ?? "extension",
      prompt_chars: Math.max(0, Math.round(input.promptChars ?? 0)),
      reply_chars: Math.max(0, Math.round(input.replyChars ?? 0)),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      status: input.status ?? "success",
      http_status: input.httpStatus ?? null,
      latency_ms: Math.max(0, Math.round(input.latencyMs ?? 0)),
      error_message: input.errorMessage ? String(input.errorMessage).slice(0, 500) : null,
      extension_version: input.extensionVersion ?? null,
      browser: input.browser ?? null,
      ip_address: input.ip ?? null,
      metadata: input.metadata ?? {},
    } as never);
  } catch {
    // telemetria nunca deve quebrar o fluxo do agente
  }
}

type Row = Record<string, any>;

const DAY = 86_400_000;

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function loadAgentUsageAdmin(days = 30) {
  const window = Math.min(Math.max(days, 1), 90);
  const since = new Date(Date.now() - window * DAY).toISOString();

  const rows: Row[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("agent_api_usage")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const userIds = [...new Set(rows.map((r) => r["user_id"]).filter(Boolean))] as string[];
  const profiles = new Map<string, { email: string; name: string }>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id,email,name")
      .in("id", userIds.slice(i, i + 200));
    (data ?? []).forEach((p: any) => profiles.set(p.id, { email: p.email ?? "—", name: p.name ?? "—" }));
  }

  const clientMap = new Map<string, Row>();
  for (const row of rows) {
    const key = String(row["user_id"] ?? row["installation_id"] ?? "anonimo");
    const profile = profiles.get(String(row["user_id"] ?? ""));
    const current =
      clientMap.get(key) ??
      {
        key,
        user_id: row["user_id"] ?? null,
        email: profile?.email ?? "Sem conta",
        name: profile?.name ?? "—",
        installations: new Set<string>(),
        calls: 0,
        errors: 0,
        blocked: 0,
        tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
        latency_total: 0,
        last_used_at: row["created_at"],
        models: new Set<string>(),
        actions: new Set<string>(),
      };
    current["calls"] += 1;
    if (row["status"] === "error") current["errors"] += 1;
    if (row["status"] === "blocked") current["blocked"] += 1;
    current["tokens"] += Number(row["total_tokens"] ?? 0);
    current["input_tokens"] += Number(row["input_tokens"] ?? 0);
    current["output_tokens"] += Number(row["output_tokens"] ?? 0);
    current["latency_total"] += Number(row["latency_ms"] ?? 0);
    if (row["installation_id"]) current["installations"].add(String(row["installation_id"]));
    if (row["model"]) current["models"].add(String(row["model"]));
    if (row["action"]) current["actions"].add(String(row["action"]));
    if (new Date(row["created_at"]) > new Date(current["last_used_at"])) current["last_used_at"] = row["created_at"];
    clientMap.set(key, current);
  }

  const clients = [...clientMap.values()]
    .map((c) => ({
      key: c["key"],
      user_id: c["user_id"],
      email: c["email"],
      name: c["name"],
      calls: c["calls"],
      errors: c["errors"],
      blocked: c["blocked"],
      tokens: c["tokens"],
      input_tokens: c["input_tokens"],
      output_tokens: c["output_tokens"],
      avg_latency: c["calls"] ? Math.round(c["latency_total"] / c["calls"]) : 0,
      success_rate: c["calls"] ? Math.round(((c["calls"] - c["errors"]) / c["calls"]) * 1000) / 10 : 100,
      installations: c["installations"].size,
      models: [...c["models"]],
      actions: [...c["actions"]],
      last_used_at: c["last_used_at"],
    }))
    .sort((a, b) => b.calls - a.calls);

  const byDayMap = new Map<string, { day: string; calls: number; errors: number; tokens: number }>();
  for (let i = window - 1; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    byDayMap.set(day, { day, calls: 0, errors: 0, tokens: 0 });
  }
  for (const row of rows) {
    const key = dayKey(row["created_at"]);
    const bucket = byDayMap.get(key);
    if (!bucket) continue;
    bucket.calls += 1;
    if (row["status"] === "error") bucket.errors += 1;
    bucket.tokens += Number(row["total_tokens"] ?? 0);
  }

  const countBy = (pick: (row: Row) => string | null) => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const value = pick(row);
      if (!value) return;
      map.set(value, (map.get(value) ?? 0) + 1);
    });
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  const last24 = rows.filter((r) => new Date(r["created_at"]).getTime() > Date.now() - DAY);
  const errors = rows.filter((r) => r["status"] === "error");
  const totalCalls = rows.length;
  const totalTokens = rows.reduce((sum, r) => sum + Number(r["total_tokens"] ?? 0), 0);

  return {
    window,
    metrics: {
      total_calls: totalCalls,
      calls_24h: last24.length,
      clients: clients.length,
      total_tokens: totalTokens,
      avg_tokens: totalCalls ? Math.round(totalTokens / totalCalls) : 0,
      avg_latency: totalCalls ? Math.round(rows.reduce((s, r) => s + Number(r["latency_ms"] ?? 0), 0) / totalCalls) : 0,
      errors: errors.length,
      blocked: rows.filter((r) => r["status"] === "blocked").length,
      success_rate: totalCalls ? Math.round(((totalCalls - errors.length) / totalCalls) * 1000) / 10 : 100,
    },
    clients,
    by_day: [...byDayMap.values()],
    by_model: countBy((r) => r["model"]),
    by_action: countBy((r) => r["action"]),
    by_provider: countBy((r) => r["provider"]),
    by_status: countBy((r) => r["status"]),
    recent: rows.slice(0, 300).map((r) => ({
      id: r["id"],
      created_at: r["created_at"],
      email: profiles.get(String(r["user_id"] ?? ""))?.email ?? "Sem conta",
      action: r["action"],
      model: r["model"],
      provider: r["provider"],
      status: r["status"],
      http_status: r["http_status"],
      latency_ms: r["latency_ms"],
      total_tokens: r["total_tokens"],
      prompt_chars: r["prompt_chars"],
      reply_chars: r["reply_chars"],
      error_message: r["error_message"],
      installation_id: r["installation_id"],
      extension_version: r["extension_version"],
    })),
  };
}
