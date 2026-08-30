import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  KeyRound,
  Loader2,
  Monitor,
  Package,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  liveAdminGenerateLicense,
  liveAdminLicenseAction,
  liveAdminOverview,
  liveAdminSaveOffer,
} from "@/lib/live-admin.functions";
import {
  adminCreateUploadUrl,
  adminDeleteBuild,
  adminRegisterBuild,
  adminSetBuildPublished,
} from "@/lib/extension.functions";

const LIVE_CHANNEL = "msk-live";
const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString("pt-BR") : "—");
const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
const human = (value?: number | null) =>
  !value ? "—" : value >= 1048576 ? `${(value / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;

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

function saleGroup(status: string) {
  const value = String(status || "").toLowerCase();
  if (["paid", "approved", "completed"].includes(value)) return "paid";
  if (["pending", "waiting_payment", "processing"].includes(value)) return "pending";
  return "failed";
}

function OfferEditor({
  plan,
  offer,
  saving,
  onSave,
}: {
  plan?: any;
  offer?: any;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const delivery = plan?.delivery ?? { method: "panel_email", link: "", instructions: "" };
  const isNew = !plan?.id;
  const [name, setName] = useState(plan?.name ?? "Nova oferta MSK LIVE");
  const [description, setDescription] = useState(plan?.description ?? "Acesso à extensão MSK LIVE.");
  const [price, setPrice] = useState(String(offer?.price ?? plan?.price ?? 0));
  const [durationValue, setDurationValue] = useState(String(plan?.duration_value ?? 1));
  const [durationUnit, setDurationUnit] = useState(plan?.duration_unit ?? "months");
  const [durationLabel, setDurationLabel] = useState(plan?.duration_label ?? "1 mês");
  const [maxDevices, setMaxDevices] = useState(String(plan?.max_devices ?? 1));
  const [active, setActive] = useState(Boolean(plan?.active));
  const [imageUrl, setImageUrl] = useState(plan?.image_url ?? "");
  const [commission, setCommission] = useState(String(plan?.affiliate_commission_rate ?? 30));
  const [deliveryMethod, setDeliveryMethod] = useState(delivery.method ?? "panel_email");
  const [deliveryLink, setDeliveryLink] = useState(delivery.link ?? "");
  const [deliveryInstructions, setDeliveryInstructions] = useState(delivery.instructions ?? "");

  return (
    <form
      className="glass rounded-3xl border border-white/5 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const value = Math.max(1, Number(durationValue || 1));
        onSave({
          ...(plan?.id ? { id: plan.id, slug: plan.slug } : {}),
          name: name.trim(),
          description: description.trim(),
          price: Number(String(price).replace(",", ".")) || 0,
          currency: "BRL",
          duration_label: durationLabel.trim(),
          duration_days: durationUnit === "days" ? value : null,
          duration_unit: durationUnit,
          duration_value: value,
          is_lifetime: false,
          auto_renew: false,
          max_devices: Math.max(1, Number(maxDevices || 1)),
          active,
          sort_order: Number(plan?.sort_order ?? 400),
          image_url: imageUrl.trim(),
          affiliate_commission_rate: Number(commission || 0),
          affiliate_commission_fixed: 0,
          delivery_method: deliveryMethod,
          delivery_link: deliveryLink.trim(),
          delivery_instructions: deliveryInstructions.trim(),
        });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-fuchsia-300">{isNew ? "Criar oferta" : "Oferta MSK LIVE"}</p>
          <h4 className="mt-1 text-base font-black">{isNew ? "Nova oferta" : plan.name}</h4>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-border bg-muted/20 text-muted-foreground"}`}>
          {active ? "NO AR" : "OFF"}
        </span>
      </div>

      {imageUrl ? <img src={imageUrl} alt={name} className="mt-4 h-28 w-full rounded-2xl object-cover" /> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>Nome da oferta</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label>Preço (R$)</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></div>
        <div className="space-y-1"><Label>Dispositivos</Label><Input type="number" min={1} max={100} value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} /></div>
        <div className="space-y-1"><Label>Validade</Label><Input type="number" min={1} value={durationValue} onChange={(e) => setDurationValue(e.target.value)} /></div>
        <div className="space-y-1">
          <Label>Unidade</Label>
          <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)}>
            <option value="days">Dias</option><option value="weeks">Semanas</option><option value="months">Meses</option>
          </select>
        </div>
        <div className="space-y-1"><Label>Rótulo</Label><Input value={durationLabel} onChange={(e) => setDurationLabel(e.target.value)} /></div>
        <div className="space-y-1"><Label>Comissão afiliado %</Label><Input type="number" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Imagem (URL)</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
      </div>

      <div className="mt-4 rounded-2xl border border-fuchsia-500/15 bg-fuchsia-500/5 p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-fuchsia-200">Método de entrega</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Entrega ao cliente</Label>
            <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}>
              <option value="panel">Somente painel</option>
              <option value="email">Somente e-mail</option>
              <option value="panel_email">Painel + e-mail</option>
              <option value="email_link">Link por e-mail</option>
            </select>
          </div>
          <div className="space-y-1"><Label>Link de entrega</Label><Input value={deliveryLink} onChange={(e) => setDeliveryLink(e.target.value)} placeholder={deliveryMethod === "email_link" ? "https://..." : "Opcional"} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Instruções de entrega</Label><Textarea value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} rows={2} placeholder="Instruções que acompanham a licença/entrega." /></div>
        </div>
      </div>

      {!isNew ? (
        <div className="mt-3 rounded-xl border border-border/40 bg-background/40 p-3 text-[10px] text-muted-foreground">
          Plano: <span className="font-mono text-foreground">{plan.slug}</span><br />Oferta: <span className="font-mono text-foreground">{offer?.slug ?? "sincronizando"}</span>
        </div>
      ) : null}

      <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-xs font-bold">
        <span>Colocar oferta no ar</span>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-fuchsia-500" />
      </label>
      <Button type="submit" variant="neon" className="mt-3 w-full" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isNew ? <Plus className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {isNew ? "Criar oferta LIVE" : "Salvar oferta"}
      </Button>
    </form>
  );
}

export function AdminLiveTab() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(liveAdminOverview);
  const generateFn = useServerFn(liveAdminGenerateLicense);
  const actionFn = useServerFn(liveAdminLicenseAction);
  const saveOfferFn = useServerFn(liveAdminSaveOffer);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const registerBuild = useServerFn(adminRegisterBuild);
  const setBuildPublished = useServerFn(adminSetBuildPublished);
  const deleteBuild = useServerFn(adminDeleteBuild);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["msk-live-admin"],
    queryFn: () => overviewFn(),
    refetchInterval: 30_000,
  });

  const [section, setSection] = useState<"dashboard" | "offers" | "licenses" | "installations" | "sales" | "versions">("dashboard");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [planId, setPlanId] = useState("");
  const [email, setEmail] = useState("");
  const [standalone, setStandalone] = useState(false);
  const [note, setNote] = useState("");
  const [issued, setIssued] = useState<any>(null);
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const plans = data?.plans ?? [];
  const offers = data?.offers ?? [];
  const licenses = data?.licenses ?? [];
  const installations = data?.installations ?? [];
  const sales = data?.sales ?? [];
  const builds = data?.builds ?? [];
  const stats = data?.stats;
  const selectedPlanId = planId || String(plans[0]?.id ?? "");

  const filteredLicenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return licenses.filter((license: any) => {
      if (status !== "all" && license.status !== status) return false;
      if (!term) return true;
      return [license.email, license.name, license.planName, license.tokenPreview].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [licenses, search, status]);

  const filteredInstallations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return installations.filter((item: any) => {
      if (status === "online" && !item.online) return false;
      if (status === "offline" && item.online) return false;
      if (status === "active" && item.status !== "active") return false;
      if (status === "removed" && item.status !== "removed") return false;
      if (!term) return true;
      return [item.email, item.planName, item.installationId, item.browser, item.os, item.extensionVersion].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [installations, search, status]);

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((sale: any) => {
      if (status !== "all" && saleGroup(sale.status) !== status) return false;
      if (!term) return true;
      return [sale.email, sale.planName, sale.identifier, sale.provider].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [sales, search, status]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["msk-live-admin"] });

  const saveOfferMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveOfferFn({ data: payload as never }),
    onSuccess: () => { toast.success("Oferta MSK LIVE salva e sincronizada."); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const generateMutation = useMutation({
    mutationFn: (payload: any) => generateFn({ data: payload }),
    onSuccess: (result) => { setIssued(result); toast.success("Licença exclusiva MSK LIVE gerada."); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: (payload: any) => actionFn({ data: payload }),
    onSuccess: () => { toast.success("Licença MSK LIVE atualizada."); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishMutation = useMutation({
    mutationFn: (payload: { buildId: string; publish: boolean }) => setBuildPublished({ data: payload }),
    onSuccess: () => { toast.success("Versão MSK LIVE atualizada."); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (buildId: string) => deleteBuild({ data: { buildId } }),
    onSuccess: () => { toast.success("Versão removida."); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  async function uploadBuild() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Selecione o ZIP da MSK LIVE."); return; }
    if (!/\.zip$/i.test(file.name)) { toast.error("O arquivo precisa ser .zip"); return; }
    if (!version.trim()) { toast.error("Informe a versão."); return; }
    setUploading(true);
    try {
      const signed = await createUploadUrl({ data: { version: version.trim(), fileName: file.name } });
      const upload = await fetch(signed.signedUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: file });
      if (!upload.ok) throw new Error("Falha ao enviar o ZIP para o storage.");
      await registerBuild({ data: {
        version: version.trim(), fileName: file.name, storagePath: signed.path, sizeBytes: file.size,
        channelSlug: LIVE_CHANNEL, displayName: "MSK LIVE", releaseNotes: releaseNotes.trim() || undefined, publish: true,
      } });
      toast.success("Nova versão MSK LIVE publicada no canal exclusivo.");
      setReleaseNotes("");
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload.");
    } finally { setUploading(false); }
  }

  if (isLoading) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando central MSK LIVE…</div>;

  const nav = [
    ["dashboard", "Dashboard", Activity], ["offers", "Planos e ofertas", ShoppingCart], ["licenses", "Licenças", ShieldCheck],
    ["installations", "Instalações", Monitor], ["sales", "Vendas", Wallet], ["versions", "Versões e entrega", Package],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 via-background to-emerald-500/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-2.5 text-fuchsia-300"><Radio className="h-5 w-5" /></div>
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black uppercase tracking-[0.18em]">MSK LIVE · Central profissional</h3><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-300">PRODUTO ISOLADO</span></div><p className="mt-1 text-xs text-muted-foreground">Ofertas, licenças, instalações, vendas, versões e entrega conectadas exclusivamente à extensão MSK LIVE.</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar dados</Button>
        </div>
      </div>

      {!data?.configured ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"><div className="flex gap-3"><Database className="h-4 w-4" /><div><p className="font-black">Migração MSK LIVE ainda não aplicada no banco ativo</p><p className="mt-1 text-xs text-amber-200/70">O painel está pronto no código; ofertas/canal aparecem assim que a migração sincronizar.</p></div></div></div> : null}

      <div className="flex flex-wrap gap-2">{nav.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => { setSection(key); setSearch(""); setStatus("all"); }} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${section === key ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200" : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[
        ["Receita", brl(stats?.revenue ?? 0), Wallet], ["Vendas aprovadas", stats?.paidSales ?? 0, CheckCircle2],
        ["Licenças ativas", stats?.activeLicenses ?? 0, ShieldCheck], ["Pessoas online", stats?.onlinePeople ?? 0, Users],
        ["Instalações", stats?.totalInstallations ?? 0, Monitor], ["Downloads", stats?.downloads ?? 0, Download],
      ].map(([label, value, Icon]: any) => <div key={label} className="glass rounded-2xl border border-white/5 p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div><Icon className="h-4 w-4 text-fuchsia-300" /></div></div>)}</div>

      {section === "dashboard" ? <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass rounded-3xl border border-white/5 p-5"><h4 className="text-[11px] font-black uppercase tracking-widest">Conexão da extensão</h4><div className="mt-4 grid gap-3 sm:grid-cols-2">{[
          ["Canal", data?.channel?.slug ?? "msk-live"], ["Versão publicada", data?.channel?.version ?? "Nenhuma"],
          ["Canal ativo", data?.channel?.enabled === false ? "OFF" : "ON"], ["Ofertas no ar", `${offers.filter((o: any) => o.active).length}/${offers.length}`],
          ["Dispositivos online", stats?.onlineDevices ?? 0], ["Conversão", `${stats?.conversionRate ?? 0}%`],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border/40 bg-background/40 p-3"><p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>)}</div></section>
        <section className="glass rounded-3xl border border-white/5 p-5"><h4 className="text-[11px] font-black uppercase tracking-widest">Atividade ao vivo</h4><div className="mt-4 space-y-2">{installations.filter((item: any) => item.online).slice(0, 8).map((item: any) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3"><div className="min-w-0"><p className="truncate text-xs font-black">{item.email}</p><p className="truncate text-[10px] text-muted-foreground">{item.planName} · v{item.extensionVersion}</p></div><span className="text-[9px] font-black text-emerald-300">● ONLINE</span></div>)}{!installations.some((item: any) => item.online) ? <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma instalação online agora.</p> : null}</div></section>
      </div> : null}

      {section === "offers" ? <section className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-black">Planos e ofertas MSK LIVE</h4><p className="text-xs text-muted-foreground">Preço, validade, dispositivos, entrega e publicação em um só lugar.</p></div><span className="rounded-full border border-border px-3 py-1 text-xs">{plans.length} oferta(s)</span></div><div className="grid gap-4 xl:grid-cols-2">{plans.map((plan: any) => <OfferEditor key={plan.id} plan={plan} offer={offers.find((offer: any) => offer.plan_id === plan.id)} saving={saveOfferMutation.isPending} onSave={(payload) => saveOfferMutation.mutate(payload)} />)}<OfferEditor saving={saveOfferMutation.isPending} onSave={(payload) => saveOfferMutation.mutate(payload)} /></div></section> : null}

      {section === "licenses" ? <section className="grid gap-4 xl:grid-cols-[0.8fr_1.7fr]">
        <div className="glass rounded-3xl border border-white/5 p-5"><div className="mb-4 flex items-center gap-2"><KeyRound className="h-4 w-4 text-fuchsia-300" /><h4 className="text-[11px] font-black uppercase tracking-widest">Gerar token MSKLIVE</h4></div><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!selectedPlanId) return toast.error("Nenhum plano LIVE disponível."); if (!standalone && !email.trim()) return toast.error("Informe o e-mail."); generateMutation.mutate({ planId: selectedPlanId, ...(standalone ? { standalone: true } : { email: email.trim().toLowerCase() }), ...(note.trim() ? { note: note.trim() } : {}) }); }}><div className="space-y-1"><Label>Plano</Label><select value={selectedPlanId} onChange={(e) => setPlanId(e.target.value)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">{plans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.max_devices} disp.</option>)}</select></div><label className="flex items-center gap-2 rounded-xl border border-border/60 p-3 text-xs"><input type="checkbox" checked={standalone} onChange={(e) => setStandalone(e.target.checked)} /> Sem usuário vinculado</label>{!standalone ? <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div> : null}<div className="space-y-1"><Label>Observação</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div><Button type="submit" variant="neon" className="w-full" disabled={!data?.configured || generateMutation.isPending}>{generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Gerar licença</Button></form>{issued ? <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"><p className="text-[9px] font-black uppercase text-emerald-300">Token exclusivo</p><code className="mt-2 block break-all rounded-lg bg-black/30 p-3 text-xs">{issued.token}</code><Button size="sm" variant="outline" className="mt-2" onClick={async () => { await navigator.clipboard.writeText(issued.token); toast.success("Token copiado."); }}><Copy className="h-3.5 w-3.5" /> Copiar</Button></div> : null}</div>
        <div className="glass rounded-3xl border border-white/5 p-5"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-between"><div><h4 className="text-[11px] font-black uppercase tracking-widest">Licenças LIVE</h4><p className="text-[10px] text-muted-foreground">Somente tokens do namespace MSKLIVE.</p></div><div className="flex gap-2"><Input className="h-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pessoa, plano ou token" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="all">Todos</option><option value="active">Ativas</option><option value="inactive">Aguardando</option><option value="expired">Expiradas</option><option value="revoked">Revogadas</option></select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-b border-border/60 text-[9px] uppercase text-muted-foreground"><tr><th className="p-2">Pessoa</th><th className="p-2">Plano</th><th className="p-2">Token</th><th className="p-2">Status</th><th className="p-2">Último acesso</th><th className="p-2">Dispositivos</th><th className="p-2"></th></tr></thead><tbody>{filteredLicenses.map((license: any) => <tr key={license.id} className="border-b border-border/30"><td className="p-2"><b>{license.email}</b><div className="text-[10px] text-muted-foreground">{license.name}</div></td><td className="p-2">{license.planName}</td><td className="p-2 font-mono text-[10px] text-fuchsia-200">{license.tokenPreview}</td><td className="p-2"><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${statusClass(license.status)}`}>{statusLabel(license.status)}</span>{license.online ? <div className="mt-1 text-[9px] text-emerald-300">● ONLINE</div> : null}</td><td className="p-2 text-[10px] text-muted-foreground">{fmt(license.lastActivity)}<div>Expira: {fmt(license.expiresAt)}</div></td><td className="p-2">{license.devices.filter((d: any) => d.status === "active").length}/{license.maxDevices}</td><td className="p-2"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => actionMutation.mutate({ licenseId: license.id, action: "reset_devices" })}><RotateCcw className="h-3.5 w-3.5" /></Button>{license.status === "revoked" ? <Button size="sm" variant="ghost" onClick={() => actionMutation.mutate({ licenseId: license.id, action: "restore" })}><RefreshCw className="h-3.5 w-3.5" /></Button> : <Button size="sm" variant="ghost" onClick={() => actionMutation.mutate({ licenseId: license.id, action: "revoke" })}><Ban className="h-3.5 w-3.5 text-red-400" /></Button>}</div></td></tr>)}</tbody></table>{!filteredLicenses.length ? <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma licença encontrada.</p> : null}</div></div>
      </section> : null}

      {section === "installations" ? <section className="glass rounded-3xl border border-white/5 p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h4 className="text-sm font-black">Instalações e dispositivos</h4><p className="text-xs text-muted-foreground">Dados enviados pela validação/heartbeat da extensão MSK LIVE.</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="E-mail, instalação, versão" /></div><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="all">Todas</option><option value="online">Online</option><option value="offline">Offline</option><option value="active">Ativas</option><option value="removed">Removidas</option></select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-border/60 text-[9px] uppercase text-muted-foreground"><tr><th className="p-2">Cliente</th><th className="p-2">Instalação</th><th className="p-2">Ambiente</th><th className="p-2">Versão</th><th className="p-2">Status</th><th className="p-2">Primeiro acesso</th><th className="p-2">Último sinal</th></tr></thead><tbody>{filteredInstallations.map((item: any) => <tr key={item.id} className="border-b border-border/30"><td className="p-2"><b>{item.email}</b><div className="text-[10px] text-muted-foreground">{item.planName}</div></td><td className="p-2 font-mono text-[10px]">{item.installationId}</td><td className="p-2">{item.browser}<div className="text-[10px] text-muted-foreground">{item.os}</div></td><td className="p-2 font-black">{item.extensionVersion}</td><td className="p-2">{item.online ? <span className="text-[9px] font-black text-emerald-300">● ONLINE</span> : <span className="text-[9px] text-muted-foreground">OFFLINE</span>}<div className="text-[9px] text-muted-foreground">{item.status}</div></td><td className="p-2 text-[10px]">{fmt(item.firstSeen)}</td><td className="p-2 text-[10px]">{fmt(item.lastValidation ?? item.lastSeen)}</td></tr>)}</tbody></table>{!filteredInstallations.length ? <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma instalação encontrada.</p> : null}</div></section> : null}

      {section === "sales" ? <section className="glass rounded-3xl border border-white/5 p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h4 className="text-sm font-black">Vendas MSK LIVE</h4><p className="text-xs text-muted-foreground">Transações filtradas exclusivamente pelos planos LIVE.</p></div><div className="flex gap-2"><Input className="h-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, pedido, plano" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="all">Todas</option><option value="paid">Aprovadas</option><option value="pending">Pendentes</option><option value="failed">Falhas</option></select></div></div><div className="space-y-2">{filteredSales.map((sale: any) => <div key={sale.id} className="grid gap-3 rounded-2xl border border-border/40 bg-background/30 p-4 sm:grid-cols-[1fr_auto]"><div className="min-w-0"><p className="truncate text-sm font-black">{sale.email}</p><p className="truncate text-[10px] text-muted-foreground">{sale.planName} · {sale.identifier} · {sale.provider ?? "—"}/{sale.method ?? "—"} · {fmt(sale.paidAt ?? sale.createdAt)}</p></div><div className="text-right"><p className="font-black text-fuchsia-200">{brl(sale.amount)}</p><p className="text-[9px] uppercase text-muted-foreground">{sale.status}</p></div></div>)}{!filteredSales.length ? <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma venda encontrada.</p> : null}</div></section> : null}

      {section === "versions" ? <section className="grid gap-4 xl:grid-cols-[0.8fr_1.5fr]"><div className="glass rounded-3xl border border-white/5 p-5"><div className="flex items-center gap-2"><Upload className="h-4 w-4 text-fuchsia-300" /><h4 className="text-[11px] font-black uppercase tracking-widest">Publicar MSK LIVE</h4></div><p className="mt-2 text-xs text-muted-foreground">O ZIP fica no canal <b>msk-live</b> e é entregue somente a clientes com licença LIVE válida.</p><div className="mt-4 space-y-3"><div className="space-y-1"><Label>Versão</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="4.2.0" /></div><div className="space-y-1"><Label>Arquivo ZIP</Label><Input ref={fileRef} type="file" accept=".zip,application/zip" /></div><div className="space-y-1"><Label>Notas da versão</Label><Textarea value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} rows={3} /></div><Button variant="neon" className="w-full" onClick={uploadBuild} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Publicar nova versão</Button></div></div><div className="glass rounded-3xl border border-white/5 p-5"><div className="mb-4 flex items-center justify-between"><div><h4 className="text-[11px] font-black uppercase tracking-widest">Histórico de versões</h4><p className="text-[10px] text-muted-foreground">Canal: {data?.channel?.slug ?? LIVE_CHANNEL} · atual: {data?.channel?.version ?? "—"}</p></div><span className="rounded-full border border-border px-3 py-1 text-xs">{builds.length}</span></div><div className="space-y-2">{builds.map((build: any) => <div key={build.id} className="rounded-2xl border border-border/40 bg-background/30 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-black">v{build.version}</p>{build.is_published ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black text-emerald-300">PUBLICADA</span> : null}</div><p className="mt-1 text-[10px] text-muted-foreground">{build.file_name} · {human(build.size_bytes)} · {build.downloads ?? 0} downloads · {fmt(build.created_at)}</p>{build.release_notes ? <p className="mt-2 text-xs text-muted-foreground">{build.release_notes}</p> : null}</div><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => publishMutation.mutate({ buildId: build.id, publish: !build.is_published })}>{build.is_published ? "Despublicar" : "Publicar"}</Button><Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(build.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button></div></div></div>)}{!builds.length ? <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma versão MSK LIVE publicada ainda.</p> : null}</div></div></section> : null}
    </div>
  );
}
