import { cors, json, env, db, dec, sha, identity, verifyDevice } from "./common.ts";
import { makeState, readState, installation, instToken, gh, validSession, chooseRepo } from "./github.ts";
import { ask, parse, b64utf, directCommit } from "./ai.ts";
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
  const compactBefore = before.map(file => `--- ANTES ${file.path}\n${file.content}`).join("\n").slice(0, 26000);
  const compactAfter = changes.map(file => `--- DEPOIS ${file.path}\n${file.content}`).join("\n").slice(0, 42000);
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
      return json({ ok: true, service: "msk-agent", version: "3.2.0-observable-reliable", device_guard: "staged", repository_isolation: "strict", resilient_ai: true, global_training: true, fast_edit: true, structured_errors: true, repo_lock: true, semantic_precommit: true });
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
      const answer = await ask(req, `${MSK_ENGINEERING_PROFILE}\nMODO CONSULTA: responda em português do Brasil de forma natural, educada e profissional, sempre pelo contexto de desenvolvimento. Use o contexto recente e a skill quando presentes. Não afirme que editou/commitou se esta chamada é apenas conversa.\nCliente/contexto: ${msg}`, false, 3000);
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
      const id = String(body.task_id || "");
      const { data: task } = await db.from("msk_tasks").select("id,status,pull_request_url,summary").eq("id", id).eq("lovable_project_id", pid).eq("user_id", who.id).maybeSingle();
      if (!task?.pull_request_url) return json({ error: "Pull Request não encontrado.", code: "PULL_REQUEST_NOT_FOUND" }, 404);
      const number = Number(task.pull_request_url.match(/\/pull\/(\d+)/)?.[1]);
      stage = "committing";
      const merged = await gh(selected.token, `/repos/${selected.repo.owner.login}/${selected.repo.name}/pulls/${number}/merge`, { method: "PUT", body: JSON.stringify({ commit_title: `MSK: ${String(task.summary || "alteração aprovada").slice(0, 70)}`, merge_method: "squash" }) });
      if (!merged?.merged) throw new AgentError("GITHUB_MERGE_REJECTED", String(merged?.message || "Merge recusado."), { stage: "committing", httpStatus: 409 });
      await taskPatch(id, { status: "completed", error: null, error_code: null, error_stage: null }, who.id);
      return json({ ok: true, completed: true, message: "Alteração aplicada no repositório correto.", repository: selectedRepo });
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
    const branch = selected.repo.default_branch;
    repository = `${owner}/${repoNameOnly}`;
    branchName = branch;

    stage = "locking";
    lockKey = `${normalizeRepo(repository)}#${branch}`;
    lockHeld = await acquireRepoLock(lockKey, taskId, who.id, 210);
    if (!lockHeld) throw new AgentError("LOCK_ACQUISITION_FAILED", "Já existe outra edição ativa neste repositório e branch.", { stage: "locking", retryable: true, httpStatus: 409, context: { repository, branch } });

    stage = "locating_files";
    await taskPatch(taskId, { status: "locating_files" }, who.id);
    const tree = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/git/trees/${encodeURIComponent(branch).replace(/%2F/g, "/")}?recursive=1`);
    const paths = (tree.tree || []).filter((x: any) => x.type === "blob" && /\.(tsx?|jsx?|css|scss|html|json|md|sql|mjs|cjs)$/.test(x.path)).slice(0, 1200).map((x: any) => String(x.path));
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
      chosen = resolveChosenFiles(paths, pick, cmd, fast ? 2 : 8);
    }
    if (!chosen.length) throw new AgentError("AGENT_TARGET_NOT_FOUND", "Não foi possível localizar com segurança o alvo do pedido.", { stage: "locating_files", retryable: true, httpStatus: 422 });

    const files = await Promise.all(chosen.map(async (path: string) => {
      const x = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`);
      return { path, sha: x.sha, content: dec.decode(Uint8Array.from(atob(x.content.replace(/\n/g, "")), c => c.charCodeAt(0))) };
    }));

    const highRisk = isHighRiskCommand(cmd);
    const basePrompt = editPrompt(cmd, repository, files, highRisk);
    let out: any = {};
    let changes: Array<{ path: string; content: string; create: boolean }> = [];
    let feedback = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      retryCount = attempt - 1;
      stage = attempt === 1 ? "editing" : "self_correcting";
      await taskPatch(taskId, { status: stage, retry_count: retryCount }, who.id);
      try {
        const prompt = attempt === 1 ? basePrompt : `${basePrompt}\n\nAUTO-CORREÇÃO CONTROLADA — tentativa ${attempt}/3. Corrija somente os problemas abaixo, sem ampliar o escopo e sem trocar o alvo.\n${feedback.slice(0, 5000)}`;
        const response = await ask(req, prompt, true, fast ? 12000 : highRisk ? 18000 : 16000);
        out = parse(response.text);
        changes = validateChanges(out.changes, files, paths);
      } catch (error) {
        const mapped = mapErrorToAgentError(error, stage);
        feedback = `${mapped.code}: ${mapped.message}`;
        changes = [];
        if (!mapped.retryable || attempt === 3) throw mapped;
      }

      if (!changes.length) {
        feedback = feedback || "NO_CHANGES_APPLIED: a saída não produziu alteração completa e válida.";
        if (attempt < 3) {
          await taskPatch(taskId, { status: "no_changes_retry", retry_count: attempt }, who.id);
          continue;
        }
        throw new AgentError("NO_CHANGES_APPLIED", "A IA não produziu uma alteração válida após as tentativas seguras.", { stage: "editing", retryable: true, httpStatus: 422 });
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

    if (body.direct_commit !== false) {
      stage = "committing";
      await taskPatch(taskId, { status: "committing" }, who.id);
      try {
        const commit = await directCommit(selected.token, owner, repoNameOnly, branch, changes, commitMessage);
        stage = "verifying";
        await taskPatch(taskId, { status: "verifying", branch_name: branch }, who.id);
        const ref = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`);
        const headSha = String(ref?.object?.sha || "");
        if (!commit?.sha || headSha !== String(commit.sha)) throw new AgentError("COMMIT_VERIFICATION_FAILED", "O SHA do branch não corresponde ao commit criado.", { stage: "verifying", retryable: true, httpStatus: 409, context: { expected: String(commit?.sha || ""), actual: headSha } });
        const summary = professionalSummary(String(out.summary || "Alteração aplicada."), repository, changes.map(x => x.path), commit.sha);
        await taskPatch(taskId, { status: "completed", branch_name: branch, summary, error: null, error_code: null, error_stage: null }, who.id);
        return json({ ok: true, completed: true, direct_commit: true, assistant_message: String(out.reply || summary), summary, model: "MSK-IA", provider: "MSK", task_id: taskId, repository, repository_locked: true, branch, files: changes.map(x => x.path), files_changed_count: changes.length, commit_sha: commit.sha, commit_url: commit.html_url || `https://github.com/${owner}/${repoNameOnly}/commit/${commit.sha}`, validation: { content_changed: true, semantic: true, commit_verified: true }, fast_edit: fast });
      } catch (error) {
        const mapped = mapErrorToAgentError(error, stage);
        if (mapped.code !== "GITHUB_CONFLICT") throw mapped;
        console.warn("MSK direct commit conflict; preparing isolated PR", mapped.code);
      }
    }

    stage = "committing";
    await taskPatch(taskId, { status: "committing" }, who.id);
    const branchForPr = `msk/${taskId.slice(0, 8)}`;
    const baseRef = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`);
    await gh(selected.token, `/repos/${owner}/${repoNameOnly}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branchForPr}`, sha: baseRef.object.sha }) });
    for (const change of changes) {
      const old = files.find(file => file.path === change.path);
      await gh(selected.token, `/repos/${owner}/${repoNameOnly}/contents/${encodeURIComponent(change.path).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ message: commitMessage, content: b64utf(change.content), branch: branchForPr, ...(old?.sha ? { sha: old.sha } : {}) }) });
    }

    stage = "verifying";
    await taskPatch(taskId, { status: "verifying", branch_name: branchForPr }, who.id);
    const prRef = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/git/ref/heads/${encodeURIComponent(branchForPr).replace(/%2F/g, "/")}`);
    if (!String(prRef?.object?.sha || "") || String(prRef.object.sha) === String(baseRef?.object?.sha || "")) throw new AgentError("COMMIT_VERIFICATION_FAILED", "O branch isolado não contém mudanças confirmadas.", { stage: "verifying", retryable: true, httpStatus: 409 });
    const summary = professionalSummary(String(out.summary || "Alteração preparada."), repository, changes.map(x => x.path));
    const pr = await gh(selected.token, `/repos/${owner}/${repoNameOnly}/pulls`, { method: "POST", body: JSON.stringify({ title: commitMessage, head: branchForPr, base: branch, body: `Alteração preparada pelo MSK Agente.\n\n${summary}` }) });
    await taskPatch(taskId, { status: "awaiting_approval", branch_name: branchForPr, pull_request_url: pr.html_url, summary, error: null, error_code: null, error_stage: null }, who.id);
    return json({ ok: true, requires_approval: true, assistant_message: String(out.reply || summary), summary, model: "MSK-IA", provider: "MSK", repository, repository_locked: true, branch: branchForPr, files: changes.map(x => x.path), files_changed_count: changes.length, task_id: taskId, pull_request_url: pr.html_url, validation: { content_changed: true, semantic: true, branch_verified: true } });
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
