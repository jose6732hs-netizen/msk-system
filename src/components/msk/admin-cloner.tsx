import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgePercent,
  CheckCircle2,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  FileArchive,
  Gift,
  Loader2,
  MousePointerClick,
  Save,
  Share2,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  adminCreateClonerUpload,
  adminGetCloner,
  adminRegisterClonerZip,
  adminSaveCloner,
} from "@/lib/cloner.functions";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function human(bytes?: number | null) {
  if (!bytes) return "—";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 break-words text-[9px] font-black uppercase tracking-[.14em] text-muted-foreground">{label}</p>
        <span className="shrink-0 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </div>
      <p className="mt-2 break-words text-xl font-black sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type EditablePlan = {
  id: string;
  slug: string;
  cadence: string;
  name: string;
  durationLabel: string;
  badge: string;
  price: string;
  active: boolean;
};

export function AdminClonerTab() {
  const qc = useQueryClient();
  const getAdmin = useServerFn(adminGetCloner);
  const saveAdmin = useServerFn(adminSaveCloner);
  const createUpload = useServerFn(adminCreateClonerUpload);
  const registerZip = useServerFn(adminRegisterClonerZip);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-cloner"],
    queryFn: () => getAdmin(),
    refetchInterval: 15_000,
  });

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [shareText, setShareText] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [smartOffersEnabled, setSmartOffersEnabled] = useState(true);
  const [smartDiscount, setSmartDiscount] = useState("10");
  const [plans, setPlans] = useState<EditablePlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setTitle(data.config.title ?? "");
    setSubtitle(data.config.subtitle ?? "");
    setDescription(data.config.description ?? "");
    setShareText(data.config.share_text ?? "");
    setEnabled(!!data.config.enabled);
    setSmartOffersEnabled(data.config.smart_offers_enabled !== false);
    setSmartDiscount(String(Number(data.config.smart_discount_percent ?? 10)));
    setPlans(
      (data.plans ?? []).map((plan: any) => ({
        id: plan.id,
        slug: plan.slug,
        cadence: plan.cadence,
        name: plan.name,
        durationLabel: plan.durationLabel,
        badge: plan.badge,
        price: Number(plan.price ?? 0).toFixed(2),
        active: !!plan.active,
      })),
    );
  }, [data]);

  async function save() {
    const discount = Number(String(smartDiscount).replace(",", "."));
    if (!Number.isFinite(discount) || discount < 1 || discount > 50) {
      toast.error("O desconto inteligente deve ficar entre 1% e 50%.");
      return;
    }

    const normalizedPlans = plans.map((plan) => ({
      id: plan.id,
      active: plan.active,
      price: Number(String(plan.price).replace(",", ".")),
    }));
    if (normalizedPlans.length !== 3 || normalizedPlans.some((plan) => !Number.isFinite(plan.price) || plan.price <= 0)) {
      toast.error("Preencha corretamente os preços dos três planos.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveAdmin({
        data: {
          enabled,
          smartOffersEnabled,
          smartDiscountPercent: discount,
          title,
          subtitle,
          description,
          shareText,
          plans: normalizedPlans,
        },
      });
      toast.success(result.enabled ? "Clonador e ofertas inteligentes atualizados." : "Configurações do Clonador salvas.");
      await qc.invalidateQueries({ queryKey: ["admin-cloner"] });
      await qc.invalidateQueries({ queryKey: ["plans"] });
      await qc.invalidateQueries({ queryKey: ["cloner-product"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadZip() {
    if (!file) return toast.error("Selecione o arquivo .zip da ferramenta.");
    if (!/\.zip$/i.test(file.name)) return toast.error("O arquivo precisa ser .zip.");
    setUploading(true);
    try {
      const signed = await createUpload({ data: { fileName: file.name } });
      const { error: uploadError } = await supabase.storage
        .from("extension-builds")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: "application/zip" });
      if (uploadError) throw new Error(uploadError.message);
      await registerZip({ data: { storagePath: signed.path, fileName: file.name, sizeBytes: file.size } });
      toast.success("ZIP privado enviado. A entrega continua bloqueada até o pagamento.");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["admin-cloner"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function copyCheckout() {
    const url = `${window.location.origin}${data?.checkoutPath ?? "/clonagem"}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link do checkout copiado.");
  }

  async function shareCheckout() {
    const url = `${window.location.origin}${data?.checkoutPath ?? "/clonagem"}`;
    const text = shareText || "Conheça o MSK Clonador de Páginas.";
    if (navigator.share) {
      try {
        await navigator.share({ title: title || "MSK Clonador de Páginas", text, url });
      } catch {
        // Compartilhamento cancelado pelo usuário.
      }
    } else {
      await copyCheckout();
    }
  }

  function patchPlan(id: string, patch: Partial<EditablePlan>) {
    setPlans((current) => current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
  }

  if (isLoading) {
    return <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (error) {
    return <div className="max-w-full break-words rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">{(error as Error).message}</div>;
  }

  const m = data?.metrics;
  const zipReady = !!data?.config.zip_storage_path;

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-hidden sm:space-y-8">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary">Clonador + cross-sell inteligente</p>
          <h3 className="mt-1 break-words text-xl font-black uppercase tracking-tight sm:text-2xl">Checkout · Clonador de Páginas</h3>
          <p className="mt-1 max-w-3xl break-words text-xs leading-relaxed text-muted-foreground">Três planos separados, ZIP privado, PIX, licenças e ofertas cruzadas com a extensão principal.</p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto">
          <Button variant="ghost" className="min-w-0 whitespace-normal" onClick={copyCheckout}><Copy className="mr-2 h-4 w-4 shrink-0" /> Copiar link</Button>
          <Button variant="ghost" className="min-w-0 whitespace-normal" onClick={shareCheckout}><Share2 className="mr-2 h-4 w-4 shrink-0" /> Compartilhar</Button>
          <Button asChild variant="neonOutline" className="min-w-0 whitespace-normal"><a href="/clonagem" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4 shrink-0" /> Abrir checkout</a></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        <Metric icon={<Users />} label="Visualizações" value={String(m?.views ?? 0)} />
        <Metric icon={<ShoppingCart />} label="PIX gerados" value={String(m?.pixGenerated ?? 0)} />
        <Metric icon={<CheckCircle2 />} label="Vendas pagas" value={String(m?.paid ?? 0)} />
        <Metric icon={<DollarSign />} label="Receita" value={brl(Number(m?.revenue ?? 0))} />
        <Metric icon={<Share2 />} label="Compartilhamentos" value={String(m?.shares ?? 0)} />
        <Metric icon={<Download />} label="Downloads" value={String(m?.downloads ?? 0)} />
        <Metric icon={<Sparkles />} label="Ofertas exibidas" value={String(m?.offerShown ?? 0)} />
        <Metric icon={<Gift />} label="Ofertas aceitas" value={String(m?.offerAccepted ?? 0)} />
        <Metric icon={<BadgePercent />} label="Aceitação" value={`${Number(m?.offerAcceptance ?? 0).toFixed(1)}%`} hint="Aceites ÷ ofertas" />
        <Metric icon={<TrendingUp />} label="Combos pagos" value={String(m?.bundlePaid ?? 0)} />
        <Metric icon={<DollarSign />} label="Receita adicional" value={brl(Number(m?.upsellRevenue ?? 0))} hint="Valor das ferramentas adicionadas" />
        <Metric icon={<BadgePercent />} label="Desconto concedido" value={brl(Number(m?.discountsGranted ?? 0))} />
      </div>

      {m?.topCombo ? (
        <div className="min-w-0 rounded-2xl border border-primary/20 bg-primary/[.05] p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-primary">Combo que mais converte</p>
          <p className="mt-2 break-all text-sm font-black">{m.topCombo.key}</p>
          <p className="mt-1 text-xs text-muted-foreground">{m.topCombo.sales} venda(s) paga(s)</p>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.025] p-4 sm:rounded-[2rem] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h4 className="text-sm font-black uppercase tracking-widest">3 ofertas do Clonador</h4>
              <p className="mt-1 break-words text-xs text-muted-foreground">Diário, Semanal e Mensal. O preço exibido no checkout vem destes campos.</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 lg:justify-start">
              <span className={`text-[10px] font-black uppercase ${enabled ? "text-primary" : "text-muted-foreground"}`}>{enabled ? "Checkout ativo" : "Checkout inativo"}</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.id} className="min-w-0 rounded-2xl border border-white/10 bg-[#090909] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-block rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-primary">{plan.badge}</span>
                    <h5 className="mt-3 break-words text-sm font-black uppercase">{plan.name}</h5>
                    <p className="mt-1 text-[10px] text-muted-foreground">{plan.durationLabel}</p>
                  </div>
                  <Switch checked={plan.active} onCheckedChange={(active) => patchPlan(plan.id, { active })} />
                </div>
                <div className="mt-4 space-y-1.5">
                  <Label>Preço (R$)</Label>
                  <Input inputMode="decimal" value={plan.price} onChange={(e) => patchPlan(plan.id, { price: e.target.value })} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2"><Label>Nome do produto</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Subtítulo</Label><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Descrição</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Texto de compartilhamento</Label><Textarea rows={3} value={shareText} onChange={(e) => setShareText(e.target.value)} /></div>
          </div>

          <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[.04] p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 shrink-0 text-primary" /><h5 className="text-xs font-black uppercase tracking-widest">Ofertas inteligentes</h5></div>
                <p className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">Ao comprar um produto, oferece o equivalente da outra extensão com o mesmo período. O desconto vale somente para o item adicional.</p>
              </div>
              <Switch checked={smartOffersEnabled} onCheckedChange={setSmartOffersEnabled} />
            </div>
            <div className="mt-4 max-w-xs space-y-1.5">
              <Label>Desconto da ferramenta complementar (%)</Label>
              <Input inputMode="decimal" value={smartDiscount} onChange={(e) => setSmartDiscount(e.target.value)} />
            </div>
          </div>

          <Button variant="neon" className="mt-5 w-full sm:w-auto" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar ofertas
          </Button>
        </section>

        <section className="min-w-0 rounded-[1.5rem] border border-primary/15 bg-primary/[.04] p-4 sm:rounded-[2rem] sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><FileArchive className="h-5 w-5" /></div>
            <div className="min-w-0"><h4 className="break-words text-sm font-black uppercase tracking-widest">ZIP pós-pagamento</h4><p className="mt-1 break-words text-xs text-muted-foreground">Mesmo arquivo protegido para os três planos.</p></div>
          </div>

          {zipReady ? (
            <div className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="break-all text-sm font-bold">{data?.config.zip_file_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{human(data?.config.zip_size_bytes)}</p>
              <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Protegido</div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs text-amber-300">Envie o ZIP antes de ativar as ofertas.</div>
          )}

          <div className="mt-5 min-w-0 space-y-3">
            <Input ref={fileRef} type="file" accept=".zip,application/zip" className="max-w-full" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? <p className="break-all text-xs text-muted-foreground">Selecionado: <b className="text-foreground">{file.name}</b> · {human(file.size)}</p> : null}
            <Button className="w-full whitespace-normal" variant="neonOutline" disabled={uploading || !file} onClick={uploadZip}>{uploading ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <Upload className="mr-2 h-4 w-4 shrink-0" />} {zipReady ? "Substituir ZIP" : "Enviar ZIP privado"}</Button>
          </div>
          <p className="mt-4 break-words rounded-xl border border-white/5 bg-black/20 p-3 text-[10px] leading-relaxed text-muted-foreground">O caminho do Storage não é exposto. Depois do `PAID`, o servidor gera uma URL temporária de download.</p>
        </section>
      </div>

      <section className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[.025] p-4 sm:rounded-[2rem] sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0"><h4 className="break-words text-sm font-black uppercase tracking-widest">Vendas do Clonador e combos</h4><p className="mt-1 break-words text-xs text-muted-foreground">Pagamentos simples e compras com oferta inteligente.</p></div>
          <MousePointerClick className="h-5 w-5 shrink-0 text-primary" />
        </div>

        <div className="mt-5 grid gap-3 md:hidden">
          {(data?.recentSales ?? []).map((sale: any) => {
            const paid = String(sale.status).toUpperCase() === "PAID" || !!sale.paid_at;
            return (
              <div key={sale.id} className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{sale.profile?.name || "Cliente"}</p><p className="truncate text-xs text-muted-foreground">{sale.profile?.email || "—"}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black uppercase ${paid ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-400/15 text-amber-300"}`}>{paid ? "Pago" : sale.status}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div><span className="text-muted-foreground">Valor</span><p className="font-black text-primary">{brl(Number(sale.amount))}</p></div><div><span className="text-muted-foreground">Tipo</span><p className="font-bold">{sale.smartBundle ? "Combo" : "Clonador"}</p></div></div>
                {sale.comboKey ? <p className="mt-3 break-all text-[9px] text-muted-foreground">{sale.comboKey}</p> : null}
              </div>
            );
          })}
        </div>

        <div className="mt-5 hidden min-w-0 overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-white/10 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="p-3">Cliente</th><th className="p-3">Data</th><th className="p-3">Tipo</th><th className="p-3">Gateway</th><th className="p-3">Valor</th><th className="p-3">Status</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {(data?.recentSales ?? []).map((sale: any) => {
                const paid = String(sale.status).toUpperCase() === "PAID" || !!sale.paid_at;
                return <tr key={sale.id}><td className="p-3"><p className="font-bold">{sale.profile?.name || "Cliente"}</p><p className="max-w-[220px] truncate text-muted-foreground">{sale.profile?.email || "—"}</p></td><td className="p-3 text-muted-foreground">{new Date(sale.created_at).toLocaleString("pt-BR")}</td><td className="p-3">{sale.smartBundle ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black uppercase text-primary">Combo</span> : "Clonador"}</td><td className="p-3 uppercase text-muted-foreground">{sale.provider || "—"}</td><td className="p-3 font-black text-primary">{brl(Number(sale.amount))}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${paid ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-400/15 text-amber-300"}`}>{paid ? "Pago" : sale.status}</span></td></tr>;
              })}
            </tbody>
          </table>
        </div>
        {!data?.recentSales?.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda do Clonador ainda.</p> : null}
      </section>
    </div>
  );
}
