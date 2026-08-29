import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminFinanceOverview, adminSyncPayments, adminWithdrawalAction } from "@/lib/admin.functions";
import { FilterChips } from "@/components/msk/filter-chips";
import { Money } from "@/components/msk/money";

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

const txGroup = (t: any) => {
  const s = String(t?.status ?? "").toUpperCase();
  if (["PAID", "APPROVED", "COMPLETED"].includes(s) || t?.paid_at) return "paid";
  if (["PENDING", "WAITING", "WAITING_PAYMENT", "AWAITING_PAYMENT", "PROCESSING"].includes(s)) return "pending";
  return "failed";
};

export function AdminFinanceTab() {
  const qc = useQueryClient();
  const loadFn = useServerFn(adminFinanceOverview);
  const actionFn = useServerFn(adminWithdrawalAction);
  const syncFn = useServerFn(adminSyncPayments);
  const [syncing, setSyncing] = useState(false);
  const [txFilter, setTxFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-finance"],
    queryFn: () => loadFn(),
    refetchInterval: 60_000,
  });

  async function sync() {
    setSyncing(true);
    try {
      const res = await syncFn({ data: {} } as never);
      await qc.invalidateQueries({ queryKey: ["admin-finance"] });
      toast.success(
        `Sincronizado: ${res.checked} transações verificadas, ${res.updated} aprovadas.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function act(withdrawalId: string, action: "approve" | "reject") {
    try {
      await actionFn({ data: { withdrawalId, action } });
      await qc.invalidateQueries({ queryKey: ["admin-finance"] });
      toast.success(action === "approve" ? "Saque pago." : "Saque rejeitado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const s = data?.stats;
  const allTx = (data?.transactions ?? []) as any[];
  const filteredTx = allTx.filter((t) => txFilter === "all" || txGroup(t) === txFilter);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Métricas em tempo real · atualização automática a cada 60s
        </p>
        <Button size="sm" variant="neonOutline" disabled={syncing} onClick={sync}>
          <RefreshCw className={`mr-2 h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          Sincronizar pagamentos
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-primary/30 bg-background/40 shadow-[0_0_28px_hsl(var(--primary)/0.12)]">
        {[
          [["Receita aprovada", brl(s?.revenue)], ["Receita gerada", brl(s?.generatedRevenue)], ["Receita líquida", brl(s?.netRevenue)], ["Ticket médio", brl(s?.averageTicket)]],
          [["Vendas aprovadas", String(s?.paidCount ?? 0)], ["Conversão", `${Number(s?.conversionRate ?? 0).toFixed(1)}%`], ["Em checkout", String(s?.pending ?? 0)], ["Valor pendente", brl(s?.pendingRevenue)]],
          [["Comissões pagas", brl(s?.approvedCommissions)], ["Comissões pendentes", brl(s?.pendingCommissions)], ["Saques pendentes", brl(s?.pendingWithdrawalValue)], ["Vendas afiliadas", String(s?.totalAffiliateSales ?? 0)]],
        ].map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-2 border-b border-primary/20 last:border-b-0 lg:grid-cols-4">
            {row.map(([k, v]) => (
              <div key={k} className="min-w-0 border-r border-primary/15 p-4 last:border-r-0 transition-colors hover:bg-primary/5">
                <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{k}</p>
                <p className="mt-1 truncate text-lg font-bold text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.45)]">{v}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <Section title="Saques">
        {(data?.withdrawals ?? []).map((w: any) => (
          <div
            key={w.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-3 text-sm"
          >
            <span>{w.profiles?.email ?? "—"}</span>
            <span><Money value={w.amount} /></span>
            <span className="text-xs text-muted-foreground">{w.pix_key_type}</span>
            <span className="text-xs text-primary">{w.status}</span>
            {w.status === "PENDING" && (
              <span className="flex gap-1">
                <Button size="sm" variant="neon" onClick={() => act(w.id, "approve")}>
                  Pagar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => act(w.id, "reject")}>
                  Rejeitar
                </Button>
              </span>
            )}
          </div>
        ))}
        {!data?.withdrawals.length && <Empty />}
      </Section>

      <Section title="Transações">
        <FilterChips
          className="mb-3"
          value={txFilter}
          onChange={setTxFilter}
          chips={[
            { id: "all", label: "Todas", count: allTx.length },
            { id: "paid", label: "Aprovadas", count: allTx.filter((t) => txGroup(t) === "paid").length },
            { id: "pending", label: "Pendentes", count: allTx.filter((t) => txGroup(t) === "pending").length },
            { id: "failed", label: "Não pagas", count: allTx.filter((t) => txGroup(t) === "failed").length },
          ]}
        />
        {filteredTx.map((t: any) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-3 text-sm">
            <span className="font-mono text-xs">{t.identifier}</span>
            <span>{t.profiles?.email ?? "—"}</span>
            <span><Money value={t.amount} /></span>
            <span className="text-xs text-muted-foreground">{t.purpose}</span>
            <span className="text-xs text-primary">{t.status}</span>
            <span className="text-xs text-muted-foreground">{fmt(t.created_at)}</span>
          </div>
        ))}
        {!filteredTx.length && <Empty />}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Afiliados">
          {(data?.affiliates ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between border-t border-border/50 py-3 text-sm">
              <span>{a.profiles?.email ?? a.code}</span>
              <span className="text-xs text-muted-foreground">{a.total_sales} vendas</span>
              <span className="text-xs text-primary"><Money value={a.available_balance} /></span>
            </div>
          ))}
          {!data?.affiliates.length && <Empty />}
        </Section>
        <Section title="Revendedores">
          {(data?.resellers ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between border-t border-border/50 py-3 text-sm">
              <span>{r.profiles?.email ?? r.code}</span>
              <span className="text-xs uppercase text-muted-foreground">{r.tier}</span>
              <span className="text-xs text-primary"><Money value={r.available_balance} /></span>
            </div>
          ))}
          {!data?.resellers.length && <Empty />}
        </Section>
      </div>

      <Section title="Auditoria">
        {(data?.audit ?? []).map((a: any) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-2 text-xs">
            <span className="font-mono text-primary">{a.action}</span>
            <span className="text-muted-foreground">{a.resource ?? "—"}</span>
            <span className={a.result === "success" ? "text-muted-foreground" : "text-destructive"}>
              {a.result}
            </span>
            <span className="text-muted-foreground">{fmt(a.created_at)}</span>
          </div>
        ))}
        {!data?.audit.length && <Empty />}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="py-4 text-sm text-muted-foreground">Nenhum registro.</p>;
}