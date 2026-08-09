/** Kill-switch e config da extensão reserva (LVB.Up). Somente servidor. */
import { getSetting, setSetting } from "./commerce.server";
import { logAudit } from "./audit.server";

export const RESERVE_KEY = "reserve_extension";

export type ReserveConfig = {
  enabled: boolean;
  version: string;
  message: string;
};

const DEFAULT: ReserveConfig = {
  enabled: false,
  version: "4.0.2",
  message: "Extensão reserva desativada pelo administrador.",
};

export async function getReserveConfig(): Promise<ReserveConfig> {
  try {
    const { getExtensionChannel } = await import("./extension-channels.server");
    const channel = await getExtensionChannel("lvbup-reserva-01");
    if (channel) {
      return { enabled: channel.enabled, version: channel.version, message: channel.message };
    }
  } catch {
    // Compatibilidade durante atualizações do schema.
  }
  const stored = await getSetting<Partial<ReserveConfig>>(RESERVE_KEY, {});
  return { ...DEFAULT, ...stored, enabled: stored.enabled === true };
}

export async function saveReserveConfig(
  input: { enabled: boolean; version?: string | undefined; message?: string | undefined },
  actorId: string,
) {
  const current = await getReserveConfig();
  const next: ReserveConfig = {
    enabled: input.enabled,
    version: input.version?.trim() || current.version,
    message: input.message?.trim() || current.message,
  };
  await setSetting(RESERVE_KEY, next);
  try {
    const { getExtensionChannel, saveExtensionChannel } = await import("./extension-channels.server");
    const channel = await getExtensionChannel("lvbup-reserva-01");
    if (channel) {
      await saveExtensionChannel(
        { id: channel.id, enabled: next.enabled, version: next.version, message: next.message },
        actorId,
      );
    }
  } catch {
    // O setting legado continua sendo a reserva de compatibilidade.
  }
  await logAudit({
    userId: actorId,
    action: input.enabled ? "extension.reserve.enabled" : "extension.reserve.disabled",
    resource: "app_settings",
    metadata: { version: next.version },
  });
  return next;
}