type Point = {
  date: string;
  clicks: number;
  signups: number;
  sales: number;
  approved: number;
  commission: number;
};

const METRICS = [
  { key: "clicks", label: "Cliques", color: "hsl(var(--muted-foreground))" },
  { key: "signups", label: "Cadastros", color: "#7dd3fc" },
  { key: "sales", label: "Vendas", color: "#a3e635" },
  { key: "approved", label: "Aprovadas", color: "var(--primary)" },
] as const;

/** Gráfico de barras empilhado leve, sem dependências extras. */
export function AffiliateChart({ series }: { series: Point[] }) {
  const max = Math.max(1, ...series.map((p) => p.clicks + p.signups + p.sales + p.approved));
  const step = Math.max(1, Math.ceil(series.length / 12));

  return (
    <div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {METRICS.map((m) => (
          <span key={m.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
            {m.label}
          </span>
        ))}
      </div>

      <div className="mt-5 flex h-52 items-end gap-[3px] overflow-hidden">
        {series.map((p) => {
          const total = p.clicks + p.signups + p.sales + p.approved;
          return (
            <div
              key={p.date}
              className="group relative flex flex-1 flex-col justify-end"
              title={`${new Date(p.date).toLocaleDateString("pt-BR")} · ${p.clicks} cliques · ${p.signups} cadastros · ${p.sales} vendas · ${p.approved} aprovadas`}
            >
              {METRICS.map((m) => {
                const value = p[m.key];
                if (!value) return null;
                return (
                  <div
                    key={m.key}
                    style={{
                      height: `${(value / max) * 100}%`,
                      background: m.color,
                      opacity: m.key === "approved" ? 1 : 0.55,
                    }}
                    className="w-full first:rounded-t-sm"
                  />
                );
              })}
              {total === 0 && <div className="h-[2px] w-full rounded bg-border/60" />}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[0.6rem] text-muted-foreground">
        {series
          .filter((_, i) => i % step === 0)
          .map((p) => (
            <span key={p.date}>
              {new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </span>
          ))}
      </div>
    </div>
  );
}
