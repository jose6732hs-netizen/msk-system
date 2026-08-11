import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resetAffiliateWithdrawalSecurity } from "@/lib/parceiro/wallet.functions";
import { Loader2, Save, Search, Users, Copy, ExternalLink, Calendar, Mail, Hash, ShieldCheck, ShieldAlert, BarChart3, Wallet, FileText, CheckCircle2, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  adminAdjustAffiliateBalance,
  adminAffiliates,
  adminSaveAffiliateGoals,
  adminSaveAppUrl,
  adminUpdateAffiliate,
  adminApproveAffiliateDocs,
} from "@/lib/admin-affiliates.functions";

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AdminAffiliatesTab() {
  const qc = useQueryClient();
  const load = useServerFn(adminAffiliates);
  const update = useServerFn(adminUpdateAffiliate);
  const adjust = useServerFn(adminAdjustAffiliateBalance);
  const saveGoals = useServerFn(adminSaveAffiliateGoals);
  const saveUrl = useServerFn(adminSaveAppUrl);

  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [goals, setGoals] = useState<Record<string, number> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-affiliates", term],
    queryFn: () => load({ data: { search: term } }),
  });

  const goalState = goals ?? (data?.goals as unknown as Record<string, number>) ?? null;
  const urlState = appUrl ?? data?.appUrl ?? "";

  async function run(fn: () => Promise<unknown>, message: string) {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["admin-affiliates"] });
      toast.success(message);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold uppercase tracking-widest text-white flex items-center gap-3">
          <Users className="text-primary" /> Gestão de Afiliados
        </h2>
        {data?.affiliates?.some((a: any) => a.verification_status === "PENDING") && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full animate-pulse">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-black uppercase text-primary">Solicitações Pendentes</span>
          </div>
        )}
      </div>

      <section className="rounded-xl border border-border/60 p-4">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Domínio da plataforma
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            className="max-w-md"
            placeholder="https://seudominio.com"
            value={urlState}
            onChange={(e) => setAppUrl(e.target.value)}
          />
          <Button variant="neon" onClick={() => run(() => saveUrl({ data: { url: urlState } }), "Domínio salvo")}>
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Todos os links de afiliado e páginas públicas usam este domínio.
        </p>
      </section>

      {goalState && (
        <section className="rounded-xl border border-border/60 p-4">
          <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Metas globais dos afiliados
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {(["balance", "commission", "sales", "referrals", "monthly"] as const).map((k) => (
              <label key={k} className="text-xs text-muted-foreground">
                {k}
                <Input
                  className="mt-1"
                  inputMode="decimal"
                  value={String(goalState[k] ?? 0)}
                  onChange={(e) => setGoals({ ...goalState, [k]: Number(e.target.value || 0) })}
                />
              </label>
            ))}
          </div>
          <Button
            className="mt-3"
            variant="neonOutline"
            onClick={() => run(() => saveGoals({ data: goalState as never }), "Metas salvas")}
          >
            Salvar metas
          </Button>
        </section>
      )}

      <section>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por código, nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setTerm(search)}
          />
          <Button variant="neonOutline" onClick={() => setTerm(search)}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {(data?.affiliates ?? []).map((a: Record<string, any>) => (
            <div key={a["id"]} className="space-y-3">
              <AffiliateRow
                affiliate={a}
                onUpdate={(patch) =>
                  run(
                    () => update({ data: { affiliateId: a["id"], ...patch } as never }),
                    "Afiliado atualizado",
                  )
                }
                onAdjust={(amount, reason) =>
                  run(
                    () => adjust({ data: { affiliateId: a["id"], amount, reason } }),
                    "Saldo ajustado",
                  )
                }
              />
              <div className="ml-16 mr-4 bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
                  <Users size={12} /> Últimos indicados por {a["name"]}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {a["referrals"]?.length ? a["referrals"].map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Users size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-white truncate">{r.name}</p>
                        <p className="text-[9px] text-white/40 truncate">{r.email}</p>
                      </div>
                    </div>
                  )) : <p className="text-[9px] text-white/20 italic">Nenhum indicado direto.</p>}
                </div>
              </div>
            </div>
          ))}
          {!data?.affiliates?.length && (
            <p className="text-sm text-muted-foreground">Nenhum afiliado encontrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function AffiliateRow({
  affiliate,
  onUpdate,
  onAdjust,
}: {
  affiliate: Record<string, any>;
  onUpdate: (patch: Record<string, unknown>) => void;
  onAdjust: (amount: number, reason: string) => void;
}) {
  const [rate, setRate] = useState(String(affiliate["commission_rate"] ?? ""));
  const [goal, setGoal] = useState(String(affiliate["goal_amount"] ?? ""));
  const [notes, setNotes] = useState(affiliate["notes"] ?? "");
  const [amount, setAmount] = useState("");
  const blocked = affiliate["status"] !== "active";
  const status = affiliate["status"] as string;

  const copyLink = () => {
    navigator.clipboard.writeText(affiliate["link"]);
    toast.success("Link copiado!");
  };

  return (
    <div className="rounded-xl border border-border/60 bg-black/20 p-5 transition-all hover:border-primary/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-white">{affiliate["name"]}</p>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  affiliate["is_online"] ? "bg-green-500 animate-pulse" : "bg-white/20"
                )} />
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                  blocked ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-500"
                )}>
                  {blocked ? "Bloqueado" : affiliate["is_online"] ? "Online" : "Offline"}
                </span>
              </div>
            </div>
            {affiliate["last_seen"] && (
              <p className="text-[9px] text-white/30 uppercase font-black tracking-tighter">
                Visto por último: {new Date(affiliate["last_seen"]).toLocaleString('pt-BR')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{affiliate["email"]}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1">
                <span className="text-[10px] font-bold text-primary">{affiliate["code"]}</span>
                <span className="text-[10px] text-white/40">{affiliate["link"]}</span>
              </div>
              <AffiliateProfileDialog affiliate={affiliate} />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right md:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase text-white/40">Cadastros</p>
            <p className="text-sm font-black text-white">{affiliate["signups_count"] ?? 0}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-white/40">Vendas (Qtd)</p>
            <p className="text-sm font-black text-green-400">{affiliate["customers_count"] ?? 0}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-white/40">Receita Total</p>
            <p className="text-sm font-black text-primary">{brl(affiliate["revenue_generated"])}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-white/40">Comissão Total</p>
            <p className="text-sm font-black text-white">{brl(affiliate["commission_generated"])}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-white/40">Saldo Disp.</p>
            <p className="text-sm font-black text-primary">{brl(affiliate["available_balance"])}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-white/40">Pendente</p>
            <p className="text-sm font-black text-yellow-500">{brl(affiliate["commission_pending"])}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-white/40">Total Pago</p>
            <p className="text-sm font-black text-white/80">{brl(affiliate["commission_paid"])}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-white/40">Conversão</p>
            <p className="text-sm font-black text-white">
              {affiliate["total_clicks"] > 0 
                ? ((Number(affiliate["customers_count"] || 0) / affiliate["total_clicks"]) * 100).toFixed(1)
                : 0}%
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 border-t border-white/5 pt-4 sm:grid-cols-5">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-white/40">Comissão %</label>
          <Input className="h-9" placeholder="30" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-white/40">Meta R$</label>
          <Input className="h-9" placeholder="1000" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-white/40">Notas</label>
          <Input className="h-9" placeholder="Observações..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button
            className="h-9 w-full"
            variant="neonOutline"
            onClick={() =>
              onUpdate({ commissionRate: Number(rate || 0), goalAmount: Number(goal || 0), notes })
            }
          >
            Salvar Regras
          </Button>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-white/40">Ajuste Manual</label>
          <Input
            className="h-9"
            placeholder="+/- R$"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            variant="glass"
            className="h-9 flex-1"
            disabled={!amount}
            onClick={() => {
              onAdjust(Number(amount), "Ajuste manual do administrador");
              setAmount("");
            }}
          >
            Aplicar
          </Button>
          <Button
            variant={blocked ? "neon" : "destructive"}
            className="h-9 flex-1 whitespace-normal leading-tight text-[11px] sm:text-xs"
            onClick={() => onUpdate({ status: blocked ? "active" : "blocked" })}
          >
            {blocked ? "Desbloquear" : "Bloquear"}
          </Button>
        </div>
        <div className="sm:col-span-5 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <span className="text-[10px] font-bold uppercase text-white/40">Segurança de saque</span>
          <Button
            variant="glass"
            className="h-9 whitespace-normal text-[11px] leading-tight"
            onClick={() => void resetSecurity(affiliate["id"], false)}
          >
            Liberar saque (zerar tentativas)
          </Button>
          <Button
            variant="glass"
            className="h-9 whitespace-normal text-[11px] leading-tight"
            onClick={() => void resetSecurity(affiliate["id"], true)}
          >
            Redefinir senha de saque
          </Button>
        </div>
      </div>
    </div>
  );
}

async function resetSecurity(affiliateId: string, clearPassword: boolean) {
  try {
    await resetAffiliateWithdrawalSecurity({ data: { affiliateId, clearPassword } });
    toast.success(
      clearPassword
        ? "Senha de saque redefinida — o parceiro pode criar uma nova."
        : "Saque liberado e tentativas zeradas.",
    );
  } catch (e) {
    toast.error((e as Error).message);
  }
}

function AffiliateProfileDialog({ affiliate }: { affiliate: Record<string, any> }) {
  const qc = useQueryClient();
  const approveDocs = useServerFn(adminApproveAffiliateDocs);
  const [busy, setBusy] = useState(false);

  async function handleDocAction(approve: boolean) {
    const reason = !approve ? window.prompt("Motivo da rejeição:") : undefined;
    if (!approve && reason === null) return;

    setBusy(true);
    try {
      await approveDocs({ data: { affiliateId: affiliate["id"], approve, reason: reason || undefined } });
      toast.success(approve ? "Documentos aprovados!" : "Documentos rejeitados.");
      qc.invalidateQueries({ queryKey: ["admin-affiliates"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const brl = (v: unknown) =>
    Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const copyLink = () => {
    navigator.clipboard.writeText(affiliate["link"]);
    toast.success("Link copiado!");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-primary">
          <ExternalLink className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl border-border/40 bg-[#0A0A0B] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-xl uppercase tracking-widest">
            <Users className="h-5 w-5 text-primary" />
            Perfil do Afiliado
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {/* Coluna 1: Info Básica */}
          <div className="space-y-6 md:col-span-1">
            <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-8 w-8" />
              </div>
              <h4 className="mt-4 font-bold text-white">{affiliate["name"]}</h4>
              <p className="text-sm text-muted-foreground">{affiliate["email"]}</p>
              <Badge className="mt-3" variant={affiliate["status"] === "active" ? "secondary" : "destructive"}>
                {affiliate["status"] === "active" ? "Ativo" : "Bloqueado"}
              </Badge>
            </div>

            <div className="space-y-3 rounded-xl border border-white/5 bg-white/5 p-4">
              <h5 className="text-[10px] font-bold uppercase text-white/40">Link de Indicação</h5>
              <div className="flex items-center gap-2 overflow-hidden rounded-md bg-black/40 p-2">
                <span className="truncate text-[10px] text-white/60">{affiliate["link"]}</span>
                <button onClick={copyLink} className="text-primary hover:text-primary/80">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Código:</span>
                <span className="font-bold text-primary">{affiliate["code"]}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Membro desde:</span>
                <span>{new Date(affiliate["created_at"]).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          </div>

          {/* Coluna 2 e 3: Métricas */}
          <div className="md:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <MetricCard 
                icon={<BarChart3 className="h-4 w-4 text-blue-400" />} 
                label="Cliques Brutos" 
                value={affiliate["total_clicks"]} 
              />
              <MetricCard 
                icon={<Users className="h-4 w-4 text-purple-400" />} 
                label="Indicações (Signups)" 
                value={affiliate["signups_count"]} 
              />
              <MetricCard 
                icon={<ShieldCheck className="h-4 w-4 text-green-400" />} 
                label="Vendas Convertidas" 
                value={affiliate["customers_count"]} 
              />
              <MetricCard 
                icon={<Hash className="h-4 w-4 text-yellow-400" />} 
                label="Taxa de Conversão" 
                value={`${affiliate["total_clicks"] > 0 ? ((Number(affiliate["customers_count"] || 0) / affiliate["total_clicks"]) * 100).toFixed(1) : 0}%`} 
              />
            </div>

            <div className="rounded-xl border border-white/5 bg-white/5 p-5">
              <h5 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <Wallet className="h-4 w-4 text-primary" />
                Financeiro
              </h5>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-white/40">Receita Gerada</p>
                  <p className="text-xl font-black text-white">{brl(affiliate["revenue_generated"])}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-white/40">Comissão Gerada</p>
                  <p className="text-xl font-black text-primary">{brl(affiliate["commission_generated"])}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-white/40">Saldo Disponível</p>
                  <p className="text-xl font-black text-green-400">{brl(affiliate["available_balance"])}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-white/40">Aguardando (Pendente)</p>
                  <p className="text-xl font-black text-yellow-500">{brl(affiliate["commission_pending"])}</p>
                </div>
              </div>
            </div>

            {affiliate["verification_status"] === "PENDING" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <h5 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
                  <FileText className="h-4 w-4" />
                  Verificação de Documentos
                </h5>
                <p className="text-xs text-white/60 mb-4">O afiliado enviou documentos para análise.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {(affiliate["documents"] || []).map((doc: any) => (
                    <div key={doc.id} className="space-y-2">
                      <p className="text-[10px] font-bold uppercase text-white/40">{doc.type}</p>
                      <div className="aspect-square rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center relative group/img">
                        {doc.file_path ? (
                          <>
                            <img src={`${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/public/affiliate-docs/${doc.file_path}`} className="w-full h-full object-cover" />
                            <a 
                              href={`${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/public/affiliate-docs/${doc.file_path}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <ExternalLink className="h-6 w-6 text-white" />
                            </a>
                          </>
                        ) : (
                          <FileText className="h-8 w-8 text-white/20" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="neon" 
                    className="flex-1 h-10 font-black text-[0.65rem] uppercase tracking-widest"
                    onClick={() => handleDocAction(true)}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                    Aprovar Tudo
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 h-10 font-black text-[0.65rem] uppercase tracking-widest"
                    onClick={() => handleDocAction(false)}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <X className="h-3 w-3 mr-2" />}
                    Rejeitar Tudo
                  </Button>
                </div>
              </div>
            )}

            {affiliate["notes"] && (
              <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                <h5 className="mb-2 text-[10px] font-bold uppercase text-white/40 text-left">Observações Internas</h5>
                <p className="text-sm text-white/70 italic">{affiliate["notes"]}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-white/40">{label}</p>
          <p className="text-lg font-black text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
