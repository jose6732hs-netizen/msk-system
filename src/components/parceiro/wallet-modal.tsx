import React, { useState } from "react";
import {
  ArrowUpRight,
  CreditCard,
  History,
  Lock,
  Plus,
  Settings,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PixKeyForm } from "./pix-form";
import { WithdrawalPasswordModal } from "./password-modal";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAffiliateWalletStatus,
  requestAffiliateWithdrawal,
} from "@/lib/parceiro/wallet.functions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  pendingBalance: number;
  pixKey?: string;
  pixKeyType?: string;
  hasPassword?: boolean;
}

export function WalletModal({
  isOpen,
  onClose,
  balance,
  pendingBalance,
  pixKey,
  pixKeyType,
  hasPassword,
}: WalletModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const loadStatus = useServerFn(getAffiliateWalletStatus);
  const withdraw = useServerFn(requestAffiliateWithdrawal);
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["affiliate-wallet-status"],
    queryFn: () => loadStatus({}),
    enabled: isOpen,
  });

  const passwordSet = status?.hasPassword ?? hasPassword ?? false;
  const blocked = status?.blocked ?? false;
  const savedPixKey = status?.pixKey ?? pixKey ?? undefined;
  const savedPixType = status?.pixKeyType ?? pixKeyType ?? undefined;
  const minWithdrawal = status?.minWithdrawal ?? 29;

  async function submitWithdrawal() {
    const value = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(value) || value < minWithdrawal) {
      toast.error(`O valor mínimo para saque é R$ ${minWithdrawal},00.`);
      return;
    }
    if (password.length !== 6) {
      toast.error("Informe sua senha de saque de 6 dígitos.");
      return;
    }
    setSubmitting(true);
    try {
      await withdraw({ data: { amount: value, passwordHash: password } });
      toast.success("Saque solicitado! Aguarde a aprovação.");
      setAmount("");
      setPassword("");
      await qc.invalidateQueries({ queryKey: ["affiliate-wallet-status"] });
      await qc.invalidateQueries({ queryKey: ["affiliate-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
      setPassword("");
      await qc.invalidateQueries({ queryKey: ["affiliate-wallet-status"] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl overflow-hidden rounded-[1.5rem] border-white/10 bg-[#0F0F0F] p-0 text-white sm:w-[calc(100vw-2rem)] sm:rounded-[2rem]">
        <div className="flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col sm:max-h-[90dvh]">
          <div className="shrink-0 px-4 pb-3 pt-5 sm:px-8 sm:pb-4 sm:pt-8">
            <div className="min-w-0 pr-8">
              <DialogTitle className="break-words text-xl font-bold tracking-tight sm:text-2xl">
                Minha Carteira
              </DialogTitle>
              <DialogDescription className="mt-1 break-words text-xs leading-relaxed text-white/40 sm:text-sm">
                Gerencie seus ganhos e solicitações de saque.
              </DialogDescription>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-8 sm:pb-8">
            <div className="group relative mb-5 min-h-[210px] w-full overflow-hidden rounded-[1.5rem] sm:mb-8 sm:aspect-[1.7/1] sm:min-h-0 sm:rounded-[2rem]">
              <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-gradient-to-br from-primary via-primary/80 to-purple-600 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-500 sm:group-hover:scale-[1.02]">
                <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
                <div className="absolute right-0 top-0 h-40 w-40 -mr-16 -mt-16 rounded-full bg-white/10 blur-3xl sm:h-64 sm:w-64 sm:-mr-20 sm:-mt-20" />

                <div className="relative flex h-full min-w-0 flex-col justify-between p-5 sm:p-8">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block break-words text-[9px] font-bold uppercase tracking-[0.16em] text-white/60 sm:text-[10px] sm:tracking-[0.2em]">
                        Status da Conta
                      </span>
                      <div className="mt-1 flex w-fit max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2 py-1">
                        <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-400" />
                        <span className="truncate text-[9px] font-bold uppercase text-white sm:text-[10px]">
                          Verificada
                        </span>
                      </div>
                    </div>
                    <CreditCard className="h-7 w-7 shrink-0 text-white/40 sm:h-8 sm:w-8" strokeWidth={1.5} />
                  </div>

                  <div className="min-w-0 py-3 sm:py-0">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/60 sm:text-[10px] sm:tracking-[0.2em]">
                      Saldo Disponível
                    </span>
                    <h3 className="mt-1 break-words text-2xl font-bold tracking-tighter drop-shadow-lg sm:text-4xl">
                      R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h3>
                  </div>

                  <div className="flex min-w-0 items-end justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block break-words text-[8px] font-bold uppercase tracking-[0.13em] text-white/60 sm:text-[10px] sm:tracking-[0.2em]">
                        Aguardando Aprovação
                      </span>
                      <span className="mt-1 block break-words text-sm font-bold sm:text-lg">
                        R$ {pendingBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1.5 sm:gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10">
                        <Smartphone size={14} className="text-white/60" />
                      </div>
                      <div className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10">
                        <ShieldCheck size={14} className="text-white/60" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
              <TabsList className="mb-5 grid h-auto min-h-12 w-full grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/5 p-1 sm:mb-6">
                <TabsTrigger
                  value="overview"
                  className="min-h-10 min-w-0 gap-1 rounded-lg px-1 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">Saque</span>
                </TabsTrigger>
                <TabsTrigger
                  value="pix"
                  className="min-h-10 min-w-0 gap-1 rounded-lg px-1 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">Chave PIX</span>
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="min-h-10 min-w-0 gap-1 rounded-lg px-1 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <Settings className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">Segurança</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0 min-w-0">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
                    <h4 className="mb-4 flex min-w-0 items-center gap-2 break-words font-bold">
                      Solicitar Retirada
                    </h4>
                    {blocked ? (
                      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center">
                        <Lock className="mx-auto mb-3 h-8 w-8 text-destructive" />
                        <p className="text-sm font-bold">Saques bloqueados</p>
                        <p className="mt-1 text-xs text-white/50">
                          A senha foi digitada incorretamente 3 vezes. Entre em contato com o suporte para liberar.
                        </p>
                      </div>
                    ) : status?.withdrawalSuccess ? (
                      <div className="animate-in zoom-in rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-center duration-500 sm:p-6">
                        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-green-500 sm:h-12 sm:w-12" />
                        <p className="text-lg font-bold">PARABÉNS!</p>
                        <p className="mt-1 text-sm text-white/80">
                          Seu saque foi solicitado com sucesso e já está em análise pela nossa equipe financeira.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-5 min-h-11 border-white/10 sm:mt-6"
                          onClick={() => qc.invalidateQueries({ queryKey: ["affiliate-wallet-status"] })}
                        >
                          Entendido
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {!savedPixKey ? (
                          <div className="space-y-4">
                            <p className="text-sm font-medium text-amber-400">
                              Antes de sacar, você precisa cadastrar sua chave PIX.
                            </p>
                            <PixKeyForm
                              onSaved={() => void qc.invalidateQueries({ queryKey: ["affiliate-wallet-status"] })}
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="mb-2 block text-xs text-white/40">
                                Valor do Saque (Mínimo R$ {minWithdrawal},00)
                              </label>
                              <Input
                                placeholder="0,00"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="h-12 border-white/10 bg-black/20 text-lg font-bold"
                              />
                            </div>
                            {passwordSet ? (
                              <div>
                                <label className="mb-2 block text-xs text-white/40">
                                  Senha de saque (6 dígitos)
                                </label>
                                <Input
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={6}
                                  autoComplete="off"
                                  value={password}
                                  disabled={submitting}
                                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
                                  className="h-12 border-white/10 bg-black/20 text-center text-lg font-bold tracking-[0.35em] disabled:opacity-50 sm:tracking-[0.5em]"
                                />
                                {!!status?.attempts && (
                                  <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-amber-400">
                                    {status.attempts} de 3 tentativas usadas
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                                <p className="mb-3 text-xs text-white/60">
                                  Você ainda não criou sua senha de segurança para saques.
                                </p>
                                <Button
                                  variant="neonOutline"
                                  className="min-h-11 w-full whitespace-normal text-xs"
                                  onClick={() => setActiveTab("settings")}
                                >
                                  Configurar Senha Agora
                                </Button>
                              </div>
                            )}

                            <Button
                              variant="neon"
                              className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 py-2 text-base font-bold leading-tight sm:text-lg"
                              disabled={submitting || !passwordSet}
                              onClick={() => void submitWithdrawal()}
                            >
                              {submitting ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : null}
                              <span className="min-w-0 break-words text-center">Solicitar Saque</span>
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <History size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold">Histórico de Saques</p>
                        <p className="break-words text-xs text-white/40">Veja suas últimas retiradas</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-white/40">
                      <ArrowUpRight size={18} />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pix" className="mt-0 min-w-0">
                <PixKeyForm
                  initialKey={savedPixKey}
                  initialType={savedPixType}
                  onSaved={() => void qc.invalidateQueries({ queryKey: ["affiliate-wallet-status"] })}
                />
              </TabsContent>

              <TabsContent value="settings" className="mt-0 min-w-0">
                <WithdrawalPasswordModal
                  isAlreadySet={passwordSet}
                  onSuccess={() => {
                    refetchStatus();
                    setActiveTab("overview");
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
