import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  adminEmailBroadcastOverview,
  adminSendEmailCampaign,
} from "@/lib/admin-email.functions";

function statusLabel(status: string) {
  if (status === "completed") return "Concluído";
  if (status === "partial") return "Parcial";
  if (status === "failed") return "Falhou";
  if (status === "sending") return "Enviando";
  return "Rascunho";
}

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "partial") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  if (status === "failed") return "border-red-400/30 bg-red-400/10 text-red-300";
  return "border-primary/30 bg-primary/10 text-primary";
}

export function AdminEmailBroadcast() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(adminEmailBroadcastOverview);
  const sendFn = useServerFn(adminSendEmailCampaign);
  const [audience, setAudience] = useState<"all" | "single">("all");
  const [profileId, setProfileId] = useState("");
  const [subject, setSubject] = useState("Comunicado importante — MSK SISTEM");
  const [title, setTitle] = useState("Uma atualização importante para você");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-email-broadcast"],
    queryFn: () => overviewFn(),
    refetchInterval: 20_000,
  });

  const selectedRecipient = data?.recipients?.find((recipient: any) => recipient.id === profileId);
  const targetCount = audience === "all" ? data?.eligibleRecipients ?? 0 : profileId ? 1 : 0;
  const canSend = !!data?.configured && targetCount > 0 && subject.trim().length >= 3 && title.trim().length >= 2 && message.trim().length >= 2;

  async function sendCampaign() {
    if (!data?.configured) {
      toast.error("O provedor de e-mail ainda não está pronto para disparos.");
      return;
    }
    if (audience === "single" && !profileId) {
      toast.error("Selecione o cliente que deve receber o e-mail.");
      return;
    }
    if (!canSend) {
      toast.error("Preencha assunto, título e mensagem antes de enviar.");
      return;
    }

    const destination = audience === "all"
      ? `${targetCount} cliente${targetCount === 1 ? "" : "s"}`
      : selectedRecipient?.name || selectedRecipient?.email || "o cliente selecionado";
    if (!window.confirm(`Enviar este e-mail para ${destination}?`)) return;

    setSending(true);
    try {
      const result = await sendFn({
        data: {
          audience,
          profileId: audience === "single" ? profileId : undefined,
          subject,
          title,
          message,
        },
      });

      if (result.status === "completed") {
        toast.success(`E-mail enviado para ${result.sentCount} destinatário${result.sentCount === 1 ? "" : "s"}.`);
      } else if (result.sentCount > 0) {
        toast.warning(`Envio parcial: ${result.sentCount} enviados e ${result.failedCount} com falha.`);
      } else {
        toast.error(result.error || "O provedor não confirmou nenhum envio.");
      }
      await qc.invalidateQueries({ queryKey: ["admin-email-broadcast"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[#39ff14]/25 bg-[#07110a] shadow-[0_0_30px_-18px_rgba(57,255,20,0.55)]">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#39ff14]/30 bg-[#39ff14]/10 text-[#7cff67]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-white">Central de e-mails</p>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  Crie comunicados profissionais, escolha todos os clientes ou um destinatário específico e acompanhe o histórico dos disparos.
                </p>
              </div>
            </div>

            <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${data?.configured ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}>
              {data?.configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
              {data?.configured ? "Disparos ativos" : "Configuração incompleta"}
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando configuração…
            </div>
          ) : error ? (
            <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-xs text-red-300">{(error as Error).message}</p>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clientes com e-mail</p>
                <p className="mt-1 text-2xl font-black text-[#7cff67]">{data?.eligibleRecipients ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4 md:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Remetente verificado</p>
                <p className="mt-1 truncate text-sm font-bold text-white">{data?.fromEmail || "Remetente não configurado"}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Provedor: {data?.provider || "Resend"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">1. Destinatários</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAudience("all")}
                  className={`rounded-2xl border p-4 text-left transition ${audience === "all" ? "border-primary/60 bg-primary/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                >
                  <Users className={`h-5 w-5 ${audience === "all" ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="mt-3 text-sm font-black text-white">Todos os clientes</p>
                  <p className="mt-1 text-xs text-muted-foreground">Enviar para todos os cadastros com e-mail válido.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAudience("single")}
                  className={`rounded-2xl border p-4 text-left transition ${audience === "single" ? "border-primary/60 bg-primary/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                >
                  <UserRound className={`h-5 w-5 ${audience === "single" ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="mt-3 text-sm font-black text-white">Cliente específico</p>
                  <p className="mt-1 text-xs text-muted-foreground">Escolher uma pessoa pelo nome ou e-mail.</p>
                </button>
              </div>

              {audience === "single" ? (
                <label className="mt-3 block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selecionar cliente</span>
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/50"
                  >
                    <option value="">Escolha um cliente…</option>
                    {(data?.recipients ?? []).map((recipient: any) => (
                      <option key={recipient.id} value={recipient.id}>
                        {recipient.name ? `${recipient.name} — ` : ""}{recipient.email}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">2. Conteúdo do e-mail</p>
              <div className="mt-3 grid gap-4">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assunto</span>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="Assunto que aparece na caixa de entrada" className="border-white/10 bg-black/30" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título principal</span>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Título em destaque dentro do e-mail" className="border-white/10 bg-black/30" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mensagem</span>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={6000} rows={9} placeholder="Escreva aqui a mensagem que o cliente receberá…" className="resize-y border-white/10 bg-black/30 leading-relaxed" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Texto personalizado para o disparo.</span>
                    <span>{message.length}/6000</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black text-white">Pronto para enviar</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Destino: {audience === "all" ? `${targetCount} cliente${targetCount === 1 ? "" : "s"}` : selectedRecipient ? `${selectedRecipient.name || "Cliente"} · ${selectedRecipient.email}` : "selecione um cliente"}
                </p>
              </div>
              <Button variant="neon" disabled={sending || !canSend} onClick={sendCampaign} className="min-w-[190px]">
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {sending ? "Enviando…" : "Enviar e-mail"}
              </Button>
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-5 xl:sticky xl:top-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#7cff67]">
              <Eye className="h-4 w-4" /> Prévia do cliente
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#39ff14]/25 bg-[#07110a] shadow-[0_0_35px_-24px_rgba(57,255,20,.7)]">
              <div className="h-1 bg-primary" />
              <div className="p-5 sm:p-6">
                <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-primary">MSK SISTEM</span>
                <p className="mt-5 text-xs text-white/60">{selectedRecipient?.name ? `Olá, ${selectedRecipient.name}.` : "Olá."}</p>
                <h5 className="mt-2 break-words text-xl font-black leading-tight text-white">{title.trim() || "Título do e-mail"}</h5>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/70">{message.trim() || "Sua mensagem aparecerá aqui exatamente como o cliente receberá."}</p>
                <div className="mt-6 border-t border-white/10 pt-4 text-[10px] leading-relaxed text-muted-foreground">
                  Você está recebendo esta mensagem porque possui cadastro na plataforma MSK SISTEM.
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-[#7cff67]" /> Envio feito somente pelo servidor
            </div>
          </aside>
        </div>
      </section>

      {!!data?.campaigns?.length && (
        <section className="rounded-3xl border border-border/50 bg-black/15 p-5 sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Histórico de e-mails</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Últimos disparos realizados pelo Super Admin.</p>
          </div>
          <div className="mt-4 space-y-2">
            {data.campaigns.map((campaign: any) => (
              <div key={campaign.id} className="grid gap-3 rounded-2xl border border-white/5 bg-black/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-bold text-white">{campaign.title || campaign.subject}</p>
                    <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase text-muted-foreground">
                      {campaign.audience === "single" ? "Individual" : "Todos"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">Assunto: {campaign.subject}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {campaign.sent_count}/{campaign.target_count} enviados{campaign.failed_count ? ` · ${campaign.failed_count} falhas` : ""} · {new Date(campaign.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusClass(campaign.status)}`}>
                  {statusLabel(campaign.status)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
