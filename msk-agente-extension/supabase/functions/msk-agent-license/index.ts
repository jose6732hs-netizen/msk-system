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
const dec = new TextDecoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), c => c.charCodeAt(0));
const sha256 = async (value: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
const hmac = async (value: string) => {
  const key = await crypto.subtle.importKey("raw", enc.encode(env("MSK_STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value))));
};
const makeState = async (projectId: string, returnUrl: string, repository: string, userId: string) => {
  const payload = b64url(enc.encode(JSON.stringify({ projectId, returnUrl, repository, userId, exp: Date.now() + 15 * 60_000 })));
  return `${payload}.${await hmac(payload)}`;
};
const readState = async (state: string) => {
  const [payload, signature] = String(state || "").split(".");
  if (!payload || !signature || signature !== await hmac(payload)) throw new Error("STATE_INVALID");
  const data = JSON.parse(dec.decode(fromB64url(payload)));
  if (!data?.projectId || !data?.userId || Number(data?.exp || 0) < Date.now()) throw new Error("STATE_EXPIRED");
  return data as { projectId: string; returnUrl: string; repository?: string; userId: string; exp: number };
};
const licenseToken = (req: Request) => (req.headers.get("x-msk-license") || req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
const identityFromLicense = async (req: Request) => {
  const token = licenseToken(req);
  if (!token || token.startsWith("sb_publishable_")) return null;
  for (const origin of ["https://msksystem.online", "https://msk-system.lovable.app", "https://id-preview--2763a21e-c47d-4e62-bc58-ab51fe5dc2d5.lovable.app"]) {
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
const issueSession = async (projectId: string, userId: string) => {
  const session = crypto.randomUUID() + crypto.randomUUID();
  const { error } = await db.from("msk_projects").update({ session_token_hash: await sha256(session), updated_at: new Date().toISOString() }).eq("lovable_project_id", projectId).eq("user_id", userId);
  if (error) throw error;
  return session;
};
const normalizeRepo = (value: unknown) => String(value || "").trim().replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const action = new URL(req.url).searchParams.get("action") || "status";
  if (action === "health") return json({ ok: true, service: "msk-agent-license", version: "1.3.1", license_identity: true, bind_existing: true, silent_session_recovery: true });

  const identity = await identityFromLicense(req);
  if (!identity) return json({ ok: false, connected: false, code: "LICENSE_REQUIRED", error: "Valide uma licença MSK ativa para conectar o GitHub." }, 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.lovable_project_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ ok: false, connected: false, code: "PROJECT_REQUIRED", error: "Projeto Lovable inválido." }, 400);
  const userId = identity.userId;
  const loadProject = async () => (await db.from("msk_projects").select("user_id,github_installation_id,session_token_hash,github_owner,github_repo,project_name").eq("lovable_project_id", projectId).maybeSingle()).data;
  let project = await loadProject();
  if (project?.user_id && String(project.user_id) !== userId) return json({ ok: false, connected: false, code: "PROJECT_OWNERSHIP_MISMATCH", error: "Este projeto está vinculado a outra licença MSK." }, 403);

  if (action === "status") {
    if (!project?.github_installation_id) return json({ ok: true, connected: false });
    const repository = project.github_owner && project.github_repo ? `${project.github_owner}/${project.github_repo}` : "";
    const currentSession = req.headers.get("x-msk-session") || "";
    if (currentSession && await validSession(projectId, currentSession)) return json({ ok: true, connected: true, installation_known: true, repository });
    if (project.user_id && String(project.user_id) === userId) {
      try {
        const sessionToken = await issueSession(projectId, userId);
        return json({ ok: true, connected: true, installation_known: true, session_recovered: true, session_token: sessionToken, repository });
      } catch (error) {
        console.error("MSK silent session recovery failed", error instanceof Error ? error.message : "unknown");
        return json({ ok: false, connected: false, code: "SESSION_RECOVERY_FAILED", error: "Não foi possível recuperar a sessão do GitHub agora." }, 500);
      }
    }
    return json({ ok: true, connected: false, installation_known: true, needs_session_recovery: true, existing_installation_id: Number(project.github_installation_id), repository });
  }

  if (action === "bind-existing") {
    const installationId = Number(body?.installation_id || 0);
    const recoveryState = String(body?.recovery_state || "").trim();
    if (!Number.isInteger(installationId) || installationId <= 0) return json({ ok: false, connected: false, code: "INSTALLATION_INVALID", error: "Instalação GitHub inválida." }, 400);
    if (!recoveryState) return json({ ok: false, connected: false, code: "RECOVERY_STATE_REQUIRED", error: "Confirmação segura da conexão ausente." }, 401);
    let state: { projectId: string; returnUrl: string; repository?: string; userId: string; exp: number };
    try { state = await readState(recoveryState); }
    catch { return json({ ok: false, connected: false, code: "RECOVERY_STATE_INVALID", error: "A confirmação segura do GitHub expirou. Clique em conectar novamente." }, 401); }
    if (state.projectId !== projectId || state.userId !== userId) return json({ ok: false, connected: false, code: "RECOVERY_IDENTITY_MISMATCH", error: "A autorização GitHub não corresponde à licença e ao projeto atuais." }, 403);
    try {
      const coreUrl = `${env("SUPABASE_URL")}/functions/v1/msk-agent?installation_id=${encodeURIComponent(String(installationId))}&setup_action=recover&state=${encodeURIComponent(recoveryState)}`;
      const coreResponse = await fetch(coreUrl, { method: "GET", redirect: "manual" });
      if (!(coreResponse.status >= 300 && coreResponse.status < 400)) {
        const detail = await coreResponse.text().catch(() => "");
        console.error("MSK GitHub bind-existing core failed", coreResponse.status, detail.slice(0, 300));
        return json({ ok: false, connected: false, code: "GITHUB_CONNECTION_TEMPORARY_FAILURE", error: "Não foi possível concluir a conexão com o GitHub agora. Tente novamente em instantes." }, 502);
      }
      const location = String(coreResponse.headers.get("location") || "");
      const match = location.match(/[#&]msk_session=([^&]+)/);
      const sessionToken = match ? decodeURIComponent(match[1]) : "";
      if (!sessionToken) return json({ ok: false, connected: false, code: "SESSION_NOT_RETURNED", error: "A conexão foi autorizada, mas a sessão do projeto não foi concluída." }, 502);
      project = await loadProject();
      if (!project || String(project.user_id || "") !== userId || Number(project.github_installation_id || 0) !== installationId) {
        return json({ ok: false, connected: false, code: "BIND_NOT_PERSISTED", error: "A autorização foi concluída, mas o vínculo ainda não foi gravado." }, 502);
      }
      const repository = project.github_owner && project.github_repo ? `${project.github_owner}/${project.github_repo}` : normalizeRepo(state.repository || body?.repository_url || "");
      return json({ ok: true, connected: true, recovered_existing_installation: true, installation_id: installationId, session_token: sessionToken, repository });
    } catch (error) {
      console.error("MSK GitHub bind-existing unavailable", error instanceof Error ? error.message : "unknown");
      return json({ ok: false, connected: false, code: "GITHUB_CONNECTION_TEMPORARY_FAILURE", error: "Não foi possível concluir a conexão com o GitHub agora. Tente novamente em instantes." }, 502);
    }
  }

  if (action !== "connect") return json({ ok: false, code: "ACTION_NOT_SUPPORTED" }, 400);
  if (project?.github_installation_id && project?.user_id && String(project.user_id) === userId) {
    const currentSession = req.headers.get("x-msk-session") || "";
    if (currentSession && await validSession(projectId, currentSession)) return json({ ok: true, connected: true, repository: project.github_owner && project.github_repo ? `${project.github_owner}/${project.github_repo}` : "" });
    try {
      const sessionToken = await issueSession(projectId, userId);
      return json({ ok: true, connected: true, session_recovered: true, session_token: sessionToken, repository: project.github_owner && project.github_repo ? `${project.github_owner}/${project.github_repo}` : "" });
    } catch {}
  }

  const returnUrl = /^https:\/\/lovable\.dev\/projects\//.test(String(body?.return_url || body?.page_url || "")) ? String(body?.return_url || body?.page_url) : `https://lovable.dev/projects/${projectId}`;
  const repository = project?.github_owner && project?.github_repo ? `${project.github_owner}/${project.github_repo}` : normalizeRepo(body?.repository_url || "");
  const state = await makeState(projectId, returnUrl, repository, userId);
  return json({ ok: true, connected: false, requires_github_authorization: true, recovery_state: state, authorize_url: `https://github.com/apps/${env("GITHUB_APP_SLUG")}/installations/new?state=${encodeURIComponent(state)}`, repository });
});