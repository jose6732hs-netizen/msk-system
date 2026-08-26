import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bot, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAgentAccess } from "@/lib/agent-access.functions";
import { getAgentExtensionDownload } from "@/lib/agent-download.functions";

export function AgentAccessCard() {
  const load = useServerFn(getAgentAccess);
  const prepareDownload = useServerFn(getAgentExtensionDownload);
  const [downloading, setDownloading] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["agent-access"],
    queryFn: () => load({}),
    staleTime: 60_000,
  });

  const status = data?.status ?? "none";
  const label =
    status === "active" ? "Acesso ativo" : status === "expired" ? "Acesso expirado" : "Sem acesso";

  async function downloadAgent() {
    const licenseId = data?.license?.id;
    if (!licenseId || downloading) return;
    setDownloading(true);
    try {
      const result = await prepareDownload({ data: { licenseId } });
      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.download = result.fileName;
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success(`MSK Agente ${result.version} pronto para download.`);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível baixar o MSK Agente agora.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="glass mb-6 rounded-2xl border border-primary/20 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">
              MSK <span className="neon-text">Agente</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              {isLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Verificando…
                </span>
              ) : (
                <>
                  {label}
                  {data?.plan?.name ? ` · ${data.plan.name}` : ""}
                  {data?.license?.expires_at
                    ? ` · até ${new Date(data.license.expires_at).toLocaleDateString("pt-BR")}`
                    : ""}
                </>
              )}
            </p>
            {status === "active" && data?.license?.id ? (
              <p className="mt-1 text-[10px] font-medium text-white/40">
                Sua licença também libera o ZIP oficial da extensão MSK Agente.
              </p>
            ) : null}
          </div>
        </div>

        {status === "active" ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {data?.license?.id ? (
              <Button
                size="sm"
                variant="neon"
                className="min-h-10"
                onClick={() => void downloadAgent()}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Baixar ZIP do Agente
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={data?.license?.id ? "neonOutline" : "default"}
              onClick={() => window.dispatchEvent(new CustomEvent("msk:open-agent"))}
            >
              Abrir MSK Agente
            </Button>
          </div>
        ) : (
          <Button asChild size="sm">
            <Link to="/planos" hash="msk-agente">
              {status === "expired" ? "Renovar acesso" : "Garantir acesso"}
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
