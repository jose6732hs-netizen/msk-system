import { useState, useEffect, useRef, useMemo } from "react";
import confetti from "canvas-confetti";
import { 
  Monitor, 
  FileText, 
  Save, 
  CheckCircle2, 
  History, 
  Eye, 
  RefreshCw,
  Clock,
  Layout,
  Type,
  Image as ImageIcon,
  Upload,
  Palette,
  Users,
  Trash2,
  Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent, saveCmsDraft, publishCmsDraft, getCmsHistory, uploadCmsAsset } from "@/lib/cms.functions";
import {
  SITE_IMAGE_SLOTS,
  SITE_IMAGE_GROUPS,
  DEFAULT_LANDING_BANNERS,
  DEFAULT_PANEL_BANNERS,
} from "@/lib/site-images";
import { ChevronUp, ChevronDown } from "lucide-react";
import { TutorialsManager } from "@/components/msk/tutorials-manager";

type BannerItem = { url: string; alt?: string; active?: boolean; order?: number };

async function pickAndUpload(opts: {
  accept: string;
  key: string;
  setUploading: (v: string | null) => void;
  uploadAsset: (args: any) => Promise<any>;
  onDone: (url: string) => void;
}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = opts.accept;
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    opts.setUploading(opts.key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("key", opts.key);
      
      const res = await fetch("/api/public/cms/upload", {
        method: "POST",
        body: fd
      }).then(r => r.json());

      if (!res.url) throw new Error(res.error || "Upload falhou");
      
      opts.onDone(res.url);
      toast.success("Arquivo carregado!");
    } catch (err: any) {
      toast.error("Erro no upload: " + (err.message || "Erro desconhecido"));
    } finally {
      opts.setUploading(null);
    }
  };
  input.click();
}

function BannerManager(props: {
  title: string;
  banners: BannerItem[];
  defaults: BannerItem[];
  uploadKeyPrefix: string;
  uploading: string | null;
  setUploading: (v: string | null) => void;
  uploadAsset: (args: any) => Promise<any>;
  onChange: (list: BannerItem[]) => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const list = [...(props.banners || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const commit = (next: BannerItem[]) => props.onChange(next.map((b, i) => ({ ...b, order: i })));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...list];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    commit(next);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[0.7rem] font-black uppercase tracking-widest">{props.title}</h4>
          <p className="text-[0.6rem] font-bold text-muted-foreground">{list.length} banner(s) — use as setas para reordenar</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="text-[0.6rem] font-black uppercase" onClick={() => commit([...list, ...props.defaults])}>
            Importar do site
          </Button>
          <Button size="sm" variant="neonOutline" onClick={() => commit([...list, { url: "", alt: "", active: true }])}>
            + Adicionar
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {list.map((banner, index) => (
          <div key={index} className="glass space-y-4 rounded-2xl border border-white/5 p-4 transition-all hover:border-primary/30">
            <div className="flex items-start gap-4">
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <span className="text-center text-[0.6rem] font-black text-primary/70">{index + 1}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === list.length - 1} onClick={() => move(index, 1)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {banner.url ? (
                  <img src={banner.url} alt={banner.alt || ""} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="URL da imagem"
                    value={banner.url}
                    onChange={(e) => {
                      const next = [...list];
                      next[index] = { ...banner, url: e.target.value };
                      commit(next);
                    }}
                    className="text-[0.7rem]"
                  />
                  <Button
                    size="icon"
                    variant="neonOutline"
                    className="shrink-0"
                    disabled={props.uploading === `${props.uploadKeyPrefix}-${index}`}
                    onClick={() => pickAndUpload({
                      accept: "image/*",
                      key: `${props.uploadKeyPrefix}-${index}`,
                      setUploading: props.setUploading,
                      uploadAsset: props.uploadAsset,
                      onDone: (url) => {
                        const next = [...list];
                        next[index] = { ...banner, url };
                        commit(next);
                      },
                    })}
                  >
                    {props.uploading === `${props.uploadKeyPrefix}-${index}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Texto alternativo (alt)"
                    value={banner.alt ?? ""}
                    onChange={(e) => {
                      const next = [...list];
                      next[index] = { ...banner, alt: e.target.value };
                      commit(next);
                    }}
                    className="flex-1 text-[0.7rem]"
                  />
                  <label className="flex items-center gap-2 px-2">
                    <input
                      type="checkbox"
                      checked={banner.active !== false}
                      onChange={(e) => {
                        const next = [...list];
                        next[index] = { ...banner, active: e.target.checked };
                        commit(next);
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-[0.6rem] font-bold uppercase text-muted-foreground">Ativo</span>
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => commit(list.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={props.onSave} variant="neonOutline" className="flex-1 font-black">
          <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
        </Button>
        <Button onClick={props.onPublish} variant="neon" className="flex-1 font-black">
          <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Banners
        </Button>
      </div>
    </div>
  );
}


type Section = 'hero' | 'banners' | 'panel' | 'images' | 'partners' | 'features' | 'copy' | 'branding' | 'tutorials' | 'awards' | 'splits';

export function AdminEditorTab() {
  const qc = useQueryClient();
  const getCms = useServerFn(getCmsContent);
  const saveDraft = useServerFn(saveCmsDraft);
  const publishDraft = useServerFn(publishCmsDraft);
  const getHistory = useServerFn(getCmsHistory);
  const uploadAsset = useServerFn(uploadCmsAsset);

  const [activeSection, setActiveSection] = useState<Section>('hero');
  const [localSettings, setLocalSettings] = useState<any>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
  });

  const { data: history } = useQuery({
    queryKey: ["cms-history"],
    queryFn: () => getHistory(),
  });

  const initialSettings = useMemo(() => settings || {}, [settings]);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const updateSetting = (key: string, subkey: string, value: any) => {
    setLocalSettings((prev: any) => ({
      ...prev,
      [key]: {
        ...(prev?.[key] || {}),
        [subkey]: value
      }
    }));
  };

  const handleSave = async (key: string) => {
    try {
      await saveDraft({ data: { key, data: localSettings[key] } });
      toast.success("Rascunho salvo com sucesso!");
    } catch (e) {
      toast.error("Erro ao salvar rascunho");
    }
  };

  const handlePublish = async (key: string) => {
    try {
      console.log('Publishing CMS content for key:', key, localSettings[key]);
      await publishDraft({ data: { key } });
      toast.success("Conteúdo publicado com sucesso!");
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#39ff14', '#000000', '#ffffff']
      });
      await qc.invalidateQueries({ queryKey: ["cms-content"] });
      await qc.invalidateQueries({ queryKey: ["cms-history"] });
    } catch (e: any) {
      console.error('Error publishing CMS content:', e);
      toast.error(`Erro ao publicar: ${e.message || 'Erro desconhecido'}`);
    }
  };

  if (isLoading || !localSettings) {
    return <div className="flex h-64 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const SECTIONS: { id: Section; label: string; icon: any; desc: string }[] = [
    { id: 'hero', label: 'Hero / Textos', icon: Monitor, desc: 'Título, subtítulo e CTA' },
    { id: 'images', label: 'Imagens do Site', icon: ImageIcon, desc: 'Todas as imagens editáveis' },
    { id: 'banners', label: 'Banners Landing', icon: Layout, desc: 'Ordenar e ativar' },
    { id: 'panel', label: 'Banners Painel', icon: Users, desc: 'Exclusivos dos tenants' },
    { id: 'splits', label: 'Configurações de Split', icon: Palette, desc: 'Configurações financeiras' },
    { id: 'partners', label: 'Parceiros', icon: Users, desc: 'Chamada de afiliados' },
    { id: 'branding', label: 'Extensão / Branding', icon: Palette, desc: 'Ícones e cores' },
    { id: 'awards', label: 'Premiações / Placas', icon: Trophy, desc: 'Placas 1K a 5M' },
    { id: 'copy', label: 'Copies / Suporte', icon: Type, desc: 'Links e textos globais' },
    { id: 'tutorials', label: 'Tutoriais / Vídeos', icon: FileText, desc: 'Como funciona' },
  ];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Steps Sidebar */}
      <aside className="lg:w-64 lg:shrink-0">
        <div className="glass sticky top-6 rounded-3xl border border-white/5 p-3">
          <p className="px-3 py-2 text-[0.55rem] font-black uppercase tracking-[0.2em] text-primary/70">Etapas do site</p>
          <nav className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-col lg:overflow-visible">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all lg:w-full ${
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[0.65rem] font-black uppercase tracking-widest">{item.label}</span>
                  <span className={`hidden lg:block truncate text-[0.55rem] font-bold ${activeSection === item.id ? "opacity-70" : "opacity-50"}`}>{item.desc}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-8 xl:grid-cols-2">
      {/* Editor Panel */}
      <div className="min-w-0 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Layout className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">Editor do Site</h3>
              <p className="text-[0.6rem] text-muted-foreground uppercase font-bold">Gerenciamento Visual em Tempo Real</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["cms-content"] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="glass rounded-3xl p-6 space-y-6">

          
          {activeSection === 'hero' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Configuração da Hero</h4>
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Título Principal (H1)</label>
                <Input 
                  value={(localSettings as any).hero?.['title'] ?? ''} 
                  placeholder={(settings as any)?.hero?.['title'] || 'Pare de ser interrompido no meio da criação'}

                  onChange={(e) => updateSetting('hero', 'title', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Subtítulo</label>
                <Textarea 
                  value={(localSettings as any).hero?.['subtitle'] ?? ''} 
                  placeholder={(settings as any)?.hero?.['subtitle'] || 'Acesso completo à extensão Lovable com créditos infinitos...'}

                  onChange={(e) => updateSetting('hero', 'subtitle', e.target.value)}
                  className="bg-background/50 min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Texto CTA</label>
                  <Input 
                    value={(localSettings as any).hero?.['cta_text'] ?? (initialSettings as any).hero?.['cta_text'] ?? 'Quero créditos infinitos agora'} 
                    onChange={(e) => updateSetting('hero', 'cta_text', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Link CTA</label>
                  <Input 
                    value={(localSettings as any).hero?.['cta_link'] ?? (initialSettings as any).hero?.['cta_link'] ?? '/auth'} 
                    onChange={(e) => updateSetting('hero', 'cta_link', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleSave('hero')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
                </Button>
                <Button onClick={() => handlePublish('hero')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Agora
                </Button>
              </div>
            </div>
          )}
          
          {activeSection === 'banners' && (
            <BannerManager
              title="Banners da Landing"
              banners={(localSettings as any).hero?.banners ?? DEFAULT_LANDING_BANNERS}
              defaults={DEFAULT_LANDING_BANNERS}
              uploadKeyPrefix="landing-banner"
              uploading={uploading}
              setUploading={setUploading}
              uploadAsset={uploadAsset}
              onChange={(list) => updateSetting('hero', 'banners', list)}
              onSave={() => handleSave('hero')}
              onPublish={() => handlePublish('hero')}
            />
          )}

          {activeSection === 'panel' && (
            <BannerManager
              title="Banners do Painel (Tenants)"
              banners={(localSettings as any).panel?.banners ?? DEFAULT_PANEL_BANNERS}
              defaults={DEFAULT_PANEL_BANNERS}
              uploadKeyPrefix="panel-banner"
              uploading={uploading}
              setUploading={setUploading}
              uploadAsset={uploadAsset}
              onChange={(list) => updateSetting('panel', 'banners', list)}
              onSave={() => handleSave('panel')}
              onPublish={() => handlePublish('panel')}
            />
          )}

          {activeSection === 'images' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <div>
                  <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Todas as Imagens do Site</h4>
                  <p className="text-[0.6rem] font-bold text-muted-foreground">Visualize e substitua qualquer imagem usada na plataforma</p>
                </div>
              </div>

              {SITE_IMAGE_GROUPS.map((group) => (
                <div key={group} className="space-y-3">
                  <p className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-primary/70">{group}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {SITE_IMAGE_SLOTS.filter((s) => s.group === group).map((slot) => {
                      const current = (localSettings as any).site_images?.[slot.key] ?? slot.defaultUrl;
                      return (
                        <div key={slot.key} className="glass space-y-3 rounded-2xl border border-white/5 p-3 transition-all hover:border-primary/30">
                          <div className="flex items-center gap-3">
                            <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                              {current ? (
                                <img src={current} alt={slot.label} className="h-full w-full object-contain" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[0.65rem] font-black uppercase tracking-widest">{slot.label}</p>
                              <p className="truncate text-[0.55rem] font-bold text-muted-foreground">{slot.hint}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={current}
                              placeholder="URL da imagem"
                              onChange={(e) => updateSetting('site_images', slot.key, e.target.value)}
                              className="h-9 text-[0.65rem]"
                            />
                            <Button
                              size="icon"
                              variant="neonOutline"
                              className="h-9 w-9 shrink-0"
                              disabled={uploading === slot.key}
                              onClick={() => pickAndUpload({
                                accept: 'image/*',
                                key: slot.key,
                                setUploading,
                                uploadAsset,
                                onDone: (url) => updateSetting('site_images', slot.key, url),
                              })}
                            >
                              {uploading === slot.key ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 shrink-0 text-muted-foreground"
                              title="Restaurar imagem original"
                              onClick={() => updateSetting('site_images', slot.key, slot.defaultUrl)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <Button onClick={() => handleSave('site_images')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
                </Button>
                <Button onClick={() => handlePublish('site_images')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Imagens
                </Button>
              </div>
            </div>
          )}

          
          {activeSection === 'partners' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Título Chamada Parceiros</label>
                <Input 
                  value={(localSettings as any).partners_teaser?.title ?? ''} 
                  placeholder={(settings as any)?.partners_teaser?.title || 'Revenda e ganhe comissões recorrentes'}
                  onChange={(e) => updateSetting('partners_teaser', 'title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Subtítulo Parceiros</label>
                <Textarea 
                  value={(localSettings as any).partners_teaser?.subtitle ?? ''} 
                  placeholder={(settings as any)?.partners_teaser?.subtitle || 'Entre para o programa de parceiros Infinity...'}
                  onChange={(e) => updateSetting('partners_teaser', 'subtitle', e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleSave('partners_teaser')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
                <Button onClick={() => handlePublish('partners_teaser')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar
                </Button>
              </div>
            </div>
          )}
          
          {activeSection === 'awards' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Gestão de Premiações / Placas</h4>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Banner Principal (Awards Hero)</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="URL da Imagem Hero"
                      value={(localSettings as any).awards?.hero_url ?? (initialSettings as any).awards?.hero_url ?? ''} 
                      onChange={(e) => updateSetting('awards', 'hero_url', e.target.value)}
                    />
                    <Button 
                      size="icon" 
                      variant="neonOutline"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            setUploading('awards-hero');
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              fd.append('key', 'awards-hero');
                              const res = await fetch("/api/public/cms/upload", {
                                method: "POST",
                                body: fd
                              }).then(r => r.json());
                              if (!res.url) throw new Error(res.error || "Upload falhou");
                              updateSetting('awards', 'hero_url', res.url);
                              toast.success("Hero carregado!");
                            } catch (err: any) {
                              toast.error("Erro no upload: " + (err.message || "Erro desconhecido"));
                            } finally {
                              setUploading(null);
                            }
                          }
                        };
                        input.click();
                      }}
                      disabled={uploading === 'awards-hero'}
                    >
                      {uploading === 'awards-hero' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'award_1k', label: 'Placa 1K' },
                    { key: 'award_10k', label: 'Placa 10K' },
                    { key: 'award_100k', label: 'Placa 100K' },
                    { key: 'award_500k', label: 'Placa 500K' },
                    { key: 'award_1m', label: 'Placa 1M' },
                    { key: 'award_5m', label: 'Placa 5M' },
                  ].map((award) => (
                    <div key={award.key} className="glass rounded-xl p-4 border border-white/5 space-y-3">
                      <label className="text-[0.6rem] font-black uppercase tracking-widest text-primary/70">{award.label}</label>
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {((localSettings as any).awards?.[award.key] ?? (initialSettings as any).awards?.[award.key]) ? (
                            <img src={(localSettings as any).awards?.[award.key] ?? (initialSettings as any).awards?.[award.key]} className="h-full w-full object-contain" />
                          ) : (
                            <Trophy className="h-6 w-6 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 flex gap-2">
                          <Input 
                            placeholder="URL"
                            value={(localSettings as any).awards?.[award.key] ?? (initialSettings as any).awards?.[award.key] ?? ''} 
                            onChange={(e) => updateSetting('awards', award.key, e.target.value)}
                            className="text-xs h-9"
                          />
                          <Button 
                            size="icon" 
                            variant="neonOutline"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = async (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  setUploading(award.key);
                                  try {
                                    const fd = new FormData();
                                    fd.append('file', file);
                                    fd.append('key', award.key);
                                    const res = await fetch("/api/public/cms/upload", {
                                      method: "POST",
                                      body: fd
                                    }).then(r => r.json());
                                    if (!res.url) throw new Error(res.error || "Upload falhou");
                                    updateSetting('awards', award.key, res.url);
                                    toast.success(`${award.label} carregada!`);
                                  } catch (err: any) {
                                    toast.error("Erro no upload: " + (err.message || "Erro desconhecido"));
                                  } finally {
                                    setUploading(null);
                                  }
                                }
                              };
                              input.click();
                            }}
                            disabled={uploading === award.key}
                          >
                            {uploading === award.key ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleSave('awards')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
                </Button>
                <Button onClick={() => handlePublish('awards')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Premiações
                </Button>
              </div>
            </div>
          )}

          {activeSection === 'copy' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">URL de Suporte (WhatsApp)</label>
                <Input 
                  placeholder="https://wa.me/55..."
                  value={(localSettings as any).config?.support_url ?? (initialSettings as any).config?.support_url ?? ''} 
                  onChange={(e) => updateSetting('config', 'support_url', e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleSave('config')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
                <Button onClick={() => handlePublish('config')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar
                </Button>
              </div>
            </div>
          )}

          {activeSection === 'tutorials' && (
            <TutorialsManager
              tutorials={(localSettings as any).tutorials}
              onChange={(sections) => updateSetting('tutorials', 'sections', sections)}
              onSave={() => handleSave('tutorials')}
              onPublish={() => handlePublish('tutorials')}
            />
          )}

          {activeSection === 'branding' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Branding da Extensão</h4>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[0.65rem] font-bold text-primary/80 leading-relaxed">
                Aqui você configura os ícones e o banner que aparecem na extensão. As alterações afetam todos os usuários após a sincronização automática.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground block">Ícone Principal (128x128)</label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        {((localSettings as any).branding?.icon_url ?? (initialSettings as any).branding?.icon_url) ? (
                          <img src={(localSettings as any).branding?.icon_url ?? (initialSettings as any).branding?.icon_url} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="neonOutline" 
                        className="h-10 text-[0.65rem] font-black"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              setUploading('icon');
                              try {
                                const fd = new FormData();
                                fd.append('file', file);
                                fd.append('key', 'branding-icon');
                                const res = await fetch("/api/public/cms/upload", {
                                  method: "POST",
                                  body: fd
                                }).then(r => r.json());
                                if (!res.url) throw new Error(res.error || "Upload falhou");
                                updateSetting('branding', 'icon_url', res.url);
                                toast.success("Ícone carregado!");
                              } catch (err: any) {
                                toast.error("Erro no upload: " + (err.message || "Erro desconhecido"));
                              } finally {
                                setUploading(null);
                              }
                            }
                          };
                          input.click();
                        }}
                        disabled={uploading === 'icon'}
                      >
                        {uploading === 'icon' ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
                        Mudar Ícone
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground block">Banner Promocional</label>
                    <div className="aspect-video w-full rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative group">
                      {((localSettings as any).branding?.banner_url ?? (initialSettings as any).branding?.banner_url) ? (
                        <img src={(localSettings as any).branding?.banner_url ?? (initialSettings as any).branding?.banner_url} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button 
                          size="sm" 
                          variant="neon" 
                          className="h-10 text-[0.65rem] font-black"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                setUploading('banner');
                                try {
                                  const fd = new FormData();
                                  fd.append('file', file);
                                  fd.append('key', 'branding-banner');
                                  const res = await uploadAsset({ data: fd as any });
                                  updateSetting('branding', 'banner_url', res.url);
                                  toast.success("Banner carregado!");
                                } catch (err) {
                                  toast.error("Erro no upload");
                                } finally {
                                  setUploading(null);
                                }
                              }
                            };
                            input.click();
                          }}
                          disabled={uploading === 'banner'}
                        >
                          {uploading === 'banner' ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
                          Mudar Banner
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Nome da Marca</label>
                    <Input 
                      value={(localSettings as any).branding?.brand_name ?? (initialSettings as any).branding?.brand_name ?? 'MSK SISTEM'} 
                      onChange={(e) => updateSetting('branding', 'brand_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Cor Primária (Hex)</label>
                    <div className="flex gap-2">
                      <Input 
                        value={(localSettings as any).branding?.primary_color ?? (initialSettings as any).branding?.primary_color ?? '#39ff14'} 
                        onChange={(e) => updateSetting('branding', 'primary_color', e.target.value)}
                        className="font-mono"
                      />
                      <div 
                        className="h-10 w-12 rounded-xl border border-white/10" 
                        style={{ backgroundColor: (localSettings as any).branding?.primary_color ?? (initialSettings as any).branding?.primary_color ?? '#39ff14' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleSave('branding')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
                </Button>
                <Button onClick={() => handlePublish('branding')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Alterações
                </Button>
              </div>
            </div>
          )}
          {activeSection === 'splits' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Configurações Financeiras / Splits</h4>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[0.65rem] font-black uppercase tracking-widest text-primary">Comissão Padrão Afiliados</label>
                      <select 
                        className="bg-black/40 border border-white/10 rounded-lg text-[0.6rem] px-2 py-1 outline-none"
                        value={(localSettings as any).splits?.affiliate_type ?? 'percent'}
                        onChange={(e) => updateSetting('splits', 'affiliate_type', e.target.value)}
                      >
                        <option value="percent">Porcentagem (%)</option>
                        <option value="fixed">Fixo (R$)</option>
                      </select>
                    </div>
                    <div className="relative">
                      <Input 
                        type="number"
                        placeholder="Valor"
                        value={(localSettings as any).splits?.affiliate_value ?? '10'}
                        onChange={(e) => updateSetting('splits', 'affiliate_value', e.target.value)}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.6rem] font-bold text-muted-foreground">
                        {(localSettings as any).splits?.affiliate_type === 'fixed' ? 'BRL' : '%'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[0.65rem] font-black uppercase tracking-widest text-secondary">Comissão Padrão Revendedores</label>
                      <select 
                        className="bg-black/40 border border-white/10 rounded-lg text-[0.6rem] px-2 py-1 outline-none"
                        value={(localSettings as any).splits?.reseller_type ?? 'percent'}
                        onChange={(e) => updateSetting('splits', 'reseller_type', e.target.value)}
                      >
                        <option value="percent">Porcentagem (%)</option>
                        <option value="fixed">Fixo (R$)</option>
                      </select>
                    </div>
                    <div className="relative">
                      <Input 
                        type="number"
                        placeholder="Valor"
                        value={(localSettings as any).splits?.reseller_value ?? '5'}
                        onChange={(e) => updateSetting('splits', 'reseller_value', e.target.value)}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.6rem] font-bold text-muted-foreground">
                        {(localSettings as any).splits?.reseller_type === 'fixed' ? 'BRL' : '%'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                   <p className="text-[0.6rem] text-muted-foreground leading-relaxed italic">
                     * Os splits são aplicados automaticamente na Amplo Pay. O produtor principal recebe o valor restante após as deduções.
                   </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleSave('splits')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
                </Button>
                <Button onClick={() => handlePublish('splits')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Splits
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* History / Audit */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-primary" />
            <h4 className="text-[0.7rem] font-black uppercase tracking-widest">Histórico de Alterações</h4>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
            {history?.map((h: any) => (
              <div key={h.id} className="flex items-start justify-between rounded-2xl border border-border/40 bg-background/40 p-3">
                <div>
                  <p className="text-[0.65rem] font-bold text-foreground capitalize">{h.entity_id} - {h.action}</p>
                  <p className="text-[0.6rem] text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="hidden lg:block space-y-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Live Preview</h3>
            <p className="text-[0.6rem] text-muted-foreground uppercase font-bold">Simulação em Tempo Real</p>
          </div>
        </div>

        <div className="relative aspect-[9/10] w-full overflow-hidden rounded-3xl border border-border/60 bg-[#0A0A0A] shadow-2xl">
          <div className="absolute top-4 left-4 right-4 z-10 flex h-8 items-center justify-between rounded-full bg-card/50 px-4 backdrop-blur-md border border-white/5">
             <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-destructive/50" />
                <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
                <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
             </div>
             <p className="text-[0.5rem] font-mono text-muted-foreground">https://msk.extension/preview</p>
          </div>
          
          <div className="mt-16 h-full p-8 overflow-y-auto no-scrollbar pb-24">
             {/* Mock de Seções no Preview */}
             {activeSection === 'hero' && (
               <div className="space-y-6">
                  <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[0.5rem] font-bold text-primary uppercase tracking-widest border border-primary/20">
                    Novidade: Versão 32.5
                  </div>
                  <h1 className="text-4xl font-black leading-tight">
                    {localSettings.hero?.title}
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {localSettings.hero?.subtitle}
                  </p>
                  <Button variant="neon" size="lg" className="h-12 w-full font-black text-sm">
                    {localSettings.hero?.cta_text}
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3 pt-4">
                     <div className="h-20 rounded-2xl bg-white/5 border border-white/10 p-3">
                        <div className="h-3 w-3 rounded bg-primary/30 mb-2" />
                        <div className="h-2 w-3/4 bg-white/10 rounded" />
                     </div>
                     <div className="h-20 rounded-2xl bg-white/5 border border-white/10 p-3">
                        <div className="h-3 w-3 rounded bg-emerald-500/30 mb-2" />
                        <div className="h-2 w-1/2 bg-white/10 rounded" />
                     </div>
                  </div>
               </div>
             )}

             {activeSection === 'partners' && (
               <div className="space-y-6 pt-10">
                  <div className="text-center space-y-3">
                    <h2 className="text-2xl font-black uppercase italic">{localSettings.partners_teaser?.title}</h2>
                    <p className="text-xs text-muted-foreground">{localSettings.partners_teaser?.subtitle}</p>
                    <Button variant="neonOutline" className="mt-4 font-black">
                       Seja um Parceiro
                    </Button>
                  </div>
                  
                  <div className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center">
                     <p className="text-[0.6rem] font-black text-primary uppercase mb-2">Ganhos Estimados</p>
                     <p className="text-3xl font-black">R$ 4.500<span className="text-sm text-muted-foreground">/mês</span></p>
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>
      </div>
    </div>

  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
