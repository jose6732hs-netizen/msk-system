import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptToken, decryptToken } from "./license.server";

const SETTINGS_KEY = "vapid_keys";

export type VapidKeys = { publicKey: string; privateKey: string; subject: string; source: "database" | "env" };

/** Chaves VAPID: prioriza as cadastradas no admin (privada criptografada), com fallback nos secrets. */
export async function getVapidKeys(): Promise<VapidKeys | null> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  const value = (data as { value?: Record<string, string> } | null)?.value;
  if (value?.["public_key"] && value?.["private_key_encrypted"]) {
    const privateKey = await decryptToken(value["private_key_encrypted"]);
    if (privateKey) {
      return {
        publicKey: value["public_key"],
        privateKey,
        subject: value["subject"] || "mailto:suporte@lovable.app",
        source: "database",
      };
    }
  }

  const envPublic = process.env["VAPID_PUBLIC_KEY"];
  const envPrivate = process.env["VAPID_PRIVATE_KEY"];
  if (envPublic && envPrivate) {
    return {
      publicKey: envPublic,
      privateKey: envPrivate,
      subject: process.env["VAPID_SUBJECT"] ?? "mailto:suporte@lovable.app",
      source: "env",
    };
  }
  return null;
}

/** Salva as chaves informadas pelo admin. A chave privada é criptografada antes de gravar. */
export async function saveVapidKeys(input: { publicKey: string; privateKey: string; subject?: string }) {
  const encrypted = await encryptToken(input.privateKey.trim());
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    {
      key: SETTINGS_KEY,
      value: {
        public_key: input.publicKey.trim(),
        private_key_encrypted: encrypted,
        subject: (input.subject || "mailto:suporte@lovable.app").trim(),
      },
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Gera um novo par de chaves VAPID válido (P-256). A privada volta em base64 PKCS8. */
export async function generateVapidPair() {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const priv = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  let s = "";
  for (const b of priv) s += String.fromCharCode(b);
  return { publicKey: b64url(pub), privateKey: btoa(s) };
}

/** Valida as chaves configuradas assinando um token VAPID de teste. */
export async function testVapidConnection() {
  const keys = await getVapidKeys();
  if (!keys) return { ok: false, message: "Nenhuma chave VAPID configurada." };
  try {
    const raw = Uint8Array.from(atob(keys.privateKey), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("pkcs8", raw as BufferSource, { name: "ECDSA", namedCurve: "P-256" }, false, [
      "sign",
    ]);
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode("ping") as BufferSource);
    const { count } = await supabaseAdmin
      .from("push_devices")
      .select("id", { count: "exact", head: true })
      .eq("active", true as never);
    return {
      ok: true,
      message: `Chaves válidas (${keys.source === "database" ? "cadastradas no admin" : "secrets do servidor"}).`,
      publicKey: keys.publicKey,
      devices: count ?? 0,
    };
  } catch (e) {
    return { ok: false, message: `Chave privada inválida: ${(e as Error).message}` };
  }
}
