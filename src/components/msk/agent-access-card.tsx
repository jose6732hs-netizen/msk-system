import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAgentAccess } from "@/lib/agent-access.functions";

export function AgentAccessCard() {
  const load = useServerFn(getAgentAccess);
  const { data, isLoading } = useQuery({
    queryKey: ["agent-access"],
    queryFn: () => load({}),
    staleTime: 60_000,
  });

  const status = data?.status ?? "none";
  const label =
    status === "active" ? "Acesso ativo" : status === "expired" ? "Acesso expirado" : "Sem acesso";

  return (
    <section className="glass mb-6 rounded-2xl border border-primary/20 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          </div>
        </div>

        {status === "active" ? (
          <Button
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent("msk:open-agent"))}
          >
            Abrir MSK Agente
          </Button>
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
