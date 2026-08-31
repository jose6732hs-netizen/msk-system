import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceExtensionIntegrityGate } from "@/lib/extension-integrity-gate.server";
import { enforceExtensionDeviceSecurity } from "@/lib/extension-device-security.server";
import {
  findLicenseByToken,
  isTrustedExtensionOrigin,
  rateLimit,
} from "@/lib/license.server";

const db = supabaseAdmin as any;
const PROJECT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSTALLATION_ID_RE = /^\d{1,20}$/;

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = !origin || isTrustedExtensionOrigin(origin);
  return {
    ...(origin && allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": [
      "content-type",
      "authorization",
      "x-msk-lovable-token",
      "x-msk-installation-id",
      "x-msk-extension-version",
      "x-msk-extension-id",
      "x-msk-session",
      "x-msk-proof-version",
      "x-msk-timestamp",
      "x-msk-counter",
      "x-msk-body-sha256",
      "x-msk-signature",
      "x-msk-build-fingerprint",
    ].join(", "),
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

function bearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function activeLicense(row: any) {
  if (!row || String(row.status) !== "active") return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  return true;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeRepo(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/(?:github\.com[/:])?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!match) return "";
  const owner = match[1] ?? "";
  const repo = match[2] ?? "";
  if (!owner || !repo || owner === "settings" || owner === "apps") return "";
  return `${owner}/${repo}`;
}

function findRepo(value: unknown, depth = 0): string {
  if (depth > 6 || value == null) return "";
  if (typeof value === "string") return normalizeRepo(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRepo(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  const object = value as Record<string, unknown>;
  const priorityKeys = [
    "repository_full_name", "repositoryFullName", "repo_full_name", "repoFullName",
    "github_repository", "githubRepository", "repository", "repo", "github_url", "githubUrl",
  ];
  for (const key of priorityKeys) {
    if (key in object) {
      const found = findRepo(object[key], depth + 1);
      if (found) return found;
    }
  }
  for (const nested of Object.values(object)) {
    const found = findRepo(nested, depth + 1);
    if (found) return found;
  }
  return "";
}

async function verifyLovableProjectAccess(projectId: string, token: string) {
  const endpoints = [
    `https://api.lovable.dev/projects/${encodeURIComponent(projectId)}`,
    `https://api.lovable.dev/projects/${encodeURIComponent(projectId)}/settings`,
  ];
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        redirect: "follow",
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        return { ok: false, unauthorized: true, repository: "" };
      }
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      return { ok: true, unauthorized: false, repository: findRepo(data) };
    } catch {
      // Tenta o próximo endpoint conhecido do Lovable.
    }
  }
  return { ok: false, unauthorized: false, repository: "" };
}

async function handle(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  // Esta rota pode vincular uma instalação GitHub a um projeto. Por isso ela exige
  // build oficial aprovado e prova criptográfica do dispositivo antes de aceitar o ID.
  const url = new URL(request.url);
  if (!url.searchParams.get("__msk_root") || !url.searchParams.get("__msk_gate")) {
    return json(request, { ok: false, code: "INTEGRITY_GATE_REQUIRED" }, 401);
  }
  if (!request.headers.get("x-msk-session") || !request.headers.get("x-msk-signature")) {
    return json(request, { ok: false, code: "DEVICE_PROOF_REQUIRED" }, 401);
  }
  const integrityFailure = await enforceExtensionIntegrityGate(request);
  if (integrityFailure) return integrityFailure;
  const deviceFailure = await enforceExtensionDeviceSecurity(request);
  if (deviceFailure) return deviceFailure;

  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) {
    return json(request, { ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
  }

  const licenseToken = bearer(request);
  if (!licenseToken) return json(request, { ok: false, code: "LICENSE_REQUIRED" }, 401);
  const license = (await findLicenseByToken(licenseToken)) as any;
  if (!activeLicense(license)) return json(request, { ok: false, code: "LICENSE_INVALID" }, 401);

  const lovableToken = String(request.headers.get("x-msk-lovable-token") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!lovableToken) return json(request, { ok: false, code: "LOVABLE_SESSION_REQUIRED" }, 401);

  const body = await request.json().catch(() => null) as null | {
    lovable_project_id?: string;
    project_name?: string;
    repository_url?: string;
    github_installation_id?: string | number;
  };
  const projectId = String(body?.lovable_project_id ?? "").trim();
  if (!PROJECT_ID_RE.test(projectId)) return json(request, { ok: false, code: "PROJECT_REQUIRED" }, 400);

  const clientInstallId = String(request.headers.get("x-msk-installation-id") ?? "unknown").slice(0, 100);
  if (!(await rateLimit("extension-github-session", `${String(license.user_id)}:${clientInstallId}:${projectId}`, 20))) {
    return json(request, { ok: false, code: "RATE_LIMITED" }, 429);
  }

  const lovable = await verifyLovableProjectAccess(projectId, lovableToken);
  if (!lovable.ok) {
    return json(request, {
      ok: false,
      code: lovable.unauthorized ? "LOVABLE_SESSION_INVALID" : "LOVABLE_PROJECT_NOT_CONFIRMED",
      message: lovable.unauthorized
        ? "A sessão do Lovable expirou. Atualize o projeto e tente novamente."
        : "Não foi possível confirmar o projeto no Lovable.",
    }, lovable.unauthorized ? 401 : 409);
  }

  const { data: existing, error: readError } = await db
    .from("msk_projects")
    .select("lovable_project_id,project_name,github_installation_id,github_owner,github_repo,github_default_branch,session_token_hash,connected_at")
    .eq("lovable_project_id", projectId)
    .maybeSingle();
  if (readError) return json(request, { ok: false, code: "PROJECT_LOOKUP_FAILED" }, 503);

  const incomingInstall = String(body?.github_installation_id ?? "").trim();
  const incomingInstallationId = INSTALLATION_ID_RE.test(incomingInstall) ? incomingInstall : "";
  const existingInstallationId = existing?.github_installation_id ? String(existing.github_installation_id) : "";
  if (incomingInstallationId && existingInstallationId && incomingInstallationId !== existingInstallationId) {
    return json(request, {
      ok: false,
      code: "GITHUB_INSTALLATION_MISMATCH",
      message: "A instalação GitHub aberta não corresponde à instalação vinculada a este projeto.",
    }, 409);
  }
  const installationId = existingInstallationId || incomingInstallationId;
  if (!installationId) {
    return json(request, {
      ok: true,
      connected: false,
      installation_known: false,
      repository: normalizeRepo(body?.repository_url) || lovable.repository || "",
      code: "GITHUB_INSTALLATION_REQUIRED",
    });
  }

  const repository =
    [existing?.github_owner, existing?.github_repo].every(Boolean)
      ? `${existing.github_owner}/${existing.github_repo}`
      : normalizeRepo(body?.repository_url) || lovable.repository || "";
  const [owner = null, repo = null] = repository ? repository.split("/", 2) : [null, null];

  const sessionToken = `${crypto.randomUUID().replaceAll("-", "")}.${crypto.randomUUID().replaceAll("-", "")}`;
  const sessionHash = await sha256(sessionToken);
  const now = new Date().toISOString();
  const patch = {
    project_name: String(body?.project_name || existing?.project_name || "").slice(0, 200) || null,
    github_installation_id: Number(installationId),
    github_owner: owner,
    github_repo: repo,
    github_default_branch: existing?.github_default_branch || "main",
    session_token_hash: sessionHash,
    connected_at: existing?.connected_at || now,
    updated_at: now,
  };

  if (existing) {
    const { error } = await db.from("msk_projects").update(patch).eq("lovable_project_id", projectId);
    if (error) return json(request, { ok: false, code: "SESSION_STORE_FAILED" }, 503);
  } else {
    const { error } = await db.from("msk_projects").insert({ lovable_project_id: projectId, ...patch });
    if (error) return json(request, { ok: false, code: "SESSION_STORE_FAILED" }, 503);
  }

  return json(request, {
    ok: true,
    connected: true,
    recovered: true,
    installation_id: Number(installationId),
    repository,
    default_branch: patch.github_default_branch,
    session_token: sessionToken,
  });
}

export const Route = createFileRoute("/api/extension/github-session")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
      POST: ({ request }) => handle(request),
    },
  },
});
