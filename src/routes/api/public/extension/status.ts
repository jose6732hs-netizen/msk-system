import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, preflight } from "@/lib/license.server";

export const Route = createFileRoute("/api/public/extension/status")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => preflight(request),
      GET: async ({ request }) => {
        try {
          const slug = new URL(request.url).searchParams.get("channel");
          const chromeId = request.headers.get("origin")?.match(/^chrome-extension:\/\/([a-p]{32})$/)?.[1];
          const { getExtensionChannel, getExtensionChannelByChromeId } = await import("@/lib/extension-channels.server");
          const cfg = chromeId ? await getExtensionChannelByChromeId(chromeId) : await getExtensionChannel(slug);
          if (!cfg) return jsonResponse({ enabled: false, message: "Canal não encontrado." }, 404, request);
          return jsonResponse({
            channel: cfg.slug,
            name: cfg.display_name,
            number: cfg.channel_number,
            type: cfg.channel_type,
            enabled: cfg.enabled,
            version: cfg.version,
            message: cfg.enabled ? "" : cfg.message,
            api_base: cfg.api_base_url,
          }, 200, request);
        } catch {
          // fail-closed: sem resposta válida, a extensão reserva fica desativada
          return jsonResponse({ channel: "unknown", enabled: false, version: null, message: "" }, 200, request);
        }
      },
    },
  },
});