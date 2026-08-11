/**
 * Web Push (RFC 8291 / aes128gcm) implementado com Web Crypto puro,
 * compatível com o runtime serverless (sem dependências Node-only).
 * As chaves VAPID nunca saem do servidor.
 */

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

async function vapidToken(audience: string): Promise<{ jwt: string; publicKey: string }> {
  const { getVapidKeys } = await import("./push-config.server");
  const keys = await getVapidKeys();
  if (!keys) throw new Error("PUSH_NAO_CONFIGURADO");
  const { publicKey, privateKey, subject } = keys;

  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const unsigned = `${header}.${payload}`;

  const raw = Uint8Array.from(atob(privateKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", raw as BufferSource, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned) as BufferSource),
  );
  return { jwt: `${unsigned}.${bytesToB64url(sig)}`, publicKey };
}


async function encryptPayload(payload: string, p256dh: string, authSecret: string) {
  const uaPublic = b64urlToBytes(p256dh);
  const auth = b64urlToBytes(authSecret);

  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));

  const prkKey = await hmac(auth, shared);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const plaintext = concat(enc.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, plaintext as BufferSource),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export type PushPayload = {
  title: string;
  body: string;
  icon?: string | null;
  image?: string | null;
  link?: string | null;
  tag?: string | null;
  notificationId?: string | null;
};

/** Envia um push real para uma subscription. Retorna o status HTTP do serviço. */
export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<{ ok: boolean; status: number; gone: boolean; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const { jwt, publicKey } = await vapidToken(`${url.protocol}//${url.host}`);
    const body = await encryptPayload(JSON.stringify(payload), subscription.p256dh, subscription.auth);

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        TTL: "86400",
        Urgency: "high",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Authorization: `vapid t=${jwt}, k=${publicKey}`,
      },
      body: body as BodyInit,
    });
    return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: (e as Error).message };
  }
}

export function pushPublicKey(): string | null {
  return process.env["VAPID_PUBLIC_KEY"] ?? null;
}
