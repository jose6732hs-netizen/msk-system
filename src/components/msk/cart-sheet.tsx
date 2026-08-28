import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CreditCard,
  Headphones,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PayerForm, useBilling } from "@/components/msk/payer-form";
import { SmartPixModal, type SmartPixState } from "@/components/msk/smart-pix-modal";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  addCartItem,
  clearCartItems,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/cart.functions";
import {
  generatePurchasePixPayment,
  preparePurchasePayment,
} from "@/lib/purchase-payment.functions";
import { PAYMENT_PUBLIC_ERROR } from "@/lib/payments/public-messages";
import { useSupportLink } from "@/lib/support-link";
import { readAffiliateRef, readResellerRef } from "@/lib/urls";
import {
  readCartSnapshot,
  saveCartSnapshot,
  type AbandonedCart,
  type AbandonedCartItem,
} from "@/lib/tracking";
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

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function imageForLine(line: { imageUrl?: string | null; slug: string }) {
  const uploaded = String(line.imageUrl ?? "").trim();
  if (uploaded) return uploaded;
  return PLAN_IMAGES[line.slug] ?? bannerOfferAsset.url;
}

function localCount(cart: AbandonedCart | null) {
  return (cart?.items ?? []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)),
    0,
  );
}

type PendingPay = {
  planId?: string | undefined;
  planName?: string | undefined;
};

export function CartSheet({ signedIn }: { signedIn: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<SmartPixState | null>(null);
  const [payingPlanId, setPayingPlanId] = useState("");
  const [askPayer, setAskPayer] = useState(false);
  const [pendingPay, setPendingPay] = useState<PendingPay | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [localCart, setLocalCart] = useState<AbandonedCart | null>(() =>
    typeof window !== "undefined" ? readCartSnapshot() : null,
  );
  const [cartBump, setCartBump] = useState(false);
  const { billing, complete } = useBilling();
  const supportLink = useSupportLink(
    "Olá! Tive um problema ao finalizar meu pagamento no MSK. Podem me ajudar?",
  );

  const { data, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        return {
          lines: [],
          subtotal: 0,
          discount: 0,
          total: 0,
          resellerCode: null,
          affiliateCode: null,
        } as Awaited<ReturnType<typeof getCart>>;
      }
      return getCart();
    },
    enabled: signedIn && typeof window !== "undefined",
    retry: false,
    refetchOnWindowFocus: true,
  });

  const lines = data?.lines ?? [];
  const persistedCount = lines.reduce((acc, line) => acc + line.quantity, 0);
  const snapshotCount = localCount(localCart);
  const count = Math.max(persistedCount, snapshotCount);
  const localOnly = lines.length === 0 && !!localCart?.items?.length;
  const displayTotal = localOnly
    ? Number(localCart?.total ?? 0)
    : Number(data?.total ?? 0);

  function animateIntoCart(item?: AbandonedCartItem | null) {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const target = triggerRef.current?.getBoundingClientRect();
    if (!target) return;

    const size = 62;
    const startX = Math.max(18, window.innerWidth / 2 - size / 2);
    const startY = Math.min(window.innerHeight - size - 40, window.innerHeight * 0.66);
    const endX = target.left + target.width / 2 - size / 2;
    const endY = target.top + target.height / 2 - size / 2;

    const flyer = document.createElement("div");
    flyer.setAttribute("aria-hidden", "true");
    Object.assign(flyer.style, {
      position: "fixed",
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: "1000000",
      pointerEvents: "none",
      overflow: "hidden",
      borderRadius: "16px",
      border: "1px solid rgba(57,255,20,.65)",
      background: "#090909",
      boxShadow: "0 0 35px rgba(57,255,20,.28)",
    });

    if (item?.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = "";
      img.onerror = () => {
        img.onerror = null;
        img.src = bannerOfferAsset.url;
      };
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "contain", padding: "4px" });
      flyer.appendChild(img);
    } else {
      const glyph = document.createElement("div");
      glyph.textContent = "+1";
      Object.assign(glyph.style, {
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
        color: "#39ff14",
        fontWeight: "900",
        fontSize: "18px",
      });
      flyer.appendChild(glyph);
    }

    document.body.appendChild(flyer);
    const animation = flyer.animate(
      [
        { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
        {
          transform: `translate3d(${(endX - startX) * 0.55}px, ${(endY - startY) * 0.35}px, 0) scale(.8)`,
          opacity: 0.95,
          offset: 0.55,
        },
        {
          transform: `translate3d(${endX - startX}px, ${endY - startY}px, 0) scale(.18)`,
          opacity: 0.15,
        },
      ],
      { duration: 720, easing: "cubic-bezier(.22,.9,.3,1)", fill: "forwards" },
    );
    animation.onfinish = () => flyer.remove();
  }

  useEffect(() => {
    const syncLocal = (event?: Event) => {
      const custom = event as CustomEvent<{
        cart?: AbandonedCart | null;
        added?: boolean;
        addedItem?: AbandonedCartItem | null;
      }>;
      const next =
        custom?.detail?.cart !== undefined ? custom.detail.cart : readCartSnapshot();
      setLocalCart(next ?? null);
      if (custom?.detail?.added) {
        setCartBump(true);
        animateIntoCart(custom.detail.addedItem ?? null);
        window.setTimeout(() => setCartBump(false), 650);
      }
    };

    const storage = (event: StorageEvent) => {
      if (event.key === "msk_tracking_cart") syncLocal();
    };

    window.addEventListener("msk:cart-change", syncLocal as EventListener);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("msk:cart-change", syncLocal as EventListener);
      window.removeEventListener("storage", storage);
    };
  }, []);

  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["cart"] });
    } catch {
      toast.error("Não foi possível atualizar o carrinho agora.");
    } finally {
      setBusy(false);
    }
  }

  async function removePaidItems(planId?: string) {
    try {
      if (!planId) {
        await clearCartItems();
      } else {
        const line = lines.find((item) => item.planId === planId);
        if (line) await removeCartItem({ data: { itemId: line.id } });
      }
    } catch (e) {
      console.error("[cart] não foi possível limpar item pago:", e);
    } finally {
      await qc.invalidateQueries({ queryKey: ["cart"] });
    }
  }

  async function pay(
    planId?: string,
    planName?: string,
    billingOverride?: { document: string; phone: string },
  ) {
    const bill =
      billingOverride ??
      (complete && billing
        ? { document: billing.document, phone: billing.phone }
        : null);

    if (!bill) {
      setPendingPay({ planId: planId ?? "", planName: planName ?? "" });
      setPayingPlanId(planId ?? "");
      setAskPayer(true);
      setOpen(true);
      toast.info("Complete seus dados para continuar ao pagamento.");
      return;
    }

    setPayingPlanId(planId ?? "");
    setBusy(true);
    setPaymentError(null);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const rv = readResellerRef() ?? undefined;
      const result = await preparePurchasePayment({
        data: {
          ...(planId ? { planId } : {}),
          ...(ref ? { affiliateCode: ref } : {}),
          ...(rv ? { resellerCode: rv } : {}),
        },
      });

      setPendingPay(null);
      setAskPayer(false);
      setCheckout({
        transactionId: result.transactionId,
        pixCode: null,
        qrCode: null,
        amount: result.amount,
        expiresAt: null,
        title: planName ?? result.title,
        subtitle: result.subtitle,
      });
      setOpen(false);
    } catch {
      setPaymentError(PAYMENT_PUBLIC_ERROR);
      toast.error(PAYMENT_PUBLIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function generateCurrentPix() {
    if (!checkout) return;
    const result = await generatePurchasePixPayment({
      data: { transactionId: checkout.transactionId },
    });
    if (result.checkoutUrl && !result.pixCode) {
      window.location.href = result.checkoutUrl;
      return;
    }
    setCheckout((current) => {
      if (!current || current.transactionId !== result.transactionId) return current;
      return {
        ...current,
        pixCode: result.pixCode,
        qrCode: result.qrCode,
        expiresAt: result.expiresAt,
      };
    });
  }

  function goToPlans() {
    setOpen(false);
    navigate({ to: "/planos" });
  }

  async function checkoutLocalCart() {
    const items = localCart?.items ?? [];
    if (!items.length) return;

    if (!signedIn) {
      setOpen(false);
      toast.info("Entre na sua conta para finalizar o pagamento.");
      navigate({ to: "/auth" });
      return;
    }

    const withPlan = items.filter((item) => !!item.planId);
    if (!withPlan.length) {
      goToPlans();
      return;
    }

    setBusy(true);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const rv = readResellerRef() ?? undefined;
      for (const item of withPlan) {
        await addCartItem({
          data: {
            planId: String(item.planId),
            quantity: Math.max(1, Number(item.quantity ?? 1)),
            ...(ref ? { affiliateCode: ref } : {}),
            ...(rv ? { resellerCode: rv } : {}),
          },
        });
      }
      await qc.invalidateQueries({ queryKey: ["cart"] });
      saveCartSnapshot(null);
      setLocalCart(null);
    } catch {
      toast.error("Não foi possível preparar seu carrinho agora.");
      setBusy(false);
      return;
    }
    setBusy(false);
    await pay(undefined, "Carrinho MSK");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            ref={triggerRef}
            data-cart-trigger
            variant="ghost"
            size="sm"
            className={`relative transition-transform duration-300 ${cartBump ? "scale-125" : "scale-100"}`}
            aria-label={`Carrinho${count ? ` com ${count} item(ns)` : ""}`}
          >
            <ShoppingCart
              className={`h-5 w-5 text-neon transition-transform ${cartBump ? "-rotate-12 scale-110" : ""}`}
            />
            {count > 0 ? (
              <span
                className={`absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-black text-primary-foreground shadow-[0_0_16px_rgba(57,255,20,.55)] ${cartBump ? "animate-pulse" : ""}`}
              >
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>

        <SheetContent className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden border-l border-white/10 bg-[#070707] p-0 sm:max-w-[440px] md:max-w-[500px]">
          <div className="shrink-0 border-b border-white/10 bg-black/40 px-5 pb-4 pt-6 sm:px-6">
            <SheetHeader className="pr-9 text-left">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="font-display text-xl font-black uppercase tracking-tight">
                    Seu carrinho
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs leading-relaxed">
                    Revise seus itens e finalize escolhendo PIX ou cartão.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {count > 0 ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[.18em] text-muted-foreground">
                    Resumo
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {count} {count === 1 ? "produto adicionado" : "produtos adicionados"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
                  {brl(displayTotal)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {!signedIn && !localOnly ? (
              <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Entre na sua conta para usar o carrinho persistente.
                </p>
              </div>
            ) : null}

            {signedIn && isLoading && !localOnly ? (
              <div className="grid min-h-40 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : null}

            {localOnly ? (
              <section className="mb-4 space-y-3">
                <div className="rounded-2xl border border-primary/20 bg-primary/[.05] p-3 text-[10px] leading-relaxed text-muted-foreground">
                  Estes produtos foram adicionados na página de planos e estão no seu carrinho atual.
                </div>
                {(localCart?.items ?? []).map((item, index) => (
                  <article
                    key={`${item.name}-${index}`}
                    className="flex min-w-0 gap-3 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0D0D0D] p-3"
                  >
                    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black p-1.5">
                      <img
                        src={String(item.imageUrl ?? "").trim() || bannerOfferAsset.url}
                        alt={item.name}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = bannerOfferAsset.url;
                        }}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-black uppercase leading-tight text-white">
                        {item.name}
                      </h3>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Quantidade
                      </p>
                      <div className="mt-1 flex items-end justify-between gap-3">
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
                          {item.quantity}x
                        </span>
                        <span className="text-lg font-black text-primary">
                          {brl(Number(item.price) * Number(item.quantity))}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
                <Button
                  variant="neon"
                  className="h-12 w-full text-sm font-black uppercase tracking-wide"
                  disabled={busy}
                  onClick={() => void checkoutLocalCart()}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Finalizar compra · {brl(displayTotal)}
                </Button>
              </section>
            ) : null}

            {signedIn && !localOnly && (!complete || askPayer) ? (
              <section className="mb-4 overflow-hidden rounded-2xl border border-primary/20 bg-primary/[.04] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest">
                      Dados do pagador
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Na próxima etapa você escolhe PIX ou cartão.
                    </p>
                  </div>
                </div>
                <PayerForm
                  compact
                  onSaved={(saved) => {
                    setAskPayer(false);
                    const next = pendingPay;
                    setPendingPay(null);
                    if (next) void pay(next.planId, next.planName, saved);
                  }}
                />
              </section>
            ) : null}

            {signedIn && !localOnly && complete && !askPayer ? (
              <div className="mb-4">
                <PayerForm onSaved={() => setAskPayer(false)} />
              </div>
            ) : null}

            {paymentError ? (
              <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4" aria-live="polite">
                <p className="text-sm font-black text-red-100">
                  Não foi possível abrir o pagamento.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-red-100/70">
                  Tente novamente ou contate o suporte para continuar sua compra.
                </p>
                {supportLink ? (
                  <Button asChild type="button" variant="ghost" className="mt-3 w-full border border-white/10 bg-black/20">
                    <a href={supportLink} target="_blank" rel="noopener noreferrer">
                      <Headphones className="mr-2 h-4 w-4" /> Contatar o suporte
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {!localOnly && !isLoading && !lines.length ? (
              <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/[.02] px-6 py-10 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[.035]">
                  <PackageCheck className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-black uppercase tracking-wide">Carrinho vazio</p>
                <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Quando você adicionar um plano, ele aparece aqui na hora.
                </p>
                <Button variant="neonOutline" size="sm" className="mt-5" onClick={goToPlans}>
                  Ver planos
                </Button>
              </div>
            ) : null}

            {!localOnly ? (
              <div className="space-y-3">
                {lines.map((line) => (
                  <article
                    key={line.id}
                    className="min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0D0D0D] p-3 shadow-[0_18px_50px_-35px_rgba(0,0,0,.9)] sm:p-4"
                  >
                    <div className="flex min-w-0 gap-3">
                      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black p-1.5 sm:h-24 sm:w-24">
                        <img
                          src={imageForLine(line)}
                          alt={line.name}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = bannerOfferAsset.url;
                          }}
                          className="h-full w-full object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="inline-flex max-w-full rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-primary">
                              {line.durationLabel || "Licença MSK"}
                            </span>
                            <h3 className="mt-2 break-words text-sm font-black uppercase leading-tight text-white">
                              {line.name}
                            </h3>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remover ${line.name}`}
                            disabled={busy}
                            onClick={() => mutate(() => removeCartItem({ data: { itemId: line.id } }))}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-muted-foreground transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Unitário</p>
                            <p className="mt-0.5 text-xs font-bold text-white/70">{brl(line.price)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
                            <p className="mt-0.5 text-lg font-black text-primary">{brl(line.lineTotal)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 border-t border-white/5 pt-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                      <div className="flex h-11 items-center justify-between rounded-xl border border-white/10 bg-black/40 p-1 sm:w-[126px]">
                        <button
                          type="button"
                          aria-label="Diminuir quantidade"
                          disabled={busy}
                          onClick={() =>
                            mutate(() =>
                              updateCartItem({ data: { itemId: line.id, quantity: line.quantity - 1 } }),
                            )
                          }
                          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/5 hover:text-primary disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-black">{line.quantity}</span>
                        <button
                          type="button"
                          aria-label="Aumentar quantidade"
                          disabled={busy || line.quantity >= 20}
                          onClick={() =>
                            mutate(() =>
                              updateCartItem({ data: { itemId: line.id, quantity: line.quantity + 1 } }),
                            )
                          }
                          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/5 hover:text-primary disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <Button
                        variant="neonOutline"
                        className="h-11 min-w-0 whitespace-normal rounded-xl px-3 text-[10px] font-black uppercase leading-tight tracking-wider"
                        disabled={busy}
                        onClick={() => void pay(line.planId, line.name)}
                      >
                        {busy && payingPlanId === line.planId ? (
                          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                        )}
                        Finalizar esta licença
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          {!localOnly && lines.length ? (
            <div className="shrink-0 border-t border-white/10 bg-[#090909]/95 px-4 py-4 backdrop-blur-xl sm:px-5">
              <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{brl(data?.subtotal)}</span>
                </div>
                {!!data?.discount ? (
                  <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-primary">
                    <span>Desconto</span>
                    <span>-{brl(data?.discount)}</span>
                  </div>
                ) : null}
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/5 pt-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-muted-foreground">Total do carrinho</p>
                    <p className="mt-1 text-2xl font-black text-white">{brl(data?.total)}</p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-primary">
                    PIX ou cartão
                  </span>
                </div>

                <Button
                  variant="neon"
                  className="mt-4 h-12 w-full rounded-xl text-[11px] font-black uppercase tracking-wider"
                  disabled={busy}
                  onClick={() => void pay()}
                >
                  {busy && !payingPlanId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Finalizar compra
                </Button>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="ghost" size="sm" className="min-w-0 text-xs" onClick={goToPlans} disabled={busy}>
                    Adicionar mais
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 text-xs text-muted-foreground hover:text-red-400"
                    disabled={busy}
                    onClick={() => mutate(() => clearCartItems())}
                  >
                    Esvaziar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {checkout ? (
        <SmartPixModal
          pix={checkout}
          onClose={() => setCheckout(null)}
          onPaid={() => {
            const planId = payingPlanId || undefined;
            setCheckout(null);
            setPaymentError(null);
            void removePaidItems(planId);
            navigate({ to: "/painel" });
          }}
          onRegenerate={() => {
            setCheckout(null);
            toast.info("Abra o checkout novamente para gerar uma nova cobrança.");
          }}
          onGeneratePix={generateCurrentPix}
        />
      ) : null}
    </>
  );
}
