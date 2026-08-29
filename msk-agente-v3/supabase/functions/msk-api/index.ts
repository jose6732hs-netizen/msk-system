import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const required = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Secret ausente: ${name}`); return value; };
const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), c => c.charCodeAt(0));
const utf8Base64 = (value: string) => {
  const bytes = encoder.encode(value); let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const userFromRequest = async (req: Request) => {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token.startsWith("sb_publishable_")) return null;
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data.user;
};

const encryptionKey = async () => {
  const rawValue = required("MSK_TOKEN_ENCRYPTION_KEY").trim();
  const raw = /^[A-Za-z0-9_-]{43,44}$/.test(rawValue) ? fromB64url(rawValue) : encoder.encode(rawValue);
  if (raw.length !== 32) throw new Error("MSK_TOKEN_ENCRYPTION_KEY deve possuir exatamente 32 bytes.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
};
const encrypt = async (value: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(value)));
  return b64url(new Uint8Array([...iv, ...cipher]));
};
const decrypt = async (value: string) => {
  const packed = fromB64url(value); const iv = packed.slice(0, 12); const cipher = packed.slice(12);
  return decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await encryptionKey(), cipher));
};
const byteaText = (value: unknown) => {
  if (value instanceof Uint8Array) return decoder.decode(value);
  const text = String(value || "");
  if (text.startsWith("\\x")) {
    const pairs = text.slice(2).match(/.{1,2}/g) || [];
    return decoder.decode(Uint8Array.from(pairs.map(pair => Number.parseInt(pair, 16))));
  }
  return text;
};

const signState = async (payload: string) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(required("MSK_STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
};
const makeState = async (userId: string, origin: string) => {
  const payload = b64url(encoder.encode(JSON.stringify({ userId, origin, exp: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() })));
  return `${payload}.${await signState(payload)}`;
};
const readState = async (state: string) => {
  const [payload, signature] = state.split(".");
  if (!payload || !signature || signature !== await signState(payload)) throw new Error("Estado OAuth inválido.");
  const value = JSON.parse(decoder.decode(fromB64url(payload)));
  if (value.exp < Date.now() || !/^https:\/\/([^.]+\.)?lovable\.dev$/.test(value.origin)) throw new Error("Estado OAuth expirado.");
  return value as { userId: string; origin: string; exp: number; nonce: string };
};

const githubFetch = async (token: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers || {}) } });
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (remaining === "0") {
    const reset = Number(response.headers.get("x-ratelimit-reset") || 0) * 1000;
    throw Object.assign(new Error(`Limite do GitHub atingido. Tente novamente após ${new Date(reset).toLocaleString("pt-BR")}.`), { status: 429, providerBody: await response.text() });
  }
  if (!response.ok) throw Object.assign(new Error(`GitHub ${response.status}`), { status: response.status, providerBody: await response.text() });
  return response.status === 204 ? null : response.json();
};
const openai = async (body: unknown) => {
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${required("OPENAI_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const raw = await response.text(); let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) throw Object.assign(new Error(`OpenAI ${response.status}`), { status: response.status, providerBody: data });
  return data;
};
const outputText = (response: any) => response.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text || "";
const cleanJson = (value: string) => JSON.parse(value.replace(/^```json\s*|\s*```$/g, "").trim());
const connectionFor = async (userId: string) => (await db.from("app_user_connections").select("*").eq("user_id", userId).eq("connector_id", "github").maybeSingle()).data;
const validGithubConnection = async (userId: string) => {
  const connection = await connectionFor(userId);
  if (!connection || connection.revoked_at) return { valid: false, connection: null, token: "" };
  try {
    const token = await decrypt(byteaText(connection.connection_key_ciphertext));
    const githubUser = await githubFetch(token, "/user");
    await db.from("app_user_connections").update({ github_login: githubUser.login, provider_user_id: String(githubUser.id), last_validated_at: new Date().toISOString(), revoked_at: null }).eq("id", connection.id);
    return { valid: true, connection: { ...connection, github_login: githubUser.login }, token };
  } catch (error: any) {
    if ([401, 403].includes(error?.status)) await db.from("app_user_connections").update({ revoked_at: new Date().toISOString() }).eq("id", connection.id);
    return { valid: false, connection, token: "" };
  }
};

const planAndUsage = async (userId: string) => {
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const [{ data: plan }, { data: profile }, { data: usage }, { count: runs }] = await Promise.all([
    db.from("plans").select("*").eq("user_id", userId).single(),
    db.from("profiles").select("display_name,avatar_url").eq("user_id", userId).single(),
    db.from("usage").select("input_tokens,output_tokens").eq("user_id", userId).gte("created_at", start.toISOString()),
    db.from("runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", start.toISOString())
  ]);
  const tokens = (usage || []).reduce((sum: number, item: any) => sum + item.input_tokens + item.output_tokens, 0);
  const remainingMs = plan?.ends_at ? Math.max(0, new Date(plan.ends_at).getTime() - Date.now()) : null;
  return { profile, plan: plan ? { ...plan, remainingSeconds: remainingMs === null ? null : Math.ceil(remainingMs / 1000) } : null, usage: { runs: runs || 0, tokens } };
};
const requireActivePlan = async (userId: string) => {
  const quota = await planAndUsage(userId);
  const expired = quota.plan?.ends_at && new Date(quota.plan.ends_at).getTime() <= Date.now();
  if (!quota.plan || quota.plan.status !== "active" || expired) {
    throw Object.assign(new Error("Seu acesso MSK expirou ou está suspenso."), { status: 402 });
  }
  return quota;
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "connection-status";
  try {
    if (action === "health") return json({ ok: true, service: "msk-api", version: "2.0.0" });
    if (action === "github-callback") {
      const code = url.searchParams.get("code") || ""; const state = url.searchParams.get("state") || "";
      const safe = JSON.stringify({ type: "MSK_GITHUB_OAUTH_CODE", code, state });
      return new Response(`<!doctype html><meta charset="utf-8"><title>MSK</title><script>if(window.opener){window.opener.postMessage(${safe},"*");window.close()}else{document.body.textContent="Volte ao Lovable para continuar."}</script>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Sessão de usuário necessária.", code: "AUTH_REQUIRED" }, 401);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (action === "connection-status") {
      const github = await validGithubConnection(user.id);
      const { data: activeProject } = await db.from("projects").select("id,repo_full_name,default_branch,preview_url,last_opened_at").eq("user_id", user.id).eq("active", true).maybeSingle();
      const { data: projects } = await db.from("projects").select("id,repo_full_name,default_branch,preview_url,last_opened_at").eq("user_id", user.id).order("last_opened_at", { ascending: false });
      const quota = await planAndUsage(user.id);
      return json({ authorized: github.valid, githubLogin: github.valid ? github.connection.github_login : null, activeProjectId: activeProject?.id || null, activeProject: activeProject || null, needsProjectSelection: github.valid && !activeProject, projects: projects || [], ...quota });
    }
    if (action === "chat") {
      const quota = await requireActivePlan(user.id);
      const message = String(body.message || body.command || "").trim();
      if (!message) return json({ error: "Mensagem vazia." }, 400);
      const history = Array.isArray(body.history) ? body.history.slice(-20).map((item: any) => ({ role: item?.role === "assistant" ? "assistant" : "user", content: String(item?.content || "").slice(0, 12000) })).filter((item: any) => item.content) : [];
      const response = await openai({
        model: "gpt-5.6-sol",
        max_output_tokens: 6000,
        instructions: "Você é o MSK Agente dentro do Lovable. Responda em português do Brasil, de forma objetiva e útil. O GitHub pode estar temporariamente não detectado; nunca diga que a conversa depende do GitHub. Quando a mensagem pedir alteração de código e o projeto ainda não estiver disponível, explique brevemente que a conversa está ativa e que a execução será tentada assim que o repositório for resolvido.",
        input: [...history, { role: "user", content: message }]
      });
      const reply = outputText(response).trim() || "Recebi sua mensagem.";
      await db.from("usage").insert({ user_id: user.id, run_id: null, model: "gpt-5.6-sol", input_tokens: Number(response.usage?.input_tokens || 0), output_tokens: Number(response.usage?.output_tokens || 0) });
      return json({ ok: true, message: reply, response_id: response.id, connected: false, chat_only: true, quota: quota.usage });
    }
    if (action === "github-oauth-start") {
      const github = await validGithubConnection(user.id);
      if (github.valid) return json({ alreadyConnected: true, authorized: true, githubLogin: github.connection.github_login });
      const origin = /^https:\/\/([^.]+\.)?lovable\.dev$/.test(body.origin || "") ? body.origin : "https://lovable.dev";
      const state = await makeState(user.id, origin);
      const redirectUri = `${required("SUPABASE_URL")}/functions/v1/msk-api?action=github-callback`;
      const authorize = new URL("https://github.com/login/oauth/authorize");
      authorize.searchParams.set("client_id", required("GITHUB_CLIENT_ID"));
      authorize.searchParams.set("redirect_uri", redirectUri);
      authorize.searchParams.set("scope", "read:user repo");
      authorize.searchParams.set("state", state);
      return json({ alreadyConnected: false, authorizeUrl: authorize.toString() });
    }
    if (action === "github-oauth-exchange") {
      const state = await readState(String(body.state || ""));
      if (state.userId !== user.id) return json({ error: "OAuth não pertence a esta sessão." }, 403);
      const redirectUri = `${required("SUPABASE_URL")}/functions/v1/msk-api?action=github-callback`;
      const response = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: required("GITHUB_CLIENT_ID"), client_secret: required("GITHUB_CLIENT_SECRET"), code: body.code, redirect_uri: redirectUri, state: body.state }) });
      const tokens = await response.json();
      if (!response.ok || !tokens.access_token) return json({ error: "GitHub recusou a autorização.", providerStatus: response.status, providerBody: tokens }, 502);
      const githubUser = await githubFetch(tokens.access_token, "/user");
      const encrypted = await encrypt(tokens.access_token);
      await db.from("app_user_connections").upsert({ user_id: user.id, connector_id: "github", connection_key_ciphertext: encoder.encode(encrypted), github_login: githubUser.login, provider_user_id: String(githubUser.id), scopes: String(tokens.scope || "").split(",").filter(Boolean), revoked_at: null, last_validated_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id,connector_id" });
      return json({ authorized: true, githubLogin: githubUser.login });
    }
    const github = await validGithubConnection(user.id);
    if (!github.valid) return json({ error: "GitHub precisa ser conectado.", code: "GITHUB_RECONNECT" }, 401);
    await requireActivePlan(user.id);

    if (action === "list-projects") {
      const repos = await githubFetch(github.token, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
      return json({ projects: repos.map((repo: any) => ({ repoFullName: repo.full_name, defaultBranch: repo.default_branch, private: repo.private, updatedAt: repo.updated_at })) });
    }
    if (action === "activate-project") {
      const repoFullName = String(body.repoFullName || "");
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoFullName)) return json({ error: "Repositório inválido." }, 400);
      const repo = await githubFetch(github.token, `/repos/${repoFullName}`);
      await db.from("projects").update({ active: false, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("active", true);
      const { data: project, error } = await db.from("projects").upsert({ user_id: user.id, lovable_project_id: body.lovableProjectId || null, repo_full_name: repo.full_name, default_branch: repo.default_branch, active: true, last_opened_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id,repo_full_name" }).select().single();
      if (error) throw error;
      const forwarded = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
      await db.from("access_log").insert({ project_id: project.id, user_id: user.id, ip: forwarded, user_agent: req.headers.get("user-agent"), action: "project.activate" });
      return json({ projectId: project.id, repo: project.repo_full_name, branch: project.default_branch, previewUrl: project.preview_url });
    }
    if (action === "run-status") {
      const runId = String(body.runId || body.task_id || "");
      const { data: run } = await db.from("runs").select("id,status,summary,error_body,branch_name,pull_request_url,preview_url,files_changed,updated_at").eq("id", runId).eq("user_id", user.id).maybeSingle();
      if (!run) return json({ error: "Execução não encontrada." }, 404);
      return json({ task: { ...run, status: run.status === "awaiting_confirmation" ? "awaiting_approval" : run.status, error: run.error_body, pull_request_url: run.pull_request_url } });
    }
    if (action === "approve-run") {
      if (!body.confirmed) return json({ confirmationRequired: true, action: "merge", message: "Confirme para aplicar o Pull Request no projeto." }, 409);
      const runId = String(body.runId || body.task_id || "");
      const { data: run } = await db.from("runs").select("*,projects!inner(repo_full_name)").eq("id", runId).eq("user_id", user.id).maybeSingle();
      if (!run?.pull_request_url) return json({ error: "Pull Request não encontrado." }, 404);
      const pullNumber = Number(run.pull_request_url.match(/\/pull\/(\d+)/)?.[1]);
      const merged = await githubFetch(github.token, `/repos/${run.projects.repo_full_name}/pulls/${pullNumber}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "squash", commit_title: `MSK: ${String(run.summary || "alteração aprovada").slice(0, 70)}` }) });
      if (!merged?.merged) return json({ error: merged?.message || "O GitHub não permitiu aplicar o Pull Request." }, 409);
      await db.from("runs").update({ status: "completed", commit_sha: merged.sha, updated_at: new Date().toISOString() }).eq("id", run.id).eq("user_id", user.id);
      return json({ completed: true, message: "Alteração aplicada no repositório.", commitSha: merged.sha });
    }
    if (action === "run") {
      const quota = await requireActivePlan(user.id);
      if (quota.usage.runs >= Number(quota.plan.monthly_run_limit)) return json({ error: "Limite mensal de execuções atingido.", code: "RUN_LIMIT" }, 402);
      if (quota.usage.tokens >= Number(quota.plan.monthly_token_limit)) return json({ error: "Limite mensal de tokens atingido.", code: "TOKEN_LIMIT" }, 402);
      const command = String(body.command || "").trim();
      if (!command) return json({ error: "Comando vazio." }, 400);
      const { data: project } = await db.from("projects").select("*").eq("user_id", user.id).eq("active", true).maybeSingle();
      if (!project) return json({ error: "Escolha um projeto ativo.", code: "PROJECT_REQUIRED" }, 409);
      const { data: run, error: runError } = await db.from("runs").insert({ user_id: user.id, project_id: project.id, action: "edit_code", command, status: "analyzing" }).select().single();
      if (runError || !run) throw runError || new Error("Falha ao iniciar a execução.");
      try {
        const [owner, repo] = project.repo_full_name.split("/"); const branch = project.default_branch;
        const tree = await githubFetch(github.token, `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
        const paths = (tree.tree || []).filter((item: any) => item.type === "blob" && /\.(tsx?|jsx?|css|json|md|sql)$/.test(item.path)).slice(0, 700).map((item: any) => item.path);
        const selector = await openai({ model: "gpt-5.6", max_output_tokens: 2000, input: `Você é o agente MSK. Selecione até 12 arquivos necessários. Responda somente JSON: {"files":["path"],"plan":"resumo"}.\nComando: ${command}\nArquivos:\n${paths.join("\n")}` });
        const selection = cleanJson(outputText(selector));
        const chosen = (selection.files || []).filter((path: string) => paths.includes(path)).slice(0, 12);
        if (!chosen.length) throw new Error("Nenhum arquivo seguro foi selecionado.");
        const files = await Promise.all(chosen.map(async (path: string) => {
          const item = await githubFetch(github.token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`);
          return { path, sha: item.sha, content: decoder.decode(Uint8Array.from(atob(item.content.replace(/\n/g, "")), c => c.charCodeAt(0))) };
        }));
        await db.from("runs").update({ status: "editing", updated_at: new Date().toISOString() }).eq("id", run.id);
        const edit = await openai({ model: "gpt-5.6", max_output_tokens: 50000, input: `Edite os arquivos para cumprir o comando. Preserve o que funciona. Responda somente JSON: {"summary":"...","changes":[{"path":"...","content":"arquivo completo"}]}. Sem markdown.\nComando: ${command}\nArquivos:\n${files.map(file => `--- ${file.path}\n${file.content}`).join("\n")}` });
        const result = cleanJson(outputText(edit));
        const changes = (result.changes || []).filter((change: any) => typeof change.path === "string" && typeof change.content === "string" && !change.path.includes("..")).slice(0, 12);
        if (!changes.length) throw new Error("Nenhuma alteração válida foi produzida.");
        const branchName = `msk/${run.id.slice(0, 8)}`;
        const ref = await githubFetch(github.token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`);
        await githubFetch(github.token, `/repos/${owner}/${repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: ref.object.sha }) });
        for (const change of changes) {
          const existing = files.find(file => file.path === change.path);
          await githubFetch(github.token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(change.path).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ message: `MSK: ${String(result.summary || command).slice(0, 70)}`, content: utf8Base64(change.content), branch: branchName, ...(existing?.sha ? { sha: existing.sha } : {}) }) });
        }
        const pr = await githubFetch(github.token, `/repos/${owner}/${repo}/pulls`, { method: "POST", body: JSON.stringify({ title: `MSK: ${String(result.summary || command).slice(0, 70)}`, head: branchName, base: branch, body: `Alteração preparada pelo MSK Agente.\n\n${result.summary || ""}\n\nRevise antes de mesclar.` }) });
        const inputTokens = Number(selector.usage?.input_tokens || 0) + Number(edit.usage?.input_tokens || 0), outputTokens = Number(selector.usage?.output_tokens || 0) + Number(edit.usage?.output_tokens || 0);
        await Promise.all([
          db.from("runs").update({ status: "awaiting_confirmation", branch_name: branchName, previous_commit_sha: ref.object.sha, pull_request_url: pr.html_url, files_changed: changes.map((change: any) => change.path), summary: result.summary, updated_at: new Date().toISOString() }).eq("id", run.id),
          db.from("usage").insert({ user_id: user.id, run_id: run.id, model: "gpt-5.6", input_tokens: inputTokens, output_tokens: outputTokens })
        ]);
        return json({ requires_approval: true, message: `Alteração preparada em Pull Request: ${pr.html_url}`, task_id: run.id, pull_request_url: pr.html_url, summary: result.summary, filesChanged: changes.map((change: any) => change.path) });
      } catch (runFailure: any) {
        await db.from("runs").update({ status: "failed", error_status: runFailure?.status || null, error_body: runFailure?.providerBody ? JSON.stringify(runFailure.providerBody) : runFailure?.message, updated_at: new Date().toISOString() }).eq("id", run.id);
        throw runFailure;
      }
    }
    if (action === "available-actions") {
      return json({ actions: ["connect_github","list_projects","activate_project","edit_code","run_build","open_preview","publish","rollback","search_repo","search_web"], confirmationRequired: ["publish","rollback","merge"] });
    }
    return json({ error: "Ação desconhecida." }, 404);
  } catch (error: any) {
    console.error(error);
    return json({ error: error?.message || "Falha inesperada.", providerStatus: error?.status || null, providerBody: error?.providerBody || null }, error?.status && error.status >= 400 && error.status < 600 ? error.status : 500);
  }
});
