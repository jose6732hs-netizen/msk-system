/**
 * Credenciais de gateways de pagamento (multi-provedor).
 * Somente servidor. As chaves ficam criptografadas em payment_settings
 * (AES-GCM com LICENSE_ENCRYPTION_KEY) e nunca são expostas ao cliente.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptToken } from "../license.server";

export type ProviderId = "amplopay" | "sigilopay";

export const PROVIDERS: ProviderId[] = ["amplopay", "sigilopay"];

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  amplopay: "Amplo Pay",
  sigilopay: "SigiloPay",
};

export const DEFAULT_BASE_URL: Record<ProviderId, string> = {
  amplopay: "https://app.amplopay.com/api/v1",
  sigilopay: "https://app.sigilopay.com.br/api/v1",
};

const ENV_PREFIX: Record<ProviderId, string> = {
  amplopay: "AMPLOPAY",
  sigilopay: "SIGILOPAY",
};

export type GatewayCredentials = {
  provider: ProviderId;
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string | null;
};

export async function loadCredentialsFor(
  provider: ProviderId,
): Promise<GatewayCredentials | null> {
  const { data } = await supabaseAdmin
    .from("payment_settings")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  const prefix = ENV_PREFIX[provider];
  const envPublic = process.env[`${prefix}_PUBLIC_KEY`];
  const envSecret = process.env[`${prefix}_SECRET_KEY`];

  const publicKey = data?.public_key_encrypted
    ? await decryptToken(data.public_key_encrypted)
    : envPublic ?? null;
  const secretKey = data?.secret_key_encrypted
    ? await decryptToken(data.secret_key_encrypted)
    : envSecret ?? null;
  const webhookSecret = data?.webhook_secret_encrypted
    ? await decryptToken(data.webhook_secret_encrypted)
    : process.env[`${prefix}_WEBHOOK_SECRET`] ?? null;

  if (!publicKey || !secretKey) return null;
  if (data && data.active === false && !envPublic) return null;

  return {
    provider,
    baseUrl: (data?.api_base_url || DEFAULT_BASE_URL[provider]).replace(/\/+$/, ""),
    publicKey,
    secretKey,
    webhookSecret,
  };
}

export async function saveCredentialsFor(input: {
  provider: ProviderId;
  publicKey?: string | undefined;
  secretKey?: string | undefined;
  webhookSecret?: string | undefined;
  baseUrl?: string | undefined;
  active?: boolean | undefined;
  updatedBy: string;
}) {
  const patch: Record<string, unknown> = {
    provider: input.provider,
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  };
  if (input.baseUrl) patch["api_base_url"] = input.baseUrl.replace(/\/+$/, "");
  if (typeof input.active === "boolean") patch["active"] = input.active;
  if (input.publicKey) {
    patch["public_key_encrypted"] = await encryptToken(input.publicKey);
    patch["public_key_last4"] = input.publicKey.slice(-4);
  }
  if (input.secretKey) {
    patch["secret_key_encrypted"] = await encryptToken(input.secretKey);
    patch["secret_key_last4"] = input.secretKey.slice(-4);
  }
  if (input.webhookSecret) {
    patch["webhook_secret_encrypted"] = await encryptToken(input.webhookSecret);
  }
  const { error } = await supabaseAdmin
    .from("payment_settings")
    .upsert(patch as never, { onConflict: "provider" });
  if (error) throw error;
}

export async function getSummaryFor(provider: ProviderId) {
  const { data } = await supabaseAdmin
    .from("payment_settings")
    .select(
      "provider,active,api_base_url,public_key_last4,secret_key_last4,updated_at,webhook_secret_encrypted",
    )
    .eq("provider", provider)
    .maybeSingle();
  return {
    provider,
    label: PROVIDER_LABEL[provider],
    active: data?.active ?? false,
    apiBaseUrl: data?.api_base_url ?? DEFAULT_BASE_URL[provider],
    publicKeyLast4: data?.public_key_last4 ?? null,
    secretKeyLast4: data?.secret_key_last4 ?? null,
    hasWebhookSecret: Boolean(data?.webhook_secret_encrypted),
    updatedAt: data?.updated_at ?? null,
  };
}

/** Chamada HTTP autenticada — ambos os gateways usam x-public-key / x-secret-key. */
export async function callGateway<T>(
  creds: GatewayCredentials,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${creds.baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-public-key": creds.publicKey,
      "x-secret-key": creds.secretKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[${creds.provider}] ${method} ${path} falhou [${res.status}]`, text);
    throw new Error(
      `${PROVIDER_LABEL[creds.provider]} [${res.status}]: ${text.slice(0, 400)}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
