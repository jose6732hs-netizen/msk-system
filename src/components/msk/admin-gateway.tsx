import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, PlugZap, ShieldCheck, Star, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminGatewaySettings,
  adminSaveGateway,
  adminSetGatewayPreference,
  adminTestGateway,
} from "@/lib/admin.functions";

type ProviderId = "amplopay" | "sigilopay";

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

      {data.providers.map((p) => (
        <ProviderCard
          key={p.provider}
          provider={p as never}
          busy={busy}
          setBusy={setBusy}
          onSave={async (payload) => {
            await saveFn({ data: { provider: p.provider as ProviderId, ...payload } });
            await refresh();
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
  }) => Promise<void>;
  onTest: () => Promise<{ ok: boolean; error?: string }>;
}) {
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
      await onSave({
        ...(publicKey ? { publicKey } : {}),
        ...(secretKey ? { secretKey } : {}),
        ...(webhookSecret ? { webhookSecret } : {}),
        ...(baseUrl && baseUrl !== provider.apiBaseUrl ? { baseUrl } : {}),
        ...(typeof active === "boolean" ? { active } : {}),
      });
      setPublicKey("");
      setSecretKey("");
      setWebhookSecret("");
      toast.success(`${provider.label}: configurações salvas com segurança.`);
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
          Pública ····{provider.publicKeyLast4 ?? "----"} · Secreta ····
          {provider.secretKeyLast4 ?? "----"} ·{" "}
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

        <div>
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

        <div>
          <label className="mb-1 block text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">
            API Key secreta (x-secret-key)
          </label>
          <Input
            type="password"
            placeholder={provider.secretKeyMasked ?? `x-secret-key da ${provider.label}`}
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
