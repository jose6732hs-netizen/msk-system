import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, CheckCircle2, Loader2, Package, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FilterChips } from "@/components/msk/filter-chips";
import { AdminAgentControlCenter } from "@/components/msk/admin-agent-control-center";
import { agentAdminOverview } from "@/lib/agent-admin.functions";
import { adminSavePlan } from "@/lib/admin.functions";
import {
  adminCreateUploadUrl,
  adminRegisterBuild,
  adminSetBuildPublished,
} from "@/lib/extension.functions";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const human = (b?: number | null) =>
  !b ? "—" : b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(0)} KB`;

const groupOf = (status: string) => {
  const s = status.toLowerCase();
  if (["paid", "approved", "completed"].includes(s)) return "paid";
  if (["pending", "waiting_payment", "processing"].includes(s)) return "pending";
  return "failed";
};

export function AdminAgentTab() {
  const qc = useQueryClient();
  const overview = useServerFn(agentAdminOverview);
  const savePlan = useServerFn(adminSavePlan);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const registerBuild = useServerFn(adminRegisterBuild);
  const setPublished = useServerFn(adminSetBuildPublished);

  const { data, isLoading } = useQuery({ queryKey: ["agent-admin"], queryFn: () => overview() });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const plans = data?.plans ?? [];
  const sales = data?.sales ?? [];
  const builds = data?.builds ?? [];
  const metrics = data?.metrics;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (filter !== "all" && groupOf(s.status) !== filter) return false;
      if (!term) return true;
      return (
        s.buyer_email.toLowerCase().includes(term) ||
        s.plan_name.toLowerCase().includes(term) ||
        s.identifier.toLowerCase().includes(term)
      );
    });
  }, [sales, filter, search]);

  const savePlanMutation = useMutation({
    mutationFn: (plan: Record<string, unknown>) => savePlan({ data: plan as never }),
    onSuccess: () => {
      toast.success("Oferta do MSK Agente atualizada.");
      qc.invalidateQueries({ queryKey: ["agent-admin"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: (v: { buildId: string; publish: boolean }) => setPublished({ data: v }),
    onSuccess: () => {
      toast.success("Entrega do MSK Agente atualizada.");
      qc.invalidateQueries({ queryKey: ["agent-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Selecione o arquivo .zip do MSK Agente."); return; }
    if (!/\.zip$/i.test(file.name)) { toast.error("O arquivo precisa ser .zip"); return; }
    const v = version.trim();
    if (!v) { toast.error("Informe a versão (ex.: 2.3.0)."); return; }
    setUploading(true);
    try {
      const signed = await createUploadUrl({ data: { version: v, fileName: file.name } });
      const res = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/zip" },
        body: file,
      });
      if (!res.ok) throw new Error("Falha ao enviar o arquivo para o storage.");
      await registerBuild({
        data: {
          version: v,
          fileName: file.name,
          storagePath: signed.path,
          sizeBytes: file.size,
          channelSlug: "msk-agente",
          displayName: "MSK Agente",
          releaseNotes: notes.trim() || undefined,
          publish: true,
        },
      });
      toast.success("ZIP do MSK Agente publicado. Ele será liberado após o pagamento aprovado da oferta do MSK Agente.");
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["agent-admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload.");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando MSK Agente…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-2 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest">MSK Agente</h3>
          <p className="text-xs text-muted-foreground">Ofertas, compras, mensagens para a extensão e entrega do arquivo do assistente.</p>
        </div>
      </div>

      <AdminAgentControlCenter />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Receita aprovada", brl(metrics?.revenue ?? 0), Wallet],
          ["Compras aprovadas", String(metrics?.paidCount ?? 0), CheckCircle2],
          ["Aguardando pagamento", String(metrics?.pendingCount ?? 0), Loader2],
          ["Licenças ativas", String(metrics?.activeLicenses ?? 0), Package],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="glass rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-black">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </div>
        ))}
      </div>

      {/* Ofertas */}
      <section className="glass rounded-3xl border border-white/5 p-5">
        <h4 className="mb-4 text-[0.7rem] font-black uppercase tracking-widest">Ofertas do assistente</h4>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <form
              key={plan.id}
              className="space-y-3 rounded-2xl border border-border/50 bg-background/40 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                savePlanMutation.mutate({
                  id: plan.id,
                  slug: plan.slug,
                  name: String(form.get("name") ?? plan.name),
                  description: String(form.get("description") ?? ""),
                  price: Number(String(form.get("price") ?? "0").replace(",", ".")),
                  currency: "BRL",
                  duration_label: String(form.get("duration_label") ?? ""),
                  duration_unit: plan.duration_unit,
                  duration_value: Number(form.get("duration_value") ?? plan.duration_value),
                  duration_days: plan.duration_unit === "days" ? Number(form.get("duration_value") ?? plan.duration_value) : null,
                  is_lifetime: plan.is_lifetime,
                  auto_renew: false,
                  max_devices: plan.max_devices,
                  active: form.get("active") === "on",
                  sort_order: plan.sort_order,
                  image_url: String(form.get("image_url") ?? ""),
                  affiliate_commission_rate: Number(form.get("commission") ?? plan.affiliate_commission_rate),
                  affiliate_commission_fixed: 0,
                });
              }}
            >
              {plan.image_url ? (
                <img src={plan.image_url} alt={plan.name} className="h-28 w-full rounded-xl object-cover" />
              ) : null}
              <div className="space-y-1">
                <Label className="text-[0.6rem] uppercase tracking-widest">Nome</Label>
                <Input name="name" defaultValue={plan.name} className="h-9 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[0.6rem] uppercase tracking-widest">Preço (R$)</Label>
                  <Input name="price" defaultValue={String(plan.price)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.6rem] uppercase tracking-widest">Validade</Label>
                  <Input name="duration_value" type="number" min={1} defaultValue={plan.duration_value} className="h-9 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[0.6rem] uppercase tracking-widest">Rótulo</Label>
                  <Input name="duration_label" defaultValue={plan.duration_label} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.6rem] uppercase tracking-widest">Comissão %</Label>
                  <Input name="commission" type="number" min={0} max={100} defaultValue={plan.affiliate_commission_rate} className="h-9 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[0.6rem] uppercase tracking-widest">Imagem (URL)</Label>
                <Input name="image_url" defaultValue={plan.image_url ?? ""} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[0.6rem] uppercase tracking-widest">Descrição</Label>
                <Textarea name="description" defaultValue={plan.description} rows={3} className="text-xs" />
              </div>
              <label className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest">
                <input type="checkbox" name="active" defaultChecked={plan.active} className="accent-primary" /> Oferta ativa
              </label>
              <Button type="submit" variant="neon" size="sm" className="w-full text-[0.65rem] font-black uppercase" disabled={savePlanMutation.isPending}>
                Salvar oferta
              </Button>
            </form>
          ))}
        </div>
      </section>

      {/* Compras */}
      <section className="glass rounded-3xl border border-white/5 p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h4 className="text-[0.7rem] font-black uppercase tracking-widest">Compras do MSK Agente</h4>
          <Input
            placeholder="Buscar por e-mail, plano ou pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full text-xs lg:max-w-xs"
          />
        </div>
        <FilterChips
          className="mb-4"
          value={filter}
          onChange={setFilter}
          chips={[
            { id: "all", label: "Todas", count: sales.length },
            { id: "paid", label: "Aprovadas", count: sales.filter((s) => groupOf(s.status) === "paid").length },
            { id: "pending", label: "Pendentes", count: sales.filter((s) => groupOf(s.status) === "pending").length },
            { id: "failed", label: "Não pagas", count: sales.filter((s) => groupOf(s.status) === "failed").length },
          ]}
        />
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma compra encontrada para este filtro.</p>
          ) : (
            filtered.map((s) => (
              <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border/40 bg-background/30 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.buyer_email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.plan_name} · {s.provider ?? "—"} · {s.method ?? "pix"} · {fmt(s.paid_at ?? s.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-primary">{brl(s.amount)}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.55rem] font-black uppercase ${
                      groupOf(s.status) === "paid"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : groupOf(s.status) === "pending"
                          ? "bg-yellow-500/15 text-yellow-500"
                          : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Entrega */}
      <section className="glass rounded-3xl border border-white/5 p-5">
        <h4 className="text-[0.7rem] font-black uppercase tracking-widest">Entrega — arquivo .zip do agente</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          O ZIP publicado aqui é o que o cliente baixa automaticamente após o pagamento aprovado da oferta do MSK Agente.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label className="text-[0.6rem] uppercase tracking-widest">Versão</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2.3.0" className="h-9 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[0.6rem] uppercase tracking-widest">Arquivo .zip</Label>
            <Input ref={fileRef} type="file" accept=".zip" className="h-9 text-xs" />
          </div>
          <Button onClick={handleUpload} variant="neon" className="self-end text-[0.65rem] font-black uppercase" disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Publicar entrega
          </Button>
        </div>
        <div className="mt-3 space-y-1">
          <Label className="text-[0.6rem] uppercase tracking-widest">Notas da versão</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs" placeholder="O que mudou nesta versão do agente..." />
        </div>

        <div className="mt-5 space-y-2">
          {builds.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum arquivo do agente publicado ainda.</p>
          ) : (
            builds.map((b: any) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    v{b.version} · {b.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {human(b.size_bytes)} · {fmt(b.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[0.6rem] font-black uppercase ${b.is_published ? "text-primary" : "text-muted-foreground"}`}>
                    {b.is_published ? "Entregando" : "Inativo"}
                  </span>
                  <Switch
                    checked={!!b.is_published}
                    disabled={publishMutation.isPending}
                    onCheckedChange={(publish) => publishMutation.mutate({ buildId: b.id, publish })}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
