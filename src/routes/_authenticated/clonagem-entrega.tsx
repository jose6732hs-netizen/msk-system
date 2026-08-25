import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { CheckCircle2, Copy, Download, FileArchive, KeyRound, Loader2, LockKeyhole, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MskLogo } from "@/components/msk/logo";
import { getPaidClonerDelivery, getPaidClonerDownload, trackClonerPublic } from "@/lib/cloner.functions";
import { getVisitorId } from "@/lib/urls";

export const Route = createFileRoute("/_authenticated/clonagem-entrega")({
  validateSearch: (search: Record<string, unknown>) => ({ transactionId: String(search["transactionId"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Sua licença de clonagem — MSK SISTEM" },
      { name: "description", content: "Entrega segura da licença e do arquivo do MSK Clonador de Páginas." },
    ],
  }),
  component: ClonagemEntrega,
});

function human(bytes?: number | null) {
  if (!bytes) return "Arquivo ZIP";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ClonagemEntrega() {
  const { transactionId } = useSearch({ from: "/_authenticated/clonagem-entrega" });
  const [downloading, setDownloading] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["cloner-delivery", transactionId],
    queryFn: () => getPaidClonerDelivery({ data: { transactionId } }),
    enabled: /^[0-9a-f-]{36}$/i.test(transactionId),
    retry: false,
    refetchInterval: (query) => query.state.data?.paid ? false : 3000,
  });

  useEffect(() => {
    if (!data?.paid || celebrated) return;
    setCelebrated(true);
    const id = window.setTimeout(() => {
      void confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }, 100);
    return () => window.clearTimeout(id);
  }, [data?.paid, celebrated]);

  async function copyToken() {
    if (!data?.paid) return;
    await navigator.clipboard.writeText(data.license.token ?? "");
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
      await trackClonerPublic({ data: { event: "cloner.share", visitorId: getVisitorId(), source: "delivery" } });
      if (navigator.share) await navigator.share({ title: "MSK Clonador de Páginas", text: "Confira o MSK Clonador de Páginas.", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Não foi possível compartilhar.");
    }
  }

  if (!transactionId) return <Restricted />;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute left-1/2 top-0 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[160px]" /></div>
      <header className="relative z-10 mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Link to="/"><MskLogo size={34} /></Link>
        <Button variant="ghost" onClick={shareCheckout}><Share2 className="mr-2 h-4 w-4" /> Compartilhar</Button>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-5 py-10 sm:py-16">
        {isLoading || (!data && !error) ? (
          <div className="mx-auto max-w-xl rounded-[2.5rem] border border-white/10 bg-white/[.03] p-10 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-6 text-2xl font-black uppercase">Confirmando pagamento</h1>
            <p className="mt-2 text-sm text-white/40">A licença e o ZIP permanecem bloqueados até o gateway confirmar o PIX.</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-xl rounded-[2.5rem] border border-red-500/20 bg-red-500/10 p-10 text-center">
            <LockKeyhole className="mx-auto h-10 w-10 text-red-400" />
            <h1 className="mt-5 text-2xl font-black uppercase">Não foi possível liberar</h1>
            <p className="mt-2 text-sm text-white/50">{(error as Error).message}</p>
            <Button className="mt-6" variant="neon" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        ) : data && !data.paid ? (
          <div className="mx-auto max-w-xl rounded-[2.5rem] border border-amber-400/20 bg-amber-400/10 p-10 text-center">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-amber-300" />
            <h1 className="mt-5 text-2xl font-black uppercase">PIX ainda pendente</h1>
            <p className="mt-2 text-sm text-white/50">Status atual: {data.status}. Esta página verifica automaticamente a confirmação.</p>
            <Button asChild variant="ghost" className="mt-5"><Link to="/clonagem">Voltar ao checkout</Link></Button>
          </div>
        ) : data?.paid ? (
          <div className="space-y-8">
            <div className="text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/5"><CheckCircle2 className="h-10 w-10 text-emerald-400" /></div>
              <p className="mt-7 text-[10px] font-black uppercase tracking-[.25em] text-primary">Pagamento confirmado</p>
              <h1 className="mt-2 text-4xl font-black uppercase tracking-tighter sm:text-6xl">Sua clonagem foi liberada</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-white/45">Abaixo estão sua licença individual e o pacote privado da extensão. Guarde o token em local seguro.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[2rem] border border-primary/20 bg-primary/[.06] p-6 sm:p-8">
                <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary"><KeyRound className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Licença da extensão</p><h2 className="text-lg font-black">{data.license.planName}</h2></div></div>
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5">
                  <p className="break-all font-mono text-lg font-black tracking-wide text-primary sm:text-xl">{data.license.token}</p>
                </div>
                <Button variant="neon" className="mt-4 w-full" onClick={copyToken}><Copy className="mr-2 h-4 w-4" /> Copiar licença</Button>
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <Info label="Status" value={data.license.status === "inactive" ? "Aguardando ativação" : data.license.status} />
                  <Info label="Validade" value={data.license.isLifetime ? "Vitalícia" : data.license.durationLabel || "Do plano"} />
                </div>
                {data.license.status === "inactive" ? <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">A licença ainda não foi usada. Quando aplicável, a contagem de validade começa somente na primeira ativação.</p> : null}
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6 sm:p-8">
                <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-primary"><FileArchive className="h-5 w-5" /></div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Arquivo privado</p><h2 className="truncate text-lg font-black">{data.file.name || "Extensão de clonagem.zip"}</h2></div></div>
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center justify-between gap-4"><span className="text-xs uppercase tracking-widest text-muted-foreground">Tamanho</span><strong>{human(data.file.sizeBytes)}</strong></div>
                  <div className="mt-3 flex items-center justify-between gap-4"><span className="text-xs uppercase tracking-widest text-muted-foreground">Proteção</span><strong className="text-emerald-400">URL assinada</strong></div>
                </div>
                <Button variant="neon" className="mt-4 h-13 w-full" disabled={downloading || !data.file.ready} onClick={download}>{downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Baixar arquivo ZIP</Button>
                <div className="mt-5 flex gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><p className="text-xs leading-relaxed text-white/45">O botão cria um link temporário de 5 minutos. Sem pagamento confirmado, o servidor não gera esse link.</p></div>
              </section>
            </div>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="neonOutline"><Link to="/painel">Ir para meu painel</Link></Button>
              <Button variant="ghost" onClick={shareCheckout}><Share2 className="mr-2 h-4 w-4" /> Compartilhar ferramenta</Button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 truncate font-bold capitalize">{value}</p></div>;
}

function Restricted() {
  return <div className="grid min-h-screen place-items-center bg-[#050505] p-5"><div className="max-w-md rounded-[2rem] border border-white/10 bg-white/[.03] p-10 text-center"><LockKeyhole className="mx-auto h-9 w-9 text-primary" /><h1 className="mt-5 text-xl font-black uppercase">Transação necessária</h1><p className="mt-2 text-sm text-white/40">Abra esta página a partir do checkout após o pagamento.</p><Button asChild variant="neon" className="mt-6"><Link to="/clonagem">Ir ao checkout</Link></Button></div></div>;
}
