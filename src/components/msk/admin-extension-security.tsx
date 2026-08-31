import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Ban, Loader2, MonitorSmartphone, RefreshCw, ShieldCheck, UnlockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  extensionRemoteAdminBlockInstallation,
  extensionRemoteAdminOverview,
} from "@/lib/extension-remote-admin.functions";

function when(value?: string | null) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("pt-BR"); } catch { return "—"; }
}

function shortDevice(value?: string | null) {
  const text = String(value || "");
  return text.length > 16 ? `…${text.slice(-12)}` : text || "—";
}

export function AdminExtensionSecurity() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(extensionRemoteAdminOverview);
  const blockFn = useServerFn(extensionRemoteAdminBlockInstallation);
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["extension-device-security"],
    queryFn: () => overviewFn(),
    refetchInterval: 15_000,
  });

  const installations = (query.data?.installations ?? []) as any[];
  const suspicious = (query.data?.suspicious ?? []) as any[];
  const blockedCount = installations.filter((row) => row.blocked === true).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [...installations].sort((a, b) => {
      const riskA = a.blocked ? 3 : a.suspicious ? 2 : 0;
      const riskB = b.blocked ? 3 : b.suspicious ? 2 : 0;
      if (riskA !== riskB) return riskB - riskA;
      return Date.parse(b.last_seen_at || "") - Date.parse(a.last_seen_at || "");
    });
    if (!q) return rows;
    return rows.filter((row) => [
      row.name, row.email, row.installation_id, row.ip_address, row.browser, row.os,
      row.suspicion_reason, row.block_reason,
    ].some((value) => String(value || "").toLowerCase().includes(q)));
  }, [installations, search]);

  const block = useMutation({
    mutationFn: async (row: any) => {
      const nextBlocked = !row.blocked;
      const reason = nextBlocked
        ? String(row.suspicion_reason || "Possível cópia/clone detectado pela segurança MSK.")
        : null;
      if (!window.confirm(nextBlocked
        ? `Bloquear o dispositivo ${shortDevice(row.installation_id)}? A extensão perderá acesso a comandos, GitHub e IA.`
        : `Liberar novamente o dispositivo ${shortDevice(row.installation_id)}?`)) {
        throw new Error("CANCELLED");
      }
      return blockFn({ data: { installationId: row.installation_id, blocked: nextBlocked, reason } });
    },
    onSuccess: (result) => {
      toast.success(result.blocked ? "Dispositivo bloqueado pela segurança MSK." : "Dispositivo liberado novamente.");
      qc.invalidateQueries({ queryKey: ["extension-device-security"] });
    },
    onError: (error: Error) => {
      if (error.message !== "CANCELLED") toast.error(error.message || "Não foi possível alterar o bloqueio.");
    },
  });

  return (
    <section className="rounded-[1.75rem] border border-red-500/20 bg-gradient-to-br from-red-500/[0.07] via-background to-background p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest">Segurança de dispositivos</h4>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Instalações com troca de chave criptográfica, ID da extensão, fingerprint ou integridade divergente aparecem como suspeitas. Bloqueie um dispositivo para cortar imediatamente comandos, GitHub e IA.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-black/20 p-4">
          <p className="text-[0.62rem] font-black uppercase tracking-widest text-muted-foreground">Instalações</p>
          <p className="mt-1 text-2xl font-black">{installations.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-[0.62rem] font-black uppercase tracking-widest text-amber-300/80">Suspeitos</p>
          <p className="mt-1 text-2xl font-black text-amber-200">{suspicious.length}</p>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] p-4">
          <p className="text-[0.62rem] font-black uppercase tracking-widest text-red-300/80">Bloqueados</p>
          <p className="mt-1 text-2xl font-black text-red-200">{blockedCount}</p>
        </div>
      </div>

      <div className="mt-5">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por cliente, e-mail, dispositivo, IP ou motivo..."
        />
      </div>

      {query.isLoading ? (
        <div className="grid min-h-36 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nenhum dispositivo encontrado.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((row) => {
            const risky = row.suspicious === true;
            const blocked = row.blocked === true;
            return (
              <div key={row.id || row.installation_id} className={`rounded-2xl border p-4 ${blocked ? "border-red-500/45 bg-red-500/[0.07]" : risky ? "border-amber-500/35 bg-amber-500/[0.05]" : "border-border/60 bg-card/30"}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                      <p className="font-bold">{row.name || "Cliente"}</p>
                      <span className="text-xs text-muted-foreground">{row.email || "—"}</span>
                      {blocked ? (
                        <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-widest text-red-200">Bloqueado</span>
                      ) : risky ? (
                        <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-widest text-amber-200"><AlertTriangle className="h-3 w-3" /> Suspeito</span>
                      ) : (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-widest text-emerald-200">Normal</span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-[0.68rem] text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                      <span>Dispositivo: <code className="text-foreground/80">{shortDevice(row.installation_id)}</code></span>
                      <span>IP: {row.ip_address || "—"}</span>
                      <span>{row.browser || "Navegador —"} · {row.os || "SO —"}</span>
                      <span>Último sinal: {when(row.last_seen_at)}</span>
                    </div>
                    {(row.suspicion_reason || row.block_reason) && (
                      <p className={`mt-2 text-xs ${blocked ? "text-red-200" : "text-amber-200"}`}>
                        Motivo: {row.block_reason || row.suspicion_reason}
                      </p>
                    )}
                    <p className="mt-1 break-all font-mono text-[0.6rem] text-muted-foreground/70">{row.installation_id}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={blocked ? "outline" : "destructive"}
                    disabled={block.isPending}
                    onClick={() => block.mutate(row)}
                  >
                    {block.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : blocked ? <UnlockKeyhole className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
                    {blocked ? "Liberar dispositivo" : "Bloquear dispositivo"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
