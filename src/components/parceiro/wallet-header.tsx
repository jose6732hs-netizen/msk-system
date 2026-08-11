import React, { useState, useEffect } from "react";
import { Eye, EyeOff, RefreshCw, Trophy, Menu, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@tanstack/react-router";

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
        "sticky top-0 z-[100] w-full transition-all duration-300 border-b",
        scrolled 
          ? "bg-[#0A0A0A]/80 backdrop-blur-xl border-white/10 py-2 shadow-2xl" 
          : "bg-transparent border-transparent py-4"
      )}
    >
      <div className="container max-w-7xl mx-auto px-4 flex items-center justify-between gap-2 md:gap-4">
        {/* Lado Esquerdo: Saldo */}
        <div className="flex flex-col">
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
        <div className="flex items-center gap-2 md:gap-3">
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
             <SheetContent side="right" className="bg-[#0A0A0A] border-white/10 text-white">
                 <nav className="flex flex-col gap-6 mt-12">
                    <Link to="/parceiro" className="text-xl font-bold hover:text-primary transition-colors">Visão Geral</Link>
                    <Link to="/premiacoes" className="text-xl font-bold hover:text-primary transition-colors">Premiações</Link>
                    <Link to="/parceiro" className="text-xl font-bold hover:text-primary transition-colors text-white/40">Financeiro</Link>
                    <Link to="/parceiro" className="text-xl font-bold hover:text-primary transition-colors text-white/40">Links de Divulgação</Link>
                    <Link to="/parceiro" className="text-xl font-bold hover:text-primary transition-colors text-white/40">Configurações</Link>
                   <div className="h-px bg-white/10 my-4" />
                   <Button variant="neon" className="w-full" onClick={() => (window as any).openWalletModal?.()}>
                      Carteira Digital
                   </Button>
                </nav>
             </SheetContent>
           </Sheet>
        </div>
      </div>
    </header>
  );
}
