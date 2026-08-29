import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findLicenseByToken, rateLimit, isTrustedExtensionOrigin } from "./license.server";

const db = supabaseAdmin as any;
const REDACTED = "[REDACTED]";
const CONTENT_NOT_LOGGED = "[CONTENT_NOT_LOGGED]";
const PROVIDERS = ["chatgpt", "grok", "blackbox", "gemini", "lovable", "github", "other"] as const;
const EVENT_STATUS = ["started", "success", "failed", "cancelled", "pending", "info"] as const;
const EVENT_ACTIONS = [
  "extension_started",
  "extension_updated",
  "project_detected",
  "project_opened",
  "repository_detected",
  "github_connect_started",
  "github_connected",
  "github_disconnected",
  "github_write_started",
  "github_write_success",
  "github_write_failed",
  "provider_selected",
  "chatgpt_connected",
  "grok_connected",
  "blackbox_connected",
  "gemini_connected",
  "prompt_sent",
  "prompt_completed",
  "lovable_sync_started",
  "lovable_sync_success",
  "lovable_sync_failed",
  "preview_started",
  "preview_confirmed",
  "publish_started",
  "publish_success",
  "publish_failed",
  "extension_error",
  "update_available",
  "update_required",
  "update_download_started",
  "update_download_opened",
  "operation_status",
] as const;

const repoSchema = z
  .string()
  .trim()
  .max(300)
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
  .optional()
  .nullable();
const installationSchema = z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/);
const versionSchema = z.string().trim().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/);
const providerSchema = z.enum(PROVIDERS).optional().nullable();

const eventSchema = z.object({
  event_id: z.string().uuid().optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  installation_id: installationSchema,
  extension_version: versionSchema,
  project_id: z.string().trim().max(180).optional().nullable(),
  repository: repoSchema,
  provider: providerSchema,
  action: z.enum(EVENT_ACTIONS),
  status: z.enum(EVENT_STATUS).default("success"),
  duration_ms: z.number().int().min(0).max(3_600_000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const errorSchema = z.object({
  error_id: z.string().uuid().optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  installation_id: installationSchema,
  extension_version: versionSchema,
  error_code: z.string().trim().min(2).max(100).regex(/^[A-Z0-9_]+$/),
  severity: z.enum(["info", "warning", "error", "critical"]).default("error"),
  title: z.string().trim().min(1).max(180).optional(),
  technical_message: z.string().max(12_000).optional().nullable(),
  user_message: z.string().max(800).optional().nullable(),
  stack: z.string().max(12_000).optional().nullable(),
  action: z.string().trim().max(80).regex(/^[a-z0-9_]+$/).optional().nullable(),
  provider: providerSchema,
  project_id: z.string().trim().max(180).optional().nullable(),
  repository: repoSchema,
  browser: z.string().trim().max(120).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const heartbeatSchema = z.object({
  installation_id: installationSchema,
  version: versionSchema,
  project_id: z.string().trim().max(180).optional().nullable(),
  project_name: z.string().trim().max(180).optional().nullable(),
  repository: repoSchema,
  provider: providerSchema,
  browser: z.string().trim().max(120).optional().nullable(),
  os: z.string().trim().max(120).optional().nullable(),
  branch: z.string().trim().max(180).optional().nullable(),
  github_status: z.enum(["unknown", "connected", "disconnected", "connecting", "error"]).optional(),
  workspace_url: z.string().url().max(1000).optional().nullable(),
  preview_url: z.string().url().max(1000).optional().nullable(),
  publish_status: z.enum(["draft", "published", "unknown"]).optional(),
  last_commit_sha: z.string().trim().max(80).optional().nullable(),
  timestamp: z.string().datetime({ offset: true }).optional(),
});

const SENSITIVE_KEY = /(pass(word)?|cookie|authorization|auth_header|api[_-]?key|secret|client_secret|service[_-]?role|private[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|github[_-]?token|license[_-]?token|\.env)/i;
const CONTENT_KEY = /^(prompt|prompts|command|commands|content|contents|messages?|conversation|raw_body|request_body|response_body)$/i;
const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/i,
  /\bsk-[A-Za-z0-9_-]{16,}\b/i,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  /\bMSK-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2,4}\b/i,
  /(?:^|\n)[A-Z][A-Z0-9_]{2,}\s*=\s*[^\n]{8,}/,
];

function safeString(value: string, max = 2000) {
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) return REDACTED;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function sanitizeExtensionValue(value: unknown, key = "", depth = 0): unknown {
  if (depth > 6) return "[MAX_DEPTH]";
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (CONTENT_KEY.test(key)) {
    const size = typeof value === "string" ? value.length : JSON.stringify(value ?? "").length;
    return `${CONTENT_NOT_LOGGED}:${Math.min(size, 1_000_000)}`;
  }
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return safeString(value);
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => sanitizeExtensionValue(item, key, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      output[childKey.slice(0, 100)] = sanitizeExtensionValue(childValue, childKey, depth + 1);
    }
    return output;
  }
  return safeString(String(value));
}

function sanitizeMetadata(value: Record<string, unknown>) {
  let sanitized = sanitizeExtensionValue(value) as Record<string, unknown>;
  let encoded = JSON.stringify(sanitized);
  if (encoded.length > 14_000) {
    sanitized = { truncated: true, original_size: encoded.length };
    encoded = JSON.stringify(sanitized);
  }
  return sanitized;
}

export function extensionCorsHeaders(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  // Extensões instaladas (ID muda por instalação) e content scripts rodando
  // dentro do Lovable precisam ser aceitos, senão nenhuma extensão conecta.
  const allowed = origin ? isTrustedExtensionOrigin(origin) : false;
  return {
    ...(allowed ? { "access-control-allow-origin": origin } : { "access-control-allow-origin": "*" }),
    "access-control-allow-headers": "content-type, authorization, x-msk-installation-id, x-msk-extension-version",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}


export function extensionPreflight(request: Request) {
  return new Response(null, { status: 204, headers: extensionCorsHeaders(request) });
}

function extensionJson(request: Request, body: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
      ...extensionCorsHeaders(request),
    },
  });
}

function authToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

type ExtensionIdentity = {
  userId: string;
  licenseId: string;
  installationId: string;
  version: string;
};

async function authenticateExtension(
  request: Request,
  installationId: string,
  version: string,
): Promise<{ identity?: ExtensionIdentity; response?: Response }> {
  const token = authToken(request);
  if (!token) {
    return { response: extensionJson(request, { ok: false, code: "AUTH_REQUIRED", message: "Conecte sua licença MSK novamente." }, 401) };
  }

  const license = (await findLicenseByToken(token)) as any;
  if (!license) {
    return { response: extensionJson(request, { ok: false, code: "LICENSE_INVALID", message: "Sua licença não pôde ser confirmada." }, 401) };
  }
  const expiresAt = license.expires_at ? Date.parse(license.expires_at) : null;
  if (license.status !== "active" || (expiresAt && expiresAt <= Date.now())) {
    return { response: extensionJson(request, { ok: false, code: "LICENSE_EXPIRED", message: "Sua licença expirou. Insira uma nova licença para continuar." }, 403) };
  }

  const { data: existing } = await db
    .from("extension_installations")
    .select("id,user_id")
    .eq("installation_id", installationId)
    .maybeSingle();
  if (existing && existing.user_id !== license.user_id) {
    return { response: extensionJson(request, { ok: false, code: "INSTALLATION_OWNERSHIP_MISMATCH", message: "Esta instalação precisa ser reconectada à conta correta." }, 409) };
  }

  return {
    identity: {
      userId: String(license.user_id),
      licenseId: String(license.id),
      installationId,
      version,
    },
  };
}

function extensionClientIp(request: Request) {
  const raw =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0] ||
    "";
  const ip = raw.trim();
  return ip && ip.length <= 60 ? ip : null;
}

async function touchInstallation(identity: ExtensionIdentity, input: { browser?: string | null; os?: string | null; metadata?: Record<string, unknown>; request?: Request; lastUrl?: string | null }) {
  const now = new Date().toISOString();
  const ipAddress = input.request ? extensionClientIp(input.request) : null;
  const userAgent = input.request ? (input.request.headers.get("user-agent") ?? "").slice(0, 300) || null : null;
  const metadata = sanitizeMetadata(input.metadata ?? {});
  const { data: current } = await db
    .from("extension_installations")
    .select("id")
    .eq("installation_id", identity.installationId)
    .maybeSingle();

  if (current?.id) {
    const { error } = await db
      .from("extension_installations")
      .update({
        license_id: identity.licenseId,
        version: identity.version,
        browser: input.browser ?? null,
        os: input.os ?? null,
        last_seen_at: now,
        last_activity_at: now,
        metadata,
        ...(ipAddress ? { ip_address: ipAddress } : {}),
        ...(userAgent ? { user_agent: userAgent } : {}),
        ...(input.lastUrl ? { last_url: input.lastUrl.slice(0, 1000) } : {}),
      })
      .eq("id", current.id)
      .eq("user_id", identity.userId);
    if (error) throw error;
  } else {
    const { error } = await db.from("extension_installations").insert({
      user_id: identity.userId,
      installation_id: identity.installationId,
      license_id: identity.licenseId,
      version: identity.version,
      browser: input.browser ?? null,
      os: input.os ?? null,
      last_seen_at: now,
      last_activity_at: now,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
      last_url: input.lastUrl?.slice(0, 1000) ?? null,
    });
    if (error) throw error;
  }
}

async function upsertProject(
  identity: ExtensionIdentity,
  input: {
    project_id?: string | null;
    project_name?: string | null;
    repository?: string | null;
    provider?: (typeof PROVIDERS)[number] | null;
    branch?: string | null;
    github_status?: string | null;
    workspace_url?: string | null;
    preview_url?: string | null;
    publish_status?: string | null;
    last_commit_sha?: string | null;
  },
) {
  const lovableProjectId = input.project_id?.trim();
  if (!lovableProjectId) return;
  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("extension_projects")
    .select("id")
    .eq("user_id", identity.userId)
    .eq("installation_id", identity.installationId)
    .eq("lovable_project_id", lovableProjectId)
    .maybeSingle();
  const patch = {
    project_name: input.project_name?.slice(0, 180) ?? null,
    repository: input.repository ?? null,
    provider: input.provider ?? null,
    branch: input.branch?.slice(0, 180) ?? null,
    github_status: input.github_status ?? "unknown",
    workspace_url: input.workspace_url ?? null,
    preview_url: input.preview_url ?? null,
    publish_status: input.publish_status ?? "unknown",
    last_commit_sha: input.last_commit_sha?.slice(0, 80) ?? null,
    last_activity_at: now,
    updated_at: now,
  };
  if (existing?.id) {
    const { error } = await db.from("extension_projects").update(patch).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("extension_projects").insert({
      user_id: identity.userId,
      installation_id: identity.installationId,
      lovable_project_id: lovableProjectId,
      ...patch,
    });
    if (error) throw error;
  }
}

function projectPatchForEvent(input: z.infer<typeof eventSchema>) {
  const metadata = input.metadata ?? {};
  let githubStatus = String(metadata["github_status"] ?? "unknown");
  if (input.action === "github_connected") githubStatus = "connected";
  if (input.action === "github_disconnected") githubStatus = "disconnected";
  if (input.action === "github_connect_started") githubStatus = "connecting";
  if (input.action === "github_write_failed") githubStatus = "error";
  return {
    project_id: input.project_id,
    project_name: typeof metadata["project_name"] === "string" ? metadata["project_name"] : null,
    repository: input.repository,
    provider: input.provider,
    branch: typeof metadata["branch"] === "string" ? metadata["branch"] : null,
    github_status: ["unknown", "connected", "disconnected", "connecting", "error"].includes(githubStatus) ? githubStatus : "unknown",
    workspace_url: typeof metadata["workspace_url"] === "string" ? metadata["workspace_url"] : null,
    preview_url: typeof metadata["preview_url"] === "string" ? metadata["preview_url"] : null,
    publish_status: input.action === "publish_success" ? "published" : (typeof metadata["publish_status"] === "string" ? metadata["publish_status"] : "unknown"),
    last_commit_sha: typeof metadata["commit_sha"] === "string" ? metadata["commit_sha"] : null,
  };
}

export async function handleExtensionEvent(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extensionJson(request, { ok: false, code: "INVALID_EVENT", message: "Evento inválido." }, 400);
  const auth = await authenticateExtension(request, parsed.data.installation_id, parsed.data.extension_version);
  if (!auth.identity) return auth.response!;
  const identity = auth.identity;
  if (!(await rateLimit("extension-events", `${identity.userId}:${identity.installationId}`, 120))) {
    return extensionJson(request, { ok: false, code: "RATE_LIMITED", message: "Muitos eventos em pouco tempo." }, 429);
  }
  try {
    const sanitized = sanitizeMetadata(parsed.data.metadata);
    await touchInstallation(identity, { request, metadata: { last_event: parsed.data.action } });
    await upsertProject(identity, projectPatchForEvent(parsed.data) as any);
    const { error } = await db.from("extension_events").insert({
      event_id: parsed.data.event_id ?? crypto.randomUUID(),
      user_id: identity.userId,
      installation_id: identity.installationId,
      extension_version: identity.version,
      project_id: parsed.data.project_id ?? null,
      repository: parsed.data.repository ?? null,
      provider: parsed.data.provider ?? null,
      action: parsed.data.action,
      status: parsed.data.status,
      duration_ms: parsed.data.duration_ms ?? null,
      metadata: sanitized,
      ip_address: extensionClientIp(request),
      created_at: parsed.data.timestamp ?? new Date().toISOString(),
    });
    if (error) throw error;
    return extensionJson(request, { ok: true });
  } catch {
    return extensionJson(request, { ok: false, code: "TELEMETRY_UNAVAILABLE", message: "Telemetria temporariamente indisponível." }, 503);
  }
}

async function updateIncident(errorRow: any) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: recent } = await db
    .from("extension_errors")
    .select("user_id,installation_id,extension_version,browser")
    .eq("error_code", errorRow.error_code)
    .gte("created_at", since)
    .limit(1000);
  const rows = recent ?? [];
  const users = new Set(rows.map((row: any) => row.user_id)).size;
  const installations = new Set(rows.map((row: any) => row.installation_id)).size;
  const counts = (key: string) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const value = String(row[key] ?? "unknown");
      map.set(value, (map.get(value) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  let incident: any = null;
  if (users >= 10) {
    const { data: open } = await db
      .from("extension_incidents")
      .select("id,first_seen_at")
      .eq("error_code", errorRow.error_code)
      .in("status", ["open", "monitoring"])
      .maybeSingle();
    const payload = {
      error_code: errorRow.error_code,
      severity: errorRow.severity,
      affected_users: users,
      affected_installations: installations,
      dominant_version: counts("extension_version"),
      dominant_browser: counts("browser"),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { window_minutes: 15, occurrences: rows.length },
    };
    if (open?.id) {
      const { data } = await db.from("extension_incidents").update(payload).eq("id", open.id).select("id").single();
      incident = data;
    } else {
      const { data } = await db.from("extension_incidents").insert({ ...payload, status: "open", first_seen_at: errorRow.created_at }).select("id").single();
      incident = data;
    }
  }

  const shouldAlert = errorRow.severity === "critical" || !!incident?.id;
  if (!shouldAlert) return;
  const alertSince = new Date(Date.now() - 30 * 60_000).toISOString();
  let query = db.from("extension_alerts").select("id").gte("created_at", alertSince).limit(1);
  query = incident?.id ? query.eq("incident_id", incident.id) : query.eq("alert_type", "critical_error").eq("title", errorRow.error_code);
  const { data: duplicate } = await query.maybeSingle();
  if (duplicate) return;
  await db.from("extension_alerts").insert({
    alert_type: incident?.id ? "mass_error" : "critical_error",
    severity: errorRow.severity === "critical" ? "critical" : "warning",
    title: incident?.id ? `Muitos clientes com ${errorRow.error_code}` : errorRow.error_code,
    message: incident?.id ? `${users} usuários foram afetados nos últimos 15 minutos.` : "Erro crítico detectado na extensão.",
    incident_id: incident?.id ?? null,
    metadata: { error_code: errorRow.error_code },
  });
}

export async function handleExtensionError(request: Request) {
  const parsed = errorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extensionJson(request, { ok: false, code: "INVALID_ERROR", message: "Registro de erro inválido." }, 400);
  const auth = await authenticateExtension(request, parsed.data.installation_id, parsed.data.extension_version);
  if (!auth.identity) return auth.response!;
  const identity = auth.identity;
  if (!(await rateLimit("extension-errors", `${identity.userId}:${identity.installationId}`, 30))) {
    return extensionJson(request, { ok: false, code: "RATE_LIMITED", message: "Muitos erros enviados em pouco tempo." }, 429);
  }
  try {
    await touchInstallation(identity, { request, browser: parsed.data.browser ?? null, metadata: { last_error_code: parsed.data.error_code } });
    const { data: catalog } = await db
      .from("extension_error_catalog")
      .select("title,user_message,severity,recovery_action")
      .eq("error_code", parsed.data.error_code)
      .maybeSingle();
    const title = String(catalog?.title ?? parsed.data.title ?? "Falha na operação").slice(0, 180);
    const userMessage = String(catalog?.user_message ?? "Não consegui concluir esta etapa. Tente novamente.").slice(0, 800);
    const technical = sanitizeExtensionValue(parsed.data.technical_message ?? "", "technical_message");
    const stackSummary = sanitizeExtensionValue(parsed.data.stack ?? "", "stack_summary");
    const metadata = sanitizeMetadata({ ...parsed.data.metadata, recovery_action: catalog?.recovery_action ?? null });
    const row = {
      error_id: parsed.data.error_id ?? crypto.randomUUID(),
      error_code: parsed.data.error_code,
      severity: parsed.data.severity ?? catalog?.severity ?? "error",
      title,
      user_id: identity.userId,
      installation_id: identity.installationId,
      project_id: parsed.data.project_id ?? null,
      repository: parsed.data.repository ?? null,
      provider: parsed.data.provider ?? null,
      extension_version: identity.version,
      browser: parsed.data.browser ?? null,
      action: parsed.data.action ?? null,
      user_message: userMessage,
      technical_message: typeof technical === "string" ? technical.slice(0, 8000) : REDACTED,
      stack_summary: typeof stackSummary === "string" ? stackSummary.slice(0, 8000) : REDACTED,
      metadata,
      ip_address: extensionClientIp(request),
      created_at: parsed.data.timestamp ?? new Date().toISOString(),
    };
    const { data: created, error } = await db.from("extension_errors").insert(row).select("*").single();
    if (error) throw error;
    await db.from("extension_events").insert({
      user_id: identity.userId,
      installation_id: identity.installationId,
      extension_version: identity.version,
      project_id: parsed.data.project_id ?? null,
      repository: parsed.data.repository ?? null,
      provider: parsed.data.provider ?? null,
      action: "extension_error",
      status: "failed",
      metadata: { error_code: parsed.data.error_code, severity: row.severity },
    });
    void updateIncident(created).catch(() => undefined);
    return extensionJson(request, { ok: true, error_id: created.error_id, user_message: userMessage, recovery_action: catalog?.recovery_action ?? "retry" });
  } catch {
    return extensionJson(request, { ok: false, code: "TELEMETRY_UNAVAILABLE", message: "Não foi possível registrar o diagnóstico agora." }, 503);
  }
}

export async function handleExtensionHeartbeat(request: Request) {
  const parsed = heartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extensionJson(request, { ok: false, code: "INVALID_HEARTBEAT", message: "Heartbeat inválido." }, 400);
  const auth = await authenticateExtension(request, parsed.data.installation_id, parsed.data.version);
  if (!auth.identity) return auth.response!;
  const identity = auth.identity;
  if (!(await rateLimit("extension-heartbeat", `${identity.userId}:${identity.installationId}`, 12))) {
    return extensionJson(request, { ok: false, code: "RATE_LIMITED", message: "Heartbeat muito frequente." }, 429);
  }
  try {
    await touchInstallation(identity, { request, lastUrl: parsed.data.workspace_url ?? null, browser: parsed.data.browser ?? null, os: parsed.data.os ?? null, metadata: { provider: parsed.data.provider ?? null, project_id: parsed.data.project_id ?? null } });
    await upsertProject(identity, {
      project_id: parsed.data.project_id,
      project_name: parsed.data.project_name,
      repository: parsed.data.repository,
      provider: parsed.data.provider,
      branch: parsed.data.branch,
      github_status: parsed.data.github_status,
      workspace_url: parsed.data.workspace_url,
      preview_url: parsed.data.preview_url,
      publish_status: parsed.data.publish_status,
      last_commit_sha: parsed.data.last_commit_sha,
    } as any);
    return extensionJson(request, { ok: true, server_time: new Date().toISOString(), heartbeat_interval_seconds: 300 });
  } catch {
    return extensionJson(request, { ok: false, code: "HEARTBEAT_UNAVAILABLE", message: "Não foi possível atualizar o status agora." }, 503);
  }
}

function semverParts(value: string) {
  return value.split(/[+-]/, 1)[0]!.split(".").map((part) => Number(part) || 0).slice(0, 4);
}
function compareVersions(a: string, b: string) {
  const aa = semverParts(a);
  const bb = semverParts(b);
  for (let index = 0; index < Math.max(aa.length, bb.length, 3); index += 1) {
    const diff = (aa[index] ?? 0) - (bb[index] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

export async function handleExtensionVersion(request: Request) {
  const url = new URL(request.url);
  const installationId = request.headers.get("x-msk-installation-id")?.trim() || url.searchParams.get("installation_id")?.trim() || "";
  const currentVersion = request.headers.get("x-msk-extension-version")?.trim() || url.searchParams.get("current_version")?.trim() || "";
  const parsedIdentity = z.object({ installationId: installationSchema, currentVersion: versionSchema }).safeParse({ installationId, currentVersion });
  if (!parsedIdentity.success) return extensionJson(request, { ok: false, code: "INVALID_VERSION_REQUEST", message: "Identificação da extensão inválida." }, 400);
  const auth = await authenticateExtension(request, installationId, currentVersion);
  if (!auth.identity) return auth.response!;
  if (!(await rateLimit("extension-version", `${auth.identity.userId}:${installationId}`, 30))) {
    return extensionJson(request, { ok: false, code: "RATE_LIMITED", message: "Consulta de versão muito frequente." }, 429);
  }
  const { data: latest } = await db
    .from("extension_releases")
    .select("id,version,title,changelog,download_url,mandatory,minimum_version,status,released_at,build_id")
    .eq("status", "released")
    .order("released_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) {
    return extensionJson(request, { ok: true, latest_version: currentVersion, minimum_version: currentVersion, mandatory: false, update_available: false, download_url: null, changelog: "", released_at: null }, 200, "private, max-age=900");
  }
  const minimumVersion = latest.minimum_version || latest.version;
  const updateAvailable = compareVersions(currentVersion, latest.version) < 0;
  const belowMinimum = compareVersions(currentVersion, minimumVersion) < 0;
  const mandatory = updateAvailable && (latest.mandatory === true || belowMinimum);
  const origin = new URL(request.url).origin;
  return extensionJson(request, {
    ok: true,
    latest_version: latest.version,
    minimum_version: minimumVersion,
    mandatory,
    update_available: updateAvailable,
    download_url: `${origin}/api/extension/download?release_id=${encodeURIComponent(latest.id)}`,
    changelog: latest.changelog ?? "",
    title: latest.title,
    released_at: latest.released_at,
  }, 200, "private, max-age=900");
}

export async function handleExtensionDownload(request: Request) {
  const url = new URL(request.url);
  const releaseId = url.searchParams.get("release_id")?.trim() || "";
  const installationId = request.headers.get("x-msk-installation-id")?.trim() || "";
  const currentVersion = request.headers.get("x-msk-extension-version")?.trim() || "";
  if (!z.string().uuid().safeParse(releaseId).success || !installationSchema.safeParse(installationId).success || !versionSchema.safeParse(currentVersion).success) {
    return extensionJson(request, { ok: false, code: "INVALID_DOWNLOAD_REQUEST", message: "Atualização inválida." }, 400);
  }
  const auth = await authenticateExtension(request, installationId, currentVersion);
  if (!auth.identity) return auth.response!;
  if (!(await rateLimit("extension-download", `${auth.identity.userId}:${installationId}`, 10))) {
    return extensionJson(request, { ok: false, code: "RATE_LIMITED", message: "Muitas tentativas de download." }, 429);
  }
  const { data: release } = await db.from("extension_releases").select("id,status,build_id,download_url").eq("id", releaseId).eq("status", "released").maybeSingle();
  if (!release) return extensionJson(request, { ok: false, code: "RELEASE_NOT_FOUND", message: "Esta versão não está disponível." }, 404);
  if (release.build_id) {
    const { data: build } = await db
      .from("extension_builds")
      .select("id,file_name,storage_path,is_official")
      .eq("id", release.build_id)
      .eq("is_official", true)
      .maybeSingle();
    if (build?.storage_path) {
      const { data: signed, error } = await supabaseAdmin.storage.from("extension-builds").createSignedUrl(build.storage_path, 300, { download: build.file_name });
      if (error || !signed?.signedUrl) return extensionJson(request, { ok: false, code: "DOWNLOAD_UNAVAILABLE", message: "O arquivo oficial não pôde ser preparado agora." }, 503);
      return extensionJson(request, { ok: true, url: signed.signedUrl, expires_in: 300 });
    }
  }
  if (release.download_url && /^https:\/\/msksystem\.online\//i.test(release.download_url)) {
    return extensionJson(request, { ok: true, url: release.download_url, expires_in: 300 });
  }
  return extensionJson(request, { ok: false, code: "DOWNLOAD_UNAVAILABLE", message: "O arquivo oficial ainda não foi publicado." }, 404);
}
