import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Clock, Copy, Eye, Gift, KeyRound, Loader2, Plus, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateToken, getTokenOverview, revealToken, startFreeTrial } from "@/lib/tokens.functions";
import { getProfileCompletion, saveTrialIdentity } from "@/lib/profile-completion.functions";
import { isValidCPF, isValidPhoneBR, maskDocument, maskPhone, onlyDigits } from "@/lib/br";
import { supabase } from "@/integrations/supabase/client";

function useHasSession() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => active && setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setHasSession(!!session));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return hasSession;
}

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  pending: "⏳ Aguardando ativação",
  active: "🟢 Ativo",
  expired: "🟡 Expirado",
  revoked: "🔴 Revogado",
  suspended: "🚫 Bloqueado",
};

function statusStyle(status: string) {
  if (status === "active") return "text-primary border-primary/40 bg-primary/10";
  if (status === "pending") return "text-amber-400 border-amber-400/40 bg-amber-400/10";
  if (status === "revoked" || status === "suspended") return "text-red-500 border-red-500/40 bg-red-500/10";
  if (status === "expired") return "text-yellow-500 border-yellow-500/40 bg-yellow-500/10";
  return "text-foreground border-border bg-muted/30";
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDuration(ms?: number | null) {
  if (!ms) return "Validade do plano";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} dia${days === 1 ? "" : "s"}`;
}

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
  const target = new Date(expiresAt).getTime();
  const diff = target - now;
  if (diff <= 0) return { expired: true, progress: 0, d: 0, h: 0, m: 0, s: 0 };

  let progress = 100;
  if (activatedAt) {
    const start = new Date(activatedAt).getTime();
    const total = Math.max(1, target - start);
    progress = Math.max(0, Math.min(100, ((target - now) / total) * 100));
  }
  const totalSeconds = Math.floor(diff / 1000);
  return {
    expired: false,
    progress,
    d: Math.floor(totalSeconds / 86400),
    h: Math.floor((totalSeconds % 86400) / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: totalSeconds % 60,
  };
}

function TimeDisplay({ value, label, danger }: { value: number; label: string; danger?: boolean }) {
  return (
    <div className="flex min-w-[3rem] flex-col items-center rounded-xl border border-white/5 bg-black/40 p-2 shadow-inner">
      <span className={`font-mono text-xl font-black leading-none ${danger ? "text-destructive" : "text-primary"}`}>
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[0.5rem] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export function TokenManager() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [tab, setTab] = useState("tokens");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ token: string; expires_at: string | null } | null>(null);
  const [trialPhone, setTrialPhone] = useState("");
  const [trialCpf, setTrialCpf] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wantsTrial =
      new URLSearchParams(window.location.search).get("tab") === "trial" ||
      localStorage.getItem("msk_open_trial") === "1";
    if (!wantsTrial) return;
    localStorage.removeItem("msk_open_trial");
    setTab("trial");
    setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  }, []);

  const qc = useQueryClient();
  const fetchOverview = useServerFn(getTokenOverview);
  const genFn = useServerFn(generateToken);
  const revealFn = useServerFn(revealToken);
  const trialFn = useServerFn(startFreeTrial);
  const completionFn = useServerFn(getProfileCompletion);
  const saveIdentityFn = useServerFn(saveTrialIdentity);
  const hasSession = useHasSession();

  const { data, isLoading } = useQuery({
    queryKey: ["token-overview"],
    queryFn: () => fetchOverview(),
    enabled: hasSession === true,
    retry: false,
    refetchInterval: hasSession === true ? 15_000 : false,
  });
  const { data: completion } = useQuery({
    queryKey: ["profile-completion"],
    queryFn: () => completionFn(),
    enabled: hasSession === true,
    retry: false,
  });

  useEffect(() => {
    if (completion?.phone && !trialPhone) setTrialPhone(maskPhone(completion.phone));
    if (completion?.document && !trialCpf) setTrialCpf(maskDocument(completion.document));
  }, [completion?.phone, completion?.document, trialPhone, trialCpf]);

  const now = useServerNow(data?.server_time);
  const allowance = data?.allowance;
  const trial = data?.trial;
  const tokens = useMemo(() => data?.tokens ?? [], [data]);
  const available = allowance?.available ?? 0;

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("TOKEN COPIADO");
  }

  async function onGenerate() {
    if (available <= 0) {
      window.location.href = "/planos";
      return;
    }
    setBusy(true);
    try {
      const res = await genFn();
      setFresh({ token: res.token, expires_at: null });
      toast.success("Token gerado. A validade começa na primeira ativação.");
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
    const phone = onlyDigits(trialPhone);
    const cpf = onlyDigits(trialCpf);
    if (!isValidPhoneBR(phone)) {
      toast.error("Informe um telefone válido com DDD.");
      return;
    }
    if (!isValidCPF(cpf)) {
      toast.error("Informe um CPF válido.");
      return;
    }

    setBusy(true);
    try {
      await saveIdentityFn({ data: { phone, cpf } });
      const res = await trialFn({ data: {} });
      setFresh({ token: res.token, expires_at: res.expires_at });
      toast.success("Licença FREE iniciada — 15 minutos.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["token-overview"] }),
        qc.invalidateQueries({ queryKey: ["profile-completion"] }),
      ]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="tokens" ref={sectionRef} className="glass rounded-[2rem] p-6 md:col-span-2 md:p-8 lg:col-span-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tokens"><KeyRound className="mr-2 h-4 w-4" /> Meus Tokens</TabsTrigger>
          <TabsTrigger value="trial"><Gift className="mr-2 h-4 w-4" /> Licença FREE</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Disponíveis" value={String(available)} />
                <Metric label="Utilizados" value={String(allowance?.used ?? 0)} />
                <Metric label="Total" value={String(allowance?.total ?? 0)} />
                <Metric label="Renovação" value={allowance?.renewal ? new Date(allowance.renewal).toLocaleDateString("pt-BR") : "—"} />
              </div>

              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button variant="neon" onClick={onGenerate} disabled={busy} className="w-full rounded-xl py-5 text-[0.7rem] font-black uppercase tracking-widest sm:w-auto">
                  {busy ? <Loader2 className="animate-spin" /> : <Plus />} Gerar token
                </Button>
                {available <= 0 ? <p className="text-[0.7rem] font-bold uppercase text-destructive">Escolha um plano para obter saldo de licenças.</p> : null}
              </div>

              {fresh && tab === "tokens" ? (
                <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Token</p>
                  <p className="mt-2 break-all font-mono text-lg text-primary">{fresh.token}</p>
                  <p className="mt-2 text-xs text-muted-foreground">A validade do plano começa quando o token for ativado na extensão.</p>
                  <Button size="sm" variant="neon" className="mt-3" onClick={() => copy(fresh.token)}><Copy /> Copiar</Button>
                </div>
              ) : null}

              <div className="mt-7 grid gap-3 md:grid-cols-2">
                {tokens.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground md:col-span-2">Nenhum token gerado ainda.</p>
                ) : tokens.map((t: any) => {
                  const left = remaining(now, t.expires_at, t.activated_at);
                  const isLifetime = t.status === "active" && !t.expires_at && !t.pending_duration_ms;
                  return (
                    <div key={t.id} className="rounded-[2rem] border border-white/10 bg-[#0F0F0F] p-6 transition hover:border-primary/40">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[0.55rem] font-black uppercase tracking-widest text-muted-foreground">{t.plan_name ?? t.plan ?? "Licença MSK"}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-primary">{t.preview}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[0.58rem] font-black uppercase ${statusStyle(t.status)}`}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/5 bg-black/30 p-4 text-xs">
                        <div>
                          <p className="text-[0.55rem] uppercase text-muted-foreground">Ativação</p>
                          <p className="mt-1 font-bold">{t.activated_at ? fmtDateTime(t.activated_at) : "Aguardando"}</p>
                        </div>
                        <div>
                          <p className="text-[0.55rem] uppercase text-muted-foreground">Expiração</p>
                          <p className="mt-1 font-bold">
                            {t.expires_at ? fmtDateTime(t.expires_at) : t.pending_duration_ms ? `Após ativar: ${fmtDuration(t.pending_duration_ms)}` : "Vitalício"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[0.55rem] uppercase text-muted-foreground">Dispositivos</p>
                          <p className="mt-1 font-bold">{t.active_devices ?? 0}/{t.max_devices ?? 1}</p>
                        </div>
                        <div>
                          <p className="text-[0.55rem] uppercase text-muted-foreground">Última validação</p>
                          <p className="mt-1 font-bold">{t.last_validation ? fmtDateTime(t.last_validation) : "—"}</p>
                        </div>
                      </div>

                      <div className="mt-5">
                        {t.status === "pending" ? (
                          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                            <p className="text-xs font-black uppercase text-amber-400">Aguardando ativação</p>
                            <p className="mt-1 text-xs text-muted-foreground">Ao colar o token na extensão começa a regressiva de {fmtDuration(t.pending_duration_ms)}.</p>
                          </div>
                        ) : t.status === "expired" || left?.expired ? (
                          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                            <p className="text-xs font-black uppercase text-red-500">Licença expirada</p>
                            <Button asChild variant="neon" size="sm" className="mt-3 w-full"><Link to="/planos">Adquirir nova licença</Link></Button>
                          </div>
                        ) : t.status === "revoked" || t.status === "suspended" ? (
                          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-black uppercase text-red-400">Acesso bloqueado</div>
                        ) : left ? (
                          <div className="space-y-3">
                            <p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">Tempo restante</p>
                            <div className="flex flex-wrap gap-2">
                              <TimeDisplay value={left.d} label="Dias" />
                              <TimeDisplay value={left.h} label="Hrs" />
                              <TimeDisplay value={left.m} label="Min" danger={left.d === 0 && left.h === 0 && left.m < 5} />
                              <TimeDisplay value={left.s} label="Seg" danger={left.d === 0 && left.h === 0 && left.m < 5} />
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/40">
                              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${left.progress}%` }} />
                            </div>
                          </div>
                        ) : isLifetime ? (
                          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs font-black uppercase text-primary">Licença vitalícia ativa</div>
                        ) : null}
                      </div>

                      {t.status !== "revoked" ? (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button size="sm" variant="ghost" onClick={() => onReveal(t.id)}><Eye /> Revelar</Button>
                          <Button size="sm" variant="neonOutline" onClick={() => copy(t.preview)}><Copy /> Copiar</Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="trial" className="mt-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-[#0F0F0F] p-6 shadow-2xl md:p-8">
            <p className="mb-4 text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted-foreground">LICENÇA FREE — TESTE</p>

            {trial?.state === "running" ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20"><Timer className="h-5 w-5 animate-pulse text-primary" /></div>
                  <p className="text-xl font-black uppercase text-white">Teste em andamento</p>
                </div>
                {(() => {
                  const diff = Math.max(0, new Date(trial.expires_at).getTime() - now);
                  const totalSeconds = Math.floor(diff / 1000);
                  return (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <TimeDisplay value={Math.floor(totalSeconds / 60)} label="Min" danger={totalSeconds < 300} />
                        <TimeDisplay value={totalSeconds % 60} label="Seg" danger={totalSeconds < 300} />
                      </div>
                      {fresh?.token ? (
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <p className="break-all font-mono text-lg font-bold text-primary">{fresh.token}</p>
                          <Button size="sm" variant="neon" className="mt-3 w-full" onClick={() => copy(fresh.token)}><Copy /> Copiar token</Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            ) : trial?.state === "used" ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3"><Clock className="h-6 w-6 text-destructive" /><p className="text-lg font-black uppercase">Teste diário esgotado</p></div>
                <p className="text-sm text-muted-foreground">Uma nova licença FREE pode ser liberada após o período de 24 horas.</p>
                <Button asChild variant="neon" className="w-full"><Link to="/planos">Ver planos</Link></Button>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <p className="text-lg font-black uppercase text-white">15 minutos grátis</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Para evitar múltiplos testes, a licença FREE exige telefone e CPF válidos. Os dados ficam vinculados à sua conta.
                  </p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="trial-phone">Telefone / WhatsApp</Label>
                      <Input id="trial-phone" inputMode="tel" placeholder="(11) 99999-9999" value={trialPhone} onChange={(e) => setTrialPhone(maskPhone(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="trial-cpf">CPF</Label>
                      <Input id="trial-cpf" inputMode="numeric" placeholder="000.000.000-00" value={trialCpf} onChange={(e) => setTrialCpf(maskDocument(e.target.value))} />
                    </div>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button variant="neon" className="h-14 w-full rounded-2xl text-[0.7rem] font-black uppercase tracking-[0.15em]" onClick={onTrial} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Gift className="mr-2 h-4 w-4" />} Gerar licença FREE
                  </Button>
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">O controle do teste é feito no servidor por conta, telefone, CPF e outros sinais antifraude.</p>
        </TabsContent>
      </Tabs>
    </section>
  );
}
