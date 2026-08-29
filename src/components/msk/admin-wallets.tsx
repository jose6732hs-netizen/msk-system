import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Wallet, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard";
import { Money } from "@/components/msk/money";

type AffiliateRow = {
  id: string;
  user_id: string;
  code: string;
  status: string;
  available_balance: number | null;
  pending_balance: number | null;
  total_commission: number | null;
  total_paid: number | null;
};

type WalletRow = {
  id: string;
  affiliate_id: string;
  available_balance: number;
  pending_balance: number;
  requested_balance: number;
  total_earned: number;
  total_withdrawn: number;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
};

type AdminWalletRow = {
  id: string;
  affiliate_id: string;
  code: string;
  name: string;
  email: string;
  status: string;
  available_balance: number;
  pending_balance: number;
  requested_balance: number;
  total_earned: number;
  total_withdrawn: number;
  has_wallet_record: boolean;
  updated_at: string | null;
};

type AdminWithdrawalRow = {
  id: string;
  affiliate_id: string;
  wallet_id: string;
  name: string;
  email: string;
  code: string;
  amount: number;
  pix_key: string;
  pix_key_type: string;
  status: string;
  requested_at: string;
  paid_at: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  admin_note: string | null;
};

async function loadProfilesByIds(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const rows: ProfileRow[] = [];

  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,name,email")
      .in("id", ids.slice(i, i + 200));

    if (error) throw new Error(`Erro ao buscar perfis: ${error.message}`);
    rows.push(...((data ?? []) as ProfileRow[]));
  }

  return rows;
}

/**
 * Fonte administrativa de carteiras.
 *
 * Não usa join aninhado do PostgREST: em alguns ambientes a relação
 * affiliates.user_id -> profiles.id não existe como FK e o join derruba a
 * consulta inteira. Aqui cada tabela é lida separadamente e relacionada por ID.
 *
 * Também inclui afiliados que possuem saldo real na tabela affiliates mas ainda
 * não têm linha espelhada em affiliate_wallets. Isso evita esconder dinheiro
 * real do painel administrativo.
 */
export const adminWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const [walletResult, affiliateResult] = await Promise.all([
      supabaseAdmin
        .from("affiliate_wallets")
        .select("id,affiliate_id,available_balance,pending_balance,requested_balance,total_earned,total_withdrawn,created_at,updated_at")
        .order("total_earned", { ascending: false }),
      supabaseAdmin
        .from("affiliates")
        .select("id,user_id,code,status,available_balance,pending_balance,total_commission,total_paid")
        .order("created_at", { ascending: false }),
    ]);

    if (walletResult.error) {
      throw new Error(`Erro ao buscar affiliate_wallets: ${walletResult.error.message}`);
    }
    if (affiliateResult.error) {
      throw new Error(`Erro ao buscar afiliados: ${affiliateResult.error.message}`);
    }

    const wallets = (walletResult.data ?? []) as WalletRow[];
    const affiliates = (affiliateResult.data ?? []) as AffiliateRow[];
    const profiles = await loadProfilesByIds(affiliates.map((a) => a.user_id));

    const affiliateById = new Map(affiliates.map((a) => [a.id, a]));
    const walletByAffiliate = new Map(wallets.map((w) => [w.affiliate_id, w]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    // União real das duas fontes. Se affiliate_wallets estiver incompleta, o
    // saldo que já existe em affiliates continua visível no Super Admin.
    const affiliateIds = new Set<string>([
      ...affiliates.map((a) => a.id),
      ...wallets.map((w) => w.affiliate_id),
    ]);

    const rows: AdminWalletRow[] = [...affiliateIds].map((affiliateId) => {
      const affiliate = affiliateById.get(affiliateId);
      const wallet = walletByAffiliate.get(affiliateId);
      const profile = affiliate ? profileById.get(affiliate.user_id) : undefined;

      return {
        id: wallet?.id ?? `affiliate:${affiliateId}`,
        affiliate_id: affiliateId,
        code: affiliate?.code ?? "—",
        name: profile?.name || "Afiliado",
        email: profile?.email || "—",
        status: affiliate?.status ?? "unknown",
        available_balance: Number(wallet?.available_balance ?? affiliate?.available_balance ?? 0),
        pending_balance: Number(wallet?.pending_balance ?? affiliate?.pending_balance ?? 0),
        requested_balance: Number(wallet?.requested_balance ?? 0),
        total_earned: Number(wallet?.total_earned ?? affiliate?.total_commission ?? 0),
        total_withdrawn: Number(wallet?.total_withdrawn ?? affiliate?.total_paid ?? 0),
        has_wallet_record: Boolean(wallet),
        updated_at: wallet?.updated_at ?? null,
      };
    });

    rows.sort((a, b) => b.total_earned - a.total_earned || b.available_balance - a.available_balance);

    return {
      wallets: rows,
      diagnostics: {
        affiliateWalletRows: wallets.length,
        affiliateRows: affiliates.length,
        returnedRows: rows.length,
      },
    };
  });

export const adminWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: withdrawals, error } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .select("id,affiliate_id,wallet_id,amount,pix_key,pix_key_type,status,requested_at,paid_at,approved_at,cancelled_at,admin_note")
      .order("requested_at", { ascending: false });

    if (error) throw new Error(`Erro ao buscar saques: ${error.message}`);

    const raw = (withdrawals ?? []) as any[];
    const affiliateIds = [...new Set(raw.map((w) => String(w.affiliate_id)).filter(Boolean))];

    let affiliates: AffiliateRow[] = [];
    if (affiliateIds.length) {
      const { data, error: affiliateError } = await supabaseAdmin
        .from("affiliates")
        .select("id,user_id,code,status,available_balance,pending_balance,total_commission,total_paid")
        .in("id", affiliateIds);
      if (affiliateError) throw new Error(`Erro ao buscar afiliados dos saques: ${affiliateError.message}`);
      affiliates = (data ?? []) as AffiliateRow[];
    }

    const profiles = await loadProfilesByIds(affiliates.map((a) => a.user_id));
    const affiliateById = new Map(affiliates.map((a) => [a.id, a]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const rows: AdminWithdrawalRow[] = raw.map((w) => {
      const affiliate = affiliateById.get(String(w.affiliate_id));
      const profile = affiliate ? profileById.get(affiliate.user_id) : undefined;
      return {
        ...w,
        amount: Number(w.amount ?? 0),
        name: profile?.name || "Afiliado",
        email: profile?.email || "—",
        code: affiliate?.code ?? "—",
      } as AdminWithdrawalRow;
    });

    return rows;
  });

export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; action: "approve" | "reject"; reason?: string | null }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { id, action, reason } = data;
    const { data: withdrawal, error: loadError } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .select("*")
      .eq("id", id)
      .single();

    if (loadError) throw new Error(loadError.message);
    if (!withdrawal) throw new Error("Saque não encontrado");
    if (String(withdrawal.status).toLowerCase() !== "pending") throw new Error("Saque já processado");

    const now = new Date().toISOString();
    const status = action === "approve" ? "paid" : "rejected";
    const patch = action === "approve"
      ? {
          status,
          approved_at: now,
          paid_at: now,
          admin_id: context.userId,
          admin_note: reason || null,
          updated_at: now,
        }
      : {
          status,
          cancelled_at: now,
          admin_id: context.userId,
          admin_note: reason || null,
          updated_at: now,
        };

    const { error } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .update(patch as never)
      .eq("id", id);

    if (error) throw new Error(error.message);

    // Se rejeitado, devolve o saldo reservado para a carteira real.
    if (action === "reject") {
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("affiliate_wallets")
        .select("available_balance,requested_balance")
        .eq("id", withdrawal.wallet_id)
        .maybeSingle();

      if (walletError) throw new Error(walletError.message);

      if (wallet) {
        const amount = Number(withdrawal.amount ?? 0);
        const before = Number(wallet.available_balance ?? 0);
        const nextBalance = before + amount;
        const nextRequested = Math.max(0, Number(wallet.requested_balance ?? 0) - amount);

        const { error: updateWalletError } = await supabaseAdmin
          .from("affiliate_wallets")
          .update({
            available_balance: nextBalance,
            requested_balance: nextRequested,
            updated_at: now,
          } as never)
          .eq("id", withdrawal.wallet_id);

        if (updateWalletError) throw new Error(updateWalletError.message);

        const { error: ledgerError } = await supabaseAdmin.from("affiliate_wallet_transactions").insert({
          affiliate_id: withdrawal.affiliate_id,
          wallet_id: withdrawal.wallet_id,
          withdrawal_id: withdrawal.id,
          type: "adjustment",
          amount,
          balance_before: before,
          balance_after: nextBalance,
          description: `Estorno de saque rejeitado #${id}`,
          status: "completed",
        } as never);

        if (ledgerError) throw new Error(ledgerError.message);
      }
    }

    return { ok: true };
  });

function brl(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function AdminWalletsTab() {
  const load = useServerFn(adminWallets);
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-wallets"],
    queryFn: () => load(),
  });

  const wallets = data?.wallets ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return wallets;
    return wallets.filter((w) =>
      [w.name, w.email, w.code].some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [wallets, search]);

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="min-w-0">
            <p className="text-sm font-black text-red-300">Falha ao buscar as carteiras reais</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {(error as Error)?.message || "Erro desconhecido ao consultar o banco."}
            </p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-primary rounded-full" />
          <div>
            <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-foreground">Carteiras de Afiliados</h4>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {data?.diagnostics.returnedRows ?? 0} afiliados encontrados · {data?.diagnostics.affiliateWalletRows ?? 0} registros em affiliate_wallets
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, e-mail ou código..."
            className="pl-9"
          />
          {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.map((w) => (
          <div key={w.id} className="glass rounded-2xl p-4 border border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Wallet size={20} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-sm text-white">{w.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{w.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[9px] text-muted-foreground uppercase font-black">{w.code}</span>
                  {!w.has_wallet_record && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase text-amber-300">
                      saldo vindo de affiliates
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-right sm:grid-cols-4">
              <div>
                <p className="text-[9px] font-bold uppercase text-white/40">Disponível</p>
                <p className="text-sm font-black text-primary"><Money value={w.available_balance} /></p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase text-white/40">Pendente</p>
                <p className="text-sm font-black text-white"><Money value={w.pending_balance} /></p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase text-white/40">Total ganho</p>
                <p className="text-sm font-black text-white"><Money value={w.total_earned} /></p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase text-white/40">Sacado</p>
                <p className="text-sm font-black text-white"><Money value={w.total_withdrawn} /></p>
              </div>
            </div>
          </div>
        ))}

        {!filtered.length && wallets.length > 0 && (
          <p className="rounded-xl border border-border/40 p-5 text-xs text-muted-foreground italic">
            Nenhum resultado corresponde à busca atual.
          </p>
        )}

        {!wallets.length && (
          <div className="rounded-xl border border-border/40 p-5">
            <p className="text-xs text-muted-foreground italic">
              O banco respondeu corretamente, mas não existem registros em affiliate_wallets nem afiliados cadastrados para exibir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminWithdrawalsTab() {
  const qc = useQueryClient();
  const load = useServerFn(adminWithdrawals);
  const process = useServerFn(adminProcessWithdrawal);

  const { data: withdrawals, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: () => load(),
  });

  async function handleAction(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Motivo da rejeição:") : undefined;
    if (action === "reject" && reason === null) return;

    try {
      await process({ data: { id, action, reason: reason ?? null } });
      toast.success(action === "approve" ? "Saque aprovado!" : "Saque rejeitado.");
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["admin-wallets"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <p className="text-sm font-black text-red-300">Falha ao buscar solicitações de saque</p>
        <p className="mt-1 text-xs text-muted-foreground">{(error as Error)?.message}</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

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
            {withdrawals?.map((w) => (
              <tr key={w.id} className="group hover:bg-muted/5 transition-colors">
                <td className="p-4">
                  <p className="font-bold">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground">{w.email} · {w.code}</p>
                </td>
                <td className="p-4 font-black text-primary"><Money value={w.amount} /></td>
                <td className="p-4 font-mono text-xs">{w.pix_key}</td>
                <td className="p-4">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase",
                    w.status === "pending" ? "bg-yellow-500/20 text-yellow-500" :
                    w.status === "paid" ? "bg-green-500/20 text-green-500" :
                    "bg-red-500/20 text-red-500",
                  )}>
                    {w.status === "pending" ? "Pendente" : w.status === "paid" ? "Pago" : "Rejeitado"}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {w.status === "pending" && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="neon" className="h-7 text-[9px] font-black uppercase" onClick={() => handleAction(w.id, "approve")}>Aprovar</Button>
                      <Button size="sm" variant="destructive" className="h-7 text-[9px] font-black uppercase" onClick={() => handleAction(w.id, "reject")}>Rejeitar</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!withdrawals?.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs italic">
                  O banco respondeu corretamente e não há solicitações de saque registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
