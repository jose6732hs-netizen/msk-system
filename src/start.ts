import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { supabase } from "@/integrations/supabase/client";
import { enablePushNotifications, pushPermission } from "@/lib/push-client";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  // Lovable-managed email/webhook routes authenticate themselves.
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

let authenticatedUploadFetchInstalled = false;

function installAuthenticatedUploadFetch() {
  if (authenticatedUploadFetchInstalled || typeof window === "undefined") return;
  authenticatedUploadFetchInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const requestUrl =
        typeof input === "string" || input instanceof URL
          ? new URL(String(input), window.location.origin)
          : new URL(input.url, window.location.origin);

      if (
        requestUrl.origin === window.location.origin &&
        requestUrl.pathname === "/api/public/cms/upload"
      ) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        if (init?.headers) {
          new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        }
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return nativeFetch(input, { ...init, headers });
      }
    } catch {
      // Mantém o comportamento normal do fetch caso a URL não possa ser analisada.
    }

    return nativeFetch(input, init);
  };
}

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  onClientStart: async () => {
    installAuthenticatedUploadFetch();

    // Tenta renovar registro de push se já foi habilitado anteriormente e temos permissão
    if (localStorage.getItem("msk_push_enabled") === "1" && pushPermission() === "granted") {
      try {
        await enablePushNotifications();
      } catch (err) {
        console.warn("Falha ao renovar push automaticamente:", err);
      }
    }
  },
}));
