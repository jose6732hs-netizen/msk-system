import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findLicenseByToken, rateLimit } from "./license.server";

const db = supabaseAdmin as any;

const bodySchema = z.object({
  project_id: z.string().trim().min(6).max(120),
  repository: z.string().trim().max(200).optional().nullable(),
});

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://") || origin === "https://msksystem.online";
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
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(request) },
  });
}

export function githubDownloadPreflight(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

function activeLicense(row: any) {
  if (!row || String(row.status) !== "active") return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  return true;
}

async function resolveUserId(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const direct = (await findLicenseByToken(token)) as any;
  if (activeLicense(direct)) return String(direct.user_id);
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData.user) return null;
  const { data: licenses } = await db
    .from("licenses")
    .select("id,user_id,status,starts_at,expires_at,created_at")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  return (licenses ?? []).some(activeLicense) ? String(userData.user.id) : null;
}

function normalizeRepo(value: unknown) {
  const clean = String(value ?? "")
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .trim();
  return /^[\w.-]+\/[\w.-]+$/.test(clean) ? clean : "";
}

function safeName(value: string) {
  const clean = String(value || "projeto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return clean || "projeto";
}

/**
 * Resolve, com validação de licença e de propriedade, o repositório GitHub do
 * projeto Lovable atual. Nenhum token é devolvido para a extensão: apenas o
 * endereço público do arquivo ZIP do repositório do próprio usuário.
 */
export async function handleExtensionGithubDownload(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return json(request, { ok: false, code: "GITHUB_NOT_CONNECTED", message: "Conecte sua licença MSK novamente." }, 401);

  if (!(await rateLimit("extension-github-download", userId, 30))) {
    return json(request, { ok: false, code: "RATE_LIMITED", message: "Muitos downloads em pouco tempo." }, 429);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(request, { ok: false, code: "PROJECT_NOT_FOUND", message: "Projeto atual não identificado." }, 400);

  const { data: projects } = await db
    .from("extension_projects")
    .select("lovable_project_id,project_name,repository,branch,github_status,last_activity_at")
    .eq("user_id", userId)
    .eq("lovable_project_id", parsed.data.project_id)
    .order("last_activity_at", { ascending: false })
    .limit(5);

  const project = (projects ?? [])[0] ?? null;
  const hinted = normalizeRepo(parsed.data.repository);
  const stored = normalizeRepo(project?.repository);

  // Só aceitamos a dica da extensão quando ela bate com o que já está gravado
  // para este usuário/projeto — nunca um owner/repo arbitrário.
  const repository = stored || (hinted && !project ? "" : hinted && hinted === stored ? hinted : "");

  if (!project && !stored) {
    return json(request, { ok: false, code: "PROJECT_NOT_FOUND", message: "Projeto atual não encontrado na sua conta MSK." }, 404);
  }
  if (!repository) {
    return json(
      request,
      { ok: false, code: "REPOSITORY_NOT_FOUND", message: "Este projeto ainda não está conectado a um repositório GitHub." },
      404,
    );
  }

  const branches = [String(project?.branch ?? "").trim(), "main", "master"].filter(Boolean);
  const unique = [...new Set(branches)];

  return json(request, {
    ok: true,
    repository,
    branches: unique,
    filename: `${safeName(project?.project_name || repository.split("/")[1] || "projeto")}.zip`,
    archive_urls: unique.map((branch) => `https://github.com/${repository}/archive/refs/heads/${branch}.zip`),
  });
}
