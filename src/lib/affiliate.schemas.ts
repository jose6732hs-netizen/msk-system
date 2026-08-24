import { z } from "zod";

export const rangeSchema = z.object({
  range: z.enum(["7d", "30d", "90d", "year", "custom"]).default("30d"),
  from: z.string().optional(),
  to: z.string().optional(),
});
