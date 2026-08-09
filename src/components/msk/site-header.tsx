import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getExtensionDownload } from "@/lib/extension.functions";
import { Download, LayoutDashboard, Loader2, Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CartSheet } from "./cart-sheet";
import { NotificationBell } from "./notification-bell";
import { MskLogo } from "./logo";

const NAV = [
  { to: "/planos", label: "Planos" },
  { to: "/documentacao", label: "Documentação" },
  { to: "/parceiros", label: "Afiliados" },
] as const;

export function SiteHeader() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [downloading, setDownloading] = useState(false);

  /** O pacote baixado é sempre o canal que o admin deixou ativo — nunca um zip fixo. */
  async function downloadExtension() {
    if (!signedIn) {
      void navigate({ to: "/auth" });
      return;
    }
    setDownloading(true);
    try {
      const res = await getExtensionDownload({ data: {} });
      const a = window.document.createElement("a");
      a.href = res.url;
      a.download = res.fileName;
      a.rel = "noopener";
      a.click();
      toast.success(`${res.channelName} v${res.version}: download iniciado.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl lg:block hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
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
            className="hidden sm:inline-flex"
            onClick={downloadExtension}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Baixar Extensão
          </Button>
          {signedIn && <NotificationBell />}
          <CartSheet signedIn={signedIn} />
          {signedIn ? (
            <Button asChild variant="neon" size="sm">
              <Link to="/painel">Painel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button asChild variant="neon" size="sm">
                <Link to="/planos">Começar agora</Link>
              </Button>
            </>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Menu">
                <Menu className="h-5 w-5 text-neon" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-64">
              <nav className="mt-8 flex flex-col gap-4 text-sm">
                <div className="flex flex-col gap-2 mb-4 border-b border-border/50 pb-4">
                  {signedIn && (
                    <>
                      <Link 
                        to="/painel" 
                        className="flex items-center gap-2 font-bold text-primary"
                        onClick={() => document.body.click()}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Meu Painel
                      </Link>
                      <Link 
                        to="/admin" 
                        className="flex items-center gap-2 font-bold text-cyan-400"
                        onClick={() => document.body.click()}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Admin
                      </Link>
                    </>
                  )}
                </div>
                {NAV.map((item) => (
                  <Link 
                    key={item.to} 
                    to={item.to} 
                    className="hover:text-primary"
                    onClick={() => document.body.click()}
                  >
                    {item.label}
                  </Link>
                ))}
                <button 
                  type="button" 
                  onClick={() => {
                    downloadExtension();
                    document.body.click();
                  }} 
                  className="text-left text-primary"
                >
                  Baixar Extensão
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}