import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, LogOut, Send, ShieldAlert, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MskLogo } from "@/components/msk/logo";
import { askMskAssistant } from "@/lib/assistant.functions";
import { getAgentAccess } from "@/lib/agent-access.functions";
import { cn } from "@/lib/utils";

type View = "checking" | "gate" | "login" | "signup" | "none" | "expired" | "chat" | "error";
type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Sou o MSK Agente. Posso analisar, planejar e preparar alterações no seu projeto. Nada é executado sem sua confirmação.",
};

const OFFERS_URL = "/planos#msk-agente";

export function AgentBubble() {
  const ask = useServerFn(askMskAssistant);
  const loadAccess = useServerFn(getAgentAccess);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setView("checking");
    setErrorMsg(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setView("gate");
        return;
      }
      const access = await loadAccess({});
      setPlanLabel(access.plan?.name ?? null);
      setExpiresAt(access.license?.expires_at ?? null);
      if (access.status === "active") setView("chat");
      else if (access.status === "expired") setView("expired");
      else setView("none");
    } catch (e) {
      setErrorMsg((e as Error).message || "Falha ao verificar seu acesso.");
      setView("error");
    }
  }, [loadAccess]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("msk:open-agent", handler);
    return () => window.removeEventListener("msk:open-agent", handler);
  }, []);

  useEffect(() => {
    if (open && view === "chat") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, view]);

  async function submitAuth(mode: "login" | "signup") {
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: `${window.location.origin}/painel`,
          },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setAuthError("Conta criada. Confirme seu e-mail e depois entre por aqui.");
          setAuthBusy(false);
          return;
        }
      }
      setPassword("");
      await refresh();
    } catch (e) {
      setAuthError((e as Error).message || "Não foi possível autenticar.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessages([WELCOME]);
    setView("gate");
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await ask({
        data: {
          messages: next
            .filter((m) => m !== WELCOME)
            .map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.ok ? res.reply : (res.error ?? "Não consegui responder agora.") },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Falha de conexão com o MSK Agente. Tente novamente." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function buy() {
    window.location.href = OFFERS_URL;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir MSK Agente"
        className="fixed bottom-24 right-4 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_25px_hsl(var(--primary)/0.6)] transition-transform hover:scale-105 active:scale-95 sm:bottom-28"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="MSK Agente"
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-44 right-4 z-[90] flex h-[28rem] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-[#0A0A0A]/97 shadow-2xl backdrop-blur sm:bottom-48"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <MskLogo size={20} />
              <span className="text-sm font-black uppercase tracking-wider">
                MSK <span className="neon-text">Agente</span>
              </span>
            </div>
            {view === "chat" ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground hover:text-primary"
              >
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto">
            {view === "checking" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Verificando acesso…
              </div>
            )}

            {view === "error" && (
              <StateBox
                icon={<ShieldAlert className="h-6 w-6 text-red-400" />}
                title="Erro de conexão"
                text={errorMsg ?? "Não foi possível conectar ao MSK Agente."}
                actions={
                  <Button size="sm" className="w-full" onClick={() => void refresh()}>
                    Tentar novamente
                  </Button>
                }
              />
            )}

            {view === "gate" && (
              <StateBox
                icon={<Sparkles className="h-6 w-6 text-primary" />}
                title="Acesso necessário"
                text="Entre na sua conta MSK ou garanta o acesso ao MSK Agente para continuar."
                actions={
                  <div className="grid gap-2">
                    <Button size="sm" className="w-full" onClick={() => setView("login")}>
                      Entrar
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setView("signup")}>
                      Criar conta
                    </Button>
                    <Button size="sm" variant="ghost" className="w-full border border-primary/30 text-primary" onClick={buy}>
                      Comprar acesso
                    </Button>
                  </div>
                }
              />
            )}

            {(view === "login" || view === "signup") && (
              <form
                className="space-y-3 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitAuth(view);
                }}
              >
                <p className="text-xs font-black uppercase tracking-widest text-primary">
                  {view === "login" ? "Entrar" : "Criar conta"}
                </p>
                {view === "signup" && (
                  <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
                )}
                <Input
                  type="email"
                  placeholder="E-mail"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Senha"
                  autoComplete={view === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                {authError ? <p className="text-[11px] text-red-400">{authError}</p> : null}
                <Button type="submit" className="w-full" disabled={authBusy}>
                  {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : view === "login" ? "Entrar" : "Criar conta"}
                </Button>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <button type="button" className="hover:text-primary" onClick={() => setView(view === "login" ? "signup" : "login")}>
                    {view === "login" ? "Criar conta" : "Já tenho conta"}
                  </button>
                  <button type="button" className="hover:text-primary" onClick={() => setView("gate")}>
                    Voltar
                  </button>
                </div>
              </form>
            )}

            {view === "none" && (
              <StateBox
                icon={<Sparkles className="h-6 w-6 text-primary" />}
                title="Você ainda não possui acesso ao MSK Agente"
                text="Escolha uma das ofertas do MSK Agente para liberar o assistente na sua conta."
                actions={
                  <Button size="sm" className="w-full" onClick={buy}>
                    Comprar acesso
                  </Button>
                }
              />
            )}

            {view === "expired" && (
              <StateBox
                icon={<ShieldAlert className="h-6 w-6 text-amber-400" />}
                title="Seu acesso expirou"
                text={`${planLabel ?? "MSK Agente"}${expiresAt ? ` · venceu em ${new Date(expiresAt).toLocaleDateString("pt-BR")}` : ""}`}
                actions={
                  <Button size="sm" className="w-full" onClick={buy}>
                    Renovar acesso
                  </Button>
                }
              />
            )}

            {view === "chat" && (
              <div className="space-y-3 px-3 py-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto border border-white/10 bg-white/5 text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {sending && (
                  <div className="mr-auto flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {view === "chat" && (
            <form
              className="flex items-center gap-2 border-t border-white/10 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Descreva o que você quer fazer…"
                className="h-10"
                maxLength={1000}
              />
              <Button type="submit" size="icon" className="h-10 w-10" disabled={sending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

function StateBox({
  icon,
  title,
  text,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      {icon}
      <p className="text-sm font-black uppercase leading-tight">{title}</p>
      <p className="text-[11px] text-muted-foreground">{text}</p>
      <div className="mt-2 w-full">{actions}</div>
    </div>
  );
}
