import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PayerForm, useBilling } from "@/components/msk/payer-form";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PixDialog, type PixState } from "@/components/msk/pix-dialog";
import {
  clearCartItems,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/cart.functions";
import { startPixCheckout } from "@/lib/commerce.functions";
import { readAffiliateRef, readResellerRef } from "@/lib/urls";
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
  if (line.imageUrl) return line.imageUrl;
  return PLAN_IMAGES[line.slug] ?? bannerOfferAsset.url;
}

type PendingPay = {
  planId?: string;
  planName?: string;
};

export function CartSheet({ signedIn }: { signedIn: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<PixState | null>(null);
  const [payingPlanId, setPayingPlanId] = useState("");
  const [askPayer, setAskPayer] = useState(false);
  const [pendingPay, setPendingPay] = useState<PendingPay | null>(null);
  const { billing, complete } = useBilling();

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
  const count = lines.reduce((acc, line) => acc + line.quantity, 0);

  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["cart"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSubmittedItems(planId?: string) {
    try {
      if (!planId) {
        await clearCartItems();
      } else {
        const line = lines.find((item) => item.planId === planId);
        if (line) await removeCartItem({ data: { itemId: line.id } });
      }
    } catch (e) {
      console.error("[cart] não foi possível remover item enviado ao PIX:", e);
    } finally {
      await qc.invalidateQueries({ queryKey: ["cart"] });
    }
  }

  async function pay(
    planId?: string,
    planName?: string,
    billingOverride?: { document: string; phone: string },
  ) {
    const bill = billingOverride ?? (complete && billing
      ? { document: billing.document, phone: billing.phone }
      : null);

    if (!bill) {
      setPendingPay({ planId, planName });
      setPayingPlanId(planId ?? "");
      setAskPayer(true);
      setOpen(true);
      toast.info("Complete seus dados para gerar o PIX.");
      return;
    }

    setPayingPlanId(planId ?? "");
    setBusy(true);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const rv = readResellerRef() ?? undefined;
      const result = await startPixCheckout({
        data: {
          planId,
          ...(ref ? { affiliateCode: ref } : {}),
          ...(rv ? { resellerCode: rv } : {}),
          document: bill.document,
          phone: bill.phone,
        },
      });

      // O carrinho representa somente itens que AINDA NÃO foram enviados ao PIX.
      // Assim que o gateway aceita a criação do PIX, removemos o item ou o carrinho inteiro.
      await removeSubmittedItems(planId);
      setPendingPay(null);
      setAskPayer(false);

      if (result.checkoutUrl && !result.pixCode) {
        window.location.href = result.checkoutUrl;
        return;
      }

      setPix({
        transactionId: result.transactionId,
        pixCode: result.pixCode,
        qrCode: result.qrCode,
        amount: result.amount,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        planName:
          planName ??
          (lines.length === 1 ? (lines[0]?.name ?? "Pedido") : "Carrinho MSK"),
      });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function goToPlans() {
    setOpen(false);
    navigate({ to: "/planos" });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="relative" aria-label="Carrinho">
            <ShoppingCart className="h-5 w-5 text-neon" />
            {count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-black text-primary-foreground">
                {count}
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
                    Só aparecem aqui itens que ainda não foram enviados ao PIX.
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
                    {count} {count === 1 ? "licença selecionada" : "licenças selecionadas"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
                  {brl(data?.total)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {!signedIn ? (
              <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Entre na sua conta para usar o carrinho.</p>
              </div>
            ) : null}

            {signedIn && isLoading ? (
              <div className="grid min-h-40 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : null}

            {signedIn && (!complete || askPayer) ? (
              <section className="mb-4 overflow-hidden rounded-2xl border border-primary/20 bg-primary/[.04] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest">Dados para o PIX</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Salvos uma vez na sua conta.</p>
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

            {signedIn && complete && !askPayer ? (
              <div className="mb-4">
                <PayerForm onSaved={() => setAskPayer(false)} />
              </div>
            ) : null}

            {signedIn && !isLoading && !lines.length ? (
              <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/[.02] px-6 py-10 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[.035]">
                  <PackageCheck className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-black uppercase tracking-wide">Carrinho vazio</p>
                <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  PIX gerados, pagos ou expirados não ficam misturados aqui.
                </p>
                <Button variant="neonOutline" size="sm" className="mt-5" onClick={goToPlans}>
                  Ver planos
                </Button>
              </div>
            ) : null}

            <div className="space-y-3">
              {lines.map((line) => (
                <article
                  key={line.id}
                  className="min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0D0D0D] p-3 shadow-[0_18px_50px_-35px_rgba(0,0,0,.9)] sm:p-4"
                >
                  <div className="flex min-w-0 gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black sm:h-24 sm:w-24">
                      <img
                        src={imageForLine(line)}
                        alt={line.name}
                        className="h-full w-full object-cover"
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
                      Gerar PIX desta licença
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {lines.length ? (
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
                    PIX
                  </span>
                </div>

                <Button
                  variant="neon"
                  className="mt-4 h-12 w-full rounded-xl text-[11px] font-black uppercase tracking-wider"
                  disabled={busy}
                  onClick={() => void pay()}
                >
                  {busy && !payingPlanId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Gerar PIX do carrinho
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

      {pix ? (
        <PixDialog
          pix={pix}
          regenerating={busy}
          onClose={() => setPix(null)}
          onPaid={() => {
            setPix(null);
            void qc.invalidateQueries({ queryKey: ["cart"] });
            navigate({ to: "/painel" });
          }}
          onRegenerate={() => {
            if (payingPlanId) {
              void pay(payingPlanId, pix.planName ?? "Pedido");
              return;
            }
            setPix(null);
            toast.info("Adicione novamente os itens para gerar um novo PIX do carrinho.");
            navigate({ to: "/planos" });
          }}
        />
      ) : null}
    </>
  );
}
