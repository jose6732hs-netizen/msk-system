import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Copy, DollarSign, Download, ExternalLink, FileArchive, Loader2, MousePointerClick, Save, Share2, ShoppingCart, TrendingUp, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { adminCreateClonerUpload, adminGetCloner, adminRegisterClonerZip, adminSaveCloner } from "@/lib/cloner.functions";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function human(bytes?: number | null) {
  if (!bytes) return "—";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-[.18em] text-muted-foreground">{label}</p><span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span></div>
      <p className="mt-2 text-2xl font-black">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

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
  const [price, setPrice] = useState("");
  const [enabled, setEnabled] = useState(false);
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
    setPrice(String(Number(data.plan?.price ?? 0).toFixed(2)));
    setEnabled(!!data.config.enabled && !!data.plan?.active);
  }, [data?.plan?.id, data?.config?.title, data?.plan?.updated_at]);

  async function save() {
    const numericPrice = Number(String(price).replace(",", "."));
    if (!Number.isFinite(numericPrice) || numericPrice < 0) return toast.error("Informe um preço válido.");
    setSaving(true);
    try {
      const result = await saveAdmin({ data: { enabled, title, subtitle, description, shareText, price: numericPrice } });
      toast.success(result.enabled ? "Checkout do clonador ativado." : "Configurações do clonador salvas.");
      await qc.invalidateQueries({ queryKey: ["admin-cloner"] });
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
      toast.success("ZIP privado enviado. Ele só será liberado depois do pagamento.");
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
      try { await navigator.share({ title: title || "MSK Clonador de Páginas", text, url }); } catch { /* cancelado */ }
    } else await copyCheckout();
  }

  if (isLoading) return <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">{(error as Error).message}</div>;

  const m = data?.metrics;
  const zipReady = !!data?.config.zip_storage_path;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Produto separado</p>
          <h3 className="mt-1 text-2xl font-black uppercase tracking-tight">Checkout · Clonador de Páginas</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">Gerencie preço, oferta, ZIP privado, compartilhamento e o funil específico desta ferramenta.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={copyCheckout}><Copy className="mr-2 h-4 w-4" /> Copiar link</Button>
          <Button variant="ghost" onClick={shareCheckout}><Share2 className="mr-2 h-4 w-4" /> Compartilhar</Button>
          <Button asChild variant="neonOutline"><a href="/clonagem" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Abrir checkout</a></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Metric icon={<Users />} label="Visualizações" value={String(m?.views ?? 0)} />
        <Metric icon={<Share2 />} label="Compartilhamentos" value={String(m?.shares ?? 0)} />
        <Metric icon={<ShoppingCart />} label="PIX gerados" value={String(m?.pixGenerated ?? 0)} />
        <Metric icon={<CheckCircle2 />} label="Vendas pagas" value={String(m?.paid ?? 0)} />
        <Metric icon={<TrendingUp />} label="Conversão" value={`${Number(m?.conversion ?? 0).toFixed(1)}%`} hint="Pagos ÷ PIX gerados" />
        <Metric icon={<DollarSign />} label="Receita" value={brl(Number(m?.revenue ?? 0))} />
        <Metric icon={<Download />} label="Downloads" value={String(m?.downloads ?? 0)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[.025] p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4"><div><h4 className="text-sm font-black uppercase tracking-widest">Oferta e checkout</h4><p className="mt-1 text-xs text-muted-foreground">O preço vem do servidor e não pode ser alterado pelo navegador.</p></div><div className="flex items-center gap-2"><span className={`text-[10px] font-black uppercase ${enabled ? "text-primary" : "text-muted-foreground"}`}>{enabled ? "Ativo" : "Inativo"}</span><Switch checked={enabled} onCheckedChange={setEnabled} /></div></div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Nome do produto</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Subtítulo</Label><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Preço PIX (R$)</Label><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" /></div>
            <div className="space-y-1.5"><Label>Status do arquivo</Label><div className={`flex h-10 items-center rounded-md border px-3 text-xs font-bold ${zipReady ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-amber-400/25 bg-amber-400/10 text-amber-300"}`}>{zipReady ? "ZIP pronto para entrega" : "Envie o ZIP antes de ativar"}</div></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Texto de compartilhamento</Label><Textarea rows={3} value={shareText} onChange={(e) => setShareText(e.target.value)} /></div>
          </div>
          <Button variant="neon" className="mt-5" onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar checkout</Button>
        </section>

        <section className="rounded-[2rem] border border-primary/15 bg-primary/[.04] p-5 sm:p-7">
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary"><FileArchive className="h-5 w-5" /></div><div><h4 className="text-sm font-black uppercase tracking-widest">ZIP pós-pagamento</h4><p className="mt-1 text-xs text-muted-foreground">Bucket privado · URL temporária após PAID</p></div></div>

          {zipReady ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4"><p className="break-all text-sm font-bold">{data?.config.zip_file_name}</p><p className="mt-1 text-xs text-muted-foreground">{human(data?.config.zip_size_bytes)}</p><div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Protegido e configurado</div></div> : null}

          <div className="mt-5 space-y-3">
            <Input ref={fileRef} type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? <p className="text-xs text-muted-foreground">Selecionado: <b className="text-foreground">{file.name}</b> · {human(file.size)}</p> : null}
            <Button className="w-full" variant="neonOutline" disabled={uploading || !file} onClick={uploadZip}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} {zipReady ? "Substituir ZIP" : "Enviar ZIP privado"}</Button>
          </div>
          <p className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3 text-[10px] leading-relaxed text-muted-foreground">O caminho do Storage nunca é enviado ao checkout público. Após o pagamento, o servidor valida usuário + transação + produto e gera uma URL assinada por apenas 5 minutos.</p>
        </section>
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-white/[.025] p-5 sm:p-7">
        <div className="flex items-center justify-between"><div><h4 className="text-sm font-black uppercase tracking-widest">Vendas do clonador</h4><p className="mt-1 text-xs text-muted-foreground">Últimas tentativas e pagamentos desta ferramenta.</p></div><MousePointerClick className="h-5 w-5 text-primary" /></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-white/10 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="p-3">Cliente</th><th className="p-3">Data</th><th className="p-3">Gateway</th><th className="p-3">Valor</th><th className="p-3">Status</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {(data?.recentSales ?? []).map((sale: any) => {
                const paid = String(sale.status).toUpperCase() === "PAID" || !!sale.paid_at;
                return <tr key={sale.id}><td className="p-3"><p className="font-bold">{sale.profile?.name || "Cliente"}</p><p className="text-muted-foreground">{sale.profile?.email || "—"}</p></td><td className="p-3 text-muted-foreground">{new Date(sale.created_at).toLocaleString("pt-BR")}</td><td className="p-3 uppercase text-muted-foreground">{sale.provider || "—"}</td><td className="p-3 font-black text-primary">{brl(Number(sale.amount))}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${paid ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-400/15 text-amber-300"}`}>{paid ? "Pago" : sale.status}</span></td></tr>;
              })}
            </tbody>
          </table>
          {!data?.recentSales?.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda do clonador ainda.</p> : null}
        </div>
      </section>
    </div>
  );
}
