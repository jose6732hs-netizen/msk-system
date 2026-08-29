import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  Download,
  GitBranch,
  HardDrive,
  HeartPulse,
  Laptop,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FilterChips } from "@/components/msk/filter-chips";
import { AdminAgentTab as LegacyAdminAgentTab } from "@/components/msk/admin-agent";
import {
  extensionAdminAcknowledgeAlert,
  extensionAdminOverview,
  extensionAdminResolveError,
  extensionAdminResolveIncident,
  extensionAdminSaveRelease,
} from "@/lib/extension-admin.functions";
import { adminCreateUploadUrl, adminRegisterBuild } from "@/lib/extension.functions";

const SECTIONS = [
  ["overview", "Visão Geral"],
  ["clients", "Clientes"],
  ["online", "Extensões Online"],
  ["projects", "Projetos"],
  ["errors", "Erros e Logs"],
  ["activity", "Atividade"],
  ["versions", "Versões"],
  ["updates", "Atualizações"],
  ["health", "Saúde do Sistema"],
  ["commercial", "Comercial atual"],
] as const;

type Section = (typeof SECTIONS)[number][0];
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const pct = (value: number) => `${Number(value || 0).toFixed(1).replace(".", ",")}%`;

function StatusDot({ level }: { level: string }) {
  const cls = level === "problem" ? "bg-red-500" : level === "unstable" ? "bg-yellow-400" : "bg-emerald-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-xl font-black sm:text-2xl">{value}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">{text}</div>;
}

function Timeline({ rows }: { rows: any[] }) {
  if (!rows?.length) return <Empty text="Nenhum evento registrado nesta linha do tempo." />;
  return (
    <div className="space-y-2">
      {rows.map((event) => (
        <div key={event.id || event.event_id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-border/40 bg-background/30 p-3">
          <div className={`mt-1 h-2 w-2 rounded-full ${event.status === "failed" ? "bg-red-500" : event.status === "success" ? "bg-emerald-500" : "bg-yellow-400"}`} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wider">{String(event.action || "evento").replaceAll("_", " ")}</p>
              <span className="text-[0.62rem] text-muted-foreground">{fmt(event.created_at)}</span>
            </div>
            <p className="mt-1 truncate text-[0.68rem] text-muted-foreground">
              {event.provider ? `IA: ${event.provider}` : ""}{event.repository ? `${event.provider ? " · " : ""}${event.repository}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, data, dataKey, line = false }: { title: string; data: any[]; dataKey: string; line?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-4 text-[0.62rem] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
      <div className="h-56 w-full text-primary">
        <ResponsiveContainer width="100%" height="100%">
          {line ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#090909", border: "1px solid #262626", borderRadius: 12 }} />
              <Line type="monotone" dataKey={dataKey} stroke="currentColor" strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={55} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#090909", border: "1px solid #262626", borderRadius: 12 }} />
              <Bar dataKey={dataKey} fill="currentColor" radius={[5, 5, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AdminAgentCenter() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(extensionAdminOverview);
  const resolveErrorFn = useServerFn(extensionAdminResolveError);
  const resolveIncidentFn = useServerFn(extensionAdminResolveIncident);
  const acknowledgeFn = useServerFn(extensionAdminAcknowledgeAlert);
  const saveReleaseFn = useServerFn(extensionAdminSaveRelease);
  const createUploadFn = useServerFn(adminCreateUploadUrl);
  const registerBuildFn = useServerFn(adminRegisterBuild);
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [provider, setProvider] = useState("all");
  const [resolvedFilter, setResolvedFilter] = useState("all");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedError, setSelectedError] = useState<any>(null);
  const [releaseVersion, setReleaseVersion] = useState("");
  const [releaseTitle, setReleaseTitle] = useState("");
  const [releaseChangelog, setReleaseChangelog] = useState("");
  const [releaseMinimum, setReleaseMinimum] = useState("");
  const [releaseStatus, setReleaseStatus] = useState<"draft" | "testing" | "released" | "deprecated">("draft");
  const [releaseMandatory, setReleaseMandatory] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["extension-admin-center"],
    queryFn: () => overviewFn(),
    refetchInterval: 30_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["extension-admin-center"] });
  const resolveError = useMutation({
    mutationFn: (v: { errorId: string; resolved: boolean }) => resolveErrorFn({ data: v }),
    onSuccess: () => { toast.success("Erro atualizado."); setSelectedError(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolveIncident = useMutation({
    mutationFn: (v: { incidentId: string; resolved: boolean }) => resolveIncidentFn({ data: v }),
    onSuccess: () => { toast.success("Incidente atualizado."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const acknowledge = useMutation({
    mutationFn: (alertId: string) => acknowledgeFn({ data: { alertId } }),
    onSuccess: refresh,
  });

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.clients ?? []).filter((client: any) => !term || `${client.name} ${client.email} ${client.plan} ${client.version}`.toLowerCase().includes(term));
  }, [data?.clients, search]);
  const filteredErrors = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.errors ?? []).filter((error: any) => {
      if (severity !== "all" && error.severity !== severity) return false;
      if (provider !== "all" && error.provider !== provider) return false;
      if (resolvedFilter === "resolved" && !error.resolved) return false;
      if (resolvedFilter === "open" && error.resolved) return false;
      if (!term) return true;
      return `${error.error_code} ${error.title} ${error.client?.email || ""} ${error.repository || ""} ${error.project_id || ""}`.toLowerCase().includes(term);
    });
  }, [data?.errors, search, severity, provider, resolvedFilter]);

  async function publishRelease() {
    const version = releaseVersion.trim();
    if (!version) { toast.error("Informe a versão."); return undefined; }
    if (!releaseTitle.trim()) { toast.error("Informe o título da versão."); return undefined; }
    const file = fileRef.current?.files?.[0] ?? null;
    if (releaseStatus === "released" && !file) { toast.error("Selecione o ZIP oficial para publicar a versão."); return undefined; }
    if (file && !/\.zip$/i.test(file.name)) { toast.error("O arquivo precisa ser .zip."); return undefined; }
    setPublishing(true);
    try {
      let buildId: string | null = null;
      if (file) {
        const signed = await createUploadFn({ data: { version, fileName: file.name } });
        const upload = await fetch(signed.signedUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: file });
        if (!upload.ok) throw new Error("Falha ao enviar o ZIP oficial.");
        const build = await registerBuildFn({ data: {
          version,
          fileName: file.name,
          storagePath: signed.path,
          sizeBytes: file.size,
          channelSlug: "msk-agente",
          displayName: "MSK Agente",
          releaseNotes: releaseChangelog.trim() || undefined,
          publish: releaseStatus === "released",
        } });
        buildId = build.id;
      }
      await saveReleaseFn({ data: {
        version,
        title: releaseTitle.trim(),
        changelog: releaseChangelog.trim(),
        buildId,
        mandatory: releaseMandatory,
        minimumVersion: releaseMinimum.trim() || version,
        status: releaseStatus,
      } });
      toast.success(releaseStatus === "released" ? `Versão ${version} publicada.` : `Versão ${version} salva como ${releaseStatus}.`);
      setReleaseVersion(""); setReleaseTitle(""); setReleaseChangelog(""); setReleaseMinimum(""); setReleaseMandatory(false); setReleaseStatus("draft");
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a versão.");
    } finally {
      setPublishing(false);
    }
  }

  if (isLoading) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando Central MSK Agente…</div>;
  const stats = data?.stats ?? {} as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3"><div className="rounded-2xl border border-primary/30 bg-primary/10 p-2 text-primary"><Bot className="h-5 w-5" /></div><div><h3 className="text-lg font-black uppercase tracking-wider">Central MSK Agente</h3><p className="text-xs text-muted-foreground">Clientes, projetos, telemetria, versões, atualizações e saúde operacional.</p></div></div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar dados</Button>
      </div>

      <FilterChips value={section} onChange={(value) => setSection(value as Section)} chips={SECTIONS.map(([id, label]) => ({ id, label }))} />

      {section === "commercial" ? <LegacyAdminAgentTab /> : null}

      {section === "overview" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7">
            <MetricCard label="Extensões instaladas" value={stats.installed ?? 0} icon={HardDrive} />
            <MetricCard label="Ativas agora" value={stats.online_now ?? 0} icon={CircleDot} />
            <MetricCard label="Clientes hoje" value={stats.clients_today ?? 0} icon={Users} />
            <MetricCard label="Clientes 7 dias" value={stats.clients_7d ?? 0} icon={Activity} />
            <MetricCard label="Versão mais usada" value={stats.most_used_version ?? "—"} icon={PackageCheck} />
            <MetricCard label="Versão antiga" value={stats.old_version_clients ?? 0} icon={AlertTriangle} />
            <MetricCard label="Comandos hoje" value={stats.commands_today ?? 0} icon={Bot} />
            <MetricCard label="Projetos" value={stats.projects_connected ?? 0} icon={GitBranch} />
            <MetricCard label="GitHub" value={stats.github_connected ?? 0} icon={GitBranch} />
            <MetricCard label="ChatGPT" value={stats.chatgpt_connected ?? 0} icon={Bot} />
            <MetricCard label="Grok" value={stats.grok_connected ?? 0} icon={Bot} />
            <MetricCard label="BLACKBOX" value={stats.blackbox_connected ?? 0} icon={Bot} />
            <MetricCard label="Erros 24h" value={stats.errors_24h ?? 0} icon={XCircle} />
            <MetricCard label="Erros críticos" value={stats.critical_errors ?? 0} icon={AlertTriangle} />
            <MetricCard label="Taxa de sucesso" value={pct(stats.success_rate ?? 100)} icon={CheckCircle2} />
          </div>
          {(data?.alerts ?? []).filter((alert: any) => !alert.acknowledged).length ? (
            <div className="space-y-2 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-yellow-400">Alertas importantes</p>
              {(data?.alerts ?? []).filter((alert: any) => !alert.acknowledged).slice(0, 6).map((alert: any) => (
                <div key={alert.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-background/30 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{alert.title}</p><p className="text-xs text-muted-foreground">{alert.message} · {fmt(alert.created_at)}</p></div><Button size="sm" variant="ghost" onClick={() => acknowledge.mutate(alert.id)}>Marcar como visto</Button></div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Filtros dos gráficos</span>
            {[7, 14, 30].map((days) => (
              <Button key={days} size="sm" variant={chartDays === days ? "default" : "outline"} onClick={() => setChartDays(days)}>
                {days} dias
              </Button>
            ))}
            <select value={chartVersion} onChange={(event) => setChartVersion(event.target.value)} className="rounded-lg border border-white/10 bg-background/60 px-2 py-1 text-xs">
              <option value="all">Todas as versões</option>
              {chartVersions.map((version) => <option key={version} value={version}>v{version}</option>)}
            </select>
            <select value={chartProvider} onChange={(event) => setChartProvider(event.target.value)} className="rounded-lg border border-white/10 bg-background/60 px-2 py-1 text-xs">
              <option value="all">Todos os provedores</option>
              {chartProviders.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Usuários ativos por dia" data={charts.active_users} dataKey="users" line /><ChartCard title="Comandos enviados" data={charts.commands} dataKey="value" /></div>
          <div className="grid gap-4 xl:grid-cols-3"><ChartCard title="Erros por versão" data={charts.errors_by_version} dataKey="value" /><ChartCard title="Erros por provedor" data={charts.errors_by_provider} dataKey="value" /><ChartCard title="Instalações por versão" data={charts.installations_by_version} dataKey="value" /></div>
          <div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Erros por navegador" data={charts.errors_by_browser} dataKey="value" /><ChartCard title="Erros por etapa" data={charts.errors_by_stage} dataKey="value" /></div>
        </div>
      ) : null}

      {section === "clients" ? (
        <div className="space-y-4">
          <div className="relative max-w-lg"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, e-mail, plano ou versão..." /></div>
          {selectedClient ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/[0.025] p-5"><div className="flex items-start justify-between gap-4"><div><h4 className="text-lg font-black">{selectedClient.name}</h4><p className="text-xs text-muted-foreground">{selectedClient.email} · {selectedClient.plan} · licença {selectedClient.license_status}</p></div><Button size="sm" variant="ghost" onClick={() => setSelectedClient(null)}>Fechar</Button></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><MetricCard label="Instalações" value={selectedClient.installation_count} icon={Laptop} /><MetricCard label="Projetos" value={selectedClient.project_count} icon={GitBranch} /><MetricCard label="Comandos" value={selectedClient.commands} icon={Bot} /><MetricCard label="Erros" value={selectedClient.errors} icon={AlertTriangle} /></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><div><p className="mb-2 text-xs font-black uppercase tracking-widest">Dispositivos / versões</p>{selectedClient.installations.map((installation: any) => <div key={installation.id} className="mb-2 rounded-xl border border-border/40 p-3 text-xs"><b>v{installation.version}</b> · {installation.browser || "Navegador não informado"} · {installation.os || "SO não informado"}<br/><span className="text-muted-foreground">Última atividade: {fmt(installation.last_seen_at)}</span></div>)}</div><div><p className="mb-2 text-xs font-black uppercase tracking-widest">Linha do tempo</p><Timeline rows={selectedClient.timeline ?? []} /></div></div></div>
          ) : null}
          <div className="overflow-x-auto rounded-2xl border border-border/50"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-white/[0.025] text-[0.6rem] uppercase tracking-widest text-muted-foreground"><tr><th className="p-3">Cliente</th><th>Plano/licença</th><th>Instalações</th><th>Versão</th><th>Projetos</th><th>IA</th><th>Última atividade</th><th></th></tr></thead><tbody>{filteredClients.map((client: any) => <tr key={client.user_id} className="border-t border-border/30"><td className="p-3"><b>{client.name}</b><br/><span className="text-muted-foreground">{client.email}</span></td><td>{client.plan}<br/><span className="text-muted-foreground">{client.license_status} · {fmt(client.expires_at)}</span></td><td>{client.installation_count} {client.online ? <span className="ml-1 text-emerald-400">● online</span> : null}</td><td>v{client.version}</td><td>{client.project_count}</td><td>{client.providers?.join(", ") || "—"}</td><td>{fmt(client.last_activity_at)}</td><td><Button size="sm" variant="ghost" onClick={() => setSelectedClient(client)}>Ver perfil</Button></td></tr>)}</tbody></table></div>
        </div>
      ) : null}

      {section === "online" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data?.installations ?? []).map((installation: any) => { const online = Date.now() - Date.parse(installation.last_seen_at) < 5 * 60_000; return <div key={installation.id} className="rounded-2xl border border-border/50 p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} /><b className="text-sm">{online ? "Online agora" : "Offline"}</b></div><span className="text-xs text-primary">v{installation.version}</span></div><p className="mt-3 text-xs text-muted-foreground">{installation.browser || "Navegador não informado"} · {installation.os || "SO não informado"}</p><p className="mt-1 break-all text-[0.65rem] text-muted-foreground">Instalação: {installation.installation_id}</p><p className="mt-2 text-[0.65rem]">Última vez online: {fmt(installation.last_seen_at)}</p></div>; })}</div>
      ) : null}

      {section === "projects" ? (
        <div className="space-y-4">{selectedProject ? <div className="rounded-3xl border border-primary/20 p-5"><div className="flex items-start justify-between"><div><h4 className="text-lg font-black">{selectedProject.project_name || selectedProject.lovable_project_id}</h4><p className="text-xs text-muted-foreground">{selectedProject.repository || "Sem repositório"} · {selectedProject.provider || "IA não informada"}</p></div><Button size="sm" variant="ghost" onClick={() => setSelectedProject(null)}>Fechar</Button></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-border/40 p-3 text-xs"><b>GitHub</b><br/>{selectedProject.github_status} · {selectedProject.branch || "branch não informada"}</div><div className="rounded-xl border border-border/40 p-3 text-xs"><b>Último commit</b><br/><span className="break-all">{selectedProject.last_commit_sha || "—"}</span></div><div className="rounded-xl border border-border/40 p-3 text-xs"><b>Preview/Publicação</b><br/>{selectedProject.publish_status} · {fmt(selectedProject.last_sync_at)}</div></div><p className="mb-2 mt-5 text-xs font-black uppercase tracking-widest">Linha do tempo do projeto</p><Timeline rows={selectedProject.timeline ?? []} /></div> : null}<div className="overflow-x-auto rounded-2xl border border-border/50"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-white/[0.025] text-[0.6rem] uppercase tracking-widest text-muted-foreground"><tr><th className="p-3">Projeto</th><th>Cliente</th><th>Repositório</th><th>GitHub</th><th>Branch</th><th>IA</th><th>Estado</th><th>Última atividade</th><th></th></tr></thead><tbody>{(data?.projects ?? []).map((project: any) => <tr key={project.id} className="border-t border-border/30"><td className="p-3"><b>{project.project_name || project.lovable_project_id}</b><br/><span className="text-muted-foreground">{project.lovable_project_id}</span></td><td>{project.client?.email || "—"}</td><td>{project.repository || "—"}</td><td>{project.github_status}</td><td>{project.branch || "—"}</td><td>{project.provider || "—"}</td><td>{project.publish_status}</td><td>{fmt(project.last_activity_at)}</td><td><Button size="sm" variant="ghost" onClick={() => setSelectedProject(project)}>Abrir perfil</Button></td></tr>)}</tbody></table></div></div>
      ) : null}

      {section === "errors" ? (
        <div className="space-y-4">
          {(data?.incidents ?? []).filter((incident: any) => incident.status !== "resolved").length ? <div className="space-y-2"><p className="text-xs font-black uppercase tracking-widest text-yellow-400">Incidentes agrupados</p>{(data?.incidents ?? []).filter((incident: any) => incident.status !== "resolved").map((incident: any) => <div key={incident.id} className="flex flex-col gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><b>{incident.error_code}</b><p className="text-xs text-muted-foreground">{incident.affected_users} usuários · {incident.affected_installations} instalações · versão {incident.dominant_version || "—"} · início {fmt(incident.first_seen_at)} · última ocorrência {fmt(incident.last_seen_at)}</p></div><Button size="sm" variant="outline" onClick={() => resolveIncident.mutate({ incidentId: incident.id, resolved: true })}>Marcar resolvido</Button></div>)}</div> : null}
          <div className="grid gap-2 md:grid-cols-4"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, e-mail, projeto, repo ou código..." /><select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-xs"><option value="all">Todas severidades</option><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option><option value="critical">Critical</option></select><select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-xs"><option value="all">Todas IAs</option><option value="github">GitHub</option><option value="chatgpt">ChatGPT</option><option value="grok">Grok</option><option value="blackbox">BLACKBOX</option><option value="lovable">Lovable</option></select><select value={resolvedFilter} onChange={(e) => setResolvedFilter(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-xs"><option value="all">Resolvidos e abertos</option><option value="open">Não resolvidos</option><option value="resolved">Resolvidos</option></select></div>
          {selectedError ? <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.025] p-5"><div className="flex items-start justify-between"><div><h4 className="text-base font-black">{selectedError.error_code} — {selectedError.title}</h4><p className="mt-1 text-xs text-muted-foreground">{selectedError.client?.email || "—"} · v{selectedError.extension_version} · {fmt(selectedError.created_at)}</p></div><Button size="sm" variant="ghost" onClick={() => setSelectedError(null)}>Fechar</Button></div><div className="mt-4 grid gap-4 xl:grid-cols-2"><div><p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Resumo amigável</p><p className="mt-1 text-sm">{selectedError.user_message}</p><p className="mt-4 text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Contexto</p><p className="mt-1 text-xs">Ação: {selectedError.action || "—"}<br/>IA: {selectedError.provider || "—"}<br/>Projeto: {selectedError.project_id || "—"}<br/>Repositório: {selectedError.repository || "—"}</p></div><div><p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Diagnóstico técnico sanitizado</p><pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-[0.68rem] text-muted-foreground">{selectedError.technical_message || "Sem mensagem técnica."}{selectedError.stack_summary ? `\n\n${selectedError.stack_summary}` : ""}</pre></div></div><Button className="mt-4" size="sm" variant={selectedError.resolved ? "outline" : "neon"} onClick={() => resolveError.mutate({ errorId: selectedError.id, resolved: !selectedError.resolved })}>{selectedError.resolved ? "Reabrir" : "Marcar como resolvido"}</Button></div> : null}
          <div className="overflow-x-auto rounded-2xl border border-border/50"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-white/[0.025] text-[0.6rem] uppercase tracking-widest text-muted-foreground"><tr><th className="p-3">Erro</th><th>Cliente</th><th>Versão</th><th>Projeto/repo</th><th>IA</th><th>Severidade</th><th>Navegador</th><th>Data</th><th>Status</th><th></th></tr></thead><tbody>{filteredErrors.map((error: any) => <tr key={error.id} className="border-t border-border/30"><td className="p-3"><b>{error.error_code}</b><br/><span className="text-muted-foreground">{error.title}</span></td><td>{error.client?.email || "—"}</td><td>v{error.extension_version}</td><td>{error.project_id || "—"}<br/><span className="text-muted-foreground">{error.repository || "—"}</span></td><td>{error.provider || "—"}</td><td className={error.severity === "critical" ? "text-red-400" : error.severity === "warning" ? "text-yellow-400" : ""}>{error.severity}</td><td>{error.browser || "—"}</td><td>{fmt(error.created_at)}</td><td>{error.resolved ? "Resolvido" : "Aberto"}</td><td><Button size="sm" variant="ghost" onClick={() => setSelectedError(error)}>Ver detalhes</Button></td></tr>)}</tbody></table></div>
        </div>
      ) : null}

      {section === "activity" ? <div><Timeline rows={data?.activity ?? []} /></div> : null}

      {section === "versions" ? (
        <div className="space-y-5"><div className="overflow-x-auto rounded-2xl border border-border/50"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-white/[0.025] text-[0.6rem] uppercase tracking-widest text-muted-foreground"><tr><th className="p-3">Versão</th><th>Status</th><th>Publicada em</th><th>Usuários</th><th>Taxa de erro</th><th>Obrigatória</th><th>Mínima</th><th>Changelog</th></tr></thead><tbody>{(data?.releases ?? []).map((release: any) => <tr key={release.id} className="border-t border-border/30"><td className="p-3 font-black">{release.version}</td><td>{release.status}</td><td>{fmt(release.released_at)}</td><td>{release.users ?? 0}</td><td>{pct(release.error_rate ?? 0)}</td><td>{release.mandatory ? "Sim" : "Não"}</td><td>{release.minimum_version || "—"}</td><td className="max-w-[320px] truncate">{release.changelog || "—"}</td></tr>)}</tbody></table></div>{(data?.comparison ?? []).length ? <div className="rounded-2xl border border-border/50 p-4"><p className="text-xs font-black uppercase tracking-widest">Comparação entre versões</p><div className="mt-3 grid gap-3 md:grid-cols-2">{data.comparison.map((row: any) => <div key={row.version} className="rounded-xl bg-white/[0.025] p-3"><b>Versão {row.version}</b><p className="text-xs text-muted-foreground">Sucesso: {pct(row.success_rate)} · {row.operations} operações</p></div>)}</div>{data.comparison.length >= 2 && data.comparison[0].success_rate + 5 < data.comparison[1].success_rate ? <p className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300">A versão {data.comparison[0].version} apresenta uma taxa de erros muito superior à versão anterior.</p> : null}</div> : null}</div>
      ) : null}

      {section === "updates" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]"><div className="rounded-3xl border border-primary/20 bg-primary/[0.02] p-5"><div className="mb-5"><h4 className="text-sm font-black uppercase tracking-widest">Nova versão</h4><p className="text-xs text-muted-foreground">Publicação oficial usada pelo aviso de atualização da extensão instalada manualmente.</p></div><div className="grid gap-3 md:grid-cols-2"><div><Label>Versão</Label><Input value={releaseVersion} onChange={(e) => setReleaseVersion(e.target.value)} placeholder="2.5.0" /></div><div><Label>Versão mínima</Label><Input value={releaseMinimum} onChange={(e) => setReleaseMinimum(e.target.value)} placeholder="2.5.0" /></div></div><div className="mt-3"><Label>Título</Label><Input value={releaseTitle} onChange={(e) => setReleaseTitle(e.target.value)} placeholder="Central MSK Agente" /></div><div className="mt-3"><Label>Changelog</Label><Textarea rows={7} value={releaseChangelog} onChange={(e) => setReleaseChangelog(e.target.value)} placeholder="O que mudou nesta versão..." /></div><div className="mt-3"><Label>Arquivo oficial da extensão (.zip)</Label><Input ref={fileRef} type="file" accept=".zip,application/zip" /></div><div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label>Status</Label><select value={releaseStatus} onChange={(e) => setReleaseStatus(e.target.value as any)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="draft">draft</option><option value="testing">testing</option><option value="released">released</option><option value="deprecated">deprecated</option></select></div><label className="flex items-center gap-3 rounded-xl border border-border/50 px-3"><Switch checked={releaseMandatory} onCheckedChange={setReleaseMandatory} /><span className="text-xs font-bold">Atualização obrigatória</span></label></div><Button className="mt-5 w-full" variant="neon" onClick={publishRelease} disabled={publishing}>{publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Salvar nova versão</Button></div><div className="space-y-4"><div className="rounded-2xl border border-border/50 p-4"><p className="text-xs font-black uppercase tracking-widest">Como a atualização funciona</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">A extensão consulta a versão em intervalo eficiente. Instalações manuais recebem aviso com “Atualizar agora” e “Ver novidades”. Se a versão estiver abaixo da mínima, o aviso passa a ser obrigatório. O navegador nunca tem os arquivos locais substituídos silenciosamente.</p></div><div className="rounded-2xl border border-border/50 p-4"><p className="text-xs font-black uppercase tracking-widest">Versão atual</p><p className="mt-2 text-2xl font-black text-primary">{data?.latest_release?.version || "Nenhuma release"}</p><p className="mt-1 text-xs text-muted-foreground">Mínima suportada: {data?.minimum_version || "—"}</p></div><div className="rounded-2xl border border-border/50 p-4"><p className="text-xs font-black uppercase tracking-widest">Chrome Web Store</p><p className="mt-2 text-xs text-muted-foreground">A arquitetura mantém versão mínima, changelog, telemetria e acompanhamento de migração no SaaS. Quando o pacote for distribuído pela loja, o Chrome poderá executar a atualização normal da extensão.</p></div></div></div>
      ) : null}

      {section === "health" ? (
        <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data?.health ?? []).map((item: any) => <div key={item.service} className="rounded-2xl border border-border/50 p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><StatusDot level={item.level} /><div><b className="text-sm">{item.service}</b><p className="text-xs text-muted-foreground">{item.label}</p></div></div><HeartPulse className="h-5 w-5 text-muted-foreground" /></div><p className="mt-3 text-[0.65rem] text-muted-foreground">Falhas recentes: {item.failures} · amostra: {item.total}</p></div>)}</div><div className="rounded-2xl border border-border/50 p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><p className="text-xs font-black uppercase tracking-widest">Critério de saúde</p></div><p className="mt-2 text-xs text-muted-foreground">🟢 Operacional · 🟡 Instabilidade · 🔴 Problema detectado. Um erro isolado não muda o serviço para indisponível; o status usa volume e taxa de falha da janela recente.</p></div></div>
      ) : null}
    </div>
  );
}
