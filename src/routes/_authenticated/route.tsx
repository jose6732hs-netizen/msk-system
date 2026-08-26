import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RequiredPhoneGate } from "@/components/msk/required-phone-gate";
import { AssistantWidget } from "@/components/msk/assistant-widget";


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
    <RequiredPhoneGate>
      {isAdmin && (
        <style>{`
          @media (min-width: 1024px) {
            aside.hidden.w-64.lg\\:flex {
              position: fixed !important;
              top: 0 !important;
              bottom: 0 !important;
              left: 0 !important;
              width: 16rem !important;
              height: 100vh !important;
              height: 100dvh !important;
              max-height: 100vh !important;
              max-height: 100dvh !important;
              z-index: 100 !important;
              display: flex !important;
              overflow: hidden !important;
              transform: none !important;
            }

            aside.hidden.w-64.lg\\:flex > nav {
              min-height: 0 !important;
              flex: 1 1 auto !important;
              overflow-x: hidden !important;
              overflow-y: auto !important;
              overscroll-behavior: contain;
              scrollbar-width: none;
            }

            aside.hidden.w-64.lg\\:flex > nav::-webkit-scrollbar {
              display: none;
            }

            aside.hidden.w-64.lg\\:flex + div {
              margin-left: 16rem !important;
              width: calc(100% - 16rem) !important;
              min-width: 0 !important;
              flex: 1 1 auto !important;
            }
          }
        `}</style>
      )}
      <Outlet />
      <AssistantWidget />
    </RequiredPhoneGate>
  );
}

