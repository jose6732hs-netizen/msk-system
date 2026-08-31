import { cors, json, env, db, dec, sha, identity, verifyDevice } from "./common.ts";
import { makeState, readState, installation, instToken, gh, validSession, chooseRepo } from "./github.ts";
import { ask, parse, b64utf, directCommit } from "./ai.ts";

const safePath = (p: string) => typeof p === "string" && !p.includes("..") && !p.startsWith("/");
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
  const unique = [...new Set(exact)].slice(0, 12);
  return unique.length ? unique : selectFallbackFiles(paths, command);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  let taskId = "";
  try {
    if (req.method === "POST" && url.searchParams.get("action") === "health") {
      return json({ ok: true, service: "msk-agent", version: "2.7.0-resilient-edit-progress", device_guard: "staged" });
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
    const { data: proj } = await db.from("msk_projects").select("*").eq("lovable_project_id", pid).maybeSingle();
    if (proj?.user_id && String(proj.user_id) !== who.id) return json({ connected: false, code: "PROJECT_OWNERSHIP_MISMATCH", error: "Este projeto pertence a outra licença MSK." }, 403);

    if (action === "connect") {
      if (proj?.github_installation_id) {
        const s = req.headers.get("x-msk-session") || "";
        if (await validSession(pid, s)) return json({ ok: true, connected: true, repository: proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : "" });
        const ns = crypto.randomUUID() + crypto.randomUUID();
        await db.from("msk_projects").update({ session_token_hash: await sha(ns), updated_at: new Date().toISOString() }).eq("lovable_project_id", pid).eq("user_id", who.id);
        return json({ ok: true, connected: true, session_recovered: true, session_token: ns, repository: proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : "" });
      }
      const ret = /^https:\/\/lovable\.dev\/projects\//.test(String(body.page_url || body.return_url || "")) ? String(body.page_url || body.return_url) : `https://lovable.dev/projects/${pid}`;
      const repo = String(body.repository_url || "").replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
      const state = await makeState(pid, ret, repo, who.id);
      return json({ ok: true, connected: false, requires_github_authorization: true, recovery_state: state, authorize_url: `https://github.com/apps/${env("GITHUB_APP_SLUG")}/installations/new?state=${encodeURIComponent(state)}`, repository: repo });
    }

    if (action === "status") {
      if (!proj?.github_installation_id) return json({ ok: true, connected: false });
      const ins = await installation(Number(proj.github_installation_id));
      if (!ins) return json({ ok: true, connected: false });
      const repo = proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : "", s = req.headers.get("x-msk-session") || "";
      if (await validSession(pid, s)) return json({ ok: true, connected: true, installation_known: true, repository: repo });
      const ns = crypto.randomUUID() + crypto.randomUUID();
      await db.from("msk_projects").update({ session_token_hash: await sha(ns), updated_at: new Date().toISOString() }).eq("lovable_project_id", pid).eq("user_id", who.id);
      return json({ ok: true, connected: true, installation_known: true, session_recovered: true, session_token: ns, repository: repo });
    }

    if (action === "bind-existing") {
      const iid = Number(body.installation_id || 0), rs = String(body.recovery_state || "");
      if (!iid || !rs) return json({ connected: false, code: "RECOVERY_STATE_REQUIRED" }, 401);
      const st = await readState(rs);
      if (st.projectId !== pid || String(st.userId || "") !== who.id) return json({ connected: false, code: "RECOVERY_IDENTITY_MISMATCH" }, 403);
      const ins = await installation(iid);
      if (!ins) return json({ connected: false }, 404);
      const repo = String(st.repository || body.repository_url || "").replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
      let owner = proj?.github_owner || null, name = proj?.github_repo || null, branch = proj?.github_default_branch || null;
      if (repo) {
        const t = await instToken(iid), d = await gh(t, "/installation/repositories?per_page=100"), m = (d.repositories || []).find((r: any) => String(r.full_name).toLowerCase() === repo.toLowerCase());
        if (!m) return json({ connected: false, code: "REPOSITORY_NOT_AUTHORIZED" }, 403);
        owner = m.owner.login; name = m.name; branch = m.default_branch;
      }
      const session = crypto.randomUUID() + crypto.randomUUID(), now = new Date().toISOString();
      const p = await db.from("msk_projects").upsert({ lovable_project_id: pid, user_id: who.id, github_installation_id: iid, github_owner: owner, github_repo: name, github_default_branch: branch, session_token_hash: await sha(session), connected_at: now, updated_at: now });
      if (p.error) throw p.error;
      await db.from("msk_github_installations").upsert({ user_id: who.id, installation_id: iid, account_login: String(ins?.account?.login || "") || null, account_type: String(ins?.account?.type || "") || null, revoked_at: null, last_validated_at: now, updated_at: now }, { onConflict: "installation_id" });
      return json({ ok: true, connected: true, recovered_existing_installation: true, installation_id: iid, session_token: session, repository: owner && name ? `${owner}/${name}` : repo });
    }

    if (action === "chat") {
      const msg = String(body.message || body.command || "").trim();
      if (!msg) return json({ error: "Mensagem vazia." }, 400);
      const a = await ask(req, `Você é o MSK Agente. Responda em português do Brasil de forma objetiva e profissional. Não afirme que editou código se apenas respondeu. Cliente: ${msg}`, false, 3000);
      return json({ ok: true, connected: true, mode: "chat", no_edit: true, assistant_message: a.text.trim(), message: a.text.trim(), response_id: a.id, model: "MSK-IA", provider: "MSK" });
    }

    const s = req.headers.get("x-msk-session") || "";
    if (!await validSession(pid, s)) return json({ error: "Sessão de edição MSK ainda não autorizada.", code: "MSK_SESSION_REQUIRED", connected: false }, 401);

    if (action === "task-status") {
      const id = String(body.task_id || "");
      const { data: t } = await db.from("msk_tasks").select("id,status,summary,error,branch_name,pull_request_url,updated_at").eq("id", id).eq("lovable_project_id", pid).maybeSingle();
      return t ? json({ ok: true, task: t }) : json({ ok: false }, 404);
    }

    if (!proj?.github_installation_id) return json({ connected: false });
    const sel = await chooseRepo(Number(proj.github_installation_id), String(body.project_name || proj.project_name || ""), proj.github_owner && proj.github_repo ? `${proj.github_owner}/${proj.github_repo}` : String(body.repository_url || ""));
    if (!sel.repo) return json({ connected: false, requires_repository_selection: true, repositories: sel.candidates });

    if (action === "approve") {
      const id = String(body.task_id || ""), { data: t } = await db.from("msk_tasks").select("id,status,pull_request_url,summary").eq("id", id).eq("lovable_project_id", pid).maybeSingle();
      if (!t?.pull_request_url) return json({ error: "Pull Request não encontrado." }, 404);
      const n = Number(t.pull_request_url.match(/\/pull\/(\d+)/)?.[1]);
      const m = await gh(sel.token, `/repos/${sel.repo.owner.login}/${sel.repo.name}/pulls/${n}/merge`, { method: "PUT", body: JSON.stringify({ commit_title: `MSK: ${String(t.summary || "alteração aprovada").slice(0, 70)}`, merge_method: "squash" }) });
      if (!m?.merged) return json({ error: m?.message || "Merge recusado." }, 409);
      await db.from("msk_tasks").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true, completed: true, message: "Alteração aplicada no repositório." });
    }

    if (action !== "run") return json({ error: "Ação não suportada.", code: "ACTION_NOT_SUPPORTED" }, 400);
    const cmd = String(body.original_command || body.message || body.command || "").trim();
    if (!cmd) return json({ error: "Comando vazio." }, 400);

    taskId = /^[0-9a-f-]{36}$/i.test(String(body.task_id || "")) ? String(body.task_id) : crypto.randomUUID();
    await db.from("msk_tasks").insert({ id: taskId, lovable_project_id: pid, user_id: who.id, command: cmd, status: "analyzing" });

    const o = sel.repo.owner.login, r = sel.repo.name, b = sel.repo.default_branch;
    const tree = await gh(sel.token, `/repos/${o}/${r}/git/trees/${encodeURIComponent(b).replace(/%2F/g, "/")}?recursive=1`);
    const paths = (tree.tree || []).filter((x: any) => x.type === "blob" && /\.(tsx?|jsx?|css|json|md|sql)$/.test(x.path)).slice(0, 800).map((x: any) => String(x.path));
    if (!paths.length) throw new Error("MSK_NO_EDITABLE_FILES");

    let pick: any = {};
    try {
      const selection = await ask(req, `Selecione até 12 arquivos estritamente necessários para este pedido. Responda SOMENTE JSON válido no formato {"files":["path"]}. Não invente caminhos. Pedido: ${cmd}\nArquivos:\n${paths.join("\n")}`, true, 2500);
      pick = parse(selection.text);
    } catch (e) {
      console.warn("MSK file selection fallback", e instanceof Error ? e.message : "invalid");
    }
    const chosen = resolveChosenFiles(paths, pick, cmd);
    if (!chosen.length) throw new Error("MSK_NO_SAFE_TARGET_FILES");

    await db.from("msk_tasks").update({ status: "editing", updated_at: new Date().toISOString() }).eq("id", taskId);
    const files = await Promise.all(chosen.map(async (path: string) => {
      const x = await gh(sel.token, `/repos/${o}/${r}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(b)}`);
      return { path, sha: x.sha, content: dec.decode(Uint8Array.from(atob(x.content.replace(/\n/g, "")), c => c.charCodeAt(0))) };
    }));

    await db.from("msk_tasks").update({ status: "refining", updated_at: new Date().toISOString() }).eq("id", taskId);
    const editResponse = await ask(req, `Edite somente o necessário e preserve tudo que já funciona. O pedido do cliente tem prioridade. Responda SOMENTE JSON válido: {"summary":"resumo objetivo","reply":"resposta ao cliente","changes":[{"path":"caminho existente","content":"arquivo completo"}]}. Não use markdown. Pedido: ${cmd}\n${files.map(f => `--- ${f.path}\n${f.content}`).join("\n")}`, true, 50000);
    const out = parse(editResponse.text);
    const pathMap = new Map(paths.map(p => [p.toLowerCase(), p]));
    const changes = (Array.isArray(out.changes) ? out.changes : [])
      .map((c: any) => ({ ...c, path: pathMap.get(String(c?.path || "").toLowerCase()) || String(c?.path || "") }))
      .filter((c: any) => safePath(c.path) && pathMap.has(String(c.path).toLowerCase()) && typeof c.content === "string" && c.content.length > 0)
      .slice(0, 12);
    if (!changes.length) throw new Error("MSK_AI_NO_VALID_CHANGES");

    await db.from("msk_tasks").update({ status: "finalizing", summary: String(out.summary || "").slice(0, 2000), updated_at: new Date().toISOString() }).eq("id", taskId);
    const msg = `MSK: ${String(out.summary || cmd).slice(0, 70)}`;

    if (body.direct_commit !== false) {
      try {
        const c = await directCommit(sel.token, o, r, b, changes, msg);
        await db.from("msk_tasks").update({ status: "completed", branch_name: b, summary: out.summary, error: null, updated_at: new Date().toISOString() }).eq("id", taskId);
        return json({ ok: true, completed: true, direct_commit: true, assistant_message: String(out.reply || out.summary || "Alteração aplicada."), summary: String(out.summary || ""), model: "MSK-IA", provider: "MSK", task_id: taskId, repository: `${o}/${r}`, branch: b, files: changes.map((x: any) => x.path), commit_sha: c.sha, commit_url: c.html_url || `https://github.com/${o}/${r}/commit/${c.sha}` });
      } catch (e) {
        console.warn("direct commit fallback", e instanceof Error ? e.message : "unknown");
      }
    }

    const bn = `msk/${taskId.slice(0, 8)}`;
    const ref = await gh(sel.token, `/repos/${o}/${r}/git/ref/heads/${encodeURIComponent(b).replace(/%2F/g, "/")}`);
    await gh(sel.token, `/repos/${o}/${r}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${bn}`, sha: ref.object.sha }) });
    for (const c of changes) {
      const old = files.find(f => f.path === c.path);
      await gh(sel.token, `/repos/${o}/${r}/contents/${encodeURIComponent(c.path).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ message: msg, content: b64utf(c.content), branch: bn, ...(old?.sha ? { sha: old.sha } : {}) }) });
    }
    const pr = await gh(sel.token, `/repos/${o}/${r}/pulls`, { method: "POST", body: JSON.stringify({ title: msg, head: bn, base: b, body: `Alteração preparada pelo MSK.\n\n${out.summary || ""}` }) });
    await db.from("msk_tasks").update({ status: "awaiting_approval", branch_name: bn, pull_request_url: pr.html_url, summary: out.summary, updated_at: new Date().toISOString() }).eq("id", taskId);
    return json({ ok: true, requires_approval: true, assistant_message: String(out.reply || out.summary || "Alteração preparada."), summary: String(out.summary || ""), model: "MSK-IA", provider: "MSK", repository: `${o}/${r}`, branch: bn, files: changes.map((x: any) => x.path), task_id: taskId, pull_request_url: pr.html_url });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Falha inesperada.";
    const ghErr = /GITHUB_APP_CREDENTIALS_INVALID|PRIVATE|ASN\.?1|pkcs|rsa|incorrect length|GitHub installation token failed/i.test(raw);
    const aiErr = /MSK_AI_|BAI_API_KEY|api_key/i.test(raw);
    const targetErr = /MSK_NO_EDITABLE_FILES|MSK_NO_SAFE_TARGET_FILES/i.test(raw);
    const changeErr = /MSK_AI_NO_VALID_CHANGES/i.test(raw);
    const message = ghErr
      ? "Não foi possível concluir a conexão com o GitHub agora. Tente novamente em instantes."
      : aiErr
        ? "A inteligência MSK não conseguiu estruturar esta edição. Tente novamente; o pedido foi preservado."
        : targetErr
          ? "O MSK não encontrou com segurança o arquivo certo para essa alteração. Diga qual texto ou tela deseja mudar."
          : changeErr
            ? "A IA analisou o projeto, mas não produziu uma alteração segura para aplicar. Tente detalhar o elemento que deseja mudar."
            : "O MSK não conseguiu concluir esta operação agora. Tente novamente.";
    console.error("MSK internal", raw);
    if (taskId) await db.from("msk_tasks").update({ status: "failed", error: message, updated_at: new Date().toISOString() }).eq("id", taskId);
    return json({ error: message, code: ghErr ? "GITHUB_TEMPORARILY_UNAVAILABLE" : aiErr ? "MSK_AI_RESPONSE_INVALID" : targetErr ? "MSK_TARGET_NOT_FOUND" : changeErr ? "MSK_NO_SAFE_CHANGES" : "MSK_AGENT_ERROR" }, 500);
  }
});
