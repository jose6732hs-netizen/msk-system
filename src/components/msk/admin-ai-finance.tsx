import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Download, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/msk/filter-chips";
import { cn } from "@/lib/utils";
import { aiProviderFinance } from "@/lib/ai-finance.functions";

const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  synterolink: "Claude · SynteroLink",
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Google Gemini",
  mistral: "Mistral AI",
  openrouter: "OpenRouter",
  omniroute: "OmniRoute",
  manus: "Manus AI",
  bai: "B.AI",
  desconhecido: "Não identificado",
};

const usd = (value: number) => `$${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const num = (value: number) => Number(value || 0).toLocaleString("pt-BR");
const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const fmtDate = (value?: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "—");

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-[linear-gradient(150deg,hsl(var(--background)/0.95),hsl(var(--background)/0.6))] p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AdminAiFinance() {
  const financeFn = useServerFn(aiProviderFinance);
  const [days, setDays] = useState("30");
  const [selected, setSelected] = useState<string>("all");

  const query = useQuery({
    queryKey: ["ai-finance", days],
    queryFn: () => financeFn({ data: { days: Number(days) } }),
    refetchInterval: 60_000,
  });

  const providers = query.data?.providers ?? [];
  const summary = query.data?.summary;
  const visible = useMemo(
    () => (selected === "all" ? providers : providers.filter((row) => row.provider === selected)),
    [providers, selected],
  );
  const focus = selected === "all" ? null : visible[0] ?? null;

  function exportCsv() {
    const rows = [
      ["provedor", "comandos", "erros", "sucesso_%", "tokens", "custo_usd", "custo_medio_usd", "receita_atribuida_usd", "lucro_usd", "margem_%", "ultimo_uso"],
      ...visible.map((row) => [
        PROVIDER_LABELS[row.provider] || row.provider,
        String(row.commands),
        String(row.errors),
        row.successRate.toFixed(1),
        String(row.tokens),
        row.cost.toFixed(4),
        row.avgCost.toFixed(6),
        row.revenueShare.toFixed(2),
        row.profit.toFixed(2),
        row.margin.toFixed(1),
        row.lastAt ?? "",
      ]),
    ];
    const csv = rows.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `msk-financeiro-ias-${days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-primary/25 bg-[linear-gradient(150deg,hsl(var(--background)/0.95),hsl(var(--background)/0.62))] p-5 shadow-[0_28px_70px_-50px_hsl(var(--primary)/0.9)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold">Financeiro das IAs</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Comandos enviados, custo em dólar por API e lucro já considerando somente assinaturas ativas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            {query.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <FilterChips
          chips={[
            { id: "7", label: "7 dias" },
            { id: "30", label: "30 dias" },
            { id: "90", label: "90 dias" },
            { id: "365", label: "12 meses" },
          ]}
          value={days}
          onChange={setDays}
        />
        <FilterChips
          chips={[
            { id: "all", label: "Todas as IAs", count: providers.length },
            ...providers.map((row) => ({ id: row.provider, label: PROVIDER_LABELS[row.provider] || row.provider, count: row.commands })),
          ]}
          value={selected}
          onChange={setSelected}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita no período" value={usd(summary?.revenue ?? 0)} hint={`${num(summary?.activeSubscriptions ?? 0)} assinaturas ativas`} />
        <Kpi label="Custo total das IAs" value={usd(summary?.totalCost ?? 0)} hint={`${num(summary?.totalCommands ?? 0)} comandos`} tone="text-amber-300" />
        <Kpi
          label="Lucro"
          value={usd(summary?.profit ?? 0)}
          hint={`Margem ${pct(summary?.margin ?? 0)}`}
          tone={(summary?.profit ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
        <Kpi label="Custo por comando" value={usd(summary?.costPerCommand ?? 0)} hint={`MRR ${usd(summary?.mrr ?? 0)} · ARPU ${usd(summary?.arpu ?? 0)}`} />
      </div>

      {focus ? (
        <div className="mt-4 rounded-xl border border-primary/20 bg-background/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{PROVIDER_LABELS[focus.provider] || focus.provider}</p>
            <span className="text-[11px] text-muted-foreground">Último comando: {fmtDate(focus.lastAt)}</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Comandos" value={num(focus.commands)} hint={`${num(focus.errors)} com erro · ${pct(focus.successRate)} sucesso`} />
            <Kpi label="Custo" value={usd(focus.cost)} hint={`${pct(focus.costShare)} do custo total`} tone="text-amber-300" />
            <Kpi label="Lucro atribuído" value={usd(focus.profit)} tone={focus.profit >= 0 ? "text-emerald-300" : "text-rose-300"} hint={`Margem ${pct(focus.margin)}`} />
            <Kpi label="Latência média" value={`${Math.round(focus.avgLatency)} ms`} hint={`${num(focus.tokens)} tokens`} />
          </div>
          {focus.models.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {focus.models.map((model) => (
                <span key={model.model} className="rounded-full border border-primary/20 px-3 py-1 text-[11px] text-muted-foreground">
                  <span className="font-mono text-foreground/85">{model.model}</span> · {num(model.commands)} cmd · {usd(model.cost)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-primary/15">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-primary/5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">API / Provedor</th>
              <th className="px-3 py-2 text-right font-medium">Comandos</th>
              <th className="px-3 py-2 text-right font-medium">Sucesso</th>
              <th className="px-3 py-2 text-right font-medium">Tokens</th>
              <th className="px-3 py-2 text-right font-medium">Custo (US$)</th>
              <th className="px-3 py-2 text-right font-medium">Custo/cmd</th>
              <th className="px-3 py-2 text-right font-medium">Receita atribuída</th>
              <th className="px-3 py-2 text-right font-medium">Lucro</th>
              <th className="px-3 py-2 text-right font-medium">Margem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/10">
            {query.isLoading ? (
              <tr><td colSpan={9} className="p-4 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando financeiro…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={9} className="p-4 text-sm text-muted-foreground">Nenhum comando registrado no período selecionado.</td></tr>
            ) : (
              visible.map((row) => (
                <tr key={row.provider} className="cursor-pointer transition-colors hover:bg-primary/5" onClick={() => setSelected(row.provider)}>
                  <td className="px-3 py-2 font-medium">{PROVIDER_LABELS[row.provider] || row.provider}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(row.commands)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(row.successRate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(row.tokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-300">{usd(row.cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{usd(row.avgCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(row.revenueShare)}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums font-medium", row.profit >= 0 ? "text-emerald-300" : "text-rose-300")}>
                    <span className="inline-flex items-center gap-1">
                      {row.profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {usd(row.profit)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(row.margin)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Receita considera apenas assinaturas com status ativo, convertida para o período filtrado pela duração de cada plano. A receita atribuída
        a cada API é proporcional ao volume de comandos que ela processou.
      </p>
    </section>
  );
}
