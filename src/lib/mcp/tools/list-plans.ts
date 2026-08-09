import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";


export default defineTool({
  name: "list_plans",
  title: "List plans",
  description: "List the active plans sold by this app, with price, duration, device limits and highlights.",
  inputSchema: {},
  outputSchema: {
    plans: z.array(z.any()),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },

  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("plans")
      .select(
        "id, slug, name, description, price, currency, duration_label, duration_days, is_lifetime, max_devices, highlights, sort_order",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const plans = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(plans, null, 2) }],
      structuredContent: { plans },
    };
  },
});
