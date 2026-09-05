import { createFileRoute } from "@tanstack/react-router";
import { supabaseServer } from "@/integrations/supabase/client.server";
import { compileGlobalTraining } from "@/lib/ai-global-training.server";
import { findLicenseByToken, isTrustedExtensionOrigin, rateLimit } from "@/lib/license.server";

const DEFAULT_POLICY = {
  version: 2,
  editBudgets: {
    fast: { maxFiles: 1, maxChangedLines: 24, maxReplacementRatio: 0.08 },
    medium: { maxFiles: 4, maxChangedLines: 180, maxReplacementRatio: 0.32 },
    diagnostic: { maxFiles: 12, maxChangedLines: 600, maxReplacementRatio: 0.65 },
    structural: { maxFiles: 40, maxChangedLines: 5000, maxReplacementRatio: 1 },
  },
  behavior: {
    askOnlyForProductDecisions: true,
    longPromptAutonomous: true,
    finalSummaryOnly: true,
    autoRetryFocusedPatch: true,
    resumeFromCheckpoint: true,
    preserveUnrequestedCode: true,
  },
  preview: {
    syncImmediately: true,
    pollBuild: true,
    autoRollbackOwnBrokenCommit: true,
    continueAfterSafeRollback: true,
  },
};

function cors(request: Request) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const allowed = !origin || isTrustedExtensionOrigin(origin);
  return {
    ...(origin && allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "authorization, content-type, x-api-key, x-msk-extension-version, x-msk-installation-id, x-msk-extension-id",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, max-age=10",
      ...cors(request),
    },
  });
}

function credential(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  if (value.toLowerCase().startsWith("bearer ")) return value.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() ?? "";
}

function activeLicense(row: any) {
  if (!row || String(row.status).toLowerCase() !== "active" || row.revoked_at) return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  return true;
}

function mergePolicy(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_POLICY;
  return {
    ...DEFAULT_POLICY,
    ...value,
    editBudgets: { ...DEFAULT_POLICY.editBudgets, ...(value.editBudgets || {}) },
    behavior: { ...DEFAULT_POLICY.behavior, ...(value.behavior || {}) },
    preview: { ...DEFAULT_POLICY.preview, ...(value.preview || {}) },
  };
}

async function handle(request: Request) {
  if (request.method !== "POST") return json(request, { ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && !isTrustedExtensionOrigin(origin)) return json(request, { ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);

  const token = credential(request);
  if (!token) return json(request, { ok: false, code: "LICENSE_REQUIRED" }, 401);
  const license = (await findLicenseByToken(token)) as any;
  if (!activeLicense(license)) return json(request, { ok: false, code: "LICENSE_INVALID" }, 401);
  if (!(await rateLimit("global-ai-training-runtime", String(license.id), 120))) {
    return json(request, { ok: false, code: "RATE_LIMITED" }, 429);
  }

  const [trainingResult, policyResult] = await Promise.all([
    (supabaseServer as any).rpc("msk_ai_global_training_runtime"),
    (supabaseServer as any).from("app_settings").select("value, updated_at").eq("key", "extension_runtime_policy").maybeSingle(),
  ]);

  if (trainingResult.error) {
    console.error("[MSK AI] training runtime query failed", trainingResult.error.message);
    return json(request, { ok: false, code: "GLOBAL_TRAINING_UNAVAILABLE" }, 503);
  }
  if (policyResult.error) console.error("[MSK Extension] runtime policy query failed", policyResult.error.message);

  const compiled = compileGlobalTraining((trainingResult.data ?? []) as any[]);
  return json(request, {
    ok: true,
    count: compiled.count,
    versions: compiled.versions,
    training: compiled.text,
    policy: mergePolicy(policyResult.data?.value),
    policy_updated_at: policyResult.data?.updated_at ?? null,
    updated_at: new Date().toISOString(),
  });
}

export const Route = createFileRoute("/api/extension/global-training")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
      POST: ({ request }) => handle(request),
    },
  },
});
