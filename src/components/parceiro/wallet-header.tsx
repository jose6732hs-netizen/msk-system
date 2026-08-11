import React, { useState, useEffect } from "react";
import { Eye, EyeOff, RefreshCw, Trophy, Menu, X, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useRouterState } from "@tanstack/react-router";
import { affiliateRoutes } from "@/lib/parceiro/routes";

interface AffiliateHeaderProps {
  balance: number;
  goalCurrent: number;
  goalTarget: number;
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
  isRefreshing
}: AffiliateHeaderProps) {
  const [showBalance, setShowBalance] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={cn(
        "sticky top-0 z-[50] w-full transition-all duration-300 border-b",
        scrolled 
          ? "bg-[#0A0A0A]/80 backdrop-blur-xl border-white/10 py-2 shadow-2xl" 
          : "bg-transparent border-transparent py-4"
      )}
    >
      <div className="container max-w-7xl mx-auto px-4 flex items-center justify-between gap-2 md:gap-4">
        {/* Lado Esquerdo: Saldo */}
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-medium text-white/40 uppercase tracking-widest">Saldo Disponível</span>
          <div className="flex items-center gap-3">
            <h2 className={cn(
              "text-lg sm:text-2xl font-bold tracking-tighter transition-all duration-500 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent truncate max-w-[120px] sm:max-w-none",
              !showBalance && "blur-md select-none"
            )}>
              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h2>
            <button 
              onClick={() => setShowBalance(!showBalance)}
              className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
            >
              {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button 
              onClick={onRefresh}
              className={cn(
                "p-1.5 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white",
                isRefreshing && "animate-spin text-primary"
              )}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Centro: Meta de Vendas (sempre visível) */}
        <div className="flex min-w-0 flex-1 flex-col items-end md:items-center md:max-w-sm">
          <div className="mb-1 flex w-full items-center justify-end gap-1.5 md:justify-between">
            <span className="hidden text-[10px] font-bold uppercase tracking-widest text-emerald-400 md:flex md:items-center md:gap-1">
              <Trophy size={10} /> Meta de Vendas
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
              <Trophy size={10} /> {goalProgress}%
            </span>
          </div>
          <div className="relative h-6 w-full max-w-[220px] overflow-hidden rounded-full border border-white/10 bg-white/5 md:max-w-none">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_14px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, Math.max(2, goalProgress))}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center truncate px-2 text-[10px] font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[11px]">
              R$ {goalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {goalTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>


        {/* Lado Direito: Actions/Menu */}
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
           <Button 
             asChild
             variant="ghost" 
             size="sm" 
             className="h-9 px-3 hidden md:flex text-white/40 hover:text-primary hover:bg-primary/10 gap-2 font-bold"
           >
             <Link to="/premiacoes">
               <Award size={16} /> Premiações
             </Link>
           </Button>

           <Button 
             variant="neon" 
             size="sm" 
             className="h-9 px-5 hidden sm:flex"
             onClick={() => (window as any).openWalletModal?.()}
           >
             Minha Carteira
           </Button>
           
           <Sheet>
             <SheetTrigger asChild>
               <Button variant="ghost" size="icon" className="md:hidden text-white/60">
                 <Menu />
               </Button>
             </SheetTrigger>
              <SheetContent side="bottom" className="h-[100dvh] max-h-screen border-none bg-background/95 p-0 backdrop-blur-3xl focus:outline-none">
                <div className="flex h-full flex-col overflow-y-auto pb-10">
                  <div className="flex items-center justify-between px-6 pt-6 mb-4">
                    <span className="text-lg font-black uppercase tracking-widest text-primary">Afiliados</span>
                    <button 
                      onClick={() => document.body.click()}
                      className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 border border-white/10 text-white"
                    >
                      <Menu className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-white/15 shrink-0" />
                  <nav className="flex flex-col gap-2 px-6">
                    <Link to="/parceiro" className="flex items-center gap-4 rounded-2xl bg-white/5 p-5 text-lg font-bold transition-colors active:bg-white/10" onClick={() => document.body.click()}>
                      Visão Geral
                    </Link>
                    <Link to="/premiacoes" className="flex items-center gap-4 rounded-2xl bg-white/5 p-5 text-lg font-bold transition-colors active:bg-white/10" onClick={() => document.body.click()}>
                      Premiações
                    </Link>
                    <div className="mt-4 space-y-1">
                      <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Em breve</p>
                      <div className="block border-b border-white/5 p-4 text-sm font-bold text-white/40">Financeiro</div>
                      <div className="block border-b border-white/5 p-4 text-sm font-bold text-white/40">Links de Divulgação</div>
                      <div className="block border-b border-white/5 p-4 text-sm font-bold text-white/40">Configurações</div>
                    </div>
                    <div className="mt-6">
                      <Button variant="neon" className="h-16 w-full rounded-2xl font-black text-lg" onClick={() => { (window as any).openWalletModal?.(); document.body.click(); }}>
                         Carteira Digital
                      </Button>
                    </div>
                  </nav>
                </div>
             </SheetContent>
           </Sheet>
        </div>
      </div>
    </header>
  );
}
