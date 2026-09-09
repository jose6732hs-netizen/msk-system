import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://api.kpalabz.com/v1/messages";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key, anthropic-version, authorization",
  "Cache-Control": "no-store",
};

const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function modelCandidates(model: unknown) {
  return [...new Set([
    normalizeModel(model),
    "claude-sonnet-4-5",
    "claude-opus-4-5",
    "claude-haiku-4-5",
  ].filter(Boolean))];
}

async function callUpstream(apiKey: string, anthropicVersion: string, body: Record<string, unknown>, model: string) {
  let lastStatus = 503;
  let lastPayload = "AI upstream unavailable";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 110_000);
    try {
      const response = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": anthropicVersion,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...body, model }),
        signal: controller.signal,
      });

      const payload = await response.text();
      lastStatus = response.status;
      lastPayload = payload;

      if (response.ok) {
        return { response, payload, attempt };
      }
      if ([401, 402, 403].includes(response.status)) {
        return { response, payload, attempt };
      }
      if (!TRANSIENT.has(response.status)) break;
    } catch (error) {
      lastStatus = 503;
      lastPayload = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
    await sleep(300 * attempt);
  }

  return {
    response: new Response(lastPayload, { status: lastStatus }),
    payload: lastPayload,
    attempt: 2,
  };
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
  const candidates = modelCandidates(requestedModel);
  const anthropicVersion = request.headers.get("anthropic-version") || "2023-06-01";
  let lastPayload = "AI upstream unavailable";
  let lastStatus = 503;

  for (const model of candidates) {
    const result = await callUpstream(apiKey, anthropicVersion, body, model);
    lastPayload = result.payload;
    lastStatus = result.response.status;

    if (result.response.ok || [401, 402, 403].includes(result.response.status)) {
      return new Response(result.payload, {
        status: result.response.status,
        headers: {
          ...CORS,
          "Content-Type": result.response.headers.get("content-type") || "application/json; charset=utf-8",
          "X-MSK-AI-Route": "proxy",
          "X-MSK-AI-Requested-Model": requestedModel || "default",
          "X-MSK-AI-Resolved-Model": model,
          "X-MSK-AI-Attempt": String(result.attempt),
        },
      });
    }
  }

  return Response.json(
    {
      error: "MSK_AI_UPSTREAM_UNAVAILABLE",
      status: lastStatus,
      message: lastPayload.slice(0, 500),
      requested_model: requestedModel || null,
      tried_models: candidates,
    },
    { status: 503, headers: CORS },
  );
}

export const Route = createFileRoute("/api/public/msk-ai-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => Response.json({
        ok: true,
        service: "msk-ai-proxy",
        upstream: "kpa-anthropic",
        default_model: "claude-sonnet-4-5",
      }, { headers: CORS }),
      POST: async ({ request }) => upstreamFetch(request),
    },
  },
});
