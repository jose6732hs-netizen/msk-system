import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  extensionModelAdd,
  extensionModelDelete,
  extensionModelToggle,
  extensionModelsBulk,
  extensionModelsList,
} from "@/lib/extension-models.functions";

const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  synterolink: "Claude · SynteroLink",
  openai: "OpenAI",
  gemini: "Google Gemini",
  mistral: "Mistral AI",
  openrouter: "OpenRouter",
  omniroute: "OmniRoute",
  manus: "Manus AI",
  bai: "B.AI",
};

const FOCUS_LABELS: Record<string, string> = { code: "Código", web: "Sites", general: "Geral" };

export function AdminExtensionModels() {
  const qc = useQueryClient();
  const listFn = useServerFn(extensionModelsList);
  const toggleFn = useServerFn(extensionModelToggle);
  const bulkFn = useServerFn(extensionModelsBulk);
  const addFn = useServerFn(extensionModelAdd);
  const deleteFn = useServerFn(extensionModelDelete);

  const [newProvider, setNewProvider] = useState("groq");
  const [newModel, setNewModel] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["extension-models"], queryFn: () => listFn() });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["extension-models"] });

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>["models"]>();
    for (const row of data?.models ?? []) {
      const list = map.get(row.providerId) ?? [];
      list.push(row);
      map.set(row.providerId, list);
    }
    return [...map.entries()];
  }, [data?.models]);

  const visibleCount = (data?.models ?? []).filter((m) => m.visible).length;
  const freeGroq = (data?.models ?? []).filter((m) => m.providerId === "groq" && m.isFree);

  const toggle = useMutation({
    mutationFn: (input: { id: string; visible: boolean }) => toggleFn({ data: input }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const bulk = useMutation({
    mutationFn: (input: { providerId: string; visible: boolean; onlyFree?: boolean }) => bulkFn({ data: input }),
    onSuccess: () => {
      toast.success("Catálogo da extensão atualizado.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const add = useMutation({
    mutationFn: () =>
      addFn({ data: { providerId: newProvider.trim(), modelId: newModel.trim(), label: newLabel.trim(), focus: "code", isFree: false } }),
    onSuccess: () => {
      setNewModel("");
      setNewLabel("");
      toast.success("Modelo adicionado ao catálogo da extensão.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Modelo removido do catálogo.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-background to-background p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest">Modelos visíveis na extensão</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha quais modelos o cliente pode selecionar na extensão. A chave da IA nunca é enviada — só o catálogo.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[0.62rem] font-bold uppercase tracking-widest">
            <span className="rounded-full border border-emerald-500/25 px-2 py-1 text-emerald-300">{visibleCount} visíveis</span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-muted-foreground">{freeGroq.length} grátis Groq</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="neon"
          disabled={bulk.isPending}
          onClick={() => bulk.mutate({ providerId: "groq", visible: true, onlyFree: true })}
        >
          {bulk.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Ativar todos os grátis da Groq
        </Button>
      </div>

      {isLoading ? <p className="mt-4 text-xs text-muted-foreground">Carregando catálogo…</p> : null}

      <div className="mt-5 space-y-4">
        {grouped.map(([providerIdKey, models]) => (
          <div key={providerIdKey} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-[0.16em]">{PROVIDER_LABELS[providerIdKey] || providerIdKey}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={bulk.isPending} onClick={() => bulk.mutate({ providerId: providerIdKey, visible: true })}>
                  <Eye className="mr-2 h-4 w-4" /> Mostrar todos
                </Button>
                <Button size="sm" variant="ghost" disabled={bulk.isPending} onClick={() => bulk.mutate({ providerId: providerIdKey, visible: false })}>
                  <EyeOff className="mr-2 h-4 w-4" /> Ocultar todos
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {models.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{row.label}</p>
                    <p className="truncate font-mono text-[0.6rem] text-muted-foreground">{row.modelId}</p>
                    <div className="mt-1 flex flex-wrap gap-1 text-[0.52rem] font-black uppercase tracking-widest">
                      <span className="rounded-full border border-white/10 px-2 py-0.5">{FOCUS_LABELS[row.focus] || row.focus}</span>
                      {row.isFree ? <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-emerald-300">Grátis</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Switch checked={row.visible} onCheckedChange={(next) => toggle.mutate({ id: row.id, visible: next })} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.confirm(`Remover ${row.modelId}?`) && remove.mutate(row.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em]">Adicionar modelo manualmente</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ext-model-provider">Provedor</Label>
            <Input id="ext-model-provider" value={newProvider} onChange={(event) => setNewProvider(event.target.value)} className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ext-model-id">ID do modelo</Label>
            <Input id="ext-model-id" value={newModel} onChange={(event) => setNewModel(event.target.value)} placeholder="openai/gpt-oss-120b" className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ext-model-label">Nome exibido</Label>
            <Input id="ext-model-label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="opcional" />
          </div>
        </div>
        <Button className="mt-3" size="sm" variant="outline" disabled={add.isPending || newModel.trim().length < 2} onClick={() => add.mutate()}>
          {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Adicionar
        </Button>
      </div>
    </section>
  );
}
