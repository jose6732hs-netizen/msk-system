import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, Cpu, Download, Loader2, RefreshCw, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import CountUp from "@/components/msk/animated-number";
import { FilterChips } from "@/components/msk/filter-chips";
import { AdminAgentAiSettings } from "@/components/msk/admin-agent-ai-settings";
import { AdminAgentErrors } from "@/components/msk/admin-agent-errors";
import { agentUsageAnalytics, agentHealth } from "@/lib/agent-usage.functions";

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

const STATUS_STYLE: Record<string, string> = {
  up: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  degraded: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  down: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  idle: "border-primary/30 bg-primary/5 text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  up: "Operacional",
  degraded: "Instável",
  down: "Fora do ar",
  idle: "Ocioso",
};

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(150deg,hsl(var(--background)/0.95),hsl(var(--background)/0.62))] p-4 backdrop-blur-xl",
        "shadow-[0_28px_70px_-50px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.07)]",
        className,
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      {children}
    </div>
  );
}

function Metric({ label, value, suffix, decimals, tone }: { label: string; value: number; suffix?: string | undefined; decimals?: number | undefined; tone?: string | undefined }) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>
        <CountUp value={value} decimals={decimals ?? 0} suffix={suffix ?? ""} />
      </p>
    </Card>
  );
}

function Bars({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Card>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados no filtro atual.</p>
      ) : (
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.label} className="min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-foreground/80">{d.label}</span>
                <span className="tabular-nums text-muted-foreground">{d.value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/70 shadow-[0_0_14px_hsl(var(--primary)/0.7)] transition-[width] duration-700"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AdminAgentApiUsageTab() {
  const usageFn = useServerFn(agentUsageAnalytics);
  const healthFn = useServerFn(agentHealth);
  const [days, setDays] = useState("30");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const usage = useQuery({
    queryKey: ["agent-usage", days],
    queryFn: () => usageFn({ data: { days: Number(days) } }),
    refetchInterval: 60_000,
  });
  const health = useQuery({
    queryKey: ["agent-health"],
    queryFn: () => healthFn(),
    refetchInterval: 30_000,
  });

  const clients = useMemo(() => {
    const list = usage.data?.clients ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((c) => {
      if (status === "errors" && c.errors === 0) return false;
      if (status === "clean" && c.errors > 0) return false;
      if (!term) return true;
      return [c.name, c.email, c.userId].some((v) => String(v ?? "").toLowerCase().includes(term));
    });
  }, [usage.data, search, status]);

  const recent = useMemo(() => {
    const list = usage.data?.recent ?? [];
    return list.filter((r) => (status === "errors" ? r.status === "error" : status === "clean" ? r.status !== "error" : true));
  }, [usage.data, status]);

  function exportCsv() {
    const rows = [
      ["cliente", "email", "user_id", "chamadas", "erros", "tokens", "custo_usd", "ultimo_uso", "versoes"],
      ...clients.map((c) => [
        c.name ?? "",
        c.email ?? "",
        c.userId ?? "",
        String(c.total),
        String(c.errors),
        String(c.tokens),
        c.cost.toFixed(4),
        c.lastAt,
        c.versions.join(" | "),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `msk-agente-api-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const h = health.data;
  const s = usage.data?.summary;

  return (
    <div className="space-y-5">
      <AdminAgentAiSettings />

      {/* SAÚDE */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "relative flex h-3 w-3 items-center justify-center rounded-full",
                h?.overall === "down" ? "bg-rose-500" : h?.overall === "degraded" ? "bg-amber-400" : "bg-emerald-400",
              )}
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
            </span>
            <div>
              <h3 className="text-lg font-semibold">Saúde operacional</h3>
              <p className="text-xs text-muted-foreground">
                Verificado {fmtDate(h?.checkedAt)} · atualiza a cada 30s
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { health.refetch(); usage.refetch(); }}>
            {health.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(h?.checks ?? []).map((c) => (
            <div key={c.key} className={cn("rounded-xl border p-3", STATUS_STYLE[c.status] ?? STATUS_STYLE["idle"])}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{c.label}</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest">{STATUS_LABEL[c.status] ?? c.status}</span>
              </div>
              <p className="mt-1 text-xs opacity-80">{c.detail}</p>
            </div>
          ))}
          {health.isLoading && <p className="text-sm text-muted-foreground">Carregando saúde…</p>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Chamadas 1h" value={h?.metrics.calls1h ?? 0} />
          <Metric label="Erros 1h" value={h?.metrics.errors1h ?? 0} tone={(h?.metrics.errors1h ?? 0) > 0 ? "text-rose-300" : undefined} />
          <Metric label="Extensões online" value={h?.metrics.extensionsOnline ?? 0} />
          <Metric label="Usuários no site" value={h?.metrics.online ?? 0} />
        </div>

        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Ocorrências recentes (cliente enviou algo e deu erro)
          </p>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-primary/20">
            {(h?.incidents ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-400" />
                Nenhum erro nas últimas 24 horas.
              </p>
            ) : (
              <ul className="divide-y divide-primary/10">
                {(h?.incidents ?? []).map((i) => (
                  <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-rose-200">{i.message}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {i.kind} · {i.context} · {i.client ?? i.userId ?? "cliente não identificado"}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(i.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <AdminAgentErrors days={Number(days)} />

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          chips={[
            { id: "7", label: "7 dias" },
            { id: "14", label: "14 dias" },
            { id: "30", label: "30 dias" },
            { id: "90", label: "90 dias" },
          ]}
          value={days}
          onChange={setDays}
        />
        <FilterChips
          chips={[
            { id: "all", label: "Tudo", count: usage.data?.summary.total ?? 0 },
            { id: "errors", label: "Com erro", count: usage.data?.summary.errors ?? 0 },
            { id: "clean", label: "Sem erro", count: usage.data?.summary.success ?? 0 },
          ]}
          value={status}
          onChange={setStatus}
        />
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, e-mail ou ID" className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
      </div>

      {/* MÉTRICAS DE USO */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Comandos enviados" value={s?.total ?? 0} />
        <Metric label="Taxa de sucesso" value={s?.successRate ?? 100} decimals={1} suffix="%" />
        <Metric label="Tokens consumidos" value={s?.tokens ?? 0} />
        <Metric label="Clientes usando" value={s?.clients ?? 0} />
        <Metric label="Erros" value={s?.errors ?? 0} tone={(s?.errors ?? 0) > 0 ? "text-rose-300" : undefined} />
        <Metric label="Bloqueios" value={s?.blocked ?? 0} />
        <Metric label="Latência média" value={s?.avgLatency ?? 0} suffix=" ms" />
        <Metric label="Custo estimado" value={s?.cost ?? 0} decimals={4} suffix=" USD" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Bars title="Uso por dia" data={(usage.data?.byDay ?? []).map((d) => ({ label: d.day.slice(5), value: d.total }))} />
        <Bars title="Erros por dia" data={(usage.data?.byDay ?? []).map((d) => ({ label: d.day.slice(5), value: d.errors }))} />
        <Bars title="Por modelo" data={usage.data?.byModel ?? []} />
        <Bars title="Por comando" data={usage.data?.byAction ?? []} />
        <Bars title="Por provedor" data={usage.data?.byProvider ?? []} />
        <Bars title="Por versão da extensão" data={usage.data?.byVersion ?? []} />
      </div>

      {/* CLIENTES */}
      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-primary/15 p-4">
          <Cpu className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">Consumo por cliente</h3>
          <span className="ml-auto text-xs text-muted-foreground">{clients.length} clientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-primary/10">
                <th className="p-3">Cliente</th>
                <th className="p-3">Comandos</th>
                <th className="p-3">Erros</th>
                <th className="p-3">Tokens</th>
                <th className="p-3">Versões</th>
                <th className="p-3">Último uso</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-muted-foreground">
                    {usage.isLoading ? "Carregando…" : "Sem dados no filtro atual."}
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr key={c.userId ?? "anon"} className="border-b border-primary/5 hover:bg-primary/5">
                  <td className="p-3">
                    <p className="font-medium">{c.name ?? "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{c.email ?? c.userId ?? "—"}</p>
                  </td>
                  <td className="p-3 tabular-nums">{c.total}</td>
                  <td className={cn("p-3 tabular-nums", c.errors > 0 && "text-rose-300")}>{c.errors}</td>
                  <td className="p-3 tabular-nums">{c.tokens}</td>
                  <td className="p-3 text-xs text-muted-foreground">{c.versions.join(", ") || "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{fmtDate(c.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* LOG */}
      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-primary/15 p-4">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">Últimos comandos</h3>
        </div>
        <ul className="max-h-96 divide-y divide-primary/10 overflow-y-auto">
          {recent.length === 0 && <li className="p-4 text-sm text-muted-foreground">Sem dados no filtro atual.</li>}
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                  r.status === "error" ? STATUS_STYLE["down"] : r.status === "blocked" ? STATUS_STYLE["degraded"] : STATUS_STYLE["up"],
                )}
              >
                {r.status}
              </span>
              <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
              <span className="text-xs">{r.model ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{r.action ?? "chat"}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="h-3 w-3" />
                {r.latencyMs} ms
              </span>
              {r.error && <span className="w-full truncate text-xs text-rose-300">{r.error}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default AdminAgentApiUsageTab;
