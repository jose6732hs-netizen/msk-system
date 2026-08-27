import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, CheckCircle2, MessageSquare, Radio, RefreshCw, Send, ShieldAlert, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { AdminAgentCenterLive } from "@/components/msk/admin-agent-center-live";
import {
  extensionRemoteAdminOverview,
  extensionRemoteAdminSendMessage,
  extensionRemoteAdminSetBlock,
} from "@/lib/extension-remote-admin.functions";

const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

export function AdminAgentControlCenter() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(extensionRemoteAdminOverview);
  const sendFn = useServerFn(extensionRemoteAdminSendMessage);
  const blockFn = useServerFn(extensionRemoteAdminSetBlock);
  const [userId, setUserId] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [title, setTitle] = useState("Mensagem da MSK");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"info" | "success" | "warning" | "critical">("info");
  const [blockReason, setBlockReason] = useState("Bloqueado pelo administrador");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["extension-remote-admin"],
    queryFn: () => overviewFn(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const clients = data?.clients ?? [];
    if (!userId && clients[0]?.user_id) setUserId(String(clients[0].user_id));
  }, [data?.clients, userId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void qc.invalidateQueries({ queryKey: ["extension-remote-admin"] }), 120);
    };
    const channel = supabase
      .channel("msk-agent-remote-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "extension_remote_commands" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "extension_remote_controls" }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const selected = useMemo(
    () => (data?.clients ?? []).find((client: any) => String(client.user_id) === userId) ?? null,
    [data?.clients, userId],
  );

  useEffect(() => {
    setInstallationId("");
  }, [userId]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["extension-remote-admin"] });
    void qc.invalidateQueries({ queryKey: ["extension-admin-center"] });
  };

  const sendMessage = useMutation({
    mutationFn: () => sendFn({ data: {
      userId,
      installationId: installationId || null,
      title: title.trim(),
      message: message.trim(),
      severity,
    } }),
    onSuccess: () => {
      toast.success("Mensagem enviada para o canal da extensão.");
      setMessage("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setBlock = useMutation({
    mutationFn: (blocked: boolean) => blockFn({ data: {
      userId,
      blocked,
      reason: blocked ? blockReason.trim() || "Bloqueado pelo administrador" : null,
      message: blocked ? "Seu acesso ao MSK Agente foi temporariamente bloqueado. Entre em contato com o suporte MSK." : null,
    } }),
    onSuccess: (_data, blocked) => {
      toast.success(blocked ? "Cliente bloqueado no MSK Agente." : "Cliente desbloqueado.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clients = data?.clients ?? [];
  const recent = (data?.commands ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-background to-background p-5 shadow-[0_0_50px_rgba(57,255,20,.05)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary"><Radio className="h-4 w-4" /><span className="text-[0.62rem] font-black uppercase tracking-[.18em]">Canal conectado ao banco</span></div>
            <h3 className="mt-2 text-xl font-black uppercase tracking-tight">Controle remoto da extensão</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Envie avisos diretamente para o HTML da extensão do cliente ou bloqueie o acesso do MSK Agente. O comando fica salvo no servidor até a extensão receber.</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar</Button>
        </div>

        {isLoading ? <p className="mt-6 text-xs text-muted-foreground">Carregando clientes conectados…</p> : clients.length ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5 text-[0.62rem] font-black uppercase tracking-widest text-muted-foreground">
                  Cliente
                  <select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary/50">
                    {clients.map((client: any) => <option key={client.user_id} value={client.user_id}>{client.email} · {client.version}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-[0.62rem] font-black uppercase tracking-widest text-muted-foreground">
                  Destino
                  <select value={installationId} onChange={(e) => setInstallationId(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary/50">
                    <option value="">Todos os dispositivos do cliente</option>
                    {(selected?.installations ?? []).map((installation: any) => <option key={installation.installation_id} value={installation.installation_id}>{installation.browser || "Navegador"} · {installation.os || "Sistema"} · {String(installation.installation_id).slice(0, 8)}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} placeholder="Título do aviso" />
                <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                  <option value="info">Informação</option>
                  <option value="success">Sucesso</option>
                  <option value="warning">Atenção</option>
                  <option value="critical">Urgente</option>
                </select>
              </div>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={4} placeholder="Digite a mensagem que deve aparecer dentro da extensão do cliente…" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="neon" disabled={!userId || !title.trim() || !message.trim() || sendMessage.isPending} onClick={() => sendMessage.mutate()}><Send className="mr-2 h-4 w-4" /> Enviar mensagem</Button>
                <span className="self-center text-[0.62rem] text-muted-foreground">Entrega automática quando a extensão estiver online.</span>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Estado do cliente</p><p className={`mt-1 text-sm font-black ${selected?.blocked ? "text-red-400" : "text-emerald-400"}`}>{selected?.blocked ? "BLOQUEADO" : "ACESSO LIBERADO"}</p></div>
                {selected?.blocked ? <ShieldAlert className="h-6 w-6 text-red-400" /> : <CheckCircle2 className="h-6 w-6 text-emerald-400" />}
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[.025] p-3 text-xs text-muted-foreground">
                <p>{selected?.email ?? "—"}</p>
                <p className="mt-1">Último online: {fmt(selected?.last_seen_at)}</p>
                <p className="mt-1">Instalações: {selected?.installations?.length ?? 0}</p>
              </div>
              {selected?.blocked ? (
                <Button className="w-full" variant="outline" disabled={setBlock.isPending} onClick={() => setBlock.mutate(false)}><Unlock className="mr-2 h-4 w-4" /> Desbloquear cliente</Button>
              ) : (
                <>
                  <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} maxLength={300} placeholder="Motivo interno do bloqueio" />
                  <Button className="w-full" variant="destructive" disabled={setBlock.isPending} onClick={() => { if (window.confirm("Bloquear o acesso deste cliente ao MSK Agente?")) setBlock.mutate(true); }}><Ban className="mr-2 h-4 w-4" /> Bloquear cliente</Button>
                </>
              )}
            </div>
          </div>
        ) : <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Nenhuma instalação conectada ainda. Assim que um cliente usar a nova extensão, ele aparecerá aqui.</div>}

        {recent.length ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="border-b border-white/10 px-4 py-3 text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Últimos comandos remotos</div>
            <div className="divide-y divide-white/5">
              {recent.map((command: any) => (
                <div key={command.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <div className="min-w-0"><p className="truncate font-bold">{command.title || command.command_type}</p><p className="truncate text-[0.65rem] text-muted-foreground">{command.message || "Sem mensagem"} · {fmt(command.created_at)}</p></div>
                  <span className={`w-fit rounded-full border px-2 py-1 text-[0.55rem] font-black uppercase ${command.status === "acknowledged" ? "border-emerald-500/30 text-emerald-400" : command.status === "delivered" ? "border-cyan-500/30 text-cyan-400" : "border-yellow-500/30 text-yellow-400"}`}>{command.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <AdminAgentCenterLive />
    </div>
  );
}
