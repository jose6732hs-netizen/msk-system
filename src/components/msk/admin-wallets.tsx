import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Search, Wallet, DollarSign, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Server Functions
export const adminWallets = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: wallets } = await supabaseAdmin
      .from("affiliate_wallets")
      .select(`
        *,
        affiliates (
          id,
          code,
          profiles:user_id (name, email)
        )
      `)
      .order("total_earned", { ascending: false });
    return wallets;
  });

export const adminWithdrawals = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: withdrawals } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .select(`
        *,
        affiliates (
          id,
          profiles:user_id (name, email)
        )
      `)
      .order("created_at", { ascending: false });
    return withdrawals;
  });

export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; action: 'approve' | 'reject'; reason?: string }) => d)
  .handler(async ({ data }) => {
    const { id, action, reason } = data;
    const status = action === 'approve' ? 'paid' : 'rejected';
    
    const { data: withdrawal } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .select("*")
      .eq("id", id)
      .single();

    if (!withdrawal) throw new Error("Saque não encontrado");
    if (withdrawal.status !== 'pending') throw new Error("Saque já processado");

    const { error } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .update({ 
        status, 
        processed_at: new Date().toISOString(),
        rejection_reason: reason 
      } as never)
      .eq("id", id);

    if (error) throw error;

    // Se rejeitado, devolve o saldo
    if (action === 'reject') {
      const { data: wallet } = await supabaseAdmin
        .from("affiliate_wallets")
        .select("available_balance")
        .eq("id", withdrawal.wallet_id)
        .single();
      
      if (wallet) {
        await supabaseAdmin
          .from("affiliate_wallets")
          .update({ 
            available_balance: Number(wallet.available_balance) + Number(withdrawal.amount) 
          })
          .eq("id", withdrawal.wallet_id);
      }
    }

    return { ok: true };
  });

export function AdminWalletsTab() {
  const load = useServerFn(adminWallets);
  const { data: wallets, isLoading } = useQuery({
    queryKey: ["admin-wallets"],
    queryFn: () => load(),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-1 bg-primary rounded-full" />
        <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Carteiras de Afiliados</h4>
      </div>
      
      <div className="grid gap-4">
        {wallets?.map((w: any) => (
          <div key={w.id} className="glass rounded-2xl p-4 border border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Wallet size={20} />
              </div>
              <div>
                <p className="font-bold text-sm text-white">{w.affiliates?.profiles?.name || "Afiliado"}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-black">{w.affiliates?.code}</p>
              </div>
            </div>
            
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-[9px] font-bold uppercase text-white/40">Saldo Disponível</p>
                <p className="text-sm font-black text-primary">
                  {Number(w.available_balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase text-white/40">Total Ganho</p>
                <p className="text-sm font-black text-white">
                  {Number(w.total_earned).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminWithdrawalsTab() {
  const qc = useQueryClient();
  const load = useServerFn(adminWithdrawals);
  const process = useServerFn(adminProcessWithdrawal);
  
  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: () => load(),
  });

  async function handleAction(id: string, action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt("Motivo da rejeição:") : undefined;
    if (action === 'reject' && reason === null) return;
    
    try {
      await process({ data: { id, action, reason: reason || undefined } });
      toast.success(action === 'approve' ? "Saque aprovado!" : "Saque rejeitado.");
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["admin-wallets"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-1 bg-cyan-400 rounded-full" />
        <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Solicitações de Saque</h4>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[0.6rem] uppercase tracking-widest text-muted-foreground border-b border-border/50">
            <tr>
              <th className="p-4">Afiliado</th>
              <th className="p-4">Valor</th>
              <th className="p-4">Chave PIX</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {withdrawals?.map((w: any) => (
              <tr key={w.id} className="group hover:bg-muted/5 transition-colors">
                <td className="p-4 font-bold">{w.affiliates?.profiles?.name || "—"}</td>
                <td className="p-4 font-black text-primary">
                  {Number(w.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="p-4 font-mono text-xs">{w.pix_key}</td>
                <td className="p-4">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase",
                    w.status === 'pending' ? "bg-yellow-500/20 text-yellow-500" :
                    w.status === 'paid' ? "bg-green-500/20 text-green-500" :
                    "bg-red-500/20 text-red-500"
                  )}>
                    {w.status === 'pending' ? 'Pendente' : w.status === 'paid' ? 'Pago' : 'Rejeitado'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {w.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="neon" className="h-7 text-[9px] font-black uppercase" onClick={() => handleAction(w.id, 'approve')}>Aprovar</Button>
                      <Button size="sm" variant="destructive" className="h-7 text-[9px] font-black uppercase" onClick={() => handleAction(w.id, 'reject')}>Rejeitar</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!withdrawals?.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs italic">Nenhuma solicitação encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
