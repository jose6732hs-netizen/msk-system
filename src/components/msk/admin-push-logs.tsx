import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { adminPushLogs } from "@/lib/push.functions";

const ROLES = [
  { value: "all", label: "Todos" },
  { value: "user", label: "Clientes" },
  { value: "affiliate", label: "Afiliados" },
  { value: "admin", label: "Admins" },
];

const EVENTS = [
  { value: "all", label: "Todos os eventos" },
  { value: "pix_created", label: "Venda gerada" },
  { value: "pix_approved", label: "Pagamento aprovado" },
  { value: "sale_approved", label: "Venda aprovada" },
  { value: "commission_earned", label: "Comissão" },
];

function statusBadge(status: string) {
  if (status === "delivered") return <Badge className="bg-emerald-600 text-white">Entregue</Badge>;
  if (status === "failed") return <Badge variant="destructive">Falhou</Badge>;
  if (status === "expired") return <Badge className="bg-amber-600 text-white">Expirado</Badge>;
  return <Badge variant="secondary">Sem dispositivo</Badge>;
}

export function AdminPushLogsTab() {
  const logsFn = useServerFn(adminPushLogs);
  const [role, setRole] = useState("all");
  const [event, setEvent] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["push-logs", role, event, search],
    queryFn: () => logsFn({ data: { role, event, search: search.trim() || undefined } }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Auditoria de notificações push</h3>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Atualizar</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Registros", value: data?.stats.total ?? 0 },
          { label: "Entregues", value: data?.stats.delivered ?? 0 },
          { label: "Falhas", value: data?.stats.failed ?? 0 },
          { label: "Sem dispositivo", value: data?.stats.noDevice ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {EVENTS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou conteúdo"
          className="w-full sm:w-64"
        />
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && (data?.logs.length ?? 0) === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>
        )}
        {data?.logs.map((log: any) => {
          const expanded = open === log.id;
          return (
            <div key={log.id} className="rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : log.id)}
                className="flex w-full flex-col gap-2 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">{log.recipient_role}</Badge>
                    <span className="truncate text-sm font-medium">{log.title}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-xs text-muted-foreground">
                    {log.body}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {log.recipient} · {new Date(log.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(log.status)}
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </button>
              {expanded && (
                <div className="space-y-2 border-t border-border p-4 text-xs">
                  <p><strong>Evento:</strong> {log.event_type}</p>
                  <p><strong>Transação:</strong> {log.transaction_id ?? "—"}</p>
                  <p className="break-all"><strong>Endpoint:</strong> {log.endpoint ?? "—"}</p>
                  <p><strong>HTTP:</strong> {log.http_status ?? "—"}</p>
                  {log.error && <p className="text-destructive"><strong>Erro:</strong> {log.error}</p>}
                  <div>
                    <strong>Payload:</strong>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px]">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
