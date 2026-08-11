import React, { useState } from "react";
import { 
  CreditCard, 
  ArrowUpRight, 
  Settings, 
  ShieldCheck, 
  Plus, 
  History,
  X,
  Lock,
  Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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
  hasPassword
}: WalletModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const loadStatus = useServerFn(getAffiliateWalletStatus);
  const withdraw = useServerFn(requestAffiliateWithdrawal);
  const { data: status } = useQuery({
    queryKey: ["affiliate-wallet-status"],
    queryFn: () => loadStatus({}),
    enabled: isOpen,
  });

  const passwordSet = status?.hasPassword ?? hasPassword ?? false;
  const blocked = status?.blocked ?? false;
  const savedPixKey = status?.pixKey ?? pixKey ?? undefined;
  const savedPixType = status?.pixKeyType ?? pixKeyType ?? undefined;

  async function submitWithdrawal() {
    const value = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(value) || value < 20) {
      toast.error("O valor mínimo para saque é R$ 20,00.");
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
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] bg-[#0F0F0F] border-white/10 text-white p-0 overflow-hidden rounded-[2rem]">
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header customizado */}
          <div className="p-8 pb-4 flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight">Minha Carteira</DialogTitle>
              <DialogDescription className="text-white/40">Gerencie seus ganhos e solicitações de saque.</DialogDescription>
            </div>
          </div>

          <div className="px-8 pb-8 overflow-y-auto custom-scrollbar">
            {/* 3D Credit Card Style Display */}
            <div className="relative w-full aspect-[1.7/1] mb-8 group perspective-1000">
               <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-purple-600 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-transform duration-500 group-hover:scale-[1.02] group-hover:rotate-x-2 group-hover:rotate-y-2">
                 {/* Glass overlay and pattern */}
                 <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                 
                 <div className="relative h-full p-8 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                       <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 mb-1">Status da Conta</span>
                          <div className="flex items-center gap-2 px-2 py-0.5 bg-white/10 rounded-full border border-white/20 w-fit">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                             <span className="text-[10px] font-bold uppercase text-white">Verificada</span>
                          </div>
                       </div>
                       <CreditCard className="text-white/40" size={32} strokeWidth={1.5} />
                    </div>

                    <div>
                       <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60">Saldo Disponível</span>
                       <h3 className="text-4xl font-bold tracking-tighter mt-1 drop-shadow-lg">
                          R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                       </h3>
                    </div>

                    <div className="flex justify-between items-end">
                       <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/60 mb-1">Aguardando Aprovação</span>
                          <span className="text-lg font-bold">R$ {pendingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                       </div>
                       <div className="flex gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                             <Smartphone size={14} className="text-white/60" />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                             <ShieldCheck size={14} className="text-white/60" />
                          </div>
                       </div>
                    </div>
                 </div>
               </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10 p-1 rounded-xl mb-6 h-12">
                <TabsTrigger value="overview" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                  <ArrowUpRight size={16} /> Saque
                </TabsTrigger>
                <TabsTrigger value="pix" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                  <Plus size={16} /> Chave PIX
                </TabsTrigger>
                <TabsTrigger value="settings" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                  <Settings size={16} /> Segurança
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0">
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6">
                    <h4 className="font-bold mb-4 flex items-center gap-2">Solicitar Retirada</h4>
                    {blocked ? (
                      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center">
                        <Lock className="mx-auto mb-3 h-8 w-8 text-destructive" />
                        <p className="text-sm font-bold">Saques bloqueados</p>
                        <p className="mt-1 text-xs text-white/50">
                          A senha foi digitada incorretamente 3 vezes. Entre em contato com o suporte para liberar.
                        </p>
                      </div>
                    ) : status?.withdrawalSuccess ? (
                      <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-6 text-center animate-in zoom-in duration-500">
                        <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-green-500" />
                        <p className="text-lg font-bold">PARABÉNS!</p>
                        <p className="mt-1 text-sm text-white/80">
                          Seu saque foi solicitado com sucesso e já está em análise pela nossa equipe financeira.
                        </p>
                        <Button 
                          variant="outline" 
                          className="mt-6 border-white/10" 
                          onClick={() => qc.invalidateQueries({ queryKey: ["affiliate-wallet-status"] })}
                        >
                          Entendido
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {!savedPixKey ? (
                          <div className="space-y-4">
                             <p className="text-sm text-amber-400 font-medium">
                               Antes de sacar, você precisa cadastrar sua chave PIX.
                             </p>
                             <PixKeyForm 
                               onSaved={() => void qc.invalidateQueries({ queryKey: ["affiliate-wallet-status"] })} 
                             />
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="text-xs text-white/40 block mb-2">Valor do Saque (Mínimo R$ 20,00)</label>
                              <Input
                                placeholder="0,00"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="bg-black/20 border-white/10 h-12 text-lg font-bold"
                              />
                            </div>
                            {passwordSet ? (
                              <div>
                                <label className="text-xs text-white/40 block mb-2">Senha de saque (6 dígitos)</label>
                                <Input
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={6}
                                  autoComplete="off"
                                  value={password}
                                  disabled={submitting}
                                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
                                  className="bg-black/20 border-white/10 h-12 text-center text-lg font-bold tracking-[0.5em] disabled:opacity-50"
                                />
                                {!!status?.attempts && (
                                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-400 text-center">
                                    {status.attempts} de 3 tentativas usadas
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                                <p className="text-xs text-white/60 mb-3">Você ainda não criou sua senha de segurança para saques.</p>
                                <Button variant="neonOutline" className="w-full h-10 text-xs" onClick={() => setActiveTab("settings")}>
                                  Configurar Senha Agora
                                </Button>
                              </div>
                            )}
                            
                            <Button
                              variant="neon"
                              className="w-full h-12 text-base sm:text-lg font-bold rounded-xl whitespace-normal py-2 px-4 leading-tight flex items-center justify-center min-h-[3rem]"
                              disabled={submitting || !passwordSet}
                              onClick={() => void submitWithdrawal()}
                            >
                              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : null}
                              <span className="truncate sm:whitespace-normal">Solicitar Saque</span>
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                           <History size={18} />
                        </div>
                        <div>
                           <p className="text-sm font-bold">Histórico de Saques</p>
                           <p className="text-xs text-white/40">Veja suas últimas retiradas</p>
                        </div>
                     </div>
                     <Button variant="ghost" size="icon" className="text-white/40"><ArrowUpRight size={18} /></Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pix" className="mt-0">
                <PixKeyForm initialKey={savedPixKey} initialType={savedPixType} onSaved={() => void qc.invalidateQueries({ queryKey: ["affiliate-wallet-status"] })} />
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <WithdrawalPasswordModal isAlreadySet={passwordSet} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
