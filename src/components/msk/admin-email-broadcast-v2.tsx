import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Search,
  Send,
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
import { adminSearchEmailRecipients } from "@/lib/admin-email-search.functions";

type Recipient = {
  id: string;
  profileId?: string | null;
  email: string;
  name: string | null;
};

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
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(adminEmailBroadcastOverview);
  const searchRecipientsFn = useServerFn(adminSearchEmailRecipients);
  const sendFn = useServerFn(adminSendEmailCampaign);

  const [audience, setAudience] = useState<"all" | "single">("all");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [subject, setSubject] = useState("Comunicado importante — MSK SISTEM");
  const [title, setTitle] = useState("Uma atualização importante para você");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-email-broadcast"],
    queryFn: () => overviewFn(),
    refetchInterval: 20_000,
  });

  const normalizedSearch = recipientSearch.trim();
  const {
    data: recipientSearchData,
    isFetching: searchingRecipients,
    error: recipientSearchError,
  } = useQuery({
    queryKey: ["admin-email-recipient-search", normalizedSearch.toLocaleLowerCase("pt-BR")],
    queryFn: () => searchRecipientsFn({ data: { query: normalizedSearch, limit: 200 } }),
    enabled: audience === "single",
    staleTime: 15_000,
  });

  const visibleRecipients = (recipientSearchData?.recipients ?? data?.recipients ?? []) as Recipient[];
  const targetCount = audience === "all" ? data?.eligibleRecipients ?? 0 : selectedRecipient ? 1 : 0;
  const providerReady = !!data?.configured;
  const contentReady = subject.trim().length >= 3 && title.trim().length >= 2 && message.trim().length >= 2;
  const canSend = providerReady && targetCount > 0 && contentReady;
  const missingApiKey = data ? !data.hasApiKey : false;
  const missingFromEmail = data ? !data.fromEmail : false;

  async function sendCampaign() {
    if (!providerReady) {
      if (missingApiKey && missingFromEmail) {
        toast.error("Configure a API Key do Resend e o remetente verificado antes de enviar.");
      } else if (missingApiKey) {
        toast.error("A API Key do Resend ainda não está configurada.");
      } else if (missingFromEmail) {
        toast.error("O remetente verificado ainda não está configurado.");
      } else {
        toast.error("O provedor de e-mail ainda não está pronto para disparos.");
      }
      return;
    }

    if (audience === "single" && !selectedRecipient) {
      toast.error("Selecione um cliente na lista antes de enviar.");
      return;
    }

    if (!contentReady) {
      toast.error("Preencha assunto, título e mensagem antes de enviar.");
      return;
    }

    const destination =
      audience === "all"
        ? `${targetCount} cliente${targetCount === 1 ? "" : "s"}`
        : selectedRecipient?.name || selectedRecipient?.email || "o cliente selecionado";

    if (!window.confirm(`Enviar este e-mail para ${destination}?`)) return;

    setSending(true);
    try {
      const result = await sendFn({
        data: {
          audience,
          profileId: audience === "single" ? selectedRecipient?.id : undefined,
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

      await queryClient.invalidateQueries({ queryKey: ["admin-email-broadcast"] });
    } catch (sendError) {
      toast.error((sendError as Error).message || "Falha ao enviar e-mail.");
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
                  Escolha todos os clientes ou busque um destinatário específico por nome ou e-mail completo.
                </p>
              </div>
            </div>

            <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${providerReady ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}>
              {providerReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
              {providerReady ? "Disparos ativos" : "Configuração incompleta"}
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
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold">
                  <span className={data?.hasApiKey ? "text-emerald-300" : "text-amber-300"}>API Resend: {data?.hasApiKey ? "configurada" : "faltando"}</span>
                  <span className={data?.fromEmail ? "text-emerald-300" : "text-amber-300"}>Remetente: {data?.fromEmail ? "configurado" : "faltando"}</span>
                </div>
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
                  <p className="mt-1 text-xs text-muted-foreground">Buscar diretamente no cadastro por nome ou e-mail.</p>
                </button>
              </div>

              {audience === "single" && (
                <div className="mt-3 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selecionar cliente</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={recipientSearch}
                      onChange={(event) => setRecipientSearch(event.target.value)}
                      placeholder="Digite nome ou e-mail completo…"
                      className="border-white/10 bg-black/30 pl-9 pr-10"
                    />
                    {searchingRecipients && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
                  </div>

                  {recipientSearchError ? (
                    <p className="rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">{(recipientSearchError as Error).message}</p>
                  ) : null}

                  <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-2">
                    {searchingRecipients && !visibleRecipients.length ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Buscando clientes…
                      </div>
                    ) : visibleRecipients.length ? (
                      visibleRecipients.map((recipient) => {
                        const active = selectedRecipient?.id === recipient.id;
                        return (
                          <button
                            key={recipient.id}
                            type="button"
                            onClick={() => setSelectedRecipient(recipient)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-white/5"}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-white">{recipient.name || "Cliente"}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{recipient.email}</p>
                            </div>
                            {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-3 py-5 text-center text-xs text-muted-foreground">
                        Nenhum cliente encontrado para “{normalizedSearch}”.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                    <span>{recipientSearchData?.total ?? visibleRecipients.length} resultado(s)</span>
                    <span>Busca feita diretamente no cadastro</span>
                  </div>

                  {selectedRecipient && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground">
                      Selecionado: <strong className="text-white">{selectedRecipient.name || "Cliente"}</strong> · {selectedRecipient.email}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">2. Conteúdo do e-mail</p>
              <div className="mt-3 grid gap-4">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assunto</span>
                  <Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} className="border-white/10 bg-black/30" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título principal</span>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} className="border-white/10 bg-black/30" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mensagem</span>
                  <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={6000} rows={9} placeholder="Escreva a mensagem…" className="resize-y border-white/10 bg-black/30 leading-relaxed" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Texto personalizado para o disparo.</span>
                    <span>{message.length}/6000</span>
                  </div>
                </label>
              </div>
            </div>

            {!providerReady && !isLoading ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-xs leading-relaxed text-amber-200">
                A seleção de clientes está liberada, mas o envio só será habilitado quando a configuração do Resend estiver completa.
              </div>
            ) : null}

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
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#39ff14]/25 bg-[#07110a]">
              <div className="h-1 bg-primary" />
              <div className="p-5 sm:p-6">
                <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary">MSK SISTEM</span>
                <p className="mt-5 text-xs text-muted-foreground">Olá{audience === "single" && selectedRecipient?.name ? `, ${selectedRecipient.name}` : ""}.</p>
                <h3 className="mt-2 text-xl font-black leading-tight text-white">{title || "Título do e-mail"}</h3>
                <p className="mt-4 whitespace-pre-wrap text-xs leading-relaxed text-white/75">{message || "Sua mensagem aparecerá aqui."}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Histórico recente</p>
              <div className="mt-3 space-y-2">
                {(data?.campaigns ?? []).length ? (
                  data?.campaigns.map((campaign: any) => (
                    <div key={campaign.id} className="rounded-xl border border-white/5 bg-white/[.02] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-bold text-white">{campaign.subject}</p>
                          <p className="mt-1 text-[9px] text-muted-foreground">{campaign.sent_count}/{campaign.target_count} enviados</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase ${statusClass(campaign.status)}`}>{statusLabel(campaign.status)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-muted-foreground">Nenhum disparo registrado.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
