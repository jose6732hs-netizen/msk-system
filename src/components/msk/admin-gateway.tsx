import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, PlugZap, ShieldCheck, Star, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminAtomoCatalogMap,
  adminAtomoSettings,
  adminGatewaySettings,
  adminSaveAtomoSettings,
  adminSyncAtomoCatalog,
  adminSaveGateway,
  adminSetGatewayPreference,
  adminTestGateway,
} from "@/lib/admin.functions";

type ProviderId = "amplopay" | "sigilopay" | "atomopay";

export function AdminGatewayTab() {
  const qc = useQueryClient();
  const loadFn = useServerFn(adminGatewaySettings);
  const saveFn = useServerFn(adminSaveGateway);
  const testFn = useServerFn(adminTestGateway);
  const prefFn = useServerFn(adminSetGatewayPreference);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["gateway-settings"],
    queryFn: () => loadFn(),
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["gateway-settings"] });
  }

  async function setPreference(patch: { primary?: ProviderId; failover?: boolean }) {
    setBusy(true);
    try {
      await prefFn({ data: patch });
      await refresh();
      toast.success("Preferência de gateway atualizada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border/60 p-4">
        <p className="text-sm font-semibold text-foreground">Roteamento de pagamentos</p>
        <p className="mt-1 text-xs text-muted-foreground">
          O gateway principal recebe todas as cobranças. Com o failover ligado, se ele falhar o
          PIX é gerado automaticamente no outro gateway configurado.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.providers.map((p) => (
            <Button
              key={p.provider}
              size="sm"
              disabled={busy}
              variant={data.config.primary === p.provider ? "neon" : "neonOutline"}
              onClick={() => setPreference({ primary: p.provider as ProviderId })}
            >
              <Star className="mr-2 h-3.5 w-3.5" />
              {p.label} {data.config.primary === p.provider ? "(principal)" : ""}
            </Button>
          ))}
          <Button
            size="sm"
            variant="glass"
            disabled={busy}
            onClick={() => setPreference({ failover: !data.config.failover })}
          >
            <Repeat className="mr-2 h-3.5 w-3.5" />
            Failover automático: {data.config.failover ? "ligado" : "desligado"}
          </Button>
        </div>
      </div>

      <AtomoMethodsCard />

      <AtomoCatalogCard />




      {data.providers.map((p) => (
        <ProviderCard
          key={p.provider}
          provider={p as never}
          busy={busy}
          setBusy={setBusy}
          onSave={async (payload) => {
            const res = await saveFn({ data: { provider: p.provider as ProviderId, ...payload } });
            await refresh();
            return (res as { test?: { ok: boolean; error?: string } })?.test ?? { ok: true };
          }}
          onTest={async () => testFn({ data: { provider: p.provider as ProviderId } })}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  provider,
  busy,
  setBusy,
  onSave,
  onTest,
}: {
  provider: {
    provider: string;
    label: string;
    active: boolean;
    apiBaseUrl: string;
    publicKeyLast4: string | null;
    secretKeyLast4: string | null;
    publicKeyMasked?: string | null;
    secretKeyMasked?: string | null;
    configured?: boolean;
    tokenOnly?: boolean;
    hasWebhookSecret: boolean;
    webhookPath: string;
  };
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSave: (payload: {
    publicKey?: string;
    secretKey?: string;
    webhookSecret?: string;
    baseUrl?: string;
    active?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onTest: () => Promise<{ ok: boolean; error?: string }>;
}) {
  // AtomoPay autentica apenas com API Token (enviado como api_token na URL).
  const tokenOnly = provider.tokenOnly === true;
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  // A URL base fica sempre visível e salva no painel.
  const [baseUrl, setBaseUrl] = useState(provider.apiBaseUrl);

  useEffect(() => {
    setBaseUrl(provider.apiBaseUrl);
  }, [provider.apiBaseUrl]);

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}${provider.webhookPath}` : "";

  async function save(active?: boolean) {
    setBusy(true);
    try {
      const res = await onSave({
        ...(publicKey ? { publicKey } : {}),
        ...(secretKey ? { secretKey } : {}),
        ...(webhookSecret ? { webhookSecret } : {}),
        ...(baseUrl && baseUrl !== provider.apiBaseUrl ? { baseUrl } : {}),
        ...(typeof active === "boolean" ? { active } : {}),
      });
      setPublicKey("");
      setSecretKey("");
      setWebhookSecret("");
      if (res && res.ok === false) {
        toast.error(
          `${provider.label}: credenciais recusadas pelo gateway — ${res.error ?? "verifique as chaves"}`,
        );
      } else {
        toast.success(`${provider.label}: credenciais salvas, criptografadas e validadas.`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await onTest();
      if (res.ok) toast.success(`Conexão com a ${provider.label} funcionando.`);
      else toast.error(res.error ?? "Falha na conexão");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border/60 p-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-base font-bold text-foreground">{provider.label}</span>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${
            provider.active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          {provider.active ? "Ativo" : "Inativo"}
        </span>
        <span className="text-xs text-muted-foreground">
          {tokenOnly ? "API Token ····" : `Pública ····${provider.publicKeyLast4 ?? "----"} · Secreta ····`}
          {tokenOnly ? "" : ""}{provider.secretKeyLast4 ?? "----"} ·{" "}
          {provider.hasWebhookSecret ? "webhook configurado" : "webhook pendente"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">
            URL base da API (sempre salva)
          </label>
          <Input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div className={tokenOnly ? "hidden" : ""}>
          <label className="mb-1 block text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">
            API Key pública (x-public-key)
          </label>
          <Input
            type="text"
            placeholder={provider.publicKeyMasked ?? `x-public-key da ${provider.label}`}
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Salva: <span className="font-mono text-primary">{provider.publicKeyMasked ?? "não cadastrada"}</span>
          </p>
        </div>

        <div className={tokenOnly ? "sm:col-span-2" : ""}>
          <label className="mb-1 block text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">
            {tokenOnly ? "API Token (api_token)" : "API Key secreta (x-secret-key)"}
          </label>
          <Input
            type="password"
            placeholder={
              provider.secretKeyMasked ??
              (tokenOnly ? `API Token da ${provider.label}` : `x-secret-key da ${provider.label}`)
            }
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Salva: <span className="font-mono text-primary">{provider.secretKeyMasked ?? "não cadastrada"}</span>
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">
            Segredo do webhook (opcional)
          </label>
          <Input
            type="password"
            placeholder={provider.hasWebhookSecret ? "•••••••••••• (configurado)" : "Token do webhook"}
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="neon" disabled={busy} onClick={() => save()}>
          <ShieldCheck className="mr-2 h-4 w-4" /> Salvar credenciais
        </Button>
        <Button variant="neonOutline" disabled={busy} onClick={() => save(!provider.active)}>
          {provider.active ? "Desativar" : "Ativar"}
        </Button>
        <Button variant="glass" disabled={busy} onClick={test}>
          <PlugZap className="mr-2 h-4 w-4" /> Testar conexão
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">URL de webhook para cadastrar na {provider.label}</p>
        <p className="mt-1 break-all font-mono text-primary">{webhookUrl}</p>
        <p className="mt-2">
          As chaves são criptografadas antes de serem gravadas e nunca retornam para o navegador.
        </p>
      </div>
    </div>
  );
}

/** Métodos de pagamento habilitados na AtomoPay (PIX / cartão / parcelas). */
function AtomoMethodsCard() {
  const qc = useQueryClient();
  const loadFn = useServerFn(adminAtomoSettings);
  const saveFn = useServerFn(adminSaveAtomoSettings);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({ queryKey: ["atomo-methods"], queryFn: () => loadFn() });

  async function patch(input: {
    pixEnabled?: boolean;
    cardEnabled?: boolean;
    maxInstallments?: number;
    sandbox?: boolean;
  }) {
    setSaving(true);
    try {
      await saveFn({ data: input });
      await qc.invalidateQueries({ queryKey: ["atomo-methods"] });
      toast.success("Métodos AtomoPay atualizados.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-border/60 p-4">
      <p className="text-sm font-semibold text-foreground">Pagamentos &gt; AtomoPay</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Métodos disponíveis no checkout interno. O cartão exige que a captura direta esteja
        liberada comercialmente na sua conta AtomoPay — enquanto estiver desligado, o formulário
        não aparece para o cliente.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={saving}
          variant={data.pixEnabled ? "neon" : "neonOutline"}
          onClick={() => patch({ pixEnabled: !data.pixEnabled })}
        >
          PIX: {data.pixEnabled ? "ativo" : "inativo"}
        </Button>
        <Button
          size="sm"
          disabled={saving}
          variant={data.cardEnabled ? "neon" : "neonOutline"}
          onClick={() => patch({ cardEnabled: !data.cardEnabled })}
        >
          Cartão: {data.cardEnabled ? "ativo" : "inativo"}
        </Button>
        <Button
          size="sm"
          variant="glass"
          disabled={saving}
          onClick={() => patch({ sandbox: !data.sandbox })}
        >
          Ambiente: {data.sandbox ? "sandbox" : "produção"}
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Máx. parcelas
          <Input
            type="number"
            min={1}
            max={12}
            defaultValue={data.maxInstallments}
            className="h-8 w-20"
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v >= 1 && v <= 12 && v !== data.maxInstallments) patch({ maxInstallments: v });
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Espelhamento das ofertas MSK como produtos dentro da conta AtomoPay. */
function AtomoCatalogCard() {
  const qc = useQueryClient();
  const syncFn = useServerFn(adminSyncAtomoCatalog);
  const mapFn = useServerFn(adminAtomoCatalogMap);
  const [syncing, setSyncing] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["atomo-catalog-map"],
    queryFn: () => mapFn(),
  });

  async function sync() {
    setSyncing(true);
    try {
      const result = await syncFn({ data: {} });
      await qc.invalidateQueries({ queryKey: ["atomo-catalog-map"] });
      toast.success(
        `${result.synced}/${result.total} ofertas espelhadas na AtomoPay` +
          (result.pendingApproval ? ` · ${result.pendingApproval} em análise` : "") +
          (result.failed ? ` · ${result.failed} com erro` : ""),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const list = rows ?? [];

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Ofertas na AtomoPay</p>
          <p className="text-xs text-muted-foreground">
            Cria/atualiza cada plano ativo do MSK como produto e oferta dentro da sua conta AtomoPay
            e pré-aprova os valores de PIX e cartão.
          </p>
        </div>
        <Button size="sm" onClick={sync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat className="mr-2 h-4 w-4" />}
          Sincronizar ofertas
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma oferta espelhada ainda. Clique em “Sincronizar ofertas”.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((row) => (
            <div
              key={row.planId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2 text-xs"
            >
              <span className="font-medium text-foreground">{row.name}</span>
              <span className="text-muted-foreground">
                R$ {Number(row.price).toFixed(2)} · oferta {String(row.offerHash).slice(0, 10)}…
              </span>
              <span className={row.approved ? "text-emerald-400" : "text-amber-400"}>
                {row.approved ? "ativa" : "em análise"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
