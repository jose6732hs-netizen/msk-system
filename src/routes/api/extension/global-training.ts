import { createFileRoute } from "@tanstack/react-router";
import { supabaseServer } from "@/integrations/supabase/client.server";
import { compileGlobalTraining } from "@/lib/ai-global-training.server";
import { findLicenseByToken, isTrustedExtensionOrigin, rateLimit } from "@/lib/license.server";

const DEFAULT_POLICY = {
  version: 4,
  editBudgets: {
    fast: { maxFiles: 1, maxChangedLines: 24, maxReplacementRatio: 0.08 },
    medium: { maxFiles: 6, maxChangedLines: 420, maxReplacementRatio: 0.55 },
    diagnostic: { maxFiles: 16, maxChangedLines: 1200, maxReplacementRatio: 0.8 },
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

const V31418_COMPAT_TRAINING = `
MSK AGENTE v3.14.18 — RUNTIME COMPATIBILITY RULES

These rules are mandatory for every code creation, edit, implementation, improvement and bug fix.

1. OUTPUT FORMAT
- Return exactly ONE valid JSON object and nothing before or after it.
- Never wrap JSON in markdown fences.
- Never return prose outside the JSON object.
- The top-level field "files" MUST ALWAYS be a JSON ARRAY, never an object/map and never a string.
- Every files[] item MUST be an object with exactly the compatible shape:
  {"action":"modify|create|delete","path":"real/project/path","content":"FULL FILE CONTENT"}
- For delete, content may be an empty string. For modify/create, content MUST be the complete final source file.
- Never return files as {"path":"content"}.
- Never return nested arrays, null, booleans or objects where the runtime expects a string or array.
- "thought" and "summary" MUST be strings.

2. SURGICAL EDIT MODE
- If the system prompt explicitly requests an edits[] response, return exactly:
  {"thought":"...","summary":"...","edits":[{"path":"existing/path","find":"EXACT UNIQUE CURRENT SOURCE","replace":"COMPLETE REPLACEMENT SNIPPET"}]}
- edits MUST be an array. find and replace MUST be strings.
- Do not mix edits[] and files[] unless the system prompt explicitly asks for both.

3. PRESERVE WORKING CODE
- Never replace a large existing page with a small placeholder implementation.
- Preserve imports, routes, components, state, handlers, styles, exports and unrelated working behavior.
- For an existing file, modify only what the user requested while returning the COMPLETE resulting file when files[] is requested.
- Do not invent paths when the project map provides real paths.
- For action="modify", the returned path MUST already exist and the final file must keep every existing public contract not explicitly requested for removal.
- For action="create", never target a path that already exists.

4. VISUAL / FEATURE REQUESTS
- For requests such as banners, carousels, countdown timers, sections, cards, buttons, text/color/layout changes, locate the existing rendered page/component and integrate the feature there.
- A carousel/banner request must include all state/hooks/imports/JSX/CSS needed to compile.
- A countdown request must include cleanup for timers/intervals and must not reference undefined symbols.
- If a feature needs more than one existing file, return all required files in files[] rather than forcing an incomplete one-file patch.
- For layout, scroll, responsive, spacing or overflow improvements, first preserve the current screen and fix the real owning container/root/styles. Do not rebuild the whole screen just to add scrolling or responsiveness.

5. VALID JSON
- Escape every newline, quote and backslash correctly inside JSON strings.
- Do not truncate file contents.
- Do not use comments outside JSON, ellipses, placeholders such as "existing code here", or partial snippets in files[].
- Before emitting the answer, internally verify JSON.parse compatibility and that Array.isArray(files) or Array.isArray(edits) is true for the requested schema.

6. SAFETY VALIDATOR COMPATIBILITY
- Keep the patch proportional to the request.
- Do not delete unrelated code.
- Do not rewrite the entire application for a localized feature.
- If the requested feature genuinely requires multiple coordinated edits, make them complete and internally consistent in the same response.
- Never remove export default or existing named exports unless the user explicitly asked for that removal.
- Never introduce a local import unless the imported file already exists or is also created in the same files[] response.
- Never introduce a package import that is not already present in package.json.

7. LARGE EXISTING SURFACES — SAFE IMPROVEMENT MODE
- When improving an existing checkout, dashboard, landing page, form, settings screen, profile, product page or other large surface, DO NOT replace it with a shorter simplified version.
- Start from the authoritative current source supplied in context and preserve it. Apply the requested changes on top of that source.
- The final content of a modified large file should normally remain close to the original size. Unless the user explicitly requested removal/rewrite, NEVER return a result smaller than roughly 70% of the authoritative original.
- If the request is "melhore", "refine", "implemente", "adicione", "corrija" or an equivalent in any language, preserve all existing business logic and improve only the required behavior/design.
- Prefer the smallest coherent file set. One large screen with a local layout/scroll problem should usually modify the owning screen/style file, not unrelated backend files.
- If more than one file is truly required, keep every file complete and coordinated: imports, state, handlers, JSX, CSS, routes and types must all agree.
- Do not duplicate an existing component/route to avoid editing it. Modify the real owner.
- For scroll/overflow defects, inspect the actual page/root/container chain and fix height/min-height/overflow/position constraints while preserving existing checkout steps, payment logic, inputs, validation and navigation.
- Before returning files[], compare each modified file conceptually against the authoritative original and verify: no lost exports, no lost imports, no missing handlers, no truncated sections, no placeholder blocks, no orphan UI and no unrelated deletion.

8. RECOVERY BEHAVIOR
- If the previous attempt was rejected as unsafe, do not make the next attempt broader. Make it MORE conservative and MORE faithful to the authoritative originals.
- If the system gives validation failures, correct exactly those failures while preserving the user's original intent.
- If the system requests surgical edits[], use exact unique find snippets copied verbatim from the authoritative source and minimal complete replacements.
`;

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
    console.error("[MSK AI] training runtime query failed; using built-in compatibility training", trainingResult.error.message);
  }
  if (policyResult.error) console.error("[MSK Extension] runtime policy query failed", policyResult.error.message);

  let compiled = { count: 0, versions: [] as string[], text: "" };
  if (!trainingResult.error) {
    try {
      const data = Array.isArray(trainingResult.data) ? trainingResult.data : [];
      compiled = compileGlobalTraining(data as any[]) as any;
    } catch (error) {
      console.error("[MSK AI] training compile failed; using compatibility training", error instanceof Error ? error.message : String(error));
    }
  }

  const training = [String(compiled.text || "").trim(), V31418_COMPAT_TRAINING.trim()].filter(Boolean).join("\n\n");
  const versions = Array.isArray(compiled.versions) ? compiled.versions : [];

  return json(request, {
    ok: true,
    count: Number(compiled.count || 0) + 1,
    versions: [...versions, "v3.14.18-structured-output-large-safe-patch"],
    training,
    policy: mergePolicy(policyResult.data?.value),
    policy_updated_at: policyResult.data?.updated_at ?? null,
    compatibility_training: true,
    large_patch_training: true,
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
