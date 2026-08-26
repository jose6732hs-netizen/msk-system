/**
 * Integração com a AtomoPay (https://api.atomopay.com.br/api/public/v1).
 * Diferente da Amplo Pay/SigiloPay, a autenticação é por `api_token` na query
 * string e os valores trafegam em CENTAVOS. Somente servidor.
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

type AtomoCatalog = { productHash: string; offerHash: string };

function onlyDigits(v: string | undefined | null) {
  return String(v ?? "").replace(/\D+/g, "");
}

export class AtomoPayService {
  constructor(private creds: GatewayCredentials) {}

  static async create(): Promise<AtomoPayService> {
    const creds = await loadCredentialsFor("atomopay");
    if (!creds) {
      throw new Error(
        "GATEWAY_NAO_CONFIGURADO: cadastre o API Token da AtomoPay no painel Super Admin.",
      );
    }
    return new AtomoPayService(creds);
  }

  get webhookSecret() {
    return this.creds.webhookSecret;
  }

  private async call<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${this.creds.baseUrl}${path}${sep}api_token=${encodeURIComponent(this.creds.secretKey)}`;
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[atomopay] ${method} ${path} falhou [${res.status}]`, text.slice(0, 400));
      throw new Error(`AtomoPay [${res.status}]: ${text.slice(0, 400)}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return {} as T;
    }
  }

  /** Produtos da conta — GET /products */
  listProducts() {
    return this.call<Record<string, unknown>>("GET", "/products");
  }

  /** Categorias — GET /products/categories */
  listCategories() {
    return this.call<Record<string, unknown>>("GET", "/products/categories");
  }

  /** Cria produto — POST /products */
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

  /** Cria oferta — POST /products/{hash}/offers */
  createOffer(productHash: string, input: { title: string; amount: number }) {
    return this.call<Record<string, unknown>>("POST", `/products/${productHash}/offers`, {
      title: input.title,
      amount: input.amount,
    });
  }

  /**
   * Garante um produto + oferta padrão para roteirizar as cobranças do MSK.
   * O resultado é memorizado em app_settings para não bater na API a cada PIX.
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
    const cached = (saved?.value ?? {}) as Partial<AtomoCatalog>;
    if (cached.productHash && cached.offerHash) {
      return { productHash: cached.productHash, offerHash: cached.offerHash };
    }

    const listed = (await this.listProducts()) as Record<string, any>;
    const items: any[] = Array.isArray(listed) ? listed : (listed?.data ?? listed?.products ?? []);
    let product = items.find((p) => p?.hash);
    if (!product) {
      const created = (await this.createProduct({
        title: "MSK SISTEM",
        amount: 1000,
        salePage: "https://msksystem.online",
      })) as Record<string, any>;
      product = created?.data ?? created;
    }
    const productHash = String(product?.hash ?? product?.product_hash ?? "");
    if (!productHash) throw new Error("AtomoPay: não foi possível resolver o produto da conta.");

    const offers: any[] = product?.offers ?? product?.offer ?? [];
    let offerHash = String(offers.find((o) => o?.hash)?.hash ?? "");
    if (!offerHash) {
      const createdOffer = (await this.createOffer(productHash, {
        title: "MSK SISTEM",
        amount: 1000,
      })) as Record<string, any>;
      offerHash = String((createdOffer?.data ?? createdOffer)?.hash ?? "");
    }
    if (!offerHash) throw new Error("AtomoPay: não foi possível resolver a oferta da conta.");

    const catalog: AtomoCatalog = { productHash, offerHash };
    await supabaseAdmin.from("app_settings").upsert(
      { key: CATALOG_KEY, value: catalog as never, updated_at: new Date().toISOString() } as never,
      { onConflict: "key" },
    );
    return catalog;
  }

  /** Cobrança PIX — POST /transactions (valores em centavos). */
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
    const catalog = await this.ensureCatalog();
    const amount = Math.round(input.amountCents);

    const body: Record<string, unknown> = {
      amount,
      offer_hash: catalog.offerHash,
      payment_method: "pix",
      customer: {
        name: input.customer.name,
        email: input.customer.email,
        phone_number: onlyDigits(input.customer.phone) || "21999999999",
        document: onlyDigits(input.customer.document?.number) || "00000000000",
      },
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
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    const raw = (await this.call<Record<string, any>>("POST", "/transactions", body)) ?? {};
    const tx = raw?.data ?? raw;
    const pix = tx?.pix ?? tx?.pix_information ?? raw?.pix ?? {};

    const code =
      pix?.pix_qr_code ??
      pix?.qr_code ??
      pix?.payload ??
      pix?.code ??
      pix?.emv ??
      tx?.qr_code ??
      undefined;
    const base64 =
      pix?.pix_qr_code_base64 ?? pix?.qr_code_base64 ?? pix?.base64 ?? pix?.image ?? undefined;

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

  /** Consulta de transação — GET /transactions/{hash} */
  async getTransaction(transactionId: string) {
    const raw = await this.call<Record<string, any>>(
      "GET",
      `/transactions/${encodeURIComponent(transactionId)}`,
    );
    const tx = raw?.data ?? raw;
    return { ...tx, status: tx?.payment_status ?? tx?.status } as Record<string, unknown>;
  }

  /** A AtomoPay não expõe saldo público — o catálogo valida o token. */
  async getBalance() {
    await this.listProducts();
    return { available: null, pending: null } as Record<string, unknown>;
  }
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

/** Testa o API Token consultando o catálogo de produtos. */
export async function testAtomoCredentials(): Promise<{ ok: boolean; error?: string }> {
  try {
    const service = await AtomoPayService.create();
    await service.listProducts();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
