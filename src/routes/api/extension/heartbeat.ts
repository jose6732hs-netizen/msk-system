import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extensionPreflight } from "@/lib/extension-telemetry.server";
import { findLicenseByToken } from "@/lib/license.server";

const db = supabaseAdmin as any;
const PROVIDERS = new Set(["chatgpt", "grok", "blackbox", "gemini", "lovable", "github", "other"]);
const INSTALLATION_RE = /^[A-Za-z0-9_-]{16,80}$/;
const VERSION_RE = /^[0-9A-Za-z.+_-]{1,64}$/;
const REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function cors(request: Request) {
  return extensionCorsHeaders(request);
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

  // Versões novas enviam o token da licença diretamente.
  const direct = (await findLicenseByToken(token)) as any;
  if (activeLicense(direct)) return direct;

  // Compatibilidade com v2.4.68/v2.4.69: essas versões podiam enviar o JWT
  // da conta MSK. Resolve o usuário e usa a licença ativa dele sem exigir
  // reinstalação apenas para a Central começar a funcionar.
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

function cleanText(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

async function handleCompatibleHeartbeat(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json(request, { ok: false, code: "INVALID_HEARTBEAT", message: "Heartbeat inválido." }, 400);

  const installationId = String(body["installation_id"] ?? "").trim();
  // Aceita o contrato novo (`version`) e o legado (`extension_version`).
  const version = String(body["version"] ?? body["extension_version"] ?? "").trim();
  if (!INSTALLATION_RE.test(installationId) || !VERSION_RE.test(version)) {
    return json(request, { ok: false, code: "INVALID_HEARTBEAT", message: "Identificação ou versão inválida." }, 400);
  }

  const repositoryRaw = cleanText(body["repository"], 300);
  const repository = repositoryRaw && REPOSITORY_RE.test(repositoryRaw) ? repositoryRaw : null;
  const providerRaw = cleanText(body["provider"], 40);
  const provider = providerRaw && PROVIDERS.has(providerRaw) ? providerRaw : null;
  const license = await resolveLicense(request);
  if (!license) {
    return json(request, { ok: false, code: "LICENSE_INVALID", message: "Conecte novamente sua licença MSK." }, 401);
  }

  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("extension_installations")
    .select("id,user_id")
    .eq("installation_id", installationId)
    .maybeSingle();

  if (existing && String(existing.user_id) !== String(license.user_id)) {
    return json(request, {
      ok: false,
      code: "INSTALLATION_OWNERSHIP_MISMATCH",
      message: "Esta instalação precisa ser reconectada à conta correta.",
    }, 409);
  }

  const installationPatch = {
    license_id: license.id,
    version,
    browser: cleanText(body["browser"], 120),
    os: cleanText(body["os"], 120),
    last_seen_at: now,
    last_activity_at: now,
    metadata: {
      source: "extension_heartbeat",
      compatibility: body["version"] ? "canonical" : "legacy_extension_version",
    },
  };

  if (existing?.id) {
    const { error } = await db
      .from("extension_installations")
      .update(installationPatch)
      .eq("id", existing.id)
      .eq("user_id", license.user_id);
    if (error) return json(request, { ok: false, code: "HEARTBEAT_STORE_FAILED", message: "Não foi possível atualizar a instalação." }, 503);
  } else {
    const { error } = await db.from("extension_installations").insert({
      user_id: license.user_id,
      installation_id: installationId,
      ...installationPatch,
    });
    if (error) return json(request, { ok: false, code: "HEARTBEAT_STORE_FAILED", message: "Não foi possível registrar a instalação." }, 503);
  }

  const projectId = cleanText(body["project_id"], 180);
  if (projectId) {
    const { data: project } = await db
      .from("extension_projects")
      .select("id")
      .eq("user_id", license.user_id)
      .eq("installation_id", installationId)
      .eq("lovable_project_id", projectId)
      .maybeSingle();

    const projectPatch = {
      project_name: cleanText(body["project_name"], 180),
      repository,
      provider,
      branch: cleanText(body["branch"], 180),
      github_status: ["unknown", "connected", "disconnected", "connecting", "error"].includes(String(body["github_status"] ?? ""))
        ? String(body["github_status"])
        : "unknown",
      workspace_url: cleanText(body["workspace_url"], 1000),
      preview_url: cleanText(body["preview_url"], 1000),
      publish_status: ["draft", "published", "unknown"].includes(String(body["publish_status"] ?? ""))
        ? String(body["publish_status"])
        : "unknown",
      last_commit_sha: cleanText(body["last_commit_sha"], 80),
      last_activity_at: now,
      updated_at: now,
    };

    if (project?.id) {
      await db.from("extension_projects").update(projectPatch).eq("id", project.id);
    } else {
      await db.from("extension_projects").insert({
        user_id: license.user_id,
        installation_id: installationId,
        lovable_project_id: projectId,
        ...projectPatch,
      });
    }
  }

  return json(request, {
    ok: true,
    online: true,
    installation_id: installationId,
    version,
    server_time: now,
  });
}

export const Route = createFileRoute("/api/extension/heartbeat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => extensionPreflight(request),
      POST: ({ request }) => handleCompatibleHeartbeat(request),
    },
  },
});
