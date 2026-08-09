import { createServerFn } from "@tanstack/react-start";

/** Configuração pública da plataforma (domínio dinâmico, aparência). */
export const getSiteConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { getAppUrl } = await import("./app-url.server");
  const { getSetting } = await import("./commerce.server");
  const [appUrl, appearance] = await Promise.all([
    getAppUrl(),
    getSetting<Record<string, string>>("appearance", {}),
  ]);
  return { appUrl, appearance };
});
