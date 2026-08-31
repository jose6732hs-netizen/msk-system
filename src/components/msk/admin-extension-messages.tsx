import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquareText, Send, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extensionRemoteAdminSendMessage } from "@/lib/extension-remote-admin.functions";
import {
  extensionGlobalBroadcastMessage,
  extensionGlobalMessageRecipients,
} from "@/lib/extension-global-message.functions";

type Target = "specific" | "all";
type Severity = "info" | "success" | "warning" | "critical";

export function AdminExtensionMessages() {
  const qc = useQueryClient();
  const recipientsFn = useServerFn(extensionGlobalMessageRecipients);
  const sendOneFn = useServerFn(extensionRemoteAdminSendMessage);
  const sendAllFn = useServerFn(extensionGlobalBroadcastMessage);
  const [target, setTarget] = useState<Target>("specific");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("Mensagem da MSK");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");
  const [sending, setSending] = useState(false);

  const recipients = useQuery({
    queryKey: ["extension-message-recipients"],
    queryFn: () => recipientsFn(),
    refetchInterval: 30_000,
  });

  const clients = useMemo(() => {
    const rows = (recipients.data?.users ?? []) as any[];
    return [...rows].sort((a, b) =>
      String(a.email ?? "").localeCompare(String(b.email ?? ""), "pt-BR"),
    );
  }, [recipients.data]);

  const selected = clients.find((client) => client.user_id === userId) ?? null;
  const licensedUsers = Number(recipients.data?.licensedUsers ?? 0);
  const installationCount = Number(recipients.data?.installations ?? 0);

  async function submit() {
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    if (!cleanTitle || !cleanMessage) {
      toast.error("Preencha o título e a mensagem.");
      return;
    }
    if (target === "specific" && !userId) {
      toast.error("Escolha o usuário que receberá a mensagem.");
      return;
    }
    if (
      target === "all" &&
      !window.confirm(
        `Enviar esta mensagem para todos os ${licensedUsers} usuários com licença? Usuários offline receberão quando a extensão consultar o canal.`,
      )
    ) {
      return;
    }

    setSending(true);
    try {
      if (target === "all") {
        const result = await sendAllFn({
          data: { title: cleanTitle, message: cleanMessage, severity },
        });
        toast.success(
          `Mensagem global enfileirada para ${result.users} usuário${result.users === 1 ? "" : "s"}.`,
        );
      } else {
        const result = await sendOneFn({
          data: {
            userId,
            installationId: null,
            title: cleanTitle,
            message: cleanMessage,
            severity,
          },
        });
        const deliveries = Array.isArray(result.deliveries) ? result.deliveries.length : 0;
        toast.success(
          selected?.installations > 0
            ? `Mensagem enviada para ${selected.email} em ${deliveries || selected.installations} instalação(ões).`
            : `Mensagem enfileirada para ${selected?.email ?? "o usuário"}. Ela será entregue quando a extensão consultar o canal.`,
        );
      }
      setMessage("");
      qc.invalidateQueries({ queryKey: ["extension-message-recipients"] });
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-background to-background p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest">Mensagem para a extensão</h4>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Envie um aviso dentro da extensão para um cliente específico ou para todos os clientes que possuem licença. Mensagens para clientes offline ficam enfileiradas por até 7 dias.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-black/20 px-3 py-2 text-[0.62rem] font-bold uppercase tracking-widest text-muted-foreground">
          {recipients.isLoading
            ? "Carregando..."
            : `${licensedUsers} com licença · ${installationCount} instalações online/registradas`}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={target === "specific" ? "neon" : "outline"}
          onClick={() => setTarget("specific")}
        >
          <UserRound className="mr-2 h-4 w-4" /> Usuário específico
        </Button>
        <Button
          type="button"
          size="sm"
          variant={target === "all" ? "neon" : "outline"}
          onClick={() => setTarget("all")}
        >
          <UsersRound className="mr-2 h-4 w-4" /> Enviar para todos
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {target === "specific" ? (
          <label className="space-y-2 text-[0.62rem] font-black uppercase tracking-widest text-muted-foreground">
            Cliente
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary/60"
            >
              <option value="">Selecione um usuário...</option>
              {clients.map((client) => (
                <option key={client.user_id} value={client.user_id}>
                  {client.name || "Cliente"} — {client.email || client.user_id}
                  {client.licensed ? " · licença" : " · sem licença"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
            O envio global cria uma mensagem por cliente com licença. Mesmo quem estiver offline agora poderá receber o aviso quando abrir ou reconectar a extensão dentro do prazo de 7 dias.
          </div>
        )}

        <label className="space-y-2 text-[0.62rem] font-black uppercase tracking-widest text-muted-foreground">
          Tipo do aviso
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity)}
            className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary/60"
          >
            <option value="info">Informação</option>
            <option value="success">Sucesso</option>
            <option value="warning">Aviso</option>
            <option value="critical">Urgente</option>
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block space-y-2 text-[0.62rem] font-black uppercase tracking-widest text-muted-foreground">
          Título
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            placeholder="Ex.: Atualização importante"
            className="normal-case tracking-normal"
          />
        </label>

        <label className="block space-y-2 text-[0.62rem] font-black uppercase tracking-widest text-muted-foreground">
          Mensagem
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Escreva a mensagem que aparecerá dentro da extensão..."
            className="w-full resize-y rounded-xl border border-border/60 bg-background px-3 py-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.65rem] text-muted-foreground">
          {target === "all"
            ? `Destino: todos os ${licensedUsers} clientes com licença.`
            : selected
              ? `Destino: ${selected.email} · ${selected.installations} instalação(ões) registrada(s)${selected.licensed ? " · com licença" : " · sem licença ativa/cadastrada"}`
              : "Escolha um cliente para habilitar o envio individual."}
        </p>
        <Button
          type="button"
          variant="neon"
          disabled={sending || !message.trim() || !title.trim() || (target === "specific" && !userId)}
          onClick={submit}
        >
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {target === "all" ? "Enviar para todos" : "Enviar mensagem"}
        </Button>
      </div>
    </section>
  );
}
