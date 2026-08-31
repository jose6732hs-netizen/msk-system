import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findLicenseByToken, verifySignature } from "./license.server";

const db = supabaseAdmin as any;
const PROTOCOL = "ecdsa-p256-v1";
const installationSchema = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const versionSchema = z.string().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/);
const extensionIdSchema = z.string().min(8).max(120).regex(/^[A-Za-z0-9._-]+$/);

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = origin.startsWith("chrome-extension://") || origin === "https://msksystem.online";
  return {
    ...(allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "content-type, authorization, x-msk-installation-id, x-msk-extension-version, x-msk-extension-id, x-msk-device-session, x-msk-build-fingerprint",
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

type SessionPayload = {
  v: number;
  p: string;
  uid: string;
  lid: string;
  iid: string;
  eid: string;
  ver: string;
  fp: string;
  iat: number;
  exp: number;
  jti: string;
};

async function readDeviceSession(token: string): Promise<SessionPayload | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  if (!(await verifySignature(`extension_session_v1:${payloadPart}`, signaturePart))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as SessionPayload;
    if (parsed.v !== 1 || parsed.p !== PROTOCOL || Number(parsed.exp || 0) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function extensionDeviceAuthorizePreflight(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function handleExtensionDeviceAuthorize(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const license = await resolveLicense(request);
  if (!license) return json(request, { ok: false, code: "LICENSE_REQUIRED" }, 401);

  const installationId = String(request.headers.get("x-msk-installation-id") || "").trim();
  const version = String(request.headers.get("x-msk-extension-version") || "").trim();
  const extensionId = String(request.headers.get("x-msk-extension-id") || "").trim();
  const buildFingerprint = String(request.headers.get("x-msk-build-fingerprint") || "").trim().toLowerCase();
  const token = String(request.headers.get("x-msk-device-session") || "").trim();
  if (
    !installationSchema.safeParse(installationId).success ||
    !versionSchema.safeParse(version).success ||
    !extensionIdSchema.safeParse(extensionId).success ||
    !/^[a-f0-9]{64}$/.test(buildFingerprint) ||
    !token
  ) return json(request, { ok: false, code: "DEVICE_IDENTITY_REQUIRED" }, 401);

  const session = await readDeviceSession(token);
  if (!session) return json(request, { ok: false, code: "DEVICE_SESSION_INVALID" }, 401);
  if (
    session.uid !== String(license.user_id) ||
    session.lid !== String(license.id) ||
    session.iid !== installationId ||
    session.eid !== extensionId ||
    session.ver !== version ||
    session.fp !== buildFingerprint
  ) return json(request, { ok: false, code: "DEVICE_SESSION_MISMATCH" }, 401);

  const { data: row } = await db
    .from("extension_installations")
    .select("id,user_id,license_id,blocked,block_reason,suspicious,suspicion_reason,first_extension_id,extension_id,integrity_required,integrity_root,metadata")
    .eq("installation_id", installationId)
    .eq("user_id", license.user_id)
    .maybeSingle();

  if (!row) return json(request, { ok: false, code: "DEVICE_NOT_ENROLLED" }, 403);
  if (row.blocked) {
    return json(request, { ok: false, blocked: true, code: "INSTALLATION_BLOCKED", message: row.block_reason || "Instalação bloqueada pela segurança MSK." }, 403);
  }
  if (String(row.first_extension_id || row.extension_id || "") !== extensionId) {
    await db.from("extension_installations").update({
      suspicious: true,
      suspicion_reason: "ID da extensão divergente durante autorização de comando.",
      last_activity_at: new Date().toISOString(),
    }).eq("id", row.id);
    return json(request, { ok: false, code: "EXTENSION_ID_MISMATCH" }, 409);
  }
  const security = row.metadata && typeof row.metadata === "object" ? (row.metadata as any).security_v1 : null;
  if (!security || String(security.build_fingerprint || "").toLowerCase() !== buildFingerprint) {
    await db.from("extension_installations").update({
      suspicious: true,
      suspicion_reason: "Fingerprint do dispositivo divergente durante autorização de comando.",
      last_activity_at: new Date().toISOString(),
    }).eq("id", row.id);
    return json(request, { ok: false, code: "BUILD_FINGERPRINT_MISMATCH" }, 409);
  }
  if ((row.metadata as any)?.security_v1_rejected) {
    return json(request, { ok: false, code: "SECURITY_ENROLLMENT_REJECTED" }, 403);
  }
  if (row.integrity_required !== true || !row.integrity_root) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_REQUIRED" }, 403);
  }

  await db.from("extension_installations").update({ last_activity_at: new Date().toISOString() }).eq("id", row.id);
  return json(request, {
    ok: true,
    device_authorized: true,
    installation_id: installationId,
    suspicious: row.suspicious === true,
    suspicion_reason: row.suspicion_reason || null,
  });
}
