import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const enc = new TextEncoder();
const dec = new TextDecoder();
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Secret ausente: ${name}`); return value; };
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const tokenFromRequest = (req: Request) => (req.headers.get("authorization") || req.headers.get("x-msk-license") || "").replace(/^Bearer\s+/i, "").trim();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), c => c.charCodeAt(0));

async function identity(req: Request) {
  const token = tokenFromRequest(req);
  if (!token || token.startsWith("sb_publishable_")) return null;
  const auth = await db.auth.getUser(token);
  if (!auth.error && auth.data.user) return { id: auth.data.user.id };
  for (const origin of ["https://msksystem.online", "https://msk-system.lovable.app"]) {
    try {
      const response = await fetch(`${origin}/api/extension/license-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      if (data?.ok && data?.active && /^[0-9a-f-]{36}$/i.test(String(data.user_id))) return { id: String(data.user_id) };
    } catch {}
  }
  return null;
}

async function shaBase64(value: string) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}

async function validSession(projectId: string, session: string) {
  if (!session) return false;
  const { data } = await db.from("msk_projects").select("session_token_hash").eq("lovable_project_id", projectId).maybeSingle();
  return !!data?.session_token_hash && data.session_token_hash === await shaBase64(session);
}

function derLen(n: number) {
  if (n < 128) return new Uint8Array([n]);
  const bytes: number[] = [];
  for (let value = n; value > 0; value >>>= 8) bytes.unshift(value & 255);
  return new Uint8Array([128 | bytes.length, ...bytes]);
}
function join(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
const wrap = (tag: number, value: Uint8Array) => join(new Uint8Array([tag]), derLen(value.length), value);
const pkcs1 = (raw: Uint8Array) => wrap(48, join(new Uint8Array([2, 1, 0]), new Uint8Array([48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0]), wrap(4, raw)));
const b64bytes = (value: string) => Uint8Array.from(atob(value.replace(/\s/g, "")), c => c.charCodeAt(0));

async function appKey() {
  const source = env("GITHUB_APP_PRIVATE_KEY").trim().replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  const match = source.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
  if (match) {
    const raw = b64bytes(match[2]);
    return crypto.subtle.importKey("pkcs8", match[1] === "RSA PRIVATE KEY" ? pkcs1(raw) : raw, algorithm, false, ["sign"]);
  }
  return crypto.subtle.importKey("pkcs8", b64bytes(source), algorithm, false, ["sign"]);
}
async function appJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(enc.encode(JSON.stringify({ iat: now - 30, exp: now + 540, iss: env("GITHUB_APP_ID") })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await appKey(), enc.encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(signature))}`;
}
async function installationToken(installationId: number) {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await appJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!response.ok) throw new Error(`GITHUB_INSTALLATION_TOKEN_${response.status}`);
  return String((await response.json()).token || "");
}
async function gh(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error: any = new Error(`GITHUB_${response.status}`);
    error.status = response.status;
    error.detail = typeof data === "string" ? data.slice(0, 500) : String(data?.message || "").slice(0, 500);
    throw error;
  }
  return data;
}
async function fetchRepoFile(token: string, owner: string, repo: string, branch: string, path: string) {
  const data = await gh(token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`);
  const bytes = Uint8Array.from(atob(String(data?.content || "").replace(/\n/g, "")), c => c.charCodeAt(0));
  return { path, sha: String(data?.sha || ""), content: dec.decode(bytes) };
}

async function vaultKey() {
  const master = String(Deno.env.get("MSK_TOKEN_ENCRYPTION_KEY") || Deno.env.get("MSK_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!master) throw new Error("VAULT_MASTER_KEY_UNAVAILABLE");
  const material = await crypto.subtle.digest("SHA-256", enc.encode(`msk-credential-vault:v1:${master}`));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await vaultKey(), enc.encode(value));
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(encrypted))}`;
}
async function decryptSecret(value: string) {
  const [version, ivRaw, cipherRaw] = String(value || "").split(".");
  if (version !== "v1" || !ivRaw || !cipherRaw) throw new Error("VAULT_CIPHERTEXT_INVALID");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(ivRaw) }, await vaultKey(), fromB64url(cipherRaw));
  return dec.decode(plain);
}

const normalize = (value: string) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function isCredentialIntent(command: string) {
  const text = normalize(command);
  const credentialWord = /\b(credencial|credenciais|api[ _-]?key|chave[ _-]?(publica|secreta|api)|secret|segredo|client[ _-]?id|client[ _-]?secret|access[ _-]?token|token de api)\b/.test(text);
  const changeVerb = /\b(troqu|troc|mud|alter|atualiz|configur|adicion|substitu|cadastr|salv)/.test(text);
  return credentialWord && changeVerb;
}
function providerFrom(command: string) {
  const text = normalize(command);
  if (/sigilo\s*pay|sigilopay/.test(text)) return "sigilopay";
  if (/atomo\s*pay|atomopay/.test(text)) return "atomopay";
  if (/stripe/.test(text)) return "stripe";
  if (/mercado\s*pago|mercadopago/.test(text)) return "mercadopago";
  if (/supabase/.test(text)) return "supabase";
  if (/openai|chatgpt/.test(text)) return "openai";
  return "generic";
}
const defaultFields: Record<string, string[]> = {
  sigilopay: ["SIGILOPAY_PUBLIC_KEY", "SIGILOPAY_SECRET_KEY", "SIGILOPAY_CLIENT_ID", "SIGILOPAY_API_URL"],
  atomopay: ["ATOMOPAY_SECRET_KEY", "ATOMOPAY_API_URL"],
  stripe: ["STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  mercadopago: ["MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_ACCESS_TOKEN"],
  supabase: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  openai: ["OPENAI_API_KEY"],
  generic: ["API_KEY", "API_URL"],
};
function fieldType(key: string): "public" | "secret" | "url" | "other" {
  if (/URL|ENDPOINT|BASE_URL/.test(key)) return "url";
  if (/PUBLIC|PUBLISHABLE|ANON|CLIENT_ID/.test(key)) return "public";
  if (/SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY/.test(key)) return "secret";
  return "other";
}
function labelFromKey(key: string) {
  return key.toLowerCase().split("_").filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function placeholderFor(key: string, type: string) {
  if (type === "url") return "https://...";
  if (/PUBLIC|PUBLISHABLE/.test(key)) return "pk_...";
  if (/SECRET|TOKEN|API_KEY|SERVICE_ROLE/.test(key)) return "Digite o valor secreto";
  if (/CLIENT_ID/.test(key)) return "client_...";
  return "Digite o valor";
}
function redactCommand(command: string) {
  return String(command || "")
    .replace(/\b(sk|pk|tok|key|secret|token)_[A-Za-z0-9_-]{8,}\b/gi, "[REDACTED]")
    .replace(/((?:secret|segredo|token|api[ _-]?key|chave\s+(?:publica|secreta))\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .slice(0, 12000);
}
function sensitiveEnvName(name: string) {
  return /(?:KEY|SECRET|TOKEN|CLIENT|WEBHOOK|PASSWORD|SUPABASE|STRIPE|SIGILO|ATOMO|MERCADO|OPENAI|API_URL|BASE_URL|ENDPOINT)/.test(name);
}
function extractEnvNames(content: string) {
  const names = new Set<string>();
  const patterns = [
    /(?:process\.env\.|import\.meta\.env\.)([A-Z][A-Z0-9_]{2,})/g,
    /Deno\.env\.get\(\s*["']([A-Z][A-Z0-9_]{2,})["']\s*\)/g,
    /\benv\(\s*["']([A-Z][A-Z0-9_]{2,})["']\s*\)/g,
    /^\s*([A-Z][A-Z0-9_]{2,})\s*=.*$/gm,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) if (sensitiveEnvName(match[1])) names.add(match[1]);
  }
  return [...names];
}
function extractHardcodedKeys(content: string) {
  const names = new Set<string>();
  const upperPattern = /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|CLIENT_ID|CLIENT_SECRET)[A-Z0-9_]*)\b\s*[:=]\s*["'][^"'\n]{8,}["']/g;
  let match;
  while ((match = upperPattern.exec(content))) names.add(match[1]);
  const aliases: Record<string, string> = {
    apiKey: "API_KEY", secretKey: "SECRET_KEY", publicKey: "PUBLIC_KEY", clientId: "CLIENT_ID", clientSecret: "CLIENT_SECRET", accessToken: "ACCESS_TOKEN", token: "TOKEN",
  };
  const camelPattern = /\b(apiKey|secretKey|publicKey|clientId|clientSecret|accessToken|token)\b\s*:\s*["'][^"'\n]{8,}["']/g;
  while ((match = camelPattern.exec(content))) names.add(aliases[match[1]] || String(match[1]).toUpperCase());
  return [...names];
}

const REQUESTED_FIELD_HINTS: Array<[RegExp, RegExp]> = [
  [/\bsecret\s*key|chave\s*secreta\b/i, /SECRET_KEY|SECRET$/i],
  [/\bpublic\s*key|chave\s*p[uú]blica\b/i, /PUBLIC_KEY|PUBLISHABLE/i],
  [/\bclient\s*id\b/i, /CLIENT_ID/i],
  [/\bclient\s*secret\b/i, /CLIENT_SECRET/i],
  [/\bapi\s*key|chave\s*(?:de\s*)?api\b/i, /API_KEY/i],
  [/\bwebhook\b/i, /WEBHOOK/i],
  [/\bbase\s*url|endpoint\b/i, /BASE_URL|URL$/i],
  [/\btoken\b/i, /TOKEN/i],
  [/\bmerchant|lojista\b/i, /MERCHANT/i],
];

function requestedFieldFilters(command: string) {
  return REQUESTED_FIELD_HINTS.filter(([hint]) => hint.test(command)).map(([, key]) => key);
}

async function logTaskEvent(input: { taskId: string; userId: string; projectId: string; stage: string; status?: string; message?: string; payload?: Record<string, unknown> }) {
  try {
    await db.from("msk_task_events").insert({
      task_id: input.taskId,
      user_id: input.userId,
      lovable_project_id: input.projectId,
      stage: input.stage,
      status: input.status || null,
      message: input.message || null,
      payload: input.payload || null,
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "task_event_log_failed", stage: input.stage, task_id: input.taskId }));
  }
}

async function analyzeRepository(project: any, command: string) {

  const owner = String(project.github_owner || "");
  const repo = String(project.github_repo || "");
  const branch = String(project.github_default_branch || "main");
  if (!owner || !repo || !project.github_installation_id) throw new Error("GITHUB_NOT_CONNECTED");
  const token = await installationToken(Number(project.github_installation_id));
  const tree = await gh(token, `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch).replace(/%2F/g, "/")}?recursive=1`);
  const provider = providerFrom(command);
  const providerTerms = provider === "generic" ? [] : [provider.replace("pay", ""), provider];
  const candidates = (tree?.tree || [])
    .filter((item: any) => item?.type === "blob" && /(?:^|\/)(?:\.env(?:\.example)?|[^/]+\.(?:ts|tsx|js|jsx|json|toml|ya?ml))$/i.test(String(item.path || "")))
    .map((item: any) => {
      const path = String(item.path || "");
      const lower = path.toLowerCase();
      let score = 0;
      if (/\.env|config|payment|checkout|gateway|billing|server|api|supabase|function/.test(lower)) score += 10;
      if (/src\/server|src\/routes\/api|supabase\/functions|server\//.test(lower)) score += 8;
      for (const term of providerTerms) if (term && lower.includes(term)) score += 20;
      if (/node_modules|dist|build|coverage|lock\./.test(lower)) score -= 100;
      return { path, score };
    })
    .filter((item: any) => item.score >= 0)
    .sort((a: any, b: any) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 18);

  const envNames = new Set<string>();
  const hardcoded = new Set<string>();
  const analyzedPaths: string[] = [];
  let totalChars = 0;
  for (const candidate of candidates) {
    if (totalChars > 90000) break;
    try {
      const file = await fetchRepoFile(token, owner, repo, branch, candidate.path);
      totalChars += file.content.length;
      analyzedPaths.push(file.path);
      for (const name of extractEnvNames(file.content)) envNames.add(name);
      for (const name of extractHardcodedKeys(file.content)) hardcoded.add(name);
    } catch {}
  }

  const providerPrefix = provider === "generic" ? "" : provider.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let names = [...envNames].filter(name => !providerPrefix || name.includes(providerPrefix) || providerTerms.some(term => name.includes(term.toUpperCase())));
  if (!names.length) names = [...hardcoded];
  if (!names.length) names = defaultFields[provider] || defaultFields.generic;
  names = [...new Set(names)];
  // Quando o cliente citou campos específicos, pedir SOMENTE esses campos.
  const filters = requestedFieldFilters(command);
  if (filters.length) {
    const scoped = names.filter(name => filters.some(pattern => pattern.test(name)));
    if (scoped.length) names = scoped;
  }
  names = names.slice(0, 8);

  const fields = names.map(key => {
    const type = fieldType(key);
    return { key, label: labelFromKey(key), type, placeholder: placeholderFor(key, type), required: true, encrypted: true };
  });
  return {
    provider,
    repository: `${owner}/${repo}`,
    branch,
    fields,
    analyzed_paths: analyzedPaths.slice(0, 20),
    detected_environment_keys: [...envNames].slice(0, 20),
    detected_hardcoded_keys: [...hardcoded].slice(0, 20),
    code_rewrite_recommended: hardcoded.size > 0,
  };
}

async function ensureEnvExample(project: any, token: string, keys: string[]) {
  const owner = String(project.github_owner || "");
  const repo = String(project.github_repo || "");
  const branch = String(project.github_default_branch || "main");
  let original = "";
  let sha = "";
  try {
    const file = await fetchRepoFile(token, owner, repo, branch, ".env.example");
    original = file.content;
    sha = file.sha;
  } catch (error) {
    if (Number((error as any)?.status || 0) !== 404) throw error;
  }
  const existing = new Set(original.split(/\r?\n/).map(line => line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/)?.[1]).filter(Boolean));
  const missing = keys.filter(key => !existing.has(key));
  if (!missing.length) return { changed: false, commit_sha: "", commit_url: "" };
  const prefix = original.trimEnd();
  const addition = missing.map(key => `${key}=`).join("\n");
  const content = `${prefix}${prefix ? "\n\n" : ""}# MSK Credential Vault\n${addition}\n`;
  const payload: any = { message: "MSK: registrar variáveis de credenciais", content: btoa(unescape(encodeURIComponent(content))), branch };
  if (sha) payload.sha = sha;
  const result = await gh(token, `/repos/${owner}/${repo}/contents/.env.example`, { method: "PUT", body: JSON.stringify(payload) });
  return { changed: true, commit_sha: String(result?.commit?.sha || ""), commit_url: String(result?.commit?.html_url || "") };
}

function publicTask(task: any) {
  const request = task?.credential_request && typeof task.credential_request === "object" ? task.credential_request : null;
  return {
    id: task?.id,
    status: task?.status,
    summary: task?.summary || null,
    error: task?.error || null,
    credential_request: request,
    updated_at: task?.updated_at,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const url = new URL(req.url);
  const action = String(url.searchParams.get("action") || "health");
  if (action === "health") return json({ ok: true, service: "msk-agent-vault", version: "1.0.0", encryption: "AES-256-GCM", values_returned: false });

  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, code: "INVALID_JSON", error: "Payload inválido." }, 400); }
  const projectId = String(body.lovable_project_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ ok: false, code: "PROJECT_ID_INVALID", error: "Projeto inválido." }, 400);
  const who = await identity(req);
  if (!who) return json({ ok: false, code: "LICENSE_REQUIRED", error: "Licença MSK necessária." }, 401);
  const { data: project } = await db.from("msk_projects").select("*").eq("lovable_project_id", projectId).maybeSingle();
  if (!project) return json({ ok: false, code: "PROJECT_NOT_FOUND", error: "Projeto MSK não encontrado." }, 404);
  if (project.user_id && String(project.user_id) !== who.id) return json({ ok: false, code: "PROJECT_OWNERSHIP_MISMATCH", error: "Este projeto pertence a outra conta." }, 403);
  if (!await validSession(projectId, String(req.headers.get("x-msk-session") || ""))) return json({ ok: false, code: "MSK_SESSION_REQUIRED", error: "Sessão MSK necessária." }, 401);

  try {
    if (action === "analyze") {
      const command = String(body.command || body.original_command || "").trim();
      if (!command) return json({ ok: false, code: "EMPTY_COMMAND", error: "Comando vazio." }, 400);
      if (!isCredentialIntent(command)) return json({ ok: false, code: "NOT_CREDENTIAL_INTENT", error: "O pedido não foi identificado como alteração de credenciais." }, 422);
      const taskId = /^[0-9a-f-]{36}$/i.test(String(body.task_id || "")) ? String(body.task_id) : crypto.randomUUID();
      const { data: existing } = await db.from("msk_tasks").select("user_id,status").eq("id", taskId).maybeSingle();
      if (existing?.user_id && String(existing.user_id) !== who.id) return json({ ok: false, code: "TASK_OWNERSHIP_MISMATCH", error: "Tarefa pertence a outra conta." }, 403);
      const analysis = await analyzeRepository(project, command);
      const credentialRequest = {
        title: analysis.provider === "generic" ? "Credenciais do Projeto" : `Credenciais · ${analysis.provider}`,
        instructions: "Preencha somente neste card seguro. Os valores não serão enviados para a IA nem gravados no GitHub.",
        fields: analysis.fields,
        provider: analysis.provider,
        repository: analysis.repository,
        branch: analysis.branch,
        analyzed_paths: analysis.analyzed_paths,
        detected_environment_keys: analysis.detected_environment_keys,
        detected_hardcoded_keys: analysis.detected_hardcoded_keys,
        code_rewrite_recommended: analysis.code_rewrite_recommended,
      };
      const write = await db.from("msk_tasks").upsert({
        id: taskId,
        lovable_project_id: projectId,
        user_id: who.id,
        command: redactCommand(command),
        status: "awaiting_credentials",
        summary: "Aguardando preenchimento seguro das credenciais.",
        credential_request: credentialRequest,
        error: null,
        error_code: null,
        error_stage: null,
        retry_count: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (write.error) throw write.error;
      return json({ ok: true, requires_credentials: true, task_id: taskId, status: "awaiting_credentials", credential_card: { taskId, ...credentialRequest } });
    }

    if (action === "status") {
      const taskId = String(body.task_id || "");
      const { data: task } = await db.from("msk_tasks").select("id,status,summary,error,credential_request,updated_at,user_id").eq("id", taskId).eq("lovable_project_id", projectId).maybeSingle();
      if (!task || String(task.user_id || "") !== who.id) return json({ ok: false, code: "TASK_NOT_FOUND" }, 404);
      return json({ ok: true, task: publicTask(task) });
    }

    if (action === "submit") {
      const taskId = String(body.task_id || "");
      const values = body.values && typeof body.values === "object" && !Array.isArray(body.values) ? body.values : {};
      const { data: task } = await db.from("msk_tasks").select("id,status,credential_request,user_id").eq("id", taskId).eq("lovable_project_id", projectId).maybeSingle();
      if (!task || String(task.user_id || "") !== who.id) return json({ ok: false, code: "TASK_NOT_FOUND", error: "Tarefa não encontrada." }, 404);
      if (String(task.status) !== "awaiting_credentials") return json({ ok: false, code: "CREDENTIAL_TASK_NOT_WAITING", error: "Esta tarefa não está aguardando credenciais." }, 409);
      const request = task.credential_request && typeof task.credential_request === "object" ? task.credential_request : {};
      const fields = Array.isArray(request.fields) ? request.fields : [];
      if (!fields.length) return json({ ok: false, code: "CREDENTIAL_FIELDS_MISSING", error: "O card seguro perdeu os campos esperados." }, 409);
      const expected = new Map(fields.map((field: any) => [String(field.key || ""), field]));
      const submittedKeys = Object.keys(values);
      if (!submittedKeys.length || submittedKeys.some(key => !expected.has(key))) return json({ ok: false, code: "CREDENTIAL_PAYLOAD_INVALID", error: "Os campos enviados não correspondem ao card seguro." }, 422);
      for (const [key, field] of expected) {
        const value = String(values[key] ?? "");
        if (field?.required !== false && !value.trim()) return json({ ok: false, code: "CREDENTIAL_REQUIRED", error: `Preencha ${String(field?.label || key)}.` }, 422);
        if (value.length > 8192) return json({ ok: false, code: "CREDENTIAL_TOO_LARGE", error: `O valor de ${key} excede o limite seguro.` }, 422);
        if (field?.type === "url" && value && !/^https:\/\//i.test(value)) return json({ ok: false, code: "CREDENTIAL_URL_INVALID", error: `${String(field?.label || key)} deve usar https://.` }, 422);
      }

      await db.from("msk_tasks").update({ status: "saving_credentials", updated_at: new Date().toISOString() }).eq("id", taskId).eq("user_id", who.id);
      const now = new Date().toISOString();
      const rows = [];
      for (const [key, field] of expected) {
        const value = String(values[key] ?? "");
        rows.push({
          user_id: who.id,
          lovable_project_id: projectId,
          key_name: key,
          encrypted_value: await encryptSecret(value),
          field_type: String(field?.type || "secret"),
          provider: String(request.provider || "generic"),
          metadata: { label: String(field?.label || key), source: "credential_card", version: 1 },
          updated_at: now,
        });
      }
      const saved = await db.from("msk_agent_secrets").upsert(rows, { onConflict: "user_id,lovable_project_id,key_name" });
      if (saved.error) throw saved.error;

      const githubToken = await installationToken(Number(project.github_installation_id));
      const envExample = await ensureEnvExample(project, githubToken, [...expected.keys()]);
      const nextRequest = {
        ...request,
        saved_keys: [...expected.keys()],
        saved_at: now,
        env_example_updated: envExample.changed,
        secret_values_returned: false,
      };
      const summary = [
        `Credenciais salvas com segurança no Cofre MSK (${expected.size} campo(s)).`,
        envExample.changed ? ".env.example atualizado sem valores reais." : "As variáveis já estavam registradas em .env.example.",
        request.code_rewrite_recommended ? "O repositório contém indícios de credencial hardcoded; os valores novos não foram inseridos no código." : "Nenhum valor real foi inserido no código.",
      ].join(" ");
      await db.from("msk_tasks").update({ status: "completed", summary, credential_request: nextRequest, error: null, error_code: null, error_stage: null, updated_at: now }).eq("id", taskId).eq("user_id", who.id);
      console.log(JSON.stringify({ event: "credential_saved", task_id: taskId, user_id: who.id, project_id: projectId, keys: [...expected.keys()], provider: request.provider || "generic", env_example_updated: envExample.changed }));
      return json({ ok: true, completed: true, credential_saved: true, task_id: taskId, saved_keys: [...expected.keys()], secret_values_returned: false, summary, commit_sha: envExample.commit_sha, commit_url: envExample.commit_url });
    }

    if (action === "list") {
      const { data, error } = await db.from("msk_agent_secrets").select("id,key_name,field_type,provider,created_at,updated_at").eq("user_id", who.id).eq("lovable_project_id", projectId).order("updated_at", { ascending: false });
      if (error) throw error;
      return json({ ok: true, secrets: data || [], values_returned: false });
    }

    if (action === "delete") {
      const secretId = String(body.secret_id || "");
      const result = await db.from("msk_agent_secrets").delete().eq("id", secretId).eq("user_id", who.id).eq("lovable_project_id", projectId);
      if (result.error) throw result.error;
      return json({ ok: true, deleted: true, values_returned: false });
    }

    if (action === "self-test") {
      const probe = `msk-${crypto.randomUUID()}`;
      const cipher = await encryptSecret(probe);
      const plain = await decryptSecret(cipher);
      return json({ ok: plain === probe, encryption: "AES-256-GCM", plaintext_returned: false });
    }

    return json({ ok: false, code: "ACTION_NOT_SUPPORTED" }, 400);
  } catch (error) {
    const code = String((error as any)?.message || "VAULT_INTERNAL_ERROR").toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 80) || "VAULT_INTERNAL_ERROR";
    console.error(JSON.stringify({ event: "credential_vault_failure", action, project_id: projectId, user_id: who.id, code }));
    return json({ ok: false, code: code.startsWith("GITHUB_") ? code : "CREDENTIAL_VAULT_ERROR", error: "O Cofre MSK não conseguiu concluir esta operação com segurança.", retryable: /GITHUB_|NETWORK|TIMEOUT/.test(code) }, 500);
  }
});