import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Mail, Loader2, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminEmailBroadcastOverview,
  adminSendWhatsappOutageBroadcast,
} from "@/lib/admin-email.functions";

const DEFAULT_WHATSAPP = "64999117113";

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
  const sendFn = useServerFn(adminSendWhatsappOutageBroadcast);
  const [newWhatsapp, setNewWhatsapp] = useState(DEFAULT_WHATSAPP);
  const [subject, setSubject] = useState("Aviso importante: novo canal de atendimento MSK SISTEM");
  const [sending, setSending] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-email-broadcast"],
    queryFn: () => overviewFn(),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (data?.defaultSubject) setSubject(data.defaultSubject);
  }, [data?.defaultSubject]);

  async function sendBroadcast() {
    if (!data?.configured) {
      toast.error("Configure o domínio/remetente e a chave do Resend antes do disparo.");
      return;
    }
    const count = data.eligibleRecipients ?? 0;
    if (!count) {
      toast.error("Nenhum cliente com e-mail válido encontrado.");
      return;
    }
    const confirmed = window.confirm(
      `Enviar este aviso por e-mail para ${count} cliente${count === 1 ? "" : "s"}? O sistema impede envio duplicado desta campanha.`,
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const result = await sendFn({ data: { newWhatsapp, subject } });
      if (result.alreadySent) {
        toast.info("Esse comunicado já foi enviado para essa campanha e não será duplicado.");
      } else if (result.status === "completed") {
        toast.success(`Comunicado enviado para ${result.sentCount} cliente${result.sentCount === 1 ? "" : "s"}.`);
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
    <div className="mt-6 space-y-5">
      <div className="rounded-3xl border border-[#39ff14]/25 bg-[#07110a] p-5 shadow-[0_0_30px_-18px_rgba(57,255,20,0.55)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#39ff14]/30 bg-[#39ff14]/10 text-[#7cff67]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-white">Comunicado por e-mail</p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Envia para os clientes cadastrados o aviso de indisponibilidade do WhatsApp principal e o novo número de suporte. Administradores são excluídos do disparo.
              </p>
            </div>
          </div>

          <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${data?.configured ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}>
            {data?.configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
            {data?.configured ? "E-mail pronto" : "Aguardando domínio"}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />Carregando configuração…</div>
        ) : error ? (
          <p className="mt-5 text-xs text-red-300">{(error as Error).message}</p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clientes elegíveis</p>
              <p className="mt-1 text-2xl font-black text-[#7cff67]">{data?.eligibleRecipients ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4 sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Remetente</p>
              <p className="mt-1 truncate text-sm font-bold text-white">{data?.fromEmail || "Configure MSK_EMAIL_FROM"}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Provedor: {data?.provider || "Resend"} · chave {data?.hasApiKey ? "configurada" : "não configurada"}</p>
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-4">
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Novo WhatsApp de suporte</span>
            <Input value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} placeholder="64999117113" className="border-white/10 bg-black/30" />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assunto do e-mail</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} className="border-white/10 bg-black/30" />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-white/8 bg-black/25 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#7cff67]">Prévia da mensagem</p>
          <p className="mt-3 text-sm font-bold text-white">Nosso WhatsApp principal está temporariamente indisponível.</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Devido ao alto volume de mensagens recebidas, o número principal ficou indisponível. O cliente recebe o novo número, um botão direto para o WhatsApp e a informação de que a extensão MSK SISTEM continua funcionando normalmente.
          </p>
        </div>

        {!data?.configured && (
          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-relaxed text-amber-100/80">
            Depois de verificar seu domínio no Resend, configure no servidor <b>RESEND_API_KEY</b> e <b>MSK_EMAIL_FROM</b> (ex.: <b>MSK SISTEM &lt;suporte@seudominio.com&gt;</b>). A chave nunca é enviada ao navegador.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-[#7cff67]" />
            Proteção contra disparo duplicado ativa
          </div>
          <Button variant="neon" disabled={sending || !data?.configured || !(data?.eligibleRecipients ?? 0)} onClick={sendBroadcast} className="min-w-[210px]">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {sending ? "Enviando…" : "Enviar para clientes"}
          </Button>
        </div>
      </div>

      {!!data?.campaigns?.length && (
        <div className="rounded-3xl border border-border/50 bg-black/15 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-widest">Histórico de comunicados</p>
          <div className="mt-4 space-y-2">
            {data.campaigns.map((campaign) => (
              <div key={campaign.id} className="grid gap-3 rounded-2xl border border-white/5 bg-black/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{campaign.subject}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">WhatsApp: {campaign.new_whatsapp} · {campaign.sent_count}/{campaign.target_count} enviados{campaign.failed_count ? ` · ${campaign.failed_count} falhas` : ""}</p>
                </div>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusClass(campaign.status)}`}>{statusLabel(campaign.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
