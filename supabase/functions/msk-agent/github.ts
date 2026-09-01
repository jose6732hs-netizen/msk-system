import { b64, unb64, enc, dec, env, db, sha } from "./common.ts";
import { AgentError } from "./errors.ts";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const hmac = async (v: string) => {
  const k = await crypto.subtle.importKey("raw", enc.encode(env("MSK_STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(v))));
};

export const makeState = async (projectId: string, returnUrl: string, repository: string, userId: string) => {
  const p = b64(enc.encode(JSON.stringify({ projectId, returnUrl, repository, userId, exp: Date.now() + 900000 })));
  return `${p}.${await hmac(p)}`;
};

export const readState = async (s: string) => {
  const [p, q] = s.split(".");
  if (!p || !q || q !== await hmac(p)) throw new AgentError("OAUTH_STATE_INVALID", "O estado de autorização do GitHub é inválido.", { stage: "auth", httpStatus: 401 });
  let d: any;
  try { d = JSON.parse(dec.decode(unb64(p))); }
  catch (error) { throw new AgentError("OAUTH_STATE_INVALID", "O estado de autorização não pôde ser lido.", { stage: "auth", httpStatus: 401, cause: error }); }
  if (Number(d?.exp || 0) < Date.now() || !/^https:\/\/lovable\.dev\/projects\//.test(String(d?.returnUrl || ""))) {
    throw new AgentError("OAUTH_STATE_INVALID", "A autorização do GitHub expirou.", { stage: "auth", httpStatus: 401 });
  }
  return d;
};

const derLen = (n: number) => n < 128 ? new Uint8Array([n]) : (() => {
  const a: number[] = [];
  for (let v = n; v > 0; v >>>= 8) a.unshift(v & 255);
  return new Uint8Array([128 | a.length, ...a]);
})();
const join = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((s, x) => s + x.length, 0)); let n = 0; for (const x of p) { o.set(x, n); n += x.length; } return o; };
const wrap = (t: number, v: Uint8Array) => join(new Uint8Array([t]), derLen(v.length), v);
const pkcs1 = (r: Uint8Array) => wrap(48, join(new Uint8Array([2, 1, 0]), new Uint8Array([48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0]), wrap(4, r)));
const b64bytes = (v: string) => Uint8Array.from(atob(v.replace(/\s/g, "")), c => c.charCodeAt(0));

async function appKey() {
  let v = env("GITHUB_APP_PRIVATE_KEY").trim().replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  const m = v.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  try {
    const alg = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
    if (m) {
      const raw = b64bytes(m[2]);
      return await crypto.subtle.importKey("pkcs8", m[1] === "RSA PRIVATE KEY" ? pkcs1(raw) : raw, alg, false, ["sign"]);
    }
    return await crypto.subtle.importKey("pkcs8", b64bytes(v), alg, false, ["sign"]);
  } catch (error) {
    console.error("MSK GitHub key invalid", error instanceof Error ? error.name : "invalid");
    throw new AgentError("GITHUB_APP_CREDENTIALS_INVALID", "A credencial interna do GitHub App está inválida.", { stage: "auth", httpStatus: 503, cause: error });
  }
}

async function appJwt() {
  const n = Math.floor(Date.now() / 1000);
  const h = b64(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const p = b64(enc.encode(JSON.stringify({ iat: n - 30, exp: n + 540, iss: env("GITHUB_APP_ID") })));
  const u = `${h}.${p}`;
  return `${u}.${b64(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await appKey(), enc.encode(u))))}`;
}

async function timedFetch(url: string, init: RequestInit = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new AgentError("GITHUB_API_TIMEOUT", "O GitHub demorou além do limite seguro de resposta.", { stage: "repository", retryable: true, httpStatus: 503, cause: error });
    throw new AgentError("GITHUB_NETWORK_UNAVAILABLE", "A conexão com o GitHub ficou indisponível.", { stage: "repository", retryable: true, httpStatus: 503, cause: error });
  } finally { clearTimeout(timer); }
}

function githubHttpError(status: number, detail = "") {
  const context = { githubStatus: status, detail: detail.slice(0, 500) };
  if (status === 401) return new AgentError("GITHUB_AUTH_FAILED", "A autorização do GitHub foi recusada.", { stage: "repository", httpStatus: 401, context });
  if (status === 403) return new AgentError("GITHUB_PERMISSION_DENIED", "O GitHub recusou a operação por falta de permissão.", { stage: "repository", httpStatus: 403, context });
  if (status === 404) return new AgentError("GITHUB_RESOURCE_NOT_FOUND", "O recurso necessário não foi encontrado no GitHub.", { stage: "repository", httpStatus: 404, context });
  if (status === 409 || status === 422) return new AgentError("GITHUB_CONFLICT", "O repositório mudou durante a operação e ocorreu conflito.", { stage: "repository", retryable: true, httpStatus: 409, context });
  if (status === 429) return new AgentError("GITHUB_RATE_LIMIT", "O GitHub limitou temporariamente as requisições do agente.", { stage: "repository", retryable: true, httpStatus: 503, context });
  if ([500, 502, 503, 504].includes(status)) return new AgentError("GITHUB_API_UNAVAILABLE", "O GitHub ficou temporariamente indisponível.", { stage: "repository", retryable: true, httpStatus: 503, context });
  return new AgentError("GITHUB_API_ERROR", `O GitHub recusou a operação (${status}).`, { stage: "repository", httpStatus: 502, context });
}

export async function installation(id: number) {
  const r = await timedFetch(`https://api.github.com/app/installations/${id}`, { headers: { Authorization: `Bearer ${await appJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }, 15000);
  if (r.status === 404) return null;
  if (!r.ok) throw githubHttpError(r.status, await r.text().catch(() => ""));
  const d = await r.json();
  return d?.suspended_at ? null : d;
}

export async function instToken(id: number) {
  let last: AgentError | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await timedFetch(`https://api.github.com/app/installations/${id}/access_tokens`, { method: "POST", headers: { Authorization: `Bearer ${await appJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }, 18000);
    if (r.ok) return String((await r.json()).token);
    last = githubHttpError(r.status, await r.text().catch(() => ""));
    if (!last.retryable || attempt === 3) break;
    await sleep(300 * (2 ** (attempt - 1)));
  }
  throw last || new AgentError("GITHUB_TOKEN_FAILED", "Não foi possível obter token da instalação do GitHub.", { stage: "auth", retryable: true, httpStatus: 503 });
}

export async function gh(t: string, path: string, init: RequestInit = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const safeRetry = method === "GET" || method === "HEAD";
  let lastError: AgentError | null = null;
  const maxAttempts = safeRetry ? 3 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await timedFetch(`https://api.github.com${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers || {}) },
      }, safeRetry ? 18000 : 22000);
      if (r.ok) return r.status === 204 ? null : r.json();
      lastError = githubHttpError(r.status, await r.text().catch(() => ""));
      if (!safeRetry || !lastError.retryable || attempt === maxAttempts) throw lastError;
    } catch (error) {
      lastError = error instanceof AgentError ? error : new AgentError("GITHUB_NETWORK_UNAVAILABLE", "A conexão com o GitHub falhou.", { stage: "repository", retryable: true, httpStatus: 503, cause: error });
      if (!safeRetry || !lastError.retryable || attempt === maxAttempts) throw lastError;
    }
    await sleep(300 * (2 ** (attempt - 1)));
  }
  throw lastError || new AgentError("GITHUB_API_ERROR", "Falha inesperada na comunicação com GitHub.", { stage: "repository", httpStatus: 502 });
}

export async function validSession(pid: string, t: string) {
  if (!t) return false;
  const { data } = await db.from("msk_projects").select("session_token_hash").eq("lovable_project_id", pid).maybeSingle();
  return !!data?.session_token_hash && data.session_token_hash === await sha(t);
}

export async function chooseRepo(id: number, _name = "", preferred = "") {
  const t = await instToken(id);
  const d = await gh(t, "/installation/repositories?per_page=100");
  const rs = d.repositories || [];
  const p = String(preferred || "").toLowerCase().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
  const repo = p ? rs.find((r: any) => String(r.full_name).toLowerCase() === p) : (rs.length === 1 ? rs[0] : null);
  return { token: t, repo, candidates: rs.map((r: any) => r.full_name), exact_binding: !!p && !!repo };
}
