import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";


export default defineTool({
  name: "get_my_account",
  title: "Get my account",
  description: "Return the signed-in user's profile (name, email, phone) and assigned roles.",
  inputSchema: {},
  outputSchema: {
    userId: z.string(),
    email: z.string().nullable(),
    profile: z.any().nullable(),
    roles: z.array(z.string()),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },

  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [profile, roles] = await Promise.all([
      supabase.from("profiles").select("id, name, email, phone, created_at").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profile.error) {
      return { content: [{ type: "text", text: profile.error.message }], isError: true };
    }

    const account = {
      userId,
      email: ctx.getUserEmail() ?? profile.data?.email ?? null,
      profile: profile.data ?? null,
      roles: (roles.data ?? []).map((r) => r.role),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(account, null, 2) }],
      structuredContent: account,
    };
  },
});
