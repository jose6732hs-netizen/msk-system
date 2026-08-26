import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  GitBranch,
  History,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const BRIDGE_URL = "https://sihpygibnkldhjxujegu.supabase.co/functions/v1/msk-agent";

type AgentRun = {
  id?: string;
  status?: string;
  summary?: string;
  created_at?: string;
  files?: unknown;
  files_changed?: unknown;
  pr_url?: string | null;
  pull_request_url?: string | null;
};

type AgentStatus = {
  entitlement?: { allowed?: boolean; reason?: string; plan?: string | null; license?: unknown };
  plan?: string | null;
  license?: { status?: string | null; expires_at?: string | null; plan?: string | null } | null;
  github?: { connected?: boolean; login?: string | null } | null;
  project?: { name?: string | null; repo?: string | null } | null;
  agent?: { capabilities?: { editCode?: boolean } | null } | null;
  role?: string | null;
  recentRuns?: AgentRun[];
};

type ChatMsg = { role: "user" | "assistant"; content: string };

const SKILLS: Array<{ label: string; command: string; hint: string }> = [
  {
    label: "Editar projeto",
    command: "Quero planejar uma edição no meu projeto. Objetivo: ",
    hint: "Planejar alterações de código",
  },
  {
    label: "Corrigir erro",
    command: "Estou com este erro e preciso de um diagnóstico:\n",
    hint: "Diagnóstico técnico do erro",
  },
  {
    label: "Analisar projeto",
    command: "Faça uma análise geral do meu projeto considerando: ",
    hint: "Visão geral e pontos de risco",
  },
  {
    label: "Preparar deploy",
    command: "Monte um checklist de deploy para o meu projeto. Ambiente: ",
    hint: "Checklist antes de publicar",
  },
  {
    label: "Revisar segurança",
    command: "Revise a segurança do meu projeto focando em: ",
    hint: "Auth, dados e permissões",
  },
];

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

function filesOf(run: AgentRun): string[] {
  const f = run.files_changed ?? run.files;
  if (Array.isArray(f)) return f.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
  if (typeof f === "string" && f.trim()) return [f];
  if (typeof f === "number") return [String(f)];
  return [];
}

export function AgentPanel() {
  const [tab, setTab] = useState<"chat" | "skills" | "history">("chat");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Sou o MSK Agente. Posso ajudar a entender, planejar e preparar alterações no seu projeto. Nada é executado sem sua confirmação.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão não encontrada. Entre novamente.");
      const res = await fetch(`${BRIDGE_URL}?action=connection-status`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Não foi possível conectar ao MSK Agente (HTTP ${res.status}).`);
      const json = (await res.json()) as AgentStatus;
      setStatus(json);
    } catch (e) {
      setStatus(null);
      setError((e as Error).message || "Falha ao conectar ao MSK Agente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const allowed = status?.entitlement?.allowed !== false && !!status;
  const planLabel =
    status?.entitlement?.plan ?? status?.plan ?? status?.license?.plan ?? "Sem plano";
  const runs = status?.recentRuns ?? [];

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão não encontrada. Entre novamente.");
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next.filter((m) => m.role !== "assistant" || true) }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !json.reply) throw new Error(json.error || "Falha ao falar com o agente.");
      setMessages((prev) => [...prev, { role: "assistant", content: json.reply as string }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${(e as Error).message}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="glass rounded-2xl border border-primary/20 p-4 sm:p-6 mb-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">
              MSK <span className="neon-text">Agente</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Assistente técnico do seu projeto — planeja, analisa e prepara alterações.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadStatus()}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar status
        </Button>
      </header>

      {/* Status */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        <StatusChip
          ok={!!status && !error}
          label="Conexão"
          value={loading ? "Verificando…" : status && !error ? "Conectado" : "Offline"}
        />
        <StatusChip ok={allowed} label="Plano/Licença" value={String(planLabel)} />
        <StatusChip
          ok={!!status?.github?.connected}
          label="GitHub"
          value={
            status?.github?.connected
              ? status.github?.login
                ? `@${status.github.login}`
                : "Conectado"
              : "Não conectado"
          }
          icon={<GitBranch className="h-3.5 w-3.5" />}
        />
        <StatusChip
          ok={!!status?.project?.name || !!status?.project?.repo}
          label="Projeto ativo"
          value={status?.project?.name ?? status?.project?.repo ?? "Nenhum"}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status && status.entitlement?.allowed === false && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-2 text-sm font-semibold">MSK Agente bloqueado no seu plano atual</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {status.entitlement?.reason ?? "Ative uma licença compatível para liberar o agente."}
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/planos">Ver planos</Link>
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 text-xs font-semibold">
        {(
          [
            ["chat", "Chat"],
            ["skills", "Skills"],
            ["history", "Histórico"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-2 transition ${
              tab === key
                ? "bg-primary/20 text-primary border border-primary/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <div className="mt-4">
          {status?.agent?.capabilities?.editCode !== true && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
              <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                GitHub precisa ser conectado para edição real de código. Por enquanto o MSK Agente
                analisa, planeja e prepara alterações. Merge, publish e rollback sempre exigem sua
                confirmação explícita.
              </span>
            </div>
          )}
          <div
            ref={listRef}
            className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-primary/15 border border-primary/30"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> MSK Agente está pensando…
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Descreva o que você quer fazer no seu projeto…"
              className="flex-1 resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-primary/50"
            />
            <Button onClick={() => void send()} disabled={sending || !input.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" /> Enviar
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {tab === "skills" && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setInput(s.command);
                setTab("chat");
              }}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-primary/40 hover:bg-primary/10"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                {s.label}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{s.hint}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : runs.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-xs text-muted-foreground">
              <History className="mx-auto mb-2 h-4 w-4" />
              Nenhuma execução registrada até agora.
            </p>
          ) : (
            runs.map((run, i) => {
              const files = filesOf(run);
              return (
                <div
                  key={run.id ?? i}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{run.summary ?? "Execução"}</span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase">
                      {run.status ?? "—"}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{fmtDate(run.created_at)}</p>
                  {files.length > 0 && (
                    <p className="mt-1 break-all text-muted-foreground">
                      Arquivos: {files.join(", ")}
                    </p>
                  )}
                  {(run.pull_request_url ?? run.pr_url) && (
                    <a
                      href={(run.pull_request_url ?? run.pr_url) as string}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-primary underline"
                    >
                      Ver Pull Request
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function StatusChip({
  ok,
  label,
  value,
  icon,
}: {
  ok: boolean;
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="mt-1 flex items-center gap-1 font-semibold">
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}
