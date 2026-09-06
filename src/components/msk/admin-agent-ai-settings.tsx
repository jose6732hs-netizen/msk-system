import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, BrainCircuit, KeyRound, Layers, Loader2, Network, Pencil, Power, Save, ShieldCheck, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminAiGlobalTraining } from "@/components/msk/admin-ai-global-training";
import { AdminExtensionModels } from "@/components/msk/admin-extension-models";
import {
  agentAiProviderModel,
  agentAiProviderPrimary,
  agentAiProviderToggle,
  agentAiSettingsDelete,
  agentAiSettingsSave,
  agentAiSettingsStatus,
  type AgentAiProviderId,
} from "@/lib/agent-admin.functions";

type ProviderId = AgentAiProviderId;
type SectionId = "providers" | "all" | "models" | "training";
type ProviderMeta = {
  label: string;
  defaultModel: string;
  models: string[];
  hint: string;
  defaultBaseUrl?: string;
  showBaseUrl?: boolean;
  lockBaseUrl?: boolean;
};

const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  bai: { label: "B.AI", defaultModel: "deepseek-v4-flash", models: ["deepseek-v4-flash"], hint: "IA rápida/econômica do MSK." },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "z-ai/glm-5.2",
    models: ["z-ai/glm-5.2", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-001", "meta-llama/llama-3.3-70b-instruct"],
    hint: "Gateway com vários modelos por uma única API Key.",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-5.5",
    models: ["gpt-5.5", "gpt-5.4", "gpt-5.3-codex", "gpt-5.2-codex"],
    hint: "API oficial OpenAI.",
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
    hint: "Modelos Gemini disponíveis para sua chave.",
  },
  groq: {
    label: "Groq",
    defaultModel: "openai/gpt-oss-120b",
    models: [
      "openai/gpt-oss-120b",
      "qwen/qwen3.8-27b",
      "qwen/qwen3.6-27b",
      "openai/gpt-oss-20b",
      "groq/compound",
      "groq/compound-mini",
      "openai/gpt-oss-safeguard-20b",
      "meta-llama/llama-prompt-guard-2-22m",
      "meta-llama/llama-prompt-guard-2-86m",
      "whisper-large-v3",
      "whisper-large-v3-turbo",
      "canopylabs/orpheus-v1-english",
      "canopylabs/orpheus-arabic-saudi",
    ],
    hint: "Free plan da Groq. Padrão GPT-OSS 120B, com troca automática de modelo em caso de limite.",
  },

  manus: {
    label: "Manus AI",
    defaultModel: "manus-agent-v1",
    models: ["manus-agent-v1", "manus-coder-v1", "manus-1.6", "manus-1.6-lite", "manus-1.6-max"],
    hint: "Agentes Manus usados pelo Studio.",
  },
  mistral: {
    label: "Mistral AI",
    defaultModel: "codestral-latest",
    models: ["codestral-latest", "mistral-large-latest", "mistral-small-latest"],
    hint: "Codestral e modelos Mistral.",
  },
  omniroute: {
    label: "OmniRoute",
    defaultModel: "z-ai/glm-5.2",
    models: ["z-ai/glm-5.2"],
    hint: "Gateway OpenAI-compatible do MSK.",
    defaultBaseUrl: "https://ai.msksystem.online/v1",
    showBaseUrl: true,
  },
  synterolink: {
    label: "Claude · KPALabz",
    defaultModel: "claude-sonnet-5",
    models: ["claude-sonnet-5", "claude-sonnet-4-6"],
    hint: "Claude via KPALabz. A chave fica somente no backend do MSK.",
    defaultBaseUrl: "https://api.kpalabz.com",
    showBaseUrl: true,
    lockBaseUrl: true,
  },
};

const ALL_PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
const MULTI_PROVIDER_IDS: ProviderId[] = ["synterolink", "openai", "openrouter", "groq", "gemini", "omniroute"];

export function AdminAgentAiSettings() {
  const qc = useQueryClient();
  const statusFn = useServerFn(agentAiSettingsStatus);
  const saveFn = useServerFn(agentAiSettingsSave);
  const deleteFn = useServerFn(agentAiSettingsDelete);
  const toggleFn = useServerFn(agentAiProviderToggle);
  const primaryFn = useServerFn(agentAiProviderPrimary);
  const modelFn = useServerFn(agentAiProviderModel);

  const [section, setSection] = useState<SectionId>("providers");
  const [provider, setProvider] = useState<ProviderId>("synterolink");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(PROVIDERS.synterolink.defaultModel);
  const [baseUrl, setBaseUrl] = useState(PROVIDERS.synterolink.defaultBaseUrl || "");

  const { data, isLoading } = useQuery({
    queryKey: ["agent-ai-settings"],
    queryFn: () => statusFn(),
  });

  const rows = useMemo(() => new Map((data?.providers ?? []).map((row) => [row.providerId, row])), [data?.providers]);
  const current = rows.get(provider);
  const meta = PROVIDERS[provider];
  const availableModels = current?.models?.length ? current.models : meta.models;
  const visibleProviders = section === "providers" ? MULTI_PROVIDER_IDS : ALL_PROVIDER_IDS;
  const activeCount = (data?.providers ?? []).filter((row) => row.configured && row.active).length;
  const configuredCount = (data?.providers ?? []).filter((row) => row.configured).length;

  useEffect(() => {
    const row = rows.get(provider);
    setModel(provider === "synterolink" ? meta.defaultModel : row?.model || meta.defaultModel);
    setBaseUrl(provider === "synterolink" ? meta.defaultBaseUrl || "" : row?.baseUrl || meta.defaultBaseUrl || "");
    setApiKey("");
  }, [provider, current?.updatedAt]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["agent-ai-settings"] });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          provider,
          apiKey: apiKey.trim(),
          model: model.trim(),
          baseUrl: baseUrl.trim(),
          makePrimary: !data?.providers?.some((row) => row.configured && row.active),
        },
      }),
    onSuccess: () => {
      setApiKey("");
      toast.success(`${meta.label} salva e ativada. Ela continuará disponível para uso automático.`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (active: boolean) => toggleFn({ data: { provider, active } }),
    onSuccess: (_data, active) => {
      toast.success(active ? `${meta.label} ativada.` : `${meta.label} desativada.`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const primary = useMutation({
    mutationFn: () => primaryFn({ data: { provider } }),
    onSuccess: () => {
      toast.success(`${meta.label} definida como IA principal.`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveModel = useMutation({
    mutationFn: () => modelFn({ data: { provider, model: model.trim() } }),
    onSuccess: () => {
      toast.success(`Modelo ${model} salvo em ${meta.label}.`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { provider } }),
    onSuccess: () => {
      setApiKey("");
      toast.success(`API ${meta.label} removida.`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-primary/15 bg-black/20 p-2">
        <Button size="sm" variant={section === "providers" ? "default" : "ghost"} onClick={() => setSection("providers")}>
          <Network className="mr-2 h-4 w-4" /> Multi-APIs + Claude
        </Button>
        <Button size="sm" variant={section === "all" ? "default" : "ghost"} onClick={() => setSection("all")}>
          <Bot className="mr-2 h-4 w-4" /> Todas as IAs
        </Button>
        <Button size="sm" variant={section === "models" ? "default" : "ghost"} onClick={() => setSection("models")}>
          <Layers className="mr-2 h-4 w-4" /> Modelos da extensão
        </Button>
        <Button size="sm" variant={section === "training" ? "default" : "ghost"} onClick={() => setSection("training")}>
          <BrainCircuit className="mr-2 h-4 w-4" /> Treinamento Global
        </Button>
      </div>

      {section === "models" ? <AdminExtensionModels /> : section === "training" ? <AdminAiGlobalTraining /> : (
        <section className="rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-background to-background p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest">Central Multi-IA do MSK System</h4>
              <p className="mt-1 text-xs text-muted-foreground">Cadastre várias APIs e mantenha todas disponíveis. A principal atende primeiro; se ela falhar, o agente tenta outra ativa. A extensão nunca recebe as chaves.</p>
              <div className="mt-2 flex gap-2 text-[0.62rem] font-bold uppercase tracking-widest">
                <span className="rounded-full border border-emerald-500/25 px-2 py-1 text-emerald-300">{activeCount} ativas</span>
                <span className="rounded-full border border-white/10 px-2 py-1 text-muted-foreground">{configuredCount} configuradas</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> Keys protegidas no backend
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProviders.map((id) => {
              const row = rows.get(id);
              const selected = id === provider;
              return (
                <button key={id} type="button" onClick={() => setProvider(id)} className={`rounded-xl border p-4 text-left transition ${selected ? "border-primary/60 bg-primary/10" : "border-white/10 bg-black/20 hover:border-primary/30"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="block text-xs font-black uppercase tracking-[0.14em]">{PROVIDERS[id].label}</span>
                      <span className="mt-1 block text-[0.64rem] leading-relaxed text-muted-foreground">{PROVIDERS[id].hint}</span>
                    </div>
                    <span className="flex items-center gap-2">
                      {row?.configured ? <Pencil className="h-3.5 w-3.5 text-primary" aria-label={`Trocar chave da ${PROVIDERS[id].label}`} /> : null}
                      <span className={`h-2.5 w-2.5 rounded-full ${row?.configured && row.active ? "bg-emerald-400" : row?.configured ? "bg-amber-400" : "bg-white/20"}`} />
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1 text-[0.55rem] font-black uppercase tracking-widest">
                    <span className="rounded-full border border-white/10 px-2 py-1">{row?.configured ? (row.active ? "Ativa" : "Pausada") : "Sem key"}</span>
                    {row?.primary ? <span className="rounded-full border border-primary/30 px-2 py-1 text-primary">Principal</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em]">
                  {current?.configured ? <Pencil className="h-3.5 w-3.5 text-primary" /> : <KeyRound className="h-3.5 w-3.5 text-primary" />}
                  {current?.configured ? `Trocar API ${meta.label}` : `Adicionar API ${meta.label}`}
                </p>
                <p className="mt-1 text-[0.65rem] text-muted-foreground">{current?.configured ? `Key salva ${current.keyMasked || ""} · ${current.active ? "ATIVA" : "PAUSADA"}` : "Nenhuma API Key cadastrada"}</p>
              </div>
              {current?.primary ? <span className="flex items-center gap-1 text-xs text-primary"><Star className="h-4 w-4" /> Principal</span> : null}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="msk-ai-api-key">API Key</Label>
                <Input id="msk-ai-api-key" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={current?.configured ? current.keyMasked || "••••••••" : `Cole a API Key da ${meta.label}`} className="font-mono" />
                <p className="text-[0.62rem] text-muted-foreground">A chave é salva com segurança. A chave anterior só é substituída depois da confirmação.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="msk-ai-model">Modelo — pode digitar ou colar</Label>
                <Input
                  id="msk-ai-model"
                  list={`msk-models-${provider}`}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={meta.defaultModel}
                  autoComplete="off"
                  className="font-mono"
                />
                <datalist id={`msk-models-${provider}`}>
                  {availableModels.map((id) => <option key={id} value={id} label={MODEL_BADGES[id] || undefined} />)}
                </datalist>

                <p className="text-[0.62rem] text-muted-foreground">
                  Cole o ID exato do modelo. Para Claude use <b className="text-foreground">claude-sonnet-5</b>.
                </p>
                {current?.configured ? (
                  <Button size="sm" variant="outline" disabled={saveModel.isPending || !model.trim()} onClick={() => saveModel.mutate()}>
                    {saveModel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar modelo
                  </Button>
                ) : null}
              </div>
            </div>

            {meta.showBaseUrl ? (
              <div className="mt-4 space-y-2">
                <Label htmlFor="msk-ai-base-url">Base URL</Label>
                <Input id="msk-ai-base-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} disabled={meta.lockBaseUrl} placeholder={meta.defaultBaseUrl} className="font-mono" />
                <p className="text-[0.62rem] text-muted-foreground">
                  {provider === "synterolink" ? "Claude usa https://api.kpalabz.com; o MSK acrescenta /v1/messages no servidor." : "Use uma URL HTTPS acessível pelo backend."}
                </p>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs text-muted-foreground">
              Ao salvar, <b className="text-primary">{meta.label}</b> fica ativa sem desligar nem esconder as outras APIs cadastradas.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="neon" disabled={apiKey.trim().length < 8 || save.isPending || !model.trim() || (meta.showBaseUrl && !baseUrl.trim())} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                {current?.configured ? "Trocar chave e manter ativa" : "Salvar e ativar"}
              </Button>

              {current?.configured && !current.active ? (
                <Button variant="neon" disabled={toggle.isPending} onClick={() => toggle.mutate(true)}>
                  <Power className="mr-2 h-4 w-4" /> ATIVAR AGORA
                </Button>
              ) : null}

              {current?.configured && current.active ? (
                <Button variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(false)}>
                  <Power className="mr-2 h-4 w-4" /> Desativar
                </Button>
              ) : null}

              {current?.configured && current.active && !current.primary ? (
                <Button variant="outline" disabled={primary.isPending} onClick={() => primary.mutate()}>
                  <Star className="mr-2 h-4 w-4" /> Tornar principal
                </Button>
              ) : null}

              {current?.configured ? (
                <Button variant="outline" disabled={remove.isPending} onClick={() => window.confirm(`Remover a API ${meta.label}?`) && remove.mutate()}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remover API
                </Button>
              ) : null}
            </div>
          </div>

          {isLoading ? <p className="mt-3 text-xs text-muted-foreground">Carregando configurações…</p> : null}
        </section>
      )}
    </div>
  );
}
