/**
 * Orquestrador multi-gateway: SigiloPay + Amplo Pay.
 * O admin define o provedor preferido e se o failover automático está ligado.
 * Se o primário falhar (erro de API/credencial), o secundário é acionado na hora.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_BASE_URL,
  PROVIDERS,
  PROVIDER_LABEL,
  getSummaryFor,
  loadCredentialsFor,
  type ProviderId,
} from "./credentials.server";
import type { AmploCustomer, AmploSplit } from "./amplo-pay.server";

export type GatewayConfig = { primary: ProviderId; failover: boolean };

const CONFIG_KEY = "payment_gateway";

export async function getGatewayConfig(): Promise<GatewayConfig> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();
  const value = (data?.value ?? {}) as { primary?: string; failover?: boolean };
  const primary = (PROVIDERS as string[]).includes(value.primary ?? "")
    ? (value.primary as ProviderId)
    : "amplopay";
  return { primary, failover: value.failover !== false };
}

export async function saveGatewayConfig(config: Partial<GatewayConfig>) {
  const current = await getGatewayConfig();
  const next: GatewayConfig = { ...current, ...config };
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert(
      { key: CONFIG_KEY, value: next as never, updated_at: new Date().toISOString() } as never,
      { onConflict: "key" },
    );
  if (error) throw error;
  return next;
}

/** Ordem de tentativa: primário e, com failover ligado, o outro provedor configurado. */
export async function resolveProviderOrder(preferred?: ProviderId | null) {
  const config = await getGatewayConfig();
  const primary = preferred ?? config.primary;
  const order: ProviderId[] = [primary];
  if (config.failover) {
    for (const p of PROVIDERS) if (p !== primary) order.push(p);
  }
  return order;
}

export type PixServiceLike = {
  createPix(input: {
    identifier: string;
    amountCents: number;
    customer: AmploCustomer;
    items: { title: string; unitPrice: number; quantity: number; tangible: boolean }[];
    splits?: AmploSplit[] | undefined;
    dueDate?: string | undefined;
    callbackUrl?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }): Promise<{
    status?: string;
    transactionId?: string;
    id?: string;
    order?: { id?: string; url?: string };
    pix?: { code?: string; base64?: string; image?: string; payload?: string };
  }>;
  getTransaction(id: string): Promise<Record<string, unknown>>;
  getBalance(): Promise<Record<string, unknown>>;
};

export async function getService(provider: ProviderId): Promise<PixServiceLike> {
  if (provider === "sigilopay") {
    const { SigiloPayService } = await import("./sigilo-pay.server");
    return (await SigiloPayService.create()) as unknown as PixServiceLike;
  }
  const { AmploPayService } = await import("./amplo-pay.server");
  return (await AmploPayService.create()) as unknown as PixServiceLike;
}

export function webhookPathFor(provider: ProviderId) {
  return `/api/public/webhooks/${provider}`;
}

/** Cria a cobrança PIX no primeiro gateway que responder com sucesso. */
export async function createPixWithFailover(
  input: {
    identifier: string;
    amountCents: number;
    customer: AmploCustomer;
    items: { title: string; unitPrice: number; quantity: number; tangible: boolean }[];
    splits?: AmploSplit[] | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
  preferred?: ProviderId | null,
) {
  const order = await resolveProviderOrder(preferred);
  const { absoluteUrl } = await import("../app-url.server");
  const errors: string[] = [];

  for (const provider of order) {
    try {
      const creds = await loadCredentialsFor(provider);
      if (!creds) {
        errors.push(`${PROVIDER_LABEL[provider]}: não configurado`);
        continue;
      }
      const service = await getService(provider);
      const callbackUrl = await absoluteUrl(webhookPathFor(provider)).catch(() => "");
      const result = await service.createPix({
        ...input,
        ...(callbackUrl ? { callbackUrl } : {}),
      });
      const pixCode = result.pix?.code ?? result.pix?.payload ?? null;
      if (!pixCode && !result.pix?.base64 && !result.pix?.image) {
        throw new Error("Gateway não retornou o código PIX");
      }
      return { provider, result, pixCode };
    } catch (e) {
      const message = (e as Error).message;
      console.error(`[gateway] ${provider} falhou:`, message);
      errors.push(`${PROVIDER_LABEL[provider]}: ${message}`);
    }
  }

  throw new Error(`GATEWAY_INDISPONIVEL — ${errors.join(" | ")}`);
}

/** Resumo dos dois provedores + preferência atual (para o painel admin). */
export async function getGatewayOverview() {
  const config = await getGatewayConfig();
  const providers = await Promise.all(PROVIDERS.map((p) => getSummaryFor(p)));
  return {
    config,
    providers: providers.map((p) => ({
      ...p,
      defaultBaseUrl: DEFAULT_BASE_URL[p.provider as ProviderId],
      webhookPath: webhookPathFor(p.provider as ProviderId),
    })),
  };
}
