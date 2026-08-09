import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, Clock, LayoutDashboard, Loader2, Menu, Search, ShieldAlert, Trash2, Users, X, Zap, TrendingUp, DollarSign, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminGatewayTab } from "@/components/msk/admin-gateway";
import { AdminFinanceTab } from "@/components/msk/admin-finance";
import { AdminExtensionTab } from "@/components/msk/admin-extension";
import { AdminAffiliatesTab } from "@/components/msk/admin-affiliates";
import { AdminTokenGenerator } from "@/components/msk/admin-token-generator";
import { AdminTrackingTab } from "@/components/msk/admin-tracking";
import { AdminEditorTab } from "@/components/msk/admin-editor";
import { AdminPushTestsTab } from "@/components/msk/admin-push-tests";

import { MskLogo } from "@/components/msk/logo";
import { adminLicenseAction, adminOverview, isAdmin } from "@/lib/admin.functions";
import { HeroCarousel } from "@/components/msk/hero-carousel";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — LOVABLE MSK" },
      {
        name: "description",
        content: "Painel administrativo: usuários, licenças, assinaturas, pagamentos e webhooks da plataforma Lovable MSK.",
      },
      { property: "og:title", content: "Painel admin — LOVABLE MSK" },
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

function Admin() {
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isAdmin);
  const overviewFn = useServerFn(adminOverview);
  const actionFn = useServerFn(adminLicenseAction);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("licenses");
  const [issued, setIssued] = useState<{ token: string; email: string; licenseId: string } | null>(null);

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview", term],
    queryFn: () => overviewFn({ data: { search: term } }),
    enabled: !!role?.admin,
  });

  async function act(licenseId: string, action: "revoke" | "suspend" | "reactivate" | "extend" | "block") {
    if (action === "revoke" || action === "block") {
      const confirm = window.confirm(
        action === "block" 
          ? "BLOQUEAR LICENÇA: O usuário perderá o acesso IMEDIATAMENTE. O arquivo/extensão que pede licença irá atualizar e exigir uma nova. Deseja confirmar o bloqueio?"
          : "Ao desligar esta extensão, o usuário perderá imediatamente o acesso à licença atual. A extensão deixará de funcionar e uma nova licença será necessária para recuperar o acesso. Deseja continuar?"
      );
      if (!confirm) return;
    }

    try {
      await actionFn({
        data: { licenseId, action: action === "block" ? "revoke" : action, ...(action === "extend" ? { days: 30 } : {}) },
      });
      toast.success(action === "block" ? "Licença bloqueada e acesso removido." : action === "revoke" ? "Extensão desligada com sucesso." : "Ação aplicada.");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!role?.admin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="glass max-w-md rounded-2xl p-10 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva para administradores.
          </p>
          <Button asChild variant="neonOutline" className="mt-6">
            <Link to="/painel">Voltar ao painel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-background/50 flex flex-col lg:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 flex-col border-r border-border/60 bg-card/30 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-border/60 px-6">
          <Link to="/">
            <MskLogo size={32} />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {[
            { value: "licenses", label: "Dashboard", Icon: LayoutDashboard },
            { value: "affiliates", label: "Afiliados", Icon: Users },
            { value: "subs", label: "Assinaturas", Icon: Zap },
            { value: "finance", label: "Financeiro", Icon: TrendingUp },
            { value: "editor", label: "Editor", Icon: Activity },
            { value: "tracking", label: "Analytics", Icon: TrendingUp },
            { value: "gateway", label: "Gateway", Icon: ShieldAlert },
            { value: "logs", label: "Logs", Icon: Clock },
          ].map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all border-none shadow-none",
                activeTab === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Header Mobile */}
        <header className="sticky top-0 z-50 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-background/80 px-5 backdrop-blur-xl lg:hidden">
          <Link to="/" className="min-w-0">
            <MskLogo size={28} />
          </Link>
          <button
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-border/60 text-foreground active:bg-white/10 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile Sidebar Overlay */}
        {menuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={() => setMenuOpen(false)} />
            <nav className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-l border-border/60 bg-card p-5 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Admin</span>
                <button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl border border-border/60">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
                {[
                  { value: "licenses", label: "Dashboard", Icon: LayoutDashboard },
                  { value: "affiliates", label: "Afiliados", Icon: Users },
                  { value: "subs", label: "Ofertas", Icon: Zap },
                  { value: "finance", label: "Financeiro", Icon: TrendingUp },
                  { value: "editor", label: "Editor", Icon: Activity },
                  { value: "tracking", label: "Analytics", Icon: TrendingUp },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setActiveTab(value); setMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-4 rounded-2xl px-5 py-4 text-base font-bold transition-all",
                      activeTab === value ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-5 sm:p-10">
          <div className="mb-10">
            <HeroCarousel />
          </div>

          <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
                Sistema <span className="neon-text">Geral</span>
              </h1>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Infraestrutura MSK Suite
              </p>
            </div>
          </header>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 sm:gap-4">
            {[
              ["Total de Afiliados", stats?.users, Users, "text-blue-400"],
              ["Afiliados Ativos", stats?.activeLicenses, Zap, "text-yellow-400"],
              ["Comissões do Mês", "R$ 0,00", TrendingUp, "text-primary"],
              ["Conversões", 0, Activity, "text-cyan-400"],
              ["Receita Gerada", "R$ 0,00", DollarSign, "text-emerald-400"],
            ].map(([k, v, Icon, color]: any) => (
              <div key={k} className="glass group relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all hover:border-primary/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-[0.6rem] sm:text-[0.65rem] uppercase tracking-widest text-muted-foreground truncate">{k}</p>
                    <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-foreground">{v ?? "—"}</p>
                  </div>
                  <div className={`w-fit rounded-xl bg-muted/20 p-2 sm:p-2.5 transition-colors group-hover:bg-muted/40 ${color}`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form
            className="mt-8 flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(search);
            }}
          >
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="neon">
              <Search />
            </Button>
          </form>

          {isLoading ? (
            <div className="mt-16 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="mt-8">
              <div className="glass flex h-auto w-full flex-nowrap gap-1 overflow-x-auto p-1 no-scrollbar sm:flex-wrap pb-2 mb-4">
                {[
                  { value: "licenses", label: "Licenças", color: "" },
                  { value: "editor", label: "Editor", color: "text-primary" },
                  { value: "tracking", label: "Analytics", color: "text-emerald-400" },
                  ...(role?.superAdmin ? [{ value: "tokens", label: "Gerar token", color: "" }] : []),
                  { value: "users", label: "Usuários", color: "" },
                  { value: "subs", label: "Assinaturas", color: "" },
                  { value: "payments", label: "Pagamentos", color: "" },
                  { value: "webhooks", label: "Webhooks", color: "" },
                  { value: "logs", label: "Auditoria", color: "" },
                  { value: "gateway", label: "Gateway", color: "text-cyan-400" },
                  { value: "finance", label: "Financeiro", color: "text-yellow-400" },
                  { value: "extension", label: "Extensão", color: "" },
                  { value: "affiliates", label: "Afiliados", color: "" },
                  { value: "push", label: "🔔 Testes / Push", color: "text-orange-400" },

                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all shrink-0 min-w-[100px]",
                      activeTab === tab.value ? "bg-primary/20 text-foreground" : "text-muted-foreground",
                      tab.color
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="glass mt-4 overflow-x-auto rounded-2xl p-4">
                {activeTab === "licenses" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-[0.65rem] uppercase tracking-widest text-muted-foreground border-b border-border/50">
                        <tr>
                          <th className="p-4">Usuário</th>
                          <th className="p-4">Token</th>
                          <th className="p-4">Plano</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Validade</th>
                          <th className="p-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {(data?.licenses ?? []).map((l: any) => {
                          const isOnline = l.last_validation && new Date(l.last_validation).getTime() > Date.now() - 300000;
                          const isExpired = l.expires_at && new Date(l.expires_at) < new Date();
                          return (
                            <tr key={l.id} className="group hover:bg-muted/5 transition-colors">
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-medium truncate max-w-[150px]">{l.profiles?.email ?? "—"}</span>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-muted"}`} />
                                    <span className="text-[0.65rem] text-muted-foreground uppercase tracking-tight">{isOnline ? "Online" : "Offline"}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <code className="rounded bg-muted/30 px-2 py-1 font-mono text-xs text-primary">{l.token_preview ?? `••••${l.token_last4 ?? ""}`}</code>
                              </td>
                              <td className="p-4">
                                <span className="rounded-lg border border-border/40 bg-muted/20 px-2 py-1 text-xs">{l.plans?.name ?? "Trial"}</span>
                              </td>
                              <td className="p-4">
                                <span className={cn(
                                  "rounded-full border px-2.5 py-0.5 text-[0.6rem] font-bold uppercase",
                                  l.status === 'active' ? (isExpired ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' : 'text-primary border-primary/30 bg-primary/10') :
                                  l.status === 'suspended' ? 'text-destructive border-destructive/30 bg-destructive/10' :
                                  'text-red-500 border-red-500/30 bg-red-500/10'
                                )}>
                                  {isExpired && l.status === 'active' ? 'Expirado' : l.status}
                                </span>
                              </td>
                              <td className="p-4 text-xs">
                                {l.expires_at ? new Date(l.expires_at).toLocaleDateString("pt-BR") : "Vitalício"}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-cyan-400" onClick={() => { setIssued({ token: "...", email: l.profiles?.email || "", licenseId: l.id }); setActiveTab("tokens"); }}>
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                  {l.status !== 'revoked' && (
                                    <>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => act(l.id, "extend")}>
                                        <Clock className="h-4 w-4" />
                                      </Button>
                                      <Button size="sm" variant="destructive" className="h-8 px-2 text-[10px] font-bold uppercase" onClick={() => act(l.id, "block")}>Bloquear</Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {activeTab === "editor" && <AdminEditorTab />}
                {activeTab === "tracking" && <AdminTrackingTab />}
                {activeTab === "tokens" && role?.superAdmin && <AdminTokenGenerator initialIssued={issued} onReset={() => setIssued(null)} />}
                {activeTab === "gateway" && <AdminGatewayTab />}
                {activeTab === "affiliates" && <AdminAffiliatesTab />}
                {activeTab === "extension" && <AdminExtensionTab />}
                {activeTab === "push" && <AdminPushTestsTab />}

                {activeTab === "finance" && <AdminFinanceTab />}
                {activeTab === "users" && (
                  <table className="w-full text-left text-sm">
                    <thead><tr className="text-[0.65rem] uppercase text-muted-foreground"><th className="p-2">Nome</th><th className="p-2">E-mail</th></tr></thead>
                    <tbody>{data?.users?.map((u:any) => <tr key={u.id} className="border-t border-border/50"><td className="p-2">{u.name}</td><td className="p-2">{u.email}</td></tr>)}</tbody>
                  </table>
                )}
                {activeTab === "logs" && (
                  <div className="space-y-2">
                    {data?.events?.map((e:any) => (
                      <div key={e.id} className="flex justify-between border-b border-border/30 pb-2 text-xs">
                        <span className="font-bold text-primary uppercase">{e.event_type}</span>
                        <span className="text-muted-foreground">{fmt(e.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
