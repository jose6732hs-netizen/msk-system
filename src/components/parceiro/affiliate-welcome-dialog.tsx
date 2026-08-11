import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Trophy, 
  CheckCircle2, 
  ArrowRight, 
  Star, 
  Rocket, 
  PartyPopper,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import confetti from "canvas-confetti";
import { affiliateOverview } from "@/lib/affiliate.functions";

export function AffiliateWelcomeDialog() {
  const fetchOverview = useServerFn(affiliateOverview);
  const [isOpen, setIsOpen] = useState(false);
  
  const { data } = useQuery({
    queryKey: ["affiliate-overview"],
    queryFn: () => fetchOverview({ data: {} }),
  });

  useEffect(() => {
    if (data?.enrolled && (data.affiliate as any).verification_status === "APPROVED") {
      const shown = localStorage.getItem("msk_affiliate_welcome_shown");
      if (!shown) {
        setIsOpen(true);
        // Trigger confetti
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
      }
    }
  }, [data]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem("msk_affiliate_welcome_shown", "true");
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-transparent">
        <div className="relative group">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-3xl rounded-[2.5rem]" />
          
          <div className="relative glass-dark rounded-[2.5rem] border border-white/10 p-8 text-center space-y-6 overflow-hidden">
            {/* Close Button */}
            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Decorative Icons */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
                <div className="relative w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                  <Trophy className="text-primary w-10 h-10 animate-bounce" />
                </div>
                <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1.5 shadow-lg animate-spin-slow">
                  <Star className="text-black w-4 h-4 fill-current" />
                </div>
                <div className="absolute -bottom-2 -left-2 bg-primary rounded-full p-1.5 shadow-lg">
                  <PartyPopper className="text-white w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white">
                PARABÉNS! <span className="text-primary">VOCÊ É UM AFILIADO!</span>
              </h2>
              <p className="text-white/60 text-sm leading-relaxed">
                Sua solicitação foi aprovada com sucesso! Agora você faz parte da elite da <span className="text-white font-bold">MSK SISTEM</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 text-left">
              {[
                { icon: <CheckCircle2 className="text-primary w-4 h-4" />, text: "Acesso total ao painel de lucros" },
                { icon: <Rocket className="text-primary w-4 h-4" />, text: "Comissões automáticas via PIX" },
                { icon: <Star className="text-primary w-4 h-4" />, text: "Suporte prioritário e materiais exclusivos" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                  {item.icon}
                  <span className="text-xs font-bold text-white/80">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <Button 
                onClick={handleClose}
                variant="neon"
                className="w-full h-14 rounded-2xl font-black text-lg uppercase tracking-widest gap-2 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all"
              >
                VAMOS COMEÇAR A LUCRAR <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
            
            <p className="text-[10px] uppercase font-bold text-white/20 tracking-widest">
              Prepare-se para o próximo nível de resultados
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
