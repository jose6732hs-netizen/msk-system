import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Eye,
  Filter,
  MousePointerClick,
  RefreshCw,
  ShoppingCart,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearEvents,
  readCartSnapshot,
  readEvents,
  type AbandonedCart,
  type TrackEvent,
} from "@/lib/tracking";

const RANGES = [
  { id: "24h", label: "24 horas", ms: 24 * 3600_000 },
  { id: "7d", label: "7 dias", ms: 7 * 86400_000 },
  { id: "30d", label: "30 dias", ms: 30 * 86400_000 },
  { id: "all", label: "Tudo", ms: Number.MAX_SAFE_INTEGER },
] as const;

const TYPES: { id: TrackEvent["type"] | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pageview", label: "Páginas" },
  { id: "offer_view", label: "Ofertas" },
  { id: "add_to_cart", label: "Carrinho" },
  { id: "checkout_start", label: "Checkout" },
  { id: "pix_generated", label: "PIX" },
  { id: "purchase", label: "Compras" },
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AdminTrackingTab() {
  const [events, setEvents] = useState<TrackEvent[]>([]);
  const [cart, setCart] = useState<AbandonedCart | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("7d");
  const [type, setType] = useState<TrackEvent["type"] | "all">("all");
  const [query, setQuery] = useState("");

  function refresh() {
    setEvents(readEvents());
    setCart(readCartSnapshot());
  }

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("msk:track", handler);
    const id = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("msk:track", handler);
      clearInterval(id);
    };
  }, []);

  const windowMs = RANGES.find((r) => r.id === range)!.ms;

  const scoped = useMemo(
    () => events.filter((e) => Date.now() - new Date(e.at).getTime() <= windowMs),
    [events, windowMs],
  );

  const filtered = useMemo(
    () =>
      scoped.filter(
        (e) =>
          (type === "all" || e.type === type) &&
          (!query ||
            `${e.path ?? ""} ${e.label ?? ""}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [scoped, type, query],
  );

  const counts = useMemo(() => {
    const by = (t: TrackEvent["type"]) => scoped.filter((e) => e.type === t).length;
    const views = by("pageview");
    const adds = by("add_to_cart");
    const purchases = by("purchase");
    return {
      views,
      offers: by("offer_view"),
      adds,
      checkouts: by("checkout_start"),
      pix: by("pix_generated"),
      purchases,
      conversion: views ? ((purchases / views) * 100).toFixed(1) : "0.0",
      cartRate: adds ? ((purchases / adds) * 100).toFixed(1) : "0.0",
    };
  }, [scoped]);

  const topPages = useMemo(() => rank(scoped.filter((e) => e.type === "pageview"), (e) => e.path ?? "/"), [scoped]);
  const topOffers = useMemo(
    () => rank(scoped.filter((e) => e.type === "offer_view" || e.type === "add_to_cart"), (e) => e.label ?? "—"),
    [scoped],
  );

  const abandoned = cart && Date.now() - new Date(cart.updatedAt).getTime() > 5 * 60_000;

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Filter className="h-4 w-4" />
          </div>
          <h3 className="truncate text-sm font-black uppercase tracking-widest">Traqueamento</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} className="shrink-0">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/50 bg-muted/20 p-1 no-scrollbar">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest transition-colors ${
                range === r.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/50 bg-muted/20 p-1 no-scrollbar">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest transition-colors ${
                type === t.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por página ou produto"
          className="h-9 min-w-0 flex-1 rounded-xl border border-border/50 bg-muted/20 px-3 text-xs outline-none focus:border-primary/40"
        />
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Eye className="h-4 w-4" />} label="Pageviews" value={String(counts.views)} />
        <Kpi icon={<MousePointerClick className="h-4 w-4" />} label="Views de oferta" value={String(counts.offers)} />
        <Kpi icon={<ShoppingCart className="h-4 w-4" />} label="Adds ao carrinho" value={String(counts.adds)} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="PIX gerados" value={String(counts.pix)} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Compras" value={String(counts.purchases)} />
        <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Conversão" value={`${counts.conversion}%`} />
        <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Carrinho → compra" value={`${counts.cartRate}%`} />
        <Kpi icon={<ShoppingCart className="h-4 w-4" />} label="Checkouts" value={String(counts.checkouts)} />
      </div>

      {/* Rankings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankCard title="Páginas mais vistas" rows={topPages} />
        <RankCard title="Produtos / ofertas" rows={topOffers} />
      </div>

      {/* Carrinho abandonado */}
      <div className="rounded-3xl border border-border/50 bg-muted/10 p-5">
        <h4 className="mb-4 text-[0.7rem] font-black uppercase tracking-widest text-muted-foreground">
          Carrinhos abandonados
        </h4>
        {!cart ? (
          <p className="text-xs text-muted-foreground">Nenhum carrinho aberto no momento.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[0.6rem] font-black uppercase tracking-widest ${
                  abandoned
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-primary/30 bg-primary/10 text-primary"
                }`}
              >
                {abandoned ? "Abandonado" : "Ativo agora"}
              </span>
              <span className="text-[0.65rem] text-muted-foreground">
                Atualizado {new Date(cart.updatedAt).toLocaleString("pt-BR")}
              </span>
              <span className="ml-auto text-sm font-black text-primary">{brl(cart.total)}</span>
            </div>
            <ul className="space-y-2">
              {cart.items.map((i, idx) => (
                <li
                  key={`${i.name}-${idx}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/40 bg-background/40 p-3"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/30">
                    {i.imageUrl ? (
                      <img src={i.imageUrl} alt={i.name} className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{i.name}</p>
                    <p className="text-[0.65rem] text-muted-foreground">Qtd. {i.quantity}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold">{brl(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Eventos */}
      <div className="rounded-3xl border border-border/50 bg-muted/10 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-muted-foreground">
            Eventos ({filtered.length})
          </h4>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { clearEvents(); refresh(); }}>
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </Button>
        </div>
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento no período selecionado.</p>
          ) : (
            filtered.slice(0, 200).map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/40 bg-background/40 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{e.label ?? e.path ?? e.type}</p>
                  <p className="text-[0.6rem] font-black uppercase tracking-widest text-primary">{e.type}</p>
                </div>
                <span className="shrink-0 text-[0.6rem] text-muted-foreground">
                  {new Date(e.at).toLocaleString("pt-BR")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function rank(list: TrackEvent[], key: (e: TrackEvent) => string) {
  const map = new Map<string, number>();
  for (const e of list) map.set(key(e), (map.get(key(e)) ?? 0) + 1);
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = rows[0]?.[1] ?? 1;
  return rows.map(([label, count]) => ({ label, count, pct: (count / max) * 100 }));
}

function RankCard({ title, rows }: { title: string; rows: { label: string; count: number; pct: number }[] }) {
  return (
    <div className="rounded-3xl border border-border/50 bg-muted/10 p-5">
      <h4 className="mb-4 text-[0.7rem] font-black uppercase tracking-widest text-muted-foreground">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados no período.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="truncate text-xs font-medium">{r.label}</span>
                <span className="shrink-0 text-[0.65rem] font-black text-primary">{r.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${r.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <p className="mt-3 text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
