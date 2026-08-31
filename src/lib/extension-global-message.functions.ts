import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "./admin-guard";

export const extensionGlobalBroadcastMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      title: z.string().trim().min(1).max(180),
      message: z.string().trim().min(1).max(2000),
      severity: z.enum(["info", "success", "warning", "critical"]).default("info"),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { broadcastExtensionMessage } = await import("./extension-global-message.server");
    return broadcastExtensionMessage(data, context.userId);
  });
