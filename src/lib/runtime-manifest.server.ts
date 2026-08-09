/**
 * Compatibilidade com o build LEGADO da extensão (LVB.Up 4.x), que ainda
 * tenta baixar um "runtime remoto" em /ext/runtime/manifest.
 *
 * A arquitetura oficial deste backend é API direta: a extensão fala apenas
 * com /api/public/license/* e /api/public/extension/status. Este módulo
 * existe só para o build antigo parar de receber 404 e para poder ser
 * desligado/atualizado remotamente (fail-closed).
 */
import { getReserveConfig } from "./reserve-extension.server";
import { getExtensionChannelByChromeId } from "./extension-channels.server";

export type RuntimeManifest = {
  schema: 1;
  enabled: boolean;
  version: string;
  message: string;
  /** Arquitetura em uso — sinaliza ao runtime legado que não há bundle real. */
  mode: "direct-api";
  api_base: string;
  endpoints: Record<string, string>;
  /** Mantido por compatibilidade: o runtime legado espera uma lista. */
  files: { name: string; url: string; integrity: null }[];
  deprecated: true;
  upgrade_url: string;
};

export async function buildRuntimeManifest(origin: string, chromeExtensionId?: string): Promise<RuntimeManifest> {
  const channel = chromeExtensionId ? await getExtensionChannelByChromeId(chromeExtensionId) : null;
  const cfg = channel ?? await getReserveConfig();
  const api = `${origin}/api/public`;
  return {
    schema: 1,
    enabled: cfg.enabled,
    version: cfg.version,
    message: cfg.enabled ? "" : cfg.message,
    mode: "direct-api",
    api_base: api,
    endpoints: {
      status: `${api}/extension/status`,
      activate: `${api}/license/activate`,
      validate: `${api}/license/validate`,
      heartbeat: `${api}/license/heartbeat`,
      me: `${api}/license/me`,
      deactivate: `${api}/license/deactivate`,
      device_remove: `${api}/license/device/remove`,
    },
    files: [
      { name: "bundle.js", url: `${api}/ext/runtime/bundle`, integrity: null },
    ],
    deprecated: true,
    upgrade_url: `${origin}/documentacao`,
  };
}

/** Bundle mínimo: só encaminha o runtime legado para a API direta. */
export async function buildRuntimeBundle(origin: string): Promise<string> {
  const manifest = await buildRuntimeManifest(origin);
  if (!manifest.enabled) {
    return `/* LOVABLE MSK — canal reserva desativado pelo administrador. */\nconsole.info(${JSON.stringify(manifest.message || "Canal reserva desativado.")});\n`;
  }
  return `/* LOVABLE MSK — runtime de compatibilidade (modo API direta). */
(function(){
  var CFG = ${JSON.stringify({ api_base: manifest.api_base, endpoints: manifest.endpoints, version: manifest.version })};
  window.__LOVABLE_MSK__ = CFG;
  window.dispatchEvent(new CustomEvent("lovable-msk:runtime", { detail: CFG }));
  console.info("[LOVABLE MSK] runtime de compatibilidade carregado (v" + CFG.version + ").");
})();
`;
}
