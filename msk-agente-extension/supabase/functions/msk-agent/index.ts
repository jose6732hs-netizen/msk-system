import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ausente: ${name}`);
  return value;
};
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = async (value: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
const utf8Base64 = (value: string) => {
  const bytes = encoder.encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const hmac = async (value: string) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(env("MSK_STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
};
const makeState = async (projectId: string, returnUrl: string) => {
  const payload = b64url(encoder.encode(JSON.stringify({ projectId, returnUrl, exp: Date.now() + 15 * 60_000 })));
  return `${payload}.${await hmac(payload)}`;
};
const readState = async (state: string) => {
  const [payload, signature] = state.split(".");
  if (!payload || signature !== await hmac(payload)) throw new Error("Estado inválido.");
  const raw = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
  if (data.exp < Date.now() || !/^https:\/\/lovable\.dev\/projects\//.test(data.returnUrl)) throw new Error("Estado expirado.");
  return data as { projectId: string; returnUrl: string };
};
const derLength = (length: number) => {
  if (length < 128) return new Uint8Array([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>>= 8) bytes.unshift(value & 255);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
};
const derJoin = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
};
const derWrap = (tag: number, value: Uint8Array) => derJoin(new Uint8Array([tag]), derLength(value.length), value);
const pkcs1ToPkcs8 = (pkcs1: Uint8Array) => {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const rsaAlgorithm = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  return derWrap(0x30, derJoin(version, rsaAlgorithm, derWrap(0x04, pkcs1)));
};
const pemKey = async () => {
  const pem = env("GITHUB_APP_PRIVATE_KEY").trim().replace(/\\n/g, "\n");
  const raw = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, "")), c => c.charCodeAt(0));
  const der = /BEGIN RSA PRIVATE KEY/.test(pem) ? pkcs1ToPkcs8(raw) : raw;
  try {
    return await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch {
    throw new Error("A chave privada do GitHub App é inválida ou foi colada incompleta nos Secrets.");
  }
};
const githubAppJwt = async () => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(encoder.encode(JSON.stringify({ iat: now - 30, exp: now + 540, iss: env("GITHUB_APP_ID") })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await pemKey(), encoder.encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(signature))}`;
};
const getActiveInstallation = async (installationId: number) => {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: { Authorization: `Bearer ${await githubAppJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Não foi possível validar a instalação GitHub (${response.status}).`);
  const installation = await response.json();
  return installation?.suspended_at ? null : installation;
};
const findInstallationForRepository = async (fullName: string) => {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return null;
  const response = await fetch(`https://api.github.com/repos/${fullName}/installation`, {
    headers: { Authorization: `Bearer ${await githubAppJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Não foi possível localizar a instalação do repositório (${response.status}).`);
  const installation = await response.json();
  return installation?.suspended_at ? null : installation;
};
const installationToken = async (installationId: number) => {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await githubAppJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  });
  if (!response.ok) throw new Error("Falha ao gerar token temporário do GitHub App.");
  return (await response.json()).token as string;
};
const github = async (token: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};
const validSession = async (projectId: string, token: string) => {
  if (!token) return false;
  const { data } = await db.from("msk_projects").select("session_token_hash").eq("lovable_project_id", projectId).maybeSingle();
  return !!data?.session_token_hash && data.session_token_hash === await sha256(token);
};
const chooseRepository = async (installationId: number, projectName = "") => {
  const token = await installationToken(installationId);
  const data = await github(token, "/installation/repositories?per_page=100");
  const repos = data.repositories || [];
  const wanted = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const repo = repos.length === 1 ? repos[0] : repos.find((r: any) => r.name.toLowerCase() === wanted || r.name.toLowerCase().includes(wanted));
  return { token, repo, candidates: repos.map((r: any) => r.full_name) };
};
const openai = async (body: unknown) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  return response.json();
};
const outputText = (response: any) => response.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text || "";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  let activeTaskId = "";
  try {
    if (req.method === "POST" && url.searchParams.get("action") === "health") {
      return json({ ok: true, service: "msk-agent", auth: "msk-session", version: "1.8.2" });
    }
    if (req.method === "GET" && url.searchParams.get("installation_id") && url.searchParams.get("state")) {
      const state = await readState(url.searchParams.get("state")!);
      const installationId = Number(url.searchParams.get("installation_id"));
      const session = crypto.randomUUID() + crypto.randomUUID();
      await db.from("msk_projects").upsert({
        lovable_project_id: state.projectId,
        github_installation_id: installationId,
        session_token_hash: await sha256(session),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return Response.redirect(`${state.returnUrl.split("#")[0]}#msk_session=${encodeURIComponent(session)}`, 302);
    }
    if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
    const action = url.searchParams.get("action") || "status";
    const body = await req.json();
    const projectId = String(body.lovable_project_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ error: "ID de projeto inválido." }, 400);

    if (action === "connect") {
      const returnUrl = /^https:\/\/lovable\.dev\/projects\//.test(body.page_url || "") ? body.page_url : `https://lovable.dev/projects/${projectId}`;
      const { data } = await db.from("msk_projects").select("github_installation_id,session_token_hash,github_owner,github_repo").eq("lovable_project_id", projectId).maybeSingle();
      if (data?.github_installation_id && req.headers.get("x-msk-session") && await validSession(projectId, req.headers.get("x-msk-session")!)) return json({ connected: true });
      if (data?.github_installation_id) {
        const installation = await getActiveInstallation(Number(data.github_installation_id));
        if (installation) {
          const session = crypto.randomUUID() + crypto.randomUUID();
          await db.from("msk_projects").update({ session_token_hash: await sha256(session), connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("lovable_project_id", projectId);
          return json({ connected: true, recovered: true, session_token: session, repository: data.github_owner && data.github_repo ? `${data.github_owner}/${data.github_repo}` : null });
        }
        await db.from("msk_projects").update({ github_installation_id: null, session_token_hash: null, updated_at: new Date().toISOString() }).eq("lovable_project_id", projectId);
      }
      const repositoryUrl = String(body.repository_url || "");
      const repository = repositoryUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/?#]+)/i)?.[1]?.replace(/\.git$/i, "") || "";
      if (repository) {
        const installation = await findInstallationForRepository(repository);
        if (installation?.id) {
          const [owner, repo] = repository.split("/");
          const session = crypto.randomUUID() + crypto.randomUUID();
          await db.from("msk_projects").upsert({ lovable_project_id: projectId, project_name: body.project_name || null, github_installation_id: Number(installation.id), github_owner: owner, github_repo: repo, session_token_hash: await sha256(session), connected_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          return json({ connected: true, discovered: true, session_token: session, repository });
        }
      }
      if (body.check_only) return json({ connected: false, requires_lovable_git: true });
      const state = await makeState(projectId, returnUrl);
      return json({ connected: false, authorize_url: `https://github.com/apps/${env("GITHUB_APP_SLUG")}/installations/new?state=${encodeURIComponent(state)}` });
    }
    const session = req.headers.get("x-msk-session") || "";
    if (!await validSession(projectId, session)) return json({ error: "Sessão MSK não autorizada.", connected: false }, 401);
    if (action === "task-status") {
      const taskId = String(body.task_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(taskId)) return json({ error: "Tarefa inválida." }, 400);
      const { data: task } = await db.from("msk_tasks").select("id,status,summary,error,branch_name,pull_request_url,updated_at").eq("id", taskId).eq("lovable_project_id", projectId).maybeSingle();
      return task ? json({ ok: true, task }) : json({ ok: false, error: "Tarefa ainda não iniciada." }, 404);
    }
    const { data: project } = await db.from("msk_projects").select("*").eq("lovable_project_id", projectId).single();
    if (!project?.github_installation_id) return json({ connected: false });
    const selected = await chooseRepository(project.github_installation_id, body.project_name || project.project_name || "");
    if (!selected.repo) return json({ connected: false, requires_repository_selection: true, repositories: selected.candidates });
    await db.from("msk_projects").update({
      project_name: body.project_name || project.project_name,
      github_owner: selected.repo.owner.login,
      github_repo: selected.repo.name,
      github_default_branch: selected.repo.default_branch,
      updated_at: new Date().toISOString()
    }).eq("lovable_project_id", projectId);
    if (action === "status") return json({ connected: true, repository: selected.repo.full_name });
    if (action === "approve") {
      const taskId = String(body.task_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(taskId)) return json({ error: "Tarefa inválida." }, 400);
      const { data: task } = await db.from("msk_tasks").select("id,status,pull_request_url,summary").eq("id", taskId).eq("lovable_project_id", projectId).maybeSingle();
      if (!task?.pull_request_url) return json({ error: "Pull Request da tarefa não encontrado." }, 404);
      if (task.status === "completed") return json({ ok: true, completed: true, message: "Alteração já aplicada." });
      const pullNumber = Number(task.pull_request_url.match(/\/pull\/(\d+)/)?.[1]);
      if (!pullNumber) return json({ error: "Número do Pull Request inválido." }, 400);
      const merged = await github(selected.token, `/repos/${selected.repo.owner.login}/${selected.repo.name}/pulls/${pullNumber}/merge`, {
        method: "PUT",
        body: JSON.stringify({ commit_title: `MSK: ${String(task.summary || "alteração aprovada").slice(0, 70)}`, merge_method: "squash" })
      });
      if (!merged?.merged) return json({ error: merged?.message || "O GitHub não permitiu aplicar o Pull Request." }, 409);
      await db.from("msk_tasks").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", taskId).eq("lovable_project_id", projectId);
      return json({ ok: true, completed: true, message: "Alteração aplicada no repositório." });
    }

    const command = String(body.command || "").trim();
    if (!command) return json({ error: "Comando vazio." }, 400);
    const requestedTaskId = String(body.task_id || "");
    activeTaskId = /^[0-9a-f-]{36}$/i.test(requestedTaskId) ? requestedTaskId : crypto.randomUUID();
    const { data: task, error: taskError } = await db.from("msk_tasks").insert({ id: activeTaskId, lovable_project_id: projectId, command, status: "analyzing" }).select().single();
    if (taskError || !task) throw new Error(taskError?.message || "Não foi possível iniciar a tarefa.");
    const owner = selected.repo.owner.login, repo = selected.repo.name, branch = selected.repo.default_branch;
    const tree = await github(selected.token, `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    const paths = (tree.tree || []).filter((x: any) => x.type === "blob" && /\.(tsx?|jsx?|css|json|md|sql)$/.test(x.path)).slice(0, 600).map((x: any) => x.path);
    const selector = await openai({
      model: "gpt-5.6",
      max_output_tokens: 2000,
      input: `Você é o agente MSK. Selecione até 12 arquivos necessários para executar o comando. Responda somente JSON: {"files":["path"],"plan":"resumo"}.\nComando: ${command}\nArquivos:\n${paths.join("\n")}`
    });
    const selection = JSON.parse(outputText(selector).replace(/^\`\`\`json|\`\`\`$/g, "").trim());
    const chosen = (selection.files || []).filter((p: string) => paths.includes(p)).slice(0, 12);
    if (!chosen.length) throw new Error("O agente não encontrou arquivos seguros para alterar.");
    const files = await Promise.all(chosen.map(async (path: string) => {
      const item = await github(selected.token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`);
      return { path, sha: item.sha, content: new TextDecoder().decode(Uint8Array.from(atob(item.content.replace(/\n/g, "")), c => c.charCodeAt(0))) };
    }));
    await db.from("msk_tasks").update({ status: "editing", updated_at: new Date().toISOString() }).eq("id", task.id).eq("lovable_project_id", projectId);
    const edit = await openai({
      model: "gpt-5.6",
      max_output_tokens: 50000,
      input: `Edite os arquivos para cumprir o comando. Preserve o que funciona. Responda somente JSON: {"summary":"...","changes":[{"path":"...","content":"arquivo completo"}]}. Não use markdown.\nComando: ${command}\nArquivos:\n${files.map(f => `--- ${f.path}\n${f.content}`).join("\n")}`
    });
    const result = JSON.parse(outputText(edit).replace(/^\`\`\`json|\`\`\`$/g, "").trim());
    const changes = (result.changes || []).filter((c: any) => typeof c.path === "string" && typeof c.content === "string" && !c.path.includes("..")).slice(0, 12);
    if (!changes.length) throw new Error("Nenhuma alteração válida foi produzida.");
    const branchName = `msk/${task.id.slice(0, 8)}`;
    const ref = await github(selected.token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`);
    await github(selected.token, `/repos/${owner}/${repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: ref.object.sha }) });
    for (const change of changes) {
      const existing = files.find(f => f.path === change.path);
      await github(selected.token, `/repos/${owner}/${repo}/contents/${encodeURIComponent(change.path).replace(/%2F/g, "/")}`, {
        method: "PUT",
        body: JSON.stringify({ message: `MSK: ${String(result.summary || command).slice(0, 70)}`, content: utf8Base64(change.content), branch: branchName, ...(existing?.sha ? { sha: existing.sha } : {}) })
      });
    }
    const pr = await github(selected.token, `/repos/${owner}/${repo}/pulls`, { method: "POST", body: JSON.stringify({ title: `MSK: ${String(result.summary || command).slice(0, 70)}`, head: branchName, base: branch, body: `Alteração preparada pelo MSK Agente.\n\n${result.summary || ""}\n\nRevise antes de mesclar.` }) });
    await db.from("msk_tasks").update({ status: "awaiting_approval", branch_name: branchName, pull_request_url: pr.html_url, summary: result.summary, openai_response_id: edit.id, updated_at: new Date().toISOString() }).eq("id", task.id);
    return json({ ok: true, requires_approval: true, message: `Alteração preparada em Pull Request: ${pr.html_url}`, task_id: task.id, pull_request_url: pr.html_url });
  } catch (error) {
    console.error(error);
    if (activeTaskId) await db.from("msk_tasks").update({ status: "failed", error: error instanceof Error ? error.message : "Falha inesperada.", updated_at: new Date().toISOString() }).eq("id", activeTaskId);
    return json({ error: error instanceof Error ? error.message : "Falha inesperada." }, 500);
  }
});
