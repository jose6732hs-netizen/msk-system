import { getPushPublicKey, registerPushDevice } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Pede permissão ao navegador e registra o dispositivo para receber push.
 * Retorna o motivo da falha em vez de lançar, para a UI decidir o que mostrar.
 */
export async function enablePushNotifications(): Promise<
  { ok: true } | { ok: false; reason: "unsupported" | "denied" | "no-vapid" | "error"; message: string }
> {
  if (!pushSupported()) {
    return { ok: false, reason: "unsupported", message: "Este navegador não suporta notificações push." };
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "denied", message: "Permissão de notificações negada pelo navegador." };
    }

    const { publicKey } = await getPushPublicKey();
    if (!publicKey) {
      return {
        ok: false,
        reason: "no-vapid",
        message: "As notificações ainda não foram configuradas pelo administrador.",
      };
    }

    const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    await registerPushDevice({
      data: {
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh: json.keys?.p256dh ?? bufToB64url(sub.getKey("p256dh")),
        auth: json.keys?.auth ?? bufToB64url(sub.getKey("auth")),
        deviceId: `${navigator.platform}-${Math.abs(navigator.userAgent.length * 7919)}`,
        browser: navigator.userAgent.split(") ").pop() ?? "desconhecido",
        platform: navigator.platform,
        userAgent: navigator.userAgent.slice(0, 380),
      },
    });
    localStorage.setItem("msk_push_enabled", "1");
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}
