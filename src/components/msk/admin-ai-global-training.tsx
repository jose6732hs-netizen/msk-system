import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit, CheckCircle2, Copy, History, Loader2, Plus, Power, Save, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  aiGlobalTrainingArchive,
  aiGlobalTrainingDisable,
  aiGlobalTrainingOverview,
  aiGlobalTrainingPreview,
  aiGlobalTrainingPublish,
  aiGlobalTrainingSaveDraft,
} from "@/lib/ai-global-training.functions";

const categoryLabel: Record<string, string> = {
  general: "Geral",
  coding: "Código",
  security: "Segurança",
  behavior: "Comportamento",
  quality: "Qualidade",
  support: "Atendimento",
  business: "Negócio",
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo global",
  disabled: "Desativado",
  archived: "Arquivado",
};

const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

export function AdminAiGlobalTraining() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(aiGlobalTrainingOverview);
  const saveFn = useServerFn(aiGlobalTrainingSaveDraft);
  const previewFn = useServerFn(aiGlobalTrainingPreview);
  const publishFn = useServerFn(aiGlobalTrainingPublish);
  const disableFn = useServerFn(aiGlobalTrainingDisable);
  const archiveFn = useServerFn(aiGlobalTrainingArchive);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState(100);
  const [acknowledgement, setAcknowledgement] = useState("");
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState("all");

  const query = useQuery({
    queryKey: ["ai-global-training"],
    queryFn: () => overviewFn(),
    refetchInterval: 30_000,
  });

  const rows = (query.data?.trainings ?? []) as any[];
  const visible = useMemo(
    () => rows.filter((row) => filter === "all" || row.status === filter),
    [rows, filter],
  );

  const payload = () => ({
    id: editingId,
    title: title.trim(),
    instruction: instruction.trim(),
    category: category as "general" | "coding" | "security" | "behavior" | "quality" | "support" | "business",
    priority,
  });

  const valid = title.trim().length > 0 && instruction.trim().length > 0;

  function resetEditor() {
    setEditingId(null);
    setTitle("");
    setInstruction("");
    setCategory("general");
    setPriority(100);
    setAcknowledgement("");
    setDirty(false);
  }

  function loadRow(row: any, asNewVersion = false) {
    setEditingId(asNewVersion ? null : String(row.id));
    setTitle(String(row.title ?? ""));
    setInstruction(String(row.instruction ?? ""));
    setCategory(String(row.category ?? "general"));
    setPriority(Number(row.priority ?? 100));
    setAcknowledgement(asNewVersion ? "" : String(row.ai_acknowledgement ?? ""));
    setDirty(asNewVersion);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const save = useMutation({
    mutationFn: () => saveFn({ data: payload() }),
    onSuccess: (row: any) => {
      setEditingId(String(row.id));
      setAcknowledgement(String(row.ai_acknowledgement ?? ""));
      setDirty(false);
      toast.success(`Rascunho v${row.version} salvo.`);
      void qc.invalidateQueries({ queryKey: ["ai-global-training"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testUnderstanding = useMutation({
    mutationFn: async () => {
      const saved: any = await saveFn({ data: payload() });
      setEditingId(String(saved.id));
      setDirty(false);
      return previewFn({ data: { id: String(saved.id) } });
    },
    onSuccess: (result: any) => {
      setAcknowledgement(String(result.acknowledgement ?? ""));
      toast.success("A IA confirmou o entendimento. Revise antes de publicar.");
      void qc.invalidateQueries({ queryKey: ["ai-global-training"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publish = useMutation({
    mutationFn: () => publishFn({ data: { id: String(editingId) } }),
    onSuccess: (result: any) => {
      toast.success(`Treinamento v${result?.training?.version ?? ""} publicado para todos os usuários.`);
      resetEditor();
      void qc.invalidateQueries({ queryKey: ["ai-global-training"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disable = useMutation({
    mutationFn: (id: string) => disableFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Treinamento global desativado. Ele deixa de entrar nas próximas chamadas da IA.");
      void qc.invalidateQueries({ queryKey: ["ai-global-training"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Treinamento arquivado.");
      void qc.invalidateQueries({ queryKey: ["ai-global-training"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/[0.08] via-background to-background p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-black uppercase tracking-widest">Treinamento Global da IA</h4>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-widest text-emerald-400">
                  {query.data?.metrics?.active ?? 0} ativos
                </span>
              </div>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">
                Ensine regras operacionais uma vez e aplique em todas as próximas conversas e execuções do MSK Agente. Cada publicação fica versionada e pode ser desativada sem apagar o histórico.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-black/20 px-3 py-2 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-fuchsia-300" /> Todos os usuários
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ["Ativos globais", query.data?.metrics?.active ?? 0],
            ["Rascunhos", query.data?.metrics?.drafts ?? 0],
            ["Desativados", query.data?.metrics?.disabled ?? 0],
            ["Última versão", query.data?.metrics?.latestVersion ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
              <p className="text-[0.55rem] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
        <div className="rounded-2xl border border-primary/20 bg-black/20 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Editor de treinamento</p>
              <p className="mt-1 text-sm font-bold">{editingId ? "Editando rascunho" : "Novo treinamento global"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetEditor}><Plus className="mr-2 h-4 w-4" /> Novo</Button>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_130px]">
              <div className="space-y-1.5">
                <Label className="text-[0.6rem] font-black uppercase tracking-widest">Título</Label>
                <Input value={title} maxLength={160} placeholder="Ex.: Preservar o que já funciona" onChange={(e) => { setTitle(e.target.value); setDirty(true); setAcknowledgement(""); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[0.6rem] font-black uppercase tracking-widest">Categoria</Label>
                <select value={category} onChange={(e) => { setCategory(e.target.value); setDirty(true); setAcknowledgement(""); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                  {Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[0.6rem] font-black uppercase tracking-widest">Prioridade</Label>
                <Input type="number" min={1} max={1000} value={priority} onChange={(e) => { setPriority(Math.max(1, Math.min(1000, Number(e.target.value || 100)))); setDirty(true); setAcknowledgement(""); }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[0.6rem] font-black uppercase tracking-widest">O que a IA deve aprender e seguir</Label>
              <Textarea
                value={instruction}
                onChange={(e) => { setInstruction(e.target.value); setDirty(true); setAcknowledgement(""); }}
                rows={10}
                maxLength={20000}
                placeholder="Ex.: Quando o cliente pedir uma correção, vá direto ao arquivo relacionado ao pedido. Preserve tudo que já funciona, não altere pagamentos, login ou banco sem necessidade e nunca diga que concluiu antes de aplicar e validar a mudança real."
                className="min-h-52 bg-black/25 leading-relaxed"
              />
              <p className="text-right text-[0.6rem] text-muted-foreground">{instruction.length.toLocaleString("pt-BR")} / 20.000</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!valid || save.isPending || testUnderstanding.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar rascunho
              </Button>
              <Button variant="neon" disabled={!valid || testUnderstanding.isPending || save.isPending} onClick={() => testUnderstanding.mutate()}>
                {testUnderstanding.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Testar entendimento
              </Button>
              <Button
                className="ml-auto"
                disabled={!editingId || !acknowledgement || dirty || publish.isPending}
                onClick={() => {
                  if (window.confirm("Publicar este treinamento global para todas as próximas chamadas da IA?")) publish.mutate();
                }}
              >
                {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Publicar para todos
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.035] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-300" />
            <p className="text-[0.6rem] font-black uppercase tracking-widest text-fuchsia-200">O que a IA entendeu</p>
          </div>
          {testUnderstanding.isPending ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analisando o treinamento…</div>
          ) : acknowledgement ? (
            <div className="mt-4 whitespace-pre-wrap rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-sm leading-relaxed text-foreground">
              <div className="mb-2 flex items-center gap-2 text-emerald-400"><CheckCircle2 className="h-4 w-4" /><b>Entendimento confirmado</b></div>
              {acknowledgement}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-muted-foreground">
              Clique em <b>Testar entendimento</b>. A IA lerá exatamente o rascunho e explicará como passará a agir. A publicação só é liberada depois dessa confirmação.
            </div>
          )}
          <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3 text-[0.68rem] leading-relaxed text-muted-foreground">
            Isto funciona como memória/instrução operacional persistente no seu SaaS. Não altera os pesos do modelo. Regras de segurança, autenticação, RLS, isolamento de clientes e proteção de segredos continuam acima do treinamento global.
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><span className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Treinamentos e versões</span></div>
          <div className="flex flex-wrap gap-1.5">
            {[["all","Todos"],["active","Ativos"],["draft","Rascunhos"],["disabled","Desativados"],["archived","Arquivados"]].map(([value,label]) => (
              <button key={value} type="button" onClick={() => setFilter(value as string)} className={`rounded-full border px-3 py-1 text-[0.58rem] font-black uppercase tracking-widest transition ${filter === value ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{label}</button>
            ))}
          </div>
        </div>

        {query.isLoading ? <p className="p-5 text-xs text-muted-foreground">Carregando treinamentos…</p> : visible.length ? (
          <div className="divide-y divide-white/5">
            {visible.map((row: any) => (
              <div key={row.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">v{row.version} · {row.title}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[0.52rem] font-black uppercase tracking-widest ${row.status === "active" ? "border-emerald-500/30 text-emerald-400" : row.status === "draft" ? "border-yellow-500/30 text-yellow-400" : "border-white/10 text-muted-foreground"}`}>{statusLabel[row.status] ?? row.status}</span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.52rem] uppercase text-muted-foreground">{categoryLabel[row.category] ?? row.category} · P{row.priority}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{row.instruction}</p>
                  <p className="mt-1 text-[0.58rem] uppercase tracking-widest text-muted-foreground">Criado {fmt(row.created_at)}{row.published_at ? ` · Publicado ${fmt(row.published_at)}` : ""}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {row.status === "draft" ? <Button size="sm" variant="outline" onClick={() => loadRow(row)}>Editar</Button> : null}
                  {row.status === "active" ? (
                    <Button size="sm" variant="outline" disabled={disable.isPending} onClick={() => { if (window.confirm("Desativar este treinamento global?")) disable.mutate(String(row.id)); }}><Power className="mr-2 h-4 w-4" /> Desativar</Button>
                  ) : null}
                  {row.status !== "draft" ? <Button size="sm" variant="ghost" onClick={() => loadRow(row, true)}><Copy className="mr-2 h-4 w-4" /> Nova versão</Button> : null}
                  {["draft", "disabled"].includes(row.status) ? <Button size="sm" variant="ghost" disabled={archive.isPending} onClick={() => archive.mutate(String(row.id))}>Arquivar</Button> : null}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="p-5 text-xs text-muted-foreground">Nenhum treinamento neste filtro.</p>}
      </section>
    </div>
  );
}
