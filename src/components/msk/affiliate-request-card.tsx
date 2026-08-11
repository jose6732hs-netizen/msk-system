import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Users, 
  Send, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  PartyPopper,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { affiliateOverview, enrollAsAffiliate } from "@/lib/affiliate.functions";
import confetti from "canvas-confetti";

export function AffiliateRequestCard() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(affiliateOverview);
  const enroll = useServerFn(enrollAsAffiliate);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["affiliate-overview"],
    queryFn: () => fetchOverview({ data: {} }),
  });

  const handleEnroll = async () => {
    setLoading(true);
    try {
      await enroll();
      await qc.invalidateQueries({ queryKey: ["affiliate-overview"] });
      
      // Confetti on success
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00F2FF', '#0066FF', '#FFFFFF']
      });
      
      toast.success("Solicitação enviada com sucesso!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return null;

  // Se já é afiliado e está aprovado, não mostra o card de solicitação
  if (data?.enrolled && (data.affiliate as any).status === "active") {
    return null;
  }

  // Se está pendente
  if (data?.enrolled && (data.affiliate as any).status === "pending") {
    return (
      <div className="glass rounded-[2rem] p-8 border-yellow-500/20 bg-yellow-500/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20">
            <Clock className="text-yellow-500 w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black uppercase tracking-tighter text-white">Solicitação em Análise</h3>
            <p className="text-white/40 text-sm max-w-sm">
              Sua solicitação de afiliação está sendo revisada por nossa equipe. 
              Você receberá uma notificação assim que for aprovado.
            </p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-yellow-500/60">
              <span>Status: Pendente</span>
              <span>50%</span>
            </div>
            <Progress value={50} className="h-1.5 bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  // Card para novos interessados
  return (
    <div className="glass rounded-[2rem] p-8 border-primary/20 bg-primary/5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
      
      <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            <PartyPopper size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Programa de Parceiros</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">
            QUER LUCRAR COM <span className="text-primary">A MSK SISTEM?</span>
          </h2>
          <p className="text-white/40 text-sm md:text-base max-w-xl">
            Torne-se um parceiro oficial e receba comissões automáticas por cada indicação. 
            Acesso a painel exclusivo, materiais de marketing e saques instantâneos via PIX.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white/60">
              <ShieldCheck size={16} className="text-primary" /> Aprovação Rápida
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-white/60">
              <TrendingUp size={16} className="text-primary" /> Comissões Altas
            </div>
          </div>
        </div>

        <div className="shrink-0 w-full md:w-auto">
          <Button 
            variant="neon" 
            className="w-full md:w-64 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 group/btn overflow-hidden relative"
            onClick={handleEnroll}
            disabled={loading}
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <span className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                  ME AFILIAR AGORA <Send size={18} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                </span>
                <span className="text-[10px] font-bold opacity-70">ENVIAR SOLICITAÇÃO</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TrendingUp({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function Loader2({ size, className }: { size: number, className?: string }) {
  return <Clock className={cn("animate-spin", className)} size={size} />;
}
