import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent } from "@/lib/cms.functions";
import { normalizeTutorials } from "@/lib/tutorials";
import { TutorialPlayer } from "@/components/msk/tutorial-player";
import { useState, useEffect } from "react";
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
import { useSupportLink } from "@/lib/support-link";
import { MskLogo } from "@/components/msk/logo";
import { getAccount, getMyToken, removeMyDevice, cancelMySubscription } from "@/lib/account.functions";
import { generateToken } from "@/lib/tokens.functions";
import { ExtensionDownloadCard } from "@/components/msk/extension-download";
import { TokenManager } from "@/components/msk/token-manager";
import { PanelCarousel } from "@/components/msk/panel-carousel";
import { NotificationSettings } from "@/components/msk/notification-settings";
import { LicenseCard } from "@/components/msk/license-card";
import { AffiliateRequestCard } from "@/components/msk/affiliate-request-card";

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
  const supportLink = useSupportLink("Olá! Preciso de suporte com minha licença MSK.");
  const qc = useQueryClient();
  const fetchAccount = useServerFn(getAccount);
  const revealFn = useServerFn(getMyToken);
  const removeFn = useServerFn(removeMyDevice);
  const cancelFn = useServerFn(cancelMySubscription);
  const generateLicenseFn = useServerFn(generateToken);
  const [generatingLicense, setGeneratingLicense] = useState(false);

  async function handleGenerateNewLicense() {
    setGeneratingLicense(true);
    try {
      await generateLicenseFn();
      await qc.invalidateQueries();
      toast.success("Nova licença gerada! O tempo começa quando você ativar na extensão.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível gerar uma nova licença.");
    } finally {
      setGeneratingLicense(false);
    }
  }
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    const hid = localStorage.getItem("msk_highlight_license");
    if (hid) {
      setHighlightedId(hid);
      // Limpar após alguns segundos para não ficar destacado para sempre
      setTimeout(() => {
        localStorage.removeItem("msk_highlight_license");
        setHighlightedId(null);
      }, 10000);
    }
  }, []);

  const getCms = useServerFn(getCmsContent);

  const { data: cms } = useSuspenseQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
  });

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
    <div className="min-h-screen bg-[#050505]">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5">
          <Link to="/" className="min-w-0">
            <MskLogo size={34} />
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <Button asChild variant="ghost" size="sm">
              <Link to="/premiacoes">Premiações</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/documentacao">Documentação</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/planos" preload="intent">Planos</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/parceiro" search={{}} preload="intent">Afiliados</Link>
            </Button>
            {supportLink && (
              <Button asChild variant="ghost" size="sm">
                <a href={supportLink} target="_blank" rel="noopener noreferrer">Suporte</a>
              </Button>
            )}

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
            <Link to="/parceiro" search={{}} preload="intent" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground">
              Afiliados
            </Link>
            <Link to="/premiacoes" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground">
              Premiações
            </Link>
            <Link to="/documentacao" onClick={() => setMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground">
              Documentação
            </Link>
            {supportLink && (
              <a
                href={supportLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-bold text-[#25D366] hover:bg-[#25D366]/10"
              >
                Suporte
              </a>
            )}
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


      <main className="mx-auto max-w-6xl px-4 sm:px-5 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-10">
        <div className="mb-8">
          <PanelCarousel />
        </div>

        {/* Tutoriais Aba no Painel */}
        <section className="mb-8 space-y-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tighter">Tutoriais e Explicações</h2>
          </div>

          {normalizeTutorials(cms?.['tutorials']).length === 0 ? (
            <div className="glass rounded-2xl border border-white/5 p-8 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-white/30">Nenhum tutorial postado ainda</p>
            </div>
          ) : (
            normalizeTutorials(cms?.['tutorials']).map((section, si) => (
              <div key={si} className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase tracking-tighter sm:text-2xl">{section.title || `Etapa ${si + 1}`}</h3>
                  {section.description && <p className="max-w-3xl text-xs text-white/50 sm:text-sm">{section.description}</p>}
                  <div className="h-1 w-12 rounded-full bg-primary" />
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {section.videos.map((video, i) => (
                    <div key={i} className="glass overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
                      <div className="aspect-video bg-black/40">
                        <TutorialPlayer video={video} />
                      </div>
                      <div className="p-4">
                        <h4 className="mb-1 line-clamp-1 text-sm font-bold uppercase tracking-tighter">{video.title}</h4>
                        <p className="line-clamp-2 text-[10px] text-white/50">{video.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>


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

        <AgentPanel />



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
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

            
            <div className="md:col-span-2 lg:col-span-1">
              <LicenseCard 
                license={license} 
                token={token}
                busy={busy}
                onReveal={reveal}
                onCopyToken={() => {
                  navigator.clipboard.writeText(token ?? license.token_preview ?? "");
                  toast.success("Token copiado com sucesso!");
                }}
                onGenerateNew={handleGenerateNewLicense}
                generating={generatingLicense}
                highlighted={highlightedId === license.id}
              />
            </div>

            <section className="glass rounded-[2rem] p-6 md:p-8">
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

            <section className="glass rounded-[2rem] p-6 md:p-8 sm:hidden">
               <h2 className="text-lg font-semibold mb-4 text-center">Progresso da Conta</h2>
               <div className="w-full bg-white/5 rounded-full h-4 border border-white/10 overflow-hidden relative">
                  <div className="bg-primary h-full w-[75%] transition-all duration-1000" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black uppercase text-white drop-shadow-md">75% Concluído</span>
                  </div>
               </div>
            </section>

            <AffiliateRequestCard />
            <ExtensionDownloadCard />

            <section className="glass rounded-[2rem] p-6 md:p-8 md:col-span-2 lg:col-span-3">
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

            <section className="glass rounded-[2rem] p-6 md:p-8 md:col-span-2 lg:col-span-3">
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

            <section className="glass rounded-[2rem] p-6 md:p-8 md:col-span-2 lg:col-span-3">
              <h3 className="text-sm font-black uppercase tracking-widest">Notificações</h3>
              <p className="mb-5 text-xs text-muted-foreground">
                Escolha o que você quer receber — inclusive fora do app.
              </p>
              <NotificationSettings scope="user" />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}