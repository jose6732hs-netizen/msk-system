import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_licenses",
  title: "List my licenses",
  description:
    "List the signed-in user's extension licenses with status, type, activation and expiry dates. Never returns the license secret, only the last 4 characters.",
  inputSchema: {
    status: z.string().optional().describe("Optional status filter, e.g. active, expired, revoked."),
    limit: z.number().int().optional().describe("Maximum number of licenses to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabase
      .from("licenses")
      .select(
        "id, status, type, token_last4, activated_at, starts_at, expires_at, max_devices, activation_count, revoked_at, created_at",
      )
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(take);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const licenses = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: licenses.length
            ? JSON.stringify(licenses, null, 2)
            : "No licenses found for this account.",
        },
      ],
      structuredContent: { licenses },
    };
  },
});
