import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
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

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CartSheet({ signedIn }: { signedIn: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<PixState | null>(null);
  const [payingPlanId, setPayingPlanId] = useState<string>("");
  const { billing, complete } = useBilling();
  const [askPayer, setAskPayer] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      // Sem sessão hidratada ainda? Evita chamar o serverFn sem Authorization.
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        return {
          lines: [],
          subtotal: 0,
          discount: 0,
          total: 0,
          resellerCode: null,
          affiliateCode: null,
          pending: [],
        } as Awaited<ReturnType<typeof getCart>>;
      }
      return getCart();
    },
    enabled: signedIn && typeof window !== "undefined",
    retry: false,
  });

  const count = (data?.lines ?? []).reduce((acc, l) => acc + l.quantity, 0);
  const pending = (data?.pending ?? []) as Record<string, any>[];
  const pendingCount = pending.length;

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

  async function pay(planId?: string, planName?: string) {
    // Se planId for undefined, estamos finalizando o carrinho inteiro
    const isCart = !planId;
    
    // Os dados do pagador ficam salvos na conta: só pedimos de novo se faltarem.
    if (!complete || !billing) {
      if (planId) setPayingPlanId(planId);
      setAskPayer(true);
      setOpen(true);
      toast.info("Complete seus dados de pagamento uma única vez.");
      return;
    }
    const cleanDocument = billing.document;
    const cleanPhone = billing.phone;
    if (planId) setPayingPlanId(planId);
    setBusy(true);
    try {
      const ref = readAffiliateRef() ?? undefined;
      const rv = readResellerRef() ?? undefined;
      const res = await startPixCheckout({
        data: {
          planId, // Se undefined, o backend assume o carrinho total
          ...(ref ? { affiliateCode: ref } : {}),
          ...(rv ? { resellerCode: rv } : {}),
          document: cleanDocument,
          phone: cleanPhone,
        },
      });
      if (res.checkoutUrl && !res.pixCode) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setPix({
        transactionId: res.transactionId,
        pixCode: res.pixCode,
        qrCode: res.qrCode,
        amount: res.amount,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        planName: planName ?? (data?.lines && data.lines.length > 0 ? (data.lines.length === 1 ? (data.lines[0]?.name ?? "Pedido") : "Carrinho MSK") : "Pedido"),
      });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="relative" aria-label="Carrinho">
            <ShoppingCart className="h-5 w-5 text-neon" />
            {pendingCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
                <span className="relative grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[0.6rem] font-bold text-black">
                  {pendingCount}
                </span>
              </span>
            ) : (
              count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground">
                  {count}
                </span>
              )
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">Seu carrinho</SheetTitle>
            <SheetDescription>
              Itens e pagamentos ficam salvos na sua conta — volte quando quiser.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {!signedIn && (
              <p className="text-sm text-muted-foreground">
                Entre na sua conta para usar o carrinho.
              </p>
            )}
            {signedIn && isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}

            {signedIn && (!complete || askPayer) && (
              <div className="rounded-xl border border-border/60 p-4">
                <PayerForm
                  compact
                  onSaved={() => {
                    setAskPayer(false);
                    toast.success("Pronto! Agora é só gerar o PIX.");
                  }}
                />
              </div>
            )}
            {signedIn && complete && !askPayer && (
              <PayerForm onSaved={() => setAskPayer(false)} />
            )}

            {pending.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-xs uppercase tracking-widest text-amber-400">
                  Pagamento pendente
                </p>
                {pending.map((p) => (
                  <div key={p["id"]} className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">{p["plans"]?.name ?? "Pedido"}</p>
                      <p className="text-xs text-muted-foreground">
                        {brl(p["amount"])} ·{" "}
                        {p["status"] === "EXPIRED" ? "PIX EXPIRADO" : "aguardando pagamento"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={p["status"] === "EXPIRED" ? "neonOutline" : "neon"}
                      disabled={busy}
                      onClick={() => {
                        if (p["status"] === "EXPIRED" || !p["pix_code"]) {
                          void pay(p["plan_id"], p["plans"]?.name ?? "Pedido");
                          return;
                        }
                        setPayingPlanId(p["plan_id"]);
                        setPix({
                          transactionId: p["id"],
                          pixCode: p["pix_code"],
                          qrCode: p["pix_qrcode"],
                          amount: Number(p["amount"]),
                          status: p["status"],
                          expiresAt: p["expires_at"],
                          planName: p["plans"]?.name ?? "Pedido",
                        });
                        setOpen(false);
                      }}
                    >
                      {p["status"] === "EXPIRED" ? "Gerar novo PIX" : "Continuar pagamento"}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {signedIn && !isLoading && !(data?.lines ?? []).length && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Seu carrinho está vazio.</p>
                <Button
                  variant="neonOutline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/planos" });
                  }}
                >
                  Ver planos
                </Button>
              </div>
            )}

            {(data?.lines ?? []).map((line) => (
              <div key={line.id} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{line.durationLabel}</p>
                  </div>
                  <p className="text-sm text-primary">{brl(line.lineTotal)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="glass"
                      className="h-7 w-7"
                      aria-label="Diminuir quantidade"
                      disabled={busy}
                      onClick={() =>
                        mutate(() =>
                          updateCartItem({ data: { itemId: line.id, quantity: line.quantity - 1 } }),
                        )
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{line.quantity}</span>
                    <Button
                      size="icon"
                      variant="glass"
                      className="h-7 w-7"
                      aria-label="Aumentar quantidade"
                      disabled={busy}
                      onClick={() =>
                        mutate(() =>
                          updateCartItem({ data: { itemId: line.id, quantity: line.quantity + 1 } }),
                        )
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="neon"
                      disabled={busy}
                      onClick={() => pay(line.planId, line.name)}
                    >
                      Finalizar compra
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label="Remover item"
                      disabled={busy}
                      onClick={() => mutate(() => removeCartItem({ data: { itemId: line.id } }))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!!(data?.lines ?? []).length && (
            <div className="border-t border-border/60 pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{brl(data?.subtotal)}</span>
              </div>
              {!!data?.discount && (
                <div className="mt-1 flex justify-between text-primary">
                  <span>Desconto</span>
                  <span>-{brl(data.discount)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between font-display text-lg">
                <span>Total</span>
                <span className="neon-text">{brl(data?.total)}</span>
              </div>
              <Button
                variant="neon"
                className="mt-4 w-full"
                disabled={busy}
                onClick={() => void pay()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Finalizar compra
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-muted-foreground"
                disabled={busy}
                onClick={() => mutate(() => clearCartItems())}
              >
                Esvaziar carrinho
              </Button>
              <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
                O pagamento é feito por item — cada plano gera sua própria licença.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {pix && (
        <PixDialog
          pix={pix}
          regenerating={busy}
          onClose={() => setPix(null)}
          onPaid={() => {
            setPix(null);
            void qc.invalidateQueries({ queryKey: ["cart"] });
            navigate({ to: "/painel" });
          }}
          onRegenerate={() => pay(payingPlanId, pix.planName ?? "Pedido")}
        />
      )}
    </>
  );
}
