import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export const adminSearchEmailRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({
        query: z.string().max(254).optional().default(""),
        limit: z.number().int().min(1).max(500).optional().default(100),
      })
      .parse(value ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { searchEmailRecipients } = await import("./admin-email-search.server");
    return searchEmailRecipients(data.query, data.limit);
  });
