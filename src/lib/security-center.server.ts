import { z } from "zod";
import { supabaseServer } from "@/integrations/supabase/client.server";
import { hashToken, isTrustedExtensionOrigin, signData, verifySignature } from "./license.server";

const db = supabaseServer as any;
const SESSION_PROTOCOL = "msk-security-session-v1";
const SESSION_AUDIENCE = "msk-protected-api";
const SESSION_TTL_MS = 10 * 60_000;
const CLOCK_SKEW_MS = 2 * 60_000;
const installationSchema = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const versionSchema = z.string().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/);
const extensionIdSchema = z.string().min(8).max(120).regex(/^[A-Za-z0-9._-]+$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const buildIdSchema = z.string().min(3).max(160).regex(/^[A-Za-z0-9._:-]+$/);
const publicKeySchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().min(20).max(120),
  y: z.string().min(20).max(120),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional(),
});

const challengeSchema = z.object({ installation_id: installationSchema.optional() });
const handshakeSchema = z.object({
  nonce: z.string().uuid(),
  build_id: buildIdSchema,
  manifest_hash: hashSchema,
  build_fingerprint: hashSchema.optional().nullable(),
  integrity_ok: z.boolean(),
  integrity_manifest_version: z.string().max(80).optional().nullable(),
  timestamp: z.number().int().positive(),
  public_key_jwk: publicKeySchema.optional().nullable(),
  challenge_signature: z.string().min(40).max(500),
  browser_name: z.string().max(80).optional().nullable(),
  browser_version: z.string().max(80).optional().nullable(),
  os_family: z.string().max(80).optional().nullable(),
  critical_files: z.array(z.object({
    file: z.string().max(260),
    expected_hash: hashSchema.optional().nullable(),
    received_hash: hashSchema.optional().nullable(),
  })).max(50).optional().default([]),
});

type SecuritySessionPayload = {
  v: 1;
  p: typeof SESSION_PROTOCOL;
  aud: typeof SESSION_AUDIENCE;
  uid: string;
  lid: string;
  iid: string;
  bid: string;
  sid: string;
  iat: number;
  exp: number;
  jti: string;
};

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = !origin || isTrustedExtensionOrigin(origin);
  return {
    ...(origin && allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": [
      "content-type", "authorization", "x-msk-license", "x-msk-installation-id",
      "x-msk-extension-version", "x-msk-extension-id", "x-msk-security-session",
    ].join(", "),
    "access-control-allow-methods": "POST, OPTIONS",
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

export function securityCenterPreflight(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

function clientIp(request: Request) {
  const raw = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") ?? "").split(",")[0] || "";
  const value = raw.trim();
  return value && value.length <= 60 ? value : null;
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function licenseToken(request: Request) {
  const explicit = String(request.headers.get("x-msk-license") ?? "").trim();
  if (explicit) return explicit;
  const value = bearer(request);
  return /^MSK-/i.test(value) ? value : "";
}

function identityHints(request: Request) {
  return {
    installationId: String(request.headers.get("x-msk-installation-id") ?? "").trim(),
    version: String(request.headers.get("x-msk-extension-version") ?? "").trim(),
    extensionId: String(request.headers.get("x-msk-extension-id") ?? "").trim(),
  };
}

function firstRow<T = Record<string, any>>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value && typeof value === "object" ? (value as T) : null;
}

function stableJwk(jwk: z.infer<typeof publicKeySchema>) {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

function base64UrlDecode(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyDeviceSignature(jwk: z.infer<typeof publicKeySchema>, canonical: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey("jwk", jwk as JsonWebKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlDecode(signature),
      new TextEncoder().encode(canonical),
    );
  } catch {
    return false;
  }
}

async function createSignedSession(payload: SecuritySessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = await signData(`${SESSION_PROTOCOL}:${encoded}`);
  return `${encoded}.${signature}`;
}

async function readSignedSession(token: string): Promise<SecuritySessionPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!(await verifySignature(`${SESSION_PROTOCOL}:${encoded}`, signature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SecuritySessionPayload;
    if (payload.v !== 1 || payload.p !== SESSION_PROTOCOL || payload.aud !== SESSION_AUDIENCE) return null;
    if (!payload.sid || !payload.iid || !payload.bid || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function handleSecurityChallenge(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) return json(request, { ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
  const body = challengeSchema.safeParse(await request.json().catch(() => ({})));
  const fromHeader = identityHints(request).installationId;
  const installationId = body.success ? (body.data.installation_id || fromHeader) : fromHeader;
  if (!installationSchema.safeParse(installationId).success) return json(request, { ok: false, code: "INVALID_INSTALLATION_ID" }, 400);

  const { data, error } = await db.rpc("security_issue_nonce", {
    p_installation_id: installationId,
    p_purpose: "handshake",
    p_ip: clientIp(request),
  });
  if (error) return json(request, { ok: false, code: "SECURITY_CHALLENGE_FAILED" }, 503);
  const row = firstRow<{ nonce: string; expires_at: string }>(data);
  if (!row?.nonce) return json(request, { ok: false, code: "SECURITY_CHALLENGE_FAILED" }, 503);
  return json(request, { ok: true, nonce: row.nonce, expires_at: row.expires_at, protocol: "msk-security-v1" });
}

export async function handleSecurityHandshake(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) return json(request, { ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);

  const rawLicense = licenseToken(request);
  if (!rawLicense) return json(request, { ok: false, code: "LICENSE_REQUIRED" }, 401);
  const hints = identityHints(request);
  if (!installationSchema.safeParse(hints.installationId).success || !versionSchema.safeParse(hints.version).success || !extensionIdSchema.safeParse(hints.extensionId).success) {
    return json(request, { ok: false, code: "INVALID_EXTENSION_IDENTITY" }, 400);
  }

  const parsed = handshakeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(request, { ok: false, code: "INVALID_HANDSHAKE" }, 400);
  const body = parsed.data;
  if (Math.abs(Date.now() - body.timestamp) > CLOCK_SKEW_MS) return json(request, { ok: false, code: "MSK_CHALLENGE_EXPIRED" }, 401);

  const tokenHash = await hashToken(rawLicense);
  const { data: contextData, error: contextError } = await db.rpc("security_device_context", {
    p_token_hash: tokenHash,
    p_installation_id: hints.installationId,
  });
  if (contextError) return json(request, { ok: false, code: "SECURITY_CONTEXT_FAILED" }, 503);
  const context = firstRow<any>(contextData);
  if (!context?.resolved_license_id) return json(request, { ok: false, code: "LICENSE_INVALID" }, 401);
  if (context.stored_extension_id && String(context.stored_extension_id) !== hints.extensionId) {
    return json(request, { ok: false, code: "MSK_INSTALLATION_CLONED" }, 403);
  }

  const storedKey = publicKeySchema.safeParse(context.stored_public_key_jwk);
  const incomingKey = publicKeySchema.safeParse(body.public_key_jwk);
  const key = storedKey.success ? storedKey.data : incomingKey.success ? incomingKey.data : null;
  if (!key) return json(request, { ok: false, code: "DEVICE_PUBLIC_KEY_REQUIRED" }, 401);
  if (storedKey.success && incomingKey.success && JSON.stringify(stableJwk(storedKey.data)) !== JSON.stringify(stableJwk(incomingKey.data))) {
    return json(request, { ok: false, code: "DEVICE_KEY_MISMATCH" }, 409);
  }

  const canonical = [
    "MSK_SECURITY_V1",
    body.nonce,
    hints.installationId,
    body.build_id,
    hints.version,
    hints.extensionId,
    body.manifest_hash.toLowerCase(),
    String(body.timestamp),
  ].join("\n");
  if (!(await verifyDeviceSignature(key, canonical, body.challenge_signature))) {
    return json(request, { ok: false, code: "MSK_SECURITY_SIGNATURE_INVALID" }, 401);
  }

  const keyHash = await sha256Hex(JSON.stringify(stableJwk(key)));
  const integrityOk = body.integrity_ok && body.critical_files.length === 0;
  const safeCriticalFiles = body.critical_files.map((file) => ({
    file: file.file.slice(0, 260),
    expected_hash: file.expected_hash ?? null,
    received_hash: file.received_hash ?? null,
  }));
  const metadata = {
    device_public_key_hash: keyHash,
    device_public_key_jwk: stableJwk(key),
    critical_files: safeCriticalFiles,
    challenge_verified: true,
    protocol: "msk-security-v1",
  };

  const { data: handshakeData, error: handshakeError } = await db.rpc("security_register_handshake", {
    p_token_hash: tokenHash,
    p_nonce: body.nonce,
    p_installation_id: hints.installationId,
    p_build_id: body.build_id,
    p_extension_version: hints.version,
    p_extension_id: hints.extensionId,
    p_manifest_hash: body.manifest_hash.toLowerCase(),
    p_build_fingerprint: body.build_fingerprint?.toLowerCase() ?? null,
    p_integrity_ok: integrityOk,
    p_integrity_manifest_version: body.integrity_manifest_version ?? null,
    p_browser_name: body.browser_name ?? null,
    p_browser_version: body.browser_version ?? null,
    p_os_family: body.os_family ?? null,
    p_ip: clientIp(request),
    p_metadata: metadata,
  });
  if (handshakeError) return json(request, { ok: false, code: "SECURITY_HANDSHAKE_FAILED" }, 503);
  const handshake = firstRow<any>(handshakeData);
  if (!handshake?.ok) return json(request, { ok: false, code: handshake?.code || "SECURITY_HANDSHAKE_REJECTED" }, 403);

  const sessionId = crypto.randomUUID();
  const { data: sessionData, error: sessionError } = await db.rpc("security_create_session", {
    p_token_hash: tokenHash,
    p_installation_id: hints.installationId,
    p_build_id: body.build_id,
    p_session_id: sessionId,
    p_ttl_seconds: 600,
    p_ip: clientIp(request),
    p_metadata: { protocol: "msk-security-v1" },
  });
  if (sessionError) return json(request, { ok: false, code: "SECURITY_SESSION_FAILED" }, 503);
  const session = firstRow<any>(sessionData);
  if (!session?.created) return json(request, { ok: false, code: session?.code || "SECURITY_SESSION_REJECTED" }, 403);

  const now = Date.now();
  const exp = Math.min(new Date(session.expires_at).getTime(), now + SESSION_TTL_MS);
  const payload: SecuritySessionPayload = {
    v: 1,
    p: SESSION_PROTOCOL,
    aud: SESSION_AUDIENCE,
    uid: String(handshake.resolved_user_id),
    lid: String(handshake.resolved_license_id),
    iid: hints.installationId,
    bid: body.build_id,
    sid: sessionId,
    iat: now,
    exp,
    jti: crypto.randomUUID(),
  };
  const token = await createSignedSession(payload);
  return json(request, {
    ok: true,
    code: "OK",
    trust_status: handshake.resolved_trust_status,
    session_token: token,
    session_id: sessionId,
    expires_at: new Date(exp).toISOString(),
    aud: SESSION_AUDIENCE,
  });
}

/**
 * Middleware progressivo. Instalações antigas não matriculadas continuam no fluxo legado.
 * Depois de um handshake Security Center bem-sucedido, session_required=true e a sessão
 * curta passa a ser obrigatória em toda rota onde este middleware for aplicado.
 */
export async function enforceSecurityCenter(request: Request): Promise<Response | null> {
  const hints = identityHints(request);
  if (!installationSchema.safeParse(hints.installationId).success) return null;
  const rawLicense = licenseToken(request);
  if (!rawLicense) return null;

  const tokenHash = await hashToken(rawLicense);
  const { data: preData, error: preError } = await db.rpc("security_precheck", {
    p_token_hash: tokenHash,
    p_installation_id: hints.installationId,
  });
  if (preError) return json(request, { ok: false, code: "MSK_SECURITY_BACKEND_UNAVAILABLE" }, 503);
  const pre = firstRow<any>(preData);
  if (!pre) return json(request, { ok: false, code: "MSK_SECURITY_BACKEND_UNAVAILABLE" }, 503);
  if (pre.allowed !== true) {
    const status = pre.code === "LICENSE_INVALID" ? 401 : 403;
    return json(request, { ok: false, code: pre.code || "MSK_INSTALLATION_BLOCKED" }, status);
  }
  if (pre.session_required !== true) return null;

  const signed = String(request.headers.get("x-msk-security-session") ?? "").trim();
  const payload = await readSignedSession(signed);
  if (!payload) return json(request, { ok: false, code: "MSK_SECURITY_SESSION_REQUIRED" }, 401);
  if (payload.iid !== hints.installationId || payload.lid !== String(pre.resolved_license_id) || payload.uid !== String(pre.resolved_user_id)) {
    return json(request, { ok: false, code: "MSK_SECURITY_SESSION_MISMATCH" }, 401);
  }

  const { data: validData, error: validError } = await db.rpc("security_validate_session", {
    p_token_hash: tokenHash,
    p_installation_id: hints.installationId,
    p_session_id: payload.sid,
    p_build_id: payload.bid,
  });
  if (validError) return json(request, { ok: false, code: "MSK_SECURITY_BACKEND_UNAVAILABLE" }, 503);
  const valid = firstRow<any>(validData);
  if (!valid?.allowed) {
    const status = String(valid?.code || "").includes("SESSION") ? 401 : 403;
    return json(request, { ok: false, code: valid?.code || "MSK_INSTALLATION_BLOCKED" }, status);
  }
  return null;
}
