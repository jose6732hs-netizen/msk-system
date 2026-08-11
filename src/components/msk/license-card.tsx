import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Timer, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar,
  CreditCard,
  Copy,
  ExternalLink,
  RefreshCw,
  Rocket,
  Eye,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LicenseCardProps {
  license: any;
  token?: string | null;
  busy?: boolean;
  onReveal?: () => void;
  onCopyToken: () => void;
  highlighted?: boolean;
}

export function LicenseCard({ license, token, busy, onReveal, onCopyToken, highlighted }: LicenseCardProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null);

  useEffect(() => {
    if (!license.expires_at) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiration = new Date(license.expires_at).getTime();
      const difference = expiration - now;

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [license.expires_at]);

  const status = timeLeft?.isExpired ? "expired" : license.status;
  const plan = license.plans;

  const durationText = plan?.is_lifetime 
    ? "Vitalício" 
    : license.expires_at && license.starts_at
      ? `${Math.round((new Date(license.expires_at).getTime() - new Date(license.starts_at).getTime()) / (1000 * 60 * 60 * 24))} dias`
      : "30 dias";

  return (
    <div className={cn(
      "glass relative overflow-hidden rounded-[2.5rem] border transition-all duration-500",
      highlighted ? "border-primary/50 shadow-2xl shadow-primary/20 ring-2 ring-primary/20 scale-[1.02]" : "border-white/10",
      status === "expired" ? "opacity-75 grayscale-[0.5]" : ""
    )}>
      {/* Glow effect */}
      <div className={cn(
        "absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20",
        status === "active" ? "bg-primary" : status === "expired" ? "bg-red-500" : "bg-amber-500"
      )} />

      <div className="relative z-10 p-8 sm:p-10">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg",
              status === "active" ? "bg-primary/20 text-primary shadow-primary/20" : 
              status === "expired" ? "bg-red-500/20 text-red-500 shadow-red-500/20" : 
              "bg-amber-500/20 text-amber-500 shadow-amber-500/20"
            )}>
              {status === "active" ? <ShieldCheck size={32} /> : 
               status === "expired" ? <AlertCircle size={32} /> : 
               <Clock size={32} />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/60">Licença</h3>
                <span className={cn(
                  "px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                  status === "active" ? "bg-green-500/20 text-green-500" : 
                  status === "expired" ? "bg-red-500/20 text-red-500" : 
                  "bg-amber-500/20 text-amber-500"
                )}>
                  {status === "active" ? "Ativa" : status === "expired" ? "Expirada" : "Pendente"}
                </span>
              </div>
              <h2 className="text-3xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
                <Rocket className="text-primary h-6 w-6" />
                {plan?.name || "Plano Pro"}
              </h2>
            </div>
          </div>

          {status === "expired" ? (
            <Button variant="neon" className="rounded-xl h-12 px-8 font-black uppercase tracking-wider text-xs shadow-xl shadow-primary/20">
              <RefreshCw className="mr-2 h-4 w-4" /> Renovar Licença
            </Button>
          ) : (
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest block mb-1">Valor Investido</span>
              <span className="text-2xl font-black text-white">
                R$ {Number(license.amount_paid || 99.90).toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <InfoItem 
            icon={<Calendar className="h-4 w-4" />} 
            label="Data da Compra" 
            value={new Date(license.starts_at).toLocaleDateString('pt-BR')} 
          />
          <InfoItem 
            icon={<CheckCircle2 className="h-4 w-4" />} 
            label="Ativação" 
            value={license.activated_at ? new Date(license.activated_at).toLocaleDateString('pt-BR') : "Aguardando"} 
          />
          <InfoItem 
            icon={<Clock className="h-4 w-4" />} 
            label="Duração Total" 
            value={durationText} 
          />
          <InfoItem 
            icon={<AlertCircle className="h-4 w-4" />} 
            label="Expiração" 
            value={license.expires_at ? new Date(license.expires_at).toLocaleDateString('pt-BR') : "Vitalício"} 
          />
        </div>

        {timeLeft && !plan?.is_lifetime && (
          <div className={cn(
            "p-8 rounded-[2rem] border overflow-hidden relative group transition-all duration-500",
            status === "expired" ? "bg-red-500/5 border-red-500/20" : "bg-white/5 border-white/10 hover:border-primary/30"
          )}>
            <div className="flex flex-col items-center gap-6 relative z-10">
              <div className="flex items-center gap-2">
                <Timer className={cn("h-4 w-4", status === "expired" ? "text-red-500" : "text-primary")} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                  {status === "expired" ? "Tempo Encerrado" : "Tempo Restante da Licença"}
                </span>
              </div>
              
              {status === "expired" ? (
                <div className="text-center">
                  <h4 className="text-3xl font-black text-red-500 uppercase tracking-tighter mb-2">⚠️ Acesso Bloqueado</h4>
                  <p className="text-xs text-white/40 font-medium">Sua licença expirou. Renove agora para continuar utilizando todas as ferramentas.</p>
                </div>
              ) : (
                <div className="flex gap-4 sm:gap-8">
                  <TimeBlock value={timeLeft.days} label="dias" />
                  <TimeDivider />
                  <TimeBlock value={timeLeft.hours} label="horas" />
                  <TimeDivider />
                  <TimeBlock value={timeLeft.minutes} label="minutos" />
                  <TimeDivider className="hidden sm:flex" />
                  <TimeBlock value={timeLeft.seconds} label="segundos" className="hidden sm:flex" />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap gap-4 pt-8 border-t border-white/5">
          <Button 
            variant="neon" 
            className="rounded-xl h-11 px-6 font-bold text-xs gap-2"
            onClick={() => onCopyToken?.()}
          >
            <Copy size={16} /> Copiar Token de Acesso
          </Button>
          <Button 
            variant="ghost" 
            className="rounded-xl h-11 px-6 font-bold text-xs gap-2 text-white/60 hover:text-white hover:bg-white/5"
          >
            <ExternalLink size={16} /> Ver Detalhes da Transação
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
        {icon} {label}
      </div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function TimeBlock({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center min-w-[60px]", className)}>
      <span className="text-4xl sm:text-5xl font-black text-white tracking-tighter">{String(value).padStart(2, '0')}</span>
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">{label}</span>
    </div>
  );
}

function TimeDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center text-white/10 text-3xl font-thin pb-4", className)}>
      :
    </div>
  );
}
