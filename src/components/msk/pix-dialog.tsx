import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

import { toast } from "sonner";
import QRCode from "qrcode";
import {
  BadgeCheck,
  Check,
  Copy,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  X,
  Calendar,
  Clock,
  History,
  TrendingUp,
  CreditCard,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkTransaction } from "@/lib/commerce.functions";

export type PixState = {
  transactionId: string;
  pixCode: string | null;
  qrCode: string | null;
  amount: number;
  status: string;
  expiresAt?: string | null;
  planName?: string;
  imageUrl?: string | null;
  createdAt?: string;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function useCountdown(expiresAt?: string | null) {
  const [left, setLeft] = useState(() =>
    expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0,
  );
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const total = Math.ceil(left / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return { left, label: `${mm}:${ss}` };
}

/** Modal PIX com expiração de 2 minutos e confirmação oficial via backend. */
export function PixDialog({
  pix,
  onClose,
  onPaid,
  onRegenerate,
  regenerating,
}: {
  pix: PixState;
  onClose: () => void;
  onPaid: () => void;
  onRegenerate: () => void;
  regenerating?: boolean;
}) {
  const [status, setStatus] = useState(pix.status);
  const [qrData, setQrData] = useState<string | null>(null);
  const { left, label } = useCountdown(pix.expiresAt);
  const totalDuration = 2 * 60 * 1000; // 2 minutos
  const progress = pix.expiresAt ? Math.max(0, Math.min(100, (left / totalDuration) * 100)) : 100;
  const expired = status === "EXPIRED" || (!!pix.expiresAt && left <= 0 && status !== "PAID");

  useEffect(() => setStatus(pix.status), [pix.transactionId, pix.status]);

  // Sempre mostramos QR: se o gateway não mandar imagem, geramos base64 do copia-e-cola.
  useEffect(() => {
    let alive = true;
    if (pix.qrCode) {
      setQrData(pix.qrCode.startsWith("data:") ? pix.qrCode : `data:image/png;base64,${pix.qrCode}`);
      return;
    }
    if (!pix.pixCode) {
      setQrData(null);
      return;
    }
    void QRCode.toDataURL(pix.pixCode, { width: 512, margin: 1 })
      .then((url) => alive && setQrData(url))
      .catch(() => alive && setQrData(null));
    return () => {
      alive = false;
    };
  }, [pix.qrCode, pix.pixCode]);

  // O status final é sempre o do backend/gateway — nunca só o cronômetro.
  useEffect(() => {
    if (status === "PAID") return;
    const id = setInterval(async () => {
      try {
        const res = await checkTransaction({ data: { transactionId: pix.transactionId } });
        if (res.status !== status) setStatus(res.status);
        if (res.status === "PAID") {
          toast.success("Pagamento confirmado! Licença liberada.");
          onPaid();
        }
      } catch {
        /* mantém o polling */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [pix.transactionId, status, onPaid]);

  const createdAt = useMemo(() => {
    const date = pix.createdAt ? new Date(pix.createdAt) : new Date();
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [pix.createdAt]);

  // Trava a rolagem do site enquanto o checkout está aberto (evita rolagem quebrada no mobile).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);


  // Portal no <body> evita que painéis/headers com blur fiquem por cima do checkout.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-start sm:items-center justify-center p-0 sm:p-4 bg-background/95 backdrop-blur-xl overflow-y-auto overscroll-contain">

      <div className="relative w-full max-w-4xl min-h-full sm:min-h-0 animate-in fade-in zoom-in duration-300">
        {/* Background decorative glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="glass relative overflow-hidden sm:rounded-[2.5rem] border-x-0 sm:border-x border-y border-white/10 shadow-2xl min-h-screen sm:min-h-0 flex flex-col sm:block">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 sm:px-8 py-4 sm:py-6 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Checkout MSK</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[0.6rem] font-bold uppercase tracking-tighter text-muted-foreground">Sessão Segura Ativa</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="group flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 transition-all hover:bg-white/5 hover:border-white/20"
            >
              <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </button>
          </div>

          <div className="grid lg:grid-cols-[1fr_400px] flex-1 overflow-y-auto">
            {/* Left Content - Details */}
            <div className="p-6 sm:p-10 border-r border-white/5 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 border border-white/10">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">Criado às {createdAt}</span>
                </div>
                <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 border ${
                  status === "PAID" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : expired 
                      ? "bg-destructive/10 border-destructive/20 text-destructive" 
                      : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                }`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${status === "PAID" ? "bg-emerald-400" : expired ? "bg-destructive" : "bg-amber-400 animate-pulse"}`} />
                  <span className="text-[0.65rem] font-black uppercase tracking-widest">
                    {status === "PAID" ? "Confirmado" : expired ? "Expirado" : "Pendente"}
                  </span>
                </div>
              </div>

              <div className="mb-10 flex flex-col sm:flex-row items-start gap-6">
                {pix.imageUrl && (
                  <div className="h-32 w-32 shrink-0 rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 shadow-2xl">
                    <img src={pix.imageUrl} alt={pix.planName} className="h-full w-full object-contain transition-transform duration-700 hover:scale-110" />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl sm:text-5xl font-black tracking-tighter text-foreground uppercase leading-tight mb-2 break-words">
                    {pix.planName ?? "Assinatura Pro"}
                  </h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-6xl font-black text-primary tracking-tighter drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)] whitespace-nowrap">{brl(pix.amount)}</span>
                    <span className="text-[0.65rem] font-black text-muted-foreground uppercase tracking-[0.2em]">Pagamento Único</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailItem icon={<History className="h-4 w-4" />} label="Processamento Instantâneo" />
                  <DetailItem icon={<ShieldCheck className="h-4 w-4" />} label="Ambiente Criptografado" />
                  <DetailItem icon={<Zap className="h-4 w-4" />} label="Ativação Automática" />
                  <DetailItem icon={<TrendingUp className="h-4 w-4" />} label="Preço Garantido" />
                </div>

                <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground mb-4">Instruções Rápidas</h4>
                  <ul className="space-y-4">
                    <Step n={1}>Abra o aplicativo do seu banco preferido.</Step>
                    <Step n={2}>Acesse a área PIX e escaneie o código ao lado.</Step>
                    <Step n={3}>Confirme o pagamento e sua licença será liberada.</Step>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Content - Payment Actions */}
            <div className="p-6 sm:p-10 bg-black/20 flex flex-col justify-center min-h-[500px] lg:min-h-0">
              {status === "PAID" ? (
                <div className="flex flex-col items-center justify-center text-center py-10">
                  <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <Check className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">Pagamento Recebido!</h3>
                  <p className="text-sm text-muted-foreground mb-8">Sua licença foi ativada com sucesso em sua conta.</p>
                  <Button variant="neon" className="w-full" onClick={onPaid}>Ver Licença Agora</Button>
                </div>
              ) : expired ? (
                <div className="flex flex-col items-center justify-center text-center py-10">
                  <div className="h-20 w-20 rounded-full bg-destructive/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                    <TimerReset className="h-10 w-10 text-destructive" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">Link Expirado</h3>
                  <p className="text-sm text-muted-foreground mb-8">O tempo de 2 minutos para este PIX acabou. Gere um novo código.</p>
                  <Button variant="neon" className="w-full" onClick={onRegenerate} disabled={regenerating}>
                    {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Gerar Novo PIX
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative mb-8 group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative bg-white p-4 rounded-2xl">
                      {qrData ? (
                        <img src={qrData} alt="QR PIX" className="h-48 w-48" />
                      ) : (
                        <div className="h-48 w-48 flex items-center justify-center bg-muted/20">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    {/* Floating Timer Badge & Progress Bar */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-64 flex flex-col items-center gap-3">
                      <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner p-0.5">
                        <div 
                          className="h-full bg-destructive transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(239,68,68,0.6)] rounded-full" 
                          style={{ width: `${100 - progress}%` }}
                        />
                      </div>
                      <div className="bg-black/80 backdrop-blur-md border border-white/20 px-6 py-2 rounded-2xl flex items-center gap-3 shadow-2xl scale-110">
                        <Clock className="h-4 w-4 text-destructive animate-pulse" />
                        <span className="font-mono text-xl font-black text-white tracking-tighter">{label}</span>
                      </div>
                    </div>
                  </div>

                  {pix.pixCode && (
                    <div className="w-full space-y-4">
                      <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 font-mono text-[0.65rem] break-all text-muted-foreground leading-relaxed">
                        {pix.pixCode}
                      </div>
                      <Button
                        variant="neon"
                        className="w-full h-12 text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                        onClick={() => {
                          navigator.clipboard.writeText(pix.pixCode!);
                          toast.success("Copiado com sucesso!");
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copiar Código
                      </Button>
                    </div>
                  )}

                  <div className="mt-8 flex items-center gap-3 text-muted-foreground">
                    <div className="h-4 w-4 relative">
                      <div className="absolute inset-0 border-2 border-primary/30 rounded-full animate-ping" />
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest">Validando Pagamento...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}


function DetailItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground group">
      <div className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:text-primary group-hover:border-primary/20 transition-all">
        {icon}
      </div>
      <span className="text-[0.65rem] font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 group">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-primary/40 text-[0.65rem] font-black text-primary group-hover:bg-primary group-hover:text-black transition-all">
        {n}
      </span>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{children}</span>
    </li>
  );
}

