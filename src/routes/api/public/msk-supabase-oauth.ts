import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptToken, findLicenseByToken } from "@/lib/license.server";
import { resolveLicenseScope } from "@/lib/license-scope.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const CALLBACK_URL = "https://msksystem.online/api/public/msk-supabase-oauth";
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

function page(title: string, message: string, ok = false) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{margin:0;background:#050507;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh}.card{width:min(440px,88vw);padding:30px;border-radius:22px;background:#101015;border:1px solid ${ok ? "#39ff88" : "#ff5d7d"};box-shadow:0 20px 80px #0008}h1{font-size:22px;margin:0 0 12px;color:${ok ? "#39ff88" : "#ff7a91"}}p{color:#c6c7cd;line-height:1.55}.small{font-size:12px;color:#777}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p><p class="small">Você pode fechar esta aba e voltar ao MSK Agente.</p></div></body></html>`, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function base64Url(data: Uint8Array) {
  let raw = "";
  for (const byte of data) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function randomString(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}
async function sha256Base64Url(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function oauthConfig() {
  return {
    clientId: String(process.env["SUPABASE_OAUTH_CLIENT_ID"] || "").trim(),
    clientSecret: String(process.env["SUPABASE_OAUTH_CLIENT_SECRET"] || "").trim(),
  };
}

async function validate(body: any) {
  const token = String(body?.license || body?.token || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  if (!token || !email) return { ok: false as const, status: 401, error: "LICENSE_REQUIRED" };
  const license = (await findLicenseByToken(token)) as any;
  if (!license || String(license.status || "").toLowerCase() !== "active") {
    return { ok: false as const, status: 403, error: "LICENSE_INVALID" };
  }
  if (license.expires_at && new Date(license.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, status: 403, error: "LICENSE_EXPIRED" };
  }
  const scope = await resolveLicenseScope(license, "agent");
  if (scope.scope !== "agent" && scope.scope !== "extension") {
    return { ok: false as const, status: 403, error: "LICENSE_PRODUCT_MISMATCH" };
  }
  const { data } = await supabaseAdmin.auth.admin.getUserById(String(license.user_id));
  const accountEmail = String(data?.user?.email || "").trim().toLowerCase();
  if (accountEmail && accountEmail !== email) {
    return { ok: false as const, status: 403, error: "LICENSE_EMAIL_MISMATCH" };
  }
  return { ok: true as const, userId: String(license.user_id) };
}

async function latestConnection(userId: string) {
  const { data } = await supabaseAdmin
    .from("msk_oauth_connections")
    .select("id,user_id,provider,state,encrypted_value,metadata,revoked_at,updated_at")
    .eq("user_id", userId)
    .eq("provider", "supabase")
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as any;
}

async function readCredential(connection: any): Promise<Credential | null> {
  if (!connection?.encrypted_value) return null;
  const plain = await decryptToken(String(connection.encrypted_value));
  try {
    return plain ? (JSON.parse(plain) as Credential) : null;
  } catch {
    return null;
  }
}

async function writeCredential(connectionId: string, credential: Credential) {
  const encrypted = await encryptToken(JSON.stringify(credential));
  const { error } = await supabaseAdmin
    .from("msk_oauth_connections")
    .update({
      encrypted_value: encrypted,
      metadata: { selectedProjectRef: credential.selectedProjectRef || null },
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", connectionId);
  if (error) throw error;
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
  if (!response.ok) {
    throw new Error(String((data as any)?.error_description || (data as any)?.error || `OAuth HTTP ${response.status}`));
  }
  return data as any;
}

async function ensureFresh(connection: any, credential: Credential) {
  if (!credential.expires_at || credential.expires_at - Date.now() > 120_000 || !credential.refresh_token) {
    return credential;
  }
  const refreshed = await exchangeToken(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: credential.refresh_token }),
  );
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
  const call = () =>
    fetch(`${MANAGEMENT}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${current.access_token}`,
        ...(init.headers || {}),
      },
    });
  let response = await call();
  if (response.status === 401 && current.refresh_token) {
    current = await ensureFresh(connection, { ...current, expires_at: 0 });
    response = await call();
  }
  return response;
}

async function listProjects(connection: any, credential: Credential) {
  const response = await managementFetch(connection, credential, "/projects");
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(String((data as any)?.message || (data as any)?.error || `Supabase HTTP ${response.status}`));
  }
  const rows = Array.isArray(data) ? data : (data as any)?.projects || (data as any)?.data || [];
  return rows
    .map((row: any) => ({
      id: String(row.id || row.ref || ""),
      ref: String(row.ref || row.id || ""),
      name: String(row.name || row.ref || row.id || "Projeto Supabase"),
      organization_id: row.organization_id || row.organization?.id || null,
      status: row.status || null,
    }))
    .filter((row: any) => row.ref);
}

export const Route = createFileRoute("/api/public/msk-supabase-oauth")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = String(url.searchParams.get("code") || "");
        const state = String(url.searchParams.get("state") || "");
        const oauthError = String(url.searchParams.get("error_description") || url.searchParams.get("error") || "");
        if (oauthError) return page("Autorização cancelada", oauthError, false);
        if (!code || !state) return page("Autorização inválida", "O retorno do Supabase não contém os dados esperados.", false);

        const { data: pending } = await supabaseAdmin
          .from("msk_oauth_connections")
          .select("id,user_id,encrypted_value,state,created_at")
          .eq("provider", "supabase_pending")
          .eq("state", state)
          .maybeSingle();
        if (!pending) return page("Sessão expirada", "Inicie novamente a conexão pelo botão Conectar Supabase.", false);

        const plain = await decryptToken(String((pending as any).encrypted_value || ""));
        let verifier = "";
        let createdAt = 0;
        try {
          const parsed = JSON.parse(plain || "{}");
          verifier = String(parsed.verifier || "");
          createdAt = Number(parsed.createdAt || 0);
        } catch {}
        if (!verifier || !createdAt || Date.now() - createdAt > 10 * 60_000) {
          await supabaseAdmin.from("msk_oauth_connections").delete().eq("id", (pending as any).id);
          return page("Sessão expirada", "A autorização demorou demais. Inicie novamente pelo MSK Agente.", false);
        }

        const { clientId, clientSecret } = oauthConfig();
        if (!clientId || !clientSecret) {
          return page("Integração indisponível", "O OAuth do Supabase ainda não foi cadastrado no servidor MSK.", false);
        }

        const tokenResponse = await fetch(TOKEN_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: CALLBACK_URL,
            code_verifier: verifier,
          }),
        });
        const tokenData = (await tokenResponse.json().catch(() => ({}))) as any;
        if (!tokenResponse.ok || !tokenData.access_token) {
          return page(
            "Falha ao conectar",
            String(tokenData.error_description || tokenData.error || `OAuth HTTP ${tokenResponse.status}`),
            false,
          );
        }

        const credential: Credential = {
          access_token: String(tokenData.access_token),
          refresh_token: String(tokenData.refresh_token || ""),
          expires_at: Date.now() + Math.max(60, Number(tokenData.expires_in || 3600)) * 1000,
          selectedProjectRef: null,
        };
        const secured = await encryptToken(JSON.stringify(credential));
        await supabaseAdmin
          .from("msk_oauth_connections")
          .update({
            provider: "supabase",
            state: null,
            encrypted_value: secured,
            metadata: { selectedProjectRef: null },
            updated_at: new Date().toISOString(),
            revoked_at: null,
          } as never)
          .eq("id", (pending as any).id);
        await supabaseAdmin
          .from("msk_oauth_connections")
          .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
          .eq("user_id", (pending as any).user_id)
          .eq("provider", "supabase")
          .neq("id", (pending as any).id)
          .is("revoked_at", null);

        return page("Supabase conectado", "Sua conta foi autorizada com sucesso. Volte ao MSK Agente para escolher o projeto.", true);
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as any;
        const auth = await validate(body);
        if (!auth.ok) return respond({ ok: false, error: auth.error }, auth.status);
        const action = String(body.action || "status").toLowerCase();

        if (action === "oauth_url") {
          const { clientId, clientSecret } = oauthConfig();
          if (!clientId || !clientSecret) {
            return respond(
              {
                ok: false,
                error: "SUPABASE_OAUTH_NOT_CONFIGURED",
                message: "OAuth do Supabase ainda não foi configurado no servidor MSK.",
              },
              503,
            );
          }

          const state = randomString(32);
          const verifier = randomString(48);
          const challenge = await sha256Base64Url(verifier);
          const encryptedPending = await encryptToken(JSON.stringify({ verifier, createdAt: Date.now() }));

          await supabaseAdmin
            .from("msk_oauth_connections")
            .delete()
            .eq("user_id", auth.userId)
            .eq("provider", "supabase_pending");

          const { error } = await supabaseAdmin.from("msk_oauth_connections").insert({
            user_id: auth.userId,
            provider: "supabase_pending",
            state,
            encrypted_value: encryptedPending,
            metadata: { scopes: ["projects:read", "database:read", "database:write"] },
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
          await supabaseAdmin
            .from("msk_oauth_connections")
            .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
            .eq("user_id", auth.userId)
            .eq("provider", "supabase")
            .is("revoked_at", null);
          return respond({ ok: true, connected: false });
        }

        const connection = await latestConnection(auth.userId);
        if (!connection) {
          return respond({ ok: false, error: "SUPABASE_NOT_CONNECTED", message: "Conecte sua conta Supabase primeiro." }, 409);
        }
        let credential = await readCredential(connection);
        if (!credential?.access_token) return respond({ ok: false, error: "SUPABASE_CREDENTIAL_INVALID" }, 409);

        if (action === "projects") {
          try {
            return respond({ ok: true, projects: await listProjects(connection, credential) });
          } catch (error) {
            return respond(
              { ok: false, error: "SUPABASE_PROJECTS_FAILED", message: String((error as Error).message) },
              502,
            );
          }
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
          if (
            !body.allowDestructive &&
            /\b(drop\s+(table|schema|database)|truncate\s+|disable\s+row\s+level\s+security|delete\s+from\s+\S+\s*;?\s*$)\b/i.test(sql)
          ) {
            return respond(
              { ok: false, error: "DESTRUCTIVE_SQL_BLOCKED", message: "Operação destrutiva bloqueada pela proteção MSK." },
              403,
            );
          }
          const response = await managementFetch(
            connection,
            credential,
            `/projects/${encodeURIComponent(ref)}/database/query`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: sql, read_only: false }),
            },
          );
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            return respond(
              {
                ok: false,
                error: "SUPABASE_SQL_FAILED",
                message: String((data as any)?.message || (data as any)?.error || `HTTP ${response.status}`),
              },
              response.status,
            );
          }
          return respond({ ok: true, result: data });
        }

        return respond({ ok: false, error: "UNKNOWN_ACTION" }, 400);
      },
    },
  },
});
