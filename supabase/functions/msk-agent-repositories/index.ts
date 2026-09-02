import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ausente: ${name}`);
  return value;
};
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64bytes = (value: string) => Uint8Array.from(atob(value.replace(/\s/g, "")), c => c.charCodeAt(0));
const derLen = (n: number) => n < 128 ? new Uint8Array([n]) : (() => {
  const a: number[] = [];
  for (let v = n; v > 0; v >>>= 8) a.unshift(v & 255);
  return new Uint8Array([128 | a.length, ...a]);
})();
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
};
const wrap = (tag: number, value: Uint8Array) => join(new Uint8Array([tag]), derLen(value.length), value);
const pkcs1 = (raw: Uint8Array) => wrap(48, join(
  new Uint8Array([2, 1, 0]),
  new Uint8Array([48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0]),
  wrap(4, raw),
));

const sha256 = async (value: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));

async function appKey() {
  const value = env("GITHUB_APP_PRIVATE_KEY").trim().replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  const match = value.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
  if (match) {
    const raw = b64bytes(match[2]);
    return crypto.subtle.importKey("pkcs8", match[1] === "RSA PRIVATE KEY" ? pkcs1(raw) : raw, algorithm, false, ["sign"]);
  }
  return crypto.subtle.importKey("pkcs8", b64bytes(value), algorithm, false, ["sign"]);
}

async function appJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(enc.encode(JSON.stringify({ iat: now - 30, exp: now + 540, iss: env("GITHUB_APP_ID") })));
  const unsigned = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await appKey(), enc.encode(unsigned)));
  return `${unsigned}.${b64url(signature)}`;
}

async function installationToken(installationId: number) {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await appJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GITHUB_TOKEN_${response.status}`);
  const data = await response.json().catch(() => ({}));
  const token = String(data?.token || "");
  if (!token) throw new Error("GITHUB_TOKEN_EMPTY");
  return token;
}

async function installationInfo(installationId: number) {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${await appJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) return null;
  return await response.json().catch(() => null);
}

async function identityFromLicense(req: Request) {
  const token = (req.headers.get("authorization") || req.headers.get("x-msk-license") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.startsWith("sb_publishable_")) return null;
  for (const origin of [
    "https://msksystem.online",
    "https://msk-system.lovable.app",
    "https://id-preview--2763a21e-c47d-4e62-bc58-ab51fe5dc2d5.lovable.app",
  ]) {
    try {
      const response = await fetch(`${origin}/api/extension/license-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      const userId = String(data?.user_id || "").trim();
      if (data?.ok === true && data?.active === true && /^[0-9a-f-]{36}$/i.test(userId)) return { userId };
    } catch {}
  }
  return null;
}

async function validSession(projectId: string, token: string) {
  if (!token) return false;
  const { data } = await db.from("msk_projects").select("session_token_hash").eq("lovable_project_id", projectId).maybeSingle();
  return !!data?.session_token_hash && data.session_token_hash === await sha256(token);
}

const normalizeRepo = (value: unknown) => {
  const text = String(value || "").trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git(?:[?#].*)?$/i, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "");
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text) ? text : "";
};

async function listInstallationRepositories(token: string) {
  const repos: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const response = await fetch(`https://api.github.com/installation/repositories?per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`GITHUB_REPOSITORIES_${response.status}`);
    const data = await response.json().catch(() => ({}));
    const pageRepos = Array.isArray(data?.repositories) ? data.repositories : [];
    repos.push(...pageRepos);
    if (pageRepos.length < 100) break;
  }
  return repos;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const action = new URL(req.url).searchParams.get("action") || "list";
  if (action === "health") return json({ ok: true, service: "msk-agent-repositories", version: "1.0.0", manual_repository: true, repository_history: true });

  const identity = await identityFromLicense(req);
  if (!identity) return json({ ok: false, connected: false, code: "LICENSE_REQUIRED", error: "Valide uma licença MSK ativa." }, 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.lovable_project_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ ok: false, code: "PROJECT_REQUIRED", error: "Projeto Lovable inválido." }, 400);

  const { data: project } = await db.from("msk_projects")
    .select("user_id,github_installation_id,github_owner,github_repo,github_default_branch")
    .eq("lovable_project_id", projectId)
    .maybeSingle();

  if (!project || !project.github_installation_id) return json({ ok: false, connected: false, code: "GITHUB_NOT_CONNECTED", error: "Conecte o GitHub primeiro." }, 409);
  if (project?.user_id && String(project.user_id) !== identity.userId) return json({ ok: false, code: "PROJECT_OWNERSHIP_MISMATCH", error: "Este projeto pertence a outra licença MSK." }, 403);

  const session = req.headers.get("x-msk-session") || "";
  if (!await validSession(projectId, session)) return json({ ok: false, connected: false, code: "MSK_SESSION_REQUIRED", error: "A sessão GitHub do projeto precisa ser recuperada." }, 401);

  try {
    const installationId = Number(project.github_installation_id);
    const token = await installationToken(installationId);
    const [reposRaw, installation] = await Promise.all([
      listInstallationRepositories(token),
      installationInfo(installationId),
    ]);

    const repositories = reposRaw
      .map((repo: any) => ({
        id: Number(repo?.id || 0),
        full_name: String(repo?.full_name || ""),
        name: String(repo?.name || ""),
        owner: String(repo?.owner?.login || ""),
        private: repo?.private === true,
        default_branch: String(repo?.default_branch || "main"),
        html_url: String(repo?.html_url || ""),
        updated_at: String(repo?.updated_at || ""),
        archived: repo?.archived === true,
      }))
      .filter((repo: any) => normalizeRepo(repo.full_name))
      .sort((a: any, b: any) => Date.parse(b.updated_at || "") - Date.parse(a.updated_at || "") || a.full_name.localeCompare(b.full_name));

    const selectedRepository = project.github_owner && project.github_repo ? `${project.github_owner}/${project.github_repo}` : "";
    const githubLogin = String(installation?.account?.login || repositories[0]?.owner || "");

    if (action === "list") {
      return json({
        ok: true,
        connected: true,
        github_login: githubLogin,
        installation_id: installationId,
        selected_repository: selectedRepository,
        repositories,
        repositories_count: repositories.length,
      });
    }

    if (action === "select") {
      const requested = normalizeRepo(body?.repository || body?.repository_url || body?.full_name || "");
      if (!requested) return json({ ok: false, code: "REPOSITORY_INVALID", error: "Informe owner/repo ou a URL completa do GitHub." }, 400);
      const match = repositories.find((repo: any) => repo.full_name.toLowerCase() === requested.toLowerCase());
      if (!match) return json({
        ok: false,
        code: "REPOSITORY_NOT_AUTHORIZED",
        error: "Esse repositório não está autorizado para o GitHub App MSK. Adicione-o à instalação do GitHub e tente novamente.",
        repository: requested,
      }, 403);

      const { error } = await db.from("msk_projects").update({
        github_owner: match.owner,
        github_repo: match.name,
        github_default_branch: match.default_branch || "main",
        updated_at: new Date().toISOString(),
      }).eq("lovable_project_id", projectId).eq("user_id", identity.userId);
      if (error) {
        console.error("MSK repository select failed", error.message);
        return json({ ok: false, code: "REPOSITORY_SELECTION_FAILED", error: "Não foi possível salvar o repositório selecionado." }, 500);
      }

      return json({
        ok: true,
        connected: true,
        selected: true,
        repository: match.full_name,
        branch: match.default_branch || "main",
        github_login: githubLogin,
      });
    }

    return json({ ok: false, code: "ACTION_NOT_SUPPORTED" }, 400);
  } catch (error) {
    console.error("MSK repositories service", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, code: "GITHUB_REPOSITORIES_UNAVAILABLE", retryable: true, error: "Não foi possível carregar os repositórios autorizados do GitHub agora." }, 503);
  }
});
