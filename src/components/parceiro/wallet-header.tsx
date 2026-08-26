import React, { useEffect, useState } from "react";
import { Award, Eye, EyeOff, Menu, RefreshCw, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useRouterState } from "@tanstack/react-router";
import { affiliateRoutes } from "@/lib/parceiro/routes";
import { useSupportLink } from "@/lib/support-link";

interface AffiliateHeaderProps {
  balance: number;
  goalCurrent: number;
  goalTarget: number | undefined;
  goalProgress: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function AffiliateHeader({
  balance,
  goalCurrent,
  goalTarget,
  goalProgress,
  onRefresh,
  isRefreshing,
}: AffiliateHeaderProps) {
  const [showBalance, setShowBalance] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const supportLink = useSupportLink("Olá! Sou parceiro MSK e preciso de suporte.");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const target = goalTarget ?? 1000;
  const targetLabel =
    target >= 1_000_000
      ? `${(target / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}M`
      : target >= 1_000
        ? `${(target / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}k`
        : target.toLocaleString("pt-BR");

  return (
    <header
      className={cn(
        "sticky top-0 z-[50] w-full border-b transition-all duration-300",
        scrolled
          ? "border-white/10 bg-[#0A0A0A]/95 py-2 shadow-2xl backdrop-blur-xl"
          : "border-white/5 bg-[#050505] py-3 sm:py-4",
      )}
    >
      <div className="container mx-auto grid max-w-7xl min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,360px)_auto] md:items-center md:gap-4">
        <div className="min-w-0">
          <span className="block truncate text-[9px] font-medium uppercase tracking-[.16em] text-white/40 sm:text-xs sm:tracking-widest">
            Saldo Disponível
          </span>
          <div className="mt-0.5 flex min-w-0 items-center gap-1 sm:gap-2">
            <h2
              className={cn(
                "min-w-0 max-w-[150px] truncate bg-gradient-to-r from-white to-white/60 bg-clip-text text-lg font-bold tracking-tighter text-transparent transition-all duration-500 sm:max-w-none sm:text-2xl",
                !showBalance && "select-none blur-md",
              )}
            >
              R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </h2>
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white"
              aria-label={showBalance ? "Ocultar saldo" : "Mostrar saldo"}
            >
              {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/40 transition-all hover:bg-white/5 hover:text-white",
                isRefreshing && "animate-spin text-primary",
              )}
              aria-label="Atualizar dados"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:order-3 md:gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-10 gap-2 px-3 font-bold text-white/40 hover:bg-primary/10 hover:text-primary md:flex"
          >
            <Link to="/premiacoes">
              <Award size={16} /> Premiações
            </Link>
          </Button>

          <Button
            variant="neon"
            size="sm"
            className="hidden h-10 px-5 sm:flex"
            onClick={() => (window as any).openWalletModal?.()}
          >
            Minha Carteira
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-white/60 md:hidden"
                aria-label="Abrir menu"
                aria-expanded={open}
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="z-[150] h-[100dvh] max-h-[100dvh] border-none bg-background/98 p-0 backdrop-blur-3xl focus:outline-none [&>button]:hidden"
            >
              <div className="flex h-full flex-col overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                <div className="mb-4 flex items-center justify-between gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-6 sm:pt-6">
                  <span className="min-w-0 break-words text-base font-black uppercase tracking-widest text-primary sm:text-lg">
                    MSK AFILIADOS
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white sm:h-12 sm:w-12"
                    aria-label="Fechar menu"
                  >
                    <X className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                </div>
                <div className="mx-auto mb-5 h-1 w-12 shrink-0 rounded-full bg-white/15" />
                <nav className="flex flex-col gap-2 px-4 sm:px-6">
                  {affiliateRoutes.map((route) =>
                    route.action ? (
                      <button
                        key={route.label}
                        type="button"
                        onClick={() => {
                          if (route.action === "support") {
                            if (supportLink) window.open(supportLink, "_blank", "noopener");
                          } else {
                            (window as any).openWalletModal?.();
                          }
                          setOpen(false);
                        }}
                        className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl bg-white/5 p-4 text-left text-base font-bold transition-colors active:bg-white/10 sm:gap-4 sm:p-5 sm:text-lg"
                      >
                        <route.icon size={20} className="shrink-0 text-primary" />
                        <span className="min-w-0 break-words">{route.label}</span>
                      </button>
                    ) : (
                      <Link
                        key={route.label}
                        to={route.to}
                        {...(route.hash ? { hash: route.hash } : {})}
                        className={cn(
                          "flex min-h-14 min-w-0 items-center gap-3 rounded-2xl bg-white/5 p-4 text-base font-bold transition-colors active:bg-white/10 sm:gap-4 sm:p-5 sm:text-lg",
                          pathname === route.to && "border border-primary/20 bg-primary/5 text-primary",
                        )}
                        onClick={() => setOpen(false)}
                      >
                        <route.icon
                          size={20}
                          className={cn("shrink-0", pathname === route.to ? "text-primary" : "text-white/40")}
                        />
                        <span className="min-w-0 break-words">{route.label}</span>
                      </Link>
                    ),
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="col-span-2 min-w-0 md:order-2 md:col-span-1">
          <div className="mb-1 flex w-full min-w-0 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 truncate text-[9px] font-bold uppercase tracking-[.14em] text-emerald-400 sm:text-[10px] sm:tracking-widest">
              <Trophy size={10} className="shrink-0" /> Meta de Vendas
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-yellow-400 sm:text-[10px]">
              <Trophy size={10} /> {goalProgress}%
            </span>
          </div>
          <div className="relative h-6 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_14px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, Math.max(2, goalProgress))}%` }}
            />
            <span className="absolute inset-0 flex min-w-0 items-center justify-center truncate px-2 text-[9px] font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[11px]">
              {goalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / {targetLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
