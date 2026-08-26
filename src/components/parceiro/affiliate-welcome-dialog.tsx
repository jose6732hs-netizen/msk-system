import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle2,
  PartyPopper,
  Rocket,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) return clearInterval(interval);

          const particleCount = 50 * (timeLeft / duration);
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          });
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
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md overflow-y-auto border-none bg-transparent p-0 sm:w-[calc(100vw-2rem)] [&>button]:hidden">
        <div className="group relative min-w-0">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-3xl sm:rounded-[2.5rem]" />

          <div className="glass-dark relative min-w-0 space-y-5 overflow-hidden rounded-[2rem] border border-white/10 p-5 text-center sm:space-y-6 sm:rounded-[2.5rem] sm:p-8">
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-xl text-white/30 transition-colors hover:bg-white/5 hover:text-white sm:right-4 sm:top-4"
              aria-label="Fechar mensagem"
            >
              <X size={20} />
            </button>

            <div className="flex justify-center pt-2 sm:pt-0">
              <div className="relative">
                <div className="absolute inset-0 scale-150 animate-pulse rounded-full bg-primary/20 blur-2xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 sm:h-20 sm:w-20">
                  <Trophy className="h-8 w-8 animate-bounce text-primary sm:h-10 sm:w-10" />
                </div>
                <div className="animate-spin-slow absolute -right-2 -top-2 rounded-full bg-yellow-500 p-1.5 shadow-lg">
                  <Star className="h-4 w-4 fill-current text-black" />
                </div>
                <div className="absolute -bottom-2 -left-2 rounded-full bg-primary p-1.5 shadow-lg">
                  <PartyPopper className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <h2 className="break-words text-2xl font-black uppercase tracking-tighter text-white sm:text-3xl">
                PARABÉNS! <span className="text-primary">VOCÊ É UM AFILIADO!</span>
              </h2>
              <p className="break-words text-sm leading-relaxed text-white/60">
                Sua solicitação foi aprovada com sucesso! Agora você faz parte da elite da{" "}
                <span className="font-bold text-white">MSK SISTEM</span>.
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 text-left">
              {[
                {
                  icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />,
                  text: "Acesso total ao painel de lucros",
                },
                {
                  icon: <Rocket className="h-4 w-4 shrink-0 text-primary" />,
                  text: "Comissões automáticas via PIX",
                },
                {
                  icon: <Star className="h-4 w-4 shrink-0 text-primary" />,
                  text: "Suporte prioritário e materiais exclusivos",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3"
                >
                  {item.icon}
                  <span className="min-w-0 break-words text-xs font-bold text-white/80">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 sm:pt-4">
              <Button
                onClick={handleClose}
                variant="neon"
                className="min-h-14 h-auto w-full gap-2 whitespace-normal rounded-2xl px-4 py-3 text-center text-sm font-black uppercase leading-tight tracking-[.12em] shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] sm:text-lg sm:tracking-widest"
              >
                <span className="min-w-0 break-words">VAMOS COMEÇAR A LUCRAR</span>
                <ArrowRight className="h-5 w-5 shrink-0" />
              </Button>
            </div>

            <p className="break-words text-[9px] font-bold uppercase tracking-[.16em] text-white/20 sm:text-[10px] sm:tracking-widest">
              Prepare-se para o próximo nível de resultados
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
