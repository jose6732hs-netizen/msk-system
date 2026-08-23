/**
 * Integração real com a SigiloPay (https://app.sigilopay.com.br/api/v1).
 * Mesma família de autenticação da Amplo Pay: x-public-key / x-secret-key.
 * Somente servidor.
 */
import {
  callGateway,
  getSummaryFor,
  loadCredentialsFor,
  saveCredentialsFor,
  type GatewayCredentials,
} from "./credentials.server";
import type { AmploCustomer, AmploSplit } from "./amplo-pay.server";

function toReais(cents: number) {
  return Math.round(cents) / 100;
}

export class SigiloPayService {
  constructor(private creds: GatewayCredentials) {}

  static async create(): Promise<SigiloPayService> {
    const creds = await loadCredentialsFor("sigilopay");
    if (!creds) {
      throw new Error(
        "GATEWAY_NAO_CONFIGURADO: cadastre as chaves da SigiloPay no painel Super Admin.",
      );
    }
    return new SigiloPayService(creds);
  }

  get webhookSecret() {
    return this.creds.webhookSecret;
  }

  /** Cobrança PIX — POST /gateway/pix/receive */
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
    return callGateway<{
      status?: string;
      transactionId?: string;
      id?: string;
      order?: { id?: string; url?: string };
      pix?: { code?: string; base64?: string; image?: string; payload?: string };
    }>(this.creds, "POST", "/gateway/pix/receive", {
      identifier: input.identifier,
      amount: toReais(input.amountCents),
      client: {
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone ?? "(00) 00000-0000",
        ...(input.customer.document ? { document: input.customer.document.number } : {}),
      },
      products: input.items.map((i) => ({
        id: i.title.toLowerCase().replace(/\s+/g, "-").slice(0, 40),
        name: i.title,
        quantity: i.quantity,
        price: toReais(i.unitPrice),
      })),
      ...(input.splits?.length
        ? {
            splits: input.splits.map((s) => ({
              producerId: s.producerId,
              amount: toReais(s.amount),
            })),
          }
        : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
  }

  getTransaction(transactionId: string) {
    return callGateway<Record<string, unknown>>(
      this.creds,
      "GET",
      `/gateway/transactions?id=${encodeURIComponent(transactionId)}`,
    );
  }

  /** Saldo do produtor — GET /gateway/producer/balance */
  getBalance() {
    return callGateway<{ available?: number; pending?: number; fundLock?: number }>(
      this.creds,
      "GET",
      "/gateway/producer/balance",
    );
  }

  /** Testa credenciais — GET /gateway/producer/credentials */
  getCredentialsInfo() {
    return callGateway<{ name?: string; permissions?: string[]; expiresAt?: string | null }>(
      this.creds,
      "GET",
      "/gateway/producer/credentials",
    );
  }

  /** Saque / transferência PIX — POST /gateway/transfers */
  createWithdrawal(input: {
    identifier: string;
    amountCents: number;
    pixKey: string;
    pixKeyType: string;
    beneficiaryName?: string | undefined;
  }) {
    return callGateway<{ id?: string; transferId?: string; status?: string }>(
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

export async function saveSigiloCredentials(input: {
  publicKey?: string | undefined;
  secretKey?: string | undefined;
  webhookSecret?: string | undefined;
  baseUrl?: string | undefined;
  active?: boolean | undefined;
  updatedBy: string;
}) {
  return saveCredentialsFor({ provider: "sigilopay", ...input });
}

export async function getSigiloSummary() {
  return getSummaryFor("sigilopay");
}

export async function testSigiloCredentials() {
  const service = await SigiloPayService.create();
  try {
    const info = await service.getCredentialsInfo();
    const balance = await service.getBalance().catch(() => null);
    return { ok: true as const, info, balance };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
