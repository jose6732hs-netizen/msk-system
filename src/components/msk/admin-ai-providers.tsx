import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
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
  const [model, setModel] = useState(row.model ?? "");
  const [baseUrl, setBaseUrl] = useState(row.api_base_url);

  const modelsQuery = useQuery({
    queryKey: ["ai-provider-models", row.id, row.updated_at],
    queryFn: () => modelsFn({ data: { id: row.id } }),
    enabled: row.configured,
    staleTime: 5 * 60 * 1000,
  });

  const fetched = modelsQuery.data?.ok ? modelsQuery.data.models : [];
  const models = Array.from(
    new Set([...(row.model ? [row.model] : []), ...(model ? [model] : []), ...fetched]),
  ).sort((a, b) => a.localeCompare(b));

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: row.id,
          ...(apiKey.trim().length >= 16 ? { apiKey: apiKey.trim() } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
          ...(baseUrl.trim() && baseUrl.trim() !== row.api_base_url ? { baseUrl: baseUrl.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setApiKey("");
      toast.success(`${row.label} atualizado.`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function reloadModels() {
    const res = await modelsQuery.refetch();
    const value = res.data;
    if (value && !value.ok) toast.error(value.error);
    else if (value?.ok) toast.success(`${value.models.length} modelos disponíveis em ${row.label}.`);
  }

  const setPrimary = useMutation({
    mutationFn: () => primaryFn({ data: { id: row.id } }),
    onSuccess: () => {
      toast.success(`${row.label} definido como provedor principal.`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => enabledFn({ data: { id: row.id, enabled } }),
    onSuccess: (_res, enabled) => {
      toast.success(
        enabled
          ? `${row.label} ativado — agora é a IA usada pelo agente.`
          : `${row.label} desativado.`,
      );
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isActive = row.enabled && row.is_primary;

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: row.id } }),
    onSuccess: () => {
      toast.success(`Chave do ${row.label} removida.`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-primary/20 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-black uppercase tracking-widest">{row.label}</h4>
          <span
            className={`rounded-full border px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-widest ${row.configured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"}`}
          >
            {row.configured ? "API ativa" : "Sem chave"}
          </span>
          {isActive ? (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-widest text-primary">
              Em uso pelo agente
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-black/30 px-3 py-1.5">
            <Switch
              checked={isActive}
              disabled={!row.configured || toggle.isPending}
              onCheckedChange={(v) => toggle.mutate(v)}
              aria-label={`Ativar ${row.label}`}
            />
            <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">
              {isActive ? "Ativa" : "Desativada"}
            </span>
          </div>
          {!isActive && row.configured ? (
            <Button size="sm" variant="outline" disabled={setPrimary.isPending} onClick={() => setPrimary.mutate()}>
              <Star className="mr-2 h-3.5 w-3.5" /> Tornar principal
            </Button>
          ) : null}
          {row.configured ? (
            <Button
              size="sm"
              variant="outline"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Remover a API key do ${row.label}?`)) remove.mutate();
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Remover
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-[0.62rem] font-black uppercase tracking-widest">API Key</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={row.key_masked || "Cole a API key"}
            className="border-primary/20 bg-black/30 font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[0.62rem] font-black uppercase tracking-widest">Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://…"
            className="border-primary/20 bg-black/30 font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[0.62rem] font-black uppercase tracking-widest">Modelo ativo</Label>
          <div className="flex gap-2">
            {models.length > 0 ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="h-10 w-full rounded-md border border-primary/20 bg-black/30 px-3 text-sm"
              >
                <option value="">Selecione…</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="ex.: gpt-4o-mini"
                className="border-primary/20 bg-black/30 font-mono"
              />
            )}
            <Button
              variant="outline"
              size="icon"
              title="Buscar modelos disponíveis"
              disabled={!row.configured || modelsQuery.isFetching}
              onClick={() => void reloadModels()}
            >
              {modelsQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="neon"
          size="sm"
          disabled={save.isPending || (apiKey.trim().length < 16 && model.trim() === (row.model ?? ""))}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
        <span className="text-[0.65rem] text-muted-foreground">
          {fetched.length > 0 ? `${fetched.length} modelos · ` : ""}Endpoint: <b className="text-foreground">{row.api_base_url}</b>
        </span>
      </div>
    </section>
  );
}

export function AdminAiProviders() {
  const qc = useQueryClient();
  const statusFn = useServerFn(aiProvidersStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => statusFn(),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["ai-providers"] });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-[0.68rem] leading-relaxed text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Cadastre a chave de cada provedor (OpenAI, Groq e Gemini). As chaves são criptografadas no banco e nunca
        voltam para o navegador. Use o botão de atualizar para listar os modelos disponíveis na sua conta e escolher
        qual fica ativo. O provedor marcado como principal é o usado pelo MSK Agente.
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando provedores…
        </div>
      ) : (
        (data ?? []).map((row) => <ProviderCard key={row.id} row={row} onChanged={refresh} />)
      )}
    </div>
  );
}
