import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findLicenseByToken, isTrustedExtensionOrigin, rateLimit, signData, verifySignature } from "./license.server";

const db = supabaseAdmin as any;
const PROTOCOL = "ecdsa-p256-v1";
const PRIMARY_BUILD_FINGERPRINT = "10b9059601d7da7513399e29cb0c65101e537e20e6ad7cd819d211ffb83927a5";
const SESSION_TTL_MS = 10 * 60_000;
const CLOCK_SKEW_MS = 90_000;
const installationSchema = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const versionSchema = z.string().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/);
const extensionIdSchema = z.string().min(8).max(120).regex(/^[A-Za-z0-9._-]+$/);
const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const publicKeySchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().min(20).max(120),
  y: z.string().min(20).max(120),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional(),
});
const enrollSchema = z.object({ public_key_jwk: publicKeySchema, build_fingerprint: fingerprintSchema });
type PublicJwk = z.infer<typeof publicKeySchema>;

type DeviceIdentity = {
  userId: string;
  licenseId: string;
  installationId: string;
  version: string;
  extensionId: string;
};

type SecurityMetadata = {
  mode: "required";
  protocol: typeof PROTOCOL;
  public_key_jwk: PublicJwk;
  build_fingerprint: string;
  enrolled_at: string;
  last_verified_at?: string | null;
  last_post_counter?: number;
};

const encoder = new TextEncoder();

function approvedBuildFingerprints() {
  const configured = String(process.env['MSK_EXTENSION_APPROVED_FINGERPRINTS'] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[a-f0-9]{64}$/.test(value));
  return new Set([PRIMARY_BUILD_FINGERPRINT, ...configured]);
}

function isApprovedBuildFingerprint(value: string) {
  return approvedBuildFingerprints().has(value.toLowerCase());
}

function base64UrlEncode(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function base64UrlDecode(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function stablePublicJwk(jwk: PublicJwk) {
  return { kty: String(jwk.kty ?? ""), crv: String(jwk.crv ?? ""), x: String(jwk.x ?? ""), y: String(jwk.y ?? "") };
}

async function createSessionToken(identity: DeviceIdentity, fingerprint: string) {
  const now = Date.now();
  const payload = {
    v: 1,
    p: PROTOCOL,
    uid: identity.userId,
    lid: identity.licenseId,
    iid: identity.installationId,
    eid: identity.extensionId,
    ver: identity.version,
    fp: fingerprint,
    iat: now,
    exp: now + SESSION_TTL_MS,
    jti: crypto.randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = await signData(`extension_session_v1:${encoded}`);
  return { token: `${encoded}.${signature}`, payload };
}

async function readSessionToken(token: string) {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  if (!(await verifySignature(`extension_session_v1:${payloadPart}`, signaturePart))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (parsed?.v !== 1 || parsed?.p !== PROTOCOL || Number(parsed?.exp || 0) <= Date.now()) return null;
    return parsed as {
      v: number; p: string; uid: string; lid: string; iid: string; eid: string;
      ver: string; fp: string; iat: number; exp: number; jti: string;
    };
  } catch {
    return null;
  }
}

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = origin ? isTrustedExtensionOrigin(origin) : false;
  return {
    ...(allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": [
      "content-type", "authorization", "x-msk-installation-id", "x-msk-extension-version",
      "x-msk-extension-id", "x-msk-session", "x-msk-proof-version", "x-msk-timestamp",
      "x-msk-counter", "x-msk-body-sha256", "x-msk-signature", "x-msk-build-fingerprint",
    ].join(", "),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(request) },
  });
}

export function extensionSecurityPreflight(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function activeLicense(row: any) {
  if (!row || String(row.status) !== "active") return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  return true;
}

async function resolveLicense(request: Request) {
  const token = bearer(request);
  if (!token) return null;
  const direct = (await findLicenseByToken(token)) as any;
  if (activeLicense(direct)) return direct;

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return null;
  const { data: licenses } = await db
    .from("licenses")
    .select("id,user_id,status,starts_at,expires_at,created_at")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  return (licenses ?? []).find(activeLicense) ?? null;
}

function identityHints(request: Request) {
  return {
    installationId: String(request.headers.get("x-msk-installation-id") ?? "").trim(),
    version: String(request.headers.get("x-msk-extension-version") ?? "").trim(),
    extensionId: String(request.headers.get("x-msk-extension-id") ?? "").trim(),
  };
}

async function identityFromRequest(request: Request): Promise<DeviceIdentity | null> {
  const license = await resolveLicense(request);
  if (!license) return null;
  const hints = identityHints(request);
  if (
    !installationSchema.safeParse(hints.installationId).success ||
    !versionSchema.safeParse(hints.version).success ||
    !extensionIdSchema.safeParse(hints.extensionId).success
  ) return null;
  return {
    userId: String(license.user_id),
    licenseId: String(license.id),
    installationId: hints.installationId,
    version: hints.version,
    extensionId: hints.extensionId,
  };
}

function securityFromMetadata(metadata: unknown): SecurityMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)["security_v1"] as Record<string, unknown> | undefined;
  if (!value || value["mode"] !== "required" || value["protocol"] !== PROTOCOL) return null;
  const publicKey = publicKeySchema.safeParse(value["public_key_jwk"]);
  const fingerprint = fingerprintSchema.safeParse(value["build_fingerprint"]);
  if (!publicKey.success || !fingerprint.success) return null;
  return {
    mode: "required",
    protocol: PROTOCOL,
    public_key_jwk: publicKey.data,
    build_fingerprint: fingerprint.data.toLowerCase(),
    enrolled_at: String(value["enrolled_at"] ?? ""),
    last_verified_at: value["last_verified_at"] ? String(value["last_verified_at"]) : null,
    last_post_counter: Number(value["last_post_counter"] ?? 0) || 0,
  };
}

function mergeSecurityMetadata(metadata: unknown, security: SecurityMetadata) {
  const base = metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};
  return { ...base, security_v1: security };
}

function securityRejected(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)["security_v1_rejected"];
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function clearSecurityRejected(metadata: unknown) {
  const base = metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};
  delete base["security_v1_rejected"];
  return base;
}

async function markSuspicious(installationId: string, userId: string, reason: string) {
  await db
    .from("extension_installations")
    .update({ suspicious: true, suspicion_reason: reason, last_activity_at: new Date().toISOString() })
    .eq("installation_id", installationId)
    .eq("user_id", userId);
}

async function markSecurityRejected(installationId: string, userId: string, metadata: unknown, reason: string) {
  const base = metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};
  await db
    .from("extension_installations")
    .update({
      metadata: { ...base, security_v1_rejected: { reason, at: new Date().toISOString() } },
      suspicious: true,
      suspicion_reason: reason,
      last_activity_at: new Date().toISOString(),
    })
    .eq("installation_id", installationId)
    .eq("user_id", userId);
}

export async function handleExtensionSecuritySession(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const identity = await identityFromRequest(request);
  if (!identity) return json(request, { ok: false, code: "AUTH_REQUIRED", message: "Licença ou identidade da extensão inválida." }, 401);

  if (!(await rateLimit("extension-security-session", `${identity.userId}:${identity.installationId}`, 12))) {
    return json(request, { ok: false, code: "RATE_LIMITED", message: "Muitas tentativas de segurança em pouco tempo." }, 429);
  }

  const parsed = enrollSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(request, { ok: false, code: "INVALID_SECURITY_ENROLLMENT" }, 400);
  const fingerprint = parsed.data.build_fingerprint.toLowerCase();

  const { data: existing } = await db
    .from("extension_installations")
    .select("id,user_id,license_id,extension_id,first_extension_id,blocked,block_reason,suspicious,suspicion_reason,metadata")
    .eq("installation_id", identity.installationId)
    .maybeSingle();

  if (!isApprovedBuildFingerprint(fingerprint)) {
    const reason = "Fingerprint do pacote MSK não reconhecido.";
    if (existing?.id) {
      await markSecurityRejected(identity.installationId, identity.userId, existing.metadata, reason);
    } else {
      await db.from("extension_installations").insert({
        user_id: identity.userId,
        license_id: identity.licenseId,
        installation_id: identity.installationId,
        version: identity.version,
        extension_id: identity.extensionId,
        first_extension_id: identity.extensionId,
        suspicious: true,
        suspicion_reason: reason,
        metadata: { security_v1_rejected: { reason, at: new Date().toISOString() } },
        last_seen_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      });
    }
    return json(request, { ok: false, code: "BUILD_NOT_APPROVED", message: "Esta cópia do MSK Agente não corresponde a uma versão aprovada." }, 403);
  }

  if (existing?.user_id && String(existing.user_id) !== identity.userId) {
    return json(request, { ok: false, code: "INSTALLATION_OWNERSHIP_MISMATCH", message: "Esta instalação pertence a outra conta." }, 409);
  }
  if (existing?.blocked) {
    return json(request, { ok: false, code: "INSTALLATION_BLOCKED", message: existing.block_reason || "Instalação bloqueada." }, 403);
  }

  const oldSecurity = securityFromMetadata(existing?.metadata);
  const incomingJwk = stablePublicJwk(parsed.data.public_key_jwk);
  if (oldSecurity) {
    const oldJwk = stablePublicJwk(oldSecurity.public_key_jwk);
    if (JSON.stringify(oldJwk) !== JSON.stringify(incomingJwk)) {
      await markSuspicious(identity.installationId, identity.userId, "Chave privada do dispositivo mudou.");
      return json(request, { ok: false, code: "DEVICE_KEY_MISMATCH", message: "Esta instalação precisa ser reconectada pelo suporte MSK." }, 409);
    }
    if (oldSecurity.build_fingerprint !== fingerprint) {
      await markSuspicious(identity.installationId, identity.userId, "Fingerprint do build mudou na mesma instalação.");
      return json(request, { ok: false, code: "BUILD_FINGERPRINT_MISMATCH" }, 409);
    }
  }

  const firstExtensionId = String(existing?.first_extension_id ?? "");
  if (firstExtensionId && firstExtensionId !== identity.extensionId) {
    await markSuspicious(identity.installationId, identity.userId, "ID da extensão mudou na mesma instalação.");
    return json(request, { ok: false, code: "EXTENSION_ID_MISMATCH", message: "Identidade da extensão alterada." }, 409);
  }

  const now = new Date().toISOString();
  const security: SecurityMetadata = oldSecurity ?? {
    mode: "required",
    protocol: PROTOCOL,
    public_key_jwk: parsed.data.public_key_jwk,
    build_fingerprint: fingerprint,
    enrolled_at: now,
    last_verified_at: null,
    last_post_counter: 0,
  };
  const metadata = mergeSecurityMetadata(clearSecurityRejected(existing?.metadata), security);

  if (existing?.id) {
    const { error } = await db
      .from("extension_installations")
      .update({
        license_id: identity.licenseId,
        version: identity.version,
        extension_id: identity.extensionId,
        first_extension_id: firstExtensionId || identity.extensionId,
        metadata,
        last_seen_at: now,
        last_activity_at: now,
      })
      .eq("id", existing.id)
      .eq("user_id", identity.userId);
    if (error) return json(request, { ok: false, code: "SECURITY_STORE_FAILED" }, 503);
  } else {
    const { error } = await db.from("extension_installations").insert({
      user_id: identity.userId,
      license_id: identity.licenseId,
      installation_id: identity.installationId,
      version: identity.version,
      extension_id: identity.extensionId,
      first_extension_id: identity.extensionId,
      metadata,
      last_seen_at: now,
      last_activity_at: now,
    });
    if (error) return json(request, { ok: false, code: "SECURITY_STORE_FAILED" }, 503);
  }

  const session = await createSessionToken(identity, fingerprint);
  return json(request, {
    ok: true,
    required: true,
    protocol: PROTOCOL,
    session_token: session.token,
    session_jti: session.payload.jti,
    expires_at: new Date(session.payload.exp).toISOString(),
  });
}

async function sha256Base64Url(data: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data as unknown as BufferSource));
  return base64UrlEncode(digest);
}

async function bodyHash(request: Request) {
  const bytes = new Uint8Array(await request.clone().arrayBuffer());
  return sha256Base64Url(bytes);
}

async function verifyDeviceSignature(publicKeyJwk: PublicJwk, canonical: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey("jwk", publicKeyJwk as JsonWebKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlDecode(signature),
      encoder.encode(canonical),
    );
  } catch {
    return false;
  }
}

function requestPath(request: Request) {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

export async function enforceExtensionDeviceSecurity(request: Request): Promise<Response | null> {
  const hints = identityHints(request);
  if (!installationSchema.safeParse(hints.installationId).success) return null;

  const license = await resolveLicense(request);
  if (!license) return null;

  const { data: row } = await db
    .from("extension_installations")
    .select("id,user_id,license_id,extension_id,first_extension_id,blocked,block_reason,metadata")
    .eq("installation_id", hints.installationId)
    .eq("user_id", license.user_id)
    .maybeSingle();
  if (!row) return null;

  if (securityRejected(row.metadata)) {
    return json(request, { ok: false, code: "SECURITY_ENROLLMENT_REJECTED", message: "Esta cópia da extensão não foi aprovada pelo servidor MSK." }, 403);
  }
  const security = securityFromMetadata(row.metadata);
  if (!security) return null;

  if (row.blocked) return json(request, { ok: false, code: "INSTALLATION_BLOCKED", message: row.block_reason || "Instalação bloqueada." }, 403);
  if (!versionSchema.safeParse(hints.version).success || !extensionIdSchema.safeParse(hints.extensionId).success) {
    return json(request, { ok: false, code: "SECURITY_IDENTITY_REQUIRED" }, 401);
  }
  if (String(row.first_extension_id || row.extension_id || "") !== hints.extensionId) {
    await markSuspicious(hints.installationId, String(license.user_id), "ID da extensão não corresponde à instalação protegida.");
    return json(request, { ok: false, code: "EXTENSION_ID_MISMATCH" }, 409);
  }

  const buildFingerprint = String(request.headers.get("x-msk-build-fingerprint") ?? "").toLowerCase();
  if (buildFingerprint !== security.build_fingerprint || !isApprovedBuildFingerprint(buildFingerprint)) {
    await markSuspicious(hints.installationId, String(license.user_id), "Fingerprint divergente em requisição protegida.");
    return json(request, { ok: false, code: "BUILD_FINGERPRINT_MISMATCH" }, 409);
  }

  const sessionToken = String(request.headers.get("x-msk-session") ?? "").trim();
  const session = await readSessionToken(sessionToken);
  if (!session) return json(request, { ok: false, code: "SECURITY_SESSION_REQUIRED", message: "Sessão segura expirada. Tente novamente." }, 401);
  if (
    session.uid !== String(license.user_id) ||
    session.lid !== String(license.id) ||
    session.iid !== hints.installationId ||
    session.eid !== hints.extensionId ||
    session.ver !== hints.version ||
    session.fp !== buildFingerprint
  ) return json(request, { ok: false, code: "SECURITY_SESSION_MISMATCH" }, 401);

  const proofVersion = request.headers.get("x-msk-proof-version");
  const timestamp = Number(request.headers.get("x-msk-timestamp") ?? 0);
  const counter = Number(request.headers.get("x-msk-counter") ?? 0);
  const claimedBodyHash = String(request.headers.get("x-msk-body-sha256") ?? "");
  const signature = String(request.headers.get("x-msk-signature") ?? "");
  if (proofVersion !== "1" || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > CLOCK_SKEW_MS) {
    return json(request, { ok: false, code: "SECURITY_PROOF_EXPIRED" }, 401);
  }
  if (!Number.isSafeInteger(counter) || counter <= 0 || !signature) {
    return json(request, { ok: false, code: "SECURITY_PROOF_INVALID" }, 401);
  }

  const actualBodyHash = await bodyHash(request);
  if (claimedBodyHash !== actualBodyHash) return json(request, { ok: false, code: "SECURITY_BODY_MISMATCH" }, 401);

  const canonical = [
    request.method.toUpperCase(), requestPath(request), String(timestamp), String(counter), actualBodyHash,
    hints.installationId, hints.extensionId, hints.version, session.jti,
  ].join("\n");
  if (!(await verifyDeviceSignature(security.public_key_jwk, canonical, signature))) {
    await markSuspicious(hints.installationId, String(license.user_id), "Assinatura criptográfica inválida.");
    return json(request, { ok: false, code: "SECURITY_SIGNATURE_INVALID" }, 401);
  }

  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const lastCounter = Number(security.last_post_counter || 0);
    if (counter <= lastCounter) return json(request, { ok: false, code: "SECURITY_REPLAY_BLOCKED" }, 409);
    const updatedSecurity = { ...security, last_post_counter: counter, last_verified_at: new Date().toISOString() };
    await db
      .from("extension_installations")
      .update({ metadata: mergeSecurityMetadata(row.metadata, updatedSecurity), last_activity_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("user_id", license.user_id);
  }

  return null;
}
