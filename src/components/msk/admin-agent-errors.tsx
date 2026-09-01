import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bug, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { agentErrorAnalytics, agentErrorDetail } from "@/lib/agent-admin.functions";

const fmtDate = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

function MiniMetric({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-primary/20 bg-background/45 p-3", danger && "border-rose-500/35 bg-rose-500/5")}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", danger && "text-rose-300")}>{value}</p>
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="rounded-xl border border-primary/15 bg-background/35 p-3">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum erro registrado no período.</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 10).map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-foreground/85">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">{row.value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary/70 transition-[width] duration-500" style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminAgentErrors({ days }: { days: number }) {
  const analyticsFn = useServerFn(agentErrorAnalytics);
  const detailFn = useServerFn(agentErrorDetail);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["agent-runtime-errors", days],
    queryFn: () => analyticsFn({ data: { days: Math.max(1, Math.min(90, days || 7)) } }),
    refetchInterval: 30_000,
  });

  const detail = useQuery({
    queryKey: ["agent-runtime-error-detail", selectedId],
    queryFn: () => detailFn({ data: { errorId: selectedId! } }),
    enabled: !!selectedId,
    staleTime: 15_000,
  });

  const data: any = query.data;
  const summary = data?.summary;
  const recent: any[] = data?.recent ?? [];
  const detailRow = (detail.data as any)?.error;

  return (
    <div className="rounded-2xl border border-primary/25 bg-[linear-gradient(150deg,hsl(var(--background)/0.95),hsl(var(--background)/0.62))] p-5 shadow-[0_28px_70px_-50px_hsl(var(--primary)/0.9)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold">Diagnóstico do motor MSK</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Erros estruturados do executor · código, etapa, tentativa e ID de diagnóstico · atualiza a cada 30s
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          {query.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      {summary?.alert ? (
        <div className="mt-4 flex gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Alerta de erro interno acima do limite</p>
            <p className="mt-0.5 text-xs text-rose-200/80">
              {Number(summary.internalRate ?? 0).toFixed(1)}% dos erros do período ficaram como INTERNAL_ERROR. Use os IDs abaixo para classificar a causa e eliminar o fallback.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Sem alerta de INTERNAL_ERROR acima de 5% no período selecionado.
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric label="Falhas registradas" value={summary?.total ?? 0} />
        <MiniMetric label="Internal error" value={summary?.internal ?? 0} danger={(summary?.internal ?? 0) > 0} />
        <MiniMetric label="Taxa internal" value={`${Number(summary?.internalRate ?? 0).toFixed(1)}%`} danger={!!summary?.alert} />
        <MiniMetric label="Retryable" value={summary?.retryable ?? 0} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Bars title="Erros por código" rows={data?.byCode ?? []} />
        <Bars title="Erros por etapa" rows={data?.byStage ?? []} />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-primary/15">
        <div className="flex items-center gap-2 border-b border-primary/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Falhas recentes do executor</p>
        </div>
        {query.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando diagnósticos…</p>
        ) : recent.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma falha estruturada registrada no período.</p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto divide-y divide-primary/10">
            {recent.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={cn("block w-full p-3 text-left transition-colors hover:bg-primary/5", selectedId === row.id && "bg-primary/10")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">{row.code}</span>
                  <span className="rounded-md border border-primary/20 px-2 py-0.5 text-[10px] text-muted-foreground">{row.stage}</span>
                  {row.retryable && <span className="text-[10px] text-amber-300">retryable</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground">{fmtDate(row.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-foreground/90">{row.message}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {row.repository || "repositório não identificado"} · tentativa {Number(row.attempt || 0) + 1} · ID {row.id}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-background/55 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold">Detalhe administrativo</p>
              <p className="text-[10px] text-muted-foreground">{selectedId}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>Fechar</Button>
          </div>
          {detail.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando detalhe…</p>
          ) : detail.isError ? (
            <p className="mt-3 text-sm text-rose-300">Não foi possível carregar o detalhe deste erro.</p>
          ) : detailRow ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-primary/10 p-3 text-xs">
                <p><b>Código:</b> {detailRow.code}</p>
                <p><b>Etapa:</b> {detailRow.stage}</p>
                <p><b>Tarefa:</b> {detailRow.task_id || "—"}</p>
                <p><b>Projeto:</b> {detailRow.lovable_project_id || "—"}</p>
                <p><b>Repositório:</b> {detailRow.repository || "—"}</p>
                <p><b>Branch:</b> {detailRow.branch_name || "—"}</p>
                <p><b>Retry:</b> {detailRow.retryable ? "sim" : "não"} · tentativa {Number(detailRow.attempt || 0) + 1}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-primary/10 p-3">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Contexto sanitizado</p>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all text-[10px] text-foreground/75">{JSON.stringify(detailRow.context ?? {}, null, 2)}</pre>
              </div>
              {detailRow.stack && (
                <div className="lg:col-span-2 min-w-0 rounded-lg border border-primary/10 p-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Stack interno — somente administrador</p>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-[10px] text-foreground/70">{String(detailRow.stack).slice(0, 12000)}</pre>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
