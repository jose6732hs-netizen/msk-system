import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, X, ShoppingCart, Trash2, Plus, Minus, CreditCard, RefreshCw, Timer, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { PayerForm, useBilling } from "@/components/msk/payer-form";
import { PixDialog, type PixState } from "@/components/msk/pix-dialog";
import { startPixCheckout } from "@/lib/commerce.functions";
import { track, saveCartSnapshot } from "@/lib/tracking";
import dailyLicenseAsset from "@/assets/daily_license_card.jpg.asset.json";
import bannerOfferAsset from "@/assets/banner-offer.png.asset.json";
import cardFreeImg from "@/assets/card-free.jpg";
import cardSemanalImg from "@/assets/card-semanal.jpg";
import cardMensalImg from "@/assets/card-mensal.jpg";
import cardTrimestralImg from "@/assets/card-trimestral.jpg";

const PLAN_IMAGES: Record<string, string> = {
  "free-test": cardFreeImg,
  daily: dailyLicenseAsset.url,
  weekly: cardSemanalImg,
  monthly: cardMensalImg,
  quarterly: cardTrimestralImg,
};

function planImage(slug?: string | null) {
  return (slug && PLAN_IMAGES[slug]) || bannerOfferAsset.url;
}
import {
  readAffiliateRef,
  readResellerRef,
  storeAffiliateRef,
  storeResellerRef,
} from "@/lib/urls";


type CartItem = {
  planId: string;
  planName: string;
  price: number;
  quantity: number;
  slug: string;
  imageUrl?: string | null;
};

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos e preços — MSK SISTEM" },
      {
        name: "description",
        content:
          "Planos diário, mensal, anual e vitalício da extensão MSK SISTEM, com licença liberada automaticamente após o pagamento.",
      },
      { property: "og:title", content: "Planos MSK SISTEM" },
      {
        property: "og:description",
        content: "Escolha entre acesso diário, mensal, anual ou vitalício.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanosPage,
});

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(price);
}

function PlanosPage() {
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [payer, setPayer] = useState<{ planId: string; planName: string } | null>(null);
  const [pix, setPix] = useState<PixState | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pixByPlan, setPixByPlan] = useState<
    Record<string, { createdAt: string; expiresAt: string; transactionId: string }>
  >({});
  const { billing, complete } = useBilling();

  // Snapshot do carrinho para o relatório de carrinhos abandonados no admin.
  useEffect(() => {
    saveCartSnapshot(
      cart.length
        ? {
            updatedAt: new Date().toISOString(),
            total: cart.reduce((acc, i) => acc + i.price * i.quantity, 0),
            items: cart.map((i) => ({
              name: i.planName,
              quantity: i.quantity,
              price: i.price,
              imageUrl: i.imageUrl ?? null,
            })),
          }
        : null,
    );
  }, [cart]);


  // Códigos de indicação (?ref=AFxxxx / ?rv=RVxxxx) persistem durante a sessão.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const rv = params.get("rv");
    if (ref) storeAffiliateRef(ref);
    if (rv) storeResellerRef(rv);
  }, []);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  function addToCart(plan: any) {
    const isFree = Number(plan.price) === 0;
    track("offer_view", { label: plan.name, value: Number(plan.price) });
    if (isFree) {
      void subscribe(plan.id, plan.name, true);
      return;
    }

    setCart(current => {
      const existing = current.find(item => item.planId === plan.id);
      if (existing) {
        return current.map(item => 
          item.planId === plan.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      
      let imageUrl: string | null = planImage(plan.slug);

      return [...current, { 
        planId: plan.id, 
        planName: plan.name, 
        price: Number(plan.price), 
        quantity: 1,
        slug: plan.slug,
        imageUrl
      }];
    });
    track("add_to_cart", { label: plan.name, value: Number(plan.price) });
    toast.success(`${plan.name} adicionado ao carrinho`);
  }

  function removeFromCart(planId: string) {
    const item = cart.find((i) => i.planId === planId);
    setCart(current => current.filter(item => item.planId !== planId));
    setPixByPlan((c) => {
      const next = { ...c };
      delete next[planId];
      return next;
    });
    if (item) track("remove_from_cart", { label: item.planName, value: item.price });
    toast.info("Item removido do carrinho");
  }

  function updateQuantity(planId: string, delta: number) {
    setCart(current => current.map(item => {
      if (item.planId === planId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  }

  async function payItem(item: CartItem) {
    track("checkout_start", { label: item.planName, value: item.price });
    await subscribe(item.planId, item.planName, false, item.imageUrl);
  }

  async function checkout() {
    const item = cart[0];
    if (!item) return;
    await payItem(item);
  }



  async function subscribe(planId: string, planName: string, isFree: boolean = false, imageUrl?: string | null) {
    const { data: session } = await supabase.auth.getSession();
    
    if (isFree && !session.session) {
      localStorage.setItem("selected_free_plan", planId);
      navigate({ to: "/auth", search: { next: "/planos" } });
      return;
    }

    if (!session.session) {
      navigate({ to: "/auth", search: { next: "/planos" } });
      return;
    }

    if (isFree) {
      setLoadingPlan(planId);
      try {
        const { requestTrial } = await import("@/lib/commerce.functions");
        await requestTrial({ data: { planId } });
        toast.success("Teste gratuito ativado com sucesso!");
        navigate({ to: "/painel" });
        return;
      } catch (e) {
        toast.error((e as Error).message);
        return;
      } finally {
        setLoadingPlan(null);
      }
    }

    if (!complete || !billing) {
      setPayer({ planId, planName });
      return;
    }
    setLoadingPlan(planId);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const rv = readResellerRef() ?? undefined;
      const result = await startPixCheckout({
        data: {
          planId,
          ...(ref ? { affiliateCode: ref } : {}),
          ...(rv ? { resellerCode: rv } : {}),
          document: billing.document,
          phone: billing.phone,
        },
      });
      setPayer(null);
      if (result.checkoutUrl && !result.pixCode) {
        window.location.href = result.checkoutUrl;
        return;
      }
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      setPixByPlan((c) => ({ ...c, [planId]: { createdAt, expiresAt, transactionId: result.transactionId } }));
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

  useEffect(() => {
    const freePlanId = localStorage.getItem("selected_free_plan");
    if (freePlanId && plans && !isLoading) {
      localStorage.removeItem("selected_free_plan");
      const plan = plans.find(p => p.id === freePlanId);
      if (plan) subscribe(plan.id, plan.name, plan.price === 0);
    }
  }, [plans, isLoading]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-12 sm:py-16">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black tracking-tighter uppercase sm:text-7xl">
              Nossos <span className="neon-text">Planos</span>
            </h1>
            <p className="mt-4 text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Liberação instantânea via PIX • Sem espera
            </p>
          </div>

          {cart.length > 0 && (
            <div className="glass p-0 rounded-[2.5rem] border border-white/10 w-full lg:min-w-[420px] lg:w-auto animate-in fade-in slide-in-from-top-4 lg:slide-in-from-right-4 shadow-2xl overflow-hidden bg-[#0F0F0F]">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/5">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-foreground">Seu Carrinho</h3>
                  <p className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
                    Itens salvos na sua conta
                  </p>
                </div>
                <button
                  onClick={() => setCart([])}
                  className="p-2 rounded-xl border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
                  aria-label="Limpar carrinho"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
                  {cart.map((item) => (
                    <CartRow
                      key={item.planId}
                      item={item}
                      pix={pixByPlan[item.planId] ?? null}
                      busy={loadingPlan === item.planId}
                      onQty={(d) => updateQuantity(item.planId, d)}
                      onRemove={() => removeFromCart(item.planId)}
                      onPay={() => void payItem(item)}
                      onResume={() => {
                        const state = pixByPlan[item.planId];
                        if (!state) return;
                        void payItem(item);
                      }}
                    />
                  ))}
                </div>

                <div className="space-y-3 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Subtotal</span>
                    <span className="text-sm font-bold text-muted-foreground">
                      {formatPrice(cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), "BRL")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.7rem] font-black uppercase tracking-widest text-white">Total Final</span>
                    <span className="text-2xl font-black text-primary drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]">
                      {formatPrice(cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), "BRL")}
                    </span>
                  </div>
                  
                  <Button 
                    variant="neon" 
                    className="w-full h-14 text-[0.7rem] sm:text-[0.75rem] font-black uppercase tracking-[0.1em] sm:tracking-[0.25em] mt-6 shadow-xl shadow-primary/20 rounded-2xl flex items-center justify-center whitespace-normal leading-tight px-4"
                    onClick={() => checkout()}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar Pedido"}
                  </Button>

                </div>
              </div>
            </div>
          )}
        </header>


        {isLoading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="relative mt-8 sm:mt-12 group w-full overflow-hidden">
            {/* Carousel Controls */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-4 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                className="p-3 rounded-full bg-black/60 border border-white/10 text-white backdrop-blur-md pointer-events-auto hover:bg-primary/20 hover:border-primary/50 transition-all"
                onClick={(e) => {
                  const container = document.getElementById('plans-carousel');
                  if (container) container.scrollBy({ left: -350, behavior: 'smooth' });
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button 
                className="p-3 rounded-full bg-black/60 border border-white/10 text-white backdrop-blur-md pointer-events-auto hover:bg-primary/20 hover:border-primary/50 transition-all"
                onClick={(e) => {
                  const container = document.getElementById('plans-carousel');
                  if (container) container.scrollBy({ left: 350, behavior: 'smooth' });
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            <div 
              id="plans-carousel"
              className="flex gap-5 sm:gap-10 pb-10 sm:pb-16 animate-carousel-loop hover:pause-animation overflow-x-auto custom-scrollbar-hidden scroll-smooth snap-x snap-mandatory px-4 sm:px-10 touch-pan-x scroll-p-4 sm:scroll-p-10"
            >
              {/* Dobramos os planos para o loop infinito */}

              {[...(plans || []), ...(plans || [])].map((plan, idx) => {
                const highlighted = plan.slug === "monthly";
                const isFree = Number(plan.price) === 0;
                const isDaily = plan.slug === "daily";
                
                return (
                  <article
                    key={`${plan.id}-${idx}`}
                    onClick={() => addToCart(plan)}
                    className={`relative flex flex-col min-w-[280px] w-[280px] sm:min-w-[320px] sm:w-[320px] shrink-0 snap-center rounded-[2rem] sm:rounded-[3rem] overflow-hidden transition-all duration-500 cursor-pointer hover:shadow-[0_40px_80px_-20px_rgba(var(--primary-rgb),0.4)] sm:hover:translate-y-[-12px] ${

                      highlighted 
                        ? "bg-[#0A0A0A] border-2 border-primary shadow-[0_0_80px_-15px_rgba(var(--primary-rgb),0.5)] sm:scale-105 z-10" 
                        : "bg-[#0A0A0A] border border-white/10 hover:border-primary/50"
                    }`}
                  >
                    <div className="relative h-52 w-full overflow-hidden p-3 pb-0">
                      <img 
                        src={planImage(plan.slug)} 
                        alt={plan.name} 
                        className="w-full h-full object-contain rounded-[2rem] transition-transform duration-700 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent pointer-events-none" />
                      <div className="absolute top-6 right-6 bg-primary text-black font-black text-[0.6rem] uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                        {isDaily ? "Oferta Flash" : highlighted ? "Mais Popular" : "Oferta Premium"}
                      </div>
                    </div>

                    <div className="p-8 flex flex-col flex-1">
                      <div className="mb-6">
                        <h2 className={`text-xs font-black uppercase tracking-[0.2em] ${highlighted ? "text-primary" : "text-muted-foreground"}`}>
                          {plan.name}
                        </h2>
                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-4xl font-black tracking-tighter text-white">
                            {formatPrice(Number(plan.price), plan.currency)}
                          </span>
                          {!plan.is_lifetime && (
                            <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                              /{plan.duration_label}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-4 mb-8">
                        <ul className="space-y-3 text-[0.75rem]">
                          {(plan.highlights ?? []).map((h: string) => (
                            <li key={h} className="flex items-start gap-3 group">
                              <div className={`mt-0.5 rounded-full p-0.5 ${highlighted ? "bg-primary text-black" : "bg-white/5 text-muted-foreground"}`}>
                                <Check className="h-2.5 w-2.5" />
                              </div>
                              <span className="text-muted-foreground group-hover:text-white transition-colors">{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Button
                        variant={highlighted ? "neon" : "neonOutline"}
                        className={`w-full h-14 text-[0.8rem] font-black uppercase tracking-[0.25em] rounded-2xl transition-all duration-500 ${
                          highlighted ? "shadow-2xl shadow-primary/40 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]" : "hover:bg-primary/10"
                        }`}
                        disabled={loadingPlan === plan.id}
                        onClick={() => addToCart(plan)}
                      >
                        {loadingPlan === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          isFree ? "Testar Grátis" : "Adicionar ao Carrinho"
                        )}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-12 text-xs text-muted-foreground">
          Os valores são definidos pelo administrador no painel e podem ser alterados a
          qualquer momento. Preços existem somente aqui no site — nunca dentro da extensão.
        </p>
      </main>
      <SiteFooter />
      {payer && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100001] flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-background/90 p-5 backdrop-blur-md">
            <div className="glass my-auto w-full max-w-md rounded-[2.5rem] border border-primary/20 p-6 sm:p-8 animate-in fade-in zoom-in duration-300">
              <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/20 text-primary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black uppercase tracking-widest text-foreground sm:text-xl">
                      Dados de Faturamento
                    </h2>
                    <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
                      Exigidos pelo provedor para emitir o PIX.
                    </p>
                  </div>
                </div>
                <button
                  aria-label="Fechar"
                  className="shrink-0 rounded-xl border border-white/10 p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  onClick={() => setPayer(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-3xl border border-white/5 bg-white/5 p-5 sm:p-6">
                <PayerForm
                  compact
                  onSaved={() => {
                    const p = payer;
                    setPayer(null);
                    if (p) void subscribe(p.planId, p.planName);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {pix && (
        <PixDialog
          pix={pix}
          regenerating={loadingPlan !== null}
          onClose={() => setPix(null)}
          onPaid={() => {
            track("purchase", { label: pix.planName ?? "Plano", value: pix.amount });
            setCart([]);
            setPixByPlan({});
            setPix(null);
            navigate({ to: "/painel" });
          }}

          onRegenerate={() => {
            const plan = plans?.find((p) => p.name === pix.planName);
            if (plan) void subscribe(plan.id, plan.name);
          }}
        />
      )}
    </div>
  );
}

/** Item do carrinho no padrão e-commerce: foto, quantidade, timer e barra de expiração do PIX. */
function CartRow({
  item,
  pix,
  busy,
  onQty,
  onRemove,
  onPay,
  onResume,
}: {
  item: CartItem;
  pix: { createdAt: string; expiresAt: string; transactionId: string } | null;
  busy: boolean;
  onQty: (delta: number) => void;
  onRemove: () => void;
  onPay: () => void;
  onResume: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pix) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pix]);

  const total = new Date(pix?.expiresAt ?? 0).getTime() - new Date(pix?.createdAt ?? 0).getTime();
  const left = pix ? Math.max(0, new Date(pix.expiresAt).getTime() - now) : 0;
  const filled = pix && total > 0 ? Math.min(100, ((total - left) / total) * 100) : 0;
  const expired = !!pix && left <= 0;
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const countdownLabel = `${mm}:${ss}`;

  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] border border-white/5 bg-[#1A1A1A] p-4 transition-all hover:border-white/20 hover:shadow-2xl shadow-lg">
      <div className="flex gap-4">
        {item.imageUrl ? (
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-2xl">
            <img
              src={item.imageUrl}
              alt={item.planName}
              className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-110"
            />
          </div>
        ) : (
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5">
            <ShoppingCart className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-black text-white uppercase tracking-tight">
                {item.planName}
              </h4>
              <p className="mt-1 font-black text-primary text-base">
                {formatPrice(item.price * item.quantity, "BRL")}
              </p>
            </div>
            <button
              onClick={onRemove}
              className="shrink-0 p-2 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1">
              <button
                onClick={() => onQty(-1)}
                disabled={item.quantity <= 1}
                className="p-1.5 transition-colors hover:text-primary disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
              <button 
                onClick={() => onQty(1)} 
                className="p-1.5 transition-colors hover:text-primary"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {pix ? (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                expired ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full ${expired ? "bg-destructive" : "bg-amber-500 animate-pulse"}`} />
                <span className="text-[0.6rem] font-black uppercase tracking-widest">
                  {expired ? "PIX Expirado" : "Aguardando"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <span className="text-[0.6rem] font-black uppercase tracking-widest">Pendente</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {pix && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
                {expired ? "Expirado em" : "Expira em"}
              </span>
              <span className={`font-mono text-[0.65rem] font-black ${expired ? "text-destructive" : "text-white"}`}>
                {expired 
                  ? new Date(pix.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) 
                  : countdownLabel}
              </span>
            </div>
            
            <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${expired ? "bg-destructive" : "bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]"}`}
                style={{ width: `${expired ? 100 : filled}%` }}
              />
            </div>
          </div>

          <Button
            size="sm"
            variant={expired ? "neon" : "neonOutline"}
            className="w-full h-10 text-[0.65rem] font-black uppercase tracking-widest rounded-xl"
            disabled={busy}
            onClick={expired ? onPay : onResume}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : expired ? (
              <>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Gerar novo PIX
              </>
            ) : (
              "Continuar pagamento"
            )}
          </Button>
        </div>
      )}

      {!pix && (
        <Button
          size="sm"
          variant="neonOutline"
          className="mt-4 w-full h-10 text-[0.65rem] font-black uppercase tracking-widest rounded-xl border-white/10 bg-white/5 hover:bg-white/10"
          disabled={busy}
          onClick={onPay}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Gerar PIX deste item"}
        </Button>
      )}
    </div>
  );
}
