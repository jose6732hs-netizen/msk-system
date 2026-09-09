import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://api.kpalabz.com/v1/messages";
const UPSTREAM_TIMEOUT_MS = 25_000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key, anthropic-version, authorization",
  "Cache-Control": "no-store",
};

function normalizeModel(model: unknown) {
  const value = String(model || "").trim().toLowerCase();
  if (!value) return "claude-sonnet-4-5";
  if (value.includes("haiku")) return "claude-haiku-4-5";
  if (value.includes("opus")) return "claude-opus-4-5";
  if (
    value === "claude-sonnet-5"
    || value.includes("3-5-sonnet")
    || value.includes("3.5-sonnet")
    || value.includes("sonnet-3-5")
    || value.includes("sonnet-3.5")
  ) {
    return "claude-sonnet-4-5";
  }
  return String(model);
}

async function upstreamFetch(request: Request) {
  const apiKey = String(request.headers.get("x-api-key") || process.env.KPALABZ_API_KEY || process.env.KPA_API_KEY || "").trim();
  if (!apiKey) {
    return Response.json({ error: "MSK_AI_KEY_REQUIRED" }, { status: 401, headers: CORS });
  }

  const raw = await request.text();
  if (!raw || raw.length > 8_000_000) {
    return Response.json({ error: "MSK_AI_REQUEST_INVALID" }, { status: 413, headers: CORS });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "MSK_AI_JSON_INVALID" }, { status: 400, headers: CORS });
  }

  const requestedModel = String(body.model || "");
  const resolvedModel = normalizeModel(requestedModel);
  const anthropicVersion = request.headers.get("anthropic-version") || "2023-06-01";
  const controller = new AbortController();
  const abortFromClient = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) controller.abort(request.signal.reason);
  else request.signal.addEventListener("abort", abortFromClient, { once: true });
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": anthropicVersion,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, model: resolvedModel }),
      signal: controller.signal,
    });

    const payload = await response.text();
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      return Response.json({
        error: "MSK_AI_UPSTREAM_INVALID_RESPONSE",
        status: response.status,
        requested_model: requestedModel || null,
        resolved_model: resolvedModel,
      }, { status: 502, headers: CORS });
    }

    return new Response(payload, {
      status: response.status,
      headers: {
        ...CORS,
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "X-MSK-AI-Route": "proxy-fast-fallback",
        "X-MSK-AI-Requested-Model": requestedModel || "default",
        "X-MSK-AI-Resolved-Model": resolvedModel,
      },
    });
  } catch (error) {
    if (request.signal.aborted) {
      return Response.json({ error: "MSK_AI_CLIENT_ABORTED" }, { status: 499, headers: CORS });
    }
    const timedOut = controller.signal.aborted;
    return Response.json({
      error: timedOut ? "MSK_AI_UPSTREAM_TIMEOUT" : "MSK_AI_UPSTREAM_UNAVAILABLE",
      message: timedOut ? `Upstream timeout after ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)}s` : (error instanceof Error ? error.message : String(error)),
      requested_model: requestedModel || null,
      resolved_model: resolvedModel,
    }, { status: 503, headers: CORS });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abortFromClient);
  }
}

export const Route = createFileRoute("/api/public/msk-ai-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => Response.json({
        ok: true,
        service: "msk-ai-proxy",
        mode: "fast-fallback",
        upstream: "kpa-anthropic",
        upstream_timeout_ms: UPSTREAM_TIMEOUT_MS,
        default_model: "claude-sonnet-4-5",
      }, { headers: CORS }),
      POST: async ({ request }) => upstreamFetch(request),
    },
  },
});
