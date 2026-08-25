import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileArchive,
  Gift,
  Loader2,
  LockKeyhole,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { PayerForm, useBilling } from "@/components/msk/payer-form";
import { SmartOfferModal } from "@/components/msk/smart-offer-modal";
import { SmartPixModal, type SmartPixState } from "@/components/msk/smart-pix-modal";
import { supabase } from "@/integrations/supabase/client";
import {
  getClonerProduct,
  getSmartOffer,
  startClonerCheckout,
  startSmartBundleCheckout,
  trackClonerPublic,
} from "@/lib/cloner.functions";
import { getVisitorId, readAffiliateRef, storeAffiliateRef } from "@/lib/urls";

export const Route = createFileRoute("/clonagem")({
  head: () => ({
    meta: [
      { title: "Clonador de Páginas — MSK SISTEM" },
      {
        name: "description",
        content: "Planos diário, semanal e mensal do MSK Clonador de Páginas com PIX, licença e download protegido.",
      },
      { property: "og:title", content: "MSK Clonador de Páginas" },
      { property: "og:description", content: "Escolha seu plano e libere a ferramenta após a confirmação do PIX." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ClonagemPage,
});

const brl = (v: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);

function human(bytes?: number | null) {
  if (!bytes) return "ZIP privado";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ClonagemPage() {
  const navigate = useNavigate();
  const { billing, complete } = useBilling();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [showPayer, setShowPayer] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<any | null>(null);
  const [smartContext, setSmartContext] = useState<null | {
    offer: any;
    plan: any;
    billing: { document: string; phone: string };
  }>(null);
  const [pix, setPix] = useState<SmartPixState | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ["cloner-product"],
    queryFn: () => getClonerProduct(),
    staleTime: 30_000,
  });
  const plans = product?.plans ?? [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) storeAffiliateRef(ref);
    void trackClonerPublic({
      data: {
        event: "cloner.view",
        visitorId: getVisitorId(),
        source: document.referrer || undefined,
      },
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (paused || plans.length < 2) return;
    const id = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % plans.length;
        const container = carouselRef.current;
        const target = container?.children.item(next) as HTMLElement | null;
        if (container && target) {
          container.scrollTo({ left: target.offsetLeft - container.offsetLeft, behavior: "smooth" });
        }
        return next;
      });
    }, 4500);
    return () => window.clearInterval(id);
  }, [paused, plans.length]);

  function move(direction: number) {
    if (!plans.length) return;
    const next = (activeIndex + direction + plans.length) % plans.length;
    setActiveIndex(next);
    const container = carouselRef.current;
    const target = container?.children.item(next) as HTMLElement | null;
    if (container && target) container.scrollTo({ left: target.offsetLeft - container.offsetLeft, behavior: "smooth" });
  }

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

  async function beginCheckout(plan: any, billingOverride?: { document: string; phone: string }) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      navigate({ to: "/auth", search: { next: "/clonagem" } });
      return;
    }

    const payer = billingOverride ?? (complete && billing ? { document: billing.document, phone: billing.phone } : null);
    if (!payer) {
      setPendingPlan(plan);
      setShowPayer(true);
      return;
    }

    setBusyPlan(plan.id);
    try {
      const offer = product?.smartOffersEnabled ? await getSmartOffer({ data: { planId: plan.id } }) : null;
      if (offer?.available) {
        setSmartContext({ offer, plan, billing: payer });
        return;
      }
      await startSingle(plan, payer);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyPlan(null);
    }
  }

  async function startSingle(plan: any, payer: { document: string; phone: string }) {
    setBusyPlan(plan.id);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const result = await startClonerCheckout({
        data: {
          planId: plan.id,
          document: payer.document,
          phone: payer.phone,
          ...(ref ? { affiliateCode: ref } : {}),
        },
      });
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
        title: plan.name,
        subtitle: "Licença + ZIP liberados após o PIX",
      });
    } finally {
      setBusyPlan(null);
    }
  }

  async function acceptSmartOffer() {
    if (!smartContext) return;
    const { offer, plan, billing: payer } = smartContext;
    setBusyPlan(plan.id);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const result = await startSmartBundleCheckout({
        data: {
          mainPlanId: offer.main.id,
          companionPlanId: offer.companion.id,
          document: payer.document,
          phone: payer.phone,
          ...(ref ? { affiliateCode: ref } : {}),
        },
      });
      setSmartContext(null);
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
        title: "Combo inteligente MSK",
        subtitle: `${offer.main.name} + ${offer.companion.name} com ${offer.discountPercent}% OFF no adicional`,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyPlan(null);
    }
  }

  async function skipSmartOffer() {
    if (!smartContext) return;
    const context = smartContext;
    setSmartContext(null);
    try {
      await startSingle(context.plan, context.billing);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505]">
      <SiteHeader />
      <main className="relative min-w-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[440px] w-[min(760px,100vw)] -translate-x-1/2 rounded-full bg-primary/10 blur-[150px]" />
        </div>

        <section className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-[9px] font-black uppercase tracking-[.18em] text-primary sm:px-4 sm:text-[10px]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" /> Extensão de clonagem MSK
              </div>
              <h1 className="mt-5 break-words text-4xl font-black uppercase leading-[.92] tracking-tighter sm:text-6xl lg:text-7xl">
                {product?.title ?? "MSK Clonador de Páginas"}
              </h1>
              <p className="mt-4 max-w-2xl break-words text-sm font-medium leading-relaxed text-white/55 sm:text-lg">
                {product?.subtitle ?? "Escolha seu período e libere a ferramenta após o PIX."}
              </p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
              <Button variant="ghost" className="w-full whitespace-normal border border-white/10 lg:w-auto" onClick={share}><Share2 className="mr-2 h-4 w-4 shrink-0" /> Compartilhar</Button>
              <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><FileArchive className="h-4 w-4 shrink-0 text-primary" /> {human(product?.zipSizeBytes)}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Feature icon={<Zap />} title="Liberação automática" text="Gateway confirma o PIX antes da entrega." />
            <Feature icon={<LockKeyhole />} title="ZIP protegido" text="Arquivo privado e link temporário após pagamento." />
            <Feature icon={<Gift />} title="Combo inteligente" text={`A outra extensão pode entrar com ${product?.smartDiscountPercent ?? 10}% OFF.`} />
          </div>

          {!product?.zipReady ? (
            <div className="mt-7 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-300">O Super Admin ainda precisa enviar o ZIP da ferramenta.</div>
          ) : !product?.enabled ? (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm text-white/50">As ofertas estão configuradas, mas o checkout está inativo no momento.</div>
          ) : null}

          <div className="relative mt-10 min-w-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 hidden items-center justify-between lg:flex">
              <button type="button" aria-label="Plano anterior" className="pointer-events-auto -ml-4 grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-black/80 text-primary shadow-xl" onClick={() => move(-1)}><ChevronLeft className="h-6 w-6" /></button>
              <button type="button" aria-label="Próximo plano" className="pointer-events-auto -mr-4 grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-black/80 text-primary shadow-xl" onClick={() => move(1)}><ChevronRight className="h-6 w-6" /></button>
            </div>

            <div
              ref={carouselRef}
              className="flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 lg:px-2"
              onPointerEnter={() => setPaused(true)}
              onPointerLeave={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => window.setTimeout(() => setPaused(false), 2500)}
              onScroll={(e) => {
                const container = e.currentTarget;
                let best = 0;
                let distance = Number.POSITIVE_INFINITY;
                Array.from(container.children).forEach((node, index) => {
                  const el = node as HTMLElement;
                  const d = Math.abs(el.offsetLeft - container.scrollLeft - container.offsetLeft);
                  if (d < distance) { distance = d; best = index; }
                });
                setActiveIndex(best);
              }}
            >
              {plans.map((plan: any, index: number) => (
                <ClonerPlanCard
                  key={plan.id}
                  plan={plan}
                  index={index}
                  discount={product?.smartDiscountPercent ?? 10}
                  smartEnabled={product?.smartOffersEnabled !== false}
                  disabled={!product?.enabled || !plan.active}
                  busy={busyPlan === plan.id}
                  onBuy={() => void beginCheckout(plan)}
                />
              ))}
            </div>

            <div className="mt-2 flex justify-center gap-2">
              {plans.map((plan: any, index: number) => (
                <button key={plan.id} type="button" aria-label={`Ir para ${plan.name}`} className={`h-2 rounded-full transition-all ${activeIndex === index ? "w-7 bg-primary" : "w-2 bg-white/20"}`} onClick={() => { setActiveIndex(index); const container = carouselRef.current; const target = container?.children.item(index) as HTMLElement | null; if (container && target) container.scrollTo({ left: target.offsetLeft - container.offsetLeft, behavior: "smooth" }); }} />
              ))}
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-3xl text-center text-[10px] leading-relaxed text-white/30">As três licenças começam a contar somente na primeira ativação da extensão. O download do ZIP exige uma compra do Clonador com pagamento confirmado.</p>
        </section>
      </main>
      <SiteFooter />

      {showPayer ? (
        <div className="fixed inset-0 z-[100010] flex items-end justify-center overflow-y-auto bg-black/85 p-0 backdrop-blur-xl sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[2rem] border border-white/10 bg-[#0B0B0B] p-5 shadow-2xl sm:rounded-[2rem] sm:p-7">
            <div className="mb-5"><p className="text-[9px] font-black uppercase tracking-[.2em] text-primary">Dados para o PIX</p><h2 className="mt-1 break-words text-xl font-black uppercase">{pendingPlan?.name ?? "Clonador"}</h2></div>
            <PayerForm compact onSaved={(b) => { const plan = pendingPlan; setShowPayer(false); setPendingPlan(null); if (plan) void beginCheckout(plan, b); }} />
            <Button variant="ghost" className="mt-2 w-full" onClick={() => { setShowPayer(false); setPendingPlan(null); }}>Cancelar</Button>
          </div>
        </div>
      ) : null}

      {smartContext ? (
        <SmartOfferModal
          offer={smartContext.offer}
          busy={busyPlan === smartContext.plan.id}
          onAccept={() => void acceptSmartOffer()}
          onSkip={() => void skipSmartOffer()}
          onClose={() => setSmartContext(null)}
        />
      ) : null}

      {pix ? (
        <SmartPixModal
          pix={pix}
          onClose={() => setPix(null)}
          onPaid={() => navigate({ to: "/clonagem-entrega", search: { transactionId: pix.transactionId } })}
          onRegenerate={() => { setPix(null); }}
        />
      ) : null}
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="mb-3 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <p className="break-words text-xs font-black uppercase">{title}</p>
      <p className="mt-1 break-words text-[11px] leading-relaxed text-white/35">{text}</p>
    </div>
  );
}

function ClonerPlanCard({
  plan,
  index,
  discount,
  smartEnabled,
  disabled,
  busy,
  onBuy,
}: {
  plan: any;
  index: number;
  discount: number;
  smartEnabled: boolean;
  disabled: boolean;
  busy: boolean;
  onBuy: () => void;
}) {
  const emphasis = index === 1;
  const monthly = plan.cadence === "monthly";
  return (
    <article className={`relative w-[84vw] max-w-[350px] shrink-0 snap-center overflow-hidden rounded-[2rem] border bg-[#080808] p-[1px] sm:w-[46vw] lg:w-[calc((100%-2.5rem)/3)] lg:max-w-none ${emphasis ? "border-primary/60 shadow-[0_0_50px_rgba(57,255,20,.12)]" : "border-white/10"}`}>
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "linear-gradient(135deg, rgba(217,0,255,.14), transparent 28%, transparent 65%, rgba(57,255,20,.15))" }} />
      <div className="relative flex min-h-[500px] flex-col overflow-hidden rounded-[1.95rem] bg-[#070707] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(57,255,20,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,.10) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.22em] text-primary">MSK Extensão Copy</p><span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-primary">{monthly ? <Star className="h-3 w-3 shrink-0" /> : <Clock3 className="h-3 w-3 shrink-0" />}{plan.badge}</span></div>
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
        </div>

        <div className="relative mt-8">
          <p className="text-2xl font-black uppercase tracking-tight text-white/70">Plano</p>
          <h2 className="mt-1 break-words text-5xl font-black uppercase leading-none tracking-tighter text-primary drop-shadow-[0_0_18px_rgba(57,255,20,.25)] sm:text-6xl">{plan.cadence === "daily" ? "Diário" : plan.cadence === "weekly" ? "Semanal" : "Mensal"}</h2>
          <p className="mt-4 min-h-10 break-words text-sm font-semibold leading-relaxed text-white/45">{plan.tagline}</p>
        </div>

        <div className="relative mt-6 rounded-2xl border border-primary/25 bg-black/45 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">A partir de</p>
          <p className="mt-1 break-words text-4xl font-black text-primary sm:text-5xl">{brl(Number(plan.price), plan.currency)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/35">{plan.durationLabel} · PIX</p>
        </div>

        {smartEnabled ? (
          <div className="relative mt-4 flex min-w-0 items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-3.5">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="min-w-0 break-words text-[10px] leading-relaxed text-white/55">Adicione a <b className="text-white">Extensão Principal</b> do mesmo período com <b className="text-amber-300">{discount}% OFF</b> no item adicional.</p>
          </div>
        ) : null}

        <div className="relative mt-auto pt-6">
          <Button variant="neon" className="min-h-14 w-full whitespace-normal rounded-2xl px-4 text-center text-xs font-black uppercase leading-tight tracking-wider" disabled={disabled || busy} onClick={onBuy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Zap className="mr-2 h-4 w-4 shrink-0" />}
            {busy ? "Preparando..." : disabled ? "Indisponível" : `Comprar ${plan.cadence === "daily" ? "Diário" : plan.cadence === "weekly" ? "Semanal" : "Mensal"}`}
          </Button>
        </div>
      </div>
    </article>
  );
}
