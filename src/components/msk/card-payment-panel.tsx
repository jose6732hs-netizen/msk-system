import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCardCheckoutOptions, payWithCard } from "@/lib/payments/card.functions";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Options = Awaited<ReturnType<typeof getCardCheckoutOptions>>;

/**
 * Formulário de cartão do checkout interno.
 * Os dados do cartão só existem no estado local do componente e vão direto
 * para o nosso backend, que repassa à AtomoPay. Nada é salvo no navegador.
 */
export function CardPaymentPanel({
  transactionId,
  amount,
  onPaid,
}: {
  transactionId: string;
  amount: number;
  onPaid: () => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [installments, setInstallments] = useState(1);
  const [holderName, setHolderName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    void getCardCheckoutOptions({ data: { amount } })
      .then((res) => alive && setOptions(res))
      .catch(() => alive && setOptions(null));
    return () => {
      alive = false;
    };
  }, [amount]);

  const plans = useMemo(() => options?.installments ?? [], [options]);

  if (!options?.enabled) return null;

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
      // Limpa imediatamente os dados sensíveis da memória do formulário.
      setNumber("");
      setCvv("");
      setFeedback(res.message);
      if (res.status === "PAID") {
        toast.success("Pagamento aprovado!");
        onPaid();
      } else if (res.status === "FAILED") {
        toast.error(res.message);
      } else {
        toast.info(res.message);
      }
    } catch (e) {
      const msg = (e as Error).message || "Não foi possível processar o cartão.";
      setFeedback(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
      lock.current = false;
    }
  }

  return (
    <div className="w-full space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">
          Cartão de crédito
        </h4>
        {options.sandbox && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[0.6rem] font-black uppercase text-amber-400">
            Sandbox
          </span>
        )}
      </div>

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
        <p className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-muted-foreground">
          {feedback}
        </p>
      )}

      <Button
        variant="neon"
        className="h-12 w-full text-sm font-black uppercase tracking-widest"
        onClick={submit}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" /> Pagar {brl(amount)}
          </>
        )}
      </Button>

      <p className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-primary" /> Dados enviados com criptografia. Não
        armazenamos número nem CVV.
      </p>
    </div>
  );
}
