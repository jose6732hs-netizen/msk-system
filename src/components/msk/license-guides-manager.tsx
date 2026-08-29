import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uploadMediaWithProgress } from "@/lib/upload-media";
import { normalizeLicenseGuides, type LicenseGuide } from "@/lib/license-guides";

export function LicenseGuidesManager(props: {
  guides: any;
  onChange: (items: LicenseGuide[]) => void;
}) {
  const items = normalizeLicenseGuides(props.guides);
  const [progress, setProgress] = useState<Record<number, number>>({});

  const commit = (next: LicenseGuide[]) => props.onChange(next);
  const update = (index: number, patch: Partial<LicenseGuide>) =>
    commit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const current = next[index]!;
    next[index] = next[target]!;
    next[target] = current;
    commit(next);
  };

  const pickImage = (index: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setProgress((p) => ({ ...p, [index]: 0 }));
      try {
        const url = await uploadMediaWithProgress(file, "tutorials", (pct) =>
          setProgress((p) => ({ ...p, [index]: pct })),
        );
        update(index, { image: url });
        toast.success("Imagem enviada!");
      } catch (error) {
        toast.error((error as Error).message || "Erro no upload");
      } finally {
        setProgress((p) => {
          const next = { ...p };
          delete next[index];
          return next;
        });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-[0.7rem] font-black uppercase tracking-widest">
            Tutoriais das licenças (imagens)
          </h4>
          <p className="text-[0.6rem] font-bold text-muted-foreground">
            Visíveis apenas para quem tem licença ativa · {items.length} etapa(s)
          </p>
        </div>
        <Button
          size="sm"
          variant="neonOutline"
          onClick={() => commit([...items, { title: "Nova etapa", description: "", image: "" }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Nova etapa
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                Etapa {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => move(index, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => move(index, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => commit(items.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <Input
              value={item.title}
              placeholder="Título da etapa"
              onChange={(event) => update(index, { title: event.target.value })}
            />
            <Textarea
              value={item.description ?? ""}
              placeholder="Descrição curta"
              onChange={(event) => update(index, { description: event.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={item.image}
                placeholder="URL da imagem"
                onChange={(event) => update(index, { image: event.target.value })}
              />
              <Button size="sm" variant="secondary" onClick={() => pickImage(index)}>
                {progress[index] !== undefined ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> {progress[index]}%
                  </>
                ) : (
                  <>
                    <Upload className="mr-1 h-3.5 w-3.5" /> Enviar imagem
                  </>
                )}
              </Button>
            </div>
            {item.image ? (
              <img
                src={item.image}
                alt={item.title}
                className="max-h-56 w-full rounded-xl border border-white/10 bg-black/40 object-contain"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
