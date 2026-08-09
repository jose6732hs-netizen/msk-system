import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getResellerPricing, sellLicense } from "@/lib/commerce.functions";

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ResellerSales({ onSold }: { onSold?: () => void }) {
  const pricing = useServerFn(getResellerPricing);
  const sell = useServerFn(sellLicense);
  const { data, isLoading } = useQuery({ queryKey: ["reseller-pricing"], queryFn: () => pricing({}) });

  const [priceId, setPriceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ token: string; durationLabel: string } | null>(null);

  const prices = (data?.prices ?? []) as Record<string, any>[];

  async function submit() {
    setBusy(true);
    try {
      const res = await sell({
        data: {
          priceId,
          customerName,
          customerEmail,
          ...(salePrice ? { salePrice: Number(salePrice) } : {}),
        },
      });
      setIssued({ token: res.token, durationLabel: res.durationLabel ?? "" });
      setCustomerName("");
      setCustomerEmail("");
      setSalePrice("");
      toast.success("Licença emitida e saldo debitado");
      onSold?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="flex items-center gap-2 font-display text-lg">
        <ShoppingCart className="h-4 w-4 text-primary" /> Vender licença
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Preços do seu nível{" "}
        <span className="uppercase text-primary">{data?.tier ?? "—"}</span>. O valor é debitado do
        seu saldo no momento da emissão.
      </p>

      {isLoading ? (
        <Loader2 className="mt-6 h-5 w-5 animate-spin text-primary" />
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {prices.map((p) => (
              <button
                key={p["id"]}
                type="button"
                onClick={() => setPriceId(p["id"])}
                className={`rounded-lg border p-3 text-left transition ${
                  priceId === p["id"]
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <p className="text-sm font-medium">{p["duration_label"]}</p>
                <p className="text-xs text-muted-foreground">{brl(p["price"])}</p>
              </button>
            ))}
            {prices.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum preço configurado para o seu nível ainda.
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Nome do cliente"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              placeholder="E-mail do cliente"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
            <Input
              placeholder="Preço cobrado (opcional)"
              inputMode="decimal"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </div>

          <Button
            variant="neon"
            className="mt-4"
            disabled={busy || !priceId || !customerName || !customerEmail}
            onClick={submit}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Emitir licença
          </Button>
        </>
      )}

      {issued && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">
            Chave gerada · {issued.durationLabel} — entregue ao cliente
          </p>
          <p className="mt-2 break-all font-mono text-sm">{issued.token}</p>
          <Button
            size="sm"
            variant="neonOutline"
            className="mt-3"
            onClick={() => {
              navigator.clipboard.writeText(issued.token);
              toast.success("Chave copiada");
            }}
          >
            <Copy className="mr-2 h-3 w-3" /> Copiar chave
          </Button>
        </div>
      )}
    </div>
  );
}
