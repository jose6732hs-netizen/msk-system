import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Film,
  Loader2,
  Plus,
  Save,
  CheckCircle2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uploadMediaWithProgress } from "@/lib/upload-media";
import { normalizeTutorials, type TutorialSection } from "@/lib/tutorials";
import { TutorialPlayer } from "@/components/msk/tutorial-player";

export function TutorialsManager(props: {
  tutorials: any;
  onChange: (sections: TutorialSection[]) => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const sections = normalizeTutorials(props.tutorials);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const commit = (next: TutorialSection[]) => props.onChange(next);

  const updateSection = (index: number, patch: Partial<TutorialSection>) => {
    const next = sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    commit(next);
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    commit(next);
  };

  const updateVideo = (si: number, vi: number, patch: Partial<TutorialSection["videos"][number]>) => {
    const videos = sections[si]!.videos.map((v, i) => (i === vi ? { ...v, ...patch } : v));
    updateSection(si, { videos });
  };

  const moveVideo = (si: number, vi: number, dir: -1 | 1) => {
    const videos = [...sections[si]!.videos];
    const target = vi + dir;
    if (target < 0 || target >= videos.length) return;
    const a = videos[vi]!;
    videos[vi] = videos[target]!;
    videos[target] = a;
    updateSection(si, { videos });
  };

  const pickFile = (accept: string, key: string, onDone: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setProgress((p) => ({ ...p, [key]: 0 }));
      try {
        const url = await uploadMediaWithProgress(file, "tutorials", (pct) =>
          setProgress((p) => ({ ...p, [key]: pct })),
        );
        onDone(url);
        toast.success("Arquivo carregado com sucesso!");
      } catch (e) {
        toast.error((e as Error).message || "Erro no upload");
      } finally {
        setProgress((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-primary" />
          <div>
            <h4 className="text-[0.7rem] font-black uppercase tracking-widest">Seções de Tutoriais</h4>
            <p className="text-[0.6rem] font-bold text-muted-foreground">
              {sections.length} seção(ões) — cada seção vira um bloco na página
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="neonOutline"
          onClick={() =>
            commit([...sections, { title: "Nova seção", description: "", videos: [] }])
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Nova Seção
        </Button>
      </div>

      {sections.length === 0 && (
        <div className="glass rounded-2xl border border-white/5 p-8 text-center text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
          Nenhuma seção criada. Ex: "Vídeos de uso", "Instalação", "Dúvidas frequentes".
        </div>
      )}

      <div className="space-y-6">
        {sections.map((section, si) => (
          <div key={si} className="glass space-y-4 rounded-3xl border border-white/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={si === 0} onClick={() => moveSection(si, -1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <span className="text-center text-[0.6rem] font-black text-primary/70">{si + 1}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={si === sections.length - 1} onClick={() => moveSection(si, 1)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  placeholder="Nome da etapa (ex: Vídeos de uso)"
                  value={section.title ?? ""}
                  onChange={(e) => updateSection(si, { title: e.target.value })}
                  className="text-sm font-black uppercase tracking-widest"
                />
                <Textarea
                  placeholder="Texto explicativo que aparece acima dos vídeos (opcional)"
                  value={section.description ?? ""}
                  onChange={(e) => updateSection(si, { description: e.target.value })}
                  className="min-h-[60px] bg-black/20"
                />
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-red-500/60 hover:bg-red-500/10 hover:text-red-500"
                onClick={() => commit(sections.filter((_, i) => i !== si))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-4 rounded-2xl bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">
                  {section.videos.length} vídeo(s)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[0.6rem] font-black uppercase"
                  onClick={() => updateSection(si, { videos: [...section.videos, { url: "", title: "", description: "", is_redirect: false }] })}
                >
                  <Plus className="mr-1 h-3 w-3" /> Adicionar vídeo
                </Button>
              </div>

              {section.videos.map((video, vi) => {
                const key = `${si}-${vi}`;
                const pct = progress[key];
                return (
                  <div key={vi} className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6rem] font-black uppercase tracking-widest text-primary/70">Vídeo #{vi + 1}</span>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={vi === 0} onClick={() => moveVideo(si, vi, -1)}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={vi === section.videos.length - 1} onClick={() => moveVideo(si, vi, 1)}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500/60 hover:bg-red-500/10 hover:text-red-500"
                          onClick={() => updateSection(si, { videos: section.videos.filter((_, i) => i !== vi) })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <Input
                      placeholder="Título do vídeo"
                      value={video.title ?? ""}
                      onChange={(e) => updateVideo(si, vi, { title: e.target.value })}
                    />

                    <div className="flex gap-2">
                      <Input
                        placeholder="URL (YouTube, Vimeo ou link direto .mp4)"
                        value={video.url ?? ""}
                        onChange={(e) => updateVideo(si, vi, { url: e.target.value })}
                        className="flex-1"
                      />
                      <Button
                        variant="neonOutline"
                        className="shrink-0 gap-2"
                        disabled={pct !== undefined}
                        onClick={() => pickFile("video/*", key, (url) => updateVideo(si, vi, { url }))}
                      >
                        {pct !== undefined ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        <span className="text-[0.6rem] font-black uppercase">{pct !== undefined ? `${pct}%` : "Upload"}</span>
                      </Button>
                    </div>

                    {pct !== undefined && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} />
                      </div>
                    )}

                    <Textarea
                      placeholder="Descrição curta"
                      value={video.description ?? ""}
                      onChange={(e) => updateVideo(si, vi, { description: e.target.value })}
                      className="min-h-[54px] bg-black/20"
                    />

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={!!video.is_redirect}
                        onChange={(e) => updateVideo(si, vi, { is_redirect: e.target.checked })}
                      />
                      <span className="text-[0.6rem] font-bold uppercase text-muted-foreground">
                        Abrir em link externo em vez de exibir o player
                      </span>
                    </label>

                    {video.url && !video.is_redirect && (
                      <div className="aspect-video overflow-hidden rounded-xl border border-white/5 bg-black">
                        <TutorialPlayer video={video} />
                      </div>
                    )}
                  </div>
                );
              })}

              {section.videos.length === 0 && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-6 text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">
                  <Film className="h-4 w-4" /> Nenhum vídeo nesta seção
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={props.onSave} variant="neonOutline" className="flex-1 font-black">
          <Save className="mr-2 h-4 w-4" /> Salvar Rascunho
        </Button>
        <Button onClick={props.onPublish} variant="neon" className="flex-1 font-black">
          <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Tutoriais
        </Button>
      </div>
    </div>
  );
}
