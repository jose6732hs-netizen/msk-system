import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askMskAssistant } from "@/lib/assistant.functions";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Olá! Sou o Assistente MSK. Posso explicar sua licença, validade, planos e como usar o painel. O que você precisa?",
};

export function AssistantWidget() {
  const ask = useServerFn(askMskAssistant);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({
        data: { messages: next.filter((m) => m !== WELCOME).map((m) => ({ role: m.role, content: m.content })) },
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.ok ? res.reply : (res.error ?? "Não consegui responder agora.") },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Falha de conexão com o assistente. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir Assistente MSK"
        className="fixed bottom-24 right-4 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_25px_hsl(var(--primary)/0.6)] transition-transform hover:scale-105 active:scale-95 sm:bottom-28"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-44 right-4 z-[90] flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-2xl backdrop-blur sm:bottom-48">
          <div className="flex items-center gap-2 border-b border-border/60 bg-primary/10 px-4 py-3">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Assistente MSK</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-border/60 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida..."
              className="h-10"
              maxLength={1000}
            />
            <Button type="submit" size="icon" className="h-10 w-10" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
