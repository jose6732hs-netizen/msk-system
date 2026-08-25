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
            aside.hidden.w-64 {
              position: sticky !important;
              top: 0 !important;
              height: 100vh !important;
              max-height: 100vh !important;
              align-self: flex-start !important;
              overflow: hidden !important;
            }

            aside.hidden.w-64 > nav {
              min-height: 0 !important;
              overflow-y: auto !important;
              overscroll-behavior: contain;
            }
          }
        `}</style>
      )}
      <Outlet />
    </>
  );
}
