import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bot,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Mail,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adminSavePlan } from "@/lib/admin.functions";
import { getCmsEditorContent } from "@/lib/cms.functions";
import { Money } from "@/components/msk/money";

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function normalizeDurationUnit(value?: string | null) {
  const unit = String(value ?? "days").toLowerCase();
  const aliases: Record<string, string> = {
    minute: "minutes",
    min: "minutes",
    hour: "hours",
    day: "days",
    week: "weeks",
    month: "months",
  };
  return aliases[unit] ?? unit;
}

function durationText(value: number, unit: string) {
  const normalized = normalizeDurationUnit(unit);
  const singular = value === 1;
  const labels: Record<string, [string, string]> = {
    minutes: ["minuto", "minutos"],
    hours: ["hora", "horas"],
    days: ["dia", "dias"],
    weeks: ["semana", "semanas"],
    months: ["mês", "meses"],
  };
  const pair = labels[normalized] ?? [normalized, normalized];
  return `${value} ${singular ? pair[0] : pair[1]}`;
}

type DeliveryMethod = "panel" | "email" | "panel_email" | "email_link";

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; hint: string }[] = [
  {
    value: "panel",
    label: "Mostrar no painel",
    hint: "A entrega fica destacada no painel do cliente assim que o pagamento for aprovado.",
  },
  {
    value: "email",
    label: "Enviar por e-mail",
    hint: "Após a aprovação, o cliente recebe o e-mail operacional da compra.",
  },
  {
    value: "panel_email",
    label: "Painel + e-mail",
    hint: "Mostra os dados no painel e também envia a confirmação por e-mail.",
  },
  {
    value: "email_link",
    label: "Enviar link por e-mail",
    hint: "Dispara um e-mail específico com o link configurado nesta oferta.",
  },
];

function normalizeDeliveryMethod(value: unknown): DeliveryMethod {
  const raw = String(value ?? "panel_email");
  return DELIVERY_OPTIONS.some((option) => option.value === raw)
    ? (raw as DeliveryMethod)
    : "panel_email";
}

function deliveryLabel(value: unknown) {
  return DELIVERY_OPTIONS.find((option) => option.value === normalizeDeliveryMethod(value))?.label ?? "Painel + e-mail";
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function deliveryFromPlan(plan: Record<string, any>) {
  const features = objectValue(plan["features"]);
  const delivery = objectValue(features["delivery"]);
  return {
    method: normalizeDeliveryMethod(delivery["method"]),
    link: String(delivery["link"] ?? ""),
    instructions: String(delivery["instructions"] ?? ""),
  };
}

type PlanForm = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  price: number | string;
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
  delivery_method: DeliveryMethod;
  delivery_link: string;
  delivery_instructions: string;
};

const EMPTY: PlanForm = {
  slug: "",
  name: "",
  description: "",
  price: "0,00",
  currency: "BRL",
  duration_label: "30 dias",
  duration_unit: "days",
  duration_value: 30,
  duration_days: 30,
  is_lifetime: false,
  max_devices: 1,
  active: true,
  sort_order: 0,
  image_url: "",
  affiliate_commission_rate: 0,
  affiliate_commission_fixed: 0,
  delivery_method: "panel_email",
  delivery_link: "",
  delivery_instructions: "",
};

type CollectionKey = "chatgpt" | "agent" | "cloner" | "extension" | "other";

type Collection = {
  key: CollectionKey;
  eyebrow: string;
  title: string;
  description: string;
  plans: Record<string, any>[];
};

function collectionKeyFor(plan: Record<string, any>): CollectionKey {
  const slug = String(plan["slug"] ?? "").toLowerCase();
  if (slug.startsWith("chatgpt") || slug.startsWith("chat-gpt") || slug.startsWith("gpt-plus")) return "chatgpt";
  if (slug.startsWith("msk-agent")) return "agent";
  if (slug.startsWith("page-cloner")) return "cloner";
  if (["free-test", "daily", "weekly", "monthly", "quarterly", "yearly", "lifetime"].includes(slug)) {
    return "extension";
  }
  return "other";
}

function collectionIcon(key: CollectionKey) {
  if (key === "chatgpt") return Sparkles;
  if (key === "agent") return Bot;
  if (key === "cloner") return Copy;
  return Layers3;
}

export function AdminSubscriptionsTab({
  plans,
  subscriptions,
}: {
  plans: Record<string, any>[];
  subscriptions: Record<string, any>[];
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(adminSavePlan);
  const getCmsFn = useServerFn(getCmsEditorContent);
  const [editing, setEditing] = useState<PlanForm | null>(null);
  const [chatgptImage, setChatgptImage] = useState("");
  const [chatgptDeliveryMethod, setChatgptDeliveryMethod] = useState<DeliveryMethod>("panel_email");
  const [chatgptDeliveryLink, setChatgptDeliveryLink] = useState("");
  const [chatgptDeliveryInstructions, setChatgptDeliveryInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const cmsQuery = useQuery({
    queryKey: ["cms-editor-content", "offers"],
    queryFn: () => getCmsFn(),
    staleTime: 30_000,
  });

  useEffect(() => {
    const image = cmsQuery.data?.["site_images"]?.plans_chatgpt_card;
    if (typeof image === "string") setChatgptImage(image);

    // Aproveita a configuração antiga da oferta especial como valor inicial na primeira migração.
    const special = objectValue(cmsQuery.data?.["special_offer_chatgpt"]);

    const delivery = objectValue(special["delivery"]);
    setChatgptDeliveryMethod(normalizeDeliveryMethod(delivery["method"]));
    setChatgptDeliveryLink(String(delivery["link"] ?? ""));
    setChatgptDeliveryInstructions(String(delivery["instructions"] ?? ""));
  }, [cmsQuery.data]);

  const chatgptPlan = useMemo(
    () => plans.find((plan) => collectionKeyFor(plan) === "chatgpt") ?? null,
    [plans],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const visiblePlans = useMemo(
    () =>
      plans.filter((plan) => {
        if (!normalizedSearch) return true;
        return [plan["name"], plan["slug"], plan["description"]]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(normalizedSearch));
      }),
    [plans, normalizedSearch],
  );

  const collections = useMemo<Collection[]>(() => {
    const grouped: Record<Exclude<CollectionKey, "chatgpt">, Record<string, any>[]> = {
      agent: [],
      cloner: [],
      extension: [],
      other: [],
    };
    visiblePlans.forEach((plan) => {
      const key = collectionKeyFor(plan);
      if (key !== "chatgpt") grouped[key].push(plan);
    });
    return [
      {
        key: "agent",
        eyebrow: "Assistente",
        title: "MSK Agente",
        description: "Ofertas e períodos do agente técnico.",
        plans: grouped.agent,
      },
      {
        key: "cloner",
        eyebrow: "Ferramenta",
        title: "Clonagem MSK",
        description: "Licenças e ofertas do clonador de páginas.",
        plans: grouped.cloner,
      },
      {
        key: "extension",
        eyebrow: "Produto principal",
        title: "Extensão MSK",
        description: "Teste grátis, planos pagos e licença principal.",
        plans: grouped.extension,
      },
      ...(grouped.other.length
        ? [
            {
              key: "other" as const,
              eyebrow: "Outras ofertas",
              title: "Outros produtos",
              description: "Ofertas que não pertencem às coleções principais.",
              plans: grouped.other,
            },
          ]
        : []),
    ];
  }, [visiblePlans]);

  async function pickAndUploadPlan(planId?: string) {
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
        const res = await fetch("/api/public/cms/upload", { method: "POST", body: fd }).then((r) => r.json());
        if (!res.url) throw new Error(res.error || "Upload falhou");
        if (editing) setEditing({ ...editing, image_url: res.url });
        toast.success("Imagem carregada. Salve a oferta para publicar.");
      } catch (err) {
        toast.error("Erro no upload: " + (err as Error).message);
      } finally {
        setUploading(null);
      }
    };
    input.click();
  }

  function edit(plan: Record<string, any>) {
    const unit = normalizeDurationUnit(plan["duration_unit"] ?? "days");
    const value = Number(plan["duration_value"] ?? plan["duration_days"] ?? 30);
    const delivery = deliveryFromPlan(plan);
    setEditing({
      id: plan["id"],
      slug: plan["slug"] ?? "",
      name: plan["name"] ?? "",
      description: plan["description"] ?? "",
      price: Number(plan["price"] ?? 0).toFixed(2).replace(".", ","),
      currency: plan["currency"] ?? "BRL",
      duration_label: plan["duration_label"] ?? durationText(value, unit),
      duration_unit: unit,
      duration_value: value,
      duration_days: unit === "days" ? Number(plan["duration_days"] ?? value) : null,
      is_lifetime: !!plan["is_lifetime"],
      max_devices: Number(plan["max_devices"] ?? 1),
      active: plan["active"] !== false,
      sort_order: Number(plan["sort_order"] ?? 0),
      image_url: plan["image_url"] ?? "",
      affiliate_commission_rate: plan["affiliate_commission_rate"] ?? 0,
      affiliate_commission_fixed: plan["affiliate_commission_fixed"] ?? 0,
      delivery_method: delivery.method,
      delivery_link: delivery.link,
      delivery_instructions: delivery.instructions,
    });
  }

  function editChatGptOffer() {
    if (chatgptPlan) {
      edit(chatgptPlan);
      return;
    }
    setEditing({
      ...EMPTY,
      slug: "chatgpt-plus-30d",
      name: "ChatGPT Plus · 30 dias",
      description: "ChatGPT Plus por 30 dias com entrega configurável após a confirmação do pagamento.",
      price: "0,00",
      duration_label: "30 dias",
      duration_unit: "days",
      duration_value: 30,
      duration_days: 30,
      max_devices: 1,
      image_url: chatgptImage,
      delivery_method: chatgptDeliveryMethod,
      delivery_link: chatgptDeliveryLink,
      delivery_instructions: chatgptDeliveryInstructions,
    });
  }

  async function save(form: PlanForm) {
    if (form.delivery_method === "email_link" && !/^https?:\/\//i.test(form.delivery_link.trim())) {
      toast.error("Informe um link http(s) para o método Enviar link por e-mail.");
      return;
    }

    setBusy(true);
    try {
      const rawPrice = String(form.price).trim();
      const normalizedPrice = Number(
        rawPrice.includes(",") ? rawPrice.replace(/\./g, "").replace(",", ".") : rawPrice,
      );
      if (!Number.isFinite(normalizedPrice)) throw new Error("Informe um preço válido, como 5,90.");

      const unit = form.is_lifetime ? "lifetime" : normalizeDurationUnit(form.duration_unit);
      const value = form.is_lifetime ? 1 : Math.max(1, Number(form.duration_value || 1));

      await saveFn({
        data: {
          ...form,
          delivery_link: form.delivery_link.trim(),
          delivery_instructions: form.delivery_instructions.trim(),
          price: normalizedPrice,
          duration_unit: unit,
          duration_value: value,
          duration_days: unit === "days" ? value : null,
          duration_label: form.is_lifetime ? "Vitalício" : durationText(value, unit),
        } as never,
      });
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
      await qc.invalidateQueries({ queryKey: ["admin-token-plans"] });
      await qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success(form.id ? "Oferta atualizada" : "Oferta criada e publicada no site");
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const activeCount = plans.filter((plan) => plan["active"] !== false).length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-primary/[.08] via-black/20 to-black/30 p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-primary">
              <Settings2 className="h-4 w-4" />
              <p className="text-[0.65rem] font-black uppercase tracking-[.22em]">Central de ofertas</p>
            </div>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">Planos & Ofertas</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Edite preço, período, publicação e a entrega automática de cada oferta no mesmo lugar.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[0.65rem] font-black uppercase tracking-wider">
              <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5">{plans.length} ofertas</span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[.08] px-3 py-1.5 text-emerald-300">{activeCount} publicadas</span>
              <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5">Entrega por oferta</span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <div className="relative min-w-0 flex-1 xl:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar oferta ou slug..."
                className="pl-9"
              />
            </div>
            <Button variant="neon" className="shrink-0" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="mr-2 h-4 w-4" /> Nova oferta
            </Button>
          </div>
        </div>
      </section>

      <OfferCollection
        collection={{
          key: "chatgpt",
          eyebrow: "Oferta adicional",
          title: "ChatGPT · 30 dias Plus",
          description: "Edite preço, validade, arte e entrega. Publicada, a oferta entra no carrinho e no checkout normal.",
          plans: chatgptPlan ? [chatgptPlan] : [],
        }}
        special
        specialImage={chatgptPlan?.["image_url"] || chatgptImage}
        specialDelivery={chatgptPlan ? deliveryFromPlan(chatgptPlan).method : chatgptDeliveryMethod}
        onSpecialEdit={editChatGptOffer}
      />

      {collections.map((collection) => (
        <OfferCollection key={collection.key} collection={collection} onEdit={edit} />
      ))}

      {editing ? (
        <PlanEditor
          editing={editing}
          busy={busy}
          uploading={uploading}
          setEditing={setEditing}
          onUpload={() => void pickAndUploadPlan(editing.id)}
          onSave={() => void save(editing)}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <section className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.6rem] font-black uppercase tracking-[.2em] text-muted-foreground">Pós-venda</p>
            <h3 className="mt-1 text-base font-black uppercase">Assinaturas ativas</h3>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[0.65rem] font-black">{subscriptions.length}</span>
        </div>
        <div className="mt-4 space-y-2">
          {subscriptions.map((s) => (
            <div key={s["id"]} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border/40 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{s["profiles"]?.email ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {s["plans"]?.name ?? "—"} · {s["current_period_end"] ? `renova em ${new Date(s["current_period_end"]).toLocaleDateString("pt-BR")}` : "sem renovação"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-muted/20 px-2.5 py-0.5 text-[0.6rem] font-black uppercase text-primary">{s["status"]}</span>
            </div>
          ))}
          {!subscriptions.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Zap className="h-4 w-4" /> Nenhuma assinatura registrada ainda.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function OfferCollection({
  collection,
  special = false,
  specialImage = "",
  specialDelivery = "panel_email",
  onEdit,
  onSpecialEdit,
}: {
  collection: Collection;
  special?: boolean;
  specialImage?: string;
  specialDelivery?: DeliveryMethod;
  onEdit?: (plan: Record<string, any>) => void;
  onSpecialEdit?: () => void;
}) {
  const Icon = collectionIcon(collection.key);
  const specialPlan = special ? collection.plans[0] : null;
  const specialPublished = !!specialPlan && specialPlan["active"] !== false && Number(specialPlan["price"] ?? 0) > 0;
  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/20">
      <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/[.08] text-primary"><Icon className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-[0.55rem] font-black uppercase tracking-[.22em] text-primary">{collection.eyebrow}</p>
            <h3 className="mt-0.5 truncate text-base font-black uppercase">{collection.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{collection.description}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[0.6rem] font-black uppercase">
          {special ? "Oferta especial" : `${collection.plans.length} ${collection.plans.length === 1 ? "oferta" : "ofertas"}`}
        </span>
      </div>

      {special ? (
        <button type="button" onClick={onSpecialEdit} className="grid w-full gap-4 p-4 text-left transition hover:bg-white/[.025] sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center sm:p-5">
          <div className="h-20 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:w-[92px]">
            {specialImage ? <img src={specialImage} alt="ChatGPT Plus 30 dias" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-6 w-6 text-muted-foreground/30" /></div>}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black uppercase">{specialPlan?.["name"] || "ChatGPT · 30 dias"}</p>
              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[0.55rem] font-black normal-case text-white">Plus</span>
              <span className={`rounded-full px-2 py-0.5 text-[0.55rem] font-black uppercase ${specialPublished ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
                {specialPublished ? "Publicado" : specialPlan ? "Oculto / sem preço" : "Configurar"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{specialPlan ? brl(specialPlan["price"]) : "Defina o valor"}</span>
              <span>Método de envio: {deliveryLabel(specialDelivery)}</span>
            </div>
          </div>
          <span className="text-[0.6rem] font-black uppercase tracking-widest text-blue-300">{specialPlan ? "Editar oferta →" : "Configurar oferta →"}</span>
        </button>
      ) : collection.plans.length ? (
        <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
          {collection.plans.map((plan) => (
            <PlanCard key={plan["id"]} plan={plan} onClick={() => onEdit?.(plan)} />
          ))}
        </div>
      ) : (
        <div className="p-5 text-sm text-muted-foreground">Nenhuma oferta nesta coleção com o filtro atual.</div>
      )}
    </section>
  );
}

function PlanCard({ plan, onClick }: { plan: Record<string, any>; onClick: () => void }) {
  const delivery = deliveryFromPlan(plan);
  return (
    <button type="button" onClick={onClick} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#080808] text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_50px_-30px_rgba(57,255,20,.35)]">
      <div className="flex min-h-24 gap-3 p-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[.03]">
          {plan["image_url"] ? <img src={plan["image_url"]} alt={plan["name"]} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-5 w-5 text-muted-foreground/25" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{plan["name"]}</p>
              <p className="mt-0.5 truncate text-[0.55rem] font-bold uppercase tracking-widest text-muted-foreground">{plan["slug"]}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.5rem] font-black uppercase ${plan["active"] !== false ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>
              {plan["active"] !== false ? "Publicado" : "Oculto"}
            </span>
          </div>
          <p className="mt-3 text-xl font-black text-primary"><Money value={plan["price"]} /></p>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {plan["is_lifetime"] ? "Vitalício" : plan["duration_label"] || durationText(Number(plan["duration_value"] ?? 1), plan["duration_unit"])} · {plan["max_devices"]} disp.
          </p>
        </div>
      </div>
      <div className="border-t border-white/5 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 text-[0.55rem] font-black uppercase tracking-wider text-muted-foreground">
          <span>Ordem {Number(plan["sort_order"] ?? 0)}</span>
          <span className="text-primary opacity-70 transition group-hover:opacity-100">Editar →</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[0.58rem] font-bold text-white/45">
          <Send className="h-3 w-3" /> {deliveryLabel(delivery.method)}
        </div>
      </div>
    </button>
  );
}

function PlanEditor({
  editing,
  busy,
  uploading,
  setEditing,
  onUpload,
  onSave,
  onCancel,
}: {
  editing: PlanForm;
  busy: boolean;
  uploading: string | null;
  setEditing: (value: PlanForm) => void;
  onUpload: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-primary/25 bg-[#090909] shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-primary/[.035] px-5 py-4 sm:px-6">
        <div>
          <p className="text-[0.6rem] font-black uppercase tracking-[.2em] text-primary">Editor profissional</p>
          <h3 className="mt-1 text-lg font-black uppercase">{editing.id ? `Editar · ${editing.name}` : "Criar nova oferta"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Preço, acesso, publicação e entrega pós-compra no mesmo editor.</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-xl p-2 text-muted-foreground hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <EditorGroup title="Identificação" description="Nome, slug e descrição vistos pelo cliente.">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome da oferta"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Slug"><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="ex: msk-agent-30d" /></Field>
              <div className="md:col-span-2"><Field label="Descrição"><textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></Field></div>
            </div>
          </EditorGroup>

          <EditorGroup title="Comercial" description="Preço, moeda e comissão de afiliado.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Preço (R$)"><Input inputMode="decimal" placeholder="49,90" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value.replace(/[^\d,.]/g, "") })} /></Field>
              <Field label="Moeda"><Input value={editing.currency || "BRL"} onChange={(e) => setEditing({ ...editing, currency: e.target.value.toUpperCase() })} /></Field>
              <Field label="Comissão afiliado (%)"><Input inputMode="decimal" value={String(editing.affiliate_commission_rate ?? 0)} onChange={(e) => setEditing({ ...editing, affiliate_commission_rate: Number(e.target.value || 0) })} /></Field>
            </div>
          </EditorGroup>

          <EditorGroup title="Validade & acesso" description="Período da licença e quantidade de dispositivos.">
            <div className="mb-3 flex flex-wrap gap-2">
              {([
                { key: "days", label: "Paga / dias" },
                { key: "free", label: "FREE · 15 min" },
                { key: "lifetime", label: "Vitalício" },
              ] as const).map((opt) => {
                const current = editing.is_lifetime ? "lifetime" : Number(String(editing.price).replace(",", ".")) === 0 ? "free" : "days";
                return (
                  <Button key={opt.key} type="button" size="sm" variant={current === opt.key ? "default" : "outline"} onClick={() => {
                    if (opt.key === "lifetime") {
                      setEditing({ ...editing, is_lifetime: true, duration_days: null, duration_value: 1, duration_unit: "lifetime", duration_label: "Vitalício" });
                      return;
                    }
                    if (opt.key === "free") {
                      setEditing({ ...editing, is_lifetime: false, price: 0, duration_days: null, duration_value: 15, duration_unit: "minutes", duration_label: "15 minutos" });
                      return;
                    }
                    const value = editing.duration_unit === "days" ? editing.duration_value || 30 : 30;
                    setEditing({ ...editing, is_lifetime: false, duration_days: value, duration_value: value, duration_unit: "days", duration_label: durationText(value, "days") });
                  }}>{opt.label}</Button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Quantidade"><Input inputMode="numeric" type="number" min={1} disabled={editing.is_lifetime} value={editing.is_lifetime ? "" : String(editing.duration_value ?? "")} onChange={(e) => {
                const value = Math.max(1, Number(e.target.value || 1));
                const unit = normalizeDurationUnit(editing.duration_unit);
                setEditing({ ...editing, duration_value: value, duration_days: unit === "days" ? value : null, duration_label: durationText(value, unit) });
              }} /></Field>
              <Field label="Unidade"><select disabled={editing.is_lifetime} value={normalizeDurationUnit(editing.duration_unit)} onChange={(e) => {
                const unit = normalizeDurationUnit(e.target.value);
                const value = Math.max(1, Number(editing.duration_value || 1));
                setEditing({ ...editing, duration_unit: unit, duration_days: unit === "days" ? value : null, duration_label: durationText(value, unit) });
              }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none disabled:opacity-50"><option value="minutes">Minutos</option><option value="hours">Horas</option><option value="days">Dias</option><option value="weeks">Semanas</option><option value="months">Meses</option></select></Field>
              <Field label="Máx. dispositivos"><Input inputMode="numeric" type="number" min={1} value={String(editing.max_devices)} onChange={(e) => setEditing({ ...editing, max_devices: Math.max(1, Number(e.target.value || 1)) })} /></Field>
              <Field label="Ordem na coleção"><Input inputMode="numeric" type="number" value={String(editing.sort_order)} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value || 0) })} /></Field>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{editing.is_lifetime ? "Licença sem expiração." : `A licença será gerada com ${durationText(editing.duration_value || 1, editing.duration_unit)}.`}</p>
          </EditorGroup>

          <DeliveryEditor
            method={editing.delivery_method}
            link={editing.delivery_link}
            instructions={editing.delivery_instructions}
            onMethod={(delivery_method) => setEditing({ ...editing, delivery_method })}
            onLink={(delivery_link) => setEditing({ ...editing, delivery_link })}
            onInstructions={(delivery_instructions) => setEditing({ ...editing, delivery_instructions })}
          />

          <EditorGroup title="Publicação" description="Controle se a oferta aparece no site.">
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-xs font-bold uppercase"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />{editing.active ? <Eye className="h-4 w-4 text-emerald-300" /> : <EyeOff className="h-4 w-4" />} No site</label>
              <label className="flex items-center gap-2 text-xs font-bold uppercase"><Switch checked={editing.is_lifetime} onCheckedChange={(v) => setEditing(v ? { ...editing, is_lifetime: true, duration_unit: "lifetime", duration_value: 1, duration_days: null, duration_label: "Vitalício" } : { ...editing, is_lifetime: false, duration_unit: "days", duration_value: 30, duration_days: 30, duration_label: "30 dias" })} /> Vitalício</label>
            </div>
          </EditorGroup>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Preview da oferta</p>
            <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
              {editing.image_url ? <img src={editing.image_url} alt="Preview" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-8 w-8 text-muted-foreground/25" /></div>}
              {uploading === (editing.id || "new-plan") ? <div className="absolute inset-0 grid place-items-center bg-black/70"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div> : null}
            </div>
            <p className="mt-3 truncate text-sm font-black">{editing.name || "Nome da oferta"}</p>
            <p className="mt-1 text-2xl font-black text-primary">{brl(Number(String(editing.price).replace(/\./g, "").replace(",", ".")) || 0)}</p>
            <p className="text-xs text-muted-foreground">{editing.is_lifetime ? "Vitalício" : durationText(editing.duration_value || 1, editing.duration_unit)}</p>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-[0.65rem] font-bold text-white/55">
              <Send className="mr-1.5 inline h-3 w-3" /> {deliveryLabel(editing.delivery_method)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="neonOutline" className="flex-1" disabled={uploading === (editing.id || "new-plan")} onClick={onUpload}><Upload className="mr-2 h-4 w-4" /> {editing.image_url ? "Trocar arte" : "Enviar arte"}</Button>
              {editing.image_url ? <Button variant="ghost" onClick={() => setEditing({ ...editing, image_url: "" })}>Remover</Button> : null}
            </div>
            <p className="mt-3 text-[0.6rem] leading-relaxed text-muted-foreground">Recomendado: 1200×800 px. A imagem aparece no card da oferta e no checkout.</p>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/[.04] p-4">
            <div className="flex items-start gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs font-black uppercase">Entrega automática</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Após a aprovação, o fluxo usa exatamente o método configurado nesta oferta.</p></div></div>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/10 bg-black/20 px-5 py-4 sm:px-6">
        <Button variant="neon" disabled={busy || !editing.name || !editing.slug} onClick={onSave}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar oferta</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </section>
  );
}

function DeliveryEditor({
  method,
  link,
  instructions,
  onMethod,
  onLink,
  onInstructions,
}: {
  method: DeliveryMethod;
  link: string;
  instructions: string;
  onMethod: (value: DeliveryMethod) => void;
  onLink: (value: string) => void;
  onInstructions: (value: string) => void;
}) {
  const selected = DELIVERY_OPTIONS.find((option) => option.value === method) ?? DELIVERY_OPTIONS[2]!;
  return (
    <EditorGroup title="Método de envio" description="Define exatamente o que aparece/é enviado quando o pagamento desta oferta é aprovado.">
      <div className="grid gap-3 sm:grid-cols-2">
        {DELIVERY_OPTIONS.map((option) => {
          const active = option.value === method;
          const Icon = option.value === "panel" ? MonitorSmartphone : option.value === "panel_email" ? Send : Mail;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onMethod(option.value)}
              className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary/50 bg-primary/[.08]" : "border-white/10 bg-black/20 hover:border-white/20"}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-xs font-black uppercase">{option.label}</p>
              </div>
              <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">{option.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label={method === "email_link" ? "Link de entrega (obrigatório)" : "Link de entrega (opcional)"}>
          <Input value={link} onChange={(e) => onLink(e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Entrega / mensagem para o cliente">
          <textarea
            value={instructions}
            onChange={(e) => onInstructions(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder={"Email: cliente@exemplo.com\nSenha: sua-senha\nInstruções adicionais..."}
          />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Para dados copiáveis no painel, use uma linha por campo no formato <strong className="text-foreground">Email: valor</strong>, <strong className="text-foreground">Senha: valor</strong> ou <strong className="text-foreground">Login: valor</strong>.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Selecionado: <strong className="text-foreground">{selected.label}</strong>. {selected.hint}</p>
    </EditorGroup>
  );
}

function EditorGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"><div className="mb-4"><p className="text-xs font-black uppercase">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-[0.58rem] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}
