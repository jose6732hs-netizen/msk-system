import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(SUPABASE_URL, SERVICE_ROLE);
const enc = new TextEncoder();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-license, x-msk-session",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Circuit = { failures: number; openUntil: number };
const circuits = new Map<string, Circuit>();
const circuitState = (name: string) => circuits.get(name) || { failures: 0, openUntil: 0 };
const circuitSuccess = (name: string) => circuits.set(name, { failures: 0, openUntil: 0 });
function circuitFailure(name: string) {
  const failures = circuitState(name).failures + 1;
  circuits.set(name, { failures, openUntil: failures >= 3 ? Date.now() + 15_000 : 0 });
}
async function timedFetch(service: string, url: string, init: RequestInit = {}, timeoutMs = 4500) {
  const state = circuitState(service);
  if (state.openUntil > Date.now()) throw new Error(`${service}_CIRCUIT_OPEN`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status >= 500) circuitFailure(service); else circuitSuccess(service);
    return response;
  } catch (error) {
    circuitFailure(service);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64bytes = (value: string) => Uint8Array.from(atob(value.replace(/\s/g, "")), c => c.charCodeAt(0));
const derLen = (n: number) => n < 128 ? new Uint8Array([n]) : (() => { const a: number[] = []; for (let v = n; v > 0; v >>>= 8) a.unshift(v & 255); return new Uint8Array([128 | a.length, ...a]); })();
const join = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; };
const wrap = (tag: number, value: Uint8Array) => join(new Uint8Array([tag]), derLen(value.length), value);
const pkcs1 = (raw: Uint8Array) => wrap(48, join(new Uint8Array([2, 1, 0]), new Uint8Array([48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0]), wrap(4, raw)));
async function appKey() {
  const value = (Deno.env.get("GITHUB_APP_PRIVATE_KEY") || "").trim().replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  const match = value.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  if (!match) throw new Error("GITHUB_APP_CREDENTIALS_INVALID");
  const raw = b64bytes(match[2]);
  const alg = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
  return crypto.subtle.importKey("pkcs8", match[1] === "RSA PRIVATE KEY" ? pkcs1(raw) : raw, alg, false, ["sign"]);
}
async function appJwt() {
  const appId = Deno.env.get("GITHUB_APP_ID") || "";
  if (!appId) throw new Error("GITHUB_APP_CREDENTIALS_INVALID");
  const now = Math.floor(Date.now() / 1000);
  const head = b64(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64(enc.encode(JSON.stringify({ iat: now - 30, exp: now + 540, iss: appId })));
  const unsigned = `${head}.${payload}`;
  const signature = b64(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await appKey(), enc.encode(unsigned))));
  return `${unsigned}.${signature}`;
}
async function getInstallation(installationId: number) {
  const response = await timedFetch("github-installation", `https://api.github.com/app/installations/${installationId}`, {
    headers: { Authorization: `Bearer ${await appJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GITHUB_INSTALLATION_${response.status}`);
  return response.json();
}
async function installationToken(installationId: number) {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await timedFetch("github-token", `https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await appJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (response.ok) return String((await response.json()).token || "");
    last = `${response.status}`;
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) break;
    await sleep(250 * (2 ** (attempt - 1)));
  }
  throw new Error(last === "401" ? "GITHUB_TOKEN_EXPIRED" : `GITHUB_TOKEN_FAILED_${last}`);
}

function authToken(req: Request) {
  return (req.headers.get("authorization") || req.headers.get("x-msk-license") || "").replace(/^Bearer\s+/i, "").trim();
}
async function resolveIdentity(req: Request) {
  const token = authToken(req);
  if (!token || token.startsWith("sb_publishable_")) return null;
  const auth = await db.auth.getUser(token);
  if (!auth.error && auth.data.user) return { id: auth.data.user.id };
  for (const origin of ["https://msksystem.online", "https://msk-system.lovable.app"]) {
    try {
      const response = await timedFetch("license", `${origin}/api/extension/license-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      }, 3000);
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      if (data?.ok && data?.active && /^[0-9a-f-]{36}$/i.test(String(data.user_id || ""))) return { id: String(data.user_id) };
    } catch {}
  }
  return null;
}
async function sha(value: string) {
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}

async function health() {
  const services: Record<string, any> = {};
  try {
    const { error } = await db.from("msk_projects").select("lovable_project_id", { head: true, count: "exact" }).limit(1);
    services.database = { status: error ? "down" : "up" };
  } catch { services.database = { status: "down" }; }
  try {
    const { count, error } = await db.from("msk_tasks").select("id", { head: true, count: "exact" }).in("status", ["locating_files", "analyzing", "editing", "self_correcting", "validating", "committing", "verifying", "finalizing"]);
    services.task_runtime = { status: error ? "degraded" : Number(count || 0) > 20 ? "degraded" : "up", active: Number(count || 0) };
  } catch { services.task_runtime = { status: "degraded" }; }
  try {
    const { data: settings, error } = await db.from("msk_ai_settings").select("active,api_key_ciphertext").eq("id", "default").maybeSingle();
    const configured = !error && (!!settings?.api_key_ciphertext || !!Deno.env.get("BAI_API_KEY")) && settings?.active !== false;
    services.ai_provider = { status: configured ? "up" : "down", model: "MSK-IA", configured };
  } catch { services.ai_provider = { status: "degraded", model: "MSK-IA" }; }
  services.github_api = { status: "down", connected: false, write_authorized: false };
  return { status: Object.values(services).some((s: any) => s.status === "down") ? "down" : Object.values(services).some((s: any) => s.status === "degraded") ? "degraded" : "ok", services, timestamp: nowIso() };
}

async function preflight(req: Request, body: any) {
  const blockers: any[] = [];
  const warnings: any[] = [];
  const service = await health();
  const user = await resolveIdentity(req);
  if (!user) return { ready: false, blockers: [{ code: "AUTH_REQUIRED", message: "Valide sua licença MSK para continuar.", action: "Validar licença" }], warnings, services: service.services, context: null, timestamp: nowIso() };

  const projectId = String(body?.lovable_project_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return { ready: false, blockers: [{ code: "PROJECT_ID_INVALID", message: "Abra um projeto Lovable válido antes de enviar comandos." }], warnings, services: service.services, context: { user_id: user.id }, timestamp: nowIso() };

  const { data: project, error: projectError } = await db.from("msk_projects").select("lovable_project_id,user_id,github_installation_id,github_owner,github_repo,github_default_branch,session_token_hash").eq("lovable_project_id", projectId).maybeSingle();
  if (projectError) blockers.push({ code: "DATABASE_UNAVAILABLE", message: "Não foi possível confirmar o projeto no banco agora.", action: "Tentar novamente" });
  if (project?.user_id && String(project.user_id) !== user.id) blockers.push({ code: "PROJECT_OWNERSHIP_MISMATCH", message: "Este projeto pertence a outra licença MSK." });

  const hasInstallation = Number(project?.github_installation_id || 0) > 0;
  const hasBoundRepo = !!project?.github_owner && !!project?.github_repo;
  if (!hasInstallation) blockers.push({ code: "GITHUB_AUTH_REQUIRED", message: "Conecte o GitHub antes de enviar uma edição.", action: "Conectar GitHub" });
  if (!hasBoundRepo) blockers.push({ code: "NO_REPOSITORY_SELECTED", message: "O projeto ainda não possui um repositório GitHub confirmado.", action: "Conectar GitHub" });

  const session = String(req.headers.get("x-msk-session") || "").trim();
  const validSession = !!session && !!project?.session_token_hash && await sha(session) === String(project.session_token_hash);
  if (hasInstallation && hasBoundRepo && !validSession) blockers.push({ code: "MSK_SESSION_REQUIRED", message: "A sessão de edição precisa ser renovada. Clique em verificar novamente.", action: "Verificar novamente" });
  if (service.services.database?.status === "down" && !blockers.some(x => x.code === "DATABASE_UNAVAILABLE")) blockers.push({ code: "DATABASE_UNAVAILABLE", message: "O banco do agente está indisponível no momento.", action: "Tentar novamente" });
  if (service.services.ai_provider?.status === "down") blockers.push({ code: "AI_PROVIDER_UNAVAILABLE", message: "A inteligência MSK está temporariamente indisponível.", action: "Tentar novamente" });
  if (service.services.task_runtime?.status === "degraded") warnings.push({ code: "QUEUE_BUSY", message: "Há várias tarefas ativas. A edição pode levar mais tempo." });

  let selectedRepository: any = null;
  let connected = false;
  let tokenValid = false;
  let writeAuthorized = false;
  let prAuthorized = false;

  if (hasInstallation && hasBoundRepo && !blockers.some(x => ["PROJECT_OWNERSHIP_MISMATCH", "DATABASE_UNAVAILABLE"].includes(x.code))) {
    try {
      const installationId = Number(project.github_installation_id);
      const installation = await getInstallation(installationId);
      if (!installation || installation?.suspended_at) {
        blockers.push({ code: "GITHUB_AUTH_REQUIRED", message: "A instalação GitHub não está ativa. Reconecte o GitHub.", action: "Reconectar GitHub" });
      } else {
        const permissions = installation?.permissions || {};
        const contents = String(permissions?.contents || "none").toLowerCase();
        const pullRequests = String(permissions?.pull_requests || "none").toLowerCase();
        writeAuthorized = ["write", "admin"].includes(contents);
        prAuthorized = ["write", "admin"].includes(pullRequests);
        if (!writeAuthorized) blockers.push({ code: "GITHUB_WRITE_PERMISSION_REQUIRED", message: "A GitHub App MSK está conectada, mas falta Contents: write. Atualize as permissões da instalação.", action: "Revisar permissões" });

        const token = await installationToken(installationId);
        tokenValid = !!token;
        const fullName = `${project.github_owner}/${project.github_repo}`;
        const repoResponse = await timedFetch("github-repo", `https://api.github.com/repos/${fullName}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        });
        if (repoResponse.status === 401) blockers.push({ code: "GITHUB_TOKEN_EXPIRED", message: "A autorização do GitHub não é mais válida.", action: "Reconectar GitHub" });
        else if (repoResponse.status === 403) blockers.push({ code: "GITHUB_REPOSITORY_ACCESS_DENIED", message: "A instalação MSK não consegue acessar este repositório.", action: "Revisar permissões" });
        else if (repoResponse.status === 404) blockers.push({ code: "GITHUB_REPOSITORY_NOT_AUTHORIZED", message: "O repositório não está incluído na instalação atual da GitHub App MSK.", action: "Revisar repositórios" });
        else if (!repoResponse.ok) blockers.push({ code: "GITHUB_REPOSITORY_UNAVAILABLE", message: "O repositório conectado não pôde ser confirmado agora.", action: "Tentar novamente" });
        else {
          connected = true;
          const repo = await repoResponse.json();
          const branch = String(project.github_default_branch || repo.default_branch || "main");
          const branchResponse = await timedFetch("github-branch", `https://api.github.com/repos/${fullName}/branches/${encodeURIComponent(branch)}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
          });
          let protectedBranch = false;
          if (branchResponse.ok) protectedBranch = !!(await branchResponse.json())?.protected;
          else if (branchResponse.status === 404) blockers.push({ code: "BRANCH_NOT_FOUND", message: `A branch ${branch} não existe no repositório.`, action: "Revisar projeto" });
          else if (branchResponse.status === 403) blockers.push({ code: "GITHUB_BRANCH_ACCESS_DENIED", message: `A instalação GitHub não consegue consultar a branch ${branch}.`, action: "Revisar permissões" });
          if (protectedBranch) {
            if (prAuthorized) warnings.push({ code: "BRANCH_PROTECTED", message: `A branch ${branch} é protegida. A MSK usará branch/PR automaticamente.` });
            else blockers.push({ code: "GITHUB_PULL_REQUEST_PERMISSION_REQUIRED", message: `A branch ${branch} é protegida e a GitHub App precisa de Pull requests: write.`, action: "Revisar permissões" });
          }
          selectedRepository = { full_name: fullName, default_branch: branch, permissions: { contents, pull_requests: pullRequests, write: writeAuthorized }, branch_editable: writeAuthorized && !protectedBranch, protected: protectedBranch, force_pr: protectedBranch };
        }
      }
    } catch (error) {
      const message = String((error as any)?.message || "");
      const code = message.includes("CIRCUIT_OPEN") ? "GITHUB_CIRCUIT_OPEN" : message.includes("TOKEN") ? "GITHUB_TOKEN_EXPIRED" : "GITHUB_UNAVAILABLE";
      blockers.push({ code, message: code === "GITHUB_CIRCUIT_OPEN" ? "O GitHub está temporariamente em proteção de circuito. Tente novamente em alguns segundos." : "Não foi possível confirmar a conexão GitHub agora.", action: "Tentar novamente" });
    }
  }

  const githubBlocker = blockers.some(x => /^(GITHUB_|NO_REPOSITORY_SELECTED|MSK_SESSION_REQUIRED)/.test(String(x.code || "")));
  service.services.github_api = { status: connected && tokenValid && writeAuthorized && !githubBlocker ? "up" : "down", connected, token_valid: tokenValid, write_authorized: writeAuthorized, pull_request_authorized: prAuthorized };

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    services: service.services,
    context: {
      user_id: user.id,
      has_github_connection: hasInstallation && connected,
      has_valid_token: tokenValid,
      has_valid_session: validSession,
      github_write_authorized: writeAuthorized,
      github_pull_request_authorized: prAuthorized,
      repositories_linked: hasBoundRepo ? 1 : 0,
      selected_repository: selectedRepository,
      branch_editable: selectedRepository?.branch_editable === true,
      force_pr: selectedRepository?.force_pr === true,
    },
    timestamp: nowIso(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (req.method === "GET" ? "health" : "preflight");
  if (action === "health") return json(await health());
  if (action !== "preflight") return json({ ready: false, blockers: [{ code: "ACTION_NOT_SUPPORTED", message: "Ação de pre-flight inválida." }], warnings: [] }, 400);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(url.searchParams.entries());
  const result = await preflight(req, body);
  return json(result, result.ready ? 200 : 409);
});