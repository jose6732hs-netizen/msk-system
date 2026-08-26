import { createFileRoute } from "@tanstack/react-router";
import { preflight } from "@/lib/license.server";
import { handleValidation } from "@/lib/license-validate.server";

async function asMskCopyRequest(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  return new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, product: "msk-copy" }),
  });
}

export const Route = createFileRoute("/api/license/validate")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      POST: async ({ request }) =>
        handleValidation(await asMskCopyRequest(request), "msk-copy", 120, "cloner"),
    },
  },
});