import { assertEquals } from "jsr:@std/assert@1";

// errors.ts initializes the server Supabase client through common.ts. Test-only
// values are enough because these mapping tests never make a network request.
Deno.env.set("SUPABASE_URL", Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "test-service-role-key");

const { AgentError, mapErrorToAgentError } = await import("./errors.ts");

Deno.test("invalid AI JSON becomes AI_RESPONSE_PARSE_ERROR", () => {
  const mapped = mapErrorToAgentError(new Error("MSK_AI_JSON_INVALID"), "editing");
  assertEquals(mapped.code, "AI_RESPONSE_PARSE_ERROR");
  assertEquals(mapped.stage, "editing");
  assertEquals(mapped.retryable, true);
});

Deno.test("missing target becomes AGENT_TARGET_NOT_FOUND", () => {
  const mapped = mapErrorToAgentError(new Error("MSK_NO_SAFE_TARGET_FILES"), "locating_files");
  assertEquals(mapped.code, "AGENT_TARGET_NOT_FOUND");
  assertEquals(mapped.retryable, true);
});

Deno.test("GitHub timeout is explicit and retryable", () => {
  const mapped = mapErrorToAgentError(new Error("GITHUB_REQUEST_TIMEOUT"), "repository");
  assertEquals(mapped.code, "GITHUB_API_TIMEOUT");
  assertEquals(mapped.retryable, true);
});

Deno.test("no valid changes never becomes generic success", () => {
  const mapped = mapErrorToAgentError(new Error("MSK_AI_NO_VALID_CHANGES"), "validating");
  assertEquals(mapped.code, "NO_CHANGES_APPLIED");
  assertEquals(mapped.retryable, true);
});

Deno.test("known AgentError preserves its exact code", () => {
  const original = new AgentError("LOCK_ACQUISITION_FAILED", "busy", { stage: "locking", retryable: true, httpStatus: 409 });
  const mapped = mapErrorToAgentError(original, "editing");
  assertEquals(mapped.code, "LOCK_ACQUISITION_FAILED");
  assertEquals(mapped.stage, "locking");
});

Deno.test("unknown failures become INTERNAL_ERROR and never MSK_AGENT_ERROR", () => {
  const mapped = mapErrorToAgentError(new Error("completely-new-unclassified-failure"), "editing");
  assertEquals(mapped.code, "INTERNAL_ERROR");
  assertEquals(mapped.code === "MSK_AGENT_ERROR", false);
  assertEquals(mapped.retryable, false);
});
