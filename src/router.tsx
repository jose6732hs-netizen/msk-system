import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

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
    // Recupera de chunks antigos em cache (após novo deploy) recarregando uma única vez.
    defaultOnCatch: (error) => {
      if (typeof window === "undefined" || !isStaleChunkError(error)) return;
      if (sessionStorage.getItem(STALE_CHUNK_KEY)) return;
      sessionStorage.setItem(STALE_CHUNK_KEY, "1");
      const url = new URL(window.location.href);
      url.searchParams.set("_v", Date.now().toString(36));
      window.location.replace(url.toString());
    },
  });

  return router;
};
