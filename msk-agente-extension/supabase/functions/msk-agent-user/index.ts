import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
const encoder = new TextEncoder();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = async (value: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
const bearer = (req: Request) => (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

async function currentUser(req: Request) {
  const token = bearer(req);
  if (!token || token.startsWith("sb_publishable_")) return null;
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data.user;
}

async function sessionMatches(projectId: string, token: string) {
  if (!token) return false;
  const { data } = await db.from("msk_projects").select("session_token_hash").eq("lovable_project_id", projectId).maybeSingle();
  return !!data?.session_token_hash && data.session_token_hash === await sha256(token);
}

async function claimProjectForUser(projectId: string, userId: string, sessionToken: string) {
  if (!await sessionMatches(projectId, sessionToken)) return { ok: false as const, code: "MSK_SESSION_REQUIRED" };
  const { data: project } = await db.from("msk_projects")
    .select("user_id,github_installation_id")
    .eq("lovable_project_id", projectId)
    .maybeSingle();
  if (!project?.github_installation_id) return { ok: false as const, code: "GITHUB_NOT_CONNECTED" };
  if (project.user_id && String(project.user_id) !== userId) return { ok: false as const, code: "PROJECT_OWNERSHIP_MISMATCH" };

  const installationId = Number(project.github_installation_id);
  const { data: existingInstallation } = await db.from("msk_github_installations")
    .select("user_id")
    .eq("installation_id", installationId)
    .maybeSingle();
  if (existingInstallation?.user_id && String(existingInstallation.user_id) !== userId) {
    return { ok: false as const, code: "GITHUB_INSTALLATION_OWNERSHIP_MISMATCH" };
  }

  const now = new Date().toISOString();
  await db.from("msk_projects").update({ user_id: userId, updated_at: now }).eq("lovable_project_id", projectId);
  const { error } = await db.from("msk_github_installations").upsert({
    user_id: userId,
    installation_id: installationId,
    revoked_at: null,
    last_validated_at: now,
    updated_at: now
  }, { onConflict: "installation_id" });
  if (error) return { ok: false as const, code: "GITHUB_INSTALLATION_BIND_FAILED" };
  return { ok: true as const, installationId };
}

async function ownedProject(projectId: string, userId: string) {
  const { data } = await db.from("msk_projects")
    .select("user_id,github_installation_id")
    .eq("lovable_project_id", projectId)
    .maybeSingle();
  if (!data) return { ok: true as const, project: null };
  if (data.user_id && String(data.user_id) !== userId) return { ok: false as const, code: "PROJECT_OWNERSHIP_MISMATCH" };
  if (data.user_id && data.github_installation_id) {
    const { data: installation } = await db.from("msk_github_installations")
      .select("user_id,revoked_at")
      .eq("installation_id", Number(data.github_installation_id))
      .maybeSingle();
    if (installation?.user_id && String(installation.user_id) !== userId) return { ok: false as const, code: "GITHUB_INSTALLATION_OWNERSHIP_MISMATCH" };
    if (installation?.revoked_at) return { ok: false as const, code: "GITHUB_RECONNECT_REQUIRED" };
  }
  return { ok: true as const, project: data };
}

async function callCore(req: Request, action: string, body: any, overrideBody?: any) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": req.headers.get("apikey") || SERVICE_ROLE
  };
  const auth = req.headers.get("authorization");
  const session = req.headers.get("x-msk-session");
  if (auth) headers.Authorization = auth;
  if (session) headers["x-msk-session"] = session;
  return fetch(`${SUPABASE_URL}/functions/v1/msk-agent?action=${encodeURIComponent(action)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(overrideBody ?? body)
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "status";
  if (action === "health") return json({ ok: true, service: "msk-agent-user", version: "1.0.0", multi_user: true });

  const user = await currentUser(req);
  if (!user) return json({ error: "Entre na sua conta MSK para usar o GitHub.", code: "MSK_ACCOUNT_REQUIRED" }, 401);
  const userId = String(user.id);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.lovable_project_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ error: "ID de projeto inválido." }, 400);
  const sessionToken = String(req.headers.get("x-msk-session") || "");

  const ownership = await ownedProject(projectId, userId);
  if (!ownership.ok) return json({ connected: false, error: "Esta conexão GitHub pertence a outra conta MSK.", code: ownership.code }, 403);

  if (ownership.project && !ownership.project.user_id && sessionToken) {
    const claim = await claimProjectForUser(projectId, userId, sessionToken);
    if (!claim.ok && claim.code !== "GITHUB_NOT_CONNECTED") {
      return json({ connected: false, error: "Não foi possível confirmar que esta conexão GitHub pertence à sua conta MSK.", code: claim.code }, 403);
    }
  }

  if (action === "connect") {
    const afterClaim = await ownedProject(projectId, userId);
    if (!afterClaim.ok) return json({ connected: false, error: "Esta conexão GitHub pertence a outra conta MSK.", code: afterClaim.code }, 403);

    const { data: userInstallations } = await db.from("msk_github_installations")
      .select("installation_id")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .limit(1);
    const hasOwnInstallation = !!userInstallations?.length;
    const safeBody = hasOwnInstallation ? body : { ...body, repository_url: "" };

    const core = await callCore(req, action, body, safeBody);
    const text = await core.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `Falha HTTP ${core.status}` }; }

    const returnedSession = String(data?.session_token || "");
    if (returnedSession) {
      const claim = await claimProjectForUser(projectId, userId, returnedSession);
      if (!claim.ok) {
        await db.from("msk_projects").update({ session_token_hash: null }).eq("lovable_project_id", projectId).is("user_id", null);
        return json({ connected: false, error: "A conexão GitHub não pôde ser atribuída com segurança à sua conta MSK. Autorize o GitHub novamente.", code: claim.code }, 403);
      }
    }

    return new Response(JSON.stringify(data), { status: core.status, headers: cors });
  }

  if (action !== "chat") {
    const latest = await ownedProject(projectId, userId);
    if (!latest.ok || !latest.project?.user_id) return json({ connected: false, error: "Conecte o seu GitHub nesta conta MSK.", code: "GITHUB_RECONNECT_REQUIRED" }, 401);
  }

  const core = await callCore(req, action, body);
  const text = await core.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `Falha HTTP ${core.status}` }; }

  const taskId = String(data?.task_id || body?.task_id || "");
  if (/^[0-9a-f-]{36}$/i.test(taskId)) {
    await db.from("msk_tasks").update({ user_id: userId }).eq("id", taskId).eq("lovable_project_id", projectId).is("user_id", null);
    const { data: task } = await db.from("msk_tasks").select("user_id").eq("id", taskId).maybeSingle();
    if (task?.user_id && String(task.user_id) !== userId) return json({ error: "Esta tarefa pertence a outra conta MSK.", code: "TASK_OWNERSHIP_MISMATCH" }, 403);
  }

  return new Response(JSON.stringify(data), { status: core.status, headers: cors });
});