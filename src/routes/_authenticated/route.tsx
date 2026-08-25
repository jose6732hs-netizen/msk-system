import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdmin = pathname.startsWith("/admin");

  return (
    <>
      {isAdmin && (
        <style>{`
          @media (min-width: 1024px) {
            /*
             * Super Admin: o menu precisa ficar preso à viewport e nunca
             * acompanhar o scroll da tabela/dashboard.
             * O aside é o primeiro filho direto do layout do /admin.
             */
            body.board-layout #root > * {
              min-width: 0;
            }

            body.board-layout aside:first-of-type {
              position: fixed !important;
              inset: 0 auto 0 0 !important;
              top: 0 !important;
              left: 0 !important;
              width: 16rem !important;
              height: 100dvh !important;
              max-height: 100dvh !important;
              z-index: 80 !important;
              display: flex !important;
              overflow: hidden !important;
            }

            body.board-layout aside:first-of-type > nav {
              min-height: 0 !important;
              flex: 1 1 auto !important;
              overflow-y: auto !important;
              overscroll-behavior: contain;
              scrollbar-width: none;
            }

            body.board-layout aside:first-of-type > nav::-webkit-scrollbar {
              display: none;
            }

            /* Reserva o espaço do sidebar fixo para o conteúdo principal. */
            body.board-layout aside:first-of-type + div {
              margin-left: 16rem !important;
              width: calc(100% - 16rem) !important;
              min-width: 0 !important;
            }
          }
        `}</style>
      )}
      <Outlet />
    </>
  );
}
