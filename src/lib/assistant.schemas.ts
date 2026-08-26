import { z } from "zod";

export const assistantInputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(24),
});

export type AssistantInput = z.infer<typeof assistantInputSchema>;
