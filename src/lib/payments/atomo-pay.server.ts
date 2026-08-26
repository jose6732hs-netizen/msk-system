/**
 * Integração com a AtomoPay (https://api.atomopay.com.br/api/public/v1).
 * Autenticação por api_token e valores monetários em centavos. Somente servidor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getSummaryFor,
  loadCredentialsFor,
  saveCredentialsFor,
  type GatewayCredentials,
} from "./credentials.server";
import type { AmploCustomer, AmploSplit } from "./amplo-pay.server";

const CATALOG_KEY = "atomopay_catalog";

type AtomoCatalogState = {
  productHash?: string;
  offerHash?: string;
};

type AtomoCatalog = { productHash: string; offerHash: string };

function onlyDigits(v: string | undefined | null) {
  return String(v ?? "").replace(/\D+/g, "");
}

function sanitizeProviderText(value: string) {
  return String(value ?? "")
    .replace(/api_token=([^&\s]+)/gi, "api_token=[redacted]")
    .replace(/"?(?:number|card_number)"?\s*:\s*"?\d{12,19}"?/gi, '"number":"[card-redacted]"')
    .replace(/"?cvv"?\s*:\s*"?\d{3,4}"?/gi, '"cvv":"[redacted]"')
    .replace(/\b\d{12,19}\b/g, "[card-redacted]")
    .slice(0, 500);
}

function customerData(customer: AmploCustomer) {
  const phone = onlyDigits(customer.phone);
  const document = onlyDigits(customer.document?.number);
  if (phone.length < 10 || phone.length > 13) throw new Error("ATOMOPAY_CUSTOMER_PHONE_INVALID");
  if (document.length !== 11 && document.length !== 14) throw new Error("ATOMOPAY_CUSTOMER_DOCUMENT_INVALID");
  return {
    name: String(customer.name ?? "").trim(),
    email: String(customer.email ?? "").trim(),
    phone_number: phone,
    document,
  };
}

export class AtomoPayService {
  constructor(private creds: GatewayCredentials) {}

  static async create(): Promise<AtomoPayService> {
    const creds = await loadCredentialsFor("atomopay");
    if (!creds) {
      throw new Error("GATEWAY_NAO_CONFIGURADO: cadastre o API Token da AtomoPay no painel Super Admin.");
    }
    return new AtomoPayService(creds);
  }

  get webhookSecret() {
    return this.creds.webhookSecret;
  }

  private async call<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${this.creds.baseUrl}${path}${sep}api_token=${encodeURIComponent(this.creds.secretKey)}`;
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) {
      const safe = sanitizeProviderText(text);
      console.error(`[atomopay] ${method} ${path} falhou [${res.status}]`, safe);
      throw new Error(`ATOMOPAY_HTTP_${res.status}: ${safe}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return {} as T;
    }
  }

  listProducts() {
    return this.call<Record<string, unknown>>("GET", "/products");
  }

  listCategories() {
    return this.call<Record<string, unknown>>("GET", "/products/categories");
  }

  createProduct(input: { title: string; amount: number; salePage?: string; cover?: string }) {
    return this.call<Record<string, unknown>>("POST", "/products", {
      title: input.title,
      ...(input.cover ? { cover: input.cover } : {}),
      ...(input.salePage ? { sale_page: input.salePage } : {}),
      payment_type: 1,
      product_type: "digital",
      delivery_type: 1,
      id_category: 1,
      amount: input.amount,
    });
  }

  createOffer(productHash: string, input: { title: string; amount: number }) {
    return this.call<Record<string, unknown>>("POST", `/products/${productHash}/offers`, {
      title: input.title,
      amount: input.amount,
    });
  }

  /**
   * Resolve uma única oferta configurada para o catálogo MSK.
   *
   * O próprio fluxo PIX já cria cobranças de valores diferentes usando a mesma
   * offer_hash. Portanto não criamos uma oferta nova antes de cada cartão:
   * isso adicionava uma chamada desnecessária e podia impedir o POST real de
   * /transactions de acontecer.
   */
  async ensureCatalog(): Promise<AtomoCatalog> {
    const envProduct = process.env["ATOMOPAY_PRODUCT_HASH"];
    const envOffer = process.env["ATOMOPAY_OFFER_HASH"];
    if (envProduct && envOffer) return { productHash: envProduct, offerHash: envOffer };

    const { data: saved } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", CATALOG_KEY)
      .maybeSingle();
    const cached = (saved?.value ?? {}) as AtomoCatalogState;

    let productHash = String(envProduct ?? cached.productHash ?? "");
    let offerHash = String(envOffer ?? cached.offerHash ?? "");
    if (productHash && offerHash) return { productHash, offerHash };

    const listed = (await this.listProducts()) as any;
    const items: any[] = Array.isArray(listed) ? listed : (listed?.data ?? listed?.products ?? []);
    let product = productHash
      ? items.find((p) => String(p?.hash ?? p?.product_hash ?? "") === productHash)
      : items.find((p) => String(p?.title ?? p?.name ?? "").trim().toUpperCase() === "MSK SISTEM");

    if (!product && !productHash) {
      const created = (await this.createProduct({
        title: "MSK SISTEM",
        amount: 1000,
        salePage: "https://msksystem.online",
      })) as any;
      product = created?.data ?? created;
    }

    if (!productHash) productHash = String(product?.hash ?? product?.product_hash ?? "");
    if (!productHash) throw new Error("ATOMOPAY_CATALOG_PRODUCT_MISSING");

    if (!offerHash) {
      const offers: any[] = Array.isArray(product?.offers)
        ? product.offers
        : Array.isArray(product?.offer)
          ? product.offer
          : [];
      offerHash = String(offers.find((o) => o?.hash)?.hash ?? "");
    }

    if (!offerHash) {
      const createdOffer = (await this.createOffer(productHash, {
        title: "MSK SISTEM",
        amount: 1000,
      })) as any;
      offerHash = String((createdOffer?.data ?? createdOffer)?.hash ?? "");
    }
    if (!offerHash) throw new Error("ATOMOPAY_CATALOG_OFFER_MISSING");

    await supabaseAdmin.from("app_settings").upsert(
      {
        key: CATALOG_KEY,
        value: { productHash, offerHash } as never,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "key" },
    );

    return { productHash, offerHash };
  }

  async createPix(input: {
    identifier: string;
    amountCents: number;
    customer: AmploCustomer;
    items: { title: string; unitPrice: number; quantity: number; tangible: boolean }[];
    splits?: AmploSplit[] | undefined;
    dueDate?: string | undefined;
    callbackUrl?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }) {
    const amount = Math.round(input.amountCents);
    const catalog = await this.ensureCatalog();
    const customer = customerData(input.customer);

    const body: Record<string, unknown> = {
      amount,
      offer_hash: catalog.offerHash,
      payment_method: "pix",
      customer,
      cart: input.items.map((i) => ({
        product_hash: catalog.productHash,
        title: i.title,
        cover: null,
        price: Math.round(i.unitPrice),
        quantity: i.quantity,
        operation_type: 1,
        tangible: false,
      })),
      expire_in_days: 1,
      transaction_origin: "api",
      ...(input.callbackUrl ? { postback_url: input.callbackUrl } : {}),
    };

    const raw = ((await this.call<Record<string, any>>("POST", "/transactions", body)) ?? {}) as any;
    const tx = raw?.data ?? raw;
    const pix = tx?.pix ?? tx?.pix_information ?? raw?.pix ?? {};
    const code = pix?.pix_qr_code ?? pix?.qr_code ?? pix?.payload ?? pix?.code ?? pix?.emv ?? tx?.qr_code ?? undefined;
    const base64 = pix?.pix_qr_code_base64 ?? pix?.qr_code_base64 ?? pix?.base64 ?? pix?.image ?? undefined;

    return {
      status: String(tx?.payment_status ?? tx?.status ?? "pending"),
      transactionId: String(tx?.hash ?? tx?.id ?? raw?.hash ?? ""),
      id: String(tx?.hash ?? tx?.id ?? ""),
      order: { id: String(tx?.hash ?? ""), url: tx?.payment_url ?? undefined },
      pix: {
        ...(code ? { code: String(code), payload: String(code) } : {}),
        ...(base64 ? { base64: String(base64) } : {}),
      },
    };
  }

  async getTransaction(transactionId: string) {
    const raw = (await this.call<Record<string, any>>(
      "GET",
      `/transactions/${encodeURIComponent(transactionId)}`,
    )) as any;
    const tx = raw?.data ?? raw;
    return { ...tx, status: tx?.payment_status ?? tx?.status } as Record<string, unknown>;
  }

  async createCard(input: {
    identifier: string;
    amountCents: number;
    installments: number;
    customer: AmploCustomer;
    items: { title: string; unitPrice: number; quantity: number; tangible: boolean }[];
    card: {
      number: string;
      holderName: string;
      expMonth: number;
      expYear: number;
      cvv: string;
    };
    callbackUrl?: string | undefined;
    tracking?: Record<string, string> | undefined;
    metadata?: Record<string, unknown> | undefined;
    onTransactionRequestStart?: (() => void) | undefined;
  }) {
    const amount = Math.round(input.amountCents);
    const catalog = await this.ensureCatalog();
    const pan = onlyDigits(input.card.number);
    const customer = customerData(input.customer);
    if (pan.length < 13 || pan.length > 19) throw new Error("ATOMOPAY_CARD_NUMBER_INVALID");

    const body: Record<string, unknown> = {
      amount,
      offer_hash: catalog.offerHash,
      payment_method: "credit_card",
      installments: Math.max(1, Math.round(input.installments)),
      card: {
        number: pan,
        holder_name: input.card.holderName,
        exp_month: input.card.expMonth,
        exp_year: input.card.expYear,
        cvv: onlyDigits(input.card.cvv),
      },
      customer,
      cart: input.items.map((i) => ({
        product_hash: catalog.productHash,
        title: i.title,
        cover: null,
        price: Math.round(i.unitPrice),
        quantity: i.quantity,
        operation_type: 1,
        tangible: false,
      })),
      transaction_origin: "api",
      ...(input.tracking ? { tracking: input.tracking } : {}),
      ...(input.callbackUrl ? { postback_url: input.callbackUrl } : {}),
    };

    // Somente a partir daqui existe uma tentativa REAL de criar a cobrança.
    // Falhas de catálogo/validação anteriores não podem deixar o checkout em loop.
    input.onTransactionRequestStart?.();
    const raw = ((await this.call<Record<string, any>>("POST", "/transactions", body)) ?? {}) as any;
    const tx = raw?.data ?? raw;
    const transactionHash = String(tx?.hash ?? tx?.id ?? "");
    if (!transactionHash) throw new Error("ATOMOPAY_TRANSACTION_HASH_MISSING");
    return {
      providerStatus: String(tx?.payment_status ?? tx?.status ?? "prossessing"),
      transactionHash,
      installments: Number(tx?.installments ?? input.installments),
      cardLast4: pan.slice(-4),
    };
  }

  async getBalance() {
    await this.listProducts();
    return { available: null, pending: null } as Record<string, unknown>;
  }
}

const SETTINGS_KEY = "atomopay_settings";

export type AtomoSettings = {
  pixEnabled: boolean;
  cardEnabled: boolean;
  maxInstallments: number;
  sandbox: boolean;
};

const DEFAULT_SETTINGS: AtomoSettings = {
  pixEnabled: true,
  cardEnabled: false,
  maxInstallments: 12,
  sandbox: false,
};

export async function getAtomoSettings(): Promise<AtomoSettings> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  const value = (data?.value ?? {}) as Partial<AtomoSettings>;
  return {
    pixEnabled: value.pixEnabled !== false,
    cardEnabled: value.cardEnabled === true,
    maxInstallments: Math.min(12, Math.max(1, Number(value.maxInstallments ?? 12))),
    sandbox: value.sandbox === true,
  };
}

export async function saveAtomoSettings(
  input: { [K in keyof AtomoSettings]?: AtomoSettings[K] | undefined },
) {
  const current = await getAtomoSettings();
  const next: AtomoSettings = {
    ...DEFAULT_SETTINGS,
    ...current,
    ...(input.pixEnabled !== undefined ? { pixEnabled: input.pixEnabled } : {}),
    ...(input.cardEnabled !== undefined ? { cardEnabled: input.cardEnabled } : {}),
    ...(input.maxInstallments !== undefined ? { maxInstallments: input.maxInstallments } : {}),
    ...(input.sandbox !== undefined ? { sandbox: input.sandbox } : {}),
  };
  next.maxInstallments = Math.min(12, Math.max(1, Math.round(next.maxInstallments)));
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    { key: SETTINGS_KEY, value: next as never, updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
  if (error) throw error;
  return next;
}

export async function saveAtomoCredentials(input: {
  publicKey?: string | undefined;
  secretKey?: string | undefined;
  webhookSecret?: string | undefined;
  baseUrl?: string | undefined;
  active?: boolean | undefined;
  updatedBy: string;
}) {
  return saveCredentialsFor({ provider: "atomopay", ...input });
}

export async function getAtomoSummary() {
  return getSummaryFor("atomopay");
}

export async function testAtomoCredentials(): Promise<{ ok: boolean; error?: string }> {
  try {
    const service = await AtomoPayService.create();
    await service.listProducts();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: sanitizeProviderText((e as Error).message) };
  }
}