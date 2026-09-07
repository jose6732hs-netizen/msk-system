import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptToken, findLicenseByToken } from "@/lib/license.server";
import { resolveLicenseScope } from "@/lib/license-scope.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const CALLBACK_URL = "https://msksystem.online/api/public/lv-supabase/callback";
const AUTHORIZE_URL = "https://api.supabase.com/v1/oauth/authorize";
const TOKEN_URL = "https://api.supabase.com/v1/oauth/token";
const MANAGEMENT = "https://api.supabase.com/v1";

type Credential = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  selectedProjectRef?: string | null;
};

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function randomString(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}

function base64Url(data: Uint8Array) {
  let raw = "";
  for (const byte of data) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(hash));
}

function textToBytea(value: string) {
  return `\\x${Array.from(new TextEncoder().encode(value)).map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function byteaToText(value: unknown) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("\\x")) return value;
  const hex = value.slice(2);
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder().decode(bytes);
}

async function validateAgentLicense(body: any) {
  const token = String(body?.license || body?.token || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  if (!token || !email) return { ok: false as const, status: 401, error: "LICENSE_REQUIRED" };
  const license = await findLicenseByToken(token) as any;
  if (!license) return { ok: false as const, status: 401, error: "LICENSE_INVALID" };
  const status = String(license.status || "").toLowerCase();
  if (status !== "active") return { ok: false as const, status: 403, error: "LICENSE_INACTIVE" };
  if (license.expires_at && new Date(license.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, status: 403, error: "LICENSE_EXPIRED" };
  }
  const scope = await resolveLicenseScope(license, "agent");
  if (scope.scope !== "agent" && scope.scope !== "extension") {
    return { ok: false as const, status: 403, error: "LICENSE_PRODUCT_MISMATCH" };
  }
  const { data } = await supabaseAdmin.auth.admin.getUserById(String(license.user_id));
  const accountEmail = String(data?.user?.email || "").trim().toLowerCase();
  if (accountEmail && accountEmail !== email) return { ok: false as const, status: 403, error: "LICENSE_EMAIL_MISMATCH" };
  return { ok: true as const, userId: String(license.user_id), licenseId: String(license.id) };
}

async function latestConnection(userId: string) {
  const { data } = await supabaseAdmin
    .from("agent_connections")
    .select("id,user_id,connector_id,credential_ciphertext,provider_user_id,scopes,revoked_at,updated_at")
    .eq("user_id", userId)
    .eq("connector_id", "supabase")
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as any;
}

async function readCredential(connection: any): Promise<Credential | null> {
  if (!connection?.credential_ciphertext) return null;
  const encrypted = byteaToText(connection.credential_ciphertext);
  const plain = await decryptToken(encrypted);
  if (!plain) return null;
  try { return JSON.parse(plain) as Credential; } catch { return null; }
}

async function writeCredential(connectionId: string, credential: Credential) {
  const encrypted = await encryptToken(JSON.stringify(credential));
  const { error } = await supabaseAdmin
    .from("agent_connections")
    .update({ credential_ciphertext: textToBytea(encrypted), last_validated_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
    .eq("id", connectionId);
  if (error) throw error;
}

function oauthConfig() {
  const clientId = String(process.env["SUPABASE_OAUTH_CLIENT_ID"] || "").trim();
  const clientSecret = String(process.env["SUPABASE_OAUTH_CLIENT_SECRET"] || "").trim();
  return { clientId, clientSecret };
}

async function exchangeToken(params: URLSearchParams) {
  const { clientId, clientSecret } = oauthConfig();
  if (!clientId || !clientSecret) throw new Error("SUPABASE_OAUTH_NOT_CONFIGURED");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: params,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((data as any)?.error_description || (data as any)?.error || `OAuth HTTP ${response.status}`));
  return data as any;
}

async function ensureFresh(connection: any, credential: Credential) {
  if (!credential.expires_at || credential.expires_at - Date.now() > 120_000) return credential;
  if (!credential.refresh_token) return credential;
  const refreshed = await exchangeToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: credential.refresh_token }));
  const next: Credential = {
    access_token: String(refreshed.access_token || ""),
    refresh_token: String(refreshed.refresh_token || credential.refresh_token || ""),
    expires_at: Date.now() + Math.max(60, Number(refreshed.expires_in || 3600)) * 1000,
    selectedProjectRef: credential.selectedProjectRef || null,
  };
  await writeCredential(String(connection.id), next);
  return next;
}

async function managementFetch(connection: any, credential: Credential, path: string, init: RequestInit = {}) {
  let current = await ensureFresh(connection, credential);
  const call = () => fetch(`${MANAGEMENT}${path}`, {
    ...init,
    headers: { Accept: "application/json", Authorization: `Bearer ${current.access_token}`, ...(init.headers || {}) },
  });
  let response = await call();
  if (response.status === 401 && current.refresh_token) {
    current = await ensureFresh(connection, { ...current, expires_at: 0 });
    response = await call();
  }
  return { response, credential: current };
}

async function listProjects(connection: any, credential: Credential) {
  const { response } = await managementFetch(connection, credential, "/projects");
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(String((data as any)?.message || (data as any)?.error || `Supabase HTTP ${response.status}`));
  const rows = Array.isArray(data) ? data : (data as any)?.projects || (data as any)?.data || [];
  return rows.map((row: any) => ({
    id: String(row.id || row.ref || ""),
    ref: String(row.ref || row.id || ""),
    name: String(row.name || row.ref || row.id || "Projeto Supabase"),
    organization_id: row.organization_id || row.organization?.id || null,
    status: row.status || null,
  })).filter((row: any) => row.ref);
}

export const Route = createFileRoute("/api/public/lv-supabase")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({})) as any;
        const auth = await validateAgentLicense(body);
        if (!auth.ok) return respond({ ok: false, error: auth.error }, auth.status);
        const action = String(body.action || "status").toLowerCase();

        if (action === "oauth_url") {
          const { clientId, clientSecret } = oauthConfig();
          if (!clientId || !clientSecret) {
            return respond({ ok: false, error: "SUPABASE_OAUTH_NOT_CONFIGURED", message: "A integração OAuth do Supabase ainda não foi cadastrada no servidor MSK." }, 503);
          }
          const state = randomString(32);
          const verifier = randomString(48);
          const challenge = await sha256Base64Url(verifier);
          const encryptedPending = await encryptToken(JSON.stringify({ verifier, createdAt: Date.now() }));
          await supabaseAdmin.from("agent_connections").delete().eq("user_id", auth.userId).eq("connector_id", "supabase_pending");
          const { error } = await supabaseAdmin.from("agent_connections").insert({
            user_id: auth.userId,
            connector_id: "supabase_pending",
            credential_ciphertext: textToBytea(encryptedPending),
            provider_user_id: state,
            scopes: ["projects:read", "database:read", "database:write"],
            last_validated_at: new Date().toISOString(),
          } as never);
          if (error) return respond({ ok: false, error: "OAUTH_STATE_STORE_FAILED", message: error.message }, 500);
          const url = new URL(AUTHORIZE_URL);
          url.searchParams.set("response_type", "code");
          url.searchParams.set("client_id", clientId);
          url.searchParams.set("redirect_uri", CALLBACK_URL);
          url.searchParams.set("state", state);
          url.searchParams.set("code_challenge", challenge);
          url.searchParams.set("code_challenge_method", "S256");
          return respond({ ok: true, url: url.toString() });
        }

        if (action === "status") {
          const connection = await latestConnection(auth.userId);
          return respond({ ok: true, authorized: !!connection, connected: !!connection });
        }

        if (action === "disconnect") {
          await supabaseAdmin.from("agent_connections").update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq("user_id", auth.userId).eq("connector_id", "supabase").is("revoked_at", null);
          return respond({ ok: true, connected: false });
        }

        const connection = await latestConnection(auth.userId);
        if (!connection) return respond({ ok: false, error: "SUPABASE_NOT_CONNECTED", message: "Conecte sua conta Supabase primeiro." }, 409);
        let credential = await readCredential(connection);
        if (!credential?.access_token) return respond({ ok: false, error: "SUPABASE_CREDENTIAL_INVALID" }, 409);

        if (action === "projects") {
          try { return respond({ ok: true, projects: await listProjects(connection, credential) }); }
          catch (error) { return respond({ ok: false, error: "SUPABASE_PROJECTS_FAILED", message: String((error as Error).message) }, 502); }
        }

        if (action === "connect") {
          const ref = String(body.projectRef || "").trim();
          if (!ref) return respond({ ok: false, error: "PROJECT_REQUIRED" }, 400);
          const projects = await listProjects(connection, credential);
          const project = projects.find((row: any) => row.ref === ref);
          if (!project) return respond({ ok: false, error: "PROJECT_NOT_AUTHORIZED" }, 403);
          credential = { ...credential, selectedProjectRef: ref };
          await writeCredential(String(connection.id), credential);
          return respond({ ok: true, connected: true, project });
        }

        if (action === "sql") {
          const ref = String(body.projectRef || credential.selectedProjectRef || "").trim();
          const sql = String(body.sql || "").trim();
          if (!ref || !sql) return respond({ ok: false, error: "PROJECT_AND_SQL_REQUIRED" }, 400);
          if (!body.allowDestructive && /\b(drop\s+(table|schema|database)|truncate\s+|disable\s+row\s+level\s+security|delete\s+from\s+\S+\s*;?\s*$)\b/i.test(sql)) {
            return respond({ ok: false, error: "DESTRUCTIVE_SQL_BLOCKED", message: "Operação destrutiva bloqueada pela proteção MSK." }, 403);
          }
          const { response } = await managementFetch(connection, credential, `/projects/${encodeURIComponent(ref)}/database/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: sql, read_only: false }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) return respond({ ok: false, error: "SUPABASE_SQL_FAILED", message: String((data as any)?.message || (data as any)?.error || `HTTP ${response.status}`) }, response.status);
          return respond({ ok: true, result: data });
        }

        return respond({ ok: false, error: "UNKNOWN_ACTION" }, 400);
      },
    },
  },
});
