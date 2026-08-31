import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminAgentCenter } from "@/components/msk/admin-agent-center";

const TABLES = [
  "extension_installations",
  "extension_projects",
  "extension_events",
  "extension_errors",
  "extension_releases",
  "extension_incidents",
  "extension_alerts",
] as const;

export function AdminAgentCenterLive() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["extension-admin-center"] });
      }, 150);
    };

    let channel = supabase.channel("msk-agent-admin-live");
    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        refresh,
      );
    }
    channel.subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return <AdminAgentCenter />;
}