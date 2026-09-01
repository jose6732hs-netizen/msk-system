import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, BrainCircuit, CheckCircle2, KeyRound, Loader2, Network, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminAiGlobalTraining } from "@/components/msk/admin-ai-global-training";
import { AdminAiProviders } from "@/components/msk/admin-ai-providers";
import {
  agentAiSettingsDelete,
  agentAiSettingsSave,
  agentAiSettingsStatus,
} from "@/lib/agent-admin.functions";

export function AdminAgentAiSettings() {
  const qc = useQueryClient();
  const statusFn = useServerFn(agentAiSettingsStatus);
  const saveFn = useServerFn(agentAiSettingsSave);
  const deleteFn = useServerFn(agentAiSettingsDelete);
  const [apiKey, setApiKey] = useState("");
  const [section, setSection] = useState<"api" | "providers" | "training">("api");


  const { data, isLoading } = useQuery({
    queryKey: ["agent-ai-settings"],
    queryFn: () => statusFn(),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { apiKey: apiKey.trim() } }),
    onSuccess: () => {
      setApiKey("");
      toast.success("API da IA validada, criptografada e aplicada ao MSK Agente.");
      qc.invalidateQueries({ queryKey: ["agent-ai-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: () => {
      setApiKey("");
      toast.success("API da IA removida do banco.");
      qc.invalidateQueries({ queryKey: ["agent-ai-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const configured = !!data?.configured;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-primary/15 bg-black/20 p-2">
        <button
          type="button"
          onClick={() => setSection("api")}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[0.65rem] font-black uppercase tracking-widest transition ${section === "api" ? "border-primary/50 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:border-white/10 hover:text-foreground"}`}
        >
          <KeyRound className="h-4 w-4" /> Configuração da IA
        </button>
        <button
          type="button"
          onClick={() => setSection("training")}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[0.65rem] font-black uppercase tracking-widest transition ${section === "training" ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-300" : "border-transparent text-muted-foreground hover:border-white/10 hover:text-foreground"}`}
        >
          <BrainCircuit className="h-4 w-4" /> Treinamento Global
        </button>
      </div>

      {section === "training" ? <AdminAiGlobalTraining /> : (
        <section className="rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-background to-background p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-black uppercase tracking-widest">IA interna do MSK</h4>
                  <span className={`rounded-full border px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-widest ${configured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"}`}>
                    {isLoading ? "Verificando" : configured ? "API ativa" : "Não configurada"}
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  A chave cadastrada aqui é validada na B.AI, criptografada com AES-GCM no servidor e passa a ser usada automaticamente pelo DeepSeek V4 Flash do MSK Agente. A chave completa nunca volta para o navegador.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/50 bg-black/20 px-3 py-2 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> Criptografia ativa
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="msk-ai-api-key" className="text-[0.62rem] font-black uppercase tracking-widest">API Key B.AI</Label>
              <Input
                id="msk-ai-api-key"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={configured ? data?.keyMasked || "••••••••••••••••" : "Cole a API key da B.AI"}
                className="border-primary/20 bg-black/30 font-mono"
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground">
                <span>Provedor: <b className="text-foreground">{data?.provider || "B.AI"}</b></span>
                <span>Modelo: <b className="text-foreground">{data?.model || "deepseek-v4-flash"}</b></span>
                {data?.updatedAt ? <span>Atualizada: <b className="text-foreground">{new Date(data.updatedAt).toLocaleString("pt-BR")}</b></span> : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="neon"
                disabled={apiKey.trim().length < 16 || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Salvar e aplicar
              </Button>
              {configured ? (
                <Button
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm("Remover a API da IA cadastrada no MSK Agente?")) remove.mutate();
                  }}
                >
                  {remove.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Remover
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-[0.68rem] leading-relaxed text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Ao salvar, o servidor testa a chave antes de gravar. Se a B.AI recusar a credencial, ela não substitui a configuração válida atual.
          </div>
        </section>
      )}
    </div>
  );
}
