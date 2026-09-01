import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(SUPABASE_URL, SERVICE_ROLE);
const enc = new TextEncoder();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-license",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const healthCache: { until: number; value: any | null } = { until: 0, value: null };
type Circuit = { failures: number; openUntil: number };
const circuits = new Map<string, Circuit>();

function circuitState(name: string) {
  return circuits.get(name) || { failures: 0, openUntil: 0 };
}
function circuitSuccess(name: string) { circuits.set(name, { failures: 0, openUntil: 0 }); }
function circuitFailure(name: string) {
  const current = circuitState(name);
  const failures = current.failures + 1;
  circuits.set(name, { failures, openUntil: failures >= 3 ? Date.now() + 15_000 : 0 });
}

async function timedFetch(service: string, url: string, init: RequestInit = {}, timeoutMs = 2500) {
  const state = circuitState(service);
  if (state.openUntil > Date.now()) throw Object.assign(new Error(`${service}_CIRCUIT_OPEN`), { code: "CIRCUIT_OPEN" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status >= 500) circuitFailure(service); else circuitSuccess(service);
    return response;
  } catch (error) {
    circuitFailure(service);
    throw error;
  } finally { clearTimeout(timer); }
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
  const alg = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
  const raw = b64bytes(match[2]);
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

async function installationToken(installationId: number) {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await timedFetch("github", `https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await appJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    }, 3500);
    if (response.ok) return String((await response.json()).token || "");
    last = `${response.status}`;
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) break;
    await sleep(250 * (2 ** (attempt - 1)));
  }
  throw new Error(last === "401" ? "GITHUB_TOKEN_EXPIRED" : "GITHUB_TOKEN_FAILED");
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
      }, 2500);
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      if (data?.ok && data?.active && /^[0-9a-f-]{36}$/i.test(String(data.user_id || ""))) return { id: String(data.user_id) };
    } catch {}
  }
  return null;
}

async function serviceHealth() {
  if (healthCache.value && healthCache.until > Date.now()) return healthCache.value;
  const services: Record<string, any> = {};

  const dbStart = performance.now();
  try {
    const { error } = await db.from("msk_projects").select("lovable_project_id", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    services.database = { status: "up", latency: Math.round(performance.now() - dbStart) };
  } catch {
    services.database = { status: "down", latency: Math.round(performance.now() - dbStart) };
  }

  const taskStart = performance.now();
  try {
    const { count, error } = await db.from("msk_tasks").select("id", { head: true, count: "exact" }).in("status", ["locating_files", "analyzing", "editing", "self_correcting", "validating", "committing", "verifying", "finalizing"]);
    if (error) throw error;
    services.task_runtime = { status: Number(count || 0) > 20 ? "degraded" : "up", latency: Math.round(performance.now() - taskStart), active: Number(count || 0) };
  } catch {
    services.task_runtime = { status: "degraded", latency: Math.round(performance.now() - taskStart) };
  }

  const githubStart = performance.now();
  try {
    const response = await timedFetch("github-health", "https://api.github.com/meta", { headers: { Accept: "application/vnd.github+json" } }, 2200);
    services.github_api = { status: response.status < 500 ? "up" : "down", latency: Math.round(performance.now() - githubStart) };
  } catch {
    services.github_api = { status: "down", latency: Math.round(performance.now() - githubStart) };
  }

  const aiStart = performance.now();
  try {
    const { data: settings } = await db.from("msk_ai_settings").select("active,api_key_ciphertext,model").eq("id", "default").maybeSingle();
    const configured = !!settings?.api_key_ciphertext || !!Deno.env.get("BAI_API_KEY");
    if (!configured || settings?.active === false) {
      services.ai_provider = { status: "down", latency: Math.round(performance.now() - aiStart), model: "MSK-IA", configured: false };
    } else {
      const response = await timedFetch("ai-health", "https://api.b.ai/v1/models", { method: "HEAD" }, 2200);
      services.ai_provider = { status: response.status >= 500 ? "down" : "up", latency: Math.round(performance.now() - aiStart), model: "MSK-IA", configured: true };
    }
  } catch {
    services.ai_provider = { status: "degraded", latency: Math.round(performance.now() - aiStart), model: "MSK-IA" };
  }

  const down = Object.values(services).filter((s: any) => s.status === "down").length;
  const degraded = Object.values(services).filter((s: any) => s.status === "degraded").length;
  const value = { status: down > 0 ? "down" : degraded > 0 ? "degraded" : "ok", services, timestamp: nowIso(), architecture: { redis: "not_used", queue: "database-backed-task-runtime" } };
  healthCache.value = value;
  healthCache.until = Date.now() + 20_000;
  return value;
}

async function preflight(req: Request, body: any) {
  const blockers: any[] = [];
  const warnings: any[] = [];
  const user = await resolveIdentity(req);
  if (!user) return { ready: false, blockers: [{ code: "AUTH_REQUIRED", message: "Valide sua licença MSK para continuar.", action: "Validar licença" }], warnings, context: null, timestamp: nowIso() };

  const projectId = String(body?.lovable_project_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return { ready: false, blockers: [{ code: "PROJECT_ID_INVALID", message: "Abra um projeto Lovable válido antes de enviar comandos." }], warnings, context: { user_id: user.id }, timestamp: nowIso() };

  const { data: project, error: projectError } = await db.from("msk_projects").select("lovable_project_id,user_id,github_installation_id,github_owner,github_repo,github_default_branch").eq("lovable_project_id", projectId).maybeSingle();
  if (projectError) blockers.push({ code: "DATABASE_UNAVAILABLE", message: "Não foi possível confirmar o projeto no banco agora.", action: "Tentar novamente" });
  if (project?.user_id && String(project.user_id) !== user.id) blockers.push({ code: "PROJECT_OWNERSHIP_MISMATCH", message: "Este projeto pertence a outra licença MSK." });
  if (!project?.github_installation_id) blockers.push({ code: "GITHUB_AUTH_REQUIRED", message: "Conecte o GitHub antes de enviar uma edição.", action: "Conectar GitHub" });
  if (!project?.github_owner || !project?.github_repo) blockers.push({ code: "NO_REPOSITORY_SELECTED", message: "O projeto ainda não possui um repositório GitHub confirmado.", action: "Conectar GitHub" });

  const { data: settings } = await db.from("msk_ai_settings").select("active,api_key_ciphertext").eq("id", "default").maybeSingle();
  if ((!settings?.api_key_ciphertext && !Deno.env.get("BAI_API_KEY")) || settings?.active === false) blockers.push({ code: "AI_CONFIGURATION_ERROR", message: "A inteligência MSK não está configurada no servidor.", action: "Tentar novamente" });

  let selectedRepository: any = null;
  if (!blockers.some(item => ["GITHUB_AUTH_REQUIRED", "NO_REPOSITORY_SELECTED", "PROJECT_OWNERSHIP_MISMATCH"].includes(item.code))) {
    try {
      const installationId = Number(project.github_installation_id || 0);
      const token = await installationToken(installationId);
      const fullName = `${project.github_owner}/${project.github_repo}`;
      const repoResponse = await timedFetch("github", `https://api.github.com/repos/${fullName}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }, 3500);
      if (repoResponse.status === 401) blockers.push({ code: "GITHUB_TOKEN_EXPIRED", message: "A autorização do GitHub não é mais válida.", action: "Reconectar GitHub" });
      else if (repoResponse.status === 403) blockers.push({ code: "GITHUB_PERMISSION_DENIED", message: "O GitHub recusou o acesso da MSK a este repositório.", action: "Revisar permissões" });
      else if (!repoResponse.ok) blockers.push({ code: "GITHUB_REPOSITORY_UNAVAILABLE", message: "O repositório conectado não pôde ser confirmado agora.", action: "Tentar novamente" });
      else {
        const repo = await repoResponse.json();
        const branch = String(project.github_default_branch || repo.default_branch || "main");
        const push = repo?.permissions?.push !== false;
        const admin = repo?.permissions?.admin === true;
        const remaining = Number(repoResponse.headers.get("x-ratelimit-remaining") || NaN);
        if (!push) blockers.push({ code: "GITHUB_PERMISSION_DENIED", message: "A instalação GitHub não possui permissão de escrita neste repositório.", action: "Revisar permissões" });
        if (Number.isFinite(remaining) && remaining < 150) warnings.push({ code: "RATE_LIMIT_NEAR", message: `GitHub próximo do limite de API (${remaining} requisições restantes).` });

        const branchResponse = await timedFetch("github", `https://api.github.com/repos/${fullName}/branches/${encodeURIComponent(branch)}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }, 3500);
        let protectedBranch = false;
        if (branchResponse.ok) protectedBranch = !!(await branchResponse.json())?.protected;
        else if (branchResponse.status === 404) blockers.push({ code: "BRANCH_NOT_FOUND", message: `A branch ${branch} não existe no repositório.`, action: "Revisar projeto" });
        if (protectedBranch) warnings.push({ code: "BRANCH_PROTECTED", message: `A branch ${branch} é protegida. A MSK deve usar branch/PR em vez de push direto.` });

        selectedRepository = {
          full_name: fullName,
          default_branch: branch,
          permissions: { push, admin },
          branch_editable: push && !protectedBranch,
          protected: protectedBranch,
          force_pr: protectedBranch,
        };
      }
    } catch (error) {
      const message = String((error as any)?.message || "");
      const code = message.includes("CIRCUIT_OPEN") ? "GITHUB_CIRCUIT_OPEN" : message.includes("TOKEN") ? "GITHUB_TOKEN_EXPIRED" : "GITHUB_UNAVAILABLE";
      blockers.push({ code, message: code === "GITHUB_CIRCUIT_OPEN" ? "O GitHub está temporariamente em proteção de circuito. Tente novamente em alguns segundos." : "Não foi possível confirmar a conexão GitHub agora.", action: "Tentar novamente" });
    }
  }

  const health = await serviceHealth();
  if (health.services.database?.status === "down" && !blockers.some(item => item.code === "DATABASE_UNAVAILABLE")) blockers.push({ code: "DATABASE_UNAVAILABLE", message: "O banco do agente está indisponível no momento.", action: "Tentar novamente" });
  if (health.services.ai_provider?.status === "down" && !blockers.some(item => item.code === "AI_CONFIGURATION_ERROR")) blockers.push({ code: "AI_PROVIDER_UNAVAILABLE", message: "A inteligência MSK está temporariamente indisponível.", action: "Tentar novamente" });
  if (health.services.task_runtime?.status === "degraded") warnings.push({ code: "QUEUE_BUSY", message: "Há várias tarefas ativas. A edição pode levar mais tempo." });

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    services: health.services,
    context: {
      user_id: user.id,
      has_github_connection: !!project?.github_installation_id,
      has_valid_token: !blockers.some(item => ["GITHUB_TOKEN_EXPIRED", "GITHUB_AUTH_REQUIRED"].includes(item.code)),
      repositories_linked: project?.github_repo ? 1 : 0,
      selected_repository: selectedRepository,
      branch_editable: selectedRepository?.branch_editable !== false,
      force_pr: selectedRepository?.force_pr === true,
    },
    timestamp: nowIso(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (req.method === "GET" ? "health" : "preflight");
  if (action === "health") return json(await serviceHealth());
  if (action !== "preflight") return json({ ready: false, blockers: [{ code: "ACTION_NOT_SUPPORTED", message: "Ação de pre-flight inválida." }], warnings: [] }, 400);
  let body: any = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  else body = Object.fromEntries(url.searchParams.entries());
  const result = await preflight(req, body);
  return json(result, result.ready ? 200 : 409);
});
