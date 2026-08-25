import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, ClipboardCopy, Clock3, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { checkTransaction } from "@/lib/commerce.functions";

const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function normalizeQr(raw?: string | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (value.startsWith("data:") || /^https?:\/\//i.test(value)) return value;
  return `data:image/png;base64,${value}`;
}

export type SmartPixState = {
  transactionId: string;
  pixCode: string | null;
  qrCode: string | null;
  amount: number;
  expiresAt: string;
  title: string;
  subtitle?: string | null;
};

export function SmartPixModal({
  pix,
  onClose,
  onPaid,
  onRegenerate,
}: {
  pix: SmartPixState;
  onClose: () => void;
  onPaid: () => void;
  onRegenerate: () => void;
}) {
  const [status, setStatus] = useState("PENDING");
  const [now, setNow] = useState(() => Date.now());
  const [qr, setQr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const left = Math.max(0, new Date(pix.expiresAt).getTime() - now);
  const totalSeconds = Math.ceil(left / 1000);
  const label = `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
  const expired = left <= 0 && status !== "PAID";
  const createdLabel = useMemo(
    () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    [pix.transactionId],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    if (pix.pixCode && pix.pixCode.length > 20) {
      void QRCode.toDataURL(pix.pixCode, { width: 500, margin: 1, errorCorrectionLevel: "M" })
        .then((value) => alive && setQr(value))
        .catch(() => alive && setQr(normalizeQr(pix.qrCode)));
    } else {
      setQr(normalizeQr(pix.qrCode));
    }
    return () => {
      alive = false;
    };
  }, [pix.pixCode, pix.qrCode, pix.transactionId]);

  useEffect(() => {
    if (status === "PAID") return;
    let alive = true;
    const poll = async () => {
      if (!alive) return;
      setChecking(true);
      try {
        const result = await checkTransaction({ data: { transactionId: pix.transactionId } });
        const next = String(result.status ?? "PENDING").toUpperCase();
        if (!alive) return;
        setStatus(next);
        if (next === "PAID") {
          toast.success("Pagamento confirmado. Seus acessos estão sendo liberados.");
          onPaid();
        }
      } catch {
        // Mantém a tela aberta enquanto o gateway responde.
      } finally {
        if (alive) setChecking(false);
      }
    };
    void poll();
    const id = window.setInterval(poll, 3500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pix.transactionId, status, onPaid]);

  async function copyPix() {
    if (!pix.pixCode) return;
    await navigator.clipboard.writeText(pix.pixCode);
    toast.success("Código PIX copiado.");
  }

  return (
    <div className="fixed inset-0 z-[100030] flex items-end justify-center overflow-y-auto bg-black/90 p-0 backdrop-blur-xl sm:items-center sm:p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#0B0B0B] shadow-2xl sm:rounded-[2rem]">
        <div className="max-h-[94dvh] overflow-y-auto">
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0B0B0B]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[.2em] text-primary">Checkout PIX seguro</p>
              <h2 className="mt-1 break-words text-lg font-black uppercase sm:text-xl">{pix.title}</h2>
              {pix.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{pix.subtitle}</p> : null}
            </div>
            <button type="button" aria-label="Fechar checkout" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/50 hover:bg-white/5 hover:text-white" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Valor</p>
                  <p className="mt-2 break-words text-2xl font-black text-primary">{brl(pix.amount)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Criado</p>
                  <p className="mt-2 text-lg font-black">{createdLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
                  <p className={`mt-2 text-sm font-black uppercase ${status === "PAID" ? "text-emerald-400" : expired ? "text-red-400" : "text-amber-300"}`}>
                    {status === "PAID" ? "Confirmado" : expired ? "Expirado" : "Aguardando PIX"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[.04] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-black">Liberação somente após confirmação real</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">O servidor consulta o gateway. Licenças e arquivo privado não são liberados apenas pelo cronômetro ou pelo navegador.</p>
                  </div>
                </div>
              </div>

              {pix.pixCode ? (
                <div className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">PIX copia e cola</p>
                  <p className="mt-2 max-h-20 overflow-hidden break-all font-mono text-[10px] leading-relaxed text-white/50">{pix.pixCode}</p>
                  <Button type="button" variant="ghost" className="mt-3 w-full border border-white/10" onClick={copyPix}>
                    <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar código PIX
                  </Button>
                </div>
              ) : null}
            </section>

            <aside className="border-t border-white/10 bg-black/25 p-5 sm:p-7 lg:border-l lg:border-t-0">
              {status === "PAID" ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/5"><CheckCircle2 className="h-10 w-10 text-emerald-400" /></div>
                  <h3 className="mt-6 text-xl font-black uppercase">Pagamento confirmado</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Preparando a tela com suas licenças e o download protegido.</p>
                </div>
              ) : expired ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                  <Clock3 className="h-10 w-10 text-red-400" />
                  <h3 className="mt-5 text-xl font-black uppercase">PIX expirado</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Gere outro código para continuar com a mesma oferta.</p>
                  <Button type="button" variant="neon" className="mt-6 w-full" onClick={onRegenerate}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Gerar novo PIX
                  </Button>
                </div>
              ) : (
                <div className="flex min-h-[340px] flex-col items-center justify-center">
                  <div className="rounded-2xl bg-white p-3 shadow-2xl">
                    {qr ? <img src={qr} alt="QR Code PIX" className="h-52 w-52 max-w-full" /> : <div className="grid h-52 w-52 max-w-full place-items-center"><Loader2 className="h-7 w-7 animate-spin text-black" /></div>}
                  </div>
                  <div className="mt-5 flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-amber-300">
                    <Clock3 className="h-4 w-4" />
                    <span className="font-mono text-xl font-black">{label}</span>
                  </div>
                  <p className="mt-3 text-center text-[10px] text-muted-foreground">{checking ? "Consultando gateway..." : "Verificação automática a cada poucos segundos"}</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
