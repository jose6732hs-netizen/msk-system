import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Crown, Loader2, Palette, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MskLogo } from "@/components/msk/logo";
import { ResellerSales } from "@/components/msk/reseller-sales";
import {
  createWithdrawal,
  getResellerDashboard,
  joinReseller,
  saveBranding,
  startDeposit,
} from "@/lib/commerce.functions";

export const Route = createFileRoute("/_authenticated/revendedor")({
  head: () => ({
    meta: [
      { title: "Painel do revendedor — MSK SISTEM" },
      {
        name: "description",
        content:
          "Gerencie saldo, níveis de revenda, licenças vendidas, testes gratuitos e a marca da sua extensão MSK.",
      },
      { property: "og:title", content: "Painel do revendedor — MSK SISTEM" },
      { property: "og:description", content: "Saldo, licenças, trials e personalização de marca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResellerPage,
});

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ResellerPage() {
  const qc = useQueryClient();
  const load = useServerFn(getResellerDashboard);
  const join = useServerFn(joinReseller);
  const deposit = useServerFn(startDeposit);
  const withdraw = useServerFn(createWithdrawal);
  const brand = useServerFn(saveBranding);

  const [busy, setBusy] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [pix, setPix] = useState<{ code: string | null; amount: number } | null>(null);
  const [wdAmount, setWdAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("EMAIL");
  const [branding, setBranding] = useState({
    extensionName: "",
    description: "",
    primaryColor: "#39FF88",
    titleColor: "#FFFFFF",
    supportUrl: "",
  });

  const { data, isLoading } = useQuery({ queryKey: ["reseller"], queryFn: () => load() });

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["reseller"] });
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.enrolled) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <MskLogo size={44} />
        <h1 className="mt-8 font-display text-3xl">Programa de Revenda</h1>
        <p className="mt-3 text-muted-foreground">
          Deposite saldo, gere licenças com desconto, distribua testes gratuitos e personalize a
          extensão com a sua marca. Quanto maior o volume, melhor o nível e o desconto.
        </p>
        <Button
          className="mt-8"
          variant="neon"
          size="lg"
          disabled={busy}
          onClick={() => run(() => join(), "Conta de revendedor criada!")}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Quero ser revendedor
        </Button>
      </div>
    );
  }

  const r = data.reseller as Record<string, any>;
  const link =
    typeof window !== "undefined" ? `${window.location.origin}/planos?rv=${r["code"]}` : "";

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl neon-text">Painel do Revendedor</h1>
          <p className="text-sm text-muted-foreground">
            Código <span className="text-primary">{r["code"]}</span> · nível{" "}
            <span className="uppercase text-primary">{r["tier"]}</span> · desconto{" "}
            {r["discount_rate"]}%
          </p>
        </div>
        <Button
          variant="neonOutline"
          onClick={() => {
            navigator.clipboard.writeText(link);
            toast.success("Link copiado!");
          }}
        >
          <Copy className="mr-2 h-4 w-4" /> Copiar link de revenda
        </Button>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat icon={<Wallet className="h-4 w-4" />} label="Saldo" value={brl(r["available_balance"])} />
        <Stat icon={<Wallet className="h-4 w-4" />} label="Depositado" value={brl(r["total_deposited"])} />
        <Stat icon={<Crown className="h-4 w-4" />} label="Trials disponíveis" value={String(r["trials_available"])} />
        <Stat icon={<Crown className="h-4 w-4" />} label="Licenças" value={String(data.licenses.length)} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ResellerSales onSold={() => qc.invalidateQueries()} />
        </div>
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-lg">Depositar saldo (PIX)</h2>
          <div className="mt-4 flex gap-3">
            <Input
              placeholder="Valor (R$)"
              inputMode="decimal"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button
              variant="neon"
              disabled={busy || !depositAmount}
              onClick={() =>
                run(async () => {
                  const res = await deposit({ data: { amount: Number(depositAmount) } });
                  setPix({ code: res.pixCode, amount: res.amount });
                }, "PIX gerado")
              }
            >
              Gerar PIX
            </Button>
          </div>
          {pix?.code && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground">
                Copia e cola · {brl(pix.amount)}
              </p>
              <p className="mt-2 break-all font-mono text-xs">{pix.code}</p>
              <Button
                size="sm"
                variant="neonOutline"
                className="mt-3"
                onClick={() => {
                  navigator.clipboard.writeText(pix.code!);
                  toast.success("Código PIX copiado");
                }}
              >
                <Copy className="mr-2 h-3 w-3" /> Copiar
              </Button>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-lg">Solicitar saque</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Valor (R$)"
              inputMode="decimal"
              value={wdAmount}
              onChange={(e) => setWdAmount(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value)}
            >
              {["EMAIL", "CPF", "CNPJ", "PHONE", "RANDOM"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Input
              className="sm:col-span-2"
              placeholder="Chave PIX"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>
          <Button
            variant="neon"
            className="mt-4"
            disabled={busy || !wdAmount || !pixKey}
            onClick={() =>
              run(
                () =>
                  withdraw({
                    data: {
                      amount: Number(wdAmount),
                      pixKey,
                      pixKeyType: pixKeyType as never,
                      origin: "reseller",
                    },
                  }),
                "Saque solicitado",
              )
            }
          >
            Solicitar saque
          </Button>
        </div>
      </section>

      <section className="glass mt-8 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 font-display text-lg">
          <Palette className="h-4 w-4 text-primary" /> Marca da sua extensão
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Nome da extensão"
            value={branding.extensionName}
            onChange={(e) => setBranding({ ...branding, extensionName: e.target.value })}
          />
          <Input
            placeholder="Descrição"
            value={branding.description}
            onChange={(e) => setBranding({ ...branding, description: e.target.value })}
          />
          <Input
            placeholder="Cor principal (#39FF88)"
            value={branding.primaryColor}
            onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
          />
          <Input
            placeholder="Cor do título (#FFFFFF)"
            value={branding.titleColor}
            onChange={(e) => setBranding({ ...branding, titleColor: e.target.value })}
          />
          <Input
            className="sm:col-span-2"
            placeholder="URL de suporte (opcional)"
            value={branding.supportUrl}
            onChange={(e) => setBranding({ ...branding, supportUrl: e.target.value })}
          />
        </div>
        <Button
          variant="neon"
          className="mt-4"
          disabled={busy || branding.extensionName.length < 2}
          onClick={() => run(() => brand({ data: branding }), "Marca salva")}
        >
          Salvar marca
        </Button>
      </section>

      <section className="glass mt-8 rounded-2xl p-6">
        <h2 className="font-display text-lg">Licenças emitidas</h2>
        <div className="mt-4 space-y-2">
          {data.licenses.map((l: Record<string, any>) => (
            <div
              key={l["id"]}
              className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs">{l["token_preview"]}</span>
              <span className="text-xs text-muted-foreground">{l["type"]}</span>
              <span className="text-xs text-primary">{l["status"]}</span>
            </div>
          ))}
          {!data.licenses.length && (
            <p className="text-sm text-muted-foreground">Nenhuma licença emitida ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-2xl">{value}</p>
    </div>
  );
}