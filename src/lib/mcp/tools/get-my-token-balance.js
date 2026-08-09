import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";
export default defineTool({
    name: "get_my_token_balance",
    title: "Get my token balance",
    description: "Return the signed-in user's token allowances (total, used, remaining, period end) and any active trial.",
    inputSchema: {},
    outputSchema: {
        remaining: z.number(),
        totalGranted: z.number(),
        totalUsed: z.number(),
        allowances: z.array(z.any()),
        trials: z.array(z.any()),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    handler: async (_input, ctx) => {
        if (!ctx.isAuthenticated())
            return notAuthenticated();
        const supabase = supabaseForUser(ctx);
        const userId = ctx.getUserId();
        const [allowances, trials] = await Promise.all([
            supabase
                .from("token_allowances")
                .select("id, source, total, used, period_end, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(50),
            supabase
                .from("trials")
                .select("id, status, started_at, expires_at, used")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(5),
        ]);
        if (allowances.error) {
            return { content: [{ type: "text", text: allowances.error.message }], isError: true };
        }
        const rows = allowances.data ?? [];
        const now = Date.now();
        const active = rows.filter((r) => !r.period_end || new Date(r.period_end).getTime() > now);
        const remaining = active.reduce((sum, r) => sum + ((r.total ?? 0) - (r.used ?? 0)), 0);
        const summary = {
            remaining,
            totalGranted: active.reduce((sum, r) => sum + (r.total ?? 0), 0),
            totalUsed: active.reduce((sum, r) => sum + (r.used ?? 0), 0),
            allowances: rows,
            trials: trials.data ?? [],
        };
        return {
            content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
            structuredContent: summary,
        };
    },
});
