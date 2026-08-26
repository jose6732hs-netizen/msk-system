import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assistantInputSchema } from "@/lib/assistant.schemas";

export const askMskAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assistantInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "Assistente indisponível: chave de IA não configurada." };
    }

    const { buildUserContext, askAssistant } = await import("@/lib/assistant.server");
    const userContext = await buildUserContext(context.supabase as any, context.userId);
    const result = await askAssistant({ apiKey, messages: data.messages, context: userContext });

    if (!result.ok) return { ok: false as const, error: result.error };
    return { ok: true as const, reply: result.reply };
  });
