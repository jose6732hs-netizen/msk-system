import { useState, useEffect, useRef } from "react";
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
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent, saveCmsDraft, publishCmsDraft, getCmsHistory, uploadCmsAsset } from "@/lib/cms.functions";

type Section = 'hero' | 'partners' | 'features' | 'copy' | 'branding';

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
      await publishDraft({ data: { key } });
      toast.success("Conteúdo publicado com sucesso!");
      qc.invalidateQueries({ queryKey: ["cms-content"] });
      qc.invalidateQueries({ queryKey: ["cms-history"] });
    } catch (e) {
      toast.error("Erro ao publicar");
    }
  };

  if (isLoading || !localSettings) {
    return <div className="flex h-64 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Editor Panel */}
      <div className="space-y-6">
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

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'hero', label: 'Hero / Início', icon: Monitor },
            { id: 'partners', label: 'Parceiros', icon: Users },
            { id: 'branding', label: 'Extensão / Branding', icon: Palette },
            { id: 'copy', label: 'Copies / Suporte', icon: Type },
          ].map((s: any) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[0.65rem] font-black uppercase tracking-widest transition-all ${
                activeSection === s.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="glass rounded-3xl p-6 space-y-6">
          {activeSection === 'hero' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Título Principal (H1)</label>
                <Input 
                  value={localSettings.hero?.title || ''} 
                  onChange={(e) => updateSetting('hero', 'title', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Subtítulo</label>
                <Textarea 
                  value={localSettings.hero?.subtitle || ''} 
                  onChange={(e) => updateSetting('hero', 'subtitle', e.target.value)}
                  className="bg-background/50 min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Texto CTA</label>
                  <Input 
                    value={localSettings.hero?.cta_text || ''} 
                    onChange={(e) => updateSetting('hero', 'cta_text', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Link CTA</label>
                  <Input 
                    value={localSettings.hero?.cta_link || ''} 
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

          {activeSection === 'partners' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Título Chamada Parceiros</label>
                <Input 
                  value={localSettings.partners_teaser?.title || ''} 
                  onChange={(e) => updateSetting('partners_teaser', 'title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Subtítulo Parceiros</label>
                <Textarea 
                  value={localSettings.partners_teaser?.subtitle || ''} 
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
          
          {activeSection === 'copy' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">URL de Suporte (WhatsApp)</label>
                <Input 
                  placeholder="https://wa.me/55..."
                  value={localSettings.config?.support_url || ''} 
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

          {activeSection === 'branding' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[0.65rem] font-bold text-primary/80 leading-relaxed">
                Aqui você configura os ícones e o banner que aparecem na extensão. As alterações afetam todos os usuários após a sincronização automática.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground block">Ícone Principal (128x128)</label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        {localSettings.branding?.icon_url ? (
                          <img src={localSettings.branding.icon_url} className="h-full w-full object-cover" />
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
                      {localSettings.branding?.banner_url ? (
                        <img src={localSettings.branding.banner_url} className="h-full w-full object-cover" />
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
                      value={localSettings.branding?.brand_name || 'MSK SISTEM'} 
                      onChange={(e) => updateSetting('branding', 'brand_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">Cor Primária (Hex)</label>
                    <div className="flex gap-2">
                      <Input 
                        value={localSettings.branding?.primary_color || '#39ff14'} 
                        onChange={(e) => updateSetting('branding', 'primary_color', e.target.value)}
                        className="font-mono"
                      />
                      <div 
                        className="h-10 w-12 rounded-xl border border-white/10" 
                        style={{ backgroundColor: localSettings.branding?.primary_color || '#39ff14' }}
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

function Users({ className }: { className?: string }) {
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
