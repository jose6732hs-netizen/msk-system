import { cors, json, env, db, dec, sha, identity, verifyDevice } from "./common.ts";
import { makeState, readState, installation, instToken, gh, validSession, chooseRepo } from "./github.ts";
import { ask, parse, directCommit } from "./ai.ts";
import { MSK_ENGINEERING_PROFILE, normalizeRepo, isHighRiskCommand, selectionPrompt, editPrompt, validateChanges, professionalSummary } from "./professional.ts";
import { AgentError, type AgentStage, acquireRepoLock, mapErrorToAgentError, recordAgentError, releaseRepoLock } from "./errors.ts";

const normalize = (v: string) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ACTIVE = new Set(["locating_files", "analyzing", "editing", "self_correcting", "no_changes_retry", "validating", "committing", "verifying", "finalizing"]);

function isSimpleVisualEdit(command: string) {
  const q = normalize(command);
  if (isHighRiskCommand(command) || q.split(/\s+/).length > 42) return false;
  if (/\b(criar|crie|implementar|implemente|adicionar|adicione|integrar|integre|checkout|banco|api|login|webhook|migration)\b/.test(q)) return false;
  return /\b(cor|copy|texto|fonte|font|botao|button|fundo|background|layout|espacamento|tamanho|borda|sombra|hover|efeito|animacao|menu|navegacao|responsiv)\b/.test(q);
}

function selectFallbackFiles(paths: string[], command: string) {
  const q = normalize(command);
  const visual = /\b(cor|color|texto|text|copy|inicio|inicial|home|pagina|tela|botao|button|layout|estilo|style|fonte|font|hero|menu|navegacao)\b/.test(q);
  return paths
    .filter(p => !/(^|\/)(node_modules|dist|build|coverage|supabase\/migrations)(\/|$)/i.test(p))
    .filter(p => !/(routeTree\.gen|\.test\.|\.spec\.|lock\.json$)/i.test(p))
    .map(path => {
      const p = normalize(path);
      let score = 0;
      if (/src\/routes\/(index|home)(\.|\/)/.test(p)) score += 30;
      if (/src\/(pages|routes)\//.test(p)) score += 12;
      if (/(^|\/)(index|home|landing|hero|app|main)\.(tsx?|jsx?)$/.test(p)) score += 18;
      if (/(home|landing|hero|inicio|index)/.test(p)) score += 9;
      if (/src\/components\//.test(p)) score += 5;
      if (visual && /\.(css|scss|tsx|jsx|ts|js)$/.test(p)) score += 6;
      if (visual && /styles?\.(css|scss)$/.test(p)) score += 7;
      if (/readme|\.md$|package\.json$/.test(p)) score -= 15;
      return { path, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 6)
    .map(x => x.path);
}

function resolveChosenFiles(paths: string[], candidate: any, command: string, max = 8) {
  const lower = new Map(paths.map(p => [p.toLowerCase(), p]));
  const requested = Array.isArray(candidate?.files) ? candidate.files : [];
  const exact = requested
    .map((p: any) => lower.get(String(p || "").trim().toLowerCase()))
    .filter(Boolean) as string[];
  const unique = [...new Set(exact)].slice(0, max);
  return unique.length ? unique : selectFallbackFiles(paths, command).slice(0, max);
}

const taskPatch = async (taskId: string, patch: Record<string, unknown>, userId: string) => {
  if (!taskId || !userId) return;
  const { error } = await db.from("msk_tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", taskId).eq("user_id", userId);
  if (error) console.error("MSK task patch failed", error.message);
};

const validatePreCommit = (changes: Array<{ path: string; content: string; create: boolean }>, analyzedFiles: Array<{ path: string; content: string }>) => {
  if (!changes.length) throw new AgentError("NO_CHANGES_APPLIED", "Nenhuma alteração real foi produzida.", { stage: "validating", retryable: true, httpStatus: 422 });
  const originals = new Map(analyzedFiles.map(file => [file.path.toLowerCase(), file.content]));
  for (const change of changes) {
    if (!change.path || !change.content.trim()) throw new AgentError("PRECOMMIT_VALIDATION_FAILED", "Uma alteração ficou sem caminho ou conteúdo.", { stage: "validating", retryable: true, httpStatus: 422, context: { path: change.path } });
    if (!change.create && !originals.has(change.path.toLowerCase())) throw new AgentError("PRECOMMIT_VALIDATION_FAILED", "Um arquivo existente não havia sido analisado antes da edição.", { stage: "validating", retryable: false, httpStatus: 422, context: { path: change.path } });
    const original = originals.get(change.path.toLowerCase());
    if (!change.create && original === change.content) throw new AgentError("NO_CHANGES_APPLIED", "A edição não alterou o conteúdo do arquivo.", { stage: "validating", retryable: true, httpStatus: 422, context: { path: change.path } });
  }
};

async function semanticReview(req: Request, command: string, repo: string, before: Array<{ path: string; content: string }>, changes: Array<{ path: string; content: string; create: boolean }>) {
  // Corta por arquivo ANTES de concatenar: juntar conteúdos inteiros gerava pico de memória no worker.
  const perBefore = Math.max(1200, Math.floor(26000 / Math.max(1, before.length)));
  const perAfter = Math.max(1500, Math.floor(42000 / Math.max(1, changes.length)));
  const compactBefore = before.map(file => `--- ANTES ${file.path}\n${file.content.slice(0, perBefore)}`).join("\n").slice(0, 26000);
  const compactAfter = changes.map(file => `--- DEPOIS ${file.path}\n${file.content.slice(0, perAfter)}`).join("\n").slice(0, 42000);
  const response = await ask(req, `${MSK_ENGINEERING_PROFILE}\nVALIDAÇÃO SEMÂNTICA PRÉ-COMMIT. Compare o pedido real com o antes/depois. Não edite. Rejeite se o alvo estiver errado, se faltar parte pedida, se houver mudança fora do escopo ou se o resultado não corresponder ao pedido. Responda SOMENTE JSON válido: {"ok":true,"issues":[]} ou {"ok":false,"issues":["motivo objetivo"]}.\nRepositório: ${repo}\nPedido: ${command}\n${compactBefore}\n${compactAfter}`, true, 2600);
  const review = parse(response.text);
  return { ok: review?.ok === true, issues: Array.isArray(review?.issues) ? review.issues.map((x: any) => String(x)).slice(0, 8) : [] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  let taskId = "";
  let taskUserId = "";
  let projectId = "";
  let repository = "";
  let branchName = "";
  let lockKey = "";
  let lockHeld = false;
  let stage: AgentStage = "request";
  let retryCount = 0;

  try {
    if (req.method === "POST" && url.searchParams.get("action") === "health") {
      return json({ ok: true, service: "msk-agent", version: "3.4.0-fail-closed-preview", device_guard: "staged", repository_isolation: "strict", resilient_ai: true, global_training: true, fast_edit: true, structured_errors: true, repo_lock: true, semantic_precommit: true, atomic_git_data_commit: true, preview_pending: true, preview_fail_closed: true });
    }

    if (req.method === "GET" && url.searchParams.get("installation_id") && url.searchParams.get("state")) {
      stage = "auth";
      const st = await readState(url.searchParams.get("state")!);
      const iid = Number(url.searchParams.get("installation_id"));
      if (!Number.isInteger(iid) || iid <= 0) return json({ error: "Instalação GitHub inválida.", code: "GITHUB_INSTALLATION_INVALID" }, 400);
      const ins = await installation(iid);
      if (!ins) return json({ error: "A instalação GitHub não está ativa.", code: "GITHUB_INSTALLATION_NOT_FOUND" }, 404);
      const uid = String(st.userId || "");
      if (uid) {
        const { data: existing } = await db.from("msk_github_installations").select("user_id").eq("installation_id", iid).maybeSingle();
        if (existing?.user_id && String(existing.user_id) !== uid) return json({ error: "Instalação pertence a outra conta.", code: "GITHUB_INSTALLATION_OWNERSHIP_MISMATCH" }, 403);
      }
      const session = crypto.randomUUID() + crypto.randomUUID();
      const now = new Date().toISOString();
      const patch: any = { lovable_project_id: st.projectId, github_installation_id: iid, session_token_hash: await sha(session), connected_at: now, updated_at: now, ...(uid ? { user_id: uid } : {}) };
      if (st.repository && /^[\w.-]+\/[\w.-]+$/.test(st.repository)) {
        const token = await instToken(iid);
        const data = await gh(token, "/installation/repositories?per_page=100");
        const match = (data.repositories || []).find((x: any) => String(x.full_name).toLowerCase() === String(st.repository).toLowerCase());
        if (match) { patch.github_owner = match.owner.login; patch.github_repo = match.name; patch.github_default_branch = match.default_branch; }
      }
      const pr = await db.from("msk_projects").upsert(patch);
      if (pr.error) throw new AgentError("GITHUB_BIND_FAILED", "Não foi possível vincular o projeto ao GitHub.", { stage: "auth", httpStatus: 500, cause: pr.error });
      if (uid) await db.from("msk_github_installations").upsert({ user_id: uid, installation_id: iid, account_login: String(ins?.account?.login || "") || null, account_type: String(ins?.account?.type || "") || null, revoked_at: null, last_validated_at: now, updated_at: now }, { onConflict: "installation_id" });
      return Response.redirect(`${String(st.returnUrl).split("#")[0]}#msk_session=${encodeURIComponent(session)}`, 302);
    }

    if (req.method !== "POST") return json({ error: "Método inválido.", code: "METHOD_NOT_ALLOWED" }, 405);
    const action = url.searchParams.get("action") || "status";
    const raw = await req.text();
    const guard = await verifyDevice(req, raw, action);
    if (!guard.ok) return json({ ok: false, connected: false, blocked: guard.code === "INSTALLATION_BLOCKED", code: guard.code, error: guard.code === "INSTALLATION_BLOCKED" ? "Esta instalação foi bloqueada pela segurança MSK." : "A autorização segura desta instalação foi recusada." }, guard.status);

    const body = (() => { try { return JSON.parse(raw || "{}"); } catch { return {}; } })();
    const pid = String(body.lovable_project_id || "");
    projectId = pid;
    if (!/^[0-9a-f-]{36}$/i.test(pid)) return json({ error: "ID de projeto inválido.", code: "PROJECT_ID_INVALID" }, 400);
    stage = "auth";
    const who = await identity(req);
    if (!who) return json({ error: "Licença MSK necessária.", code: "LICENSE_REQUIRED" }, 401);
    taskUserId = who.id;
    const { data: proj } = await db.from("msk_projects").select("*").eq("lovable_project_id", pid).maybeSingle();
    if (proj?.user_id && String(proj.user_id) !== who.id) return json({ connected: false, code: "PROJECT_OWNERSHIP_MISMATCH", error: "Este projeto pertence a outra licença MSK." }, 403);
    if (proj && !proj.user_id) await db.from("msk_projects").update({ user_id: who.id, updated_at: new Date().toISOString() }).eq("lovable_project_id", pid).is("user_id", null);

    if (action === "connect") {
      if (proj?.github_installation_id) {
        const session = req.headers.get("x-msk-session") || "";
        if (await validSession(pid, session)) return json({ ok: true, connected: true, repository: proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : "" });
        const ns = crypto.randomUUID() + crypto.randomUUID();
        await db.from("msk_projects").update({ user_id: who.id, session_token_hash: await sha(ns), updated_at: new Date().toISOString() }).eq("lovable_project_id", pid);
        return json({ ok: true, connected: true, session_recovered: true, session_token: ns, repository: proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : "" });
      }
      const ret = /^https:\/\/lovable\.dev\/projects\//.test(String(body.page_url || body.return_url || "")) ? String(body.page_url || body.return_url) : `https://lovable.dev/projects/${pid}`;
      const repo = normalizeRepo(String(body.repository_url || ""));
      const state = await makeState(pid, ret, repo, who.id);
      return json({ ok: true, connected: false, requires_github_authorization: true, recovery_state: state, authorize_url: `https://github.com/apps/${env("GITHUB_APP_SLUG")}/installations/new?state=${encodeURIComponent(state)}`, repository: repo });
    }

    if (action === "status") {
      if (!proj?.github_installation_id) return json({ ok: true, connected: false });
      const ins = await installation(Number(proj.github_installation_id));
      if (!ins) return json({ ok: true, connected: false });
      const repo = proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : "";
      const session = req.headers.get("x-msk-session") || "";
      if (await validSession(pid, session)) return json({ ok: true, connected: true, installation_known: true, repository: repo, repository_locked: !!repo });
      const ns = crypto.randomUUID() + crypto.randomUUID();
      await db.from("msk_projects").update({ user_id: who.id, session_token_hash: await sha(ns), updated_at: new Date().toISOString() }).eq("lovable_project_id", pid);
      return json({ ok: true, connected: true, installation_known: true, session_recovered: true, session_token: ns, repository: repo, repository_locked: !!repo });
    }

    if (action === "bind-existing") {
      const iid = Number(body.installation_id || 0);
      const recovery = String(body.recovery_state || "");
      if (!iid || !recovery) return json({ connected: false, code: "RECOVERY_STATE_REQUIRED" }, 401);
      const st = await readState(recovery);
      if (st.projectId !== pid || String(st.userId || "") !== who.id) return json({ connected: false, code: "RECOVERY_IDENTITY_MISMATCH" }, 403);
      const ins = await installation(iid);
      if (!ins) return json({ connected: false, code: "GITHUB_INSTALLATION_NOT_FOUND" }, 404);
      const repo = normalizeRepo(String(st.repository || body.repository_url || ""));
      let owner = proj?.github_owner || null, name = proj?.github_repo || null, branch = proj?.github_default_branch || null;
      if (repo) {
        const token = await instToken(iid);
        const data = await gh(token, "/installation/repositories?per_page=100");
        const match = (data.repositories || []).find((r: any) => String(r.full_name).toLowerCase() === repo);
        if (!match) return json({ connected: false, code: "REPOSITORY_NOT_AUTHORIZED" }, 403);
        owner = match.owner.login; name = match.name; branch = match.default_branch;
      }
      const session = crypto.randomUUID() + crypto.randomUUID();
      const now = new Date().toISOString();
      const result = await db.from("msk_projects").upsert({ lovable_project_id: pid, user_id: who.id, github_installation_id: iid, github_owner: owner, github_repo: name, github_default_branch: branch, session_token_hash: await sha(session), connected_at: now, updated_at: now });
      if (result.error) throw new AgentError("GITHUB_BIND_FAILED", "Não foi possível salvar o vínculo do projeto.", { stage: "auth", httpStatus: 500, cause: result.error });
      await db.from("msk_github_installations").upsert({ user_id: who.id, installation_id: iid, account_login: String(ins?.account?.login || "") || null, account_type: String(ins?.account?.type || "") || null, revoked_at: null, last_validated_at: now, updated_at: now }, { onConflict: "installation_id" });
      return json({ ok: true, connected: true, recovered_existing_installation: true, installation_id: iid, session_token: session, repository: owner && name ? `${owner}/${name}` : repo, repository_locked: !!(owner && name) });
    }

    if (action === "chat") {
      const msg = String(body.message || body.command || "").trim();
      if (!msg) return json({ error: "Mensagem vazia.", code: "EMPTY_MESSAGE" }, 400);
      stage = "analyzing";
      const answer = await ask(req, `${MSK_ENGINEERING_PROFILE}\nMODO CONSULTA: responda em português do Brasil de forma natural, educada e profissional, sempre pelo contexto de desenvolvimento. Use o contexto recente e a skill quando presentes. PROIBIDO afirmar ou sugerir que editou, alterou, aplicou, criou ou commitou qualquer coisa: nesta chamada NENHUM arquivo é tocado. Se o cliente pediu uma alteração, responda pedindo confirmação curta para executar.\nCliente/contexto: ${msg}`, false, 3000);
      return json({ ok: true, connected: true, mode: "chat", no_edit: true, assistant_message: answer.text.trim(), message: answer.text.trim(), response_id: answer.id, model: "MSK-IA", provider: "MSK" });
    }

    const session = req.headers.get("x-msk-session") || "";
    if (!await validSession(pid, session)) return json({ error: "Sessão de edição MSK ainda não autorizada.", code: "MSK_SESSION_REQUIRED", connected: false }, 401);
    const boundRepo = proj?.github_owner && proj?.github_repo ? normalizeRepo(`${proj.github_owner}/${proj.github_repo}`) : "";
    const requestedRepo = normalizeRepo(String(body.repository_url || ""));
    if (boundRepo && requestedRepo && requestedRepo !== boundRepo) return json({ error: "O repositório solicitado não pertence a este projeto MSK.", code: "PROJECT_REPOSITORY_MISMATCH", connected: false, repository: boundRepo }, 409);

    if (action === "task-status") {
      const id = String(body.task_id || "");
      const { data: task } = await db.from("msk_tasks").select("id,status,summary,error,error_code,error_stage,retry_count,last_error_id,branch_name,pull_request_url,updated_at").eq("id", id).eq("lovable_project_id", pid).eq("user_id", who.id).maybeSingle();
      if (!task) return json({ ok: false, code: "TASK_NOT_FOUND" }, 404);
      const updated = Date.parse(String(task.updated_at || ""));
      if (ACTIVE.has(String(task.status || "")) && Number.isFinite(updated) && Date.now() - updated > 150000) {
        const message = "A execução excedeu o tempo seguro e foi encerrada. Nenhuma conclusão foi registrada sem commit confirmado.";
        const timeoutError = new AgentError("TASK_PROCESSING_TIMEOUT", message, { stage: String(task.status || "unknown") as AgentStage, retryable: true, httpStatus: 503 });
        const logged = await recordAgentError({ error: timeoutError, stage: timeoutError.stage, taskId: id, userId: who.id, projectId: pid, repository: boundRepo, branchName: task.branch_name || "" });
        await taskPatch(id, { status: "failed", error: message, error_code: timeoutError.code, error_stage: timeoutError.stage, last_error_id: logged.errorId || null }, who.id);
        return json({ ok: true, task: { ...task, status: "failed", error: message, error_code: timeoutError.code, error_stage: timeoutError.stage, last_error_id: logged.errorId || null, updated_at: new Date().toISOString() }, repository: boundRepo });
      }
      return json({ ok: true, task, repository: boundRepo });
    }

    stage = "repository";
    if (!proj?.github_installation_id) return json({ connected: false, code: "GITHUB_NOT_CONNECTED" }, 409);
    const preferredRepo = boundRepo || requestedRepo;
    const selected = await chooseRepo(Number(proj.github_installation_id), "", preferredRepo);
    if (!selected.repo) return json({ connected: false, requires_repository_selection: true, code: preferredRepo ? "BOUND_REPOSITORY_NOT_AUTHORIZED" : "EXACT_REPOSITORY_REQUIRED", repositories: selected.candidates });
    const selectedRepo = normalizeRepo(String(selected.repo.full_name || `${selected.repo.owner.login}/${selected.repo.name}`));
    if (boundRepo && selectedRepo !== boundRepo) return json({ connected: false, code: "PROJECT_REPOSITORY_MISMATCH", error: "Execução bloqueada para evitar mistura entre repositórios." }, 409);
    if (!boundRepo) await db.from("msk_projects").update({ user_id: who.id, github_owner: selected.repo.owner.login, github_repo: selected.repo.name, github_default_branch: selected.repo.default_branch, updated_at: new Date().toISOString() }).eq("lovable_project_id", pid);

    if (action === "approve") {
      // Compatibilidade somente para tarefas antigas que já possuíam PR antes desta versão.
      const id = String(body.task_id || "");
      const { data: task } = await db.from("msk_tasks").select("id,status,pull_request_url,summary").eq("id", id).eq("lovable_project_id", pid).eq("user_id", who.id).maybeSingle();
      if (!task?.pull_request_url) return json({ error: "Pull Request não encontrado.", code: "PULL_REQUEST_NOT_FOUND" }, 404);
      const number = Number(task.pull_request_url.match(/\/pull\/(\d+)/)?.[1]);
      stage = "committing";
      const liveRepo = await gh(selected.token, `/repos/${selected.repo.owner.login}/${selected.repo.name}`);
      const liveBranch = String(liveRepo?.default_branch || selected.repo.default_branch || "").trim();
      const beforeRef = await gh(selected.token, `/repos/${selected.repo.owner.login}/${selected.repo.name}/git/ref/heads/${encodeURIComponent(liveBranch).replace(/%2F/g, "/")}`);
      const beforeSha = String(beforeRef?.object?.sha || "");
      const merged = await gh(selected.token, `/repos/${selected.repo.owner.login}/${selected.repo.name}/pulls/${number}/merge`, { method: "PUT", body: JSON.stringify({ commit_title: `MSK: ${String(task.summary || "alteração aprovada").slice(0, 70)}`, merge_method: "squash" }) });
      if (!merged?.merged || !merged?.sha) throw new AgentError("GITHUB_MERGE_REJECTED", String(merged?.message || "Merge recusado."), { stage: "committing", httpStatus: 409 });
      const afterRef = await gh(selected.token, `/repos/${selected.repo.owner.login}/${selected.repo.name}/git/ref/heads/${encodeURIComponent(liveBranch).replace(/%2F/g, "/")}`);
      const afterSha = String(afterRef?.object?.sha || "");
      if (!afterSha || afterSha !== String(merged.sha) || afterSha === beforeSha) throw new AgentError("COMMIT_VERIFICATION_FAILED", "O PR antigo foi mesclado, mas o branch padrão não mudou para o SHA do merge.", { stage: "verifying", retryable: true, httpStatus: 409 });
      await taskPatch(id, { status: "verification_pending", preview_status: "pending", commit_sha: afterSha, branch_name: liveBranch, error: null, error_code: null, error_stage: null }, who.id);
      return json({ ok: true, completed: false, verification_pending: true, preview_pending: true, preview_ready: false, branch: liveBranch, branch_used: liveBranch, commit_sha: afterSha, commit_url: `https://github.com/${selected.repo.owner.login}/${selected.repo.name}/commit/${afterSha}`, message: `Commit criado em ${liveBranch}. Validando a prévia antes de concluir.`, repository: selectedRepo });
    }

    if (action === "preview-confirm") {
      const id = String(body.task_id || "");
      const expectedSha = String(body.commit_sha || "").trim();
      const previewOk = body.preview_ok === true;
      if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{40}$/i.test(expectedSha)) return json({ ok: false, code: "PREVIEW_CONFIRM_INVALID" }, 400);
      const { data: task } = await db.from("msk_tasks").select("id,status,branch_name,commit_sha,last_known_good_sha,preview_status").eq("id", id).eq("lovable_project_id", pid).eq("user_id", who.id).maybeSingle();
      if (!task) return json({ ok: false, code: "TASK_NOT_FOUND" }, 404);
      if (String(task.commit_sha || "") !== expectedSha) return json({ ok: false, code: "PREVIEW_COMMIT_MISMATCH", message: "A prévia não corresponde ao commit desta execução." }, 409);
      if (String(task.status || "") !== "verification_pending") return json({ ok: false, code: "PREVIEW_CONFIRM_NOT_PENDING", task_status: task.status }, 409);
      const verifyBranch = String(task.branch_name || selected.repo.default_branch || "").trim();
      if (!verifyBranch) return json({ ok: false, code: "PREVIEW_BRANCH_MISSING" }, 409);
      const ref = await gh(selected.token, `/repos/${selected.repo.owner.login}/${selected.repo.name}/git/ref/heads/${encodeURIComponent(verifyBranch).replace(/%2F/g, "/")}`);
      const liveSha = String(ref?.object?.sha || "");
      if (liveSha !== expectedSha) return json({ ok: false, code: "PREVIEW_BRANCH_MOVED", message: "O branch mudou antes da confirmação da prévia.", expected_sha: expectedSha, actual_sha: liveSha }, 409);
      if (!previewOk) {
        await taskPatch(id, { status: "failed", preview_status: "failed", error: "A prévia não passou na verificação visual/runtime.", error_code: "PREVIEW_FAILED", error_stage: "verifying" }, who.id);
        return json({ ok: true, completed: false, preview_ready: false, preview_status: "failed", code: "PREVIEW_FAILED", last_known_good_sha: task.last_known_good_sha || null });
      }
      const now = new Date().toISOString();
      await taskPatch(id, { status: "completed", preview_status: "healthy", preview_verified_at: now, last_known_good_sha: expectedSha, error: null, error_code: null, error_stage: null }, who.id);
      return json({ ok: true, completed: true, preview_ready: true, preview_pending: false, preview_status: "healthy", commit_sha: expectedSha, branch: verifyBranch, verified_at: now, repository: selectedRepo });
    }

    if (action !== "run") return json({ error: "Ação não suportada.", code: "ACTION_NOT_SUPPORTED" }, 400);

    const cmd = String(body.original_command || body.message || body.command || "").trim();
    const clientCmd = String(body.client_original_command || cmd).trim();
    if (!cmd) return json({ error: "Comando vazio.", code: "EMPTY_COMMAND" }, 400);
    taskId = /^[0-9a-f-]{36}$/i.test(String(body.task_id || "")) ? String(body.task_id) : crypto.randomUUID();
    const taskWrite = await db.from("msk_tasks").upsert({ id: taskId, lovable_project_id: pid, user_id: who.id, command: clientCmd.slice(0, 12000), status: "locating_files", error: null, error_code: null, error_stage: null, retry_count: 0, last_error_id: null, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (taskWrite.error) throw new AgentError("TASK_PERSISTENCE_FAILED", "Não foi possível registrar a tarefa antes da execução.", { stage: "request", httpStatus: 500, cause: taskWrite.error });

    const owner = selected.repo.owner.login;
    const repoNameOnly = selected.repo.name;
    const liveRepoAtStart = await gh(selected.token, `/repos/${owner}/${repoNameOnly}`);
    let branch = String(liveRepoAtStart?.default_branch || selected.repo.default_branch || "").trim();
    if (!branch) throw new AgentError("GITHUB_RESOURCE_NOT_FOUND", "O repositório não informou o branch padrão sincronizado pelo Lovable.", { stage: "repository", httpStatus: 404 });
    repository = `${owner}/${repoNameOnly}`;
    branchName = branch;

    if (String(proj?.github_default_branch || "") !== branch) {
      const branchUpdate = await db.from("msk_projects").update({ github_default_branch: branch, updated_at: new Date().toISOString() }).eq("lovable_project_id", pid).eq("user_id", who.id);
      if (branchUpdate.error) console.warn("MSK default branch cache update failed", branchUpdate.error.message);
    }

    stage = "locking";
    lockKey = `${normalizeRepo(repository)}#${branch}`;
    lockHeld = await acquireRepoLock(lockKey, taskId, who.id, 210);
    if (!lockHeld) throw new AgentError("LOCK_ACQUISITION_FAILED", "Já existe outra edição ativa neste repositório e branch.", { stage: "locking", retryable: true, httpStatus: 409, context: { repository, branch } });

    stage = "locating_files";
    await taskPatch(taskId, { status: "locating_files" }, who.id);
    const tree = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/git/trees/${encodeURIComponent(branch).replace(/%2F/g, "/")}?recursive=1`);
    // Ignora blobs gigantes: eles nunca cabem no prompt e derrubam o worker por memória.
    const MAX_BLOB_BYTES = 160000;
    const paths = (tree.tree || [])
      .filter((x: any) => x.type === "blob" && /\.(tsx?|jsx?|css|scss|html|json|md|sql|mjs|cjs)$/.test(x.path))
      .filter((x: any) => !Number.isFinite(Number(x.size)) || Number(x.size) <= MAX_BLOB_BYTES)
      .slice(0, 800)
      .map((x: any) => String(x.path));
    if (!paths.length) throw new AgentError("AGENT_NO_EDITABLE_FILES", "Não existem arquivos editáveis compatíveis no repositório.", { stage: "locating_files", httpStatus: 422 });

    const fast = String(body.mode || "").toUpperCase() === "FAST_EDIT" && isSimpleVisualEdit(clientCmd);
    stage = "analyzing";
    await taskPatch(taskId, { status: "analyzing" }, who.id);
    let chosen: string[] = fast ? selectFallbackFiles(paths, cmd).slice(0, 2) : [];
    if (!chosen.length) {
      let pick: any = {};
      try {
        const selection = await ask(req, selectionPrompt(cmd, paths, repository), true, 1800);
        pick = parse(selection.text);
      } catch (error) {
        console.warn("MSK file selection fallback", mapErrorToAgentError(error, "analyzing").code);
      }
      chosen = resolveChosenFiles(paths, pick, cmd, fast ? 2 : 5);
    }
    if (!chosen.length) throw new AgentError("AGENT_TARGET_NOT_FOUND", "Não foi possível localizar com segurança o alvo do pedido.", { stage: "locating_files", retryable: true, httpStatus: 422 });

    // Download em série com orçamento total de conteúdo. O Promise.all com arquivos
    // grandes estourava a memória do worker (WORKER_RESOURCE_LIMIT).
    const CONTENT_BUDGET = 190000;
    const files: Array<{ path: string; sha: string; content: string }> = [];
    let usedBudget = 0;
    for (const path of chosen) {
      if (usedBudget >= CONTENT_BUDGET) break;
      const x = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`);
      const b64 = String(x?.content || "").replace(/\n/g, "");
      if (!b64 || b64.length > 260000) continue;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const content = dec.decode(bytes);
      if (content.length > 90000) continue;
      usedBudget += content.length;
      files.push({ path, sha: x.sha, content });
    }
    if (!files.length) throw new AgentError("AGENT_TARGET_NOT_FOUND", "Os arquivos alvo são grandes demais para uma edição segura nesta execução.", { stage: "locating_files", retryable: false, httpStatus: 422 });

    const highRisk = isHighRiskCommand(cmd);
    const basePrompt = editPrompt(cmd, repository, files, highRisk);
    let out: any = {};
    let changes: Array<{ path: string; content: string; create: boolean }> = [];
    let feedback = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      retryCount = attempt - 1;
      stage = attempt === 1 ? "editing" : "self_correcting";
      await taskPatch(taskId, { status: stage, retry_count: retryCount }, who.id);
      const rejections: string[] = [];
      try {
        const prompt = attempt === 1 ? basePrompt : `${basePrompt}\n\nAUTO-CORREÇÃO CONTROLADA — tentativa ${attempt}/3. Corrija somente os problemas abaixo, sem ampliar o escopo e sem trocar o alvo.\n${feedback.slice(0, 5000)}`;
        const response = await ask(req, prompt, true, fast ? 12000 : highRisk ? 18000 : 16000);
        out = parse(response.text);
        changes = validateChanges(out.changes, files, paths, rejections);
      } catch (error) {
        const mapped = mapErrorToAgentError(error, stage);
        feedback = `${mapped.code}: ${mapped.message}`;
        changes = [];
        if (!mapped.retryable || attempt === 3) throw mapped;
      }

      if (!changes.length) {
        const detail = rejections.length ? `Motivos exatos da rejeição:\n- ${rejections.join("\n- ")}` : "A saída não trouxe nenhuma alteração utilizável.";
        feedback = `NO_CHANGES_APPLIED: nenhuma alteração válida foi produzida.\n${detail}\nObrigatório na próxima tentativa: usar exatamente um dos caminhos analisados (${files.map(f => f.path).join(", ")}) e, se o "find" falhar novamente, devolver o arquivo inteiro em "content" já com a alteração aplicada.`;
        if (attempt < 3) {
          await taskPatch(taskId, { status: "no_changes_retry", retry_count: attempt }, who.id);
          continue;
        }
        console.error("MSK no changes applied", JSON.stringify({ taskId, rejections: rejections.slice(0, 8) }));
        throw new AgentError("NO_CHANGES_APPLIED", "A IA não produziu uma alteração válida após as tentativas seguras.", { stage: "editing", retryable: true, httpStatus: 422, context: { rejections: rejections.slice(0, 8), files: files.map(f => f.path) } });
      }

      stage = "validating";
      await taskPatch(taskId, { status: "validating", retry_count: retryCount }, who.id);
      validatePreCommit(changes, files);
      const review = await semanticReview(req, cmd, repository, files, changes);
      if (review.ok) break;
      feedback = `VALIDATION_FAILED: ${review.issues.join(" | ") || "o resultado não correspondeu ao pedido com segurança."}`;
      changes = [];
      if (attempt < 3) {
        await taskPatch(taskId, { status: "self_correcting", retry_count: attempt }, who.id);
        continue;
      }
      throw new AgentError("VALIDATION_FAILED", "A alteração não passou na verificação semântica do pedido.", { stage: "validating", retryable: true, httpStatus: 422, context: { issues: review.issues } });
    }

    validatePreCommit(changes, files);
    const commitMessage = `MSK: ${String(out.summary || clientCmd).replace(/\s+/g, " ").slice(0, 70)}`;
    await taskPatch(taskId, { status: "finalizing", summary: String(out.summary || "").slice(0, 2000), retry_count: retryCount }, who.id);

    // Releia o branch padrão imediatamente antes do commit. Nunca confie apenas no cache.
    const liveRepoBeforeCommit = await gh(selected.token, `/repos/${owner}/${repoNameOnly}`);
    const liveBranchBeforeCommit = String(liveRepoBeforeCommit?.default_branch || branch || "").trim();
    if (!liveBranchBeforeCommit) throw new AgentError("GITHUB_RESOURCE_NOT_FOUND", "Não foi possível confirmar o branch padrão antes do commit.", { stage: "repository", httpStatus: 404 });
    if (liveBranchBeforeCommit !== branch) {
      branch = liveBranchBeforeCommit;
      branchName = branch;
      const branchUpdate = await db.from("msk_projects").update({ github_default_branch: branch, updated_at: new Date().toISOString() }).eq("lovable_project_id", pid).eq("user_id", who.id);
      if (branchUpdate.error) console.warn("MSK default branch cache refresh failed", branchUpdate.error.message);
    }

    stage = "committing";
    await taskPatch(taskId, { status: "committing", branch_name: branch }, who.id);
    const beforeRef = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`);
    const beforeSha = String(beforeRef?.object?.sha || "");
    if (!beforeSha) throw new AgentError("GITHUB_RESOURCE_NOT_FOUND", "O branch padrão não possui SHA antes do commit.", { stage: "committing", httpStatus: 404 });

    const commit = await directCommit(selected.token, owner, repoNameOnly, branch, changes, commitMessage);
    const usedBranch = String(commit?.branch || branch).trim();
    if (!usedBranch) throw new AgentError("COMMIT_VERIFICATION_FAILED", "O commit não retornou o branch utilizado.", { stage: "verifying", retryable: true, httpStatus: 409 });
    branch = usedBranch;
    branchName = usedBranch;

    if (String(proj?.github_default_branch || "") !== usedBranch) {
      const branchUpdate = await db.from("msk_projects").update({ github_default_branch: usedBranch, updated_at: new Date().toISOString() }).eq("lovable_project_id", pid).eq("user_id", who.id);
      if (branchUpdate.error) console.warn("MSK default branch final cache update failed", branchUpdate.error.message);
    }

    stage = "verifying";
    await taskPatch(taskId, { status: "verifying", branch_name: usedBranch }, who.id);
    const finalRef = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/git/ref/heads/${encodeURIComponent(usedBranch).replace(/%2F/g, "/")}`);
    const finalSha = String(finalRef?.object?.sha || "");
    const commitSha = String(commit?.sha || "");
    if (!commitSha || !finalSha || finalSha !== commitSha || finalSha === beforeSha) {
      throw new AgentError("COMMIT_VERIFICATION_FAILED", "A tarefa não será concluída: o SHA do branch padrão não mudou exatamente para o commit criado.", { stage: "verifying", retryable: true, httpStatus: 409, context: { branch: usedBranch, before: beforeSha, expected: commitSha, actual: finalSha } });
    }

    const summary = professionalSummary(String(out.summary || "Alteração aplicada."), repository, changes.map(x => x.path), commitSha);
    await taskPatch(taskId, { status: "verification_pending", preview_status: "pending", commit_sha: commitSha, branch_name: usedBranch, summary, error: null, error_code: null, error_stage: null }, who.id);
    const commitUrl = String(commit?.html_url || `https://github.com/${owner}/${repoNameOnly}/commit/${commitSha}`);
    const previewMessage = `Commit criado em ${usedBranch}. Validando a prévia antes de concluir.`;
    return json({
      ok: true,
      completed: false,
      verification_pending: true,
      preview_ready: false,
      direct_commit: commit?.fallback_pr !== true,
      fallback_pr: commit?.fallback_pr === true,
      assistant_message: String(out.reply || summary),
      summary,
      model: "MSK-IA",
      provider: "MSK",
      task_id: taskId,
      repository,
      repository_locked: true,
      branch: usedBranch,
      branch_used: usedBranch,
      files: changes.map(x => x.path),
      files_changed_count: changes.length,
      commit_sha: commitSha,
      commit_url: commitUrl,
      pull_request_url: String(commit?.pull_request_url || "") || undefined,
      preview_pending: true,
      preview_message: previewMessage,
      validation: { content_changed: true, semantic: true, commit_verified: true, branch_changed: true, preview_verified: false },
      fast_edit: fast,
      commit_attempt: Number(commit?.commit_attempt || 1),
    });
  } catch (error) {
    const mapped = mapErrorToAgentError(error, stage);
    const logged = await recordAgentError({ error, stage: mapped.stage, taskId: taskId || undefined, userId: taskUserId || undefined, projectId: projectId || undefined, repository: repository || undefined, branchName: branchName || undefined, attempt: retryCount, context: { taskId: taskId || null, repository: repository || null, branch: branchName || null } });
    console.error("MSK agent failure", JSON.stringify({ taskId: taskId || null, code: mapped.code, stage: mapped.stage, retryable: mapped.retryable, errorId: logged.errorId || null }));
    if (taskId && taskUserId) await taskPatch(taskId, { status: "failed", error: mapped.message, error_code: mapped.code, error_stage: mapped.stage, retry_count: retryCount, last_error_id: logged.errorId || null }, taskUserId);
    return json({ error: mapped.message, code: mapped.code, stage: mapped.stage, retryable: mapped.retryable, error_id: logged.errorId || undefined, task_id: taskId || undefined }, mapped.httpStatus);
  } finally {
    if (lockHeld && lockKey && taskId) await releaseRepoLock(lockKey, taskId);
  }
});
