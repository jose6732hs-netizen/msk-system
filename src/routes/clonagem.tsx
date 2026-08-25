import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  FileArchive,
  Gift,
  Loader2,
  LockKeyhole,
  Share2,
  ShoppingCart,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { PayerForm, useBilling } from "@/components/msk/payer-form";
import { SmartOfferCard, smartOfferImage } from "@/components/msk/smart-offer-card";
import { SmartPixModal, type SmartPixState } from "@/components/msk/smart-pix-modal";
import { supabase } from "@/integrations/supabase/client";
import {
  getClonerProduct,
  getSmartOffer,
  startClonerCheckout,
  startSmartBundleCheckout,
  trackClonerPublic,
} from "@/lib/cloner.functions";
import { saveCartSnapshot, track } from "@/lib/tracking";
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

function clonerImage(plan?: any) {
  if (plan?.imageUrl || plan?.image_url) return plan.imageUrl || plan.image_url;
  const slug = String(plan?.slug ?? "");
  if (slug.endsWith("daily")) return "/cloner-offers/cloner-daily.webp";
  if (slug.endsWith("weekly")) return "/cloner-offers/cloner-weekly.webp";
  return "/cloner-offers/cloner-monthly.webp";
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
  const [checkoutPlan, setCheckoutPlan] = useState<any | null>(null);
  const [checkoutOffer, setCheckoutOffer] = useState<any | null>(null);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [offerLoading, setOfferLoading] = useState(false);
  const [pix, setPix] = useState<SmartPixState | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ["cloner-product"],
    queryFn: () => getClonerProduct(),
    staleTime: 30_000,
  });
  const plans = product?.plans ?? [];
  const offerEligible = !!checkoutOffer?.available && checkoutOffer.main?.id === checkoutPlan?.id;
  const total = Number(checkoutPlan?.price ?? 0) + (offerEligible && offerAccepted ? Number(checkoutOffer.companion?.discountedPrice ?? 0) : 0);
  const count = checkoutPlan ? 1 + (offerEligible && offerAccepted ? 1 : 0) : 0;

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

  useEffect(() => {
    if (!checkoutPlan) {
      saveCartSnapshot(null);
      return;
    }
    const items = [{
      name: checkoutPlan.name,
      quantity: 1,
      price: Number(checkoutPlan.price ?? 0),
      imageUrl: clonerImage(checkoutPlan),
    }];
    if (offerEligible && offerAccepted) {
      items.push({
        name: checkoutOffer.companion.name,
        quantity: 1,
        price: Number(checkoutOffer.companion.discountedPrice ?? 0),
        imageUrl: smartOfferImage(checkoutOffer.companion),
      });
    }
    saveCartSnapshot({ updatedAt: new Date().toISOString(), total, items });
  }, [checkoutPlan, checkoutOffer, offerAccepted, offerEligible, total]);

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

  async function selectPlan(plan: any) {
    setCheckoutPlan(plan);
    setCheckoutOffer(null);
    setOfferAccepted(false);
    track("add_to_cart", { label: plan.name, value: Number(plan.price) });
    toast.success(`${plan.name} adicionado ao pedido`);
    window.setTimeout(() => document.getElementById("cloner-checkout")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);

    const { data } = await supabase.auth.getSession();
    if (!data.session || product?.smartOffersEnabled === false) return;
    setOfferLoading(true);
    try {
      const offer = await getSmartOffer({ data: { planId: plan.id } });
      setCheckoutOffer(offer?.available ? offer : null);
    } catch {
      setCheckoutOffer(null);
    } finally {
      setOfferLoading(false);
    }
  }

  async function beginCheckout(plan: any, billingOverride?: { document: string; phone: string }) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      localStorage.setItem("msk_cloner_selected_plan", String(plan.id));
      navigate({ to: "/auth", search: { next: "/clonagem" } });
      return;
    }

    const payer = billingOverride ?? (complete && billing ? { document: billing.document, phone: billing.phone } : null);
    if (!payer) {
      setPendingPlan(plan);
      setShowPayer(true);
      return;
    }

    if (offerEligible && offerAccepted) {
      await startBundle(plan, payer);
      return;
    }
    await startSingle(plan, payer);
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
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyPlan(null);
    }
  }

  async function startBundle(plan: any, payer: { document: string; phone: string }) {
    if (!checkoutOffer?.available) return startSingle(plan, payer);
    setBusyPlan(plan.id);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const result = await startSmartBundleCheckout({
        data: {
          mainPlanId: checkoutOffer.main.id,
          companionPlanId: checkoutOffer.companion.id,
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
        title: `${checkoutOffer.main.name} + ${checkoutOffer.companion.name}`,
        subtitle: `${checkoutOffer.companion.name} com ${checkoutOffer.discountPercent}% OFF no item adicional`,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyPlan(null);
    }
  }

  useEffect(() => {
    if (!plans.length) return;
    const stored = localStorage.getItem("msk_cloner_selected_plan");
    if (!stored) return;
    localStorage.removeItem("msk_cloner_selected_plan");
    const plan = plans.find((item: any) => item.id === stored);
    if (plan) void selectPlan(plan);
  }, [plans.length]);

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
            <Feature icon={<Gift />} title="Oferta no checkout" text="Depois de escolher o plano, a melhor combinação aparece no resumo do pedido." />
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
                  disabled={!product?.enabled || !plan.active}
                  selected={checkoutPlan?.id === plan.id}
                  busy={busyPlan === plan.id}
                  onBuy={() => void selectPlan(plan)}
                />
              ))}
            </div>

            <div className="mt-2 flex justify-center gap-2">
              {plans.map((plan: any, index: number) => (
                <button key={plan.id} type="button" aria-label={`Ir para ${plan.name}`} className={`h-2 rounded-full transition-all ${activeIndex === index ? "w-7 bg-primary" : "w-2 bg-white/20"}`} onClick={() => { setActiveIndex(index); const container = carouselRef.current; const target = container?.children.item(index) as HTMLElement | null; if (container && target) container.scrollTo({ left: target.offsetLeft - container.offsetLeft, behavior: "smooth" }); }} />
              ))}
            </div>
          </div>

          {checkoutPlan ? (
            <section id="cloner-checkout" className="mx-auto mt-10 w-full max-w-2xl scroll-mt-24 overflow-hidden rounded-[2rem] border border-primary/20 bg-[#0D0D0D] shadow-2xl">
              <div className="flex min-w-0 items-center justify-between gap-3 border-b border-primary/15 bg-primary/[.07] px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-2"><ShoppingCart className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-[10px] font-black uppercase tracking-widest text-primary">Checkout · seu pedido</span></div>
                <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[9px] font-black text-black">{count} {count === 1 ? "produto" : "produtos"}</span>
              </div>

              <div className="space-y-3 p-4 sm:p-5">
                <article className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-black/25 p-3.5 sm:gap-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black sm:h-28 sm:w-28"><img src={clonerImage(checkoutPlan)} alt={checkoutPlan.name} className="h-full w-full object-cover" /></div>
                  <div className="min-w-0 flex-1"><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-primary">{checkoutPlan.durationLabel}</p><h2 className="mt-1 break-words text-base font-black uppercase leading-tight">{checkoutPlan.name}</h2><p className="mt-2 text-2xl font-black text-primary">{brl(Number(checkoutPlan.price), checkoutPlan.currency)}</p></div><button type="button" aria-label="Remover do pedido" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-muted-foreground hover:text-red-400" onClick={() => { setCheckoutPlan(null); setCheckoutOffer(null); setOfferAccepted(false); }}><Trash2 className="h-4 w-4" /></button></div></div>
                </article>

                {offerLoading ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.025] p-5 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Buscando a melhor combinação...</div> : null}

                {offerEligible ? (
                  <SmartOfferCard
                    offer={checkoutOffer}
                    accepted={offerAccepted}
                    busy={busyPlan !== null}
                    onAdd={() => {
                      setOfferAccepted(true);
                      track("add_to_cart", { label: checkoutOffer.companion.name, value: checkoutOffer.companion.discountedPrice });
                      toast.success(`${checkoutOffer.companion.name} adicionado com ${checkoutOffer.discountPercent}% OFF`);
                    }}
                    onRemove={() => setOfferAccepted(false)}
                  />
                ) : null}
              </div>

              <div className="border-t border-white/5 bg-black/20 p-4 sm:p-5">
                {offerEligible && offerAccepted ? <div className="mb-3 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[.04] px-3 py-2 text-[10px]"><span className="min-w-0 break-words text-muted-foreground">Desconto em {checkoutOffer.companion.name}</span><span className="shrink-0 font-black text-emerald-400">-{brl(Number(checkoutOffer.savings))}</span></div> : null}
                <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total do pedido</p><p className="mt-1 text-[10px] text-muted-foreground">PIX · licença(s) + ZIP após pagamento</p></div><p className="text-3xl font-black text-primary">{brl(total, checkoutPlan.currency)}</p></div>
                <Button variant="neon" className="mt-4 min-h-14 w-full rounded-2xl text-xs font-black uppercase" disabled={busyPlan !== null || !product?.enabled} onClick={() => void beginCheckout(checkoutPlan)}>{busyPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />} Gerar PIX do pedido</Button>
              </div>
            </section>
          ) : null}

          <p className="mx-auto mt-8 max-w-3xl text-center text-[10px] leading-relaxed text-white/30">As três licenças começam a contar somente na primeira ativação da extensão. O download do ZIP exige uma compra do Clonador com pagamento confirmado.</p>
        </section>
      </main>
      <SiteFooter />

      {showPayer ? (
        <div className="fixed inset-0 z-[100010] flex items-end justify-center overflow-y-auto bg-black/85 p-0 backdrop-blur-xl sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[2rem] border border-white/10 bg-[#0B0B0B] p-5 shadow-2xl sm:rounded-[2rem] sm:p-7">
            <div className="mb-5"><p className="text-[9px] font-black uppercase tracking-[.2em] text-primary">Dados para o PIX</p><h2 className="mt-1 break-words text-xl font-black uppercase">{offerEligible && offerAccepted ? `${pendingPlan?.name} + ${checkoutOffer.companion.name}` : pendingPlan?.name ?? "Clonador"}</h2></div>
            <PayerForm compact onSaved={(b) => { const plan = pendingPlan; setShowPayer(false); setPendingPlan(null); if (plan) void beginCheckout(plan, b); }} />
            <Button variant="ghost" className="mt-2 w-full" onClick={() => { setShowPayer(false); setPendingPlan(null); }}>Cancelar</Button>
          </div>
        </div>
      ) : null}

      {pix ? (
        <SmartPixModal
          pix={pix}
          onClose={() => setPix(null)}
          onPaid={() => {
            const transactionId = pix.transactionId;
            setCheckoutPlan(null);
            setCheckoutOffer(null);
            setOfferAccepted(false);
            navigate({ to: "/clonagem-entrega", search: { transactionId } });
          }}
          onRegenerate={() => setPix(null)}
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

function ClonerPlanCard({ plan, index, disabled, selected, busy, onBuy }: {
  plan: any;
  index: number;
  disabled: boolean;
  selected: boolean;
  busy: boolean;
  onBuy: () => void;
}) {
  const emphasis = index === 1;
  return (
    <article className={`relative w-[84vw] max-w-[360px] shrink-0 snap-center overflow-hidden rounded-[2rem] border bg-[#080808] p-[1px] sm:w-[46vw] lg:w-[calc((100%-2.5rem)/3)] lg:max-w-none ${selected ? "border-primary shadow-[0_0_55px_rgba(57,255,20,.2)]" : emphasis ? "border-primary/60 shadow-[0_0_50px_rgba(57,255,20,.12)]" : "border-white/10"}`}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[1.95rem] bg-[#070707]">
        <div className="aspect-square w-full overflow-hidden bg-black"><img src={clonerImage(plan)} alt={plan.name} className="h-full w-full object-cover" /></div>
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.18em] text-primary">{plan.badge}</p><h2 className="mt-1 break-words text-base font-black uppercase">{plan.name}</h2></div><span className="shrink-0 text-lg font-black text-primary">{brl(Number(plan.price), plan.currency)}</span></div>
          <Button variant="neon" className="mt-4 min-h-12 w-full whitespace-normal rounded-xl px-4 text-center text-xs font-black uppercase" disabled={disabled || busy} onClick={onBuy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}{selected ? "No pedido" : disabled ? "Indisponível" : "Adicionar ao pedido"}</Button>
        </div>
      </div>
    </article>
  );
}
