import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findLicenseByToken } from "./license.server";

const db = supabaseAdmin as any;

const OFFICIAL_BUILDS = new Map<string, { version: string; integrity_root: string }>([
  [
    "msk-agent-3.14.5-command-reset-resilient-aed98bd598b4f3dc",
    { version: "3.14.5", integrity_root: "aed98bd598b4f3dc88e7855803c78cda8bd4e035246691dd1a43bc1a9e3db515" },
  ],
  [
    "msk-agent-3.14.6-official-integrity-selfheal-c2ecd43f83d9a6f9",
    { version: "3.14.6", integrity_root: "c2ecd43f83d9a6f93784481e3bed7f34f7088bf5582a9304e9da695760ca89d3" },
  ],
  [
    "msk-agent-3.14.7-fast-edit-tdz-hotfix-cf531616fa6bf2bb",
    { version: "3.14.7", integrity_root: "cf531616fa6bf2bbcf46ccbb0a96f3fbfca21fdcdd02d9b4fcb99647cba4b64d" },
  ],
  [
    "msk-agent-3.14.8-msksystem-file-names-98bd40be83e6e17a",
    { version: "3.14.8", integrity_root: "98bd40be83e6e17a28d933ba080837a20cfee3fac61ca6ea6994b23ff0c77921" },
  ],
  [
    "msk-agent-3.14.9-database-connect-fix-4571d6d2d9a6443d",
    { version: "3.14.9", integrity_root: "4571d6d2d9a6443de8080e3c580c55f933a83e5529e405e9bdc28a90a5765a5a" },
  ],
  [
    "msk-agent-3.14.10-universal-self-heal-5962625475bdd2d7",
    { version: "3.14.10", integrity_root: "5962625475bdd2d79e62b7f3651a89b25812d42734c70210ace19c622af9ff2e" },
  ],
]);

const baseSchema = z.object({
  email: z.string().email().max(160),
  token: z.string().min(8).max(64),
  installation_id: z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/),
  extension_version: z.string().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/),
  extension_id: z.string().min(8).max(120).regex(/^[A-Za-z0-9._-]+$/),
  build_id: z.string().max(160).optional().nullable(),
  integrity_root: z.string().regex(/^[a-f0-9]{64}$/i).optional().nullable(),
});

const reportSchema = baseSchema.extend({
  incident_type: z.enum(["tamper", "clone", "integrity"]),
  incident_code: z.string().min(2).max(100).regex(/^[A-Z0-9_]+$/),
  critical_files: z.array(z.object({
    file: z.string().max(260),
    expected_hash: z.string().regex(/^[a-f0-9]{64}$/i).optional().nullable(),
    received_hash: z.string().regex(/^[a-f0-9]{64}$/i).optional().nullable(),
  })).max(24).optional().default([]),
});

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const trusted =
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin === "https://msksystem.online" ||
    origin.endsWith(".msksystem.online");
  return {
    ...(trusted ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "content-type, authorization",
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

export function agentExtensionSecurityPreflight(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

function officialBuildError(input: z.infer<typeof baseSchema>) {
  const buildId = String(input.build_id || "").trim();
  const root = String(input.integrity_root || "").trim().toLowerCase();
  if (!buildId || !root) {
    return {
      code: "MSK_BUILD_IDENTITY_MISMATCH",
      message: "A identidade criptográfica desta instalação está incompleta. Reinstale a build oficial do MSK Agente.",
    };
  }
  const official = OFFICIAL_BUILDS.get(buildId);
  if (!official) {
    return {
      code: "MSK_BUILD_NOT_OFFICIAL",
      message: "Esta build não está registrada como uma versão oficial do MSK Agente.",
    };
  }
  if (official.version !== input.extension_version || official.integrity_root !== root) {
    return {
      code: "MSK_INTEGRITY_ROOT_MISMATCH",
      message: "A identidade da build não corresponde aos arquivos oficiais registrados no MSK System.",
    };
  }
  return null;
}

async function authenticate(input: z.infer<typeof baseSchema>) {
  const license = (await findLicenseByToken(input.token)) as any;
  if (!license) return { error: "LICENSE_INVALID" as const, license: null };

  const status = String(license.status || "").toLowerCase();
  const expiresAt = license.expires_at ? Date.parse(license.expires_at) : Number.NaN;
  if (status !== "active" || (Number.isFinite(expiresAt) && expiresAt <= Date.now())) {
    return { error: "LICENSE_EXPIRED" as const, license: null };
  }

  const sentEmail = input.email.trim().toLowerCase();
  const { data: profile } = await db.from("profiles").select("email").eq("id", license.user_id).maybeSingle();
  let ownerEmail = String(profile?.email ?? "").trim().toLowerCase();
  if (!ownerEmail) {
    const { data: authOwner } = await supabaseAdmin.auth.admin.getUserById(String(license.user_id));
    ownerEmail = String(authOwner?.user?.email ?? "").trim().toLowerCase();
  }
  if (!ownerEmail || ownerEmail !== sentEmail) return { error: "EMAIL_MISMATCH" as const, license: null };
  return { error: null, license };
}

async function ensureInstallation(
  input: z.infer<typeof baseSchema>,
  license: any,
  options: { allowOfficialIdRotation?: boolean } = {},
) {
  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("extension_installations")
    .select("id,user_id,installation_id,extension_id,first_extension_id,suspicious,suspicion_reason,blocked,block_reason,metadata")
    .eq("installation_id", input.installation_id)
    .maybeSingle();

  if (existing?.user_id && String(existing.user_id) !== String(license.user_id)) {
    return { existing, clone: true, reason: "A instalação já pertence a outro usuário MSK." };
  }

  const metadata = existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
    ? { ...existing.metadata }
    : {};

  if (existing?.first_extension_id && String(existing.first_extension_id) !== input.extension_id) {
    if (!options.allowOfficialIdRotation) {
      const reason = "ID da extensão mudou sem uma build oficial validada (possível clone da MSK Agente).";
      await db.from("extension_installations").update({
        suspicious: true,
        suspicion_reason: reason,
        extension_id: input.extension_id,
        last_seen_at: now,
        last_activity_at: now,
      }).eq("id", existing.id).eq("user_id", license.user_id);
      return { existing: { ...existing, suspicious: true, suspicion_reason: reason }, clone: true, reason };
    }

    const rotations = Array.isArray(metadata.msk_extension_id_rotations)
      ? metadata.msk_extension_id_rotations.slice(-7)
      : [];
    rotations.push({
      from: String(existing.extension_id || existing.first_extension_id),
      to: input.extension_id,
      build_id: input.build_id ?? null,
      integrity_root: input.integrity_root ?? null,
      at: now,
    });
    metadata.msk_extension_id_rotations = rotations;

    const wasLegacyFalsePositive = /ID da extensão mudou em uma instalação protegida/i.test(String(existing.suspicion_reason || ""));
    const rotationPatch = {
      extension_id: input.extension_id,
      suspicious: wasLegacyFalsePositive ? false : existing.suspicious === true,
      suspicion_reason: wasLegacyFalsePositive ? null : existing.suspicion_reason,
      metadata,
      last_seen_at: now,
      last_activity_at: now,
    };
    const { error } = await db.from("extension_installations").update(rotationPatch).eq("id", existing.id).eq("user_id", license.user_id);
    if (error) throw error;
    Object.assign(existing, rotationPatch);
  }

  metadata.msk_security_last_seen = {
    build_id: input.build_id ?? null,
    integrity_root: input.integrity_root ?? null,
    extension_version: input.extension_version,
    extension_id: input.extension_id,
    at: now,
  };

  const patch = {
    license_id: license.id,
    version: input.extension_version,
    extension_id: input.extension_id,
    first_extension_id: existing?.first_extension_id || input.extension_id,
    metadata,
    last_seen_at: now,
    last_activity_at: now,
  };

  if (existing?.id) {
    const { error } = await db.from("extension_installations").update(patch).eq("id", existing.id).eq("user_id", license.user_id);
    if (error) throw error;
    return { existing: { ...existing, ...patch }, clone: false, reason: null };
  }

  const { data: inserted, error } = await db.from("extension_installations").insert({
    user_id: license.user_id,
    installation_id: input.installation_id,
    ...patch,
  }).select("id,user_id,installation_id,extension_id,first_extension_id,suspicious,suspicion_reason,blocked,block_reason,metadata").maybeSingle();
  if (error) throw error;
  return { existing: inserted, clone: false, reason: null };
}

async function remoteBlock(userId: string, installationId: string) {
  const { data: controls } = await db
    .from("extension_remote_controls")
    .select("blocked,block_reason,block_message,installation_id,updated_at")
    .eq("user_id", userId)
    .or(`installation_id.is.null,installation_id.eq.${installationId}`)
    .order("updated_at", { ascending: false });
  return (controls ?? []).find((row: any) => row.blocked === true) ?? null;
}

export async function handleAgentExtensionSecurityStatus(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const parsed = baseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(request, { ok: false, code: "INVALID_REQUEST", message: "Identidade de segurança inválida." }, 400);

  const auth = await authenticate(parsed.data);
  if (!auth.license) return json(request, { ok: false, code: auth.error }, auth.error === "LICENSE_INVALID" ? 401 : 403);

  const buildError = officialBuildError(parsed.data);
  if (buildError) {
    return json(request, {
      ok: false,
      blocked: true,
      code: buildError.code,
      message: buildError.message,
    }, 403);
  }

  const installation = await ensureInstallation(parsed.data, auth.license, { allowOfficialIdRotation: true });
  if (installation.clone) {
    return json(request, {
      ok: false,
      blocked: true,
      code: "MSK_INSTALLATION_CLONED",
      message: installation.reason || "Possível cópia/clone da MSK Agente detectada.",
    }, 403);
  }

  const row = installation.existing as any;
  const control = await remoteBlock(String(auth.license.user_id), parsed.data.installation_id);
  if (row?.blocked || control?.blocked) {
    return json(request, {
      ok: false,
      blocked: true,
      code: "INSTALLATION_BLOCKED",
      message: row?.block_reason || control?.block_message || control?.block_reason || "Esta instalação foi bloqueada pela MSK.",
    }, 403);
  }

  return json(request, {
    ok: true,
    blocked: false,
    suspicious: row?.suspicious === true,
    suspicion_reason: row?.suspicion_reason ?? null,
    official_build: true,
    build_id: parsed.data.build_id,
    integrity_root: parsed.data.integrity_root,
    installation_id: parsed.data.installation_id,
    timestamp: Date.now(),
  });
}

export async function handleAgentExtensionSecurityReport(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(request, { ok: false, code: "INVALID_REPORT" }, 400);

  const auth = await authenticate(parsed.data);
  if (!auth.license) return json(request, { ok: false, code: auth.error }, auth.error === "LICENSE_INVALID" ? 401 : 403);

  const now = new Date().toISOString();
  const buildError = officialBuildError(parsed.data);
  const ensured = await ensureInstallation(parsed.data, auth.license, { allowOfficialIdRotation: !buildError });
  const row = ensured.existing as any;
  const reason = parsed.data.incident_type === "clone"
    ? "Possível extensão clonada ou identidade alterada detectada pelo Guardião MSK."
    : "Arquivos protegidos da MSK Agente divergiram do build oficial.";

  const metadata = row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? { ...row.metadata }
    : {};
  metadata.msk_security_incident = {
    incident_type: parsed.data.incident_type,
    incident_code: parsed.data.incident_code,
    build_id: parsed.data.build_id ?? null,
    integrity_root: parsed.data.integrity_root ?? null,
    extension_id: parsed.data.extension_id,
    extension_version: parsed.data.extension_version,
    critical_files: parsed.data.critical_files,
    detected_at: now,
  };

  const { error } = await db.from("extension_installations").update({
    suspicious: true,
    suspicion_reason: `${reason} (${parsed.data.incident_code})`.slice(0, 300),
    extension_id: parsed.data.extension_id,
    metadata,
    last_seen_at: now,
    last_activity_at: now,
  }).eq("installation_id", parsed.data.installation_id).eq("user_id", auth.license.user_id);
  if (error) throw error;

  return json(request, {
    ok: true,
    recorded: true,
    blocked: row?.blocked === true,
    official_build: !buildError,
    installation_id: parsed.data.installation_id,
    code: parsed.data.incident_code,
    timestamp: Date.now(),
  });
}