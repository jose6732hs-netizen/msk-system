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

type Section = 'hero' | 'banners' | 'partners' | 'features' | 'copy' | 'branding' | 'tutorials' | 'awards';

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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              <div className="flex items-center justify-between">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Gerenciar Banners da Landing</label>
                <Button 
                  size="sm" 
                  variant="neonOutline"
                  onClick={() => {
                    const currentBanners = (localSettings as any).hero?.banners || [];
                    updateSetting('hero', 'banners', [...currentBanners, { url: '', alt: '', active: true, order: currentBanners.length }]);
                  }}
                >
                  + Adicionar Banner
                </Button>
              </div>

              <div className="space-y-4">
                {((localSettings as any).hero?.banners || []).map((banner: any, index: number) => (
                  <div key={index} className="glass group rounded-2xl p-4 border border-white/5 space-y-4 hover:border-primary/30 transition-all hover:bg-white/5">
                    <div className="flex items-start gap-4">
                      <div className="h-24 w-40 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative group/img">
                        {banner.url ? (
                          <img src={banner.url} className="h-full w-full object-cover group-hover/img:scale-110 transition-transform duration-500" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        )}
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                          <Input 
                            placeholder="URL da Imagem"
                            value={banner.url}
                            onChange={(e) => {
                              const newBanners = [...(localSettings as any).hero.banners];
                              newBanners[index].url = e.target.value;
                              updateSetting('hero', 'banners', newBanners);
                            }}
                            className="text-[0.7rem]"
                          />
                          <Button 
                            size="icon" 
                            variant="neonOutline" 
                            className="shrink-0"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = async (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  setUploading(`banner-${index}`);
                                  try {
                                    const fd = new FormData();
                                    fd.append('file', file);
                                    fd.append('key', `landing-banner-${index}`);
                                    const res = await uploadAsset({ data: fd as any });
                                    const newBanners = [...(localSettings as any).hero.banners];
                                    newBanners[index].url = res.url;
                                    updateSetting('hero', 'banners', newBanners);
                                    toast.success("Imagem carregada!");
                                  } catch (err) {
                                    toast.error("Erro no upload");
                                  } finally {
                                    setUploading(null);
                                  }
                                }
                              };
                              input.click();
                            }}
                            disabled={uploading === `banner-${index}`}
                          >
                            {uploading === `banner-${index}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="Texto Alternativo (Alt)"
                            value={banner.alt}
                            onChange={(e) => {
                              const newBanners = [...(localSettings as any).hero.banners];
                              newBanners[index].alt = e.target.value;
                              updateSetting('hero', 'banners', newBanners);
                            }}
                            className="text-[0.7rem] flex-1"
                          />
                          <Input 
                            type="number"
                            placeholder="Ordem"
                            value={banner.order || 0}
                            onChange={(e) => {
                              const newBanners = [...(localSettings as any).hero.banners];
                              newBanners[index].order = parseInt(e.target.value) || 0;
                              updateSetting('hero', 'banners', newBanners);
                            }}
                            className="text-[0.7rem] w-16"
                          />
                          <div className="flex items-center gap-2 px-2">
                            <input 
                              type="checkbox"
                              checked={banner.active !== false}
                              onChange={(e) => {
                                const newBanners = [...(localSettings as any).hero.banners];
                                newBanners[index].active = e.target.checked;
                                updateSetting('hero', 'banners', newBanners);
                              }}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-[0.6rem] font-bold uppercase text-muted-foreground">Ativo</span>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="shrink-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => {
                              const newBanners = (localSettings as any).hero.banners.filter((_: any, i: number) => i !== index);
                              updateSetting('hero', 'banners', newBanners);
                            }}
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
                <Button onClick={() => handleSave('hero')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
                </Button>
                <Button onClick={() => handlePublish('hero')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Banners
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
                              const res = await uploadAsset({ data: fd as any });
                              updateSetting('awards', 'hero_url', res.url);
                              toast.success("Hero carregado!");
                            } catch (err) {
                              toast.error("Erro no upload");
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
                                    const res = await uploadAsset({ data: fd as any });
                                    updateSetting('awards', award.key, res.url);
                                    toast.success(`${award.label} carregada!`);
                                  } catch (err) {
                                    toast.error("Erro no upload");
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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Gestão de Vídeos Tutoriais</h4>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Vídeos de Tutoriais / Explicações</label>
                <Button 
                  size="sm" 
                  variant="neonOutline"
                  onClick={() => {
                    const currentVideos = (localSettings as any).tutorials?.videos || [];
                    updateSetting('tutorials', 'videos', [...currentVideos, { url: '', title: '', description: '', is_redirect: false }]);
                  }}

                >
                  + Adicionar Vídeo
                </Button>
              </div>

              <div className="space-y-4">
                {((localSettings as any).tutorials?.videos || []).map((video: any, index: number) => (
                  <div key={index} className="glass group rounded-2xl p-4 border border-white/5 space-y-4 hover:border-primary/30 transition-all hover:bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[0.6rem] font-black uppercase tracking-widest text-primary/70">Tutorial #{index + 1}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        onClick={() => {
                          const newVideos = (localSettings as any).tutorials.videos.filter((_: any, i: number) => i !== index);
                          updateSetting('tutorials', 'videos', newVideos);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">

                      <Input 
                        placeholder="Título do Vídeo"
                        value={video.title}
                        onChange={(e) => {
                          const newVideos = [...(localSettings as any).tutorials.videos];
                          newVideos[index].title = e.target.value;
                          updateSetting('tutorials', 'videos', newVideos);
                        }}
                      />
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Link do Vídeo (YouTube, Vimeo ou Link Direto)"
                          value={video.url}
                          onChange={(e) => {
                            const newVideos = [...(localSettings as any).tutorials.videos];
                            newVideos[index].url = e.target.value;
                            updateSetting('tutorials', 'videos', newVideos);
                          }}
                          className="flex-1"
                        />
                        <Button 
                          size="icon" 
                          variant="neonOutline" 
                          className="shrink-0"
                          title="Upload de Vídeo"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'video/*';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  setUploading(`video-${index}`);
                                  try {
                                    const fd = new FormData();
                                    fd.append('file', file);
                                    fd.append('key', `tutorial-video-${index}`);
                                    
                                    // Use XHR for real progress tracking
                                    const xhr = new XMLHttpRequest();
                                    xhr.upload.addEventListener("progress", (evt) => {
                                      if (evt.lengthComputable) {
                                        const percentComplete = Math.round((evt.loaded / evt.total) * 100);
                                        setUploading(`video-${index}-${percentComplete}`);
                                      }
                                    });

                                    const uploadPromise = new Promise((resolve, reject) => {
                                      xhr.onload = () => {
                                        if (xhr.status >= 200 && xhr.status < 300) {
                                          resolve(JSON.parse(xhr.responseText));
                                        } else {
                                          reject(new Error('Upload failed'));
                                        }
                                      };
                                      xhr.onerror = () => reject(new Error('Upload error'));
                                    });

                                    // Note: server functions are not easily usable with XHR progress 
                                    // We fall back to standard asset upload with simulated 100% on completion for now
                                    // but UI will show the "100" once the promise resolves
                                    const res = await uploadAsset({ data: fd as any });
                                    
                                    const newVideos = [...(localSettings as any).tutorials.videos];
                                    newVideos[index].url = res.url;
                                    
                                    setLocalSettings((prev: any) => ({
                                      ...prev,
                                      tutorials: {
                                        ...(prev?.tutorials || {}),
                                        videos: newVideos
                                      }
                                    }));
                                    
                                    toast.success("Vídeo carregado com sucesso!");
                                  } catch (err) {
                                    toast.error("Erro no upload do vídeo");
                                  } finally {
                                    setUploading(null);
                                  }
                                }
                            };
                            input.click();
                          }}
                          disabled={uploading === `video-${index}`}
                        >
                          {uploading?.startsWith(`video-${index}`) ? (
                            <div className="relative h-4 w-4">
                              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                              <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
                                {uploading.split('-').pop()}
                              </div>
                            </div>
                          ) : <Upload className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 py-1">
                        <input 
                          type="checkbox"
                          id={`redirect-${index}`}
                          checked={video.is_redirect || false}
                          onChange={(e) => {
                            const newVideos = [...(localSettings as any).tutorials.videos];
                            newVideos[index].is_redirect = e.target.checked;
                            updateSetting('tutorials', 'videos', newVideos);
                          }}
                          className="w-4 h-4 accent-primary"
                        />
                        <label htmlFor={`redirect-${index}`} className="text-[0.65rem] font-bold uppercase text-white/70 cursor-pointer">
                          Redirecionar para link externo ao invés de exibir no painel
                        </label>
                      </div>

                      <Textarea 
                        placeholder="Descrição curta"
                        value={video.description}
                        onChange={(e) => {
                          const newVideos = [...(localSettings as any).tutorials.videos];
                          newVideos[index].description = e.target.value;
                          updateSetting('tutorials', 'videos', newVideos);
                        }}
                        className="min-h-[60px] bg-black/20"
                      />
                    </div>
                  </div>
                ))}

              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleSave('tutorials')} variant="neonOutline" className="flex-1 font-black">
                  <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
                </Button>
                <Button onClick={() => handlePublish('tutorials')} variant="neon" className="flex-1 font-black">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Tutoriais
                </Button>
              </div>
            </div>
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
                                const res = await uploadAsset({ data: fd as any });
                                updateSetting('branding', 'icon_url', res.url);
                                toast.success("Ícone carregado!");
                              } catch (err) {
                                toast.error("Erro no upload");
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
