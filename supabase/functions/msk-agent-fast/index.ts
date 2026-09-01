import { z } from "https://esm.sh/zod@3.23.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license, x-msk-installation-id, x-msk-extension-version, x-msk-extension-id, x-msk-build-id, x-msk-integrity-root, x-msk-build-fingerprint, x-msk-device-session, x-msk-proof-version, x-msk-timestamp, x-msk-counter, x-msk-body-sha256, x-msk-signature, x-msk-target, x-msk-action",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const RunPayloadSchema = z.object({
  lovable_project_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  command: z.string().max(12000).optional(),
  original_command: z.string().max(12000).optional(),
  client_original_command: z.string().max(12000).optional(),
  repository_url: z.string().max(500).optional(),
  direct_commit: z.boolean().optional(),
  mode: z.string().max(40).optional(),
}).passthrough().superRefine((value, ctx) => {
  const command = String(value.client_original_command || value.original_command || value.command || "").trim();
  if (!command) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["command"], message: "Comando obrigatório." });
});

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 12000);
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitize(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      if (/(authorization|api.?key|secret|token|password|private.?key|signature|session|ciphertext)/i.test(key)) out[key] = "[redacted]";
      else if (key === "attachments") out[key] = Array.isArray(child) ? `[${child.length} attachment(s)]` : "[attachments]";
      else out[key] = sanitize(child, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 1000);
}

function log(level: "info" | "warn" | "error", event: string, data: Record<string, unknown>) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), service: "msk-agent-fast", event, ...sanitize(data) as Record<string, unknown> });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!base) return json({ ok: false, code: "MSK_UNAVAILABLE", error: "MSK indisponível." }, 503);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "status";
  const body = await req.text();
  const headers = new Headers();
  for (const name of [
    "authorization", "apikey", "content-type", "x-msk-session", "x-msk-license",
    "x-msk-installation-id", "x-msk-extension-version", "x-msk-extension-id",
    "x-msk-build-id", "x-msk-integrity-root", "x-msk-build-fingerprint",
    "x-msk-device-session", "x-msk-proof-version", "x-msk-timestamp",
    "x-msk-counter", "x-msk-body-sha256", "x-msk-signature", "x-msk-target",
    "x-msk-action",
  ]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");

  try {
    let parsedBody: any = null;
    if (action === "run") {
      try {
        parsedBody = body ? JSON.parse(body) : {};
      } catch (error) {
        log("warn", "task_payload_invalid_json", { error: error instanceof Error ? error.message : String(error) });
        return json({ ok: false, code: "TASK_PAYLOAD_INVALID", error: "O comando não pôde ser lido com segurança." }, 400);
      }

      const validation = RunPayloadSchema.safeParse(parsedBody);
      if (!validation.success) {
        const issues = validation.error.issues.slice(0, 12).map(issue => ({ path: issue.path.join("."), message: issue.message }));
        log("warn", "task_payload_schema_rejected", { payload: parsedBody, issues });
        return json({ ok: false, code: "TASK_PAYLOAD_INVALID", error: "Os dados obrigatórios da tarefa estão incompletos ou inválidos.", issues }, 422);
      }

      log("info", "task_persistence_precheck", {
        task_id: parsedBody.task_id || null,
        lovable_project_id: parsedBody.lovable_project_id,
        repository_url: parsedBody.repository_url || null,
        payload: parsedBody,
      });

      const preflight = await fetch(`${base}/functions/v1/msk-agent-preflight?action=preflight`, {
        method: "POST",
        headers,
        body,
      });
      const preflightText = await preflight.text();
      let preflightData: any = {};
      try { preflightData = preflightText ? JSON.parse(preflightText) : {}; } catch {}
      if (!preflight.ok || preflightData?.ready !== true) {
        log("warn", "task_preflight_blocked", {
          task_id: parsedBody.task_id || null,
          lovable_project_id: parsedBody.lovable_project_id,
          blockers: preflightData?.blockers || [],
        });
        return new Response(preflightText || JSON.stringify({ ready: false, blockers: [{ code: "PREFLIGHT_FAILED", message: "O pre-flight não autorizou o envio." }], warnings: [] }), {
          status: preflight.status || 409,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (preflightData?.context?.force_pr === true && parsedBody?.direct_commit !== false) {
        return json({
          ready: false,
          blockers: [{ code: "BRANCH_PROTECTED", message: "A branch é protegida. Reenvie a tarefa em modo branch/PR.", action: "Usar Pull Request" }],
          warnings: preflightData?.warnings || [],
          context: preflightData?.context || null,
        }, 409);
      }
    }

    const upstream = await fetch(`${base}/functions/v1/msk-agent?${url.searchParams.toString()}`, {
      method: "POST",
      headers,
      body,
    });
    const text = await upstream.text();

    if (action === "run" && !upstream.ok) {
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      const code = String(data?.code || "");
      if (code === "TASK_PERSISTENCE_FAILED" || /^(RLS_VIOLATION|NOT_NULL_VIOLATION|TABLE_NOT_FOUND|DATABASE_|POSTGREST_|FOREIGN_KEY_VIOLATION|UNIQUE_VIOLATION)/.test(code)) {
        log("error", "task_persistence_failed", {
          task_id: parsedBody?.task_id || data?.task_id || null,
          lovable_project_id: parsedBody?.lovable_project_id || null,
          repository_url: parsedBody?.repository_url || null,
          code: code || "DATABASE_PERSISTENCE_ERROR",
          upstream: data,
          payload: parsedBody,
        });
      }
    }

    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    log("error", "fast_gateway_failure", { action, error: error instanceof Error ? { message: error.message, stack: error.stack } : error });
    return json({
      ok: false,
      code: "MSK_FAST_PROXY_ERROR",
      retryable: true,
      error: "A rota de execução ficou temporariamente indisponível; tente novamente.",
    }, 503);
  }
});
