import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  Rocket,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  ShoppingBag,
  Loader2,
  Lock,
  MessageSquare,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPurchaseSuccess } from "@/lib/purchase-success.functions";
import { MskLogo } from "@/components/msk/logo";

export const Route = createFileRoute("/_authenticated/obrigado")({
  validateSearch: (search: Record<string, unknown>) => ({
    transactionId: (search["transactionId"] as string) || "",
  }),
  head: () => ({
    meta: [
      { title: "Pagamento aprovado — MSK SISTEM" },
      {
        name: "description",
        content: "Seu pagamento foi confirmado com sucesso. Suas licenças já estão disponíveis.",
      },
    ],
  }),
  component: ObrigadoPage,
});

const brl = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ObrigadoPage() {
  const { transactionId } = useSearch({ from: "/_authenticated/obrigado" });
  const navigate = useNavigate();
  const fetchPurchase = useServerFn(getPurchaseSuccess);
  const [attempts, setAttempts] = useState(0);

  const { data: purchase, error, isLoading, refetch } = useQuery({
    queryKey: ["purchase-success", transactionId],
    queryFn: () => fetchPurchase({ data: { transactionId } }),
    enabled: !!transactionId,
    retry: false,
  });

  const licenses = useMemo(() => (purchase?.licenses ?? []) as any[], [purchase]);
  const primaryLicense = licenses[0] as any | undefined;

  useEffect(() => {
    if (isLoading || purchase) return undefined;
    if (attempts < 10) {
      const timer = window.setTimeout(() => {
        setAttempts((prev) => prev + 1);
        void refetch();
      }, 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [purchase, isLoading, attempts, refetch]);

  useEffect(() => {
    if (!purchase) return undefined;
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        window.clearInterval(interval);
        return;
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => window.clearInterval(interval);
  }, [purchase]);

  if (!transactionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] p-5 text-center">
        <div className="glass w-full max-w-md rounded-[2.5rem] border-white/10 p-10">
          <Lock className="mx-auto mb-6 h-12 w-12 text-primary" />
          <h2 className="mb-4 text-2xl font-black uppercase tracking-tighter">Acesso Restrito</h2>
          <p className="mb-8 text-white/40">Esta página requer uma transação válida para ser acessada.</p>
          <Button asChild variant="neon" className="h-12 w-full">
            <Link to="/painel">Ir para meu painel</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] selection:bg-primary selection:text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/5 blur-[120px]" style={{ animationDelay: "2s" }} />
      </div>

      <header className="relative z-20 mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Link to="/">
          <MskLogo size={36} />
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="hidden text-white/60 sm:flex">
            <Link to="/painel">Painel</Link>
          </Button>
          <Button asChild variant="neonOutline" size="sm">
            <Link to="/planos">Planos</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-5 py-12 text-center sm:py-20">
        {!purchase && !error ? (
          <div className="animate-in fade-in space-y-8 duration-700">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <h1 className="text-3xl font-black uppercase leading-tight tracking-tighter sm:text-5xl">
              Confirmando seu <span className="neon-text">Pagamento</span>
            </h1>
            <p className="mx-auto max-w-xl text-lg text-white/40">
              Estamos confirmando a transação. Assim que o gateway marcar o pagamento como aprovado, suas licenças serão liberadas automaticamente.
            </p>
            <div className="mx-auto max-w-xs space-y-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div className="animate-loading-bar h-full bg-primary" />
              </div>
              <p className="animate-pulse text-[10px] font-black uppercase tracking-widest text-primary">
                Aguardando confirmação real do gateway...
              </p>
            </div>
          </div>
        ) : error || (!purchase && attempts >= 10) ? (
          <div className="animate-in fade-in space-y-8 duration-700">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 text-red-500 ring-4 ring-red-500/5">
              <MessageSquare className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-black uppercase leading-tight tracking-tighter sm:text-5xl">
              Pagamento <span className="text-red-500">ainda em confirmação</span>
            </h1>
            <p className="mx-auto max-w-xl text-lg text-white/40">
              Se você já concluiu o pagamento, tente novamente. A licença só é exibida depois da confirmação real do gateway.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button variant="neon" className="h-14 rounded-2xl px-10 text-xs font-black uppercase tracking-widest" onClick={() => void refetch()}>
                Tentar novamente
              </Button>
              <Button asChild variant="ghost" className="h-14 rounded-2xl px-10 text-xs font-black uppercase tracking-widest">
                <Link to="/painel">Ir para meu painel</Link>
              </Button>
            </div>
          </div>
        ) : purchase ? (
          <div className="animate-in fade-in zoom-in-95 space-y-12 duration-1000">
            <div>
              <div className="animate-bounce-slow mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] ring-8 ring-emerald-500/5">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
              <p className="mb-3 text-xs font-black uppercase tracking-[.25em] text-emerald-400">Pagamento aprovado</p>
              <h1 className="mb-4 text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-7xl">
                Licença{licenses.length > 1 ? "s" : ""} <span className="neon-text">liberada{licenses.length > 1 ? "s" : ""}!</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg font-medium text-white/60 sm:text-2xl">
                {licenses.length === 1
                  ? <>Produto: <span className="font-black text-primary">{primaryLicense?.plans?.name ?? "MSK SISTEM"}</span></>
                  : <><span className="font-black text-primary">{licenses.length} licenças</span> foram geradas para este pedido.</>}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Entrega automática confirmada</span>
              </div>
            </div>

            <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
              <FeatureBox
                icon={<KeyRound className="text-primary" />}
                title="Licenças liberadas"
                value={String(licenses.length)}
              />
              <FeatureBox
                icon={<CreditCard className="text-primary" />}
                title="Valor pago"
                value={brl(Number(purchase.amountPaid))}
              />
              <FeatureBox
                icon={<ShoppingBag className="text-primary" />}
                title="Pedido"
                value={`#${transactionId.slice(0, 8).toUpperCase()}`}
              />
            </div>

            {Number(purchase.cardFeeAmount ?? 0) > 0 ? (
              <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/[.03] px-5 py-4 text-left text-xs text-muted-foreground">
                Pagamento no cartão: subtotal {brl(Number(purchase.baseAmount))} + acréscimo do cartão {brl(Number(purchase.cardFeeAmount))} = <strong className="text-white">{brl(Number(purchase.amountPaid))}</strong>.
              </div>
            ) : null}

            <div className="mx-auto max-w-2xl space-y-4 text-left">
              {licenses.map((license: any, index: number) => {
                const meta = (license?.metadata ?? {}) as Record<string, unknown>;
                const label = String(meta["item_label"] ?? license?.plans?.name ?? `Licença ${index + 1}`);
                const purpose = String(meta["license_purpose"] ?? "Acesso MSK");
                return (
                  <div key={license.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary">Licença {index + 1}</p>
                        <h3 className="mt-1 break-words text-lg font-black uppercase">{label}</h3>
                        <p className="mt-1 text-xs text-white/45">{purpose} · status {String(license.status ?? "liberada")}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <AttentionTutorials />

            <div className="mx-auto max-w-2xl space-y-8 rounded-[3rem] border border-white/10 bg-white/5 p-8 text-left sm:p-12">

              <div>
                <h3 className="mb-4 flex items-center gap-2 text-xl font-black uppercase tracking-tighter">
                  <Rocket className="text-primary" /> Próximo passo
                </h3>
                <p className="text-sm leading-relaxed text-white/60">
                  Entre no seu painel para visualizar suas licenças, copiar os dados de ativação disponíveis e acessar o suporte de cada produto.
                </p>
              </div>

              <div className="border-t border-white/5 pt-6">
                <Button
                  variant="neon"
                  size="lg"
                  className="group h-16 w-full rounded-2xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/20"
                  onClick={() => {
                    if (primaryLicense?.id) localStorage.setItem("msk_highlight_license", primaryLicense.id);
                    navigate({ to: "/painel" });
                  }}
                >
                  Ir para meu painel <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

              <div className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/20">
                  <CheckCircle2 size={12} /> Pagamento confirmado
                </div>
                <a href="https://t.me/msksistem" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-primary underline-offset-4 hover:underline">
                  Precisa de ajuda? Falar com suporte
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function FeatureBox({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="glass group rounded-3xl border border-white/5 p-6 text-left transition-all hover:border-primary/20">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 transition-colors group-hover:bg-primary/10">
        {icon}
      </div>
      <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/30">{title}</h4>
      <p className="truncate text-lg font-black uppercase tracking-tighter text-white">{value}</p>
    </div>
  );
}