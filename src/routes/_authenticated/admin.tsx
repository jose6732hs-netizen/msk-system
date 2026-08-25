import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, Clock, KeyRound, LayoutDashboard, Loader2, Menu, Search, ShieldAlert, Users, X, Zap, TrendingUp, DollarSign, MessageSquare, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminGatewayTab } from "@/components/msk/admin-gateway";
import { AdminFinanceTab } from "@/components/msk/admin-finance";
import { AdminExtensionTab } from "@/components/msk/admin-extension";
import { AdminAffiliatesTab } from "@/components/msk/admin-affiliates";
import { AdminTokenGenerator } from "@/components/msk/admin-token-generator";
import { AdminTrackingTab } from "@/components/msk/admin-tracking";
import { AdminEditorTab } from "@/components/msk/admin-editor";
import award1kAsset from "@/assets/award-1k.png.asset.json";
import award500kAsset from "@/assets/award-500k.png.asset.json";
import award1mAsset from "@/assets/award-1m.png.asset.json";
import award5mAsset from "@/assets/award-5m.png.asset.json";
import awardsHeroAsset from "@/assets/awards-hero.png.asset.json";
import award100kNewAsset from "@/assets/award-100k-new.png.asset.json";
import award10kNewAsset from "@/assets/award-10k-new.png.asset.json";
import { AdminPushTestsTab } from "@/components/msk/admin-push-tests";
import { AdminPushLogsTab } from "@/components/msk/admin-push-logs";
import { AdminSubscriptionsTab } from "@/components/msk/admin-subscriptions";
import { NotificationSettings } from "@/components/msk/notification-settings";
import { Bell } from "lucide-react";
import { MskLogo } from "@/components/msk/logo";
import { adminLicenseAction, adminOverview, isAdmin, adminUserAction } from "@/lib/admin.functions";
import { AdminWalletsTab, AdminWithdrawalsTab } from "@/components/msk/admin-wallets";
import { FilterChips } from "@/components/msk/filter-chips";

const levels = [
  { threshold: "1K", title: "Pulseira de Silicone", description: "Primeiro passo. Você começou.", image: award1kAsset.url },
  { threshold: "10K", title: "Barra de Ouro", description: "Já está no jogo de verdade.", image: award10kNewAsset.url },
  { threshold: "100K", title: "Rubi Natural", description: "Nível de quem leva a sério.", image: award100kNewAsset.url },
  { threshold: "500K", title: "Safira Azul", description: "Elite. Resultados consistentes.", image: award500kAsset.url },
  { threshold: "1M", title: "Diamante Brilhante", description: "Milhão conquistado. Nível máximo.", image: award1mAsset.url },
  { threshold: "5M", title: "Diamante Raro", description: "Lenda. Quem chegou no topo.", image: award5mAsset.url },
];

type NavItem = {
  value: string;
  label: string;
  Icon: typeof Users;
  subs?: { value: string; label: string }[];
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { value: "licenses", label: "Dashboard", Icon: LayoutDashboard },
      {
        value: "tokens",
        label: "Licenças",
        Icon: KeyRound,
        subs: [
          { value: "tokens", label: "Gerar licença" },
          { value: "subs", label: "Planos & Ofertas" },
          { value: "extension", label: "Extensão" },
        ],
      },
      { value: "users", label: "Usuários", Icon: Users },
    ],
  },
  {
    title: "Financeiro",
    items: [
      {
        value: "finance",
        label: "Financeiro",
        Icon: TrendingUp,
        subs: [
          { value: "finance", label: "Resumo" },
          { value: "payments", label: "Vendas" },
          { value: "wallets", label: "Carteiras" },
          { value: "withdrawals", label: "Saques" },
          { value: "gateway", label: "Gateway" },
        ],
      },
      { value: "affiliates", label: "Afiliados", Icon: Users },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      {
        value: "editor",
        label: "Site & Marca",
        Icon: Activity,
        subs: [
          { value: "editor", label: "Editor do site" },
          { value: "awards", label: "Premiações" },
        ],
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      { value: "tracking", label: "Analytics", Icon: TrendingUp },
      {
        value: "notifications",
        label: "Notificações",
        Icon: Bell,
        subs: [
          { value: "notifications", label: "Preferências" },
          { value: "push", label: "Enviar / Testar" },
          { value: "push_logs", label: "Log de envios" },
        ],
      },
      {
        value: "logs",
        label: "Auditoria",
        Icon: Clock,
        subs: [
          { value: "logs", label: "Registros" },
          { value: "webhooks", label: "Webhooks" },
        ],
      },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((i) => [
    { value: i.value, label: i.label },
    ...(i.subs ?? []).map((s) => ({ value: s.value, label: s.label })),
  ]),
);

function navOwner(tab: string): NavItem | undefined {
  return NAV_GROUPS.flatMap((g) => g.items).find(
    (i) => i.value === tab || (i.subs ?? []).some((s) => s.value === tab),
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — MSK SISTEM" },
      { name: "description", content: "Painel administrativo: usuários, licenças, assinaturas, pagamentos e webhooks da plataforma MSK SISTEM." },
      { property: "og:title", content: "Painel admin — MSK SISTEM" },
      { property: "og:description", content: "Gestão de licenças e assinaturas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

function durationText(ms?: number | null) {
  const value = Number(ms ?? 0);
  if (!(value > 0)) return "Validade do plano";
  const minutes = Math.round(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days} dia${days === 1 ? "" : "s"}`;
}

function remainingText(expiresAt: string | null | undefined, now: number) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return "EXPIRADA";
  const total = Math.floor(diff / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

const brl = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const SALE_PAID = ["PAID", "APPROVED", "COMPLETED"];
const saleGroup = (t: any) => {
  const s = String(t?.status ?? "").toUpperCase();
  if (SALE_PAID.includes(s) || t?.paid_at) return "paid";
  if (["PENDING", "WAITING", "PROCESSING"].includes(s)) return "pending";
  return "failed";
};

function Admin() {
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isAdmin);
  const overviewFn = useServerFn(adminOverview);
  const actionFn = useServerFn(adminLicenseAction);
  const userActionFn = useServerFn(adminUserAction);
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [term, setTerm] = useState("");
  const [userTerm, setUserTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("licenses");
  const [statusFilter, setStatusFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [clock, setClock] = useState(() => Date.now());
  const owner = navOwner(activeTab);
  const [issued, setIssued] = useState<{ token: string; email: string; licenseId: string } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview", term, userTerm],
    queryFn: () => overviewFn({ data: { search: term, userSearch: userTerm } }),
    enabled: !!role?.admin,
    refetchInterval: 15_000,
  });

  async function act(licenseId: string, action: "revoke" | "suspend" | "reactivate" | "extend" | "block") {
    if (action === "revoke" || action === "block") {
      const confirm = window.confirm(
        action === "block"
          ? "BLOQUEAR LICENÇA: O usuário perderá o acesso IMEDIATAMENTE. Deseja confirmar?"
          : "Ao desligar esta extensão, o usuário perderá imediatamente o acesso à licença atual. Deseja continuar?",
      );
      if (!confirm) return;
    }
    try {
      await actionFn({ data: { licenseId, action: action === "block" ? "revoke" : action, ...(action === "extend" ? { days: 30 } : {}) } });
      toast.success(action === "block" ? "Licença bloqueada e acesso removido." : action === "revoke" ? "Extensão desligada com sucesso." : "Ação aplicada.");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleUserAction(userId: string, action: "reset_password" | "reset_withdrawal_password" | "block_user" | "unblock_user") {
    const confirmMessage = {
      reset_password: "Deseja gerar um link de recuperação de senha para este usuário?",
      reset_withdrawal_password: "Deseja resetar a senha de saque deste usuário?",
      block_user: "Deseja BLOQUEAR este usuário? Ele não conseguirá acessar a plataforma.",
      unblock_user: "Deseja DESBLOQUEAR este usuário?",
    }[action];
    if (!window.confirm(confirmMessage)) return;
    try {
      const result = await userActionFn({ data: { userId, action } });
      if (action === "reset_password" && result.link) {
        navigator.clipboard.writeText(result.link);
        toast.success("Link de recuperação copiado para a área de transferência!");
      } else toast.success("Ação realizada com sucesso.");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const handleWhatsApp = (phone: string, name: string, type: "welcome" | "recovery" | "urgency") => {
    if (!phone) return toast.error("Usuário sem telefone cadastrado");
    const cms = (data as any)?.cms_settings || {};
    const messages = cms.recovery_messages || {};
    let msg = messages[type] || "";
    if (!msg) {
      const fallbacks = {
        welcome: "Olá {nome}, seja bem-vindo ao MSK SISTEM! Estamos felizes em ter você conosco.",
        recovery: "Olá {nome}, vimos que você gerou um PIX mas ainda não concluiu. Posso te ajudar com algo?",
        urgency: "Olá {nome}, sua oferta especial expira em breve! Garanta seu acesso agora com desconto.",
      };
      msg = fallbacks[type];
    }
    const finalMsg = msg.replace(/{nome}/g, name || "cliente");
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMsg)}`, "_blank");
  };

  if (roleLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!role?.admin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="glass max-w-md rounded-2xl p-10 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">Esta área é exclusiva para administradores.</p>
          <Button asChild variant="neonOutline" className="mt-6"><Link to="/painel">Voltar ao painel</Link></Button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col lg:flex-row">
      <aside className="hidden w-64 flex-col border-r border-border/60 bg-card/30 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-border/60 px-6"><Link to="/"><MskLogo size={32} /></Link></div>
        <nav className="flex-1 space-y-6 p-4 scrollbar-hide overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-4 pb-1 text-[0.55rem] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{group.title}</p>
              {group.items.map(({ value, label, Icon, subs }) => {
                const hasPendingAffiliates = value === "affiliates" && data?.affiliates?.some((a: any) => a.verification_status === "PENDING");
                const isOpen = owner?.value === value;
                return (
                  <div key={value} className="space-y-1">
                    <button type="button" onClick={() => setActiveTab(value)} className={cn("w-full flex items-center justify-between rounded-xl px-4 py-3 text-[0.68rem] font-black uppercase tracking-widest transition-all", isOpen ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-white/5 hover:text-foreground") }>
                      <div className="flex items-center gap-3 truncate"><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></div>
                      {hasPendingAffiliates ? <div className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"/><span className="relative inline-flex h-2 w-2 rounded-full bg-primary"/></div> : null}
                    </button>
                    {isOpen && subs ? (
                      <div className="ml-5 space-y-0.5 border-l border-primary/25 pl-3">
                        {subs.map((s) => <button key={s.value} type="button" onClick={() => setActiveTab(s.value)} className={cn("block w-full truncate rounded-lg px-3 py-2 text-left text-[0.62rem] font-bold uppercase tracking-widest transition-colors", activeTab === s.value ? "bg-primary/10 text-primary" : "text-muted-foreground/70 hover:text-foreground")}>{s.label}</button>)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-50 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-background/80 px-5 backdrop-blur-xl lg:hidden">
          <Link to="/" className="min-w-0"><MskLogo size={28} /></Link>
          <button aria-label="Abrir menu" onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center rounded-2xl border border-border/60"><Menu className="h-5 w-5" /></button>
        </header>

        {menuOpen ? (
          <div className="fixed inset-0 z-[200] lg:hidden">
            <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" onClick={() => setMenuOpen(false)} />
            <nav className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-l border-border/60 bg-card p-5 shadow-2xl">
              <div className="mb-6 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Admin</span><button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl border border-border/60"><X className="h-5 w-5" /></button></div>
              <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <p className="px-2 pb-1 text-[0.55rem] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{group.title}</p>
                    {group.items.map(({ value, label, Icon, subs }) => (
                      <div key={value}>
                        <button onClick={() => { setActiveTab(value); if (!subs) setMenuOpen(false); }} className={cn("w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all", owner?.value === value ? "bg-primary/10 text-primary" : "text-muted-foreground")}><Icon className="h-5 w-5 shrink-0" />{label}</button>
                        {owner?.value === value && subs ? <div className="ml-6 space-y-0.5 border-l border-primary/25 pl-3">{subs.map((s) => <button key={s.value} onClick={() => { setActiveTab(s.value); setMenuOpen(false); }} className={cn("block w-full rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors", activeTab === s.value ? "text-primary" : "text-muted-foreground/70")}>{s.label}</button>)}</div> : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </nav>
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto p-5 sm:p-10">
          <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div><h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">Sistema <span className="neon-text">Geral</span></h1><p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Infraestrutura MSK SISTEM</p></div>
            <Button variant="neon" className="w-full md:w-auto" onClick={() => setActiveTab("tokens")}><KeyRound className="h-4 w-4" /> Gerar licença</Button>
          </header>

          {owner?.subs ? <FilterChips className="mb-6" value={activeTab} onChange={setActiveTab} chips={owner.subs.map((s) => ({ id: s.value, label: s.label }))} /> : null}

          {activeTab === "licenses" ? (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
                {[
                  ["Usuários", stats?.users, Users, "text-blue-400"],
                  ["Licenças Ativas", stats?.activeLicenses, Zap, "text-yellow-400"],
                  ["Comissões do Mês", brl(stats?.monthCommissions), TrendingUp, "text-primary"],
                  ["Vendas Aprovadas", stats?.conversions ?? 0, Activity, "text-cyan-400"],
                  ["Receita Aprovada", brl(stats?.revenue), DollarSign, "text-emerald-400"],
                ].map(([k, v, Icon, color]: any) => <div key={k} className="glass group rounded-2xl p-4 sm:p-5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{k}</p><p className="mt-1 text-lg sm:text-2xl font-bold">{v ?? "—"}</p></div><div className={`w-fit rounded-xl bg-muted/20 p-2 ${color}`}><Icon className="h-5 w-5" /></div></div></div>)}
              </div>

              <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <FilterChips
                  value={statusFilter}
                  onChange={setStatusFilter}
                  chips={(() => {
                    const list = (data?.licenses ?? []) as any[];
                    return [
                      { id: "all", label: "Todas", count: list.length },
                      { id: "active", label: "Ativas", count: list.filter((l) => l.status === "active").length },
                      { id: "pending", label: "Aguardando ativação", count: list.filter((l) => l.status === "pending").length },
                      { id: "expired", label: "Expiradas", count: list.filter((l) => l.status === "expired").length },
                      { id: "suspended", label: "Suspensas", count: list.filter((l) => l.status === "suspended").length },
                      { id: "revoked", label: "Revogadas", count: list.filter((l) => l.status === "revoked").length },
                    ];
                  })()}
                />
                <form className="flex w-full gap-2 lg:max-w-sm" onSubmit={(e) => { e.preventDefault(); setTerm(search); }}><Input placeholder="Buscar por token..." value={search} onChange={(e) => setSearch(e.target.value)} /><Button type="submit" variant="neon"><Search /></Button></form>
              </div>
            </>
          ) : null}

          {isLoading ? <div className="mt-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <div className="mt-8">
              <div className="flex items-center gap-3"><div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary/20" /><div><h3 className="text-sm font-black uppercase tracking-widest">{ALL_NAV.find((n) => n.value === activeTab)?.label ?? "Painel"}</h3><p className="text-[0.6rem] font-bold uppercase text-muted-foreground">Gestão completa da infraestrutura</p></div></div>

              <div className="glass mt-4 overflow-x-auto rounded-[2rem] p-6 scrollbar-hide animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
                {activeTab === "licenses" ? (
                  <div className="overflow-x-auto">
                    <div className="flex items-center gap-3 mb-6"><div className="h-8 w-1 bg-primary rounded-full" /><h4 className="text-[0.7rem] font-black uppercase tracking-widest">Gestão de Licenças</h4></div>
                    <table className="w-full text-left text-sm">
                      <thead className="text-[0.65rem] uppercase tracking-widest text-muted-foreground border-b border-border/50"><tr><th className="p-4">Usuário</th><th className="p-4">Token</th><th className="p-4">Plano</th><th className="p-4">Status</th><th className="p-4">Validade / contador</th><th className="p-4 text-right">Ações</th></tr></thead>
                      <tbody className="divide-y divide-border/30">
                        {(data?.licenses ?? []).filter((l: any) => statusFilter === "all" || l.status === statusFilter).map((l: any) => {
                          const isOnline = l.last_validation && new Date(l.last_validation).getTime() > Date.now() - 60_000;
                          const pendingMs = Number(l.pending_duration_ms ?? l.metadata?.pending_duration_ms ?? 0);
                          const remaining = remainingText(l.expires_at, clock);
                          const isLifetime = !!l.plans?.is_lifetime;
                          const label = l.status === "pending" ? "Aguardando ativação" : l.status === "expired" ? "Expirada" : l.status === "active" ? "Ativa" : l.status === "suspended" ? "Suspensa" : l.status === "revoked" ? "Revogada" : String(l.status);
                          return (
                            <tr key={l.id} className="group hover:bg-muted/5 transition-colors">
                              <td className="p-4"><div className="flex flex-col"><span className="font-medium truncate max-w-[180px]">{l.profiles?.email ?? "Sem usuário"}</span><div className="flex items-center gap-1.5 mt-1"><span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-muted"}`} /><span className="text-[0.65rem] text-muted-foreground uppercase">{isOnline ? "Online" : "Offline"}</span></div></div></td>
                              <td className="p-4"><code className="rounded bg-muted/30 px-2 py-1 font-mono text-xs text-primary">{l.token_preview ?? `••••${l.token_last4 ?? ""}`}</code></td>
                              <td className="p-4"><span className="rounded-lg border border-border/40 bg-muted/20 px-2 py-1 text-xs">{l.plans?.name ?? "Manual"}</span></td>
                              <td className="p-4"><span className={cn("rounded-full border px-2.5 py-0.5 text-[0.6rem] font-bold uppercase", l.status === "active" ? "text-primary border-primary/30 bg-primary/10" : l.status === "pending" ? "text-amber-400 border-amber-400/30 bg-amber-400/10" : l.status === "expired" ? "text-yellow-500 border-yellow-500/30 bg-yellow-500/10" : "text-red-500 border-red-500/30 bg-red-500/10")}>{label}</span></td>
                              <td className="p-4 text-xs min-w-[190px]">
                                {l.status === "pending" ? (
                                  <div><p className="font-bold text-amber-400">Começa na ativação</p><p className="mt-1 text-muted-foreground">Duração: {durationText(pendingMs)}</p></div>
                                ) : l.status === "expired" ? (
                                  <div><p className="font-bold text-yellow-500">EXPIRADA</p><p className="mt-1 text-muted-foreground">{l.expires_at ? fmt(l.expires_at) : "—"}</p></div>
                                ) : l.expires_at ? (
                                  <div><p className="font-mono font-black text-primary">{remaining}</p><p className="mt-1 text-muted-foreground">Até {fmt(l.expires_at)}</p></div>
                                ) : isLifetime ? (
                                  <span className="font-bold text-primary">Vitalícia</span>
                                ) : (
                                  <span className="font-bold text-destructive">Validade não definida</span>
                                )}
                              </td>
                              <td className="p-4 text-right"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" className="h-8 w-8 text-cyan-400" title="Copiar Dados de Entrega" onClick={() => { setIssued({ token: "Carregando...", email: l.profiles?.email || "", licenseId: l.id }); setActiveTab("tokens"); }}><MessageSquare className="h-4 w-4" /></Button>{l.status !== "revoked" ? <><Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title="Estender 30 dias" onClick={() => act(l.id, "extend")}><Clock className="h-4 w-4" /></Button><Button size="sm" variant="destructive" className="h-8 px-2 text-[10px] font-bold uppercase" onClick={() => act(l.id, "block")}>Bloquear</Button></> : null}</div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {activeTab === "editor" && <AdminEditorTab />}
                {activeTab === "tracking" && <AdminTrackingTab />}
                {activeTab === "tokens" && <AdminTokenGenerator initialIssued={issued} onReset={() => setIssued(null)} />}
                {activeTab === "gateway" && <AdminGatewayTab />}
                {activeTab === "extension" && <AdminExtensionTab />}
                {activeTab === "wallets" && <AdminWalletsTab />}
                {activeTab === "withdrawals" && <AdminWithdrawalsTab />}
                {activeTab === "push" && <AdminPushTestsTab />}
                {activeTab === "push_logs" && <AdminPushLogsTab />}
                {activeTab === "notifications" && <NotificationSettings scope="admin" />}
                {activeTab === "subs" && <AdminSubscriptionsTab plans={(data?.plans ?? []) as Record<string, any>[]} subscriptions={(data?.subscriptions ?? []) as Record<string, any>[]} />}

                {activeTab === "payments" && (() => {
                  const sales = (data?.payments ?? []) as Record<string, any>[];
                  const filtered = sales.filter((p) => salesFilter === "all" || saleGroup(p) === salesFilter);
                  return (
                    <div className="space-y-4">
                      <FilterChips value={salesFilter} onChange={setSalesFilter} chips={[{ id: "all", label: "Todas", count: sales.length }, { id: "paid", label: "Aprovadas", count: sales.filter((p) => saleGroup(p) === "paid").length }, { id: "pending", label: "Pendentes", count: sales.filter((p) => saleGroup(p) === "pending").length }, { id: "failed", label: "Não pagas", count: sales.filter((p) => saleGroup(p) === "failed").length }]} />
                      {filtered.map((p) => {
                        const group = saleGroup(p);
                        return <div key={p["id"]} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border/40 bg-background/30 px-4 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium">{p["profiles"]?.email ?? "—"}</p><p className="truncate text-xs text-muted-foreground">{p["provider"]} · {p["method"] ?? "pix"} · {fmt(p["created_at"])}</p></div><div className="text-right"><p className="font-black text-primary">{brl(p["amount"])}</p><span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[0.55rem] font-black uppercase", group === "paid" ? "bg-emerald-500/15 text-emerald-400" : group === "pending" ? "bg-yellow-500/15 text-yellow-500" : "bg-red-500/15 text-red-400")}>{p["status"]}</span></div></div>;
                      })}
                      {!filtered.length ? <p className="text-sm text-muted-foreground">Nenhuma venda neste filtro.</p> : null}
                    </div>
                  );
                })()}

                {activeTab === "webhooks" && <div className="space-y-2">{((data?.webhooks ?? []) as Record<string, any>[]).map((w) => <div key={w["id"]} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border/40 px-4 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium">{w["event_type"]}</p><p className="truncate text-xs text-muted-foreground">{w["provider"]} · {fmt(w["created_at"])} {w["error"] ? `· ${w["error"]}` : ""}</p></div><span className={cn("rounded-full px-2.5 py-0.5 text-[0.6rem] font-black uppercase", w["processed"] ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-500")}>{w["processed"] ? "Processado" : "Pendente"}</span></div>)}{!data?.webhooks?.length ? <p className="text-sm text-muted-foreground">Nenhum webhook recebido ainda.</p> : null}</div>}

                {activeTab === "awards" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6"><div className="h-8 w-1 bg-yellow-400 rounded-full" /><h4 className="text-[0.7rem] font-black uppercase tracking-widest">Gestão de Premiações e Recompensas</h4></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="glass rounded-3xl p-6 border border-white/5 space-y-4"><div className="aspect-video rounded-2xl bg-black/20 overflow-hidden relative group"><img src={awardsHeroAsset.url} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Button size="sm" variant="neonOutline">Trocar Hero</Button></div></div><p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Banner Principal Premiações</p></div>
                      {levels.map((level, i) => <div key={i} className="glass rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center space-y-3"><div className="h-24 w-24 relative"><img src={level.image} className="w-full h-full object-contain" /><div className="absolute -top-2 -right-2 bg-primary text-black text-[8px] font-black px-2 py-0.5 rounded-full">{level.threshold}</div></div><div><h5 className="text-xs font-black uppercase tracking-widest">{level.title}</h5><p className="text-[0.6rem] text-muted-foreground mt-1">{level.description}</p></div><div className="flex gap-2 w-full pt-2"><Button size="sm" variant="ghost" className="flex-1 text-[8px] font-black uppercase border border-white/5">Editar</Button><Button size="sm" variant="ghost" className="flex-1 text-[8px] font-black uppercase border border-white/5 text-red-500">Remover</Button></div></div>)}
                    </div>
                  </div>
                )}

                {activeTab === "finance" && <AdminFinanceTab />}
                {activeTab === "affiliates" && <AdminAffiliatesTab />}

                {activeTab === "users" && (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"><div className="flex items-center gap-3"><div className="h-8 w-1 bg-blue-500 rounded-full" /><h4 className="text-[0.7rem] font-black uppercase tracking-widest">Gestão de Usuários</h4></div><form className="flex w-full gap-2 md:max-w-xs" onSubmit={(e) => { e.preventDefault(); setUserTerm(userSearch); }}><Input placeholder="Nome ou e-mail..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="h-9 text-xs" /><Button type="submit" variant="neon" size="sm"><Search className="h-4 w-4" /></Button></form></div>
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[0.6rem] uppercase tracking-widest text-muted-foreground border-b border-border/50"><tr><th className="p-4">Nome</th><th className="p-4">E-mail</th><th className="p-4">Status</th><th className="p-4">Cadastro</th><th className="p-4 text-right">Ações de Suporte</th></tr></thead><tbody className="divide-y divide-border/30">{data?.users?.map((u: any) => <tr key={u.id} className="group hover:bg-muted/5 transition-colors"><td className="p-4 font-bold">{u.name || "—"}</td><td className="p-4 text-muted-foreground">{u.email}</td><td className="p-4"><span className={cn("rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase", u.status === "blocked" ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500")}>{u.status === "blocked" ? "Bloqueado" : "Ativo"}</span></td><td className="p-4 text-xs text-muted-foreground">{fmt(u.created_at)}</td><td className="p-4 text-right"><div className="flex justify-end gap-1.5"><Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500" title="Boas-Vindas" onClick={() => handleWhatsApp(u.phone, u.name, "welcome")}><MessageCircle className="h-3.5 w-3.5" /></Button><Button size="sm" variant="ghost" className="h-8 text-[9px] font-black uppercase border border-white/5 text-primary" onClick={() => handleUserAction(u.id, "reset_password")}>Senha Login</Button><Button size="sm" variant="ghost" className="h-8 text-[9px] font-black uppercase border border-white/5 text-yellow-500" onClick={() => handleUserAction(u.id, "reset_withdrawal_password")}>Senha Saque</Button><Button size="sm" variant="ghost" className={cn("h-8 text-[9px] font-black uppercase border border-white/5", u.status === "blocked" ? "text-green-500" : "text-red-500")} onClick={() => handleUserAction(u.id, u.status === "blocked" ? "unblock_user" : "block_user")}>{u.status === "blocked" ? "Desbloquear" : "Bloquear"}</Button></div></td></tr>)}</tbody></table></div>
                  </div>
                )}

                {activeTab === "logs" && <div className="space-y-2">{data?.events?.map((e: any) => <div key={e.id} className="flex justify-between border-b border-border/30 pb-2 text-xs"><span className="font-bold text-primary uppercase">{e.event_type}</span><span className="text-muted-foreground">{fmt(e.created_at)}</span></div>)}</div>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
