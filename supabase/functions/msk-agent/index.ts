import { cors, json, env, db, dec, sha, identity, verifyDevice } from "./common.ts";
import { makeState, readState, installation, instToken, gh, validSession, chooseRepo } from "./github.ts";
import { ask, parse, b64utf, directCommit } from "./ai.ts";
import { MSK_ENGINEERING_PROFILE, normalizeRepo, isHighRiskCommand, selectionPrompt, editPrompt, validateChanges, professionalSummary } from "./professional.ts";

const normalize = (v: string) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function selectFallbackFiles(paths: string[], command: string) {
  const q = normalize(command);
  const visual = /\b(cor|color|texto|text|inicio|inicial|home|pagina|tela|botao|button|layout|estilo|style|fonte|font)\b/.test(q);
  const scored = paths
    .filter(p => !/(^|\/)(node_modules|dist|build|coverage|supabase\/migrations)(\/|$)/i.test(p))
    .filter(p => !/(routeTree\.gen|\.test\.|\.spec\.|lock\.json$)/i.test(p))
    .map(path => {
      const p = normalize(path);
      let score = 0;
      if (/src\/routes\/(index|home)(\.|\/)/.test(p)) score += 24;
      if (/src\/(pages|routes)\//.test(p)) score += 10;
      if (/(^|\/)(index|home|landing|hero|app|main)\.(tsx?|jsx?)$/.test(p)) score += 15;
      if (/(home|landing|hero|inicio|index)/.test(p)) score += 8;
      if (/src\/components\//.test(p)) score += 4;
      if (visual && /\.(css|tsx|jsx|ts|js)$/.test(p)) score += 5;
      if (visual && /styles?\.css$/.test(p)) score += 6;
      if (/readme|\.md$|package\.json$/.test(p)) score -= 12;
      return { path, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return scored.slice(0, 6).map(x => x.path);
}

function resolveChosenFiles(paths: string[], candidate: any, command: string) {
  const lower = new Map(paths.map(p => [p.toLowerCase(), p]));
  const requested = Array.isArray(candidate?.files) ? candidate.files : [];
  const exact = requested
    .map((p: any) => lower.get(String(p || "").trim().toLowerCase()))
    .filter(Boolean) as string[];
  const unique = [...new Set(exact)].slice(0, 8);
  return unique.length ? unique : selectFallbackFiles(paths, command);
}

const taskPatch = async (taskId: string, patch: Record<string, unknown>, userId: string) => {
  if (!taskId) return;
  await db.from("msk_tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", taskId).eq("user_id", userId);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  let taskId = "";
  let taskUserId = "";
  try {
    if (req.method === "POST" && url.searchParams.get("action") === "health") {
      return json({ ok: true, service: "msk-agent", version: "3.0.0-professional-multitenant", device_guard: "staged", repository_isolation: "strict", resilient_ai: true });
    }

    if (req.method === "GET" && url.searchParams.get("installation_id") && url.searchParams.get("state")) {
      const st = await readState(url.searchParams.get("state")!);
      const iid = Number(url.searchParams.get("installation_id"));
      if (!Number.isInteger(iid) || iid <= 0) return json({ error: "Instalação GitHub inválida." }, 400);
      const ins = await installation(iid);
      if (!ins) return json({ error: "A instalação GitHub não está ativa." }, 404);
      const uid = String(st.userId || "");
      if (uid) {
        const { data: e } = await db.from("msk_github_installations").select("user_id").eq("installation_id", iid).maybeSingle();
        if (e?.user_id && String(e.user_id) !== uid) return json({ error: "Instalação pertence a outra conta.", code: "GITHUB_INSTALLATION_OWNERSHIP_MISMATCH" }, 403);
      }
      const session = crypto.randomUUID() + crypto.randomUUID(), now = new Date().toISOString();
      const patch: any = { lovable_project_id: st.projectId, github_installation_id: iid, session_token_hash: await sha(session), connected_at: now, updated_at: now, ...(uid ? { user_id: uid } : {}) };
      if (st.repository && /^[\w.-]+\/[\w.-]+$/.test(st.repository)) {
        const t = await instToken(iid), d = await gh(t, "/installation/repositories?per_page=100"), m = (d.repositories || []).find((x: any) => String(x.full_name).toLowerCase() === String(st.repository).toLowerCase());
        if (m) { patch.github_owner = m.owner.login; patch.github_repo = m.name; patch.github_default_branch = m.default_branch; }
      }
      const pr = await db.from("msk_projects").upsert(patch);
      if (pr.error) throw new Error("GITHUB_PROJECT_BIND_FAILED");
      if (uid) {
        const ir = await db.from("msk_github_installations").upsert({ user_id: uid, installation_id: iid, account_login: String(ins?.account?.login || "") || null, account_type: String(ins?.account?.type || "") || null, revoked_at: null, last_validated_at: now, updated_at: now }, { onConflict: "installation_id" });
        if (ir.error) throw new Error("GITHUB_INSTALLATION_BIND_FAILED");
      }
      return Response.redirect(`${String(st.returnUrl).split("#")[0]}#msk_session=${encodeURIComponent(session)}`, 302);
    }

    if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
    const action = url.searchParams.get("action") || "status";
    const raw = await req.text();
    const guard = await verifyDevice(req, raw, action);
    if (!guard.ok) return json({ ok: false, connected: false, blocked: guard.code === "INSTALLATION_BLOCKED", code: guard.code, error: guard.code === "INSTALLATION_BLOCKED" ? "Esta instalação foi bloqueada pela segurança MSK." : "A autorização segura desta instalação foi recusada." }, guard.status);

    const body = (() => { try { return JSON.parse(raw || "{}"); } catch { return {}; } })();
    const pid = String(body.lovable_project_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(pid)) return json({ error: "ID de projeto inválido." }, 400);
    const who = await identity(req);
    if (!who) return json({ error: "Licença MSK necessária.", code: "LICENSE_REQUIRED" }, 401);
    taskUserId = who.id;

    const { data: proj } = await db.from("msk_projects").select("*").eq("lovable_project_id", pid).maybeSingle();
    if (proj?.user_id && String(proj.user_id) !== who.id) return json({ connected: false, code: "PROJECT_OWNERSHIP_MISMATCH", error: "Este projeto pertence a outra licença MSK." }, 403);
    if (proj && !proj.user_id) await db.from("msk_projects").update({ user_id: who.id, updated_at: new Date().toISOString() }).eq("lovable_project_id", pid).is("user_id", null);

    if (action === "connect") {
      if (proj?.github_installation_id) {
        const s = req.headers.get("x-msk-session") || "";
        if (await validSession(pid, s)) return json({ ok: true, connected: true, repository: proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : "" });
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
      const repo = proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : "", s = req.headers.get("x-msk-session") || "";
      if (await validSession(pid, s)) return json({ ok: true, connected: true, installation_known: true, repository: repo, repository_locked: !!repo });
      const ns = crypto.randomUUID() + crypto.randomUUID();
      await db.from("msk_projects").update({ user_id: who.id, session_token_hash: await sha(ns), updated_at: new Date().toISOString() }).eq("lovable_project_id", pid);
      return json({ ok: true, connected: true, installation_known: true, session_recovered: true, session_token: ns, repository: repo, repository_locked: !!repo });
    }

    if (action === "bind-existing") {
      const iid = Number(body.installation_id || 0), rs = String(body.recovery_state || "");
      if (!iid || !rs) return json({ connected: false, code: "RECOVERY_STATE_REQUIRED" }, 401);
      const st = await readState(rs);
      if (st.projectId !== pid || String(st.userId || "") !== who.id) return json({ connected: false, code: "RECOVERY_IDENTITY_MISMATCH" }, 403);
      const ins = await installation(iid);
      if (!ins) return json({ connected: false }, 404);
      const repo = normalizeRepo(String(st.repository || body.repository_url || ""));
      let owner = proj?.github_owner || null, name = proj?.github_repo || null, branch = proj?.github_default_branch || null;
      if (repo) {
        const t = await instToken(iid), d = await gh(t, "/installation/repositories?per_page=100"), m = (d.repositories || []).find((r: any) => String(r.full_name).toLowerCase() === repo);
        if (!m) return json({ connected: false, code: "REPOSITORY_NOT_AUTHORIZED" }, 403);
        owner = m.owner.login; name = m.name; branch = m.default_branch;
      }
      const session = crypto.randomUUID() + crypto.randomUUID(), now = new Date().toISOString();
      const p = await db.from("msk_projects").upsert({ lovable_project_id: pid, user_id: who.id, github_installation_id: iid, github_owner: owner, github_repo: name, github_default_branch: branch, session_token_hash: await sha(session), connected_at: now, updated_at: now });
      if (p.error) throw p.error;
      await db.from("msk_github_installations").upsert({ user_id: who.id, installation_id: iid, account_login: String(ins?.account?.login || "") || null, account_type: String(ins?.account?.type || "") || null, revoked_at: null, last_validated_at: now, updated_at: now }, { onConflict: "installation_id" });
      return json({ ok: true, connected: true, recovered_existing_installation: true, installation_id: iid, session_token: session, repository: owner && name ? `${owner}/${name}` : repo, repository_locked: !!(owner && name) });
    }

    if (action === "chat") {
      const msg = String(body.message || body.command || "").trim();
      if (!msg) return json({ error: "Mensagem vazia." }, 400);
      const a = await ask(req, `${MSK_ENGINEERING_PROFILE}\nMODO CONSULTA: responda em português do Brasil de forma objetiva e profissional. Não afirme que editou, commitou ou validou código se esta chamada é apenas conversa.\nCliente: ${msg}`, false, 3500);
      return json({ ok: true, connected: true, mode: "chat", no_edit: true, assistant_message: a.text.trim(), message: a.text.trim(), response_id: a.id, model: "MSK-IA", provider: "MSK" });
    }

    const s = req.headers.get("x-msk-session") || "";
    if (!await validSession(pid, s)) return json({ error: "Sessão de edição MSK ainda não autorizada.", code: "MSK_SESSION_REQUIRED", connected: false }, 401);

    const boundRepo = proj?.github_owner && proj?.github_repo ? normalizeRepo(`${proj.github_owner}/${proj.github_repo}`) : "";
    const requestedRepo = normalizeRepo(String(body.repository_url || ""));
    if (boundRepo && requestedRepo && requestedRepo !== boundRepo) return json({ error: "O repositório solicitado não pertence a este projeto MSK.", code: "PROJECT_REPOSITORY_MISMATCH", connected: false, repository: boundRepo }, 409);

    if (action === "task-status") {
      const id = String(body.task_id || "");
      const { data: t } = await db.from("msk_tasks").select("id,status,summary,error,branch_name,pull_request_url,updated_at").eq("id", id).eq("lovable_project_id", pid).eq("user_id", who.id).maybeSingle();
      return t ? json({ ok: true, task: t, repository: boundRepo }) : json({ ok: false }, 404);
    }

    if (!proj?.github_installation_id) return json({ connected: false });
    const preferredRepo = boundRepo || requestedRepo;
    const sel = await chooseRepo(Number(proj.github_installation_id), "", preferredRepo);
    if (!sel.repo) return json({ connected: false, requires_repository_selection: true, code: preferredRepo ? "BOUND_REPOSITORY_NOT_AUTHORIZED" : "EXACT_REPOSITORY_REQUIRED", repositories: sel.candidates });

    const selectedRepo = normalizeRepo(String(sel.repo.full_name || `${sel.repo.owner.login}/${sel.repo.name}`));
    if (boundRepo && selectedRepo !== boundRepo) return json({ connected: false, code: "PROJECT_REPOSITORY_MISMATCH", error: "Execução bloqueada para evitar mistura entre repositórios." }, 409);
    if (!boundRepo) {
      await db.from("msk_projects").update({ user_id: who.id, github_owner: sel.repo.owner.login, github_repo: sel.repo.name, github_default_branch: sel.repo.default_branch, updated_at: new Date().toISOString() }).eq("lovable_project_id", pid);
    }

    if (action === "approve") {
      const id = String(body.task_id || ""), { data: t } = await db.from("msk_tasks").select("id,status,pull_request_url,summary").eq("id", id).eq("lovable_project_id", pid).eq("user_id", who.id).maybeSingle();
      if (!t?.pull_request_url) return json({ error: "Pull Request não encontrado." }, 404);
      const n = Number(t.pull_request_url.match(/\/pull\/(\d+)/)?.[1]);
      const m = await gh(sel.token, `/repos/${sel.repo.owner.login}/${sel.repo.name}/pulls/${n}/merge`, { method: "PUT", body: JSON.stringify({ commit_title: `MSK: ${String(t.summary || "alteração aprovada").slice(0, 70)}`, merge_method: "squash" }) });
      if (!m?.merged) return json({ error: m?.message || "Merge recusado." }, 409);
      await taskPatch(id, { status: "completed", error: null }, who.id);
      return json({ ok: true, completed: true, message: "Alteração aplicada no repositório correto.", repository: selectedRepo });
    }

    if (action !== "run") return json({ error: "Ação não suportada.", code: "ACTION_NOT_SUPPORTED" }, 400);
    const cmd = String(body.original_command || body.message || body.command || "").trim();
    if (!cmd) return json({ error: "Comando vazio." }, 400);

    taskId = /^[0-9a-f-]{36}$/i.test(String(body.task_id || "")) ? String(body.task_id) : crypto.randomUUID();
    const taskWrite = await db.from("msk_tasks").upsert({ id: taskId, lovable_project_id: pid, user_id: who.id, command: cmd, status: "analyzing", error: null, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (taskWrite.error) throw taskWrite.error;

    const o = sel.repo.owner.login, r = sel.repo.name, b = sel.repo.default_branch, repoName = `${o}/${r}`;
    const tree = await gh(sel.token, `/repos/${o}/${r}/git/trees/${encodeURIComponent(b).replace(/%2F/g, "/")}?recursive=1`);
    const paths = (tree.tree || []).filter((x: any) => x.type === "blob" && /\.(tsx?|jsx?|css|scss|html|json|md|sql|mjs|cjs)$/.test(x.path)).slice(0, 1200).map((x: any) => String(x.path));
    if (!paths.length) throw new Error("MSK_NO_EDITABLE_FILES");

    let pick: any = {};
    try {
      const selection = await ask(req, selectionPrompt(cmd, paths, repoName), true, 3000);
      pick = parse(selection.text);
    } catch (e) {
      console.warn("MSK file selection fallback", e instanceof Error ? e.message : "invalid");
    }
    const chosen = resolveChosenFiles(paths, pick, cmd);
    if (!chosen.length) throw new Error("MSK_NO_SAFE_TARGET_FILES");

    await taskPatch(taskId, { status: "editing" }, who.id);
    const files = await Promise.all(chosen.map(async (path: string) => {
      const x = await gh(sel.token, `/repos/${o}/${r}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(b)}`);
      return { path, sha: x.sha, content: dec.decode(Uint8Array.from(atob(x.content.replace(/\n/g, "")), c => c.charCodeAt(0))) };
    }));

    await taskPatch(taskId, { status: "refining" }, who.id);
    const highRisk = isHighRiskCommand(cmd);
    const baseEditPrompt = editPrompt(cmd, repoName, files, highRisk);
    let out: any = {};
    let changes: Array<{ path: string; content: string; create: boolean }> = [];
    let firstText = "";

    try {
      const editResponse = await ask(req, baseEditPrompt, true, highRisk ? 32000 : 26000);
      firstText = editResponse.text;
      out = parse(editResponse.text);
      changes = validateChanges(out.changes, files, paths);
    } catch (e) {
      console.warn("MSK first edit attempt rejected", e instanceof Error ? e.message : "invalid");
    }

    if (!changes.length) {
      const retry = await ask(req, `${baseEditPrompt}\nATENÇÃO: a tentativa anterior foi rejeitada pela validação de segurança/estrutura. Gere novamente uma alteração completa, mínima e aplicável. Não use placeholders, não trunque arquivos e não altere arquivo existente que não foi analisado.${firstText ? `\nA saída rejeitada começou com: ${firstText.slice(0, 3000)}` : ""}`, true, highRisk ? 32000 : 26000);
      out = parse(retry.text);
      changes = validateChanges(out.changes, files, paths);
    }
    if (!changes.length) throw new Error("MSK_AI_NO_VALID_CHANGES");

    if (highRisk) {
      const reviewText = changes.map(c => `--- ${c.path} (${c.create ? "novo" : "existente"})\n${c.content}`).join("\n");
      const reviewResponse = await ask(req, `${MSK_ENGINEERING_PROFILE}\nREVISÃO FINAL DE SEGURANÇA. Não edite nada nesta resposta. Verifique se as mudanças abaixo atendem ao pedido sem quebrar isolamento multiusuário, autenticação, pagamentos, RLS, banco, licenças ou segredos. Responda SOMENTE JSON: {"ok":true,"issues":[]} ou {"ok":false,"issues":["problema objetivo"]}.\nRepositório: ${repoName}\nPedido: ${cmd}\n${reviewText}`, true, 4000);
      const review = parse(reviewResponse.text);
      if (review?.ok === false) {
        const issues = Array.isArray(review.issues) ? review.issues.slice(0, 8).join("; ") : "revisão de segurança reprovou a alteração";
        const corrected = await ask(req, `${baseEditPrompt}\nA revisão final encontrou estes problemas: ${issues}. Corrija-os e devolva novamente o JSON completo da edição.`, true, 32000);
        out = parse(corrected.text);
        changes = validateChanges(out.changes, files, paths);
        if (!changes.length) throw new Error("MSK_REVIEW_REJECTED");
      }
    }

    await taskPatch(taskId, { status: "finalizing", summary: String(out.summary || "").slice(0, 2000) }, who.id);
    const commitMessage = `MSK: ${String(out.summary || cmd).replace(/\s+/g, " ").slice(0, 70)}`;

    if (body.direct_commit !== false) {
      try {
        const c = await directCommit(sel.token, o, r, b, changes, commitMessage);
        const summary = professionalSummary(String(out.summary || "Alteração aplicada."), repoName, changes.map(x => x.path), c.sha);
        await taskPatch(taskId, { status: "completed", branch_name: b, summary, error: null }, who.id);
        return json({ ok: true, completed: true, direct_commit: true, assistant_message: String(out.reply || summary), summary, model: "MSK-IA", provider: "MSK", task_id: taskId, repository: repoName, repository_locked: true, branch: b, files: changes.map((x: any) => x.path), commit_sha: c.sha, commit_url: c.html_url || `https://github.com/${o}/${r}/commit/${c.sha}` });
      } catch (e) {
        console.warn("MSK direct commit conflict; preparing isolated PR", e instanceof Error ? e.message : "unknown");
      }
    }

    const bn = `msk/${taskId.slice(0, 8)}`;
    const ref = await gh(sel.token, `/repos/${o}/${r}/git/ref/heads/${encodeURIComponent(b).replace(/%2F/g, "/")}`);
    await gh(sel.token, `/repos/${o}/${r}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${bn}`, sha: ref.object.sha }) });
    for (const c of changes) {
      const old = files.find(f => f.path === c.path);
      await gh(sel.token, `/repos/${o}/${r}/contents/${encodeURIComponent(c.path).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ message: commitMessage, content: b64utf(c.content), branch: bn, ...(old?.sha ? { sha: old.sha } : {}) }) });
    }
    const summary = professionalSummary(String(out.summary || "Alteração preparada."), repoName, changes.map(x => x.path));
    const pr = await gh(sel.token, `/repos/${o}/${r}/pulls`, { method: "POST", body: JSON.stringify({ title: commitMessage, head: bn, base: b, body: `Alteração preparada pelo MSK Agente.\n\n${summary}` }) });
    await taskPatch(taskId, { status: "awaiting_approval", branch_name: bn, pull_request_url: pr.html_url, summary }, who.id);
    return json({ ok: true, requires_approval: true, assistant_message: String(out.reply || summary), summary, model: "MSK-IA", provider: "MSK", repository: repoName, repository_locked: true, branch: bn, files: changes.map((x: any) => x.path), task_id: taskId, pull_request_url: pr.html_url });
  } catch (e) {
    const rawError = e instanceof Error ? e.message : "Falha inesperada.";
    const ghErr = /GITHUB_APP_CREDENTIALS_INVALID|PRIVATE|ASN\.?1|pkcs|rsa|incorrect length|GitHub installation token failed/i.test(rawError);
    const aiErr = /MSK_AI_|BAI_API_KEY|api_key/i.test(rawError);
    const transientAi = /MSK_AI_TIMEOUT|MSK_AI_NETWORK_UNAVAILABLE|MSK_AI_UPSTREAM_(408|409|425|429|500|502|503|504)/i.test(rawError);
    const targetErr = /MSK_NO_EDITABLE_FILES|MSK_NO_SAFE_TARGET_FILES/i.test(rawError);
    const changeErr = /MSK_AI_NO_VALID_CHANGES|MSK_REVIEW_REJECTED/i.test(rawError);
    const message = ghErr
      ? "Não foi possível concluir a conexão com o GitHub agora. Nenhum arquivo foi alterado."
      : transientAi
        ? "A IA externa demorou ou ficou indisponível mesmo após novas tentativas. O MSK preservou o projeto sem aplicar saída incompleta; envie o mesmo comando novamente."
        : aiErr
          ? "A inteligência MSK não conseguiu estruturar uma edição válida. Nenhuma alteração insegura foi aplicada."
          : targetErr
            ? "O MSK não encontrou com segurança o arquivo certo para essa alteração. Informe o texto, tela ou componente alvo."
            : changeErr
              ? "A edição foi recusada pela validação final porque não estava segura ou completa. Nenhum arquivo foi quebrado."
              : "O MSK não conseguiu concluir esta operação. Nenhuma alteração parcial foi marcada como concluída.";
    console.error("MSK internal", rawError);
    if (taskId && taskUserId) await taskPatch(taskId, { status: "failed", error: message }, taskUserId);
    return json({ error: message, code: ghErr ? "GITHUB_TEMPORARILY_UNAVAILABLE" : transientAi ? "MSK_AI_TEMPORARILY_UNAVAILABLE" : aiErr ? "MSK_AI_RESPONSE_INVALID" : targetErr ? "MSK_TARGET_NOT_FOUND" : changeErr ? "MSK_NO_SAFE_CHANGES" : "MSK_AGENT_ERROR", task_id: taskId || undefined }, transientAi ? 503 : 500);
  }
});
