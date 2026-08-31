import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const NEW_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LEGACY_URL = "https://zjrrymncmiyftyogejjr.supabase.co";
const LEGACY_PUBLISHABLE_KEY = "sb_publishable_T4c9lObE149Nozgc9xQqvg_C46uHzYA";
const db = createClient(NEW_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const allowedOrigin = (origin: string | null) => {
  if (!origin) return "https://msksystem.online";
  if (/^https:\/\/(www\.)?msksystem\.online$/i.test(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) return origin;
  if (/^https:\/\/([a-z0-9-]+\.)?lovable\.dev$/i.test(origin)) return origin;
  return "https://msksystem.online";
};
const headersFor = (req: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigin(req.headers.get("origin")),
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json"
});
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(req) });
const bearer = (req: Request) => (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

type AuthCtx = { user: any; source: "current" | "migrated"; legacy?: any };

async function identify(req: Request): Promise<AuthCtx | null> {
  const token = bearer(req);
  if (!token || token.startsWith("sb_publishable_")) return null;

  const local = await db.auth.getUser(token);
  if (!local.error && local.data.user) return { user: local.data.user, source: "migrated" };

  const legacy = createClient(LEGACY_URL, LEGACY_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const old = await legacy.auth.getUser(token);
  if (!old.error && old.data.user) return { user: old.data.user, source: "current", legacy };
  return null;
}

const activeLicense = (row: any) => {
  if (String(row?.status) !== "active") return false;
  const now = Date.now();
  if (row?.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row?.expires_at && new Date(row.expires_at).getTime() <= now) return false;
  return true;
};

async function currentAiConfiguration() {
  const { data, error } = await db
    .from("msk_ai_settings")
    .select("provider,model,api_base_url,api_key_ciphertext,api_key_last4,active,updated_at")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    console.error("[msk-agent] ai settings read failed", error.message);
    return {
      configured: false,
      provider: "B.AI",
      model: "deepseek-v4-flash",
      updatedAt: null,
    };
  }

  return {
    configured: !!(data?.active && data?.api_key_ciphertext),
    provider: data?.provider || "B.AI",
    model: data?.model || "deepseek-v4-flash",
    updatedAt: data?.updated_at || null,
  };
}

async function entitlement(ctx: AuthCtx) {
  const uid = ctx.user.id;
  let roles: string[] = [];
  let licenses: any[] = [];
  let plans: any[] = [];

  if (ctx.source === "current") {
    const legacy = ctx.legacy;
    const [roleRes, licRes] = await Promise.all([
      legacy.from("user_roles").select("role").eq("user_id", uid),
      legacy.from("licenses").select("id,plan_id,status,starts_at,expires_at,type").eq("user_id", uid)
    ]);
    roles = (roleRes.data || []).map((r: any) => String(r.role));
    licenses = licRes.data || [];
    const ids = [...new Set(licenses.map((l: any) => l.plan_id).filter(Boolean))];
    if (ids.length) {
      const planRes = await legacy.from("plans").select("id,slug,name,features,active").in("id", ids);
      plans = planRes.data || [];
    }
  } else {
    const [roleRes, licRes] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", uid),
      db.from("licenses").select("id,plan_id,status,starts_at,expires_at,type").eq("user_id", uid)
    ]);
    roles = (roleRes.data || []).map((r: any) => String(r.role));
    licenses = licRes.data || [];
    const ids = [...new Set(licenses.map((l: any) => l.plan_id).filter(Boolean))];
    if (ids.length) {
      const planRes = await db.from("plans").select("id,slug,name,features,active").in("id", ids);
      plans = planRes.data || [];
    }
  }

  const privileged = roles.includes("super_admin") || roles.includes("admin");
  const planById = new Map(plans.map((p: any) => [p.id, p]));
  const matching = licenses
    .filter(activeLicense)
    .map((license: any) => ({ license, plan: planById.get(license.plan_id) }))
    .find((item: any) => item.plan?.active !== false && item.plan?.features?.chat === true);

  return {
    allowed: privileged || !!matching,
    privileged,
    roles,
    license: matching?.license || null,
    plan: matching?.plan ? { id: matching.plan.id, slug: matching.plan.slug, name: matching.plan.name } : null
  };
}

async function status(ctx: AuthCtx) {
  const uid = ctx.user.id;
  const [ent, projectRes, projectsRes, connectionRes, runsRes, ai] = await Promise.all([
    entitlement(ctx),
    db.from("agent_projects").select("id,repo_full_name,default_branch,preview_url,last_opened_at").eq("user_id", uid).eq("active", true).maybeSingle(),
    db.from("agent_projects").select("id,repo_full_name,default_branch,preview_url,last_opened_at").eq("user_id", uid).order("last_opened_at", { ascending: false }).limit(20),
    db.from("agent_connections").select("id,github_login,revoked_at,last_validated_at").eq("user_id", uid).eq("connector_id", "github").maybeSingle(),
    db.from("agent_runs").select("id,status,summary,pull_request_url,preview_url,files_changed,created_at,updated_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
    currentAiConfiguration(),
  ]);
  const githubConfigured = !!Deno.env.get("GITHUB_CLIENT_ID") && !!Deno.env.get("GITHUB_CLIENT_SECRET") && !!Deno.env.get("MSK_TOKEN_ENCRYPTION_KEY") && !!Deno.env.get("MSK_STATE_SECRET");
  const aiConfigured = ai.configured;
  return {
    ok: true,
    authSource: ctx.source,
    user: { id: uid, email: ctx.user.email || null },
    entitlement: ent,
    agent: {
      connected: ent.allowed,
      githubConfigured,
      githubConnected: !!connectionRes.data && !connectionRes.data.revoked_at,
      githubLogin: connectionRes.data?.github_login || null,
      aiConfigured,
      aiProvider: ai.provider,
      aiModel: ai.model,
      aiUpdatedAt: ai.updatedAt,
      activeProject: projectRes.data || null,
      projects: projectsRes.data || [],
      recentRuns: runsRes.data || [],
      capabilities: {
        chat: ent.allowed,
        connectGithub: ent.allowed && githubConfigured,
        editCode: ent.allowed && githubConfigured && aiConfigured && !!connectionRes.data && !connectionRes.data.revoked_at,
        approvalRequired: true
      }
    }
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headersFor(req) });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "connection-status";
  if (action === "health") return json(req, { ok: true, service: "msk-agent", version: "2.2-ai-settings-db" });

  const ctx = await identify(req);
  if (!ctx) return json(req, { error: "Sessão MSK necessária.", code: "AUTH_REQUIRED" }, 401);

  if (action === "connection-status") return json(req, await status(ctx));
  if (action === "available-actions") {
    const current = await status(ctx);
    return json(req, {
      actions: ["connection-status","connect_github","list_projects","activate_project","edit_code","run_status","approve_run"],
      confirmationRequired: ["merge","publish","rollback"],
      capabilities: current.agent.capabilities
    });
  }

  const ent = await entitlement(ctx);
  if (!ent.allowed) return json(req, { error: "Seu plano MSK não possui acesso ao assistente ou a licença está inativa.", code: "AGENT_ACCESS_REQUIRED" }, 403);

  const ai = await currentAiConfiguration();
  return json(req, {
    error: "Esta ação ainda depende da conexão GitHub/IA do administrador.",
    code: "AGENT_PROVIDER_SETUP_REQUIRED",
    setup: {
      githubConfigured: !!Deno.env.get("GITHUB_CLIENT_ID") && !!Deno.env.get("GITHUB_CLIENT_SECRET"),
      aiConfigured: ai.configured,
      aiProvider: ai.provider,
      aiModel: ai.model,
    }
  }, 503);
});
