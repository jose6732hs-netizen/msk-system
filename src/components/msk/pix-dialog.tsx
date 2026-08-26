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
import { CardPaymentPanel } from "@/components/msk/card-payment-panel";

import { checkTransaction } from "@/lib/commerce.functions";
import { useNavigate } from "@tanstack/react-router";
import { useModalScrollLock } from "@/hooks/use-modal-scroll-lock";

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

function normalizeGatewayQr(raw?: string | null) {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value.startsWith("data:") || /^https?:\/\//i.test(value)) return value;
  return `data:image/png;base64,${value}`;
}

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
  const navigate = useNavigate();
  const [status, setStatus] = useState(pix.status);
  const [qrData, setQrData] = useState<string | null>(null);
  const { left, label } = useCountdown(pix.expiresAt);
  const totalDuration = 2 * 60 * 1000;
  const progress = pix.expiresAt ? Math.max(0, Math.min(100, (left / totalDuration) * 100)) : 100;
  const expired = status === "EXPIRED" || (!!pix.expiresAt && left <= 0 && status !== "PAID");

  useModalScrollLock(true);

  useEffect(() => setStatus(pix.status), [pix.transactionId, pix.status]);

  useEffect(() => {
    let alive = true;
    if (pix.pixCode && pix.pixCode.length > 20) {
      void QRCode.toDataURL(pix.pixCode, { width: 512, margin: 1, errorCorrectionLevel: "M" })
        .then((url) => {
          if (alive) setQrData(url);
        })
        .catch(() => {
          if (!alive) return;
          setQrData(normalizeGatewayQr(pix.qrCode));
        });
      return () => {
        alive = false;
      };
    }

    setQrData(normalizeGatewayQr(pix.qrCode));
    return () => {
      alive = false;
    };
  }, [pix.qrCode, pix.pixCode]);

  useEffect(() => {
    const TERMINAL = ["PAID", "FAILED", "REFUNDED", "CHARGED_BACK", "CANCELED", "EXPIRED"];
    if (TERMINAL.includes(status)) return;
    let attempts = 0;
    const maxAttempts = 360;
    const id = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(id);
        return;
      }
      try {
        const res = await checkTransaction({ data: { transactionId: pix.transactionId } });
        if (res.status !== status) setStatus(res.status);
        if (res.status === "PAID") {
          clearInterval(id);
          toast.success("Pagamento confirmado! Licença liberada.");
          navigate({ to: "/obrigado", search: { transactionId: pix.transactionId } });
          onPaid();
        } else if (TERMINAL.includes(res.status)) {
          clearInterval(id);
        }
      } catch {
        /* mantém o polling */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [pix.transactionId, status, onPaid]);

  const createdAt = useMemo(() => {
    const date = pix.createdAt ? new Date(pix.createdAt) : new Date();
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [pix.createdAt]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center overflow-hidden bg-background/95 p-0 backdrop-blur-xl sm:p-4">
      <div className="relative z-[1] h-full w-full max-w-4xl animate-in fade-in zoom-in duration-300 sm:h-auto sm:max-h-[calc(100dvh-2rem)]">
        <div className="glass relative flex h-full flex-col overflow-hidden border-y border-white/10 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:border-x">
          <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4 sm:px-8 sm:py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Checkout MSK</h3>
                <div className="mt-0.5 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="text-[0.6rem] font-bold uppercase tracking-tighter text-muted-foreground">Sessão Segura Ativa</span>
                </div>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} className="group h-10 w-10 shrink-0 rounded-xl border border-white/10" aria-label="Fechar checkout">
              <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </Button>
          </div>

          <div className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [overscroll-behavior:contain] lg:grid-cols-[1fr_400px]">
            <div className="overflow-hidden border-r border-white/5 p-5 sm:p-8">
              <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8 sm:gap-3">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">Criado às {createdAt}</span>
                </div>
                <div className={`flex items-center gap-2 rounded-full border px-4 py-1.5 ${status === "PAID" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : expired ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${status === "PAID" ? "bg-emerald-400" : expired ? "bg-destructive" : "animate-pulse bg-amber-400"}`} />
                  <span className="text-[0.65rem] font-black uppercase tracking-widest">{status === "PAID" ? "Confirmado" : expired ? "Expirado" : "Pendente"}</span>
                </div>
              </div>

              <div className="mb-8 flex flex-col items-start gap-5 sm:flex-row">
                {pix.imageUrl && (
                  <div className="h-32 w-32 shrink-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
                    <img src={pix.imageUrl} alt={pix.planName} className="h-full w-full object-contain transition-transform duration-700 hover:scale-110" />
                  </div>
                )}
                <div>
                  <h2 className="mb-2 break-words text-2xl font-black uppercase leading-tight tracking-tighter text-foreground sm:text-5xl">{pix.planName ?? "Assinatura Pro"}</h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.4)] sm:text-5xl">{brl(pix.amount)}</span>
                    <span className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted-foreground">Pagamento Único</span>
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

                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h4 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-foreground">Instruções Rápidas</h4>
                  <ul className="space-y-4">
                    <Step n={1}>Abra o aplicativo do seu banco preferido.</Step>
                    <Step n={2}>Acesse a área PIX e escaneie o código ao lado.</Step>
                    <Step n={3}>Confirme o pagamento e sua licença será liberada.</Step>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex min-h-[430px] flex-col justify-center bg-black/20 p-6 sm:p-8 lg:min-h-0">
              {status === "PAID" ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <Check className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h3 className="mb-2 text-xl font-black uppercase tracking-tight text-white">Pagamento Recebido!</h3>
                  <p className="mb-8 text-sm text-muted-foreground">Sua licença foi ativada com sucesso em sua conta.</p>
                  <Button variant="neon" className="w-full" onClick={() => navigate({ to: "/obrigado", search: { transactionId: pix.transactionId } })}>Ver Licença Agora</Button>
                </div>
              ) : expired ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                    <TimerReset className="h-10 w-10 text-destructive" />
                  </div>
                  <h3 className="mb-2 text-xl font-black uppercase tracking-tight text-white">Link Expirado</h3>
                  <p className="mb-8 text-sm text-muted-foreground">O tempo para este PIX acabou. Gere um novo código.</p>
                  <Button variant="neon" className="w-full" onClick={onRegenerate} disabled={regenerating}>
                    {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Gerar Novo PIX
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="group relative mb-8">
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary to-primary/50 opacity-25 blur transition duration-1000 group-hover:opacity-40"></div>
                    <div className="relative rounded-2xl bg-white p-4">
                      {qrData ? <img src={qrData} alt="QR PIX" className="h-48 w-48" /> : <div className="flex h-48 w-48 items-center justify-center bg-muted/20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                    </div>
                    <div className="absolute -bottom-8 left-1/2 flex w-64 -translate-x-1/2 flex-col items-center gap-3">
                      <div className="h-3 w-full overflow-hidden rounded-full border border-white/5 bg-white/10 p-0.5 shadow-inner">
                        <div className="h-full rounded-full bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.6)] transition-all duration-1000 ease-linear" style={{ width: `${100 - progress}%` }} />
                      </div>
                      <div className="flex scale-110 items-center gap-3 rounded-2xl border border-white/20 bg-black/80 px-6 py-2 shadow-2xl backdrop-blur-md">
                        <Clock className="h-4 w-4 animate-pulse text-destructive" />
                        <span className="font-mono text-xl font-black tracking-tighter text-white">{label}</span>
                      </div>
                    </div>
                  </div>

                  {pix.pixCode && (
                    <div className="w-full space-y-4">
                      <div className="w-full break-all rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-[0.65rem] leading-relaxed text-muted-foreground">{pix.pixCode}</div>
                      <Button variant="neon" className="h-12 w-full text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20" onClick={() => { navigator.clipboard.writeText(pix.pixCode!); toast.success("Copiado com sucesso!"); }}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar Código
                      </Button>
                    </div>
                  )}

                  <div className="mt-6 w-full">
                    <CardPaymentPanel transactionId={pix.transactionId} amount={pix.amount} onPaid={() => { setStatus("PAID"); navigate({ to: "/obrigado", search: { transactionId: pix.transactionId } }); onPaid(); }} />
                  </div>

                  <div className="mt-8 flex items-center gap-3 text-muted-foreground">
                    <div className="relative h-4 w-4">
                      <div className="absolute inset-0 animate-ping rounded-full border-2 border-primary/30" />
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
    <div className="group flex items-center gap-3 text-muted-foreground">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all group-hover:border-primary/20 group-hover:text-primary">{icon}</div>
      <span className="text-[0.65rem] font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="group flex gap-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-primary/40 text-[0.65rem] font-black text-primary transition-all group-hover:bg-primary group-hover:text-black">{n}</span>
      <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">{children}</span>
    </li>
  );
}
