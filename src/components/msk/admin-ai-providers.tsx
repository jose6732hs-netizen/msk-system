import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  aiProviderDelete,
  aiProviderModels,
  aiProviderSave,
  aiProviderSetEnabled,
  aiProviderSetPrimary,
  aiProvidersStatus,
  type AiProviderRow,
} from "@/lib/ai-providers.functions";

function ProviderCard({ row, onChanged }: { row: AiProviderRow; onChanged: () => void }) {
  const saveFn = useServerFn(aiProviderSave);
  const deleteFn = useServerFn(aiProviderDelete);
  const primaryFn = useServerFn(aiProviderSetPrimary);
  const modelsFn = useServerFn(aiProviderModels);
  const enabledFn = useServerFn(aiProviderSetEnabled);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(row.model ?? row.models[0] ?? "");

  useEffect(() => setModel(row.model ?? row.models[0] ?? ""), [row.model, row.models]);

  const modelsQuery = useQuery({
    queryKey: ["ai-provider-models", row.id, row.updated_at],
    queryFn: () => modelsFn({ data: { id: row.id } }),
    staleTime: 5 * 60 * 1000,
  });
  const models = Array.from(new Set([...(row.models ?? []), ...(modelsQuery.data?.ok ? modelsQuery.data.models : []), ...(model ? [model] : [])]));

  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: row.id, apiKey: apiKey.trim(), model: model.trim() } }),
    onSuccess: () => { setApiKey(""); toast.success(`${row.label} validada, salva e ativada.`); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setPrimary = useMutation({
    mutationFn: () => primaryFn({ data: { id: row.id } }),
    onSuccess: () => { toast.success(`${row.label} definida como IA principal.`); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => enabledFn({ data: { id: row.id, enabled } }),
    onSuccess: (_r, enabled) => { toast.success(`${row.label} ${enabled ? "ativada" : "desativada"}.`); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: row.id } }),
    onSuccess: () => { toast.success(`Chave do ${row.label} removida.`); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-primary/20 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-black uppercase tracking-widest">{row.label}</h4>
          <span className={`rounded-full border px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-widest ${row.configured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"}`}>{row.configured ? "Key salva" : "Sem key"}</span>
          {row.enabled ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-widest text-emerald-300">Ativa</span> : null}
          {row.is_primary ? <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-widest text-primary">Principal</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-black/30 px-3 py-1.5">
            <Switch checked={row.enabled} disabled={!row.configured || toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} aria-label={`Ativar ${row.label}`} />
            <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">{row.enabled ? "Ativa" : "Pausada"}</span>
          </div>
          {row.configured && row.enabled && !row.is_primary ? <Button size="sm" variant="outline" disabled={setPrimary.isPending} onClick={() => setPrimary.mutate()}><Star className="mr-2 h-3.5 w-3.5" /> Principal</Button> : null}
          {row.configured ? <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remover a API key do ${row.label}?`)) remove.mutate(); }}><Trash2 className="mr-2 h-3.5 w-3.5" /> Remover</Button> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[0.62rem] font-black uppercase tracking-widest">API Key</Label>
          <Input type="password" autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={row.key_masked || "Cole a API key"} className="border-primary/20 bg-black/30 font-mono" />
        </div>
        <div className="space-y-2">
          <Label className="text-[0.62rem] font-black uppercase tracking-widest">Modelo</Label>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="h-10 w-full rounded-md border border-primary/20 bg-black/30 px-3 text-sm text-foreground">
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="neon" size="sm" disabled={save.isPending || apiKey.trim().length < 8 || model.trim().length < 2} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Testar, salvar e ativar</Button>
        <span className="text-[0.65rem] text-muted-foreground">Endpoint protegido: <b className="text-foreground">{row.api_base_url}</b></span>
      </div>
    </section>
  );
}

const PROVIDER_CATALOG: Array<{ id: AiProviderRow["id"]; label: string }> = [
  { id: "bai", label: "B.AI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "gemini", label: "Google Gemini" },
  { id: "groq", label: "Groq" },
  { id: "manus", label: "Manus AI" },
  { id: "mistral", label: "Mistral" },
  { id: "claude", label: "Claude" },
];

export function AdminAiProviders() {
  const qc = useQueryClient();
  const statusFn = useServerFn(aiProvidersStatus);
  const { data, isLoading } = useQuery({ queryKey: ["ai-providers"], queryFn: () => statusFn() });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["ai-providers"] });
  const rows: AiProviderRow[] = PROVIDER_CATALOG.map((item) => {
    const found = (data ?? []).find((row) => row.id === item.id);
    return found ?? {
      id: item.id,
      label: item.label,
      api_base_url: "",
      model: null,
      models: [],
      configured: false,
      key_masked: null,
      enabled: false,
      is_primary: false,
      last_status: null,
      last_checked_at: null,
      updated_at: null,
    };
  });
  const active = rows.filter((row) => row.configured && row.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-[0.68rem] leading-relaxed text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span><b className="text-foreground">Central Multi-IA MSK — {active} ativa(s).</b> Catálogo do Studio original: B.AI, OpenRouter, Google Gemini, Groq, Manus AI e Mistral. Você pode deixar várias ativas ao mesmo tempo. Na extensão, “Todas as IAs” consulta todas as ativas; “Automática” usa a marcada como principal.</span>
      </div>
      {isLoading ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando provedores…</div> : rows.map((row) => <ProviderCard key={row.id} row={row} onChanged={refresh} />)}
    </div>
  );
}
