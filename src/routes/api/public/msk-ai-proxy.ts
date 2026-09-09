import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM = "https://api.kpalabz.com/v1/messages";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key, anthropic-version",
  "Cache-Control": "no-store",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function upstreamFetch(request: Request) {
  const apiKey = String(request.headers.get("x-api-key") || "").trim();
  if (!apiKey) {
    return Response.json({ error: "MSK_AI_KEY_REQUIRED" }, { status: 401, headers: CORS });
  }

  const body = await request.text();
  if (!body || body.length > 8_000_000) {
    return Response.json({ error: "MSK_AI_REQUEST_INVALID" }, { status: 413, headers: CORS });
  }

  let lastError = "AI upstream unavailable";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 115_000);
    try {
      const response = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": request.headers.get("anthropic-version") || "2023-06-01",
          "content-type": "application/json",
        },
        body,
        signal: controller.signal,
      });

      const payload = await response.text();
      if (response.ok || ![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
        return new Response(payload, {
          status: response.status,
          headers: {
            ...CORS,
            "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
            "X-MSK-AI-Route": "proxy",
            "X-MSK-AI-Attempt": String(attempt),
          },
        });
      }
      lastError = `AI upstream HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === 3) break;
    } finally {
      clearTimeout(timer);
    }
    await sleep(350 * attempt);
  }

  return Response.json(
    { error: "MSK_AI_UPSTREAM_UNAVAILABLE", message: lastError },
    { status: 503, headers: CORS },
  );
}

export const Route = createFileRoute("/api/public/msk-ai-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => upstreamFetch(request),
    },
  },
});
