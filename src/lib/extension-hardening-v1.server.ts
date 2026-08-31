import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  findLicenseByToken,
  isTrustedExtensionOrigin,
  rateLimit,
  signData,
  verifySignature,
} from "./license.server";

const db = supabaseAdmin as any;
const GATE_PROTOCOL = "msk-integrity-v3";
const SESSION_PROTOCOL = "msk-device-session-v2";
const ACTION_PROTOCOL = "MSK-PROTECTED-ACTION-V1";
const REQUEST_PROTOCOL = "MSK-PROTECTED-REQUEST-V2";
const GATE_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 10 * 60_000;
const ACTION_TTL_MS = 45_000;
const CLOCK_SKEW_MS = 90_000;

export const MSK_HARDENED_RELEASE = Object.freeze({
  buildId: "msk-8bdc2b75-ee8d-475c-b2cf-91382ff6c759",
  version: "3.4.49",
  manifestVersion: 1,
  manifestSha256: "713ee6d5f48964beab51d86edbd54b065ecf22294a2ef18f46502fee03f11b02",
  manifestSignature: "zrvCIYXxmC_q37fqsrxcotTUbZloYe-CXYphYOeVi7314oH_XWxV2_Z694rXftw-HLlvbXaTsCHE34A3VQSumw",
  integrityRoot: "c7a3d5596febaac5ec75272e01f03e705603924b67a79eaf3e503ae181bad786",
  buildFingerprint: "f3f7a8c085b19b8d3ce62dd7f3d4444367d7d4fce5a49babd7810e69a2b49629",
  keyId: "msk-release-p256-2026-01",
  officialSite: "https://msksystem.online",
});

const installationSchema = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const versionSchema = z.string().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/);
const extensionIdSchema = z.string().min(8).max(120).regex(/^[A-Za-z0-9._-]+$/);
const buildIdSchema = z.string().min(16).max(120).regex(/^[A-Za-z0-9._-]+$/);
const sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const publicKeySchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().min(20).max(120),
  y: z.string().min(20).max(120),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional(),
});

const integrityEnrollSchema = z.object({
  integrity_root: sha256HexSchema,
  build_id: buildIdSchema,
  manifest_version: z.number().int().positive(),
  manifest_sha256: sha256HexSchema,
  manifest_signature: z.string().min(32).max(300),
  key_id: z.string().min(3).max(120),
});
const sessionEnrollSchema = z.object({
  public_key_jwk: publicKeySchema,
  build_fingerprint: sha256HexSchema,
  build_id: buildIdSchema,
});
const actionAuthorizeSchema = z.object({ body_sha256: z.string().min(20).max(120) });

type PublicJwk = z.infer<typeof publicKeySchema>;
type Identity = {
  userId: string;
  licenseId: string;
  installationId: string;
  version: string;
  extensionId: string;
  buildId: string;
};
type GatePayload = {
  v: 3; p: typeof GATE_PROTOCOL; uid: string; lid: string; iid: string; eid: string;
  ver: string; bid: string; root: string; iat: number; exp: number; jti: string;
};
type SessionPayload = {
  v: 2; p: typeof SESSION_PROTOCOL; uid: string; lid: string; iid: string; eid: string;
  ver: string; bid: string; fp: string; iat: number; exp: number; jti: string;
};
type IntegrityV3 = {
  mode: "required";
  protocol: typeof GATE_PROTOCOL;
  build_id: string;
  integrity_root: string;
  manifest_version: number;
  manifest_sha256: string;
  manifest_signature: string;
  key_id: string;
  enrolled_at: string;
  last_verified_at?: string | null;
};
type SecurityV2 = {
  mode: "required";
  protocol: typeof SESSION_PROTOCOL;
  build_id: string;
  public_key_jwk: PublicJwk;
  build_fingerprint: string;
  enrolled_at: string;
  last_verified_at?: string | null;
  last_request_counter?: number;
  last_action_counter?: number;
};

const encoder = new TextEncoder();

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = origin ? isTrustedExtensionOrigin(origin) : false;
  return {
    ...(allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": [
      "content-type", "authorization", "x-msk-installation-id", "x-msk-extension-version",
      "x-msk-extension-id", "x-msk-build-id", "x-msk-integrity-root", "x-msk-session",
      "x-msk-device-session", "x-msk-build-fingerprint", "x-msk-proof-version",
      "x-msk-timestamp", "x-msk-counter", "x-msk-body-sha256", "x-msk-signature",
      "x-msk-target", "x-msk-action",
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

export function hardeningPreflight(request: Request) {
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
    buildId: String(request.headers.get("x-msk-build-id") ?? "").trim(),
  };
}

async function identityFromRequest(request: Request): Promise<Identity | null> {
  const license = await resolveLicense(request);
  if (!license) return null;
  const hints = identityHints(request);
  if (
    !installationSchema.safeParse(hints.installationId).success ||
    !versionSchema.safeParse(hints.version).success ||
    !extensionIdSchema.safeParse(hints.extensionId).success ||
    !buildIdSchema.safeParse(hints.buildId).success
  ) return null;
  return {
    userId: String(license.user_id),
    licenseId: String(license.id),
    installationId: hints.installationId,
    version: hints.version,
    extensionId: hints.extensionId,
    buildId: hints.buildId,
  };
}

function knownRelease(identity: Pick<Identity, "buildId" | "version">) {
  return identity.buildId === MSK_HARDENED_RELEASE.buildId && identity.version === MSK_HARDENED_RELEASE.version;
}

function metadataObject(metadata: unknown) {
  return metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};
}

function integrityFromMetadata(metadata: unknown): IntegrityV3 | null {
  const value = metadataObject(metadata)["integrity_v3"] as Record<string, unknown> | undefined;
  if (!value || value["protocol"] !== GATE_PROTOCOL || value["mode"] !== "required") return null;
  const parsed = integrityEnrollSchema.safeParse({
    integrity_root: value["integrity_root"],
    build_id: value["build_id"],
    manifest_version: value["manifest_version"],
    manifest_sha256: value["manifest_sha256"],
    manifest_signature: value["manifest_signature"],
    key_id: value["key_id"],
  });
  if (!parsed.success) return null;
  return {
    mode: "required", protocol: GATE_PROTOCOL,
    build_id: parsed.data.build_id,
    integrity_root: parsed.data.integrity_root.toLowerCase(),
    manifest_version: parsed.data.manifest_version,
    manifest_sha256: parsed.data.manifest_sha256.toLowerCase(),
    manifest_signature: parsed.data.manifest_signature,
    key_id: parsed.data.key_id,
    enrolled_at: String(value["enrolled_at"] ?? ""),
    last_verified_at: value["last_verified_at"] ? String(value["last_verified_at"]) : null,
  };
}

function securityFromMetadata(metadata: unknown): SecurityV2 | null {
  const value = metadataObject(metadata)["security_v2"] as Record<string, unknown> | undefined;
  if (!value || value["protocol"] !== SESSION_PROTOCOL || value["mode"] !== "required") return null;
  const publicKey = publicKeySchema.safeParse(value["public_key_jwk"]);
  const fingerprint = sha256HexSchema.safeParse(value["build_fingerprint"]);
  if (!publicKey.success || !fingerprint.success) return null;
  return {
    mode: "required", protocol: SESSION_PROTOCOL,
    build_id: String(value["build_id"] ?? ""),
    public_key_jwk: publicKey.data,
    build_fingerprint: fingerprint.data.toLowerCase(),
    enrolled_at: String(value["enrolled_at"] ?? ""),
    last_verified_at: value["last_verified_at"] ? String(value["last_verified_at"]) : null,
    last_request_counter: Number(value["last_request_counter"] ?? 0) || 0,
    last_action_counter: Number(value["last_action_counter"] ?? 0) || 0,
  };
}

function stablePublicJwk(jwk: PublicJwk) {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

function mergeMetadata(metadata: unknown, patch: Record<string, unknown>) {
  return { ...metadataObject(metadata), ...patch };
}

async function markSuspicious(identity: Identity, reason: string) {
  const now = new Date().toISOString();
  const cleanReason = reason.slice(0, 300);
  const { data: existing } = await db.from("extension_installations")
    .select("id,user_id")
    .eq("installation_id", identity.installationId)
    .maybeSingle();
  if (existing?.id) {
    if (String(existing.user_id || "") !== identity.userId) return;
    await db.from("extension_installations").update({
      suspicious: true,
      suspicion_reason: cleanReason,
      last_seen_at: now,
      last_activity_at: now,
    }).eq("id", existing.id).eq("user_id", identity.userId);
    return;
  }
  await db.from("extension_installations").insert({
    user_id: identity.userId,
    license_id: identity.licenseId,
    installation_id: identity.installationId,
    version: identity.version,
    extension_id: identity.extensionId,
    first_extension_id: identity.extensionId,
    suspicious: true,
    suspicion_reason: cleanReason,
    last_seen_at: now,
    last_activity_at: now,
    metadata: { hardening_rejected: { build_id: identity.buildId, reason: cleanReason, at: now } },
  });
}

function base64UrlEncode(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}
function base64UrlDecode(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function createSignedToken(prefix: string, payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = await signData(`${prefix}:${encoded}`);
  return `${encoded}.${signature}`;
}

async function readSignedToken<T extends Record<string, any>>(prefix: string, token: string): Promise<T | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  if (!(await verifySignature(`${prefix}:${payloadPart}`, signaturePart))) return null;
  try { return JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as T; }
  catch { return null; }
}

async function createGateToken(identity: Identity, root: string) {
  const now = Date.now();
  const payload: GatePayload = {
    v: 3, p: GATE_PROTOCOL,
    uid: identity.userId, lid: identity.licenseId, iid: identity.installationId,
    eid: identity.extensionId, ver: identity.version, bid: identity.buildId, root,
    iat: now, exp: now + GATE_TTL_MS, jti: crypto.randomUUID(),
  };
  return { payload, token: await createSignedToken("extension_integrity_v3", payload) };
}

async function readGateToken(token: string) {
  const parsed = await readSignedToken<GatePayload>("extension_integrity_v3", token);
  if (!parsed || parsed.v !== 3 || parsed.p !== GATE_PROTOCOL || parsed.exp <= Date.now()) return null;
  return parsed;
}

async function createSessionToken(identity: Identity, fingerprint: string) {
  const now = Date.now();
  const payload: SessionPayload = {
    v: 2, p: SESSION_PROTOCOL,
    uid: identity.userId, lid: identity.licenseId, iid: identity.installationId,
    eid: identity.extensionId, ver: identity.version, bid: identity.buildId, fp: fingerprint,
    iat: now, exp: now + SESSION_TTL_MS, jti: crypto.randomUUID(),
  };
  return { payload, token: await createSignedToken("extension_device_session_v2", payload) };
}

async function readSessionToken(token: string) {
  const parsed = await readSignedToken<SessionPayload>("extension_device_session_v2", token);
  if (!parsed || parsed.v !== 2 || parsed.p !== SESSION_PROTOCOL || parsed.exp <= Date.now()) return null;
  return parsed;
}

function releaseMatchesEnrollment(input: z.infer<typeof integrityEnrollSchema>) {
  return input.build_id === MSK_HARDENED_RELEASE.buildId &&
    input.manifest_version === MSK_HARDENED_RELEASE.manifestVersion &&
    input.manifest_sha256.toLowerCase() === MSK_HARDENED_RELEASE.manifestSha256 &&
    input.integrity_root.toLowerCase() === MSK_HARDENED_RELEASE.integrityRoot &&
    input.manifest_signature === MSK_HARDENED_RELEASE.manifestSignature &&
    input.key_id === MSK_HARDENED_RELEASE.keyId;
}

async function loadInstallation(identity: Identity) {
  const { data } = await db.from("extension_installations")
    .select("id,user_id,license_id,installation_id,version,extension_id,first_extension_id,blocked,block_reason,suspicious,suspicion_reason,metadata,integrity_required,integrity_root,integrity_version,integrity_enrolled_at,integrity_updated_at,last_seen_at,last_activity_at")
    .eq("installation_id", identity.installationId).maybeSingle();
  return data as any;
}

async function remoteBlock(identity: Identity) {
  const { data } = await db.from("extension_remote_controls")
    .select("blocked,block_reason,block_message,installation_id,updated_at")
    .eq("user_id", identity.userId)
    .or(`installation_id.is.null,installation_id.eq.${identity.installationId}`)
    .order("updated_at", { ascending: false });
  return (data ?? []).find((item: any) => item.blocked === true) ?? null;
}

async function blockResponse(request: Request, identity: Identity, row?: any) {
  const remote = await remoteBlock(identity);
  if (row?.blocked || remote?.blocked) {
    return json(request, {
      ok: false, blocked: true, code: "INSTALLATION_BLOCKED",
      message: row?.block_reason || remote?.block_message || remote?.block_reason || "Instalação bloqueada pela segurança MSK.",
    }, 403);
  }
  return null;
}

export async function handleHardeningIntegrity(request: Request) {
  if (!identityHints(request).buildId) {
    const legacy = await import("./extension-integrity-gate.server");
    return legacy.handleExtensionIntegrityGate(request);
  }
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const identity = await identityFromRequest(request);
  if (!identity) return json(request, { ok: false, code: "AUTH_REQUIRED" }, 401);
  if (!knownRelease(identity)) {
    await markSuspicious(identity, "Build ID desconhecido durante handshake de integridade.");
    return json(request, { ok: false, code: "UNTRUSTED_BUILD", message: "Build MSK não reconhecido." }, 403);
  }
  if (!(await rateLimit("extension-integrity-v3", `${identity.userId}:${identity.installationId}`, 12))) {
    return json(request, { ok: false, code: "RATE_LIMITED" }, 429);
  }
  const parsed = integrityEnrollSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !releaseMatchesEnrollment(parsed.data)) {
    await markSuspicious(identity, "Manifesto de integridade divergente do release oficial.");
    return json(request, { ok: false, code: "UNTRUSTED_BUILD", message: "Esta instalação não corresponde a um build assinado e autorizado da MSK." }, 403);
  }

  const existing = await loadInstallation(identity);
  if (existing?.user_id && String(existing.user_id) !== identity.userId) return json(request, { ok: false, code: "INSTALLATION_OWNERSHIP_MISMATCH" }, 409);
  const blocked = await blockResponse(request, identity, existing); if (blocked) return blocked;
  if (existing?.first_extension_id && String(existing.first_extension_id) !== identity.extensionId) {
    await markSuspicious(identity, "ID da extensão mudou em uma instalação protegida.");
    return json(request, { ok: false, code: "EXTENSION_ID_MISMATCH" }, 409);
  }

  const now = new Date().toISOString();
  const integrity: IntegrityV3 = {
    mode: "required", protocol: GATE_PROTOCOL,
    build_id: identity.buildId,
    integrity_root: parsed.data.integrity_root.toLowerCase(),
    manifest_version: parsed.data.manifest_version,
    manifest_sha256: parsed.data.manifest_sha256.toLowerCase(),
    manifest_signature: parsed.data.manifest_signature,
    key_id: parsed.data.key_id,
    enrolled_at: integrityFromMetadata(existing?.metadata)?.enrolled_at || now,
    last_verified_at: now,
  };
  const patch: Record<string, unknown> = {
    license_id: identity.licenseId,
    version: identity.version,
    extension_id: identity.extensionId,
    first_extension_id: existing?.first_extension_id || identity.extensionId,
    integrity_required: true,
    integrity_root: integrity.integrity_root,
    integrity_version: identity.version,
    integrity_enrolled_at: existing?.integrity_enrolled_at || now,
    integrity_updated_at: now,
    metadata: mergeMetadata(existing?.metadata, { integrity_v3: integrity }),
    last_seen_at: now,
    last_activity_at: now,
  };
  if (existing?.id) {
    const { error } = await db.from("extension_installations").update(patch).eq("id", existing.id).eq("user_id", identity.userId);
    if (error) return json(request, { ok: false, code: "INTEGRITY_STORE_FAILED" }, 503);
  } else {
    const { error } = await db.from("extension_installations").insert({ user_id: identity.userId, installation_id: identity.installationId, ...patch });
    if (error) return json(request, { ok: false, code: "INTEGRITY_STORE_FAILED" }, 503);
  }
  const gate = await createGateToken(identity, integrity.integrity_root);
  return json(request, {
    ok: true, required: true, protocol: GATE_PROTOCOL,
    build_id: identity.buildId, integrity_root: integrity.integrity_root,
    gate_token: gate.token, gate_jti: gate.payload.jti,
    expires_at: new Date(gate.payload.exp).toISOString(),
  });
}

export async function handleHardeningSession(request: Request) {
  if (!identityHints(request).buildId) {
    const legacy = await import("./extension-device-security.server");
    return legacy.handleExtensionSecuritySession(request);
  }
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const identity = await identityFromRequest(request);
  if (!identity || !knownRelease(identity)) return json(request, { ok: false, code: "UNTRUSTED_BUILD" }, 403);
  if (!(await rateLimit("extension-session-v2", `${identity.userId}:${identity.installationId}`, 12))) return json(request, { ok: false, code: "RATE_LIMITED" }, 429);
  const parsed = sessionEnrollSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.build_id !== identity.buildId || parsed.data.build_fingerprint.toLowerCase() !== MSK_HARDENED_RELEASE.buildFingerprint) {
    await markSuspicious(identity, "Fingerprint/build divergente ao criar sessão segura.");
    return json(request, { ok: false, code: "BUILD_FINGERPRINT_MISMATCH" }, 403);
  }
  const existing = await loadInstallation(identity);
  if (!existing?.id) return json(request, { ok: false, code: "INTEGRITY_GATE_REQUIRED" }, 403);
  if (existing.user_id && String(existing.user_id) !== identity.userId) return json(request, { ok: false, code: "INSTALLATION_OWNERSHIP_MISMATCH" }, 409);
  const blocked = await blockResponse(request, identity, existing); if (blocked) return blocked;
  const integrity = integrityFromMetadata(existing.metadata);
  const requestRoot = String(request.headers.get("x-msk-integrity-root") || "").toLowerCase();
  if (!integrity || requestRoot !== MSK_HARDENED_RELEASE.integrityRoot || integrity.build_id !== identity.buildId || integrity.integrity_root !== MSK_HARDENED_RELEASE.integrityRoot) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_REQUIRED", message: "A integridade assinada precisa ser validada antes da sessão." }, 403);
  }
  if (String(existing.first_extension_id || existing.extension_id || "") !== identity.extensionId) {
    await markSuspicious(identity, "ID da extensão divergente ao criar sessão segura.");
    return json(request, { ok: false, code: "EXTENSION_ID_MISMATCH" }, 409);
  }

  const oldSecurity = securityFromMetadata(existing.metadata);
  const incomingJwk = stablePublicJwk(parsed.data.public_key_jwk);
  if (oldSecurity && JSON.stringify(stablePublicJwk(oldSecurity.public_key_jwk)) !== JSON.stringify(incomingJwk)) {
    await markSuspicious(identity, "Chave criptográfica do dispositivo mudou.");
    return json(request, { ok: false, code: "DEVICE_KEY_MISMATCH", message: "A identidade criptográfica deste dispositivo mudou." }, 409);
  }
  const now = new Date().toISOString();
  const security: SecurityV2 = oldSecurity ? {
    ...oldSecurity,
    build_id: identity.buildId,
    build_fingerprint: parsed.data.build_fingerprint.toLowerCase(),
    last_verified_at: now,
  } : {
    mode: "required", protocol: SESSION_PROTOCOL,
    build_id: identity.buildId,
    public_key_jwk: parsed.data.public_key_jwk,
    build_fingerprint: parsed.data.build_fingerprint.toLowerCase(),
    enrolled_at: now,
    last_verified_at: now,
    last_request_counter: 0,
    last_action_counter: 0,
  };
  const { error } = await db.from("extension_installations").update({
    metadata: mergeMetadata(existing.metadata, { security_v2: security }),
    license_id: identity.licenseId,
    version: identity.version,
    extension_id: identity.extensionId,
    last_seen_at: now,
    last_activity_at: now,
  }).eq("id", existing.id).eq("user_id", identity.userId);
  if (error) return json(request, { ok: false, code: "SECURITY_STORE_FAILED" }, 503);
  const session = await createSessionToken(identity, security.build_fingerprint);
  return json(request, {
    ok: true, required: true, protocol: SESSION_PROTOCOL,
    build_id: identity.buildId,
    session_token: session.token,
    session_jti: session.payload.jti,
    expires_at: new Date(session.payload.exp).toISOString(),
  });
}

async function sha256Base64Url(data: Uint8Array) {
  return base64UrlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", data as unknown as BufferSource)));
}
async function requestBodyHash(request: Request) {
  return sha256Base64Url(new Uint8Array(await request.clone().arrayBuffer()));
}
async function verifyDeviceSignature(jwk: PublicJwk, canonical: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey("jwk", jwk as JsonWebKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, base64UrlDecode(signature), encoder.encode(canonical));
  } catch { return false; }
}
function requestPath(request: Request) {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

async function validateSession(identity: Identity, row: any, token: string) {
  const session = await readSessionToken(token);
  if (!session) return null;
  if (session.uid !== identity.userId || session.lid !== identity.licenseId || session.iid !== identity.installationId ||
    session.eid !== identity.extensionId || session.ver !== identity.version || session.bid !== identity.buildId ||
    session.fp !== MSK_HARDENED_RELEASE.buildFingerprint) return null;
  return session;
}

export async function enforceHardeningRequest(request: Request): Promise<Response | null> {
  const hints = identityHints(request);
  if (!hints.buildId) return null;
  const identity = await identityFromRequest(request);
  if (!identity || !knownRelease(identity)) return json(request, { ok: false, code: "UNTRUSTED_BUILD" }, 403);
  const row = await loadInstallation(identity);
  if (!row?.id) return json(request, { ok: false, code: "DEVICE_NOT_ENROLLED" }, 403);
  const blocked = await blockResponse(request, identity, row); if (blocked) return blocked;
  const integrity = integrityFromMetadata(row.metadata);
  const security = securityFromMetadata(row.metadata);
  const requestRoot = String(request.headers.get("x-msk-integrity-root") || "").toLowerCase();
  const requestFingerprint = String(request.headers.get("x-msk-build-fingerprint") || "").toLowerCase();
  if (!integrity || !security || requestRoot !== MSK_HARDENED_RELEASE.integrityRoot || requestFingerprint !== MSK_HARDENED_RELEASE.buildFingerprint || integrity.build_id !== identity.buildId || security.build_id !== identity.buildId) {
    return json(request, { ok: false, code: "SECURITY_ENROLLMENT_REQUIRED" }, 403);
  }

  const url = new URL(request.url);
  const root = String(url.searchParams.get("__msk_root") || "").toLowerCase();
  const gateToken = String(url.searchParams.get("__msk_gate") || "");
  if (root !== MSK_HARDENED_RELEASE.integrityRoot || root !== integrity.integrity_root || !gateToken) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_MISMATCH" }, 403);
  }
  const gate = await readGateToken(gateToken);
  if (!gate || gate.uid !== identity.userId || gate.lid !== identity.licenseId || gate.iid !== identity.installationId ||
    gate.eid !== identity.extensionId || gate.ver !== identity.version || gate.bid !== identity.buildId || gate.root !== root) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_EXPIRED" }, 401);
  }

  const sessionToken = String(request.headers.get("x-msk-session") || "").trim();
  const session = await validateSession(identity, row, sessionToken);
  if (!session) return json(request, { ok: false, code: "SECURITY_SESSION_REQUIRED" }, 401);
  const proofVersion = String(request.headers.get("x-msk-proof-version") || "");
  const timestamp = Number(request.headers.get("x-msk-timestamp") || 0);
  const counter = Number(request.headers.get("x-msk-counter") || 0);
  const claimedBodyHash = String(request.headers.get("x-msk-body-sha256") || "");
  const signature = String(request.headers.get("x-msk-signature") || "");
  if (proofVersion !== "2" || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > CLOCK_SKEW_MS) {
    return json(request, { ok: false, code: "SECURITY_PROOF_EXPIRED" }, 401);
  }
  if (!Number.isSafeInteger(counter) || counter <= Number(security.last_request_counter || 0) || !signature) {
    return json(request, { ok: false, code: "SECURITY_REPLAY_BLOCKED" }, 409);
  }
  const actualBodyHash = await requestBodyHash(request);
  if (actualBodyHash !== claimedBodyHash) return json(request, { ok: false, code: "SECURITY_BODY_MISMATCH" }, 401);
  const canonical = [
    REQUEST_PROTOCOL, request.method.toUpperCase(), requestPath(request), String(timestamp), String(counter), actualBodyHash,
    identity.installationId, identity.extensionId, identity.version, identity.buildId, session.jti,
  ].join("\n");
  if (!(await verifyDeviceSignature(security.public_key_jwk, canonical, signature))) {
    await markSuspicious(identity, "Assinatura criptográfica inválida em requisição protegida.");
    return json(request, { ok: false, code: "SECURITY_SIGNATURE_INVALID" }, 401);
  }
  const updated: SecurityV2 = { ...security, last_request_counter: counter, last_verified_at: new Date().toISOString() };
  await db.from("extension_installations").update({
    metadata: mergeMetadata(row.metadata, { security_v2: updated }),
    last_activity_at: new Date().toISOString(),
  }).eq("id", row.id).eq("user_id", identity.userId);
  return null;
}

export async function handleHardeningHeartbeat(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const enforcement = await enforceHardeningRequest(request);
  if (enforcement) return enforcement;
  const identity = await identityFromRequest(request);
  if (!identity) return json(request, { ok: false, code: "AUTH_REQUIRED" }, 401);
  const body = await request.clone().json().catch(() => ({})) as any;
  if (String(body.installation_id || "") !== identity.installationId || String(body.build_id || "") !== identity.buildId || String(body.version || "") !== identity.version) {
    return json(request, { ok: false, code: "HEARTBEAT_IDENTITY_MISMATCH" }, 409);
  }
  if (String(body.integrity_state || "") !== "TRUSTED") {
    await markSuspicious(identity, "A extensão reportou estado local de integridade não confiável.");
    return json(request, { ok: false, code: "UNTRUSTED_BUILD", message: "A integridade local do MSK não está confiável." }, 403);
  }
  const row = await loadInstallation(identity);
  const blocked = await blockResponse(request, identity, row); if (blocked) return blocked;
  const now = new Date().toISOString();
  await db.from("extension_installations").update({ last_seen_at: now, last_activity_at: now }).eq("id", row.id).eq("user_id", identity.userId);
  return json(request, {
    ok: true,
    server_time: now,
    build_id: identity.buildId,
    control: { blocked: false, reason: null, message: null },
    integrity: { suspicious: row.suspicious === true, reason: row.suspicion_reason || null },
    poll_after_seconds: 10,
  });
}

export async function handleProtectedActionAuthorize(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const identity = await identityFromRequest(request);
  if (!identity || !knownRelease(identity)) return json(request, { ok: false, code: "UNTRUSTED_BUILD" }, 403);
  if (!(await rateLimit("extension-action-authorize", `${identity.userId}:${identity.installationId}`, 120))) {
    return json(request, { ok: false, code: "RATE_LIMITED" }, 429);
  }
  const row = await loadInstallation(identity);
  if (!row?.id) return json(request, { ok: false, code: "DEVICE_NOT_ENROLLED" }, 403);
  const blocked = await blockResponse(request, identity, row); if (blocked) return blocked;
  const integrity = integrityFromMetadata(row.metadata);
  const security = securityFromMetadata(row.metadata);
  const requestRoot = String(request.headers.get("x-msk-integrity-root") || "").toLowerCase();
  const requestFingerprint = String(request.headers.get("x-msk-build-fingerprint") || "").toLowerCase();
  if (!integrity || !security || requestRoot !== MSK_HARDENED_RELEASE.integrityRoot || requestFingerprint !== MSK_HARDENED_RELEASE.buildFingerprint || integrity.integrity_root !== MSK_HARDENED_RELEASE.integrityRoot || security.build_fingerprint !== MSK_HARDENED_RELEASE.buildFingerprint) {
    return json(request, { ok: false, code: "SECURITY_ENROLLMENT_REQUIRED" }, 403);
  }
  const sessionToken = String(request.headers.get("x-msk-device-session") || "").trim();
  const session = await validateSession(identity, row, sessionToken);
  if (!session) return json(request, { ok: false, code: "DEVICE_SESSION_INVALID" }, 401);

  const target = String(request.headers.get("x-msk-target") || "").trim();
  const action = String(request.headers.get("x-msk-action") || "").trim();
  if (!new Set(["msk-agent", "msk-agent-license", "msk-agent-public"]).has(target) || !/^[a-z0-9-]{2,40}$/i.test(action)) {
    return json(request, { ok: false, code: "ACTION_TARGET_INVALID" }, 400);
  }
  const proofVersion = String(request.headers.get("x-msk-proof-version") || "");
  const timestamp = Number(request.headers.get("x-msk-timestamp") || 0);
  const counter = Number(request.headers.get("x-msk-counter") || 0);
  const claimedBodyHash = String(request.headers.get("x-msk-body-sha256") || "");
  const signature = String(request.headers.get("x-msk-signature") || "");
  if (proofVersion !== "2" || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > CLOCK_SKEW_MS) {
    return json(request, { ok: false, code: "SECURITY_PROOF_EXPIRED" }, 401);
  }
  if (!Number.isSafeInteger(counter) || counter <= Number(security.last_action_counter || 0) || !signature) {
    return json(request, { ok: false, code: "SECURITY_REPLAY_BLOCKED" }, 409);
  }
  const parsed = actionAuthorizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.body_sha256 !== claimedBodyHash) return json(request, { ok: false, code: "SECURITY_BODY_MISMATCH" }, 401);
  const canonical = [
    ACTION_PROTOCOL, target, action, String(timestamp), String(counter), claimedBodyHash,
    identity.installationId, identity.extensionId, identity.version, identity.buildId, session.jti,
  ].join("\n");
  if (!(await verifyDeviceSignature(security.public_key_jwk, canonical, signature))) {
    await markSuspicious(identity, "Assinatura criptográfica inválida em operação GitHub/IA.");
    return json(request, { ok: false, code: "SECURITY_SIGNATURE_INVALID" }, 401);
  }
  const now = Date.now();
  const authorizationPayload = {
    v: 1, uid: identity.userId, lid: identity.licenseId, iid: identity.installationId, bid: identity.buildId,
    target, action, body: claimedBodyHash, iat: now, exp: now + ACTION_TTL_MS, jti: crypto.randomUUID(),
  };
  const authorizationToken = await createSignedToken("extension_action_authorization_v1", authorizationPayload);
  const updated: SecurityV2 = { ...security, last_action_counter: counter, last_verified_at: new Date().toISOString() };
  await db.from("extension_installations").update({
    metadata: mergeMetadata(row.metadata, { security_v2: updated }),
    last_activity_at: new Date().toISOString(),
  }).eq("id", row.id).eq("user_id", identity.userId);
  return json(request, {
    ok: true, device_authorized: true, build_id: identity.buildId,
    authorization_id: authorizationPayload.jti,
    authorization_token: authorizationToken,
    expires_at: new Date(authorizationPayload.exp).toISOString(),
  });
}
