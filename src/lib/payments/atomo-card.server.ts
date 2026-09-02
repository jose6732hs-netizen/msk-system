import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCredentialsFor, type GatewayCredentials } from "./credentials.server";

const CATALOG_KEY = "atomopay_catalog";

type CatalogState = {
  productHash?: string;
  offerHash?: string;
  offersByAmount?: Record<string, string>;
};

type CustomerInput = {
  name: string;
  email: string;
  phone: string;
  document: string;
};

type CardInput = {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
};

function digits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

function sanitizeProviderText(value: string) {
  return String(value ?? "")
    .replace(/api_token=([^&\s]+)/gi, "api_token=[redacted]")
    .replace(/"?(?:number|card_number)"?\s*:\s*"?\d{12,19}"?/gi, '"number":"[card-redacted]"')
    .replace(/"?cvv"?\s*:\s*"?\d{3,4}"?/gi, '"cvv":"[redacted]"')
    .replace(/\b\d{12,19}\b/g, "[card-redacted]")
    .slice(0, 500);
}

async function callAtomo<T>(
  creds: GatewayCredentials,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${creds.baseUrl}${path}${separator}api_token=${encodeURIComponent(creds.secretKey)}`;
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (!response.ok) {
    const safe = sanitizeProviderText(text);
    console.error(`[atomopay-card] ${method} ${path} falhou [${response.status}]`, safe);
    throw new Error(`ATOMOPAY_HTTP_${response.status}: ${safe}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function unwrap(value: any) {
  return value?.data ?? value ?? {};
}

function offerPrice(offer: any) {
  return Number(offer?.price ?? offer?.amount ?? offer?.value ?? 0);
}

async function resolveCatalogForAmount(creds: GatewayCredentials, amountCents: number) {
  const envProduct = process.env["ATOMOPAY_PRODUCT_HASH"];
  const { data: row } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", CATALOG_KEY)
    .maybeSingle();
  const cached = (row?.value ?? {}) as CatalogState;
  let productHash = String(envProduct ?? cached.productHash ?? "");

  if (!productHash) {
    const listed = unwrap(await callAtomo<any>(creds, "GET", "/products"));
    const products = Array.isArray(listed) ? listed : (listed?.products ?? listed?.data ?? []);
    const product = products.find((item: any) =>
      String(item?.title ?? item?.name ?? "").trim().toUpperCase() === "MSK SISTEM",
    );
    productHash = String(product?.hash ?? product?.product_hash ?? "");
  }
  if (!productHash) throw new Error("ATOMOPAY_CATALOG_PRODUCT_MISSING");

  const amountKey = String(Math.round(amountCents));
  const cachedOffer = cached.offersByAmount?.[amountKey];
  if (cachedOffer) return { productHash, offerHash: cachedOffer };

  const productRaw = unwrap(
    await callAtomo<any>(creds, "GET", `/products/${encodeURIComponent(productHash)}`),
  );
  const offers = Array.isArray(productRaw?.offers)
    ? productRaw.offers
    : Array.isArray(productRaw?.offer)
      ? productRaw.offer
      : [];
  const matching = offers.find(
    (offer: any) => offer?.hash && offerPrice(offer) === Math.round(amountCents),
  );
  let offerHash = String(matching?.hash ?? "");

  if (!offerHash) {
    const createdRaw = unwrap(
      await callAtomo<any>(
        creds,
        "POST",
        `/products/${encodeURIComponent(productHash)}/offers`,
        {
          title: `MSK ${Math.round(amountCents)} centavos`,
          // A API da Átomo usa price na oferta. O uso anterior de amount
          // fazia a criação falhar e impedia o cartão de chegar em /transactions.
          price: Math.round(amountCents),
        },
      ),
    );
    offerHash = String(createdRaw?.hash ?? createdRaw?.offer_hash ?? "");
  }
  if (!offerHash) throw new Error("ATOMOPAY_CATALOG_OFFER_MISSING");

  const offersByAmount = { ...(cached.offersByAmount ?? {}), [amountKey]: offerHash };
  await supabaseAdmin.from("app_settings").upsert(
    {
      key: CATALOG_KEY,
      value: {
        ...cached,
        productHash,
        offerHash,
        offersByAmount,
      } as never,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "key" },
  );

  return { productHash, offerHash };
}

export async function createAtomoCardTransaction(input: {
  identifier: string;
  amountCents: number;
  installments: number;
  customer: CustomerInput;
  card: CardInput;
  callbackUrl?: string;
  onTransactionRequestStart?: () => void | Promise<void>;
}) {
  const creds = await loadCredentialsFor("atomopay");
  if (!creds) throw new Error("GATEWAY_NAO_CONFIGURADO");

  const amount = Math.round(input.amountCents);
  // Usa exatamente o mesmo catálogo aprovado do PIX (com split unidade × quantidade).
  // Antes o cartão lia o cache em formato antigo e enviava um offer_hash inválido,
  // o que fazia a AtomoPay responder HTTP 400 genérico.
  const { AtomoPayService } = await import("./atomo-pay.server");
  const catalog = await new AtomoPayService(creds).resolveApprovedCatalog(amount);
  const pan = digits(input.card.number);
  const cvv = digits(input.card.cvv);
  const phone = digits(input.customer.phone);
  const document = digits(input.customer.document);
  if (pan.length < 13 || pan.length > 19) throw new Error("ATOMOPAY_CARD_NUMBER_INVALID");
  if (cvv.length < 3 || cvv.length > 4) throw new Error("ATOMOPAY_CARD_CVV_INVALID");
  if (phone.length < 10 || phone.length > 13) throw new Error("ATOMOPAY_CUSTOMER_PHONE_INVALID");
  if (document.length !== 11 && document.length !== 14) throw new Error("ATOMOPAY_CUSTOMER_DOCUMENT_INVALID");

  const body: Record<string, unknown> = {
    amount,
    offer_hash: catalog.offerHash,
    payment_method: "credit_card",
    installments: Math.max(1, Math.round(input.installments)),
    card: {
      number: pan,
      holder_name: input.card.holderName.trim(),
      exp_month: input.card.expMonth,
      exp_year: input.card.expYear,
      cvv,
    },
    customer: {
      name: input.customer.name.trim(),
      email: input.customer.email.trim(),
      phone_number: phone,
      document,
    },
    cart: [
      {
        product_hash: catalog.productHash,
        offer_hash: catalog.offerHash,
        title: "MSK SISTEM",
        cover: null,
        price: catalog.unitPrice,
        quantity: catalog.quantity,
        operation_type: 1,
        tangible: false,
      },
    ],
    transaction_origin: "api",
    ...(input.callbackUrl ? { postback_url: input.callbackUrl } : {}),
  };

  // A marca no banco precisa existir antes do POST real, evitando estado ambíguo.
  await input.onTransactionRequestStart?.();
  const raw = unwrap(await callAtomo<any>(creds, "POST", "/transactions", body));
  const providerStatus = String(raw?.payment_status ?? raw?.status ?? "prossessing");
  const transactionHash = String(
    raw?.hash ?? raw?.transaction_hash ?? raw?.id ?? raw?.transaction_id ?? "",
  );

  // Uma recusa explícita é terminal mesmo se o gateway não devolver hash.
  if (!transactionHash && !["refused", "rejected", "failed"].includes(providerStatus.toLowerCase())) {
    throw new Error("ATOMOPAY_TRANSACTION_HASH_MISSING");
  }

  return {
    providerStatus,
    transactionHash,
    installments: Number(raw?.installments ?? input.installments),
    cardLast4: pan.slice(-4),
  };
}
