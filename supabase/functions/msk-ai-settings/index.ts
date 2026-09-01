import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "https://msksystem.online",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const required = (name: string) => { const value = Deno.env.get(name)?.trim(); if (!value) throw new Error(`Secret ausente no servidor: ${name}`); return value; };
const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
const supabaseUrl = required("SUPABASE_URL");
const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const SAAS_SUPABASE_URL = "https://zjrrymncmiyftyogejjr.supabase.co";
const SAAS_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_T4c9lObE149Nozgc9xQqvg_C46uHzYA";
const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), c => c.charCodeAt(0));

async function encryptionMaterial() {
  const configured = Deno.env.get("MSK_TOKEN_ENCRYPTION_KEY")?.trim() || "";
  if (configured) { const candidate = /^[A-Za-z0-9_-]{43,44}$/.test(configured) ? fromB64url(configured) : encoder.encode(configured); if (candidate.length === 32) return candidate; }
  const serverSecret = Deno.env.get("MSK_STATE_SECRET")?.trim() || serviceRole;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`msk-ai-settings:v1:${serverSecret}`)));
}
async function encryptionKey() { return crypto.subtle.importKey("raw", await encryptionMaterial(), "AES-GCM", false, ["encrypt"]); }
async function encrypt(value: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(value))); return b64url(new Uint8Array([...iv, ...cipher])); }
function bearer(req: Request) { return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim(); }

async function currentAdmin(req: Request) {
  const token = bearer(req); if (!token || token.split(".").length !== 3) return null;
  const saas = createClient(SAAS_SUPABASE_URL, SAAS_SUPABASE_PUBLISHABLE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await saas.auth.getUser(token); if (error || !data.user) return null;
  const { data: roles, error: rolesError } = await saas.from("user_roles").select("role").eq("user_id", data.user.id).in("role", ["admin", "super_admin"]);
  if (rolesError || !roles?.length) return null; return { id: data.user.id };
}

async function validateBaiKey(apiKey: string) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.b.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "deepseek-v4-flash", messages: [{ role: "user", content: "Reply only OK" }], max_tokens: 8, temperature: 0, stream: false }), signal: controller.signal });
    const raw = await response.text(); let body: any = null; try { body = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) { const error = new Error(String(body?.error?.message || body?.message || `A IA respondeu HTTP ${response.status}`).slice(0, 300)); (error as any).status = [401,403].includes(response.status) ? 400 : 502; throw error; }
  } catch (error: any) { if (error?.name === "AbortError") { const e = new Error("A IA demorou demais para validar a chave. Tente novamente."); (e as any).status = 504; throw e; } throw error; } finally { clearTimeout(timer); }
}

const countBy = (rows: any[], field: string) => {
  const map = new Map<string, number>();
  for (const row of rows) { const key = String(row?.[field] || "unknown"); map.set(key, (map.get(key) || 0) + 1); }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const admin = await currentAdmin(req); if (!admin) return json({ error: "Acesso restrito a administradores." }, 403);
    const body = await req.json().catch(() => ({})), action = String(body?.action || "");

    if (action === "agent-errors") {
      const days = Math.max(1, Math.min(90, Number(body?.days || 7)));
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await db.from("msk_agent_errors")
        .select("id,task_id,user_id,lovable_project_id,repository,branch_name,stage,code,message,retryable,attempt,created_at")
        .gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      const rows = data || [], internal = rows.filter((r: any) => r.code === "INTERNAL_ERROR"), total = rows.length;
      const internalRate = total ? (internal.length / total) * 100 : 0;
      return json({
        ok: true, days,
        summary: { total, internal: internal.length, internalRate, retryable: rows.filter((r:any) => r.retryable).length, alert: total >= 5 && internalRate > 5 },
        byCode: countBy(rows, "code").slice(0, 20),
        byStage: countBy(rows, "stage").slice(0, 20),
        recent: rows.slice(0, 100).map((r:any) => ({ id:r.id, taskId:r.task_id, userId:r.user_id, projectId:r.lovable_project_id, repository:r.repository, branch:r.branch_name, stage:r.stage, code:r.code, message:r.message, retryable:!!r.retryable, attempt:Number(r.attempt||0), createdAt:r.created_at })),
      });
    }

    if (action === "agent-error-detail") {
      const id = String(body?.errorId || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "ID de erro inválido." }, 400);
      const { data, error } = await db.from("msk_agent_errors").select("*").eq("id", id).maybeSingle();
      if (error) throw error; if (!data) return json({ error: "Erro não encontrado." }, 404);
      return json({ ok: true, error: data });
    }

    if (action === "ai-global-status") {
      const { data, error } = await db.from("msk_ai_settings").select("provider,model,api_key_ciphertext,api_key_last4,active,updated_at").eq("id", "default").maybeSingle(); if (error) throw error;
      return json({ configured: !!(data?.active && data?.api_key_ciphertext && data?.api_key_last4), provider: data?.provider || "B.AI", model: data?.model || "deepseek-v4-flash", keyMasked: data?.api_key_last4 ? `••••${data.api_key_last4}` : null, updatedAt: data?.updated_at || null });
    }
    if (action === "ai-global-save") {
      const apiKey = String(body?.apiKey || "").trim(); if (apiKey.length < 16 || apiKey.length > 600) return json({ error: "API key inválida." }, 400); await validateBaiKey(apiKey);
      const ciphertext = await encrypt(apiKey), now = new Date().toISOString(), last4 = apiKey.slice(-4);
      const { data: saved, error } = await db.from("msk_ai_settings").upsert({ id:"default", provider:"B.AI", model:"deepseek-v4-flash", api_base_url:"https://api.b.ai/v1/chat/completions", api_key_ciphertext:ciphertext, api_key_last4:last4, active:true, updated_by:admin.id, updated_at:now }, { onConflict:"id" }).select("id,provider,model,api_key_ciphertext,api_key_last4,active,updated_at").single();
      if (error) throw error; if (!saved?.active || !saved.api_key_ciphertext || saved.api_key_last4 !== last4) { const e = new Error("A chave foi validada, mas o banco não confirmou a gravação."); (e as any).status=500; throw e; }
      return json({ ok:true, configured:true, provider:saved.provider||"B.AI", model:saved.model||"deepseek-v4-flash", keyMasked:`••••${saved.api_key_last4}`, updatedAt:saved.updated_at||now });
    }
    if (action === "ai-global-delete") { const { error } = await db.from("msk_ai_settings").delete().eq("id", "default"); if (error) throw error; return json({ ok:true, configured:false }); }
    return json({ error: "Ação não reconhecida." }, 400);
  } catch (error: any) {
    const raw = String(error?.message || "Falha interna no backend administrativo do MSK."); console.error("msk-ai-settings", raw); const status = Number(error?.status || 500);
    const safeMessage = /MSK_(?:TOKEN_ENCRYPTION_KEY|STATE_SECRET)|Secret ausente/i.test(raw) ? "A configuração segura da IA está temporariamente indisponível." : raw.slice(0,500);
    return json({ error: safeMessage }, status >= 400 && status <= 599 ? status : 500);
  }
});
