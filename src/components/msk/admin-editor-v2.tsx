import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  History,
  Image as ImageIcon,
  Layout,
  MessageCircle,
  Monitor,
  Palette,
  RefreshCw,
  Save,
  ShoppingCart,
  Trash2,
  Trophy,
  Type,
  Upload,
  Users,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TutorialsManager } from "@/components/msk/tutorials-manager";
import { getCmsContent, getCmsHistory, publishCmsDraft, saveCmsDraft } from "@/lib/cms.functions";
import {
  DEFAULT_LANDING_BANNERS,
  DEFAULT_PANEL_BANNERS,
  SITE_IMAGE_GROUPS,
  SITE_IMAGE_SLOTS,
} from "@/lib/site-images";
import { supabase } from "@/integrations/supabase/client";

type BannerItem = {
  url: string;
  alt?: string;
  active?: boolean;
  order?: number;
};

type Section =
  | "hero"
  | "banners"
  | "panel"
  | "images"
  | "cart_offer"
  | "partners"
  | "branding"
  | "awards"
  | "copy"
  | "recovery"
  | "splits"
  | "tutorials"
  | "preview"
  | "history";

const DEFAULT_CART_RECOMMENDATION = {
  enabled: true,
  product_slug: "chatgpt-plus-30d",
  eyebrow: "Recomendado para seu projeto",
  title: "Leve o ChatGPT Plus para acelerar seu site",
  description:
    "Crie banners, refine copies e acelere ajustes do projeto com os recursos do ChatGPT Plus. Uma opção complementar para produzir com mais agilidade e manter tudo no mesmo fluxo.",
  note: "Oferta opcional. Adicione agora e pague junto no mesmo PIX ou cartão.",
  button_label: "Adicionar ChatGPT Plus",
};

const SECTIONS: Array<{
  id: Section;
  label: string;
  desc: string;
  group: "Site" | "Vendas" | "Sistema";
  icon: any;
}> = [
  { id: "hero", label: "Hero e textos", desc: "Título, subtítulo e CTA", group: "Site", icon: Monitor },
  { id: "banners", label: "Banners da landing", desc: "Editar, ordenar e ativar", group: "Site", icon: Layout },
  { id: "panel", label: "Banners do painel", desc: "Banners vistos pelos clientes", group: "Site", icon: Users },
  { id: "images", label: "Imagens do site", desc: "Trocar imagens por área", group: "Site", icon: ImageIcon },
  { id: "partners", label: "Parceiros", desc: "Chamada do programa", group: "Site", icon: Users },
  { id: "branding", label: "Branding", desc: "Marca, ícone, banner e cor", group: "Site", icon: Palette },
  { id: "awards", label: "Premiações", desc: "Hero e placas", group: "Site", icon: Trophy },
  { id: "preview", label: "Prévia", desc: "Ver o conteúdo atual", group: "Site", icon: Eye },
  { id: "cart_offer", label: "Oferta do carrinho", desc: "Produto e copy recomendados", group: "Vendas", icon: ShoppingCart },
  { id: "splits", label: "Splits", desc: "Comissões financeiras", group: "Vendas", icon: Palette },
  { id: "copy", label: "Suporte e links", desc: "WhatsApp e URLs globais", group: "Sistema", icon: Type },
  { id: "recovery", label: "Recuperação WhatsApp", desc: "Mensagens automáticas", group: "Sistema", icon: MessageCircle },
  { id: "tutorials", label: "Tutoriais", desc: "Vídeos e instruções", group: "Sistema", icon: FileText },
  { id: "history", label: "Histórico", desc: "Alterações publicadas", group: "Sistema", icon: History },
];

async function pickAndUpload(opts: {
  key: string;
  setUploading: (value: string | null) => void;
  onDone: (url: string) => void;
}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    opts.setUploading(opts.key);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("key", opts.key);

      const response = await fetch("/api/public/cms/upload", {
        method: "POST",
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.url) {
        throw new Error(result?.error || `Upload falhou (${response.status})`);
      }

      opts.onDone(String(result.url));
      toast.success("Imagem carregada com sucesso.");
    } catch (error) {
      toast.error(`Erro no upload: ${(error as Error).message}`);
    } finally {
      opts.setUploading(null);
    }
  };
  input.click();
}

function ScreenHeader(props: { title: string; description: string; icon: any }) {
  const Icon = props.icon;
  return (
    <div className="flex items-start gap-3 border-b border-white/5 pb-5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{props.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{props.description}</p>
      </div>
    </div>
  );
}

function ActionBar(props: {
  saveLabel?: string;
  publishLabel?: string;
  onSave: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="grid gap-2 border-t border-white/5 pt-5 sm:grid-cols-2">
      <Button onClick={props.onSave} variant="neonOutline" className="font-black">
        <Save className="mr-2 h-4 w-4" /> {props.saveLabel || "Salvar rascunho"}
      </Button>
      <Button onClick={props.onPublish} variant="neon" className="font-black">
        <CheckCircle2 className="mr-2 h-4 w-4" /> {props.publishLabel || "Publicar"}
      </Button>
    </div>
  );
}

function BannerManager(props: {
  title: string;
  description: string;
  banners: BannerItem[] | undefined;
  defaults: BannerItem[];
  uploadKeyPrefix: string;
  uploading: string | null;
  setUploading: (value: string | null) => void;
  onChange: (list: BannerItem[]) => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const source = props.banners ?? props.defaults;
  const list = [...source].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const commit = (next: BannerItem[]) => {
    props.onChange(next.map((banner, index) => ({ ...banner, order: index })));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target]!, next[index]!];
    commit(next);
  };

  const restoreDefaults = () => {
    commit(props.defaults.map((banner, index) => ({ ...banner, order: index })));
    toast.success("Banners restaurados para o padrão do site.");
  };

  return (
    <div className="space-y-5">
      <ScreenHeader title={props.title} description={props.description} icon={Layout} />

      <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-black/15 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-foreground">{list.length} banner{list.length === 1 ? "" : "s"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Cada card abaixo representa um único banner.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={restoreDefaults}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Restaurar padrão
          </Button>
          <Button
            type="button"
            size="sm"
            variant="neonOutline"
            onClick={() => commit([...list, { url: "", alt: "", active: true, order: list.length }])}
          >
            + Adicionar banner
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-xs font-bold text-muted-foreground">Nenhum banner cadastrado.</p>
          <Button
            className="mt-4"
            size="sm"
            variant="neonOutline"
            onClick={() => commit([{ url: "", alt: "", active: true, order: 0 }])}
          >
            Criar primeiro banner
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((banner, index) => {
            const uploadKey = `${props.uploadKeyPrefix}-${index}`;
            return (
              <div key={`${banner.url}-${index}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="grid gap-4 md:grid-cols-[44px_180px_minmax(0,1fr)] md:items-start">
                  <div className="flex items-center gap-1 md:flex-col">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span className="min-w-7 text-center text-[11px] font-black text-primary">{index + 1}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === list.length - 1} onClick={() => move(index, 1)}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    <div className="aspect-[16/7] w-full">
                      {banner.url ? (
                        <img src={banner.url} alt={banner.alt || "Banner"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <ImageIcon className="h-7 w-7 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="border-t border-white/5 px-3 py-2 text-[10px] font-bold text-muted-foreground">
                      Prévia 16:7
                    </div>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Imagem</label>
                      <div className="grid grid-cols-[minmax(0,1fr)_42px] gap-2">
                        <Input
                          value={banner.url || ""}
                          placeholder="URL da imagem"
                          onChange={(event) => {
                            const next = [...list];
                            next[index] = { ...banner, url: event.target.value };
                            commit(next);
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="neonOutline"
                          disabled={props.uploading === uploadKey}
                          title="Enviar imagem"
                          onClick={() =>
                            pickAndUpload({
                              key: uploadKey,
                              setUploading: props.setUploading,
                              onDone: (url) => {
                                const next = [...list];
                                next[index] = { ...banner, url };
                                commit(next);
                              },
                            })
                          }
                        >
                          {props.uploading === uploadKey ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Texto alternativo</label>
                      <Input
                        value={banner.alt || ""}
                        placeholder="Descrição do banner"
                        onChange={(event) => {
                          const next = [...list];
                          next[index] = { ...banner, alt: event.target.value };
                          commit(next);
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[.02] px-3 py-2.5">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={banner.active !== false}
                          onChange={(event) => {
                            const next = [...list];
                            next[index] = { ...banner, active: event.target.checked };
                            commit(next);
                          }}
                          className="h-4 w-4 accent-primary"
                        />
                        Banner ativo
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => commit(list.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Remover
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ActionBar onSave={props.onSave} onPublish={props.onPublish} publishLabel="Publicar banners" />
    </div>
  );
}

export function AdminEditorTab() {
  const queryClient = useQueryClient();
  const getCms = useServerFn(getCmsContent);
  const saveDraft = useServerFn(saveCmsDraft);
  const publishDraft = useServerFn(publishCmsDraft);
  const getHistory = useServerFn(getCmsHistory);

  const [activeSection, setActiveSection] = useState<Section>("hero");
  const [localSettings, setLocalSettings] = useState<any>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["cms-history"],
    queryFn: () => getHistory(),
  });

  const { data: activePlans = [] } = useQuery({
    queryKey: ["admin-editor", "active-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id,name,slug,price,currency,image_url,duration_label")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  const initialSettings = useMemo(() => settings || {}, [settings]);

  const updateField = (key: string, field: string, value: any) => {
    setLocalSettings((previous: any) => ({
      ...previous,
      [key]: {
        ...(previous?.[key] || {}),
        [field]: value,
      },
    }));
  };

  const replaceSection = (key: string, value: any) => {
    setLocalSettings((previous: any) => ({ ...previous, [key]: value }));
  };

  const handleSave = async (key: string) => {
    try {
      await saveDraft({ data: { key, data: localSettings?.[key] ?? {} } });
      toast.success("Rascunho salvo com sucesso.");
    } catch (error) {
      toast.error(`Erro ao salvar: ${(error as Error).message || "erro desconhecido"}`);
    }
  };

  const handlePublish = async (key: string) => {
    try {
      await saveDraft({ data: { key, data: localSettings?.[key] ?? {} } });
      await publishDraft({ data: { key } });
      toast.success("Conteúdo publicado com sucesso.");
      confetti({ particleCount: 90, spread: 65, origin: { y: 0.65 } });
      await queryClient.invalidateQueries({ queryKey: ["cms-content"] });
      await queryClient.invalidateQueries({ queryKey: ["cms-history"] });
    } catch (error) {
      toast.error(`Erro ao publicar: ${(error as Error).message || "erro desconhecido"}`);
    }
  };

  if (isLoading || !localSettings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentSection = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0]!;
  const recommendationSettings = {
    ...DEFAULT_CART_RECOMMENDATION,
    ...(localSettings.cart_recommendation || {}),
  };
  const selectedCartPlan = activePlans.find(
    (plan: any) => String(plan.slug || "") === String(recommendationSettings.product_slug || ""),
  );

  const menuGroups = ["Site", "Vendas", "Sistema"] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/5 bg-black/15 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Editor completo do site</p>
          <h2 className="mt-1 text-lg font-black text-foreground">Escolha uma área no menu e edite uma tela por vez</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            O editor foi separado por função para evitar telas misturadas e deixar banners, imagens, copies e configurações independentes.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["cms-content"] })}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar dados
        </Button>
      </div>

      <div className="lg:hidden">
        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Menu do editor</label>
        <select
          value={activeSection}
          onChange={(event) => setActiveSection(event.target.value as Section)}
          className="h-12 w-full rounded-2xl border border-white/10 bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-primary/50"
        >
          {menuGroups.map((group) => (
            <optgroup key={group} label={group}>
              {SECTIONS.filter((section) => section.group === group).map((section) => (
                <option key={section.id} value={section.id}>{section.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start xl:gap-7">
        <aside className="hidden lg:block">
          <div className="sticky top-5 max-h-[calc(100vh-40px)] overflow-y-auto rounded-3xl border border-white/5 bg-black/15 p-3 no-scrollbar">
            {menuGroups.map((group) => (
              <div key={group} className="mb-4 last:mb-0">
                <p className="px-3 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">{group}</p>
                <div className="space-y-1">
                  {SECTIONS.filter((section) => section.group === group).map((section) => {
                    const Icon = section.icon;
                    const active = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          active
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-black uppercase tracking-wide">{section.label}</span>
                          <span className={`mt-0.5 block truncate text-[9px] font-bold ${active ? "opacity-70" : "opacity-50"}`}>{section.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="rounded-3xl border border-white/5 bg-black/15 p-4 sm:p-5 xl:p-6">
            <div className="mb-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground lg:hidden">
              <currentSection.icon className="h-4 w-4 text-primary" /> {currentSection.label}
            </div>

            {activeSection === "hero" && (
              <div className="space-y-5">
                <ScreenHeader title="Hero e textos principais" description="Edite somente a primeira dobra da landing: título, subtítulo e botão principal." icon={Monitor} />
                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título principal</span>
                    <Input
                      value={localSettings["hero"]?.title ?? ""}
                      placeholder={initialSettings["hero"]?.title || "Título principal"}
                      onChange={(event) => updateField("hero", "title", event.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtítulo</span>
                    <Textarea
                      rows={5}
                      value={localSettings["hero"]?.subtitle ?? ""}
                      placeholder={initialSettings["hero"]?.subtitle || "Subtítulo"}
                      onChange={(event) => updateField("hero", "subtitle", event.target.value)}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Texto do botão</span>
                      <Input
                        value={localSettings["hero"]?.cta_text ?? initialSettings["hero"]?.cta_text ?? ""}
                        onChange={(event) => updateField("hero", "cta_text", event.target.value)}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Link do botão</span>
                      <Input
                        value={localSettings["hero"]?.cta_link ?? initialSettings["hero"]?.cta_link ?? ""}
                        onChange={(event) => updateField("hero", "cta_link", event.target.value)}
                      />
                    </label>
                  </div>
                </div>
                <ActionBar onSave={() => handleSave("hero")} onPublish={() => handlePublish("hero")} />
              </div>
            )}

            {activeSection === "banners" && (
              <BannerManager
                title="Banners da landing"
                description="Esta tela cuida somente dos banners públicos da landing. Adicione, troque a imagem, reordene e ative ou desative cada banner."
                banners={localSettings["hero"]?.banners}
                defaults={DEFAULT_LANDING_BANNERS}
                uploadKeyPrefix="landing-banner"
                uploading={uploading}
                setUploading={setUploading}
                onChange={(list) => updateField("hero", "banners", list)}
                onSave={() => handleSave("hero")}
                onPublish={() => handlePublish("hero")}
              />
            )}

            {activeSection === "panel" && (
              <BannerManager
                title="Banners do painel"
                description="Esta tela cuida somente dos banners internos exibidos no painel dos clientes."
                banners={localSettings.panel?.banners}
                defaults={DEFAULT_PANEL_BANNERS}
                uploadKeyPrefix="panel-banner"
                uploading={uploading}
                setUploading={setUploading}
                onChange={(list) => updateField("panel", "banners", list)}
                onSave={() => handleSave("panel")}
                onPublish={() => handlePublish("panel")}
              />
            )}

            {activeSection === "images" && (
              <div className="space-y-5">
                <ScreenHeader title="Imagens do site" description="Troque as imagens por área sem misturar com banners ou copies." icon={ImageIcon} />
                <div className="space-y-4">
                  {SITE_IMAGE_GROUPS.map((group) => (
                    <section key={group} className="rounded-2xl border border-white/5 bg-black/10 p-3 sm:p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-primary/70">{group}</p>
                      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                        {SITE_IMAGE_SLOTS.filter((slot) => slot.group === group).map((slot) => {
                          const current = localSettings.site_images?.[slot.key] ?? slot.defaultUrl;
                          const custom = current && current !== slot.defaultUrl;
                          return (
                            <div key={slot.key} className="min-w-0 rounded-2xl border border-white/5 bg-black/20 p-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30 p-1">
                                  {current ? <img src={current} alt={slot.label} className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted-foreground/30" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[10px] font-black uppercase tracking-wide">{slot.label}</p>
                                  <p className="mt-1 truncate text-[9px] text-muted-foreground" title={slot.hint}>{slot.hint}</p>
                                  <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${custom ? "bg-primary/10 text-primary" : "bg-white/5 text-muted-foreground"}`}>
                                    {custom ? "Personalizada" : "Padrão"}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_38px_38px] gap-2">
                                <Input
                                  value={current || ""}
                                  onChange={(event) => updateField("site_images", slot.key, event.target.value)}
                                  className="min-w-0 text-xs"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="neonOutline"
                                  disabled={uploading === slot.key}
                                  onClick={() => pickAndUpload({ key: slot.key, setUploading, onDone: (url) => updateField("site_images", slot.key, url) })}
                                >
                                  {uploading === slot.key ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                </Button>
                                <Button type="button" size="icon" variant="ghost" title="Restaurar original" onClick={() => updateField("site_images", slot.key, slot.defaultUrl)}>
                                  <History className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
                <ActionBar onSave={() => handleSave("site_images")} onPublish={() => handlePublish("site_images")} publishLabel="Publicar imagens" />
              </div>
            )}

            {activeSection === "cart_offer" && (
              <div className="space-y-5">
                <ScreenHeader title="Oferta recomendada no carrinho" description="Edite somente o produto recomendado e a copy dessa oferta." icon={ShoppingCart} />
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-4 rounded-2xl border border-white/5 bg-black/10 p-4">
                    <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 px-3 py-3">
                      <span>
                        <span className="block text-[10px] font-black uppercase tracking-wide">Oferta ativa</span>
                        <span className="mt-1 block text-[9px] text-muted-foreground">Exibe a recomendação no carrinho.</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={recommendationSettings.enabled !== false}
                        onChange={(event) => updateField("cart_recommendation", "enabled", event.target.checked)}
                        className="h-5 w-5 accent-primary"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Produto recomendado</span>
                      <select
                        value={recommendationSettings.product_slug}
                        onChange={(event) => updateField("cart_recommendation", "product_slug", event.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-background px-3 text-xs font-bold outline-none focus:border-primary/50"
                      >
                        {!activePlans.length && <option value={recommendationSettings.product_slug}>Nenhuma oferta carregada</option>}
                        {activePlans.map((plan: any) => (
                          <option key={plan.id} value={plan.slug}>
                            {plan.name} · {Number(plan.price || 0).toLocaleString("pt-BR", { style: "currency", currency: plan.currency || "BRL" })}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chamada curta</span>
                      <Input value={recommendationSettings.eyebrow} onChange={(event) => updateField("cart_recommendation", "eyebrow", event.target.value)} />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título</span>
                      <Input value={recommendationSettings.title} onChange={(event) => updateField("cart_recommendation", "title", event.target.value)} />
                    </label>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-white/5 bg-black/10 p-4">
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Benefício</span>
                      <Textarea rows={5} value={recommendationSettings.description} onChange={(event) => updateField("cart_recommendation", "description", event.target.value)} />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observação</span>
                      <Textarea rows={3} value={recommendationSettings.note} onChange={(event) => updateField("cart_recommendation", "note", event.target.value)} />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Texto do botão</span>
                      <Input value={recommendationSettings.button_label} onChange={(event) => updateField("cart_recommendation", "button_label", event.target.value)} />
                    </label>
                  </div>
                </div>
                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/[.05] p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">Prévia da oferta</p>
                  <div className="mt-3 flex gap-3">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-1">
                      {selectedCartPlan?.image_url ? <img src={selectedCartPlan.image_url} alt={selectedCartPlan.name} className="h-full w-full object-contain" /> : <ShoppingCart className="h-5 w-5 text-blue-300" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wide text-blue-300">{recommendationSettings.eyebrow}</p>
                      <p className="mt-1 text-sm font-black uppercase">{recommendationSettings.title}</p>
                      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{recommendationSettings.description}</p>
                    </div>
                  </div>
                </div>
                <ActionBar onSave={() => handleSave("cart_recommendation")} onPublish={() => handlePublish("cart_recommendation")} publishLabel="Publicar no carrinho" />
              </div>
            )}

            {activeSection === "partners" && (
              <div className="space-y-5">
                <ScreenHeader title="Parceiros" description="Edite somente a chamada do programa de parceiros." icon={Users} />
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título</span>
                  <Input value={localSettings.partners_teaser?.title ?? ""} onChange={(event) => updateField("partners_teaser", "title", event.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtítulo</span>
                  <Textarea rows={5} value={localSettings.partners_teaser?.subtitle ?? ""} onChange={(event) => updateField("partners_teaser", "subtitle", event.target.value)} />
                </label>
                <ActionBar onSave={() => handleSave("partners_teaser")} onPublish={() => handlePublish("partners_teaser")} />
              </div>
            )}

            {activeSection === "branding" && (
              <div className="space-y-5">
                <ScreenHeader title="Branding da extensão" description="Edite somente identidade visual, ícone e banner promocional da extensão." icon={Palette} />
                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="space-y-4 rounded-2xl border border-white/5 bg-black/10 p-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ícone principal</p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                          {localSettings.branding?.icon_url ? <img src={localSettings.branding.icon_url} alt="Ícone" className="h-full w-full object-cover" /> : <ImageIcon className="h-7 w-7 text-muted-foreground/30" />}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="neonOutline"
                          disabled={uploading === "branding-icon"}
                          onClick={() => pickAndUpload({ key: "branding-icon", setUploading, onDone: (url) => updateField("branding", "icon_url", url) })}
                        >
                          {uploading === "branding-icon" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          Trocar ícone
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Banner promocional</p>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <div className="aspect-video">
                          {localSettings.branding?.banner_url ? <img src={localSettings.branding.banner_url} alt="Banner da extensão" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-8 w-8 text-muted-foreground/30" /></div>}
                        </div>
                        <div className="border-t border-white/5 p-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="neonOutline"
                            className="w-full"
                            disabled={uploading === "branding-banner"}
                            onClick={() => pickAndUpload({ key: "branding-banner", setUploading, onDone: (url) => updateField("branding", "banner_url", url) })}
                          >
                            {uploading === "branding-banner" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Trocar banner
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="space-y-4 rounded-2xl border border-white/5 bg-black/10 p-4">
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome da marca</span>
                      <Input value={localSettings.branding?.brand_name ?? "MSK SISTEM"} onChange={(event) => updateField("branding", "brand_name", event.target.value)} />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cor primária</span>
                      <div className="grid grid-cols-[minmax(0,1fr)_48px] gap-2">
                        <Input value={localSettings.branding?.primary_color ?? "#39ff14"} onChange={(event) => updateField("branding", "primary_color", event.target.value)} className="font-mono" />
                        <div className="rounded-xl border border-white/10" style={{ backgroundColor: localSettings.branding?.primary_color ?? "#39ff14" }} />
                      </div>
                    </label>
                  </section>
                </div>
                <ActionBar onSave={() => handleSave("branding")} onPublish={() => handlePublish("branding")} />
              </div>
            )}

            {activeSection === "awards" && (
              <div className="space-y-5">
                <ScreenHeader title="Premiações e placas" description="Edite somente o banner principal e as imagens das placas." icon={Trophy} />
                <section className="rounded-2xl border border-white/5 bg-black/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Banner principal</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)_42px] sm:items-center">
                    <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      {localSettings.awards?.hero_url ? <img src={localSettings.awards.hero_url} alt="Awards hero" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-6 w-6 text-muted-foreground/30" /></div>}
                    </div>
                    <Input value={localSettings.awards?.hero_url ?? ""} onChange={(event) => updateField("awards", "hero_url", event.target.value)} />
                    <Button type="button" size="icon" variant="neonOutline" disabled={uploading === "awards-hero"} onClick={() => pickAndUpload({ key: "awards-hero", setUploading, onDone: (url) => updateField("awards", "hero_url", url) })}>
                      {uploading === "awards-hero" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </div>
                </section>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["award_1k", "Placa 1K"],
                    ["award_10k", "Placa 10K"],
                    ["award_100k", "Placa 100K"],
                    ["award_500k", "Placa 500K"],
                    ["award_1m", "Placa 1M"],
                    ["award_5m", "Placa 5M"],
                  ].map(([key, label]) => {
                    const awardKey = String(key);
                    const value = localSettings["awards"]?.[awardKey] ?? "";
                    return (
                      <div key={key} className="rounded-2xl border border-white/5 bg-black/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-primary/70">{label}</p>
                        <div className="mt-3 flex gap-3">
                          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                            {value ? <img src={value} alt={label} className="h-full w-full object-contain" /> : <Trophy className="h-5 w-5 text-muted-foreground/30" />}
                          </div>
                          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_38px] gap-2">
                            <Input value={value} onChange={(event) => updateField("awards", awardKey, event.target.value)} className="min-w-0 text-xs" />
                            <Button type="button" size="icon" variant="neonOutline" disabled={uploading === awardKey} onClick={() => pickAndUpload({ key: awardKey, setUploading, onDone: (url) => updateField("awards", awardKey, url) })}>
                              {uploading === awardKey ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ActionBar onSave={() => handleSave("awards")} onPublish={() => handlePublish("awards")} />
              </div>
            )}

            {activeSection === "copy" && (
              <div className="space-y-5">
                <ScreenHeader title="Suporte e links globais" description="Edite somente os dados globais usados nos botões de suporte." icon={Type} />
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">WhatsApp de suporte</span>
                  <Input value={localSettings.config?.support_whatsapp ?? ""} placeholder="(11) 99999-9999" onChange={(event) => updateField("config", "support_whatsapp", event.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">URL de suporte</span>
                  <Input value={localSettings.config?.support_url ?? ""} placeholder="https://wa.me/55..." onChange={(event) => updateField("config", "support_url", event.target.value)} />
                </label>
                <ActionBar onSave={() => handleSave("config")} onPublish={() => handlePublish("config")} />
              </div>
            )}

            {activeSection === "recovery" && (
              <div className="space-y-5">
                <ScreenHeader title="Recuperação via WhatsApp" description="Edite somente as mensagens automáticas de recuperação." icon={MessageCircle} />
                <div className="space-y-4">
                  {[
                    ["welcome", "Mensagem de boas-vindas", "Enviada quando um lead se cadastra."],
                    ["recovery", "Mensagem de recuperação", "Enviada para pagamentos pendentes."],
                    ["urgency", "Mensagem de urgência", "Mensagem de reforço por tempo limitado."],
                  ].map(([key, label, description]) => (
                    <label key={String(key)} className="block space-y-1.5 rounded-2xl border border-white/5 bg-black/10 p-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                      <Textarea
                        rows={4}
                        value={localSettings["recovery_messages"]?.[String(key)] ?? ""}
                        placeholder="Olá {nome}, ..."
                        onChange={(event) => replaceSection("recovery_messages", { ...(localSettings.recovery_messages || {}), [String(key)]: event.target.value })}
                      />
                      <span className="block text-[9px] text-muted-foreground">{description} Use {"{nome}"} para o nome do cliente.</span>
                    </label>
                  ))}
                </div>
                <ActionBar onSave={() => handleSave("recovery_messages")} onPublish={() => handlePublish("recovery_messages")} />
              </div>
            )}

            {activeSection === "splits" && (
              <div className="space-y-5">
                <ScreenHeader title="Configurações de split" description="Edite somente as comissões padrão de afiliados e revendedores." icon={Palette} />
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["affiliate", "Afiliados", "10"],
                    ["reseller", "Revendedores", "5"],
                  ].map(([prefix, label, fallback]) => (
                    <section key={prefix} className="space-y-4 rounded-2xl border border-white/5 bg-black/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">{label}</p>
                      <label className="block space-y-1.5">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Tipo</span>
                        <select
                          value={localSettings.splits?.[`${prefix}_type`] ?? "percent"}
                          onChange={(event) => updateField("splits", `${prefix}_type`, event.target.value)}
                          className="h-11 w-full rounded-xl border border-white/10 bg-background px-3 text-xs font-bold outline-none"
                        >
                          <option value="percent">Porcentagem (%)</option>
                          <option value="fixed">Valor fixo (R$)</option>
                        </select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">Valor</span>
                        <Input type="number" value={localSettings.splits?.[`${prefix}_value`] ?? fallback} onChange={(event) => updateField("splits", `${prefix}_value`, event.target.value)} />
                      </label>
                    </section>
                  ))}
                </div>
                <ActionBar onSave={() => handleSave("splits")} onPublish={() => handlePublish("splits")} />
              </div>
            )}

            {activeSection === "tutorials" && (
              <div className="space-y-5">
                <ScreenHeader title="Tutoriais e vídeos" description="Gerencie somente os conteúdos de tutorial desta área." icon={FileText} />
                <TutorialsManager
                  tutorials={localSettings.tutorials}
                  onChange={(sections) => updateField("tutorials", "sections", sections)}
                  onSave={() => handleSave("tutorials")}
                  onPublish={() => handlePublish("tutorials")}
                />
              </div>
            )}

            {activeSection === "preview" && (
              <div className="space-y-5">
                <ScreenHeader title="Prévia do site" description="Tela dedicada apenas à visualização do conteúdo que está sendo editado." icon={Eye} />
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#080b09]">
                  <div className="border-b border-white/5 px-4 py-3 text-[10px] font-mono text-muted-foreground">msksystem.online · prévia local</div>
                  <div className="space-y-8 p-5 sm:p-8">
                    <section className="space-y-4">
                      <h1 className="max-w-3xl text-3xl font-black leading-tight sm:text-5xl">{localSettings["hero"]?.title || "Título principal"}</h1>
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{localSettings["hero"]?.subtitle || "Subtítulo do site"}</p>
                      <Button variant="neon">{localSettings["hero"]?.cta_text || "CTA"}</Button>
                    </section>
                    <section>
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Banners ativos</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {(localSettings["hero"]?.banners ?? DEFAULT_LANDING_BANNERS)
                          .filter((banner: BannerItem) => banner.active !== false && banner.url)
                          .slice(0, 4)
                          .map((banner: BannerItem, index: number) => (
                            <div key={`${banner.url}-${index}`} className="aspect-[16/7] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                              <img src={banner.url} alt={banner.alt || "Banner"} className="h-full w-full object-cover" />
                            </div>
                          ))}
                      </div>
                    </section>
                    {recommendationSettings.enabled !== false && (
                      <section className="rounded-2xl border border-blue-400/20 bg-blue-500/[.05] p-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">{recommendationSettings.eyebrow}</p>
                        <h2 className="mt-2 text-xl font-black">{recommendationSettings.title}</h2>
                        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">{recommendationSettings.description}</p>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "history" && (
              <div className="space-y-5">
                <ScreenHeader title="Histórico de alterações" description="Tela dedicada somente ao histórico do editor." icon={History} />
                <div className="space-y-2">
                  {history.length ? (
                    history.map((item: any) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-white/5 bg-black/10 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black capitalize text-foreground">{item.entity_id} · {item.action}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
                        </div>
                        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-xs text-muted-foreground">Nenhuma alteração registrada.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
