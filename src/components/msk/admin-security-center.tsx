import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  MonitorSmartphone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Siren,
  Trash2,
  UnlockKeyhole,
  UserX,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  securityCenterBuildAction,
  securityCenterDismissMessage,
  securityCenterInstallationAction,
  securityCenterOverview,
} from "@/lib/security-center.functions";

const FILTERS = [
  ["ALL", "Todos"],
  ["ACTIVE", "Ativos"],
  ["PENDING", "Pendentes"],
  ["SUSPICIOUS", "Suspeitos"],
  ["TAMPERED", "Adulterados"],
  ["CLONED", "Clonados"],
  ["BLOCKED", "Bloqueados"],
  ["REVOKED", "Revogados"],
  ["LICENSE_EXPIRED", "Licença expirada"],
] as const;

type InstallAction =
  | "BLOCK"
  | "UNBLOCK"
  | "REVOKE_SESSIONS"
  | "REVOKE_LICENSE"
  | "FORCE_REAUTH"
  | "REMOVE_DEVICE"
  | "MARK_TRUSTED"
  | "INVESTIGATE"
  | "BLOCK_USER";

type MessageScope = "INCIDENT" | "BLOCK";

function dateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

function shortId(value?: string | null) {
  const text = String(value || "");
  return text.length > 22 ? `${text.slice(0, 8)}…${text.slice(-8)}` : text || "—";
}

function trustClass(status: string) {
  if (["BLOCKED", "TAMPERED", "CLONED", "REVOKED"].includes(status)) return "border-red-500/40 bg-red-500/10 text-red-200";
  if (["SUSPICIOUS", "LICENSE_EXPIRED", "PENDING"].includes(status)) return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function integrityClass(status: string) {
  if (status === "FAILED") return "text-red-300";
  if (status === "VERIFIED") return "text-emerald-300";
  if (status === "PENDING") return "text-amber-300";
  return "text-muted-foreground";
}

function incidentMessageHidden(row: any) {
  return Boolean(
    row.message_hidden_at
      && row.message_hidden_incident_code === row.incident_code
      && row.message_hidden_block_reason === row.block_reason,
  );
}

export function AdminSecurityCenter() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(securityCenterOverview);
  const actionFn = useServerFn(securityCenterInstallationAction);
  const dismissMessageFn = useServerFn(securityCenterDismissMessage);
  const buildActionFn = useServerFn(securityCenterBuildAction);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["msk-security-center"],
    queryFn: () => overviewFn(),
    refetchInterval: 15_000,
  });

  const installations = (query.data?.installations ?? []) as any[];
  const events = (query.data?.events ?? []) as any[];
  const sessions = (query.data?.sessions ?? []) as any[];
  const blocks = (query.data?.blocks ?? []) as any[];
  const builds = (query.data?.builds ?? []) as any[];
  const ips = (query.data?.ips ?? []) as any[];
  const stats = query.data?.stats as any;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return installations.filter((row) => {
      if (filter !== "ALL" && row.trust_status !== filter) return false;
      if (!q) return true;
      const haystack = [
        row.profile?.name,
        row.profile?.email,
        row.installation_id,
        row.license?.token_preview,
        row.license?.token_last4,
        row.license?.plans?.name,
        row.extension_version,
        row.build_id,
        row.browser_name,
        row.os_family,
        row.last_ip,
        row.block_reason,
        row.incident_code,
      ].map((value) => String(value || "").toLowerCase());
      return haystack.some((value) => value.includes(q));
    });
  }, [installations, filter, search]);

  const mutate = useMutation({
    mutationFn: async ({ row, action }: { row: any; action: InstallAction }) => {
      const destructive = ["BLOCK", "REVOKE_LICENSE", "REMOVE_DEVICE", "BLOCK_USER"].includes(action);
      const labels: Record<InstallAction, string> = {
        BLOCK: "Bloquear esta instalação",
        UNBLOCK: "Desbloquear esta instalação",
        REVOKE_SESSIONS: "Revogar todas as sessões desta instalação",
        REVOKE_LICENSE: "Revogar a licença deste cliente",
        FORCE_REAUTH: "Forçar nova autenticação",
        REMOVE_DEVICE: "Remover este dispositivo da licença",
        MARK_TRUSTED: "Marcar esta instalação como confiável",
        INVESTIGATE: "Marcar esta instalação para investigação",
        BLOCK_USER: "Bloquear todas as instalações deste usuário",
      };
      if (!window.confirm(`${labels[action]}?${destructive ? " Esta ação corta acesso imediatamente." : ""}`)) {
        throw new Error("CANCELLED");
      }
      let reason: string | null = null;
      if (["BLOCK", "REVOKE_LICENSE", "INVESTIGATE", "BLOCK_USER"].includes(action)) {
        reason = window.prompt("Motivo da ação (será registrado na auditoria):", row.block_reason || row.incident_code || "")?.trim() || null;
      }
      return actionFn({ data: { installationId: row.installation_id, action, reason } });
    },
    onSuccess: () => {
      toast.success("Ação de segurança aplicada e registrada na auditoria.");
      qc.invalidateQueries({ queryKey: ["msk-security-center"] });
      qc.invalidateQueries({ queryKey: ["extension-device-security"] });
    },
    onError: (error: Error) => {
      if (error.message !== "CANCELLED") toast.error(error.message || "Não foi possível aplicar a ação.");
    },
  });

  const dismissMessageMutation = useMutation({
    mutationFn: async ({ row, scope, blockId }: { row: any; scope: MessageScope; blockId?: string | null }) => {
      if (!window.confirm("Excluir esta mensagem do painel? O bloqueio, a classificação de segurança e a auditoria serão mantidos.")) {
        throw new Error("CANCELLED");
      }
      return dismissMessageFn({
        data: {
          installationId: row.installation_id,
          scope,
          blockId: blockId ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Mensagem excluída do painel. O bloqueio e a auditoria foram preservados.");
      qc.invalidateQueries({ queryKey: ["msk-security-center"] });
    },
    onError: (error: Error) => {
      if (error.message !== "CANCELLED") toast.error(error.message || "Não foi possível excluir a mensagem.");
    },
  });

  const buildMutation = useMutation({
    mutationFn: async (build: any) => {
      const action = build.active ? "BLOCK" : "UNBLOCK";
      const reason = action === "BLOCK"
        ? window.prompt("Motivo para bloquear este build inteiro:", "Build revogado pelo Security Center.")?.trim() || null
        : "Build liberado pelo Security Center.";
      if (action === "BLOCK" && !window.confirm(`Bloquear o build ${build.build_id}? Sessões desse build serão revogadas.`)) throw new Error("CANCELLED");
      return buildActionFn({ data: { buildId: build.build_id, action, reason } });
    },
    onSuccess: () => {
      toast.success("Kill switch do build atualizado.");
      qc.invalidateQueries({ queryKey: ["msk-security-center"] });
    },
    onError: (error: Error) => {
      if (error.message !== "CANCELLED") toast.error(error.message || "Falha ao alterar o build.");
    },
  });

  const cards = [
    ["Instalações ativas", Number(stats?.active ?? 0), ShieldCheck, "text-emerald-300"],
    ["Instalações bloqueadas", Number(stats?.blocked ?? 0), Ban, "text-red-300"],
    ["Tentativas de adulteração", Number(stats?.tampered ?? 0), ShieldX, "text-red-300"],
    ["Possíveis clones", Number(stats?.cloned ?? 0), Fingerprint, "text-fuchsia-300"],
    ["Licenças expiradas", Number(stats?.expired ?? 0), Clock3, "text-amber-300"],
    ["Novos / pendentes", Number(stats?.pending ?? 0), MonitorSmartphone, "text-cyan-300"],
    ["Eventos críticos 24h", Number(stats?.critical24h ?? 0), Siren, "text-red-300"],
  ] as const;

  return (
    <section className="space-y-5 rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-background to-purple-500/[0.04] p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[0.6rem] font-black uppercase tracking-[0.24em] text-primary/70">MSK Security Center</p>
            <h4 className="mt-1 text-base font-black uppercase tracking-widest">Segurança &gt; Instalações</h4>
            <p className="mt-2 max-w-4xl text-xs leading-relaxed text-muted-foreground">
              Controle central de confiança, integridade, licença, sessões e bloqueios. Instalações matriculadas no protocolo novo exigem build oficial e sessão curta; versões legadas continuam compatíveis até concluírem o handshake.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {cards.map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-2"><p className="text-[0.56rem] font-black uppercase tracking-widest text-muted-foreground">{label}</p><Icon className={`h-4 w-4 ${color}`} /></div>
            <p className="mt-2 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-full border px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-widest transition ${filter === id ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full xl:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Cliente, licença, ID, IP, build..." />
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid min-h-48 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">Nenhuma instalação neste filtro.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const isOpen = expanded === row.installation_id;
            const rowEvents = events.filter((event) => event.installation_id === row.installation_id).slice(0, 12);
            const rowSessions = sessions.filter((session) => session.installation_id === row.installation_id).slice(0, 10);
            const rowBlocks = blocks.filter((block) => block.installation_id === row.installation_id && !block.message_hidden_at).slice(0, 10);
            const rowIps = ips.filter((item) => item.installation_id === row.installation_id).slice(0, 10);
            const showIncidentMessage = (row.block_reason || row.incident_code) && !incidentMessageHidden(row);
            return (
              <article key={row.installation_id} className={`rounded-2xl border ${trustClass(row.trust_status)} bg-background/45`}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : row.installation_id)} className="grid w-full gap-4 p-4 text-left xl:grid-cols-[1.35fr_1fr_1fr_1fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><MonitorSmartphone className="h-4 w-4" /><span className="truncate font-bold">{row.profile?.name || "Cliente"}</span><span className="truncate text-xs opacity-70">{row.profile?.email || "—"}</span></div>
                    <p className="mt-1 font-mono text-[0.62rem] opacity-70">{shortId(row.installation_id)}</p>
                  </div>
                  <div className="text-xs"><p className="font-bold">{row.license?.plans?.name || "Licença"}</p><p className="mt-1 opacity-70">{row.license?.token_preview || (row.license?.token_last4 ? `••••${row.license.token_last4}` : "—")}</p></div>
                  <div className="text-xs"><p>{row.extension_version || "Versão —"}</p><p className="mt-1 font-mono text-[0.62rem] opacity-70">{shortId(row.build_id)}</p></div>
                  <div className="text-xs"><p>{row.browser_name || "Navegador —"} · {row.os_family || "SO —"}</p><p className="mt-1 opacity-70">{dateTime(row.last_seen_at)}</p></div>
                  <div className="flex items-center justify-end gap-3"><span className={`text-[0.62rem] font-black uppercase ${integrityClass(row.integrity_status)}`}>{row.integrity_status}</span><span className="rounded-full border border-current/20 px-2 py-1 text-[0.58rem] font-black uppercase">{row.trust_status}</span>{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
                </button>

                {isOpen ? (
                  <div className="border-t border-current/10 p-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-xs">
                      <div className="rounded-xl border border-border/50 bg-black/15 p-3"><p className="text-[0.55rem] font-black uppercase text-muted-foreground">Primeira ativação</p><p className="mt-1">{dateTime(row.first_seen_at)}</p></div>
                      <div className="rounded-xl border border-border/50 bg-black/15 p-3"><p className="text-[0.55rem] font-black uppercase text-muted-foreground">IP recente</p><p className="mt-1 font-mono">{row.last_ip || "—"}</p></div>
                      <div className="rounded-xl border border-border/50 bg-black/15 p-3"><p className="text-[0.55rem] font-black uppercase text-muted-foreground">Última integridade</p><p className="mt-1">{dateTime(row.last_integrity_check)}</p></div>
                      <div className="rounded-xl border border-border/50 bg-black/15 p-3"><p className="text-[0.55rem] font-black uppercase text-muted-foreground">Sessão protegida</p><p className="mt-1">{row.session_required ? "Obrigatória" : "Compatibilidade legada"}</p></div>
                    </div>

                    {showIncidentMessage ? (
                      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0"><AlertTriangle className="mr-2 inline h-4 w-4" /><b>{row.incident_code || "Incidente"}</b> — {row.block_reason || "Em análise"}</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-red-200 hover:text-red-100"
                          disabled={dismissMessageMutation.isPending}
                          onClick={() => dismissMessageMutation.mutate({ row, scope: "INCIDENT" })}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir mensagem
                        </Button>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {row.trust_status === "BLOCKED" ? <Button size="sm" variant="outline" onClick={() => mutate.mutate({ row, action: "UNBLOCK" })}><UnlockKeyhole className="mr-1.5 h-3.5 w-3.5" />Desbloquear</Button> : <Button size="sm" variant="destructive" onClick={() => mutate.mutate({ row, action: "BLOCK" })}><Ban className="mr-1.5 h-3.5 w-3.5" />Bloquear instalação</Button>}
                      <Button size="sm" variant="outline" onClick={() => mutate.mutate({ row, action: "REVOKE_SESSIONS" })}><LockKeyhole className="mr-1.5 h-3.5 w-3.5" />Revogar sessões</Button>
                      <Button size="sm" variant="outline" onClick={() => mutate.mutate({ row, action: "FORCE_REAUTH" })}><KeyRound className="mr-1.5 h-3.5 w-3.5" />Nova autenticação</Button>
                      <Button size="sm" variant="outline" onClick={() => mutate.mutate({ row, action: "REMOVE_DEVICE" })}><MonitorSmartphone className="mr-1.5 h-3.5 w-3.5" />Remover dispositivo</Button>
                      <Button size="sm" variant="outline" onClick={() => mutate.mutate({ row, action: "MARK_TRUSTED" })}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Marcar confiável</Button>
                      <Button size="sm" variant="outline" onClick={() => mutate.mutate({ row, action: "INVESTIGATE" })}><Wrench className="mr-1.5 h-3.5 w-3.5" />Investigar</Button>
                      <Button size="sm" variant="destructive" onClick={() => mutate.mutate({ row, action: "REVOKE_LICENSE" })}><ShieldAlert className="mr-1.5 h-3.5 w-3.5" />Revogar licença</Button>
                      <Button size="sm" variant="destructive" onClick={() => mutate.mutate({ row, action: "BLOCK_USER" })}><UserX className="mr-1.5 h-3.5 w-3.5" />Bloquear usuário</Button>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-border/50 bg-black/15 p-4"><h5 className="text-[0.62rem] font-black uppercase tracking-widest">Timeline de integridade</h5><div className="mt-3 space-y-2">{rowEvents.length ? rowEvents.map((event) => <div key={event.id} className="rounded-xl border border-border/40 p-3 text-xs"><div className="flex items-center justify-between gap-3"><b>{event.event_type}</b><span className="text-[0.58rem] uppercase opacity-70">{event.severity}</span></div><p className="mt-1 opacity-70">{dateTime(event.created_at)} · {event.affected_file || event.metadata?.reason || event.received_build || "verificação"}</p></div>) : <p className="text-xs text-muted-foreground">Sem eventos registrados.</p>}</div></div>
                      <div className="rounded-2xl border border-border/50 bg-black/15 p-4"><h5 className="text-[0.62rem] font-black uppercase tracking-widest">Sessões e IPs observados</h5><div className="mt-3 space-y-2">{rowSessions.slice(0, 5).map((session) => <div key={session.id} className="flex items-center justify-between rounded-xl border border-border/40 p-3 text-xs"><span>{session.revoked_at ? "Revogada" : new Date(session.expires_at).getTime() > Date.now() ? "Ativa" : "Expirada"}</span><span className="font-mono opacity-70">{session.ip || "—"}</span><span className="opacity-70">{dateTime(session.issued_at)}</span></div>)}{rowIps.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/40 p-3 text-xs"><span className="font-mono">{item.ip}</span><span className="opacity-70">Último: {dateTime(item.last_seen_at)}</span></div>)}{!rowSessions.length && !rowIps.length ? <p className="text-xs text-muted-foreground">Sem histórico de sessão/IP.</p> : null}</div></div>
                    </div>

                    {rowBlocks.length ? (
                      <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4">
                        <h5 className="text-[0.62rem] font-black uppercase tracking-widest text-red-200">Histórico de bloqueios</h5>
                        <div className="mt-2 space-y-2">
                          {rowBlocks.map((block) => (
                            <div key={block.id} className="flex flex-col gap-2 rounded-xl border border-red-500/10 p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                              <div><b>{block.block_type}</b> · {block.reason} · {dateTime(block.created_at)}{block.released_at ? ` · liberado ${dateTime(block.released_at)}` : " · ativo"}</div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="shrink-0 text-red-200 hover:text-red-100"
                                disabled={dismissMessageMutation.isPending}
                                onClick={() => dismissMessageMutation.mutate({ row, scope: "BLOCK", blockId: block.id })}
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir mensagem
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-4">
        <div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-purple-300" /><h5 className="text-[0.65rem] font-black uppercase tracking-widest">Kill switch de builds oficiais</h5></div>
        <p className="mt-1 text-xs text-muted-foreground">Bloquear um build revoga suas sessões e impede novos handshakes. Desbloquear o build não libera automaticamente instalações já bloqueadas; elas continuam exigindo revisão.</p>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">{builds.map((build) => <div key={build.build_id} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold">{build.build_id}</p><p className="mt-1 font-mono text-[0.6rem] text-muted-foreground">v{build.version} · {shortId(build.manifest_hash || build.build_fingerprint)}</p></div><Button size="sm" variant={build.active ? "destructive" : "outline"} disabled={buildMutation.isPending} onClick={() => buildMutation.mutate(build)}>{build.active ? <Ban className="mr-1.5 h-3.5 w-3.5" /> : <UnlockKeyhole className="mr-1.5 h-3.5 w-3.5" />}{build.active ? "Bloquear build" : "Liberar build"}</Button></div>)}</div>
      </div>
    </section>
  );
}
