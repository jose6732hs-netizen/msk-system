import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCopy, Copy, Download, FileArchive, Loader2, LockKeyhole, Share2, ShieldCheck, Sparkles, TimerReset, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { PayerForm, useBilling } from "@/components/msk/payer-form";
import { supabase } from "@/integrations/supabase/client";
import { checkTransaction } from "@/lib/commerce.functions";
import { getClonerProduct, startClonerCheckout, trackClonerPublic } from "@/lib/cloner.functions";
import { getVisitorId, readAffiliateRef, storeAffiliateRef } from "@/lib/urls";

export const Route = createFileRoute("/clonagem")({
  head: () => ({
    meta: [
      { title: "Clonador de Páginas — MSK SISTEM" },
      { name: "description", content: "Checkout seguro do MSK Clonador de Páginas com liberação automática da licença e do arquivo após o PIX." },
      { property: "og:title", content: "MSK Clonador de Páginas" },
      { property: "og:description", content: "Licença e download liberados automaticamente após a confirmação do PIX." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ClonagemPage,
});

const brl = (v: number, currency = "BRL") => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);

function human(bytes?: number | null) {
  if (!bytes) return "ZIP privado";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ClonagemPage() {
  const navigate = useNavigate();
  const { billing, complete } = useBilling();
  const [showPayer, setShowPayer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<null | {
    transactionId: string;
    pixCode: string | null;
    qrCode: string | null;
    amount: number;
    expiresAt: string;
  }>(null);

  const { data: product, isLoading, refetch } = useQuery({
    queryKey: ["cloner-product"],
    queryFn: () => getClonerProduct(),
    staleTime: 30_000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) storeAffiliateRef(ref);
    void trackClonerPublic({ data: { event: "cloner.view", visitorId: getVisitorId(), source: document.referrer || undefined } }).catch(() => undefined);
  }, []);

  async function share() {
    const url = window.location.href;
    const text = product?.shareText || "Conheça o MSK Clonador de Páginas.";
    try {
      await trackClonerPublic({ data: { event: "cloner.share", visitorId: getVisitorId() } });
      if (navigator.share) {
        await navigator.share({ title: product?.title || "MSK Clonador de Páginas", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link do checkout copiado.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Não foi possível compartilhar agora.");
    }
  }

  async function checkout(override?: { document: string; phone: string }) {
    if (!product?.enabled) {
      toast.error("Este checkout ainda não está disponível.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      navigate({ to: "/auth", search: { next: "/clonagem" } });
      return;
    }

    const payer = override ?? (complete && billing ? { document: billing.document, phone: billing.phone } : null);
    if (!payer) {
      setShowPayer(true);
      return;
    }

    setBusy(true);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const result = await startClonerCheckout({
        data: {
          document: payer.document,
          phone: payer.phone,
          ...(ref ? { affiliateCode: ref } : {}),
        },
      });
      setShowPayer(false);
      if (result.checkoutUrl && !result.pixCode) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setPix({
        transactionId: result.transactionId,
        pixCode: result.pixCode,
        qrCode: result.qrCode,
        amount: result.amount,
        expiresAt: new Date(Date.now() + 2 * 60_000).toISOString(),
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <SiteHeader />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[150px]" />
        </div>

        <section className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Ferramenta de clonagem MSK
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-black uppercase leading-[.92] tracking-tighter sm:text-6xl lg:text-7xl">
              {product?.title ?? "MSK Clonador de Páginas"}
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-white/55 sm:text-lg">
              {product?.subtitle ?? "Clone páginas com rapidez e leve a estrutura para o seu projeto."}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/35">
              {product?.description ?? "A licença e o arquivo são liberados somente depois do pagamento confirmado."}
            </p>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <Feature icon={<Zap />} title="Liberação automática" text="PIX confirmado pelo gateway" />
              <Feature icon={<LockKeyhole />} title="Arquivo protegido" text="ZIP privado antes do pagamento" />
              <Feature icon={<ShieldCheck />} title="Licença individual" text="Token vinculado à sua compra" />
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-white/10 bg-[#0D0D0D]/95 p-6 shadow-2xl sm:p-8">
            {isLoading ? (
              <div className="grid min-h-[320px] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.2em] text-muted-foreground">Checkout exclusivo</p>
                    <h2 className="mt-2 text-xl font-black uppercase">Licença de clonagem</h2>
                  </div>
                  <button onClick={share} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-primary transition hover:bg-primary/10" aria-label="Compartilhar checkout">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-7 rounded-3xl border border-primary/20 bg-primary/5 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pagamento único</p>
                  <p className="mt-2 text-4xl font-black text-primary">{brl(product?.price ?? 0, product?.currency ?? "BRL")}</p>
                  <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/5 bg-black/30 p-4">
                    <FileArchive className="h-7 w-7 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{product?.zipFileName || "Pacote da extensão de clonagem"}</p>
                      <p className="text-xs text-muted-foreground">{human(product?.zipSizeBytes)} · liberado após o PIX</p>
                    </div>
                  </div>
                </div>

                {!product?.zipReady ? (
                  <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-300">
                    O administrador ainda precisa enviar o ZIP da ferramenta.
                  </div>
                ) : !product?.enabled ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                    Checkout em preparação. O Super Admin precisa definir o preço e ativar a oferta.
                  </div>
                ) : null}

                {showPayer ? (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                    <p className="mb-4 text-xs font-black uppercase tracking-widest">Dados para o PIX</p>
                    <PayerForm compact onSaved={(b) => void checkout(b)} />
                  </div>
                ) : (
                  <Button variant="neon" className="mt-6 h-14 w-full rounded-2xl text-xs font-black uppercase tracking-[.18em]" disabled={busy || !product?.enabled} onClick={() => void checkout()}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    {busy ? "Gerando PIX..." : "Garantir licença de clonagem"}
                  </Button>
                )}

                <Button variant="ghost" className="mt-2 w-full text-xs text-muted-foreground" onClick={share}>
                  <Share2 className="mr-2 h-4 w-4" /> Compartilhar esta ferramenta
                </Button>
                <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-white/25">Token + ZIP aparecem somente após confirmação real do pagamento.</p>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />

      {pix ? (
        <ClonerPixModal
          pix={pix}
          onClose={() => setPix(null)}
          onPaid={() => navigate({ to: "/clonagem-entrega", search: { transactionId: pix.transactionId } })}
          onRegenerate={() => {
            setPix(null);
            void checkout();
          }}
        />
      ) : null}
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="mb-3 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <p className="text-xs font-black uppercase">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/35">{text}</p>
    </div>
  );
}

function ClonerPixModal({
  pix,
  onClose,
  onPaid,
  onRegenerate,
}: {
  pix: { transactionId: string; pixCode: string | null; qrCode: string | null; amount: number; expiresAt: string };
  onClose: () => void;
  onPaid: () => void;
  onRegenerate: () => void;
}) {
  const [status, setStatus] = useState("PENDING");
  const [now, setNow] = useState(Date.now());
  const [qr, setQr] = useState<string | null>(null);
  const left = Math.max(0, new Date(pix.expiresAt).getTime() - now);
  const seconds = Math.ceil(left / 1000);
  const label = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const expired = left <= 0 && status !== "PAID";

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    if (pix.pixCode) {
      void QRCode.toDataURL(pix.pixCode, { width: 420, margin: 1 }).then((v) => alive && setQr(v)).catch(() => {
        if (!alive) return;
        const raw = pix.qrCode?.trim();
        setQr(raw ? (raw.startsWith("data:") || /^https?:\/\//i.test(raw) ? raw : `data:image/png;base64,${raw}`) : null);
      });
    }
    return () => { alive = false; };
  }, [pix.pixCode, pix.qrCode]);

  useEffect(() => {
    if (status === "PAID") return;
    const check = async () => {
      try {
        const res = await checkTransaction({ data: { transactionId: pix.transactionId } });
        const next = String(res.status ?? "PENDING").toUpperCase();
        setStatus(next);
        if (next === "PAID") {
          toast.success("Pagamento confirmado. Licença e download liberados!");
          onPaid();
        }
      } catch {
        // Mantém o polling enquanto o gateway processa.
      }
    };
    void check();
    const id = setInterval(check, 3500);
    return () => clearInterval(id);
  }, [pix.transactionId, status, onPaid]);

  async function copyPix() {
    if (!pix.pixCode) return;
    await navigator.clipboard.writeText(pix.pixCode);
    toast.success("Código PIX copiado.");
  }

  return (
    <div className="fixed inset-0 z-[100000] grid place-items-center overflow-y-auto bg-black/90 p-4 backdrop-blur-xl">
      <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#0D0D0D] p-5 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Checkout PIX · Clonador</p>
            <h3 className="mt-2 text-2xl font-black uppercase">Finalize para liberar o ZIP</h3>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-xl border border-white/10" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {expired ? (
          <div className="mt-8 rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center">
            <TimerReset className="mx-auto h-10 w-10 text-red-400" />
            <p className="mt-4 text-xl font-black uppercase">PIX expirado</p>
            <p className="mt-2 text-sm text-white/45">Gere um novo código para continuar.</p>
            <Button variant="neon" className="mt-6" onClick={onRegenerate}>Gerar novo PIX</Button>
          </div>
        ) : (
          <div className="mt-7 grid gap-7 md:grid-cols-[1fr_.9fr] md:items-center">
            <div>
              <div className="rounded-3xl border border-white/10 bg-white p-4">
                {qr ? <img className="mx-auto aspect-square w-full max-w-[290px]" src={qr} alt="QR Code PIX" /> : <div className="grid aspect-square place-items-center"><Loader2 className="animate-spin text-black" /></div>}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Expira em</span>
                <span className="font-mono text-xl font-black text-primary">{label}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor</p>
              <p className="mt-1 text-4xl font-black text-primary">{brl(pix.amount)}</p>
              <div className="mt-6 space-y-3">
                <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><p className="text-xs leading-relaxed text-white/50">O download não é público. A URL é assinada e criada somente para a compra paga.</p></div>
                <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /><p className="text-xs leading-relaxed text-white/50">Assim que o gateway confirmar, você será levado à tela com sua licença e o ZIP.</p></div>
              </div>
              <Button variant="neon" className="mt-6 h-12 w-full" onClick={copyPix} disabled={!pix.pixCode}><ClipboardCopy className="mr-2 h-4 w-4" /> Copiar PIX</Button>
              <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-white/25">Status: {status}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
