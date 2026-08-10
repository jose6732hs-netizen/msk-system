import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActiveExtensionChannels, getExtensionDownload } from "@/lib/extension.functions";

export function ExtensionDownloadCard() {
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["active-extension-channels"],
    queryFn: () => getActiveExtensionChannels(),
    refetchInterval: 60_000,
  });

  const channels = data?.channels ?? [];

  const [progress, setProgress] = useState<Record<string, number>>({});

  async function download(slug: string) {
    setBusy(slug);
    setProgress(prev => ({ ...prev, [slug]: 0 }));
    try {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const val = prev[slug] ?? 0;
          if (val >= 90) return prev;
          return { ...prev, [slug]: val + 5 };
        });
      }, 100);

      const res = await getExtensionDownload({ data: { channelSlug: slug } });
      clearInterval(interval);
      setProgress(prev => ({ ...prev, [slug]: 100 }));
      
      // Aguarda o progresso visual de 0 a 100
      let currentProgress = 0;
      while (currentProgress < 100) {
        await new Promise(r => setTimeout(r, 50));
        setProgress(p => {
          currentProgress = p[slug] ?? 0;
          return p;
        });
      }

      const a = window.document.createElement("a");
      a.href = res.url;
      a.download = res.fileName;
      a.rel = "noopener";
      a.click();
      toast.success(`${res.channelName} v${res.version}: download iniciado.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTimeout(() => {
        setBusy(null);
        setProgress(prev => {
          const n = { ...prev };
          delete n[slug];
          return n;
        });
      }, 500);
    }
  }

  return (
    <section className="glass rounded-2xl p-5 sm:p-7 lg:col-span-2">
      <h2 className="text-lg font-semibold">Extensão Chrome</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Somente as versões liberadas pelo administrador ficam disponíveis.
      </p>

      {isLoading && <Loader2 className="mt-5 h-5 w-5 animate-spin text-primary" />}

      {!isLoading && !channels.length && (
        <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
          <PackageOpen className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma extensão ativa no momento. Assim que o administrador liberar uma versão, ela
            aparece aqui.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {channels.map((c) => (
          <div
            key={c.slug}
            className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.display_name}</p>
              <p className="text-xs text-muted-foreground">
                Versão {c.version}
                {c.channel_type === "reserve" ? " · canal reserva" : " · canal principal"}
              </p>
              {c.message && <p className="mt-1 text-xs text-muted-foreground">{c.message}</p>}
            </div>
            <Button
              variant="neon"
              className="relative w-full overflow-hidden sm:w-auto"
              onClick={() => download(c.slug)}
              disabled={busy === c.slug}
            >
              {busy === c.slug ? (
                <>
                  <div 
                    className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-300" 
                    style={{ width: `${progress[c.slug] ?? 0}%` }}
                  />
                  <span className="relative z-10 flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {progress[c.slug] ?? 0}%
                  </span>
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar .zip
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <ol className="mt-5 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Descompacte o arquivo baixado.</li>
        <li>Abra chrome://extensions no navegador.</li>
        <li>Ative o "Modo do desenvolvedor".</li>
        <li>Clique em "Carregar sem compactação" e selecione a pasta.</li>
        <li>Cole seu token de licença na extensão para ativar.</li>
      </ol>
    </section>
  );
}
