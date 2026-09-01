import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  Loader2,
  PlugZap,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  extensionErrorsAdminFeed,
  extensionErrorsAdminResolveCode,
  extensionErrorsAdminSetResolved,
} from "@/lib/extension-errors-admin.functions";

type Severity = "all" | "critical" | "error" | "warning" | "info";
type Status = "all" | "open" | "resolved";

const severityStyle: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  error: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-300",
};

const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "—");

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/20 bg-background/45 p-3",
        tone === "good" && "border-primary/40 bg-primary/5",
        tone === "bad" && "border-rose-500/40 bg-rose-500/5",
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-black tabular-nums",
          tone === "good" && "text-primary",
          tone === "bad" && "text-rose-300",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AdminExtensionErrors() {
  const qc = useQueryClient();
  const feedFn = useServerFn(extensionErrorsAdminFeed);
  const resolveFn = useServerFn(extensionErrorsAdminSetResolved);
  const resolveCodeFn = useServerFn(extensionErrorsAdminResolveCode);

  const [days, setDays] = useState(7);
  const [severity, setSeverity] = useState<Severity>("all");
  const [status, setStatus] = useState<Status>("open");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["extension-errors-feed", days, severity, status, search],
    queryFn: () =>
      feedFn({ data: { days, severity, status, search: search.trim() || null, limit: 120 } }),
    refetchInterval: 15_000,
  });

  // Conexão em tempo real com a extensão: qualquer erro/heartbeat novo atualiza o painel.
  useEffect(() => {
    const channel = supabase
      .channel("admin-extension-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "extension_errors" }, () => {
        qc.invalidateQueries({ queryKey: ["extension-errors-feed"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "extension_installations" },
        () => qc.invalidateQueries({ queryKey: ["extension-errors-feed"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const resolve = useMutation({
    mutationFn: (v: { id: string; resolved: boolean }) => resolveFn({ data: v }),
    onSuccess: () => {
      toast.success("Erro atualizado.");
      qc.invalidateQueries({ queryKey: ["extension-errors-feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveCode = useMutation({
    mutationFn: (code: string) => resolveCodeFn({ data: { code } }),
    onSuccess: () => {
      toast.success("Todos os erros deste código foram resolvidos.");
      qc.invalidateQueries({ queryKey: ["extension-errors-feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = query.data;
  const conn = data?.connection;
  const connected = (conn?.latencySeconds ?? 9999) < 15 * 60;

  function goToUpload() {
    const target = document.getElementById("extension-upload");
    if (!target) {
      toast.error("Bloco de publicação não encontrado nesta aba.");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ring-2", "ring-primary/60");
    window.setTimeout(() => target.classList.remove("ring-2", "ring-primary/60"), 2500);
  }

  return (
    <div className="space-y-5 rounded-3xl border border-border/60 bg-card/30 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
            <Bug className="h-4 w-4 text-primary" /> Erros da extensão · conexão ao vivo
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tudo que a extensão reporta chega aqui em tempo real. No final você troca o arquivo publicado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
              connected
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected ? "animate-pulse bg-primary" : "bg-rose-400",
              )}
            />
            {connected ? "Conectada" : "Sem sinal"}
          </span>
          <Button variant="glass" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Online agora"
          value={conn?.online ?? 0}
          hint={`${conn?.active15m ?? 0} nos últimos 15 min`}
          tone="good"
        />
        <Metric
          label="Último heartbeat"
          value={conn?.latencySeconds != null ? `${conn.latencySeconds}s` : "—"}
          hint={fmt(conn?.lastSeenAt)}
        />
        <Metric
          label="Comandos na fila"
          value={conn?.pendingCommands ?? 0}
          hint={`${conn?.deliveredCommands ?? 0} entregues aguardando ACK`}
        />
        <Metric
          label="Erros abertos"
          value={data?.totals.open ?? 0}
          hint={`${data?.totals.critical ?? 0} críticos · ${data?.totals.last24h ?? 0} em 24h`}
          tone={(data?.totals.critical ?? 0) > 0 ? "bad" : "default"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
          aria-label="Período"
        >
          {[1, 7, 14, 30, 90].map((d) => (
            <option key={d} value={d}>
              Últimos {d} dia{d === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
          aria-label="Gravidade"
        >
          <option value="all">Todas gravidades</option>
          <option value="critical">Crítico</option>
          <option value="error">Erro</option>
          <option value="warning">Aviso</option>
          <option value="info">Info</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
          aria-label="Status"
        >
          <option value="open">Somente abertos</option>
          <option value="resolved">Resolvidos</option>
          <option value="all">Todos</option>
        </select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, versão, instalação, mensagem..."
          className="h-9 w-full max-w-sm text-xs"
        />
      </div>

      {(data?.topCodes.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {data!.topCodes.map((row) => (
            <button
              key={row.name}
              type="button"
              onClick={() => setSearch(row.name)}
              className="rounded-full border border-primary/25 bg-background/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition hover:border-primary/60 hover:text-primary"
            >
              {row.name} · {row.value}
            </button>
          ))}
        </div>
      )}

      {query.isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/60 p-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
        </div>
      ) : (data?.errors.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <p className="text-sm text-muted-foreground">Nenhum erro no filtro selecionado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.errors.map((row) => {
            const open = openId === row.id;
            return (
              <div
                key={row.id}
                className={cn(
                  "rounded-2xl border bg-background/40 transition",
                  row.resolved ? "border-border/50 opacity-70" : "border-primary/20",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : row.id)}
                  className="flex w-full flex-wrap items-center gap-3 p-3 text-left"
                >
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest",
                      severityStyle[row.severity] ?? severityStyle.info,
                    )}
                  >
                    {row.severity}
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground">{row.code}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {row.title || row.userMessage || row.technicalMessage || "Sem descrição"}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    v{row.version ?? "—"} · {fmt(row.createdAt)}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
                </button>

                {open && (
                  <div className="space-y-3 border-t border-border/50 p-3">
                    <div className="grid gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                      <p>
                        <span className="text-muted-foreground">Usuário: </span>
                        {row.user?.email ?? row.user?.name ?? "—"}
                      </p>
                      <p className="truncate">
                        <span className="text-muted-foreground">Instalação: </span>
                        <code className="font-mono">{row.installationId ?? "—"}</code>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Navegador: </span>
                        {row.browser ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Ação: </span>
                        {row.action ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Provedor: </span>
                        {row.provider ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Projeto: </span>
                        {row.projectId ?? row.repository ?? "—"}
                      </p>
                    </div>

                    {row.userMessage && (
                      <p className="rounded-xl bg-background/60 p-2 text-xs">{row.userMessage}</p>
                    )}
                    {(row.technicalMessage || row.stack) && (
                      <pre className="max-h-56 overflow-auto rounded-xl border border-border/50 bg-black/40 p-3 text-[10px] leading-relaxed text-muted-foreground">
                        {[row.technicalMessage, row.stack].filter(Boolean).join("\n\n")}
                      </pre>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={row.resolved ? "glass" : "neon"}
                        disabled={resolve.isPending}
                        onClick={() => resolve.mutate({ id: row.id, resolved: !row.resolved })}
                      >
                        {row.resolved ? "Reabrir" : "Marcar como resolvido"}
                      </Button>
                      {!row.resolved && (
                        <Button
                          size="sm"
                          variant="glass"
                          disabled={resolveCode.isPending}
                          onClick={() => resolveCode.mutate(row.code)}
                        >
                          Resolver todos “{row.code}”
                        </Button>
                      )}
                      <Button size="sm" variant="glass" onClick={goToUpload}>
                        <Upload className="mr-2 h-4 w-4" /> Corrigir trocando o arquivo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <PlugZap className="h-4 w-4" /> Trocar o arquivo da extensão
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Versão publicada agora:{" "}
              <strong className="text-foreground">
                {conn?.publishedBuild
                  ? `v${conn.publishedBuild.version} · ${conn.publishedBuild.file_name}`
                  : "nenhuma"}
              </strong>
              . Envie um novo .zip e ele passa a ser servido no download imediatamente.
            </p>
          </div>
          <Button variant="neon" onClick={goToUpload}>
            <Upload className="mr-2 h-4 w-4" /> Enviar novo .zip
          </Button>
        </div>
        {(data?.totals.critical ?? 0) > 0 && (
          <p className="mt-3 flex items-center gap-2 text-[11px] font-bold text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Existem erros críticos abertos — recomendado publicar
            uma correção.
          </p>
        )}
      </div>
    </div>
  );
}
