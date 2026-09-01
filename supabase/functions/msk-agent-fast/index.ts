import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license, x-msk-installation-id, x-msk-extension-version, x-msk-extension-id, x-msk-build-id, x-msk-integrity-root, x-msk-build-fingerprint, x-msk-device-session, x-msk-proof-version, x-msk-timestamp, x-msk-counter, x-msk-body-sha256, x-msk-signature, x-msk-target, x-msk-action",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const transientAi = new Set(["AI_RATE_LIMIT", "AI_UPSTREAM_UNAVAILABLE", "AI_NETWORK_UNAVAILABLE", "AI_REQUEST_TIMEOUT", "AI_WAITING_RETRY"]);
const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = supabaseUrl && serviceRole ? createClient(supabaseUrl, serviceRole) : null;

function copyHeaders(req: Request) {
  const headers = new Headers();
  for (const name of ["authorization", "apikey", "content-type", "x-msk-session", "x-msk-license", "x-msk-installation-id", "x-msk-extension-version", "x-msk-extension-id", "x-msk-build-id", "x-msk-integrity-root", "x-msk-build-fingerprint", "x-msk-device-session", "x-msk-proof-version", "x-msk-timestamp", "x-msk-counter", "x-msk-body-sha256", "x-msk-signature", "x-msk-target", "x-msk-action"]) {
    const value = req.headers.get(name); if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return headers;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `HTTP ${response.status}` }; }
  return { response, text, data };
}

async function queueTask(bodyText: string, code: string, attempt: number) {
  if (!db) return;
  let body: any = {};
  try { body = JSON.parse(bodyText || "{}"); } catch { return; }
  const taskId = String(body?.task_id || "");
  const projectId = String(body?.lovable_project_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(taskId) || !/^[0-9a-f-]{36}$/i.test(projectId)) return;
  const { data: task } = await db.from("msk_tasks").select("user_id").eq("id", taskId).maybeSingle();
  if (!task?.user_id) return;
  const next = new Date(Date.now() + Math.min(120000, 15000 * Math.max(1, attempt))).toISOString();
  await db.from("msk_tasks").update({ status: "queued_waiting_ai", error: null, error_code: code, error_stage: "analyzing", progress_message: "IA ocupada · aguardando automaticamente", updated_at: new Date().toISOString() }).eq("id", taskId);
  await db.from("msk_ai_retry_queue").upsert({ task_id: taskId, user_id: task.user_id, lovable_project_id: projectId, reason_code: code, attempt_count: Math.max(1, attempt), next_retry_at: next, updated_at: new Date().toISOString() }, { onConflict: "task_id" });
}

async function clearQueue(bodyText: string) {
  if (!db) return;
  try {
    const body = JSON.parse(bodyText || "{}");
    const taskId = String(body?.task_id || "");
    if (/^[0-9a-f-]{36}$/i.test(taskId)) await db.from("msk_ai_retry_queue").delete().eq("task_id", taskId);
  } catch {}
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const base = supabaseUrl;
  if (!base) return json({ ok: false, code: "MSK_UNAVAILABLE", error: "MSK indisponível." }, 503);
  const url = new URL(req.url);
  const body = await req.text();
  const headers = copyHeaders(req);
  try {
    if (url.searchParams.get("action") === "run") {
      const preflight = await fetch(`${base}/functions/v1/msk-agent-preflight?action=preflight`, { method: "POST", headers, body });
      const preflightText = await preflight.text();
      let preflightData: any = {};
      try { preflightData = preflightText ? JSON.parse(preflightText) : {}; } catch {}
      if (!preflight.ok || preflightData?.ready !== true) return new Response(preflightText || JSON.stringify({ ready: false, blockers: [{ code: "PREFLIGHT_FAILED", message: "O pre-flight não autorizou o envio." }], warnings: [] }), { status: preflight.status || 409, headers: { ...cors, "Content-Type": "application/json" } });
      if (preflightData?.context?.force_pr === true) {
        let directCommit = true; try { directCommit = JSON.parse(body || "{}")?.direct_commit !== false; } catch {}
        if (directCommit) return json({ ready: false, blockers: [{ code: "BRANCH_PROTECTED", message: "A branch é protegida. Reenvie a tarefa em modo branch/PR.", action: "Usar Pull Request" }], warnings: preflightData?.warnings || [], context: preflightData?.context || null }, 409);
      }
    }

    const delays = url.searchParams.get("action") === "run" ? [0, 2500, 6000, 12000, 22000] : [0];
    let last: any = null;
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt]) await sleep(delays[attempt]);
      const upstream = await fetch(`${base}/functions/v1/msk-agent?${url.searchParams.toString()}`, { method: "POST", headers, body });
      last = await parseResponse(upstream);
      const code = String(last?.data?.code || "").toUpperCase();
      if (!transientAi.has(code)) {
        if (last.response.ok) await clearQueue(body);
        return new Response(last.text, { status: last.response.status, headers: { ...cors, "Content-Type": last.response.headers.get("content-type") || "application/json" } });
      }
      await queueTask(body, code, attempt + 1);
    }

    const originalCode = String(last?.data?.code || "AI_UPSTREAM_UNAVAILABLE").toUpperCase();
    await queueTask(body, originalCode, delays.length);
    let payload: any = {}; try { payload = JSON.parse(body || "{}"); } catch {}
    return json({
      ok: false, queued: true, retryable: true, ai_backpressure: true,
      code: "AI_WAITING_RETRY", upstream_code: originalCode, stage: "analyzing",
      task_id: String(payload?.task_id || last?.data?.task_id || ""), retry_after_ms: 45000,
      error: "A MSK IA está temporariamente ocupada. A tarefa foi preservada e será retomada automaticamente; nenhum commit duplicado será criado."
    }, 202);
  } catch (error) {
    return json({ ok: false, code: "MSK_FAST_PROXY_ERROR", retryable: true, stage: "transport", error: error instanceof Error ? error.message : "A rota de execução ficou temporariamente indisponível." }, 503);
  }
});