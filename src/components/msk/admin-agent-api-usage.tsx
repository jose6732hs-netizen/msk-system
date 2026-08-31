import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Bot, Cpu, Download, Gauge, Loader2, RefreshCw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterChips } from "@/components/msk/filter-chips";
import { AnimatedNumber } from "@/components/msk/animated-number";
import { agentUsageOverview } from "@/lib/agent-usage.functions";

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function Metric({ label, value, suffix, Icon }: { label: string; value: number; suffix?: string; Icon: typeof Bot }) {
  return (
    <div className="holo-card rounded-2xl border border-border/50 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums text-foreground">
        <AnimatedNumber value={value} />
        {suffix ? <span className="ml-1 text-sm text-muted-foreground">{suffix}</span> : null}
      </p>
    </div>
  );
}

function Bars({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-2xl border border-border/50 bg-background/40 p-4">
      <h5 className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">{title}</h5>
      <div className="mt-3 space-y-2">
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados no filtro atual.</p>
        ) : (
          data.slice(0, 8).map((d) => (
            <div key={d.label} className="space-y-1">
              <div className="flex justify-between text-[0.65rem] font-bold uppercase">
                <span className="truncate">{d.label}</span>
                <span className="tabular-nums text-primary">{d.value}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                <div className="holo-bar h-full rounded-full bg-primary" style={{ width: `${(d.value / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminAgentApiUsageTab() {
  const overview = useServerFn(agentUsageOverview);
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["agent-api-usage", days],
    queryFn: () => overview({ data: { days: Number(days) } }),
    refetchInterval: 60_000,
  });

  const term = search.trim().toLowerCase();
  const clients = useMemo(
    () => (data?.clients ?? []).filter((c: any) => !term || String(c.email).toLowerCase().includes(term) || String(c.name).toLowerCase().includes(term)),
    [data, term],
  );
  const recent = useMemo(
    () =>
      (data?.recent ?? []).filter(
        (r: any) => (statusFilter === "all" || r.status === statusFilter) && (!term || String(r.email).toLowerCase().includes(term)),
      ),
    [data, statusFilter, term],
  );

  function exportCsv() {
    const header = "email,chamadas,erros,tokens,tokens_entrada,tokens_saida,latencia_media_ms,taxa_sucesso,instalacoes,ultimo_uso";
    const lines = clients.map((c: any) =>
      [c.email, c.calls, c.errors, c.tokens, c.input_tokens, c.output_tokens, c.avg_latency, c.success_rate, c.installations, c.last_used_at].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `msk-agente-api-uso-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest">API do Agente de IA</h4>
          <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">
            Uso por cliente, comandos enviados, tokens, latência e falhas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChips
            value={days}
            onChange={setDays}
            chips={[
              { id: "7", label: "7 dias" },
              { id: "14", label: "14 dias" },
              { id: "30", label: "30 dias" },
              { id: "90", label: "90 dias" },
            ]}
          />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="neon" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Comandos enviados" value={m?.total_calls ?? 0} Icon={Bot} />
        <Metric label="Comandos 24h" value={m?.calls_24h ?? 0} Icon={Activity} />
        <Metric label="Clientes usando" value={m?.clients ?? 0} Icon={Users} />
        <Metric label="Tokens consumidos" value={m?.total_tokens ?? 0} Icon={Cpu} />
        <Metric label="Tokens por comando" value={m?.avg_tokens ?? 0} Icon={Cpu} />
        <Metric label="Latência média" value={m?.avg_latency ?? 0} suffix="ms" Icon={Gauge} />
        <Metric label="Falhas" value={m?.errors ?? 0} Icon={AlertTriangle} />
        <Metric label="Taxa de sucesso" value={m?.success_rate ?? 100} suffix="%" Icon={Gauge} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Bars title="Por modelo" data={(data?.by_model ?? []) as any} />
        <Bars title="Por comando" data={(data?.by_action ?? []) as any} />
        <Bars title="Por provedor" data={(data?.by_provider ?? []) as any} />
      </div>

      <div className="rounded-2xl border border-border/50 bg-background/40 p-4">
        <h5 className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Uso por dia</h5>
        <div className="mt-4 flex h-28 items-end gap-1">
          {(data?.by_day ?? []).map((d: any) => {
            const max = Math.max(1, ...(data?.by_day ?? []).map((x: any) => x.calls));
            return (
              <div key={d.day} className="flex-1 rounded-t bg-primary/70 transition-all hover:bg-primary" style={{ height: `${(d.calls / max) * 100}%` }} title={`${d.day}: ${d.calls} comandos`} />
            );
          })}
        </div>
      </div>

      <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <Input placeholder="Buscar cliente por e-mail ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="button" variant="neon">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border/50">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/50 text-[0.6rem] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3">Comandos</th>
              <th className="p-3">Tokens</th>
              <th className="p-3">Latência</th>
              <th className="p-3">Sucesso</th>
              <th className="p-3">Instalações</th>
              <th className="p-3">Último uso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-xs text-muted-foreground">
                  Nenhum uso registrado no período.
                </td>
              </tr>
            ) : (
              clients.map((c: any) => (
                <tr key={c.key} className="hover:bg-muted/5">
                  <td className="p-3">
                    <p className="truncate font-medium">{c.email}</p>
                    <p className="text-[0.6rem] uppercase text-muted-foreground">{c.models.join(" · ") || "—"}</p>
                  </td>
                  <td className="p-3 tabular-nums font-bold text-primary">{c.calls}</td>
                  <td className="p-3 tabular-nums">{c.tokens}</td>
                  <td className="p-3 tabular-nums">{c.avg_latency} ms</td>
                  <td className="p-3 tabular-nums">{c.success_rate}%</td>
                  <td className="p-3 tabular-nums">{c.installations}</td>
                  <td className="p-3 text-xs text-muted-foreground">{fmt(c.last_used_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <FilterChips
          value={statusFilter}
          onChange={setStatusFilter}
          chips={[
            { id: "all", label: "Todos", count: (data?.recent ?? []).length },
            { id: "success", label: "Sucesso", count: (data?.recent ?? []).filter((r: any) => r.status === "success").length },
            { id: "error", label: "Erros", count: (data?.recent ?? []).filter((r: any) => r.status === "error").length },
            { id: "blocked", label: "Bloqueados", count: (data?.recent ?? []).filter((r: any) => r.status === "blocked").length },
          ]}
        />
        <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-border/50">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-background/95 text-[0.55rem] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Comando</th>
                <th className="p-3">Modelo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Tokens</th>
                <th className="p-3">Latência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Sem dados no filtro atual.
                  </td>
                </tr>
              ) : (
                recent.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/5">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(r.created_at)}</td>
                    <td className="p-3 max-w-[180px] truncate">{r.email}</td>
                    <td className="p-3">{r.action}</td>
                    <td className="p-3 max-w-[160px] truncate">{r.model ?? "—"}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[0.55rem] font-black uppercase ${
                          r.status === "success"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : r.status === "blocked"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                              : "border-red-500/30 bg-red-500/10 text-red-400"
                        }`}
                        title={r.error_message ?? ""}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums">{r.total_tokens}</td>
                    <td className="p-3 tabular-nums">{r.latency_ms} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
