/**
 * PaymentProviderAdapter
 * ----------------------
 * Camada de abstração do gateway de pagamento. Troque o provedor definindo
 * a variável de ambiente PAYMENT_PROVIDER e implementando um novo adapter.
 *
 * Credenciais esperadas (definir como secrets do backend):
 *   PAYMENT_PROVIDER        -> identificador do gateway (ex.: "stripe", "mercadopago")
 *   PAYMENT_API_KEY         -> chave secreta da API do gateway
 *   PAYMENT_WEBHOOK_SECRET  -> segredo para validar a assinatura do webhook
 *   PAYMENT_RETURN_URL      -> URL de retorno após o checkout (opcional)
 */

export type NormalizedEvent = {
  eventId: string;
  type:
    | "payment.created"
    | "payment.pending"
    | "payment.paid"
    | "payment.failed"
    | "subscription.created"
    | "subscription.renewed"
    | "subscription.cancelled"
    | "subscription.expired"
    | "unknown";
  email?: string | undefined;
  userId?: string | undefined;
  planSlug?: string | undefined;
  planId?: string | undefined;
  amount?: number | undefined;
  currency?: string | undefined;
  providerPaymentId?: string | undefined;
  providerSubscriptionId?: string | undefined;
  providerCustomerId?: string | undefined;
  raw: unknown;
};

export interface PaymentProviderAdapter {
  readonly id: string;
  createCheckout(input: {
    planId: string;
    planSlug: string;
    priceCents: number;
    currency: string;
    userId: string;
    email: string;
    returnUrl: string;
  }): Promise<{ checkoutUrl: string; providerReference: string }>;
  getPayment(id: string): Promise<{ status: string; raw: unknown }>;
  verifyWebhook(request: Request, rawBody: string): Promise<boolean>;
  parseWebhook(rawBody: string): NormalizedEvent;
  createSubscription(input: {
    userId: string;
    planId: string;
  }): Promise<{ providerSubscriptionId: string }>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Adapter genérico HMAC-SHA256.
 * Funciona com qualquer gateway que assine o corpo bruto do webhook com HMAC
 * e envie a assinatura em `x-webhook-signature` (ou `x-signature`).
 * Substitua createCheckout/getPayment pela API real quando o gateway for definido.
 */
export class GenericHmacProvider implements PaymentProviderAdapter {
  readonly id = process.env["PAYMENT_PROVIDER"] || "generic";

  private secret() {
    const s = process.env["PAYMENT_WEBHOOK_SECRET"];
    if (!s) throw new Error("PAYMENT_WEBHOOK_SECRET não configurado");
    return s;
  }

  async createCheckout(): Promise<{ checkoutUrl: string; providerReference: string }> {
    throw new Error(
      "GATEWAY_NAO_CONFIGURADO: implemente createCheckout no adapter do gateway escolhido.",
    );
  }

  async getPayment(id: string) {
    return { status: "unknown", raw: { id } };
  }

  async verifyWebhook(request: Request, rawBody: string) {
    const provided =
      request.headers.get("x-webhook-signature") ||
      request.headers.get("x-signature") ||
      "";
    if (!provided) return false;
    const expected = await hmacHex(this.secret(), rawBody);
    const clean = provided.replace(/^sha256=/, "").trim().toLowerCase();
    return timingSafeEqual(clean, expected);
  }

  parseWebhook(rawBody: string): NormalizedEvent {
    const p = JSON.parse(rawBody) as Record<string, never>;
    const data = (p["data"] ?? p) as Record<string, never>;
    return {
      eventId: String(p["id"] ?? p["event_id"] ?? crypto.randomUUID()),
      type: String(p["type"] ?? p["event"] ?? "unknown") as NormalizedEvent["type"],
      email: data["email"] ?? data["customer_email"],
      userId: data["user_id"],
      planSlug: data["plan"] ?? data["plan_slug"],
      planId: data["plan_id"],
      amount: data["amount"] ? Number(data["amount"]) : undefined,
      currency: data["currency"],
      providerPaymentId: data["payment_id"] ?? data["id"],
      providerSubscriptionId: data["subscription_id"],
      providerCustomerId: data["customer_id"],
      raw: p,
    };
  }

  async createSubscription(): Promise<{ providerSubscriptionId: string }> {
    throw new Error("GATEWAY_NAO_CONFIGURADO: implemente createSubscription.");
  }

  async cancelSubscription(): Promise<void> {
    throw new Error("GATEWAY_NAO_CONFIGURADO: implemente cancelSubscription.");
  }
}

export function getPaymentProvider(): PaymentProviderAdapter {
  // Adicione aqui novos adapters conforme o gateway contratado.
  return new GenericHmacProvider();
}