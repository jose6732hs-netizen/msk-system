import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Secret ausente: ${name}`); return value; };
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = async (value: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
const hmac = async (value: string) => {
  const key = await crypto.subtle.importKey("raw", enc.encode(env("MSK_STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value))));
};
const makeState = async (projectId: string, returnUrl: string, repository: string, userId: string) => {
  const payload = b64url(enc.encode(JSON.stringify({ projectId, returnUrl, repository, userId, exp: Date.now() + 15 * 60_000 })));
  return `${payload}.${await hmac(payload)}`;
};
const identityFromLicense = async (req: Request) => {
  const token = (req.headers.get("authorization") || req.headers.get("x-msk-license") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.startsWith("sb_publishable_")) return null;
  for (const origin of ["https://msksystem.online", "https://msk-system.lovable.app"]) {
    try {
      const response = await fetch(`${origin}/api/extension/license-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      const userId = String(data?.user_id || "").trim();
      if (data?.ok === true && data?.active === true && /^[0-9a-f-]{36}$/i.test(userId)) return { userId, licenseId: String(data?.license_id || "") };
    } catch {}
  }
  return null;
};
const validSession = async (projectId: string, token: string) => {
  if (!token) return false;
  const { data } = await db.from("msk_projects").select("session_token_hash").eq("lovable_project_id", projectId).maybeSingle();
  return !!data?.session_token_hash && data.session_token_hash === await sha256(token);
};
const normalizeRepo = (value: unknown) => String(value || "").trim().replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const action = new URL(req.url).searchParams.get("action") || "status";
  if (action === "health") return json({ ok: true, service: "msk-agent-license", version: "1.0.0", license_identity: true });

  const identity = await identityFromLicense(req);
  if (!identity) return json({ ok: false, connected: false, code: "LICENSE_REQUIRED", error: "Valide uma licença MSK ativa para conectar o GitHub." }, 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.lovable_project_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ ok: false, code: "PROJECT_REQUIRED", error: "Projeto Lovable inválido." }, 400);
  const userId = identity.userId;
  const { data: project } = await db.from("msk_projects").select("user_id,github_installation_id,session_token_hash,github_owner,github_repo,project_name").eq("lovable_project_id", projectId).maybeSingle();
  if (project?.user_id && String(project.user_id) !== userId) return json({ ok: false, connected: false, code: "PROJECT_OWNERSHIP_MISMATCH", error: "Este projeto está vinculado a outra licença MSK." }, 403);

  if (action === "status") {
    if (!project?.github_installation_id) return json({ ok: true, connected: false });
    const session = req.headers.get("x-msk-session") || "";
    const repository = project.github_owner && project.github_repo ? `${project.github_owner}/${project.github_repo}` : "";
    if (!session || !await validSession(projectId, session)) return json({ ok: true, connected: false, installation_known: true, needs_session_recovery: true, repository });
    return json({ ok: true, connected: true, installation_known: true, repository });
  }

  if (action !== "connect") return json({ ok: false, code: "ACTION_NOT_SUPPORTED" }, 400);
  const currentSession = req.headers.get("x-msk-session") || "";
  if (project?.github_installation_id && currentSession && await validSession(projectId, currentSession)) {
    return json({ ok: true, connected: true, repository: project.github_owner && project.github_repo ? `${project.github_owner}/${project.github_repo}` : "" });
  }

  const returnUrl = /^https:\/\/lovable\.dev\/projects\//.test(String(body?.return_url || body?.page_url || ""))
    ? String(body?.return_url || body?.page_url)
    : `https://lovable.dev/projects/${projectId}`;
  const repository = project?.github_owner && project?.github_repo
    ? `${project.github_owner}/${project.github_repo}`
    : normalizeRepo(body?.repository_url || "");
  const state = await makeState(projectId, returnUrl, repository, userId);
  const authorizeUrl = `https://github.com/apps/${env("GITHUB_APP_SLUG")}/installations/new?state=${encodeURIComponent(state)}`;
  return json({ ok: true, connected: false, requires_github_authorization: true, recovery_state: state, authorize_url: authorizeUrl, repository });
});
