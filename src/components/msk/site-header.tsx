import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAgentAccess } from "@/lib/agent-access.functions";
import { getAgentExtensionDownload } from "@/lib/agent-download.functions";
import { Download, LayoutDashboard, Loader2, Menu, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CartSheet } from "./cart-sheet";
import { NotificationBell } from "./notification-bell";
import { MskLogo } from "./logo";

const NAV = [
  { to: "/planos", label: "Planos" },
  { to: "/clonagem", label: "Clonador" },
  { to: "/documentacao", label: "Documentação" },
  { to: "/como-funciona", label: "Como Funciona" },
  { to: "/parceiro", label: "Afiliados" },
] as const;

export function SiteHeader({ mobileMenuOnly = false }: { mobileMenuOnly?: boolean }) {
  const navigate = useNavigate();
  const loadAgentAccess = useServerFn(getAgentAccess);
  const prepareAgentDownload = useServerFn(getAgentExtensionDownload);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  /** Topo e painel usam a mesma fonte: o build oficial publicado no canal `msk-agente`. */
  async function downloadExtension() {
    if (downloading) return;

    if (!signedIn) {
      toast.info("Entre na sua conta para baixar o MSK Agente.");
      navigate({ to: "/auth" });
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);
    let interval: ReturnType<typeof setInterval> | null = null;

    try {
      const access = await loadAgentAccess({});
      const licenseId = access?.license?.id;

      if (access?.status !== "active" || !licenseId) {
        toast.info("Você precisa de uma licença ativa do MSK Agente para baixar a extensão.");
        navigate({ to: "/planos", hash: "msk-agente" });
        return;
      }

      const downloadTask = prepareAgentDownload({ data: { licenseId } });
      let currentProgress = 0;
      interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 10) + 5;
        setDownloadProgress(Math.min(currentProgress, 95));
      }, 200);

      const res = await downloadTask;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      setDownloadProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 250));

      const a = window.document.createElement("a");
      a.href = res.url;
      a.download = res.fileName;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`MSK Agente v${res.version}: download iniciado.`);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível baixar o MSK Agente agora.");
    } finally {
      if (interval) clearInterval(interval);
      setDownloading(false);
      setDownloadProgress(0);
    }
  }

  useEffect(() => {
    let alive = true;
    async function syncRole(userId: string | null) {
      if (!userId) {
        if (alive) setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "super_admin"]);
      if (alive) setIsAdmin(!!data?.length);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      void syncRole(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      void syncRole(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const downloadLabel = downloading ? `${downloadProgress}%` : "Baixar MSK Agente";

  if (mobileMenuOnly) {
    return (
      <div className="flex items-center">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Menu" className="relative h-10 w-10 p-0 border border-white/10 rounded-xl hover:bg-white/5">
              <Menu className="h-6 w-6 text-primary" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:w-64 z-[200] bg-background/98 backdrop-blur-xl border-none p-0 focus:outline-none h-[100dvh]">
            <nav className="mt-8 flex flex-col gap-4 text-sm px-6">
              <div className="flex items-center justify-between mb-8">
                <MskLogo size={32} />
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 border border-white/10 rounded-xl">
                    <X className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
              </div>

              <div className="flex flex-col gap-2 mb-4 border-b border-border/50 pb-4">
                {signedIn ? (
                  <Link
                    to="/painel"
                    className="flex items-center gap-2 font-bold text-primary p-2"
                    onClick={() => document.body.click()}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Meu Painel
                  </Link>
                ) : (
                  <Link
                    to="/auth"
                    className="flex items-center gap-2 font-bold text-primary p-2"
                    onClick={() => document.body.click()}
                  >
                    Entrar / Cadastrar
                  </Link>
                )}
              </div>

              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="hover:text-primary p-2 text-base font-medium border-b border-white/5"
                  onClick={() => document.body.click()}
                >
                  {item.label}
                </Link>
              ))}

              <Button
                variant="neon"
                className="mt-4 w-full h-12 rounded-xl"
                disabled={downloading}
                onClick={() => {
                  void downloadExtension();
                  document.body.click();
                }}
              >
                {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {downloadLabel}
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <header className="msk-site-header z-[50] w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-3 sm:px-5 md:px-6">
        <Link to="/">
          <MskLogo size={36} />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className="transition-colors hover:text-primary">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="neonOutline"
            size="sm"
            className="hidden sm:inline-flex min-w-[160px] relative overflow-hidden"
            onClick={() => void downloadExtension()}
            disabled={downloading}
          >
            {downloading && (
              <div
                className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            )}
            <span className="relative z-10 flex items-center">
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {downloadLabel}
            </span>
          </Button>
          {signedIn && <NotificationBell />}
          <CartSheet signedIn={signedIn} />
          {signedIn ? (
            <Button asChild variant="neon" size="sm" className="hidden lg:flex">
              <Link to="/painel">Painel</Link>
            </Button>
          ) : (
            <div className="hidden lg:flex items-center gap-1.5 sm:gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button asChild variant="neon" size="sm">
                <Link to="/planos">Começar agora</Link>
              </Button>
            </div>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden h-10 w-10 p-0 border border-white/10 rounded-xl hover:bg-white/5" aria-label="Menu">
                <Menu className="h-6 w-6 text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:w-64 z-[200] bg-background/98 backdrop-blur-xl border-none p-0 focus:outline-none h-[100dvh]">
              <nav className="mt-8 flex flex-col gap-4 text-sm px-6">
                <div className="flex items-center justify-between mb-8">
                  <MskLogo size={32} />
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 border border-white/10 rounded-xl">
                      <X className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                </div>

                <div className="flex flex-col gap-2 mb-4 border-b border-border/50 pb-4">
                  {signedIn ? (
                    <>
                      <Link
                        to="/painel"
                        className="flex items-center gap-2 font-bold text-primary p-2"
                        onClick={() => document.body.click()}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Meu Painel
                      </Link>
                      {isAdmin ? (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 font-bold text-cyan-400 p-2"
                          onClick={() => document.body.click()}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Admin
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <Link
                      to="/auth"
                      className="flex items-center gap-2 font-bold text-primary p-2"
                      onClick={() => document.body.click()}
                    >
                      Entrar / Cadastrar
                    </Link>
                  )}
                </div>

                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="hover:text-primary p-2 text-base font-medium border-b border-white/5"
                    onClick={() => document.body.click()}
                  >
                    {item.label}
                  </Link>
                ))}

                <Button
                  variant="neon"
                  className="mt-4 w-full h-12 rounded-xl"
                  disabled={downloading}
                  onClick={() => {
                    void downloadExtension();
                    document.body.click();
                  }}
                >
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {downloadLabel}
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
