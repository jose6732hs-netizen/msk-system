import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAgentAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAgentAccess } = await import("@/lib/agent-access.server");
    return loadAgentAccess(context.supabase as any, context.userId);
  });
