import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gift,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { PayerForm, useBilling } from "@/components/msk/payer-form";
import { PixDialog, type PixState } from "@/components/msk/pix-dialog";
import { SmartOfferModal } from "@/components/msk/smart-offer-modal";
import { SmartPixModal, type SmartPixState } from "@/components/msk/smart-pix-modal";
import { startPixCheckout } from "@/lib/commerce.functions";
import {
  getClonerProduct,
  getSmartOffer,
  startSmartBundleCheckout,
} from "@/lib/cloner.functions";
import { track, saveCartSnapshot } from "@/lib/tracking";
import dailyLicenseAsset from "@/assets/daily_license_card.jpg.asset.json";
import bannerOfferAsset from "@/assets/banner-offer.png.asset.json";
import cardFreeImg from "@/assets/card-free.jpg";
import cardSemanalImg from "@/assets/card-semanal.jpg";
import cardMensalImg from "@/assets/card-mensal.jpg";
import cardTrimestralImg from "@/assets/card-trimestral.jpg";
import {
  readAffiliateRef,
  readResellerRef,
  storeAffiliateRef,
  storeResellerRef,
} from "@/lib/urls";

const PLAN_IMAGES: Record<string, string> = {
  "free-test": cardFreeImg,
  daily: dailyLicenseAsset.url,
  weekly: cardSemanalImg,
  monthly: cardMensalImg,
  quarterly: cardTrimestralImg,
};

function planImage(plan?: any) {
  if (plan?.image_url) return plan.image_url;
  return PLAN_IMAGES[String(plan?.slug ?? "")] || bannerOfferAsset.url;
}

type CartItem = {
  planId: string;
  planName: string;
  price: number;
  quantity: number;
  slug: string;
  imageUrl?: string | null;
};

type BillingValue = { document: string; phone: string };

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos e preços — MSK SISTEM" },
      {
        name: "description",
        content: "Planos da extensão principal MSK com licença automática após o pagamento.",
      },
      { property: "og:title", content: "Planos MSK SISTEM" },
      { property: "og:description", content: "Escolha seu período e aproveite ofertas inteligentes com o Clonador de Páginas." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PlanosPage,
});

function formatPrice(price: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(price);
}

function PlanosPage() {
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [payer, setPayer] = useState<{ planId: string; planName: string; imageUrl?: string | null } | null>(null);
  const [pix, setPix] = useState<PixState | null>(null);
  const [smartPix, setSmartPix] = useState<SmartPixState | null>(null);
  const [smartContext, setSmartContext] = useState<null | {
    offer: any;
    planId: string;
    planName: string;
    imageUrl?: string | null;
    billing: BillingValue;
  }>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pixByPlan, setPixByPlan] = useState<Record<string, { createdAt: string; expiresAt: string; transactionId: string }>>({});
  const { billing, complete } = useBilling();

  const { data: clonerProduct } = useQuery({
    queryKey: ["cloner-product"],
    queryFn: () => getClonerProduct(),
    staleTime: 60_000,
  });

  useEffect(() => {
    saveCartSnapshot(
      cart.length
        ? {
            updatedAt: new Date().toISOString(),
            total: cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
            items: cart.map((item) => ({
              name: item.planName,
              quantity: item.quantity,
              price: item.price,
              imageUrl: item.imageUrl ?? null,
            })),
          }
        : null,
    );
  }, [cart]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const rv = params.get("rv");
    if (ref) storeAffiliateRef(ref);
    if (rv) storeResellerRef(rv);
  }, []);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).filter((plan: any) => !String(plan.slug ?? "").startsWith("page-cloner"));
    },
  });

  function addToCart(plan: any) {
    const isFree = Number(plan.price) === 0;
    if (loadingPlan === plan.id) return;
    track("offer_view", { label: plan.name, value: Number(plan.price) });

    if (isFree) {
      void subscribe(plan.id, plan.name, true, planImage(plan));
      return;
    }

    setCart((current) => {
      if (current.some((item) => item.planId === plan.id)) return current;
      return [
        ...current,
        {
          planId: plan.id,
          planName: plan.name,
          price: Number(plan.price),
          quantity: 1,
          slug: plan.slug,
          imageUrl: planImage(plan),
        },
      ];
    });
    track("add_to_cart", { label: plan.name, value: Number(plan.price) });
    toast.success(`${plan.name} adicionado ao carrinho`);
  }

  function removeFromCart(planId: string) {
    const item = cart.find((row) => row.planId === planId);
    setCart((current) => current.filter((row) => row.planId !== planId));
    setPixByPlan((current) => {
      const next = { ...current };
      delete next[planId];
      return next;
    });
    if (item) track("remove_from_cart", { label: item.planName, value: item.price });
  }

  function updateQuantity(planId: string, delta: number) {
    setCart((current) =>
      current.map((item) =>
        item.planId === planId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  }

  async function payItem(item: CartItem) {
    track("checkout_start", { label: item.planName, value: item.price });
    await subscribe(item.planId, item.planName, false, item.imageUrl);
  }

  async function checkoutCart() {
    if (!cart.length) return;
    if (cart.length === 1) {
      await payItem(cart[0]!);
      return;
    }
    await subscribe("", "Checkout Carrinho", false, null, undefined, true);
  }

  async function subscribe(
    planId: string,
    planName: string,
    isFree = false,
    imageUrl?: string | null,
    billingOverride?: BillingValue,
    skipSmartOffer = false,
  ) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      if (isFree) {
        localStorage.setItem("selected_free_plan", planId);
        localStorage.setItem("msk_open_trial", "1");
        navigate({ to: "/auth", search: { next: "/painel" } });
      } else {
        navigate({ to: "/auth", search: { next: "/planos" } });
      }
      return;
    }

    if (isFree) {
      setLoadingPlan(planId);
      try {
        const { requestTrial } = await import("@/lib/commerce.functions");
        await requestTrial({ data: { planId } });
        toast.success("Teste gratuito liberado.");
        localStorage.setItem("msk_open_trial", "1");
        navigate({ to: "/painel" });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoadingPlan(null);
      }
      return;
    }

    const payerData = billingOverride ?? (complete && billing ? { document: billing.document, phone: billing.phone } : null);
    if (!payerData) {
      setPayer({ planId, planName, imageUrl });
      return;
    }

    if (planId && !skipSmartOffer && clonerProduct?.smartOffersEnabled !== false) {
      setLoadingPlan(planId);
      try {
        const offer = await getSmartOffer({ data: { planId } });
        if (offer.available) {
          setSmartContext({ offer, planId, planName, imageUrl, billing: payerData });
          return;
        }
      } catch {
        // Se a oferta complementar falhar, o checkout principal continua funcionando.
      } finally {
        setLoadingPlan(null);
      }
    }

    await startRegularPix(planId, planName, imageUrl, payerData);
  }

  async function startRegularPix(
    planId: string,
    planName: string,
    imageUrl: string | null | undefined,
    payerData: BillingValue,
  ) {
    setLoadingPlan(planId || "checkout-bulk");
    try {
      const ref = readAffiliateRef() ?? undefined;
      const rv = readResellerRef() ?? undefined;
      const bulkItems = planId ? undefined : cart.map((item) => ({ planId: item.planId, quantity: item.quantity }));
      const result = await startPixCheckout({
        data: {
          planId: planId || undefined,
          ...(bulkItems?.length ? { items: bulkItems } : {}),
          ...(ref ? { affiliateCode: ref } : {}),
          ...(rv ? { resellerCode: rv } : {}),
          document: payerData.document,
          phone: payerData.phone,
        },
      });
      setPayer(null);
      if (result.checkoutUrl && !result.pixCode) {
        window.location.href = result.checkoutUrl;
        return;
      }
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 2 * 60_000).toISOString();
      const key = planId || "checkout-bulk";
      setPixByPlan((current) => ({ ...current, [key]: { createdAt, expiresAt, transactionId: result.transactionId } }));
      track("pix_generated", { label: planName, value: result.amount });
      setPix({
        transactionId: result.transactionId,
        pixCode: result.pixCode,
        qrCode: result.qrCode,
        amount: result.amount,
        status: "PENDING",
        expiresAt,
        planName,
        imageUrl: imageUrl ?? null,
        createdAt,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingPlan(null);
    }
  }

  async function acceptSmartOffer() {
    if (!smartContext) return;
    const context = smartContext;
    setLoadingPlan(context.planId);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const rv = readResellerRef() ?? undefined;
      const result = await startSmartBundleCheckout({
        data: {
          mainPlanId: context.offer.main.id,
          companionPlanId: context.offer.companion.id,
          document: context.billing.document,
          phone: context.billing.phone,
          ...(ref ? { affiliateCode: ref } : {}),
          ...(rv ? { resellerCode: rv } : {}),
        },
      });
      setSmartContext(null);
      if (result.checkoutUrl && !result.pixCode) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setSmartPix({
        transactionId: result.transactionId,
        pixCode: result.pixCode,
        qrCode: result.qrCode,
        amount: result.amount,
        expiresAt: new Date(Date.now() + 2 * 60_000).toISOString(),
        title: "Combo inteligente MSK",
        subtitle: `${context.offer.main.name} + ${context.offer.companion.name} com ${context.offer.discountPercent}% OFF no adicional`,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingPlan(null);
    }
  }

  async function skipSmartOffer() {
    if (!smartContext) return;
    const context = smartContext;
    setSmartContext(null);
    await startRegularPix(context.planId, context.planName, context.imageUrl, context.billing);
  }

  useEffect(() => {
    const freePlanId = localStorage.getItem("selected_free_plan");
    if (freePlanId && plans && !isLoading) {
      localStorage.removeItem("selected_free_plan");
      const plan = plans.find((row: any) => row.id === freePlanId);
      if (plan) void subscribe(plan.id, plan.name, Number(plan.price) === 0, planImage(plan));
    }
  }, [plans, isLoading]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl min-w-0 px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <header className="flex min-w-0 flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="break-words text-4xl font-black uppercase tracking-tighter sm:text-7xl">Nossos <span className="neon-text">Planos</span></h1>
            <p className="mt-4 break-words text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground sm:text-sm sm:tracking-[.3em]">Extensão principal · PIX · licença automática</p>
            {clonerProduct?.smartOffersEnabled ? (
              <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary"><Gift className="h-3.5 w-3.5 shrink-0" /> Combine com o Clonador e ganhe {clonerProduct.smartDiscountPercent}% OFF no adicional</div>
            ) : null}
          </div>

          {cart.length > 0 ? (
            <div className="w-full min-w-0 overflow-hidden rounded-[1.5rem] border border-primary/20 bg-[#0F0F0F] shadow-2xl lg:max-w-[440px]">
              <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-4 py-2"><ShoppingCart className="h-3.5 w-3.5 text-primary" /><span className="text-[9px] font-black uppercase tracking-widest text-primary">Seu carrinho</span></div>
              <div className="max-h-[55vh] space-y-3 overflow-y-auto p-4 sm:p-5">
                {cart.map((item) => (
                  <CartRow key={item.planId} item={item} pix={pixByPlan[item.planId] ?? null} busy={loadingPlan === item.planId} onQty={(d) => updateQuantity(item.planId, d)} onRemove={() => removeFromCart(item.planId)} onPay={() => void payItem(item)} />
                ))}
              </div>
              <div className="border-t border-white/5 p-4 sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</span><span className="text-2xl font-black text-primary">{formatPrice(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))}</span></div>
                <Button variant="neon" className="mt-4 min-h-14 w-full whitespace-normal rounded-2xl text-xs font-black uppercase" onClick={() => void checkoutCart()} disabled={loadingPlan !== null}>{loadingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Finalizar pedido</Button>
              </div>
            </div>
          ) : null}
        </header>

        {isLoading ? (
          <div className="mt-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="relative mt-10 min-w-0 overflow-hidden sm:mt-12">
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 hidden items-center justify-between lg:flex">
              <button aria-label="Ofertas anteriores" className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-primary/30 bg-black/80 text-primary" onClick={() => document.getElementById("plans-carousel")?.scrollBy({ left: -360, behavior: "smooth" })}><ChevronLeft className="h-6 w-6" /></button>
              <button aria-label="Próximas ofertas" className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-primary/30 bg-black/80 text-primary" onClick={() => document.getElementById("plans-carousel")?.scrollBy({ left: 360, behavior: "smooth" })}><ChevronRight className="h-6 w-6" /></button>
            </div>

            <div id="plans-carousel" className="flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:px-8">
              {(plans ?? []).map((plan: any) => {
                const highlighted = plan.slug === "monthly";
                const isFree = Number(plan.price) === 0;
                const cadenceSmart = ["daily", "weekly", "monthly"].includes(String(plan.slug));
                return (
                  <article key={plan.id} className={`relative flex w-[82vw] max-w-[330px] shrink-0 snap-center flex-col overflow-hidden rounded-[2rem] border bg-[#0A0A0A] sm:w-[45vw] lg:w-[310px] ${highlighted ? "border-primary/60 shadow-[0_0_60px_rgba(57,255,20,.12)]" : "border-white/10"}`}>
                    <div className="relative h-48 w-full overflow-hidden sm:h-56"><img src={planImage(plan)} alt={plan.name} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" /><span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[8px] font-black uppercase text-black">{highlighted ? "Mais popular" : isFree ? "Teste" : "Oferta"}</span></div>
                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <p className="break-words text-[10px] font-black uppercase tracking-[.18em] text-primary">{plan.name}</p>
                      <div className="mt-3 flex flex-wrap items-baseline gap-2"><span className="text-3xl font-black text-white">{formatPrice(Number(plan.price), plan.currency)}</span>{!plan.is_lifetime ? <span className="text-[10px] font-bold uppercase text-muted-foreground">/{plan.duration_label}</span> : null}</div>
                      <ul className="mt-5 flex-1 space-y-2.5">{(plan.highlights ?? []).map((h: string) => <li key={h} className="flex min-w-0 items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><span className="mt-0.5 rounded-full bg-primary p-0.5 text-black"><Check className="h-2.5 w-2.5" /></span><span className="min-w-0 break-words">{h}</span></li>)}</ul>
                      {cadenceSmart && clonerProduct?.smartOffersEnabled ? <div className="mt-4 flex min-w-0 items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-[9px] leading-relaxed text-white/55"><Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" /><span className="min-w-0 break-words">Clonador do mesmo período com <b className="text-amber-300">{clonerProduct.smartDiscountPercent}% OFF</b> quando disponível.</span></div> : null}
                      <Button className="mt-5 min-h-14 w-full whitespace-normal rounded-2xl bg-[#22C55E] px-4 text-center text-xs font-black uppercase leading-tight text-white hover:bg-[#28D56A]" disabled={loadingPlan === plan.id} onClick={() => addToCart(plan)}>{loadingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isFree ? "Testar grátis" : "Adicionar ao carrinho"}</Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />

      {payer && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100010] flex items-end justify-center overflow-y-auto bg-black/85 p-0 backdrop-blur-xl sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[2rem] border border-white/10 bg-[#0B0B0B] p-5 shadow-2xl sm:rounded-[2rem] sm:p-7">
            <div className="mb-5 flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-primary">Dados para o PIX</p><h2 className="mt-1 break-words text-xl font-black uppercase">{payer.planName}</h2></div><button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10" onClick={() => setPayer(null)}><X className="h-4 w-4" /></button></div>
            <PayerForm compact onSaved={(b) => { const current = payer; setPayer(null); if (current) void subscribe(current.planId, current.planName, false, current.imageUrl, b); }} />
          </div>
        </div>,
        document.body,
      ) : null}

      {smartContext ? <SmartOfferModal offer={smartContext.offer} busy={loadingPlan === smartContext.planId} onAccept={() => void acceptSmartOffer()} onSkip={() => void skipSmartOffer()} onClose={() => setSmartContext(null)} /> : null}

      {pix ? <PixDialog pix={pix} regenerating={loadingPlan !== null} onClose={() => setPix(null)} onPaid={() => { track("purchase", { label: pix.planName ?? "Plano", value: pix.amount }); setCart([]); setPixByPlan({}); setPix(null); navigate({ to: "/painel" }); }} onRegenerate={() => { const plan = plans?.find((row: any) => row.name === pix.planName); if (plan) void subscribe(plan.id, plan.name, false, planImage(plan), undefined, true); }} /> : null}

      {smartPix ? <SmartPixModal pix={smartPix} onClose={() => setSmartPix(null)} onPaid={() => navigate({ to: "/clonagem-entrega", search: { transactionId: smartPix.transactionId } })} onRegenerate={() => setSmartPix(null)} /> : null}
    </div>
  );
}

function CartRow({ item, pix, busy, onQty, onRemove, onPay }: {
  item: CartItem;
  pix: { createdAt: string; expiresAt: string; transactionId: string } | null;
  busy: boolean;
  onQty: (delta: number) => void;
  onRemove: () => void;
  onPay: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pix) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pix]);
  const left = pix ? Math.max(0, new Date(pix.expiresAt).getTime() - now) : 0;
  const expired = !!pix && left <= 0;
  const label = `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3.5">
      <div className="flex min-w-0 gap-3">
        {item.imageUrl ? <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10"><img src={item.imageUrl} alt={item.planName} className="h-full w-full object-cover" /></div> : null}
        <div className="min-w-0 flex-1"><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-black uppercase">{item.planName}</p><p className="mt-1 text-sm font-black text-primary">{formatPrice(item.price * item.quantity)}</p></div><button type="button" className="shrink-0 p-1.5 text-muted-foreground hover:text-red-400" onClick={onRemove}><Trash2 className="h-4 w-4" /></button></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center rounded-lg border border-white/10 bg-black/30 p-1"><button onClick={() => onQty(-1)} disabled={item.quantity <= 1} className="p-1 disabled:opacity-30"><Minus className="h-3 w-3" /></button><span className="w-7 text-center text-[10px] font-black">{item.quantity}</span><button onClick={() => onQty(1)} className="p-1"><Plus className="h-3 w-3" /></button></div>{pix ? <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${expired ? "bg-red-500/15 text-red-400" : "bg-amber-400/15 text-amber-300"}`}>{expired ? "Expirado" : label}</span> : null}</div>
        </div>
      </div>
      <Button size="sm" variant="neonOutline" className="mt-3 w-full whitespace-normal" disabled={busy} onClick={onPay}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : pix && expired ? <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Novo PIX</> : pix ? "Continuar pagamento" : "Gerar PIX deste item"}</Button>
    </div>
  );
}
