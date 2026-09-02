import { loadCredentialsFor, type GatewayCredentials } from "./credentials.server";

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

function unwrap(value: any) {
  return value?.data ?? value ?? {};
}

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
    const error = new Error(`ATOMOPAY_HTTP_${response.status}: ${safe}`) as Error & {
      httpStatus?: number;
    };
    error.httpStatus = response.status;
    throw error;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
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

  const installments = Math.max(1, Math.round(input.installments));
  const expMonth = String(input.card.expMonth).padStart(2, "0");
  const expYear4 = String(input.card.expYear).length === 2
    ? `20${input.card.expYear}`
    : String(input.card.expYear);
  const expYear2 = expYear4.slice(-2);
  const holder = input.card.holderName.trim();

  const commonBody: Record<string, unknown> = {
    amount,
    offer_hash: catalog.offerHash,
    payment_method: "credit_card",
    installments,
    customer: {
      name: input.customer.name.trim(),
      email: input.customer.email.trim(),
      phone_number: phone,
      phone,
      document,
      document_type: document.length === 14 ? "cnpj" : "cpf",
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
    expire_in_days: 1,
    transaction_origin: "api",
    ...(input.callbackUrl ? { postback_url: input.callbackUrl } : {}),
  };

  // A AtomoPay já rejeitou (HTTP 400 genérico) o formato aninhado `card`.
  // Enviamos os formatos aceitos pela família de API em ordem, parando no
  // primeiro que o gateway aceitar — um 400 significa que nada foi cobrado.
  const variants: Record<string, unknown>[] = [
    {
      ...commonBody,
      card: {
        number: pan,
        holder_name: holder,
        exp_month: Number(expMonth),
        exp_year: Number(expYear4),
        cvv,
      },
      card_number: pan,
      card_holder_name: holder,
      card_expiration_month: Number(expMonth),
      card_expiration_year: Number(expYear4),
      card_cvv: cvv,
    },
    {
      ...commonBody,
      card_number: pan,
      card_holder_name: holder,
      card_expiration_month: expMonth,
      card_expiration_year: expYear2,
      card_cvv: cvv,
    },
    {
      ...commonBody,
      credit_card: {
        number: pan,
        holder_name: holder,
        expiration_month: Number(expMonth),
        expiration_year: Number(expYear4),
        cvv,
      },
    },
  ];

  // A marca no banco precisa existir antes do POST real, evitando estado ambíguo.
  await input.onTransactionRequestStart?.();

  let raw: any = null;
  let lastError: unknown = null;
  for (let i = 0; i < variants.length; i += 1) {
    try {
      raw = unwrap(await callAtomo<any>(creds, "POST", "/transactions", variants[i]));
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const status = (error as { httpStatus?: number }).httpStatus;
      // Só tentamos outro formato quando o gateway recusou o payload (400/422).
      if (status !== 400 && status !== 422) throw error;
      console.error(`[atomopay-card] formato ${i + 1} recusado, tentando próximo`);
    }
  }
  if (lastError) throw lastError;

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
