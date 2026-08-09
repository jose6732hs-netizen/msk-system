import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Eye, Gift, KeyRound, Loader2, Plus, Timer, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  generateToken,
  getTokenOverview,
  revealToken,
  startFreeTrial,
} from "@/lib/tokens.functions";
import { supabase } from "@/integrations/supabase/client";

/** Evita chamar serverFns protegidas antes da sessão existir (erro 401 / tela branca). */
function useHasSession() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return hasSession;
}

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  active: "🟢 Ativo",
  expired: "🟡 Expirado",
  revoked: "🔴 Revogado",
  suspended: "🚫 Bloqueado",
};

function statusStyle(status: string) {
  if (status === "active") return "text-primary border-primary/40 bg-primary/10";
  if (status === "available") return "text-foreground border-border bg-muted/30";
  if (status === "revoked") return "text-red-500 border-red-500/40 bg-red-500/10";
  return "text-destructive border-destructive/40 bg-destructive/10";
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "Vitalício";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Regressiva baseada no relógio do servidor (offset calculado na resposta da API). */
function useServerNow(serverTime?: string | null) {
  const offset = useRef(0);
  useEffect(() => {
    if (serverTime) offset.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return tick + offset.current;
}

function remaining(now: number, expiresAt?: string | null, activatedAt?: string | null) {
  if (!expiresAt) return null;
  const targetTime = new Date(expiresAt).getTime();
  const diff = targetTime - now;

  if (diff <= 0) return { expired: true, label: "EXPIRADO", progress: 0, time: { d: 0, h: 0, m: 0, s: 0 } };

  // Progresso baseado no tempo total (ativação até expiração)
  let progress = 0;
  if (activatedAt) {
    const startTime = new Date(activatedAt).getTime();
    const total = targetTime - startTime;
    const elapsed = now - startTime;
    progress = Math.max(0, Math.min(100, (1 - elapsed / total) * 100));
  }

  const sTotal = Math.floor(diff / 1000);
  const d = Math.floor(sTotal / 86400);
  const h = Math.floor((sTotal % 86400) / 3600);
  const m = Math.floor((sTotal % 3600) / 60);
  const s = sTotal % 60;

  const label = d > 0 
    ? `${d}d ${h}h ${m}m ${s}s` 
    : h > 0 
    ? `${h}h ${m}m ${s}s` 
    : `${m}m ${s}s`;

  return { expired: false, label, progress, time: { d, h, m, s } };
}

function TimeDisplay({ value, label, danger }: { value: number; label: string; danger?: boolean }) {
  return (
    <div className="flex min-w-[3rem] flex-col items-center rounded-xl border border-white/5 bg-black/40 p-2 shadow-inner">
      <span
        className={`font-mono text-xl font-black leading-none ${danger ? "text-destructive" : "text-primary"}`}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[0.5rem] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}


function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export function TokenManager() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getTokenOverview);
  const genFn = useServerFn(generateToken);
  const revealFn = useServerFn(revealToken);
  const trialFn = useServerFn(startFreeTrial);

  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ token: string; expires_at: string | null } | null>(null);

  const hasSession = useHasSession();
  const { data, isLoading } = useQuery({
    queryKey: ["token-overview"],
    queryFn: () => fetchOverview(),
    enabled: hasSession === true,
    retry: false,
    refetchInterval: hasSession === true ? 30000 : false,
  });

  const now = useServerNow(data?.server_time);
  const allowance = data?.allowance;
  const trial = data?.trial;
  const tokens = useMemo(() => data?.tokens ?? [], [data]);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("TOKEN COPIADO");
  }

  async function onGenerate() {
    if (available <= 0) {
      window.location.href = "https://ini-joy-maker.lovable.app/planos";
      return;
    }
    setBusy(true);
    try {
      const res = await genFn();
      const detail = tokens.find((t: any) => t.id === res.licenseId);
      setFresh({ token: res.token, expires_at: detail?.expires_at ?? null });
      toast.success("Token gerado com sucesso.");
      await qc.invalidateQueries({ queryKey: ["token-overview"] });
      await qc.invalidateQueries({ queryKey: ["account"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onReveal(id: string) {
    try {
      const res = await revealFn({ data: { licenseId: id } });
      if (res.token) await copy(res.token);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onTrial() {
    setBusy(true);
    try {
      const res = await trialFn({ data: {} });
      setFresh({ token: res.token, expires_at: res.expires_at });
      toast.success("Teste gratuito iniciado — 15 minutos.");
      await qc.invalidateQueries({ queryKey: ["token-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const available = allowance?.available ?? 0;

  return (
    <section className="glass rounded-2xl p-7 lg:col-span-2">
      <Tabs defaultValue="tokens">
        <TabsList>
          <TabsTrigger value="tokens">
            <KeyRound className="mr-2 h-4 w-4" /> Meus Tokens
          </TabsTrigger>
          <TabsTrigger value="trial">
            <Gift className="mr-2 h-4 w-4" /> Token de Teste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label="Disponíveis" value={String(available)} />
                <Metric label="Utilizados" value={String(allowance?.used ?? 0)} />
                <Metric label="Total" value={String(allowance?.total ?? 0)} />
                <Metric
                  label="Renovação"
                  value={
                    allowance?.renewal
                      ? new Date(allowance.renewal).toLocaleDateString("pt-BR")
                      : "—"
                  }
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button variant="neon" onClick={onGenerate} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Plus />} Gerar token
                </Button>
                {available <= 0 && (
                  <p className="text-sm text-destructive">
                    Nenhum token ativo ainda! Navegue pelo site e garanta o seu acesso premium.
                  </p>
                )}
              </div>

              {fresh && (
                <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Token
                  </p>
                  <p className="mt-2 break-all font-mono text-lg text-primary">{fresh.token}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Expira em: {fmtDateTime(fresh.expires_at)}
                  </p>
                  <Button size="sm" variant="neon" className="mt-3" onClick={() => copy(fresh.token)}>
                    <Copy /> Copiar
                  </Button>
                </div>
              )}

              <div className="mt-7 grid gap-3 md:grid-cols-2">
                {tokens.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground md:col-span-2">
                    Nenhum token gerado ainda.
                  </p>
                ) : (
                  tokens.map((t: any) => {
                    const left = remaining(now, t.expires_at, t.activated_at || t.created_at);
                    return (
                      <div
                        key={t.id}
                        className="group relative flex flex-col rounded-[2rem] border border-white/10 bg-[#0F0F0F] p-6 transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_40px_-10px_rgba(var(--primary-rgb),0.2)]"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted-foreground">Sua licença</h4>
                          <span
                            className={`rounded-full border px-3 py-1 text-[0.6rem] font-black uppercase tracking-widest ${statusStyle(t.status)}`}
                          >
                            {STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        </div>

                        <div className="relative mb-6 rounded-2xl border border-white/5 bg-black/40 p-5 group-hover:border-primary/20 transition-colors">
                          <p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground mb-3">Token de ativação</p>
                          {t.status === 'revoked' ? (
                            <div className="py-4 text-center">
                              <p className="text-sm font-bold text-red-500 uppercase tracking-tighter">Sua licença foi desativada</p>
                              <p className="mt-1 text-[0.6rem] text-muted-foreground uppercase">O acesso desta extensão foi desativado pelo administrador.</p>
                              <Button asChild variant="neon" size="sm" className="mt-4 w-full rounded-xl text-[0.6rem] font-black uppercase">
                                <Link to="/planos">Comprar nova licença</Link>
                              </Button>
                            </div>
                          ) : (
                            <>
                              <p className="break-all font-mono text-base font-bold text-primary tracking-tight leading-none mb-4">
                                {t.preview}
                              </p>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-9 px-4 rounded-xl border border-white/5 bg-white/5 text-[0.6rem] font-black uppercase tracking-widest hover:bg-white/10"
                                  onClick={() => onReveal(t.id)}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-2" /> Revelar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="neon" 
                                  className="h-9 px-4 rounded-xl text-[0.6rem] font-black uppercase tracking-widest shadow-lg shadow-primary/10"
                                  onClick={() => copy(t.preview)}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-2" /> Copiar
                                </Button>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-6">
                          <div>
                            <p className="text-[0.55rem] font-black uppercase tracking-widest text-muted-foreground mb-1">Plano</p>
                            <p className="text-xs font-bold text-white uppercase tracking-tight">{t.plan_name ?? "Licença MSK"}</p>
                          </div>
                          <div>
                            <p className="text-[0.55rem] font-black uppercase tracking-widest text-muted-foreground mb-1">Expira em</p>
                            <p className="text-xs font-bold text-white uppercase tracking-tight">{t.expires_at ? new Date(t.expires_at).toLocaleString("pt-BR") : "Vitalício"}</p>
                          </div>
                          <div>
                            <p className="text-[0.55rem] font-black uppercase tracking-widest text-muted-foreground mb-1">Ativada em</p>
                            <p className="text-xs font-bold text-white uppercase tracking-tight">{t.activated_at ? new Date(t.activated_at).toLocaleDateString("pt-BR") : "—"}</p>
                          </div>
                          <div>
                            <p className="text-[0.55rem] font-black uppercase tracking-widest text-muted-foreground mb-1">Última Validação</p>
                            <p className="text-xs font-bold text-white uppercase tracking-tight">{t.last_validation ? new Date(t.last_validation).toLocaleTimeString("pt-BR") : "—"}</p>
                          </div>
                          <div>
                            <p className="text-[0.55rem] font-black uppercase tracking-widest text-muted-foreground mb-1">Dispositivos Permitidos</p>
                            <p className="text-xs font-bold text-white">{t.max_devices ?? 1}</p>
                          </div>
                          <div>
                            <p className="text-[0.55rem] font-black uppercase tracking-widest text-muted-foreground mb-1">Dispositivos Ativos</p>
                            <p className="text-xs font-bold text-white">{t.active_devices ?? 0}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          {left ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-1.5">
                                <TimeDisplay value={left.time.d} label="Dias" danger={left.expired} />
                                <TimeDisplay value={left.time.h} label="Hrs" danger={left.expired} />
                                <TimeDisplay value={left.time.m} label="Min" danger={left.expired} />
                                <TimeDisplay value={left.time.s} label="Seg" danger={left.expired} />
                              </div>
                              <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-white/5 bg-black/40">
                                <div
                                  className={`h-full transition-all duration-1000 ease-linear ${
                                    left.expired ? "bg-destructive" : "bg-gradient-to-r from-primary/50 to-primary"
                                  }`}
                                  style={{ width: `${left.expired ? 100 : left.progress}%` }}
                                />
                              </div>
                              <p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">
                                {left.expired ? "Licença expirada" : `Restam ${left.label}`}
                              </p>
                            </div>
                          ) : (
                            <span className="inline-block rounded-full border border-white/5 bg-white/5 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                              Vitalício
                            </span>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </>
          )}
        </TabsContent>

        <TabsContent value="trial" className="mt-6">
          <div className="rounded-[2rem] border border-primary/20 bg-[#0F0F0F] p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -z-10" />
            
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Licença de Teste
            </p>

            {trial?.state === "running" ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                    <Timer className="h-5 w-5 text-primary animate-pulse" />
                   </div>
                   <p className="text-xl font-black uppercase tracking-tight text-white">
                    Teste em andamento
                   </p>
                </div>
                <div className="mt-4 space-y-4">
                  {(() => {
                    const diff = new Date(trial.expires_at).getTime() - now;
                    const total = 15 * 60 * 1000;
                    const progress = Math.max(0, Math.min(100, (diff / total) * 100));
                    const sTotal = Math.max(0, Math.floor(diff / 1000));
                    const m = Math.floor(sTotal / 60);
                    const s = sTotal % 60;
                    
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <TimeDisplay value={m} label="Minutos" danger={m < 5} />
                          <TimeDisplay value={s} label="Segundos" danger={m < 5} />
                          <div className="ml-auto text-right">
                             <p className="text-[0.6rem] text-muted-foreground uppercase font-black tracking-widest mb-1">Término previsto</p>
                             <p className="text-sm font-bold text-white">{new Date(trial.expires_at).toLocaleTimeString("pt-BR")}</p>
                          </div>
                        </div>
                        <div className="relative h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-primary/40 to-primary transition-all duration-1000 ease-linear shadow-[0_0_20px_rgba(var(--primary),0.8)]"
                            style={{ width: `${progress}%` }}
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:20px_20px] animate-[shimmer_2s_infinite_linear]" />
                        </div>
                        
                        {fresh?.token ? (
                          <div className="rounded-2xl border border-white/5 bg-black/40 p-5 mt-4">
                            <p className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground mb-2">Seu Token Temporário</p>
                            <div className="space-y-3">
                              <p className="break-all font-mono text-lg font-bold text-primary">{fresh.token}</p>
                              <Button size="sm" variant="neon" className="w-full" onClick={() => copy(fresh.token)}>
                                <Copy className="mr-2 h-4 w-4" /> Copiar Token
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center">Token ativo na sua conta. Use na extensão para testar.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : trial?.state === "used" ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-2xl bg-destructive/20 flex items-center justify-center text-destructive">
                    <Clock className="h-5 w-5" />
                   </div>
                   <div>
                    <p className="text-lg font-black uppercase tracking-tight text-white">
                      Teste diário esgotado
                    </p>
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                      Próximo trial free liberado em:
                    </p>
                   </div>
                </div>
                
                <div className="rounded-2xl border border-white/5 bg-black/20 p-6 text-center">
                   {(() => {
                     const target = new Date(trial.next_available_at!).getTime();
                     const diff = target - now;
                     const sTotal = Math.max(0, Math.floor(diff / 1000));
                     
                     if (sTotal <= 0) return <p className="text-xl font-black text-primary uppercase">Disponível agora!</p>;
                     
                     const h = Math.floor(sTotal / 3600);
                     const m = Math.floor((sTotal % 3600) / 60);
                     const s = sTotal % 60;
                     
                     return (
                       <div className="flex justify-center gap-2">
                         <TimeDisplay value={h} label="Horas" />
                         <TimeDisplay value={m} label="Minutos" />
                         <TimeDisplay value={s} label="Segundos" />
                       </div>
                     );
                   })()}
                   <p className="mt-4 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                     Você pode gerar uma nova licença de 15 min a cada 24h
                   </p>
                </div>
                
                <Button asChild variant="neon" className="w-full py-6 text-base shadow-xl">
                  <Link to="/planos">Remover Limites Agora</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex-1">
                  <p className="text-lg font-black uppercase tracking-tight text-white mb-2">Status: Disponível</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Experimente a potência total da MSK SISTEMe agora mesmo. Duração de 15 minutos, renovável a cada 24 horas.
                  </p>
                </div>
                <Button 
                  variant="neon" 
                  className="w-full sm:w-auto h-14 px-10 text-[0.7rem] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20" 
                  onClick={onTrial} 
                  disabled={busy}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Gift className="mr-2 h-4 w-4" />} Gerar Token de Teste
                </Button>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            O teste gratuito é independente do seu saldo de tokens pagos e é controlado pelo
            servidor — fechar a extensão, trocar de IP ou limpar dados não reinicia o tempo.
          </p>
        </TabsContent>
      </Tabs>
    </section>
  );
}
