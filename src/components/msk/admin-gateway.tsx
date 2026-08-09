import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PlugZap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminGatewaySettings,
  adminSaveGateway,
  adminTestGateway,
} from "@/lib/admin.functions";

export function AdminGatewayTab() {
  const qc = useQueryClient();
  const loadFn = useServerFn(adminGatewaySettings);
  const saveFn = useServerFn(adminSaveGateway);
  const testFn = useServerFn(adminTestGateway);

  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["gateway-settings"],
    queryFn: () => loadFn(),
  });

  async function save(active?: boolean) {
    setBusy(true);
    try {
      await saveFn({
        data: {
          ...(publicKey ? { publicKey } : {}),
          ...(secretKey ? { secretKey } : {}),
          ...(webhookSecret ? { webhookSecret } : {}),
          ...(baseUrl ? { baseUrl } : {}),
          ...(typeof active === "boolean" ? { active } : {}),
        },
      });
      setPublicKey("");
      setSecretKey("");
      setWebhookSecret("");
      setBaseUrl("");
      await qc.invalidateQueries({ queryKey: ["gateway-settings"] });
      toast.success("Configurações salvas com segurança.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await testFn();
      if (res.ok) toast.success("Conexão com a Amplo Pay funcionando.");
      else toast.error(res.error ?? "Falha na conexão");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/webhooks/amplopay` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className={`rounded-full border px-3 py-1 text-xs ${
            data?.active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          {data?.active ? "Gateway ativo" : "Gateway inativo"}
        </span>
        <span className="text-xs text-muted-foreground">
          Chave pública ····{data?.publicKeyLast4 ?? "----"} · Secreta ····
          {data?.secretKeyLast4 ?? "----"} ·{" "}
          {data?.hasWebhookSecret ? "webhook configurado" : "webhook pendente"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input className="sm:col-span-2" type="url" placeholder={data?.apiBaseUrl ?? "URL base da API Amplo Pay"} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <Input
          type="password"
          placeholder="x-public-key da Amplo Pay"
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
        />
        <Input
          type="password"
          placeholder="x-secret-key da Amplo Pay"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
        />
        <Input
          className="sm:col-span-2"
          type="password"
          placeholder="Segredo do webhook (HMAC-SHA256)"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="neon" disabled={busy} onClick={() => save()}>
          <ShieldCheck className="mr-2 h-4 w-4" /> Salvar credenciais
        </Button>
        <Button variant="neonOutline" disabled={busy} onClick={() => save(!data?.active)}>
          {data?.active ? "Desativar gateway" : "Ativar gateway"}
        </Button>
        <Button variant="glass" disabled={busy} onClick={test}>
          <PlugZap className="mr-2 h-4 w-4" /> Testar conexão
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">URL de webhook para cadastrar na Amplo Pay</p>
        <p className="mt-1 break-all font-mono text-primary">{webhookUrl}</p>
        <p className="mt-2">
          As chaves são criptografadas antes de serem gravadas e nunca retornam para o navegador.
        </p>
      </div>
    </div>
  );
}