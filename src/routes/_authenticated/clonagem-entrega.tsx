import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  KeyRound,
  Loader2,
  LockKeyhole,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MskLogo } from "@/components/msk/logo";
import {
  getPaidClonerDelivery,
  getPaidClonerDownload,
  trackClonerPublic,
} from "@/lib/cloner.functions";
import { getVisitorId } from "@/lib/urls";

export const Route = createFileRoute("/_authenticated/clonagem-entrega")({
  validateSearch: (search: Record<string, unknown>) => ({
    transactionId: String(search["transactionId"] ?? ""),
  }),
  head: () => ({
    meta: [
      { title: "Suas licenças — MSK SISTEM" },
      {
        name: "description",
        content: "Entrega segura das licenças e do arquivo do MSK Clonador de Páginas.",
      },
    ],
  }),
  component: ClonagemEntrega,
});

function human(bytes?: number | null) {
  if (!bytes) return "Arquivo ZIP";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function ClonagemEntrega() {
  const { transactionId } = useSearch({ from: "/_authenticated/clonagem-entrega" });
  const [downloading, setDownloading] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["cloner-delivery", transactionId],
    queryFn: () => getPaidClonerDelivery({ data: { transactionId } }),
    enabled: /^[0-9a-f-]{36}$/i.test(transactionId),
    retry: false,
    refetchInterval: (query) => (query.state.data?.paid ? false : 3000),
  });

  useEffect(() => {
    if (!data?.paid || celebrated) return;
    setCelebrated(true);
    const id = window.setTimeout(() => {
      void confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }, 100);
    return () => window.clearTimeout(id);
  }, [data?.paid, celebrated]);

  async function copyToken(token: string) {
    await navigator.clipboard.writeText(token);
    toast.success("Licença copiada.");
  }

  async function download() {
    if (!data?.paid) return;
    setDownloading(true);
    try {
      const result = await getPaidClonerDownload({ data: { transactionId } });
      window.location.href = result.url;
      toast.success("Download liberado por 5 minutos.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  async function shareCheckout() {
    const url = `${window.location.origin}/clonagem`;
    try {
      await trackClonerPublic({
        data: { event: "cloner.share", visitorId: getVisitorId(), source: "delivery" },
      });
      if (navigator.share) {
        await navigator.share({
          title: "MSK Clonador de Páginas",
          text: "Confira os planos do MSK Clonador de Páginas.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Não foi possível compartilhar.");
    }
  }

  if (!transactionId || !/^[0-9a-f-]{36}$/i.test(transactionId)) return <Restricted />;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[min(760px,100vw)] -translate-x-1/2 rounded-full bg-primary/10 blur-[160px]" />
      </div>

      <header className="relative z-10 mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="shrink-0"><MskLogo size={34} /></Link>
        <Button variant="ghost" className="min-w-0 whitespace-normal" onClick={shareCheckout}>
          <Share2 className="mr-2 h-4 w-4 shrink-0" /> Compartilhar
        </Button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
        {isLoading || (!data && !error) ? (
          <StatusCard icon={<Loader2 className="h-10 w-10 animate-spin text-primary" />} title="Confirmando pagamento" text="As licenças e o ZIP permanecem bloqueados até o gateway confirmar o PIX." />
        ) : error ? (
          <StatusCard icon={<LockKeyhole className="h-10 w-10 text-red-400" />} title="Não foi possível liberar" text={(error as Error).message}>
            <Button className="mt-6 w-full sm:w-auto" variant="neon" onClick={() => refetch()}>Tentar novamente</Button>
          </StatusCard>
        ) : data && !data.paid ? (
          <StatusCard icon={<Loader2 className="h-9 w-9 animate-spin text-amber-300" />} title="PIX ainda pendente" text={`Status atual: ${data.status}. Esta página verifica automaticamente a confirmação.`}>
            <Button asChild variant="ghost" className="mt-5 w-full sm:w-auto"><Link to="/clonagem">Voltar ao checkout</Link></Button>
          </StatusCard>
        ) : data?.paid ? (
          <div className="min-w-0 space-y-7">
            <section className="min-w-0 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/5"><CheckCircle2 className="h-10 w-10 text-emerald-400" /></div>
              <p className="mt-7 text-[10px] font-black uppercase tracking-[.25em] text-primary">Pagamento confirmado</p>
              <h1 className="mt-2 break-words text-3xl font-black uppercase tracking-tight sm:text-5xl">Seus acessos estão liberados</h1>
              <p className="mx-auto mt-3 max-w-2xl break-words text-sm leading-relaxed text-white/45">
                {data.smartBundle ? `Combo inteligente confirmado. Você economizou ${brl(Number(data.savings ?? 0))} e recebeu duas licenças separadas.` : "Sua licença do Clonador e o arquivo protegido estão prontos."}
              </p>
            </section>

            <section className={`grid min-w-0 gap-4 ${data.licenses?.length > 1 ? "lg:grid-cols-2" : "max-w-2xl mx-auto"}`}>
              {(data.licenses ?? [data.license]).filter(Boolean).map((license: any) => (
                <LicenseCard key={license.id} license={license} onCopy={() => void copyToken(license.token)} />
              ))}
            </section>

            <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]">
              <div className="min-w-0 rounded-[1.75rem] border border-primary/20 bg-primary/[.05] p-5 sm:p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><FileArchive className="h-6 w-6" /></div>
                  <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-primary">Arquivo do Clonador</p><h2 className="mt-1 break-all text-lg font-black">{data.file.name || "Extensão de clonagem.zip"}</h2><p className="mt-1 text-xs text-muted-foreground">{human(data.file.sizeBytes)} · link temporário de 5 minutos</p></div>
                </div>
                <Button variant="neon" className="mt-5 min-h-14 w-full whitespace-normal rounded-2xl" onClick={() => void download()} disabled={downloading || !data.file.ready}>
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Download className="mr-2 h-4 w-4 shrink-0" />}
                  {downloading ? "Liberando download..." : "Baixar arquivo ZIP"}
                </Button>
              </div>

              <div className="min-w-0 rounded-[1.75rem] border border-white/10 bg-white/[.03] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /><p className="text-[9px] font-black uppercase tracking-widest">Segurança da entrega</p></div>
                <ul className="mt-4 space-y-3 text-xs leading-relaxed text-white/45">
                  <li>• O ZIP não fica público antes do pagamento.</li>
                  <li>• A URL de download expira automaticamente.</li>
                  <li>• Cada licença continua com seu próprio plano e contador.</li>
                  <li>• O tempo da licença só inicia na primeira ativação.</li>
                </ul>
              </div>
            </section>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild variant="ghost" className="w-full sm:w-auto"><Link to="/painel">Ir para meu painel</Link></Button>
              <Button variant="ghost" className="w-full sm:w-auto" onClick={shareCheckout}><Share2 className="mr-2 h-4 w-4" /> Compartilhar Clonador</Button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function LicenseCard({ license, onCopy }: { license: any; onCopy: () => void }) {
  const cloner = license.product === "cloner";
  return (
    <article className="min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0B0B0B] p-5 sm:p-6">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">{cloner ? <Sparkles className="h-4 w-4 shrink-0" /> : <KeyRound className="h-4 w-4 shrink-0" />}<span className="text-[9px] font-black uppercase tracking-widest">{cloner ? "Extensão Clonador" : "Extensão Principal"}</span></div>
          <h2 className="mt-2 break-words text-lg font-black uppercase">{license.planName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{license.durationLabel || "Validade do plano"}</p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[8px] font-black uppercase text-amber-300">Aguardando ativação</span>
      </div>

      <div className="mt-5 min-w-0 rounded-2xl border border-primary/20 bg-primary/[.05] p-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sua licença</p>
        <code className="mt-2 block break-all font-mono text-base font-black leading-relaxed text-primary sm:text-lg">{license.token}</code>
        <Button type="button" variant="ghost" className="mt-3 w-full border border-white/10" onClick={onCopy}><Copy className="mr-2 h-4 w-4" /> Copiar licença</Button>
      </div>
      <p className="mt-4 break-words text-[10px] leading-relaxed text-white/35">O contador ainda não começou. Ele inicia quando esta licença for usada pela primeira vez na extensão correspondente.</p>
    </article>
  );
}

function StatusCard({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[.03] p-6 text-center sm:p-10">
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-6 break-words text-2xl font-black uppercase">{title}</h1>
      <p className="mt-2 break-words text-sm leading-relaxed text-white/45">{text}</p>
      {children}
    </div>
  );
}

function Restricted() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#050505] px-4 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[.03] p-8 text-center">
        <LockKeyhole className="mx-auto h-9 w-9 text-primary" />
        <h1 className="mt-5 text-2xl font-black uppercase">Entrega protegida</h1>
        <p className="mt-2 text-sm text-white/45">Abra esta tela através de uma compra válida do Clonador.</p>
        <Button asChild variant="neon" className="mt-6 w-full"><Link to="/clonagem">Ver planos do Clonador</Link></Button>
      </div>
    </div>
  );
}
