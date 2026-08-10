import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTracking } from "@/hooks/use-tracking";
import { NightSky } from "@/components/msk/night-sky";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MSK SISTEM — Sua Plataforma de Licenciamento" },
      {
        name: "description",
        content:
          "Plataforma oficial de assinaturas e licenciamento da extensão Chrome MSK SISTEM.",
      },
      { name: "author", content: "MSK SISTEM" },
      { property: "og:title", content: "MSK SISTEM" },
      {
        property: "og:description",
        content: "Assinaturas, licenças e dispositivos da extensão MSK SISTEM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useTracking(); // Traqueamento profissional de PageViews em todas as rotas
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Recupera automaticamente de chunks antigos em cache após um novo deploy.
  useEffect(() => {
    const isStaleChunk = (msg?: string) =>
      !!msg &&
      (msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("error loading dynamically imported module") ||
        msg.includes("Importing a module script failed"));

    const recover = () => {
      const key = "msk_chunk_reload";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (isStaleChunk(e.message)) recover();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleChunk((e.reason as Error | undefined)?.message)) recover();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // Login/cadastro: céu mais vivo. Painéis/dashboards: bem discreto.
  const isAuth = pathname.startsWith("/auth");
  const isBoard =
    pathname.startsWith("/painel") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/parceiro") ||
    pathname.startsWith("/revendedor");

  return (
    <QueryClientProvider client={queryClient}>
      <NightSky
        intensity={isAuth ? 1 : isBoard ? 0.4 : 0.7}
        starCount={isAuth ? 300 : isBoard ? 140 : 220}
        meteorInterval={isAuth ? 1.6 : isBoard ? 9 : 4.5}
        birdInterval={isAuth ? 9 : 22}
      />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <PwaInstallBanner />
      <Outlet />
      <MobileNavigation />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

import { Home, CreditCard, LayoutDashboard, Share2, Menu, X, Download, ShieldCheck, ShoppingCart, ChevronRight, Bell } from "lucide-react";
import { PwaInstallBanner } from "@/components/msk/pwa-install-banner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getExtensionDownload } from "@/lib/extension.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

function MobileNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (data.session) {
        supabase.from("user_roles").select("role").eq("user_id", data.session.user.id).in("role", ["admin", "super_admin"]).then(({ data: roles }) => {
          setIsAdmin(!!roles?.length);
        });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      if (session) {
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).in("role", ["admin", "super_admin"]).then(({ data: roles }) => {
          setIsAdmin(!!roles?.length);
        });
      } else {
        setIsAdmin(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function downloadExtension() {
    // A opção de baixar a extensão agora é livre (não precisa de login)
    setDownloading(true);
    setProgress(0);
    try {
      // Simulação de progresso para UX profissional
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 100);

      const res = await getExtensionDownload({ data: {} });
      
      // Espera o progresso chegar a 100 antes de iniciar o download real
      while (progress < 100) {
        await new Promise(r => setTimeout(r, 50));
      }

      const a = window.document.createElement("a");
      a.href = res.url;
      a.download = res.fileName;
      a.rel = "noopener";
      a.click();
      toast.success(`${res.channelName} v${res.version}: download iniciado.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTimeout(() => {
        setDownloading(false);
        setProgress(0);
      }, 500);
    }
  }

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/planos", icon: CreditCard, label: "Planos" },
    { to: "/painel", icon: LayoutDashboard, label: "Painel" },
    { to: "/parceiros", icon: Share2, label: "Afiliados" },
  ];

  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-[100] w-full max-w-full"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Fade para o conteúdo não colar na barra */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-background to-transparent" />

      <nav className="grid w-full grid-cols-5 items-stretch gap-0 border-t border-white/10 bg-background/90 px-1 py-1.5 backdrop-blur-2xl">
        {navItems.map((item) => {
          const active =
            pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-center transition-colors duration-200 ${
                active ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <item.icon
                className={`h-5 w-5 shrink-0 ${
                  active ? "drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" : ""
                }`}
              />
              <span className="w-full truncate text-[9px] font-black uppercase leading-none tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-center text-muted-foreground transition-colors active:text-foreground"
            >
              <Menu className="h-5 w-5 shrink-0" />
              <span className="w-full truncate text-[9px] font-black uppercase leading-none tracking-tight">
                Menu
              </span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[80vh] overflow-y-auto rounded-t-[2.5rem] border-white/10 bg-background/95 backdrop-blur-3xl"
          >
            <div className="mx-auto mb-6 mt-2 h-1 w-12 rounded-full bg-white/15" />
            <nav className="flex flex-col gap-2 px-4 pb-10">
              <div className="mb-6 grid grid-cols-2 gap-3">
                <Button
                  variant="neon"
                  className="relative flex h-16 flex-col items-center justify-center gap-1 rounded-2xl overflow-hidden"
                  onClick={downloadExtension}
                  disabled={downloading}
                >
                  {downloading ? (
                    <>
                      <div className="absolute inset-0 bg-primary/20" />
                      <div 
                        className="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                      />
                      <span className="relative z-10 text-[10px] font-black">{progress}%</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase">Extensão Grátis</span>
                    </>
                  )}
                </Button>
                {isAdmin && (
                  <Button
                    asChild
                    variant="neonOutline"
                    className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl"
                  >
                    <Link to="/documentacao" onClick={() => setOpen(false)}>
                      <ShoppingCart className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase">Docs</span>
                    </Link>
                  </Button>
                )}
              </div>

              {signedIn && isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors active:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-400" />
                    <span className="truncate text-xs font-black uppercase tracking-wider">
                      Painel Admin
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )}

              <div className="mt-6 space-y-1">
                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Mais
                </p>
                <Link
                  to="/planos"
                  className="block border-b border-white/5 p-4 text-sm font-bold"
                  onClick={() => setOpen(false)}
                >
                  Planos e Preços
                </Link>
                <Link
                  to="/parceiros"
                  search={{}}
                  className="block border-b border-white/5 p-4 text-sm font-bold"
                  onClick={() => setOpen(false)}
                >
                  Programa de Afiliados
                </Link>
                {signedIn && (
                  <Link
                    to="/painel/premiacoes"
                    className="block border-b border-white/5 p-4 text-sm font-bold"
                    onClick={() => setOpen(false)}
                  >
                    Central de Premiações
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/api-docs"
                    className="block border-b border-white/5 p-4 text-sm font-bold"
                    onClick={() => setOpen(false)}
                  >
                    API de Licenciamento
                  </Link>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}

