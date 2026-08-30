import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  Ban,
  Clock,
  Copy,
  Database,
  KeyRound,
  Loader2,
  Monitor,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  liveAdminGenerateLicense,
  liveAdminLicenseAction,
  liveAdminOverview,
} from "@/lib/live-admin.functions";

const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "—");
const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

function statusLabel(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "active") return "Ativa";
  if (value === "inactive") return "Aguardando ativação";
  if (value === "expired") return "Expirada";
  if (value === "revoked") return "Revogada";
  if (value === "suspended") return "Suspensa";
  return status || "—";
}

function statusClass(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (value === "inactive") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (value === "expired") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

export function AdminLiveTab() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(liveAdminOverview);
  const generateFn = useServerFn(liveAdminGenerateLicense);
  const actionFn = useServerFn(liveAdminLicenseAction);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["msk-live-admin"],
    queryFn: () => overviewFn(),
    refetchInterval: 30_000,
  });

  const [section, setSection] = useState<"overview" | "licenses" | "people" | "plans">("overview");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [planId, setPlanId] = useState("");
  const [email, setEmail] = useState("");
  const [standalone, setStandalone] = useState(false);
  const [note, setNote] = useState("");
  const [issued, setIssued] = useState<{ token: string; licenseId: string; email: string | null; planName: string } | null>(null);

  const plans = (data?.plans ?? []) as any[];
  const offers = (data?.offers ?? []) as any[];
  const licenses = (data?.licenses ?? []) as any[];
  const stats = data?.stats;
  const selectedPlanId = planId || String(plans[0]?.id ?? "");

  const filteredLicenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return licenses.filter((license) => {
      if (status !== "all" && license.status !== status) return false;
      if (!term) return true;
      return [license.email, license.name, license.planName, license.tokenPreview]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(term));
    });
  }, [licenses, search, status]);

  const onlinePeople = useMemo(
    () => licenses.filter((license) => license.online).sort((a, b) => String(b.lastActivity ?? "").localeCompare(String(a.lastActivity ?? ""))),
    [licenses],
  );

  const generateMutation = useMutation({
    mutationFn: (payload: { planId: string; email?: string; standalone?: boolean; note?: string }) =>
      generateFn({ data: payload }),
    onSuccess: (result) => {
      setIssued(result);
      toast.success("Licença exclusiva do MSK LIVE gerada.");
      qc.invalidateQueries({ queryKey: ["msk-live-admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: (payload: { licenseId: string; action: "revoke" | "restore" | "reset_devices" }) =>
      actionFn({ data: payload }),
    onSuccess: () => {
      toast.success("Licença MSK LIVE atualizada.");
      qc.invalidateQueries({ queryKey: ["msk-live-admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function copyToken() {
    if (!issued?.token) return;
    await navigator.clipboard.writeText(issued.token);
    toast.success("Token MSK LIVE copiado.");
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando central MSK LIVE…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 via-background to-emerald-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-2.5 text-fuchsia-300">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-[0.18em]">MSK LIVE · Licenças</h3>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                Produto isolado
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Central exclusiva da extensão de Live. Tokens, planos, usuários e dispositivos não se misturam com Clonador, MSK Agente ou outras extensões.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["msk-live-admin"] })}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {!data?.configured ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-black">Estrutura MSK LIVE aguardando migração do banco</p>
              <p className="mt-1 text-xs text-amber-200/70">
                O painel já está isolado, mas produto, ofertas e planos precisam existir no banco para liberar a geração de licenças.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          ["overview", "Visão geral", Activity],
          ["licenses", "Licenças", ShieldCheck],
          ["people", "Pessoas ativas", Users],
          ["plans", "Planos LIVE", KeyRound],
        ].map(([key, label, Icon]: any) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
              section === key
                ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200"
                : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Pessoas online", stats?.onlinePeople ?? 0, Users],
          ["Licenças ativas", stats?.activeLicenses ?? 0, ShieldCheck],
          ["Dispositivos online", stats?.onlineDevices ?? 0, Monitor],
          ["Expiradas", stats?.expiredLicenses ?? 0, Clock],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="glass rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-black">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-fuchsia-300" />
            </div>
          </div>
        ))}
      </div>

      {(section === "overview" || section === "licenses") && (
        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.6fr]">
          <div className="glass rounded-3xl border border-white/5 p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-fuchsia-300" />
              <h4 className="text-[11px] font-black uppercase tracking-[0.16em]">Gerar token MSK LIVE</h4>
            </div>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedPlanId) {
                  toast.error("Nenhum plano MSK LIVE disponível.");
                  return;
                }
                if (!standalone && !email.trim()) {
                  toast.error("Informe o e-mail do cliente ou marque licença sem usuário.");
                  return;
                }
                generateMutation.mutate({
                  planId: selectedPlanId,
                  ...(standalone ? { standalone: true } : { email: email.trim().toLowerCase() }),
                  ...(note.trim() ? { note: note.trim() } : {}),
                });
              }}
            >
              <div className="space-y-1.5">
                <Label>Plano exclusivo LIVE</Label>
                <select
                  value={selectedPlanId}
                  onChange={(event) => setPlanId(event.target.value)}
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {!plans.length ? <option value="">Nenhum plano aplicado</option> : null}
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · {plan.duration_label || "validade a configurar"}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-fuchsia-500"
                  checked={standalone}
                  onChange={(event) => setStandalone(event.target.checked)}
                />
                Gerar sem usuário vinculado
              </label>
              {!standalone ? (
                <div className="space-y-1.5">
                  <Label>E-mail do cliente</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="cliente@email.com"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>Observação</Label>
                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Venda, suporte, teste…" />
              </div>
              <Button type="submit" variant="neon" className="w-full" disabled={!data?.configured || generateMutation.isPending}>
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Gerar licença MSK LIVE
              </Button>
            </form>

            {issued ? (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Token exclusivo gerado</p>
                <code className="mt-2 block break-all rounded-lg bg-black/30 p-3 text-xs font-black text-emerald-200">{issued.token}</code>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyToken}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                  <span className="self-center text-[10px] text-muted-foreground">Namespace: MSKLIVE</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass min-w-0 rounded-3xl border border-white/5 p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.16em]">Licenças exclusivas da Live</h4>
                <p className="mt-1 text-[10px] text-muted-foreground">{licenses.length} licença(s) encontrada(s) somente nos planos MSK LIVE.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="h-9 pl-9 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pessoa, plano ou token" />
                </div>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-xs">
                  <option value="all">Todos os status</option>
                  <option value="active">Ativas</option>
                  <option value="inactive">Aguardando ativação</option>
                  <option value="expired">Expiradas</option>
                  <option value="revoked">Revogadas</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-border/60 text-[9px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-2 py-3">Pessoa</th>
                    <th className="px-2 py-3">Plano</th>
                    <th className="px-2 py-3">Token</th>
                    <th className="px-2 py-3">Status</th>
                    <th className="px-2 py-3">Última atividade</th>
                    <th className="px-2 py-3">Dispositivos</th>
                    <th className="px-2 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((license) => (
                    <tr key={license.id} className="border-b border-border/30 align-top">
                      <td className="px-2 py-3">
                        <div className="font-bold">{license.email}</div>
                        {license.name ? <div className="text-[10px] text-muted-foreground">{license.name}</div> : null}
                      </td>
                      <td className="px-2 py-3">
                        <div className="font-bold">{license.planName}</div>
                        <div className="text-[10px] text-muted-foreground">{license.planSlug}</div>
                      </td>
                      <td className="px-2 py-3 font-mono text-[10px] text-fuchsia-200">{license.tokenPreview}</td>
                      <td className="px-2 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${statusClass(license.status)}`}>
                          {statusLabel(license.status)}
                        </span>
                        {license.online ? <div className="mt-1 text-[9px] font-black text-emerald-300">● ONLINE</div> : null}
                      </td>
                      <td className="px-2 py-3 text-[10px] text-muted-foreground">
                        {fmt(license.lastActivity)}
                        <div>Expira: {fmt(license.expiresAt)}</div>
                      </td>
                      <td className="px-2 py-3">
                        <span className="font-black">{license.devices.filter((device: any) => device.status === "active").length}</span>
                        <span className="text-muted-foreground"> / {license.maxDevices}</span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Remover dispositivos ativos"
                            disabled={actionMutation.isPending}
                            onClick={() => actionMutation.mutate({ licenseId: license.id, action: "reset_devices" })}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          {license.status === "revoked" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Restaurar para aguardar nova ativação"
                              disabled={actionMutation.isPending}
                              onClick={() => actionMutation.mutate({ licenseId: license.id, action: "restore" })}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Revogar licença"
                              disabled={actionMutation.isPending}
                              onClick={() => actionMutation.mutate({ licenseId: license.id, action: "revoke" })}
                            >
                              <Ban className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredLicenses.length ? (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Nenhuma licença MSK LIVE encontrada.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {section === "people" ? (
        <section className="glass rounded-3xl border border-white/5 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.16em]">Pessoas ativas agora</h4>
              <p className="mt-1 text-[10px] text-muted-foreground">Atividade nos últimos 2 minutos, somente em licenças MSK LIVE.</p>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
              {stats?.onlinePeople ?? 0} online
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {onlinePeople.map((license) => (
              <div key={license.id} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">{license.email}</p>
                    <p className="text-[10px] text-muted-foreground">{license.planName}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">● online</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-xl bg-background/50 p-2"><span className="text-muted-foreground">Último sinal</span><div className="font-bold">{fmt(license.lastActivity)}</div></div>
                  <div className="rounded-xl bg-background/50 p-2"><span className="text-muted-foreground">Dispositivos</span><div className="font-bold">{license.devices.filter((device: any) => device.status === "active").length}</div></div>
                </div>
                {license.devices.filter((device: any) => device.status === "active").map((device: any) => (
                  <div key={device.id} className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border/40 px-3 py-2 text-[10px]">
                    <span className="flex items-center gap-2"><Monitor className="h-3 w-3" /> {device.name}</span>
                    <span className="text-muted-foreground">{fmt(device.lastSeenAt)}</span>
                  </div>
                ))}
              </div>
            ))}
            {!onlinePeople.length ? (
              <div className="col-span-full py-10 text-center text-xs text-muted-foreground">Nenhuma pessoa usando o MSK LIVE neste momento.</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {section === "plans" ? (
        <section className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            {plans.map((plan) => {
              const offer = offers.find((item) => item.plan_id === plan.id);
              return (
                <div key={plan.id} className="glass rounded-3xl border border-white/5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">MSK LIVE</p>
                      <h4 className="mt-1 text-base font-black">{plan.name}</h4>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${plan.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-border bg-muted/20 text-muted-foreground"}`}>
                      {plan.active ? "ATIVO" : "INATIVO"}
                    </span>
                  </div>
                  <div className="mt-4 text-2xl font-black">{brl(Number(offer?.price ?? plan.price ?? 0))}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{plan.duration_label || "Validade não configurada"} · {plan.max_devices ?? 1} dispositivo(s)</div>
                  <div className="mt-4 rounded-xl border border-border/40 bg-background/40 p-3 text-[10px] text-muted-foreground">
                    <div>Plano: <span className="font-mono text-foreground">{plan.slug}</span></div>
                    <div className="mt-1">Oferta: <span className="font-mono text-foreground">{offer?.slug ?? "aguardando migração"}</span></div>
                  </div>
                </div>
              );
            })}
            {!plans.length ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                Os 3 planos MSK LIVE ainda não foram aplicados no banco ativo.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
