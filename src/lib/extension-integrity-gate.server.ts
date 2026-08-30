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
const GATE_PROTOCOL = "msk-integrity-v2";
const GATE_TTL_MS = 10 * 60_000;
const BUILTIN_APPROVED_RELEASES: Record<string, string[]> = {
  "3.4.48": ["ad36dc984a7b88a776fc2ed0fc1ae47671a84cadc74cd7e6b15c3e1ca0da2403"],
};

const installationSchema = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const versionSchema = z.string().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/);
const extensionIdSchema = z.string().min(8).max(120).regex(/^[A-Za-z0-9._-]+$/);
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const enrollSchema = z.object({ integrity_root: rootSchema });

type Identity = {
  userId: string;
  licenseId: string;
  installationId: string;
  version: string;
  extensionId: string;
};

type GatePayload = {
  v: 2;
  p: typeof GATE_PROTOCOL;
  uid: string;
  lid: string;
  iid: string;
  eid: string;
  ver: string;
  root: string;
  iat: number;
  exp: number;
  jti: string;
};

function configuredApprovedRoots(version: string) {
  const raw = String(process.env["MSK_EXTENSION_APPROVED_INTEGRITY_ROOTS"] ?? "");
  const roots = new Set<string>(BUILTIN_APPROVED_RELEASES[version] ?? []);
  for (const item of raw.split(",")) {
    const value = item.trim();
    if (!value) continue;
    const [candidateVersion, candidateRoot] = value.includes("=") ? value.split("=", 2) : [version, value];
    if (candidateVersion?.trim() !== version) continue;
    const normalized = String(candidateRoot ?? "").trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(normalized)) roots.add(normalized);
  }
  return roots;
}

function isApprovedRoot(version: string, root: string) {
  return configuredApprovedRoots(version).has(root.toLowerCase());
}

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = origin ? isTrustedExtensionOrigin(origin) : false;
  return {
    ...(allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "content-type, authorization, x-msk-installation-id, x-msk-extension-version, x-msk-extension-id",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors(request),
    },
  });
}

export function extensionIntegrityPreflight(request: Request) {
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

async function identityFromRequest(request: Request): Promise<Identity | null> {
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

async function createGateToken(identity: Identity, root: string) {
  const now = Date.now();
  const payload: GatePayload = {
    v: 2,
    p: GATE_PROTOCOL,
    uid: identity.userId,
    lid: identity.licenseId,
    iid: identity.installationId,
    eid: identity.extensionId,
    ver: identity.version,
    root,
    iat: now,
    exp: now + GATE_TTL_MS,
    jti: crypto.randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = await signData(`${GATE_PROTOCOL}:${encoded}`);
  return { token: `${encoded}.${signature}`, payload };
}

async function readGateToken(token: string): Promise<GatePayload | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  if (!(await verifySignature(`${GATE_PROTOCOL}:${payloadPart}`, signaturePart))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as GatePayload;
    if (parsed.v !== 2 || parsed.p !== GATE_PROTOCOL || Number(parsed.exp || 0) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function markSuspicious(identity: Identity, reason: string) {
  await db
    .from("extension_installations")
    .update({ suspicious: true, suspicion_reason: reason, last_activity_at: new Date().toISOString() })
    .eq("installation_id", identity.installationId)
    .eq("user_id", identity.userId);
}

export async function handleExtensionIntegrityGate(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const identity = await identityFromRequest(request);
  if (!identity) {
    return json(request, { ok: false, code: "AUTH_REQUIRED", message: "Licença ou identidade da extensão inválida." }, 401);
  }
  if (!(await rateLimit("extension-integrity-gate", `${identity.userId}:${identity.installationId}`, 12))) {
    return json(request, { ok: false, code: "RATE_LIMITED", message: "Muitas tentativas em pouco tempo." }, 429);
  }

  const parsed = enrollSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(request, { ok: false, code: "INVALID_INTEGRITY_REQUEST" }, 400);
  const root = parsed.data.integrity_root.toLowerCase();

  const { data: existing } = await db
    .from("extension_installations")
    .select("id,user_id,license_id,blocked,block_reason,extension_id,first_extension_id,integrity_required,integrity_root,integrity_version,integrity_enrolled_at")
    .eq("installation_id", identity.installationId)
    .maybeSingle();

  if (existing?.user_id && String(existing.user_id) !== identity.userId) {
    return json(request, { ok: false, code: "INSTALLATION_OWNERSHIP_MISMATCH" }, 409);
  }
  if (existing?.blocked) {
    return json(request, { ok: false, code: "INSTALLATION_BLOCKED", message: existing.block_reason || "Instalação bloqueada." }, 403);
  }
  if (existing?.first_extension_id && String(existing.first_extension_id) !== identity.extensionId) {
    await markSuspicious(identity, "ID da extensão mudou em uma instalação protegida pelo gate de integridade.");
    return json(request, { ok: false, code: "EXTENSION_ID_MISMATCH" }, 409);
  }

  if (!isApprovedRoot(identity.version, root)) {
    await markSuspicious(identity, `Build não aprovado para a versão ${identity.version}.`);
    return json(request, {
      ok: false,
      code: "INTEGRITY_BUILD_NOT_APPROVED",
      message: "Esta cópia da extensão foi modificada ou não corresponde a uma versão oficial MSK.",
    }, 403);
  }

  const now = new Date().toISOString();
  const patch = {
    license_id: identity.licenseId,
    version: identity.version,
    extension_id: identity.extensionId,
    first_extension_id: existing?.first_extension_id || identity.extensionId,
    integrity_required: true,
    integrity_root: root,
    integrity_version: identity.version,
    integrity_enrolled_at: existing?.integrity_enrolled_at || now,
    integrity_updated_at: now,
    last_seen_at: now,
    last_activity_at: now,
  };

  if (existing?.id) {
    const { error } = await db
      .from("extension_installations")
      .update(patch)
      .eq("id", existing.id)
      .eq("user_id", identity.userId);
    if (error) return json(request, { ok: false, code: "INTEGRITY_STORE_FAILED" }, 503);
  } else {
    const { error } = await db.from("extension_installations").insert({
      user_id: identity.userId,
      installation_id: identity.installationId,
      ...patch,
    });
    if (error) return json(request, { ok: false, code: "INTEGRITY_STORE_FAILED" }, 503);
  }

  const gate = await createGateToken(identity, root);
  return json(request, {
    ok: true,
    required: true,
    protocol: GATE_PROTOCOL,
    integrity_root: root,
    gate_token: gate.token,
    expires_at: new Date(gate.payload.exp).toISOString(),
  });
}

export async function enforceExtensionIntegrityGate(request: Request): Promise<Response | null> {
  const hints = identityHints(request);
  if (!installationSchema.safeParse(hints.installationId).success) return null;

  const license = await resolveLicense(request);
  if (!license) return null;

  const { data: row } = await db
    .from("extension_installations")
    .select("id,user_id,blocked,block_reason,first_extension_id,extension_id,integrity_required,integrity_root,integrity_version")
    .eq("installation_id", hints.installationId)
    .eq("user_id", license.user_id)
    .maybeSingle();
  if (!row || row.integrity_required !== true) return null;

  if (row.blocked) {
    return json(request, { ok: false, code: "INSTALLATION_BLOCKED", message: row.block_reason || "Instalação bloqueada." }, 403);
  }
  if (!versionSchema.safeParse(hints.version).success || !extensionIdSchema.safeParse(hints.extensionId).success) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_REQUIRED", message: "Identidade protegida ausente." }, 401);
  }
  if (row.first_extension_id && String(row.first_extension_id) !== hints.extensionId) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_MISMATCH", message: "ID da extensão não corresponde à instalação aprovada." }, 409);
  }

  const url = new URL(request.url);
  const root = String(url.searchParams.get("__msk_root") ?? "").toLowerCase();
  const token = String(url.searchParams.get("__msk_gate") ?? "");
  if (!root || !token) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_REQUIRED", message: "Esta instalação exige uma versão oficial aprovada." }, 401);
  }
  if (
    root !== String(row.integrity_root ?? "").toLowerCase() ||
    hints.version !== String(row.integrity_version ?? "") ||
    !isApprovedRoot(hints.version, root)
  ) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_MISMATCH", message: "A versão instalada não corresponde ao build aprovado." }, 409);
  }

  const gate = await readGateToken(token);
  if (!gate) return json(request, { ok: false, code: "INTEGRITY_GATE_EXPIRED", message: "Sessão de integridade expirada." }, 401);
  if (
    gate.uid !== String(license.user_id) ||
    gate.lid !== String(license.id) ||
    gate.iid !== hints.installationId ||
    gate.eid !== hints.extensionId ||
    gate.ver !== hints.version ||
    gate.root !== root
  ) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_MISMATCH" }, 401);
  }

  return null;
}
