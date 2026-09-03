from pathlib import Path

path = Path("supabase/functions/msk-agent/index.ts")
s = path.read_text()
original = s


def replace_once(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f"{label} not found")
    s = s.replace(old, new, 1)


replace_once(
    '''      await taskPatch(id, { status: "completed", branch_name: liveBranch, error: null, error_code: null, error_stage: null }, who.id);
      return json({ ok: true, completed: true, preview_pending: true, branch: liveBranch, branch_used: liveBranch, commit_sha: afterSha, commit_url: `https://github.com/${selected.repo.owner.login}/${selected.repo.name}/commit/${afterSha}`, message: `Commit enviado para ${liveBranch} — atualize a prévia no Lovable`, repository: selectedRepo });''',
    '''      await taskPatch(id, { status: "verification_pending", preview_status: "pending", commit_sha: afterSha, branch_name: liveBranch, error: null, error_code: null, error_stage: null }, who.id);
      return json({ ok: true, completed: false, verification_pending: true, preview_pending: true, preview_ready: false, branch: liveBranch, branch_used: liveBranch, commit_sha: afterSha, commit_url: `https://github.com/${selected.repo.owner.login}/${selected.repo.name}/commit/${afterSha}`, message: `Commit criado em ${liveBranch}. Validando a prévia antes de concluir.`, repository: selectedRepo });''',
    "approve completion block",
)

replace_once(
    '    await taskPatch(taskId, { status: "completed", branch_name: usedBranch, summary, error: null, error_code: null, error_stage: null }, who.id);',
    '    await taskPatch(taskId, { status: "verification_pending", preview_status: "pending", commit_sha: commitSha, branch_name: usedBranch, summary, error: null, error_code: null, error_stage: null }, who.id);',
    "normal task completion",
)
replace_once(
    '    const previewMessage = `Commit enviado para ${usedBranch} — atualize a prévia no Lovable`;',
    '    const previewMessage = `Commit criado em ${usedBranch}. Validando a prévia antes de concluir.`;',
    "normal preview message",
)

normal_anchor = '    await taskPatch(taskId, { status: "verification_pending"'
anchor_at = s.index(normal_anchor)
completed_at = s.find('      completed: true,', anchor_at)
if completed_at < 0:
    raise SystemExit("normal response completed flag not found")
s = s[:completed_at] + '      completed: false,\n      verification_pending: true,\n      preview_ready: false,' + s[completed_at + len('      completed: true,'):]

replace_once(
    '      validation: { content_changed: true, semantic: true, commit_verified: true, branch_changed: true },',
    '      validation: { content_changed: true, semantic: true, commit_verified: true, branch_changed: true, preview_verified: false },',
    "normal validation block",
)

marker = '    if (action !== "run") return json({ error: "Ação não suportada.", code: "ACTION_NOT_SUPPORTED" }, 400);'
preview_action = '''    if (action === "preview-confirm") {
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

'''
replace_once(marker, preview_action + marker, "run marker")

if 'version: "3.3.0-direct-main-preview"' in s:
    s = s.replace('version: "3.3.0-direct-main-preview"', 'version: "3.4.0-fail-closed-preview"', 1)
if 'atomic_git_data_commit: true, preview_pending: true });' in s:
    s = s.replace('atomic_git_data_commit: true, preview_pending: true });', 'atomic_git_data_commit: true, preview_pending: true, preview_fail_closed: true });', 1)

for required in [
    'status: "verification_pending"',
    'preview_status: "pending"',
    'action === "preview-confirm"',
    'preview_verified_at: now',
    'completed: false,\n      verification_pending: true',
    'preview_verified: false',
]:
    if required not in s:
        raise SystemExit(f"missing required marker: {required}")
if s == original:
    raise SystemExit("no changes")

path.write_text(s)
print("MSK agent fail-closed patch applied")
