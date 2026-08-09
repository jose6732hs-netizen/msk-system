import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  Laptop,
  Loader2,
  LogOut,
  Menu,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MskLogo } from "@/components/msk/logo";
import { getAccount, getMyToken, removeMyDevice, cancelMySubscription } from "@/lib/account.functions";
import { ExtensionDownloadCard } from "@/components/msk/extension-download";
import { TokenManager } from "@/components/msk/token-manager";
import { HeroCarousel } from "@/components/msk/hero-carousel";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Meu painel — MSK SISTEM" },
      {
        name: "description",
        content:
          "Veja o status da sua licença, copie seu token e gerencie os dispositivos conectados à extensão MSK SISTEM.",
      },
      { property: "og:title", content: "Painel do assinante — MSK SISTEM" },
      { property: "og:description", content: "Licença, token e dispositivos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

function statusStyle(status?: string | null) {
  if (status === "active") return "text-primary border-primary/40 bg-primary/10";
  if (status === "expired" || status === "revoked")
    return "text-destructive border-destructive/40 bg-destructive/10";
  return "text-muted-foreground border-border bg-muted/30";
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

function Painel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAccount = useServerFn(getAccount);
  const revealFn = useServerFn(getMyToken);
  const removeFn = useServerFn(removeMyDevice);
  const cancelFn = useServerFn(cancelMySubscription);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchAccount(),
  });

  const license = data?.license as any;
  const plan = license?.plans;

  async function reveal() {
    if (!license) return;
    setBusy(true);
    try {
      const res = await revealFn({ data: { licenseId: license.id } });
      setToken(res.token);
      toast.success("Token revelado com sucesso!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    toast.success("Token copiado!");
  }

  async function removeDevice(id: string) {
    try {
      await removeFn({ data: { deviceId: id } });
      toast.success("Dispositivo removido.");
      qc.invalidateQueries({ queryKey: ["account"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function cancelSub(id: string) {
    try {
      await cancelFn({ data: { subscriptionId: id } });
      toast.success("Assinatura cancelada. O acesso continua até o fim do período.");
      qc.invalidateQueries({ queryKey: ["account"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5">
          <Link to="/" className="min-w-0">
            <MskLogo size={34} />
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <Button asChild variant="ghost" size="sm">
              <Link to="/documentacao">Documentação</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/planos" preload="intent">Planos</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/parceiros" preload="intent">Afiliados</Link>
            </Button>
            <Button variant="neonOutline" size="sm" onClick={signOut}>
              <LogOut /> Sair
            </Button>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <button
              aria-label="Sair da conta"
              onClick={signOut}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/40 text-primary"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              aria-label="Abrir menu"
              onClick={() => setMenuOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-border/60"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[9998] sm:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-2 overflow-y-auto border-l border-border/60 bg-card/95 p-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Menu</span>
              <button
                aria-label="Fechar"
                onClick={() => setMenuOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-border/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Link to="/planos" preload="intent" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground">
              Planos
            </Link>
            <Link to="/parceiros" preload="intent" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground">
              Afiliados
            </Link>
            <Link to="/documentacao" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground">
              Documentação
            </Link>
            <Button
              variant="neonOutline"
              size="sm"
              className="mt-2 h-12 w-full shrink-0 justify-center gap-2 whitespace-nowrap text-sm font-black uppercase"
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </nav>
        </div>
      )}


      <main className="mx-auto max-w-6xl px-5 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-10">
        <div className="mb-8">
          <HeroCarousel />
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              Olá, <span className="neon-text">{data?.profile?.name ?? "assinante"}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{data?.profile?.email}</p>
          </div>
          
          <div className="flex-1 max-w-xs lg:max-w-md hidden sm:block">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Progresso da Conta</span>
              <span className="text-[10px] font-black text-primary">75%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div className="bg-primary h-full w-[75%] transition-all duration-1000" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !license ? (
          <div className="mt-10 space-y-8">
            <div className="glass rounded-2xl p-10 text-center border-primary/20">
              <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-4 text-xl font-semibold">Você ainda não tem uma licença</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Escolha um plano para receber seu token e liberar a extensão.
              </p>
              <Button asChild variant="neon" className="mt-6">
                <Link to="/planos">Ver planos</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">

            
            <section className="glass rounded-2xl p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Sua licença</h2>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusStyle(license.status)}`}
                >
                  {license.status}
                </span>
              </div>

              <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  Token de ativação
                </p>
                <p className="mt-2 break-all font-mono text-lg text-primary">
                  {token ?? license.token_preview ?? "MSK-••••-••••-••••-••••"}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="neonOutline" onClick={reveal} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Eye />} Revelar
                  </Button>
                  <Button size="sm" variant="neon" onClick={copy} disabled={!token}>
                    <Copy /> Copiar
                  </Button>
                </div>
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  ["Plano", plan?.name ?? "—"],
                  ["Expira em", license.expires_at ? fmt(license.expires_at) : "Vitalício"],
                  ["Ativada em", fmt(license.activated_at)],
                  ["Última validação", fmt(license.last_validation)],
                  ["Dispositivos permitidos", String(license.max_devices)],
                  ["Dispositivos ativos", String(data?.devices.length ?? 0)],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="mt-1 text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="glass rounded-2xl p-7">
              <h2 className="text-lg font-semibold">Plano Atual</h2>
              {data?.subscription ? (
                <>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Status:{" "}
                    <span className="text-foreground">{(data.subscription as any).status}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expira em {fmt((data.subscription as any).current_period_end)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Você possui uma licença de compra única ativa.
                </p>
              )}
              <Button asChild variant="neonOutline" size="sm" className="mt-5 w-full">
                <Link to="/planos">Comprar Licença</Link>
              </Button>
            </section>

            <section className="glass rounded-2xl p-7 sm:hidden">
               <h2 className="text-lg font-semibold mb-4 text-center">Progresso da Conta</h2>
               <div className="w-full bg-white/5 rounded-full h-4 border border-white/10 overflow-hidden relative">
                  <div className="bg-primary h-full w-[75%] transition-all duration-1000" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black uppercase text-white drop-shadow-md">75% Concluído</span>
                  </div>
               </div>
            </section>

            <ExtensionDownloadCard />

            <section className="glass rounded-2xl p-7 lg:col-span-2">
              <h2 className="text-lg font-semibold">Dispositivos conectados</h2>
              {data?.devices.length ? (
                <ul className="mt-4 divide-y divide-border/60">
                  {data.devices.map((d: any) => (
                    <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-3">
                        <Laptop className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{d.device_name ?? "Dispositivo"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[d.browser, d.os, d.extension_version].filter(Boolean).join(" · ")} ·
                            visto em {fmt(d.last_seen)}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeDevice(d.id)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nenhum dispositivo ativo. Cole seu token na extensão para ativar.
                </p>
              )}
            </section>

            <section className="glass rounded-2xl p-7 lg:col-span-2">
              <h2 className="text-lg font-semibold">Histórico</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {(data?.events ?? []).map((e: any) => (
                  <li key={e.id} className="flex justify-between gap-4 text-muted-foreground">
                    <span className="font-mono text-xs text-primary">{e.event_type}</span>
                    <span className="text-xs">{fmt(e.created_at)}</span>
                  </li>
                ))}
                {!data?.events?.length && (
                  <li className="text-sm text-muted-foreground">Sem eventos ainda.</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {!isLoading && (
          <div className="mt-6 grid gap-6">
            <TokenManager />
          </div>
        )}
      </main>
    </div>
  );
}