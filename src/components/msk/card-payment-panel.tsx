import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Headphones, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditCard3D } from "@/components/msk/credit-card-3d";
import { getCardCheckoutOptions, payWithCard } from "@/lib/payments/card.functions";
import { cardBrand } from "@/lib/payments/atomo-status";
import { CARD_CONFIRMATION_PENDING, CARD_PUBLIC_ERROR } from "@/lib/payments/public-messages";
import { useSupportLink } from "@/lib/support-link";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Options = Awaited<ReturnType<typeof getCardCheckoutOptions>>;

/**
 * Formulário de cartão do checkout interno.
 * Os dados do cartão só existem no estado local do componente e vão direto
 * para o nosso backend. Nada é salvo no navegador.
 */
export function CardPaymentPanel({
  transactionId,
  amount,
  onPaid,
  onPaymentStarted,
}: {
  transactionId: string;
  amount: number;
  onPaid: () => void;
  onPaymentStarted?: () => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [holderName, setHolderName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const supportLink = useSupportLink("Olá! Tive um problema ao tentar realizar o pagamento com cartão. Podem me ajudar?");
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    setOptionsLoaded(false);
    void getCardCheckoutOptions({ data: { transactionId } })
      .then((res) => {
        if (!alive) return;
        setOptions(res);
        setOptionsLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setOptions(null);
        setOptionsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [transactionId]);

  const plans = useMemo(() => options?.installments ?? [], [options]);
  const brand = useMemo(() => cardBrand(number), [number]);

  if (!optionsLoaded) {
    return (
      <div className="flex min-h-36 w-full items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> Carregando pagamento com cartão...
      </div>
    );
  }

  if (!options?.enabled) {
    return (
      <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
        <CreditCard className="mx-auto h-7 w-7 text-muted-foreground" />
        <h4 className="mt-3 text-sm font-black uppercase">Cartão indisponível no momento</h4>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          Escolha PIX para continuar ou fale com o suporte se precisar de ajuda.
        </p>
        {supportLink ? (
          <Button asChild type="button" variant="ghost" className="mt-4 w-full border border-white/10">
            <a href={supportLink} target="_blank" rel="noopener noreferrer">
              <Headphones className="mr-2 h-4 w-4" /> Contatar o suporte
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  async function submit() {
    if (lock.current) return;
    const digits = number.replace(/\D+/g, "");
    const [mm, yy] = expiry.split("/");
    const expMonth = Number(mm);
    const expYear = Number(yy?.length === 2 ? `20${yy}` : yy);
    if (digits.length < 13 || !expMonth || !expYear || cvv.length < 3 || holderName.length < 2) {
      setFeedback("Confira os dados do cartão.");
      return;
    }

    lock.current = true;
    onPaymentStarted?.();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await payWithCard({
        data: {
          transactionId,
          installments,
          card: { number: digits, holderName, expMonth, expYear, cvv },
        },
      });
      setNumber("");
      setCvv("");

      const publicMessage = res.status === "FAILED" ? CARD_PUBLIC_ERROR : res.message;
      setFeedback(publicMessage);

      if (res.status === "PAID") {
        toast.success("Pagamento aprovado!");
        onPaid();
      } else if (res.status === "FAILED") {
        toast.error(CARD_PUBLIC_ERROR);
      } else {
        toast.info(publicMessage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : CARD_PUBLIC_ERROR;
      const publicMessage =
        message.includes(CARD_CONFIRMATION_PENDING)
          ? CARD_CONFIRMATION_PENDING
          : CARD_PUBLIC_ERROR;
      setNumber("");
      setCvv("");
      setFeedback(publicMessage);
      if (publicMessage === CARD_CONFIRMATION_PENDING) {
        toast.info(publicMessage);
      } else {
        toast.error(publicMessage);
      }
    } finally {
      setSubmitting(false);
      lock.current = false;
    }
  }

  const paymentFailed = feedback === CARD_PUBLIC_ERROR;
  const paymentPending = feedback === CARD_CONFIRMATION_PENDING;
  const baseAmount = Number(options.baseAmount ?? amount);
  const feeAmount = Number(options.feeAmount ?? 0);
  const totalAmount = Number(options.totalAmount ?? baseAmount);

  return (
    <div className="w-full space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
      {paymentPending ? (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
          A cobrança está sendo confirmada. Para evitar pagamento duplicado, não envie o cartão novamente.
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">
          Cartão de crédito
        </h4>
        {options.sandbox && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[0.6rem] font-black uppercase text-amber-400">
            Ambiente de teste
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Subtotal</p>
          <p className="mt-1 text-base font-black text-white">{brl(baseAmount)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Acréscimo do cartão</p>
          <p className="mt-1 text-base font-black text-amber-300">+ {brl(feeAmount)}</p>
        </div>
        <div className="rounded-2xl border border-primary/25 bg-primary/[.06] p-3.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total no cartão</p>
          <p className="mt-1 text-base font-black text-primary">{brl(totalAmount)}</p>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        O acréscimo é aplicado somente ao pagamento no cartão. O preço-base do produto permanece o mesmo.
      </p>

      <CreditCard3D brand={brand} number={number} holderName={holderName} expiry={expiry} />

      <div className="space-y-3">
        <div>
          <label htmlFor="card-holder" className="text-[0.65rem] font-bold uppercase text-muted-foreground">
            Nome impresso no cartão
          </label>
          <input
            id="card-holder"
            autoComplete="cc-name"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value.toUpperCase())}
            placeholder="NOME IMPRESSO NO CARTÃO"
            className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="card-number" className="text-[0.65rem] font-bold uppercase text-muted-foreground">
            Número do cartão
          </label>
          <input
            id="card-number"
            inputMode="numeric"
            autoComplete="cc-number"
            value={number}
            onChange={(e) =>
              setNumber(
                e.target.value
                  .replace(/\D+/g, "")
                  .slice(0, 19)
                  .replace(/(.{4})/g, "$1 ")
                  .trim(),
              )
            }
            placeholder="0000 0000 0000 0000"
            className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="card-exp" className="text-[0.65rem] font-bold uppercase text-muted-foreground">
              Validade
            </label>
            <input
              id="card-exp"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={expiry}
              onChange={(e) => {
                const d = e.target.value.replace(/\D+/g, "").slice(0, 4);
                setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
              }}
              placeholder="MM/AA"
              className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="card-cvv" className="text-[0.65rem] font-bold uppercase text-muted-foreground">
              CVV
            </label>
            <input
              id="card-cvv"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D+/g, "").slice(0, 4))}
              placeholder="000"
              className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>
        <div>
          <label htmlFor="card-installments" className="text-[0.65rem] font-bold uppercase text-muted-foreground">
            Parcelas
          </label>
          <select
            id="card-installments"
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
            className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            {plans.map((p) => (
              <option key={p.installments} value={p.installments} className="bg-black">
                {p.installments}x de {brl(p.amount)}
                {p.interest ? " (com juros)" : " sem juros"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div className="space-y-3" aria-live="polite">
          <p className={`rounded-xl border p-3 text-xs ${paymentFailed ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-white/10 bg-black/40 text-muted-foreground"}`}>
            {feedback}
          </p>
          {paymentFailed && supportLink ? (
            <Button asChild type="button" variant="ghost" className="w-full border border-white/10">
              <a href={supportLink} target="_blank" rel="noopener noreferrer">
                <Headphones className="mr-2 h-4 w-4" /> Contatar o suporte
              </a>
            </Button>
          ) : null}
        </div>
      )}

      <Button
        variant="neon"
        className="h-12 w-full text-sm font-black uppercase tracking-widest"
        onClick={submit}
        disabled={submitting || paymentPending}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
          </>
        ) : paymentPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguardando confirmação
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" /> Pagar {brl(totalAmount)}
          </>
        )}
      </Button>

      <p className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-primary" /> Dados enviados com criptografia. Não armazenamos número nem CVV.
      </p>
    </div>
  );
}