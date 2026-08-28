/**
 * Núcleo de licenciamento do MSK SISTEM.
 * Roda SOMENTE no servidor. Nunca importar em componentes.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolvePlanDuration } from "./plan-duration";

const TOKEN_PREFIX = "MSK";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I,O,0,1

function randomBytes(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

function encKey() {
  const raw = process.env["LICENSE_ENCRYPTION_KEY"];
  if (!raw) throw new Error("LICENSE_ENCRYPTION_KEY não configurada");
  return raw;
}

/** Token criptograficamente aleatório: MSK-XXXX-XXXX-XXXX-XXXX (~100 bits) */
export function generateLicenseToken(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    const bytes = randomBytes(4);
    let s = "";
    for (let i = 0; i < 4; i++) s += ALPHABET[bytes[i]! % ALPHABET.length];
    groups.push(s);
  }
  return `${TOKEN_PREFIX}-${groups.join("-")}`;
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signData(data: string): Promise<string> {
  const keyMaterial = new TextEncoder().encode(encKey());
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toHex(sig);
}

export async function verifySignature(data: string, signature: string): Promise<boolean> {
  try {
    const expected = await signData(data);
    return signature === expected;
  } catch {
    return false;
  }
}

/** Hash com pepper do servidor — só o hash é usado para lookup/validação. */
export async function hashToken(token: string): Promise<string> {
  const tokenStr = token.trim().toUpperCase();
  const key = encKey();
  const payload = `${key}::${tokenStr}`;
  const data = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = toHex(hashBuffer);
  return hash;
}

export async function hashValue(value: string): Promise<string> {
  const data = new TextEncoder().encode(`${encKey()}::v1::${value}`);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

async function aesKey() {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(encKey()),
  );
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(token: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(),
    new TextEncoder().encode(token),
  );
  return `${toHex(iv.buffer as ArrayBuffer)}.${toHex(ct)}`;
}

export async function decryptToken(payload: string): Promise<string | null> {
  try {
    const [ivHex, ctHex] = payload.split(".");
    if (!ivHex || !ctHex) return null;
    const hexToBuf = (h: string) =>
      new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: hexToBuf(ivHex) },
      await aesKey(),
      hexToBuf(ctHex),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export function maskToken(token: string): string {
  const last4 = token.slice(-4);
  return `MSK-****-****-****-${last4}`;
}

export async function logEvent(input: {
  license_id?: string | null;
  user_id?: string | null;
  event_type: string;
  device_hash?: string | null;
  metadata?: Record<string, unknown>;
}) {
  // Nunca registrar o token em claro nos logs.
  await supabaseAdmin.from("license_events").insert({
    license_id: input.license_id ?? null,
    user_id: input.user_id ?? null,
    event_type: input.event_type,
    device_hash: input.device_hash ?? null,
    metadata: (input.metadata ?? {}) as never,
  });
}

export async function rateLimit(bucket: string, identifier: string, limit: number) {
  const { data, error } = await supabaseAdmin.rpc("consume_rate_limit" as any, {
    _bucket: bucket,
    _identifier: identifier,
    _limit: limit,
  });
  if (error) return true; // não bloquear por falha de infraestrutura
  return data !== false;
}

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export type ResolvedLicense = {
  id: string;
  user_id: string;
  plan_id: string;
  subscription_id: string | null;
  status: string;
  expires_at: string | null;
  max_devices: number;
  plan: { slug: string; name: string; features: Record<string, boolean> } | null;
};

const LICENSE_SELECT =
  "id,user_id,plan_id,subscription_id,status,expires_at,max_devices,activated_at,type,metadata,plans(slug,name,features,price,allow_trial,is_lifetime,duration_label,duration_days,duration_value,duration_unit)";

/** Busca licença pelo hash e aplica reconciliação/expiração automática. */
export async function findLicenseByToken(token: string) {
  const token_hash = await hashToken(token);
  const { data } = await supabaseAdmin
    .from("licenses")
    .select(LICENSE_SELECT)
    .eq("token_hash", token_hash)
    .maybeSingle();
  if (!data) return null;
  return applyExpiry(data as never);
}

/**
 * Corrige automaticamente trials antigos cuja expiração ficou diferente da
 * validade visível do plano. Isso impede um FREE de 15 minutos de continuar
 * válido por 30 dias por causa de campos legados inconsistentes.
 */
async function reconcileTrialDuration(license: Record<string, unknown>) {
  const type = String(license["type"] ?? "").toLowerCase();
  if (type !== "trial" && type !== "test") return license;

  const plan = license["plans"] as Record<string, any> | null | undefined;
  const activatedAt = license["activated_at"] as string | null | undefined;
  if (!plan || !activatedAt) return license;

  try {
    const resolved = resolvePlanDuration(plan);
    if (resolved.lifetime || !resolved.milliseconds) return license;

    const expectedMs = new Date(activatedAt).getTime() + resolved.milliseconds;
    const currentIso = license["expires_at"] as string | null;
    const currentMs = currentIso ? new Date(currentIso).getTime() : 0;
    const mismatch = !currentMs || Math.abs(currentMs - expectedMs) > 30_000;
    if (!mismatch) return license;

    const nextStatus = expectedMs <= Date.now() ? "expired" : "active";
    const metadata = {
      ...((license["metadata"] ?? {}) as Record<string, any>),
      plan_duration_value_snapshot: resolved.value,
      plan_duration_unit_snapshot: resolved.unit,
      plan_duration_label_snapshot: resolved.label,
      repaired_duration_at: new Date().toISOString(),
    };

    const expiresAt = new Date(expectedMs).toISOString();
    const { error } = await supabaseAdmin
      .from("licenses")
      .update({ expires_at: expiresAt, status: nextStatus, metadata } as never)
      .eq("id", license["id"] as string);

    if (!error) {
      license["expires_at"] = expiresAt;
      license["status"] = nextStatus;
      license["metadata"] = metadata;
      await logEvent({
        license_id: license["id"] as string,
        user_id: license["user_id"] as string,
        event_type: "duration_reconciled",
        metadata: { duration: resolved.label },
      });
    }
  } catch (error) {
    console.error("[license] Falha ao reconciliar duração do trial:", error);
  }

  return license;
}

export async function applyExpiry(license: Record<string, unknown>) {
  await reconcileTrialDuration(license);

  const expires = license["expires_at"] as string | null;
  const status = license["status"] as string;
  if (
    expires &&
    new Date(expires).getTime() < Date.now() &&
    (status === "active" || status === "inactive")
  ) {
    await supabaseAdmin
      .from("licenses")
      .update({ status: "expired" })
      .eq("id", license["id"] as string);
    license["status"] = "expired";
    await logEvent({
      license_id: license["id"] as string,
      user_id: license["user_id"] as string,
      event_type: "expired",
    });
  }
  return license as never;
}

export function lockedFeatures() {
  return { chat: false, projects: false, download: false, background_tools: false };
}

/**
 * CORS restritivo.
 *
 * `EXTENSION_ORIGIN` aceita uma lista separada por vírgula com as origens
 * autorizadas, por exemplo:
 *   chrome-extension://abcdefghijklmnopabcdefghijklmnop,https://msk-keymaster.lovable.app
 *
 * Regras:
 *  - Se a lista estiver configurada, apenas origens nela recebem
 *    `access-control-allow-origin` (a origem é refletida, nunca "*").
 *  - Requisições sem cabeçalho `origin` (a própria extensão em MV3, cURL,
 *    servidores) não são afetadas por CORS e continuam funcionando.
 *  - Sem a variável configurada, mantemos "*" para não quebrar instalações
 *    existentes enquanto o ID da extensão não é informado.
 */
export function allowedOrigins(): string[] {
  const configured = process.env["EXTENSION_ORIGIN"] || "";
  const knownExtension = "chrome-extension://hhjainkbpllpglinfpnfafpefoljfmao";
  return `${configured},${knownExtension}`
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Qualquer extensão instalada (o ID muda por instalação em modo desenvolvedor)
 * e os content scripts rodando dentro do Lovable precisam ser aceitos, além das
 * origens explicitamente configuradas em `EXTENSION_ORIGIN`.
 */
export function isTrustedExtensionOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin.startsWith("chrome-extension://")) return true;
  if (origin.startsWith("moz-extension://")) return true;
  if (origin.startsWith("safari-web-extension://")) return true;
  if (origin === "https://lovable.dev" || origin.endsWith(".lovable.dev")) return true;
  if (origin.endsWith(".lovable.app") || origin.endsWith(".lovableproject.com")) return true;
  if (origin === "https://msksystem.online" || origin === "https://www.msksystem.online") return true;
  return allowedOrigins().includes(origin);
}

export function allowedOrigin(request?: Request): string {
  const origin = request?.headers.get("origin")?.trim() ?? "";
  if (!origin) return "*";
  if (isTrustedExtensionOrigin(origin)) return origin;
  return allowedOrigins()[0] ?? "*";
}

export function corsHeaders(request?: Request): Record<string, string> {
  return {
    "access-control-allow-origin": allowedOrigin(request),
    "access-control-allow-headers": "content-type, authorization, x-msk-installation-id, x-msk-extension-version",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    vary: "Origin",
  };
}


export function jsonResponse(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(request),
      "cache-control": "no-store",
    },
  });
}

export function preflight(request?: Request) {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(request), "access-control-max-age": "86400" },
  });
}

/** Cria (ou renova) licença a partir de uma assinatura paga. */
export async function issueOrRenewLicense(params: {
  userId: string;
  planId: string;
  subscriptionId: string;
}) {
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", params.planId)
    .single();
  if (!plan) throw new Error("Plano não encontrado");

  const now = new Date();
  const resolved = resolvePlanDuration(plan);
  const addDuration = (from: Date) =>
    resolved.lifetime || !resolved.milliseconds
      ? null
      : new Date(from.getTime() + resolved.milliseconds).toISOString();

  const { data: existing } = await supabaseAdmin
    .from("licenses")
    .select("id,expires_at,status")
    .eq("user_id", params.userId)
    .eq("subscription_id", params.subscriptionId)
    .maybeSingle();

  if (existing) {
    // Renovação: estende a validade, mantém o MESMO token.
    const base =
      existing.expires_at && new Date(existing.expires_at) > now
        ? new Date(existing.expires_at)
        : now;
    await supabaseAdmin
      .from("licenses")
      .update({
        status: "active",
        expires_at: addDuration(base),
        plan_id: plan.id,
        max_devices: plan.max_devices,
        revoked_at: null,
        revocation_reason: null,
      })
      .eq("id", existing.id);
    await logEvent({
      license_id: existing.id,
      user_id: params.userId,
      event_type: "renewed",
      metadata: { plan: plan.slug, duration: resolved.label },
    });
    return { licenseId: existing.id, created: false };
  }

  const token = generateLicenseToken();
  const { data: created, error } = await supabaseAdmin
    .from("licenses")
    .insert({
      user_id: params.userId,
      plan_id: plan.id,
      subscription_id: params.subscriptionId,
      token_hash: await hashToken(token),
      token_encrypted: await encryptToken(token),
      token_last4: token.slice(-4),
      token_preview: maskToken(token),
      status: "inactive",
      activated_at: null,
      expires_at: addDuration(now),
      max_devices: plan.max_devices,
      metadata: {
        plan_duration_value_snapshot: resolved.value,
        plan_duration_unit_snapshot: resolved.unit,
        plan_duration_label_snapshot: resolved.label,
      },
    })
    .select("id")
    .single();
  if (error) throw error;

  await logEvent({
    license_id: created.id,
    user_id: params.userId,
    event_type: "license_created",
    metadata: { plan: plan.slug, duration: resolved.label },
  });
  return { licenseId: created.id, created: true };
}
