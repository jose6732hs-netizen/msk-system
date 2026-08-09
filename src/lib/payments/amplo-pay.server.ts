/**
 * Integração real com a Amplo Pay.
 * Roda SOMENTE no servidor. Credenciais ficam criptografadas em payment_settings
 * (AES-GCM com LICENSE_ENCRYPTION_KEY) e nunca são expostas ao cliente.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptToken } from "../license.server";

export type AmploCredentials = {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string | null;
};

const DEFAULT_BASE = "https://app.amplopay.com/api/v1";

export async function loadCredentials(): Promise<AmploCredentials | null> {
  const { data } = await supabaseAdmin
    .from("payment_settings")
    .select("*")
    .eq("provider", "amplopay")
    .maybeSingle();

  const envPublic = process.env["AMPLOPAY_PUBLIC_KEY"];
  const envSecret = process.env["AMPLOPAY_SECRET_KEY"];

  const publicKey = data?.public_key_encrypted
    ? await decryptToken(data.public_key_encrypted)
    : envPublic ?? null;
  const secretKey = data?.secret_key_encrypted
    ? await decryptToken(data.secret_key_encrypted)
    : envSecret ?? null;
  const webhookSecret = data?.webhook_secret_encrypted
    ? await decryptToken(data.webhook_secret_encrypted)
    : process.env["AMPLOPAY_WEBHOOK_SECRET"] ?? null;

  if (!publicKey || !secretKey) return null;
  if (data && data.active === false && !envPublic) return null;

  return {
    baseUrl: (data?.api_base_url || DEFAULT_BASE).replace(/\/+$/, ""),
    publicKey,
    secretKey,
    webhookSecret,
  };
}

export async function saveCredentials(input: {
  publicKey?: string | undefined;
  secretKey?: string | undefined;
  webhookSecret?: string | undefined;
  baseUrl?: string | undefined;
  active?: boolean | undefined;
  updatedBy: string;
}) {
  const patch: Record<string, unknown> = {
    provider: "amplopay",
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

export async function getSettingsSummary() {
  const { data } = await supabaseAdmin
    .from("payment_settings")
    .select("provider,active,api_base_url,public_key_last4,secret_key_last4,updated_at,webhook_secret_encrypted")
    .eq("provider", "amplopay")
    .maybeSingle();
  return {
    provider: "amplopay",
    active: data?.active ?? false,
    apiBaseUrl: data?.api_base_url ?? DEFAULT_BASE,
    publicKeyLast4: data?.public_key_last4 ?? null,
    secretKeyLast4: data?.secret_key_last4 ?? null,
    hasWebhookSecret: Boolean(data?.webhook_secret_encrypted),
    updatedAt: data?.updated_at ?? null,
  };
}

async function call<T>(
  creds: AmploCredentials,
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
    console.error(`[amplopay] ${method} ${path} falhou [${res.status}]`);
    throw new Error(`Amplo Pay [${res.status}]: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export type AmploCustomer = {
  name: string;
  email: string;
  phone?: string | undefined;
  document?: { number: string; type: "CPF" | "CNPJ" } | undefined;
};

/** Amplo Pay espera `amount` em centavos, mas o preço do produto em reais. */
function toReais(cents: number) {
  return Math.round(cents) / 100;
}

export type AmploSplit = { producerId: string; amount: number };

/**
 * Valida matematicamente os splits antes de enviar ao gateway.
 * O total nunca pode exceder o valor da transação (valores em centavos).
 */
export function validateSplits(amountCents: number, splits: AmploSplit[]) {
  const total = splits.reduce((s, x) => s + Math.round(x.amount), 0);
  if (splits.some((s) => !s.producerId || !Number.isFinite(s.amount) || s.amount <= 0)) {
    throw new Error("SPLIT_INVALIDO: cada split precisa de producerId e valor positivo.");
  }
  if (total > amountCents) {
    throw new Error(
      `SPLIT_EXCEDE_TRANSACAO: soma dos splits (${total}) maior que o valor (${amountCents}).`,
    );
  }
  return splits.map((s) => ({ producerId: s.producerId, amount: Math.round(s.amount) }));
}

export class AmploPayService {
  constructor(private creds: AmploCredentials) {}

  static async create(): Promise<AmploPayService> {
    const creds = await loadCredentials();
    if (!creds) {
      throw new Error(
        "GATEWAY_NAO_CONFIGURADO: cadastre as chaves da Amplo Pay no painel Super Admin.",
      );
    }
    return new AmploPayService(creds);
  }

  get webhookSecret() {
    return this.creds.webhookSecret;
  }

  /** Cobrança PIX avulsa — POST /gateway/pix/receive */
  createPix(input: {
    identifier: string;
    amountCents: number;
    customer: AmploCustomer;
    items: { title: string; unitPrice: number; quantity: number; tangible: boolean }[];
    splits?: AmploSplit[] | undefined;
    dueDate?: string | undefined;
    callbackUrl?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }) {
    const splits = input.splits?.length ? validateSplits(input.amountCents, input.splits) : undefined;
    return call<{
      status?: string;
      transactionId?: string;
      id?: string;
      order?: { id?: string; url?: string };
      pix?: { code?: string; base64?: string; image?: string };
    }>(this.creds, "POST", "/gateway/pix/receive", {
      identifier: input.identifier,
      amount: toReais(input.amountCents),
      client: {
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone ?? "00000000000",
        ...(input.customer.document
          ? { document: input.customer.document.number, documentType: input.customer.document.type }
          : {}),
      },
      products: input.items.map((i) => ({
        id: i.title.toLowerCase().replace(/\s+/g, "-"),
        name: i.title,
        quantity: i.quantity,
        price: toReais(i.unitPrice),
      })),
      ...(splits ? { splits: splits.map((sp) => ({ ...sp, amount: toReais(sp.amount) })) } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
  }

  /** Assinatura recorrente via PIX — POST /gateway/pix/subscription */
  createPixSubscription(input: {
    identifier: string;
    amountCents: number;
    customer: AmploCustomer;
    productName: string;
    periodicityType: "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
    periodicity: number;
    dueDate?: string | undefined;
    callbackUrl?: string | undefined;
    splits?: AmploSplit[] | undefined;
    metadata?: Record<string, unknown> | undefined;
  }) {
    const splits = input.splits?.length ? validateSplits(input.amountCents, input.splits) : undefined;
    return call<{
      status?: string;
      transactionId?: string;
      id?: string;
      subscriptionId?: string;
      pix?: { code?: string; base64?: string; image?: string };
    }>(this.creds, "POST", "/gateway/pix/subscription", {
      identifier: input.identifier,
      amount: toReais(input.amountCents),
      product: { name: input.productName, quantity: 1, price: toReais(input.amountCents) },
      subscription: { periodicityType: input.periodicityType, periodicity: input.periodicity },
      client: {
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone ?? "00000000000",
        ...(input.customer.document
          ? { document: input.customer.document.number, documentType: input.customer.document.type }
          : {}),
      },
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(splits ? { splits: splits.map((sp) => ({ ...sp, amount: toReais(sp.amount) })) } : {}),
      ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
  }

  /**
   * Assinatura no cartão — POST /gateway/card/subscription.
   * Os dados do cartão são repassados direto ao gateway e NUNCA persistidos.
   */
  createCardSubscription(input: {
    identifier: string;
    amountCents: number;
    customer: AmploCustomer;
    clientIp: string;
    productName: string;
    periodicityType: "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
    periodicity: number;
    card: { number: string; holderName: string; expiresAt: string; cvv: string; installments?: number | undefined };
    callbackUrl?: string | undefined;
    splits?: AmploSplit[] | undefined;
    metadata?: Record<string, unknown> | undefined;
  }) {
    const splits = input.splits?.length ? validateSplits(input.amountCents, input.splits) : undefined;
    return call<{ status?: string; transactionId?: string; id?: string; subscriptionId?: string }>(
      this.creds,
      "POST",
      "/gateway/card/subscription",
      {
        identifier: input.identifier,
        amount: toReais(input.amountCents),
        clientIp: input.clientIp,
        product: { name: input.productName, quantity: 1, price: toReais(input.amountCents) },
        subscription: { periodicityType: input.periodicityType, periodicity: input.periodicity },
        card: {
          number: input.card.number,
          holderName: input.card.holderName,
          expiresAt: input.card.expiresAt,
          cvv: input.card.cvv,
          installments: input.card.installments ?? 1,
        },
        client: {
          name: input.customer.name,
          email: input.customer.email,
          phone: input.customer.phone ?? "00000000000",
        },
        ...(splits ? { splits: splits.map((sp) => ({ ...sp, amount: toReais(sp.amount) })) } : {}),
        ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    );
  }

  getTransaction(transactionId: string) {
    return call<Record<string, unknown>>(
      this.creds,
      "GET",
      `/gateway/transactions?id=${encodeURIComponent(transactionId)}`,
    );
  }

  cancelSubscription(subscriptionId: string) {
    return call<Record<string, unknown>>(this.creds, "POST", "/gateway/subscription/cancel", {
      id: subscriptionId,
    });
  }

  /** Saldo do produtor — GET /gateway/producer/balance */
  getBalance() {
    return call<{
      balance?: number;
      available?: number;
      pending?: number;
      reserved?: number;
      blocked?: number;
    }>(this.creds, "GET", "/gateway/producer/balance");
  }

  /** Saque / transferência PIX — POST /gateway/transfers */
  createWithdrawal(input: {
    identifier: string;
    amountCents: number;
    pixKey: string;
    pixKeyType: string;
    beneficiaryName?: string | undefined;
  }) {
    return call<{ id?: string; transferId?: string; status?: string }>(
      this.creds,
      "POST",
      "/gateway/transfers",
      {
        identifier: input.identifier,
        amount: toReais(input.amountCents),
        pixKey: input.pixKey,
        pixKeyType: input.pixKeyType,
        ...(input.beneficiaryName ? { beneficiaryName: input.beneficiaryName } : {}),
      },
    );
  }
}

/** Testa as credenciais atuais sem criar cobrança. */
export async function testCredentials() {
  const service = await AmploPayService.create();
  try {
    const balance = await service.getBalance();
    return { ok: true as const, balance };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}