import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Save, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adminSavePlan } from "@/lib/admin.functions";
import { uploadCmsAsset } from "@/lib/cms.functions";
import { Upload, RefreshCw, Image as ImageIcon } from "lucide-react";

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PlanForm = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration_label: string;
  duration_unit: string;
  duration_value: number;
  duration_days: number | null;
  is_lifetime: boolean;
  max_devices: number;
  active: boolean;
  sort_order: number;
  image_url: string;
  affiliate_commission_rate?: number;
  affiliate_commission_fixed?: number;
};

const EMPTY: PlanForm = {
  slug: "",
  name: "",
  description: "",
  price: 0,
  currency: "BRL",
  duration_label: "30 dias",
  duration_unit: "day",
  duration_value: 30,
  duration_days: 30,
  is_lifetime: false,
  max_devices: 1,
  active: true,
  sort_order: 0,
  image_url: "",
  affiliate_commission_rate: 0,
  affiliate_commission_fixed: 0,
};

/** Gestão das assinaturas: planos publicados no site + assinaturas ativas. */
export function AdminSubscriptionsTab({
  plans,
  subscriptions,
}: {
  plans: Record<string, any>[];
  subscriptions: Record<string, any>[];
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(adminSavePlan);
  // O uploadAsset via server function foi substituído pela rota /api/public/cms/upload
  // const uploadAsset = useServerFn(uploadCmsAsset);
  const [editing, setEditing] = useState<PlanForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  async function pickAndUpload(planId?: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const uploadKey = planId || "new-plan";
      setUploading(uploadKey);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("key", `plan-offer-${uploadKey}`);
        
        // Use standard fetch to call the server function as it handles multipart/form-data correctly
        const res = await fetch("/api/public/cms/upload", {
          method: "POST",
          body: fd,
        }).then(r => r.json());
        
        if (!res.url) throw new Error(res.error || "Upload falhou");
        
        if (editing) {
          setEditing({ ...editing, image_url: res.url });
        }
        toast.success("Imagem carregada!");
      } catch (err) {
        toast.error("Erro no upload: " + (err as Error).message);
      } finally {
        setUploading(null);
      }
    };
    input.click();
  }

  function edit(plan: Record<string, any>) {
    setEditing({
      id: plan["id"],
      slug: plan["slug"] ?? "",
      name: plan["name"] ?? "",
      description: plan["description"] ?? "",
      price: Number(plan["price"] ?? 0),
      currency: plan["currency"] ?? "BRL",
      duration_label: plan["duration_label"] ?? "",
      duration_unit: plan["duration_unit"] ?? "day",
      duration_value: Number(plan["duration_value"] ?? 30),
      duration_days: plan["duration_days"] ?? null,
      is_lifetime: !!plan["is_lifetime"],
      max_devices: Number(plan["max_devices"] ?? 1),
      active: plan["active"] !== false,
      sort_order: Number(plan["sort_order"] ?? 0),
      image_url: plan["image_url"] ?? "",
      affiliate_commission_rate: plan["affiliate_commission_rate"] ?? 0,
      affiliate_commission_fixed: plan["affiliate_commission_fixed"] ?? 0,
    });
  }

  async function save(form: PlanForm) {
    setBusy(true);
    try {
      await saveFn({ data: form as never });
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success(form.id ? "Plano atualizado" : "Plano criado e publicado no site");
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h4 className="text-[0.7rem] font-black uppercase tracking-widest">Planos do site</h4>
            <p className="text-xs text-muted-foreground">
              Tudo que aparece na página de planos. Edite preço, validade e visibilidade.
            </p>
          </div>
          <Button variant="neon" className="shrink-0" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="mr-2 h-4 w-4" /> Novo plano
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <button
              key={p["id"]}
              type="button"
              onClick={() => edit(p)}
              className="rounded-2xl border border-border/50 bg-black/20 p-4 text-left transition hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{p["name"]}</p>
                  <p className="truncate text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    {p["slug"]}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase ${
                    p["active"] !== false
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {p["active"] !== false ? "No site" : "Oculto"}
                </span>
              </div>
              <p className="mt-3 text-xl font-black text-primary">{brl(p["price"])}</p>
              <p className="text-xs text-muted-foreground">
                {p["is_lifetime"] ? "Vitalício" : p["duration_label"]} ·{" "}
                {p["max_devices"]} dispositivo(s)
              </p>
            </button>
          ))}
          {!plans.length && (
            <p className="text-sm text-muted-foreground">Nenhum plano cadastrado ainda.</p>
          )}
        </div>
      </section>

      {editing && (
        <section className="glass rounded-2xl border border-primary/30 p-5">
          <h4 className="text-[0.7rem] font-black uppercase tracking-widest">
            {editing.id ? "Editar plano" : "Criar plano"}
          </h4>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome">
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Slug (URL)">
              <Input
                value={editing.slug}
                onChange={(e) =>
                  setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
                }
              />
            </Field>
            <Field label="Preço (R$)">
              <Input
                inputMode="decimal"
                value={String(editing.price)}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value || 0) })}
              />
            </Field>
            <Field label="Comissão Afiliado (%)">
              <Input
                inputMode="decimal"
                value={String(editing.affiliate_commission_rate ?? 0)}
                onChange={(e) => setEditing({ ...editing, affiliate_commission_rate: Number(e.target.value || 0) })}
              />
            </Field>
            <Field label="Moeda">
              <Input
                value={editing.currency || "BRL"}
                onChange={(e) => setEditing({ ...editing, currency: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Descrição">
              <Input
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </Field>
            <Field label="Rótulo de validade">
              <Input
                placeholder="30 dias"
                value={editing.duration_label}
                onChange={(e) => setEditing({ ...editing, duration_label: e.target.value })}
              />
            </Field>
            <Field label="Validade (dias)">
              <Input
                inputMode="numeric"
                value={String(editing.duration_days ?? "")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    duration_days: e.target.value ? Number(e.target.value) : null,
                    duration_value: Number(e.target.value || editing.duration_value),
                  })
                }
              />
            </Field>
            <Field label="Máx. dispositivos">
              <Input
                inputMode="numeric"
                value={String(editing.max_devices)}
                onChange={(e) => setEditing({ ...editing, max_devices: Number(e.target.value || 1) })}
              />
            </Field>
            <Field label="Ordem">
              <Input
                inputMode="numeric"
                value={String(editing.sort_order)}
                onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value || 0) })}
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Imagem da Oferta (Upload)">
                <div className="mt-2 flex items-center gap-4">
                  <div className="relative h-32 w-48 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {editing.image_url ? (
                      <img
                        src={editing.image_url}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    {uploading === (editing.id || "new-plan") && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="URL da Imagem"
                        value={editing.image_url}
                        onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="neonOutline"
                        className="shrink-0"
                        disabled={uploading === (editing.id || "new-plan")}
                        onClick={() => void pickAndUpload(editing.id)}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[0.65rem] font-medium text-muted-foreground uppercase leading-relaxed">
                      Recomendado: 1200x800px. A imagem aparecerá no carrossel de planos e no checkout.
                    </p>
                  </div>
                </div>
              </Field>
            </div>
            <div className="flex items-end gap-6">
              <label className="flex items-center gap-2 text-xs font-bold uppercase">
                <Switch
                  checked={editing.is_lifetime}
                  onCheckedChange={(v) => setEditing({ ...editing, is_lifetime: v })}
                />
                Vitalício
              </label>
              <label className="flex items-center gap-2 text-xs font-bold uppercase">
                <Switch
                  checked={editing.active}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                No site
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="neon" disabled={busy || !editing.name || !editing.slug} onClick={() => void save(editing)}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar plano
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </section>
      )}

      <section>
        <h4 className="text-[0.7rem] font-black uppercase tracking-widest">Assinaturas ativas</h4>
        <div className="mt-4 space-y-2">
          {subscriptions.map((s) => (
            <div
              key={s["id"]}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border/40 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{s["profiles"]?.email ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {s["plans"]?.name ?? "—"} ·{" "}
                  {s["current_period_end"]
                    ? `renova em ${new Date(s["current_period_end"]).toLocaleDateString("pt-BR")}`
                    : "sem renovação"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-muted/20 px-2.5 py-0.5 text-[0.6rem] font-black uppercase text-primary">
                {s["status"]}
              </span>
            </div>
          ))}
          {!subscriptions.length && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" /> Nenhuma assinatura registrada ainda.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[0.6rem] font-bold uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
