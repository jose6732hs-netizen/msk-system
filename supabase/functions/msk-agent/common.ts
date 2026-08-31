import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license, x-msk-installation-id, x-msk-extension-version, x-msk-extension-id, x-msk-build-id, x-msk-integrity-root, x-msk-build-fingerprint, x-msk-device-session, x-msk-proof-version, x-msk-timestamp, x-msk-counter, x-msk-body-sha256, x-msk-signature, x-msk-target, x-msk-action",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
export const env = (name: string) => { const v = Deno.env.get(name); if (!v) throw new Error(`Secret ausente: ${name}`); return v; };
export const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
export const enc = new TextEncoder(), dec = new TextDecoder();
export const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64 = (v: string) => Uint8Array.from(atob(v.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(v.length / 4) * 4, "=")), c => c.charCodeAt(0));
export const sha = async (v: string) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(v))));
const token = (r: Request) => (r.headers.get("authorization") || r.headers.get("x-msk-license") || "").replace(/^Bearer\s+/i, "").trim();

export const identity = async (r: Request) => {
  const t = token(r);
  if (!t || t.startsWith("sb_publishable_")) return null;
  const a = await db.auth.getUser(t);
  if (!a.error && a.data.user) return { id: a.data.user.id, license_id: "" };
  for (const o of ["https://msksystem.online", "https://msk-system.lovable.app"]) {
    try {
      const x = await fetch(`${o}/api/extension/license-identity`, { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: "{}" });
      if (!x.ok) continue;
      const d = await x.json();
      if (d?.ok && d?.active && /^[0-9a-f-]{36}$/i.test(String(d.user_id))) return { id: String(d.user_id), license_id: String(d.license_id || "") };
    } catch {}
  }
  return null;
};

const proof = ["x-msk-installation-id", "x-msk-extension-version", "x-msk-extension-id", "x-msk-build-id", "x-msk-integrity-root", "x-msk-build-fingerprint", "x-msk-device-session", "x-msk-proof-version", "x-msk-timestamp", "x-msk-counter", "x-msk-body-sha256", "x-msk-signature", "x-msk-target", "x-msk-action"];
export async function verifyDevice(r: Request, raw: string, action: string) {
  const buildId = String(r.headers.get("x-msk-build-id") || "").trim();
  if (!buildId) return { ok: true, status: 200, code: "", legacy: true };
  const auth = r.headers.get("authorization") || r.headers.get("x-msk-license") || "";
  if (!auth || proof.some(n => !r.headers.get(n))) return { ok: false, status: 401, code: "DEVICE_IDENTITY_REQUIRED" };
  const target = String(r.headers.get("x-msk-target") || "");
  if (String(r.headers.get("x-msk-action") || "") !== action || !["msk-agent", "msk-agent-public"].includes(target)) return { ok: false, status: 400, code: "ACTION_TARGET_INVALID" };
  const bh = await sha(raw);
  if (bh !== r.headers.get("x-msk-body-sha256")) return { ok: false, status: 401, code: "SECURITY_BODY_MISMATCH" };
  const h: Record<string, string> = { Authorization: auth, "Content-Type": "application/json" };
  for (const n of proof) h[n] = String(r.headers.get(n) || "");
  try {
    const x = await fetch("https://msksystem.online/api/extension/device-authorize", { method: "POST", headers: h, body: JSON.stringify({ body_sha256: bh }) });
    const d = await x.json().catch(() => ({}));
    if (x.ok && d?.device_authorized) return { ok: true, status: 200, code: "" };
    if (d?.blocked || d?.code === "INSTALLATION_BLOCKED") return { ok: false, status: 403, code: "INSTALLATION_BLOCKED" };
    return { ok: false, status: x.status || 403, code: String(d?.code || "MSK_SECURITY_REJECTED") };
  } catch {
    return { ok: false, status: 503, code: "MSK_SECURITY_UNAVAILABLE" };
  }
}
