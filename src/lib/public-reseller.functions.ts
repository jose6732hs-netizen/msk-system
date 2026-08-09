import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Página pública do revendedor — leitura sem autenticação. */
export const fetchResellerPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(2).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { loadResellerPage } = await import("./reseller.server");
    return loadResellerPage(data.slug);
  });
