import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "@/lib/product-image";
import "@/lib/password-recovery";

const STALE_CHUNK_KEY = "msk_chunk_reload";

const isStaleChunkError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Importing a module script failed")
  );
};

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: false,
    defaultPreloadDelay: 50,
    // Recupera de chunks antigos em cache (após novo deploy) recarregando o destino pretendido.
    defaultOnCatch: (error) => {
      if (typeof window === "undefined" || !isStaleChunkError(error)) return;
      // Destino que o roteador tentou abrir (pode ser diferente da URL atual).
      const target =
        router.state.location?.href ??
        window.location.pathname + window.location.search;
      const key = `${STALE_CHUNK_KEY}:${target.split("?")[0]}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      const url = new URL(target, window.location.origin);
      url.searchParams.set("_v", Date.now().toString(36));
      window.location.replace(url.toString());
    },

  });

  return router;
};
