import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AgentUsageRecord = {
  userId?: string | null;
  installationId?: string | null;
  provider?: string | null;
  model?: string | null;
  action?: string | null;
  source?: string | null;
  promptChars?: number | null;
  replyChars?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  status: "success" | "error" | "blocked";
  httpStatus?: number | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  extensionVersion?: string | null;
  browser?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Nunca deve quebrar o fluxo do chat: falhas de telemetria são silenciosas. */
export async function recordAgentUsage(rec: AgentUsageRecord) {
  try {
    await supabaseAdmin.from("agent_api_usage").insert({
      user_id: rec.userId ?? null,
      installation_id: rec.installationId ?? null,
      provider: rec.provider ?? "lovable-ai",
      model: rec.model ?? null,
      action: rec.action ?? "chat",
      source: rec.source ?? "extension",
      prompt_chars: rec.promptChars ?? undefined,
      reply_chars: rec.replyChars ?? undefined,
      input_tokens: rec.inputTokens ?? undefined,
      output_tokens: rec.outputTokens ?? undefined,
      total_tokens: rec.totalTokens ?? undefined,
      estimated_cost_usd: rec.estimatedCostUsd ?? undefined,
      status: rec.status,
      http_status: rec.httpStatus ?? null,
      latency_ms: rec.latencyMs ?? undefined,
      error_message: rec.errorMessage ? String(rec.errorMessage).slice(0, 500) : null,
      extension_version: rec.extensionVersion ?? null,
      browser: rec.browser ?? null,
      ip_address: rec.ipAddress ?? null,
      metadata: (rec.metadata ?? undefined) as any,
    } as any);
  } catch {
    /* telemetria não bloqueia */
  }
}

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

type Row = any;

async function fetchAll(sinceIso: string): Promise<Row[]> {
  const out: Row[] = [];
  const pageSize = 1000;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabaseAdmin
      .from("agent_api_usage")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) break;
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

function countBy(rows: Row[], key: string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? "—");
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export async function loadAgentUsageAnalytics(days: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await fetchAll(since);

  const total = rows.length;
  const errors = rows.filter((r) => r.status === "error");
  const blocked = rows.filter((r) => r.status === "blocked");
  const success = total - errors.length - blocked.length;
  const tokens = rows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0);
  const cost = rows.reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0);
  const latencies = rows.map((r) => Number(r.latency_ms ?? 0)).filter((n) => n > 0);
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  // por dia
  const byDayMap = new Map<string, { total: number; errors: number; tokens: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    byDayMap.set(k, { total: 0, errors: 0, tokens: 0 });
  }
  for (const r of rows) {
    const k = dayKey(r.created_at);
    const cur = byDayMap.get(k);
    if (!cur) continue;
    cur.total += 1;
    if (r.status === "error") cur.errors += 1;
    cur.tokens += Number(r.total_tokens ?? 0);
  }
  const byDay = [...byDayMap.entries()].map(([day, v]) => ({ day, ...v }));

  // por cliente
  const clientMap = new Map<string, any>();
  for (const r of rows) {
    const id = String(r.user_id ?? "anon");
    const cur = clientMap.get(id) ?? {
      user_id: r.user_id ?? null,
      name: null,
      email: null,
      total: 0,
      errors: 0,
      tokens: 0,
      cost: 0,
      last_at: r.created_at,
      versions: new Set<string>(),
    };
    cur.total += 1;
    if (r.status === "error") cur.errors += 1;
    cur.tokens += Number(r.total_tokens ?? 0);
    cur.cost += Number(r.estimated_cost_usd ?? 0);
    if (new Date(r.created_at) > new Date(cur.last_at)) cur.last_at = r.created_at;
    if (r.extension_version) cur.versions.add(String(r.extension_version));
    clientMap.set(id, cur);
  }
  const userIds = [...clientMap.values()].map((c) => c.user_id).filter(Boolean) as string[];
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", chunk);
    for (const p of profiles ?? []) {
      const c = clientMap.get(String(p.id));
      if (c) {
        c.name = p.name;
        c.email = p.email;
      }
    }
  }
  const clients = [...clientMap.values()]
    .map((c) => ({
      userId: c.user_id as string | null,
      name: c.name as string | null,
      email: c.email as string | null,
      total: c.total as number,
      errors: c.errors as number,
      tokens: c.tokens as number,
      cost: c.cost as number,
      lastAt: c.last_at as string,
      versions: [...(c.versions as Set<string>)],
    }))
    .sort((a, b) => b.total - a.total);

  const recent = rows.slice(0, 80).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    userId: r.user_id as string | null,
    status: r.status as string,
    model: r.model as string | null,
    action: r.action as string | null,
    provider: r.provider as string | null,
    latencyMs: Number(r.latency_ms ?? 0),
    httpStatus: r.http_status as number | null,
    error: r.error_message as string | null,
    promptChars: Number(r.prompt_chars ?? 0),
    replyChars: Number(r.reply_chars ?? 0),
    extensionVersion: r.extension_version as string | null,
    browser: r.browser as string | null,
  }));

  return {
    summary: {
      total,
      success,
      errors: errors.length,
      blocked: blocked.length,
      successRate: total ? (success / total) * 100 : 100,
      tokens,
      cost,
      avgLatency,
      clients: clients.length,
    },
    byDay,
    byModel: countBy(rows, "model").slice(0, 8),
    byAction: countBy(rows, "action").slice(0, 8),
    byProvider: countBy(rows, "provider").slice(0, 8),
    byVersion: countBy(rows, "extension_version").slice(0, 8),
    clients,
    recent,
  };
}

export type AgentUsageAnalytics = Awaited<ReturnType<typeof loadAgentUsageAnalytics>>;

/** Saúde operacional: API do agente, extensões, presença, banco e erros recentes. */
export async function loadAgentHealth() {
  const now = Date.now();
  const iso = (ms: number) => new Date(now - ms).toISOString();
  const dbStart = Date.now();

  const [usage1h, usage24h, presence, installsOnline, installsTotal, extErrors] =
    await Promise.all([
      supabaseAdmin
        .from("agent_api_usage")
        .select("status, latency_ms, error_message, created_at, user_id, model")
        .gte("created_at", iso(3600_000))
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("agent_api_usage")
        .select("status", { count: "exact", head: true })
        .gte("created_at", iso(86400_000)),
      supabaseAdmin.rpc("presence_online_count"),
      supabaseAdmin
        .from("extension_installations")
        .select("id", { count: "exact", head: true })
        .gte("last_seen_at", iso(10 * 60_000)),
      supabaseAdmin.from("extension_installations").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("extension_errors")
        .select("id, created_at, message, extension_version, user_id, stage, provider")
        .gte("created_at", iso(86400_000))
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const dbLatency = Date.now() - dbStart;
  const rows1h = usage1h.data ?? [];
  const err1h = rows1h.filter((r: Row) => r.status === "error").length;
  const rate1h = rows1h.length ? ((rows1h.length - err1h) / rows1h.length) * 100 : 100;
  const lat = rows1h.map((r: Row) => Number(r.latency_ms ?? 0)).filter((n) => n > 0);
  const avgLatency = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;

  const gatewayConfigured = !!process.env["LOVABLE_API_KEY"];

  const checks = [
    {
      key: "gateway",
      label: "API do Agente (IA)",
      status: !gatewayConfigured ? "down" : err1h > 0 && rate1h < 90 ? "degraded" : "up",
      detail: !gatewayConfigured
        ? "Chave de IA ausente"
        : `${rate1h.toFixed(1)}% sucesso na última hora`,
    },
    {
      key: "database",
      label: "Banco de dados",
      status: usage1h.error ? "down" : dbLatency > 1500 ? "degraded" : "up",
      detail: `${dbLatency} ms de resposta`,
    },
    {
      key: "extensions",
      label: "Extensões conectadas",
      status: (installsOnline.count ?? 0) > 0 ? "up" : "degraded",
      detail: `${installsOnline.count ?? 0} online de ${installsTotal.count ?? 0}`,
    },
    {
      key: "presence",
      label: "Presença no site",
      status: typeof presence.data === "number" ? "up" : "degraded",
      detail: `${Number(presence.data ?? 0)} sessões ativas`,
    },
    {
      key: "latency",
      label: "Latência do agente",
      status: avgLatency === 0 ? "idle" : avgLatency > 8000 ? "degraded" : "up",
      detail: avgLatency ? `${avgLatency} ms médio` : "sem tráfego na última hora",
    },
  ] as const;

  const errorRows = rows1h.filter((r: Row) => r.status === "error").slice(0, 25);
  const userIds = [
    ...new Set(
      [...errorRows, ...(extErrors.data ?? [])].map((r: Row) => r.user_id).filter(Boolean),
    ),
  ] as string[];
  const nameMap = new Map<string, { name: string | null; email: string | null }>();
  if (userIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds.slice(0, 200));
    for (const p of profiles ?? [])
      nameMap.set(String(p.id), { name: p.name, email: p.email });
  }

  const incidents = [
    ...errorRows.map((r: Row) => ({
      id: `api-${r.created_at}-${r.user_id ?? "anon"}`,
      kind: "API do Agente",
      createdAt: r.created_at as string,
      message: (r.error_message as string) ?? "Falha na chamada da IA",
      context: (r.model as string) ?? "—",
      userId: (r.user_id as string) ?? null,
      client: nameMap.get(String(r.user_id))?.email ?? null,
    })),
    ...(extErrors.data ?? []).map((r: Row) => ({
      id: `ext-${r.id}`,
      kind: "Extensão",
      createdAt: r.created_at as string,
      message: (r.message as string) ?? "Erro na extensão",
      context: [r.provider, r.stage, r.extension_version].filter(Boolean).join(" · ") || "—",
      userId: (r.user_id as string) ?? null,
      client: nameMap.get(String(r.user_id))?.email ?? null,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const worst = checks.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "up";

  return {
    overall: worst,
    checkedAt: new Date().toISOString(),
    checks: checks.map((c) => ({ ...c })),
    metrics: {
      calls1h: rows1h.length,
      errors1h: err1h,
      calls24h: usage24h.count ?? 0,
      successRate1h: rate1h,
      avgLatency,
      online: Number(presence.data ?? 0),
      extensionsOnline: installsOnline.count ?? 0,
      extensionsTotal: installsTotal.count ?? 0,
    },
    incidents: incidents.slice(0, 30),
  };
}

export type AgentHealth = Awaited<ReturnType<typeof loadAgentHealth>>;