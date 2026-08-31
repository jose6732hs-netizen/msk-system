import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ausente no servidor: ${name}`);
  return value;
};

const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
const supabaseUrl = required("SUPABASE_URL");
const db = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const encoder = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromB64url = (value: string) =>
  Uint8Array.from(
    atob(
      value
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "="),
    ),
    (c) => c.charCodeAt(0),
  );

async function encryptionKey() {
  const configured = Deno.env.get("MSK_TOKEN_ENCRYPTION_KEY")?.trim();
  let raw: Uint8Array;

  if (configured) {
    raw = /^[A-Za-z0-9_-]{43,44}$/.test(configured)
      ? fromB64url(configured)
      : encoder.encode(configured);
    if (raw.length !== 32) {
      throw new Error("MSK_TOKEN_ENCRYPTION_KEY deve possuir exatamente 32 bytes.");
    }
  } else {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`msk-ai-settings:v1:${serviceRole}`),
    );
    raw = new Uint8Array(digest);
  }

  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
}

async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await encryptionKey(),
      encoder.encode(value),
    ),
  );
  return b64url(new Uint8Array([...iv, ...cipher]));
}

async function currentAdmin(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: roles, error: rolesError } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .in("role", ["admin", "super_admin"]);

  if (rolesError || !roles?.length) return null;
  return data.user;
}

async function validateBaiKey(apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.b.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [{ role: "user", content: "Reply only OK" }],
        max_tokens: 8,
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let body: any = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const providerMessage = String(
        body?.error?.message || body?.message || `B.AI respondeu HTTP ${response.status}`,
      ).slice(0, 300);
      const error = new Error(providerMessage);
      (error as any).status = [401, 403].includes(response.status) ? 400 : 502;
      throw error;
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("A B.AI demorou demais para validar a chave. Tente novamente.");
      (timeoutError as any).status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const admin = await currentAdmin(req);
    if (!admin) return json({ error: "Acesso restrito a administradores." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "ai-global-status") {
      const { data, error } = await db
        .from("msk_ai_settings")
        .select("provider,model,api_key_ciphertext,api_key_last4,active,updated_at")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw error;

      return json({
        configured: !!(data?.active && data?.api_key_ciphertext && data?.api_key_last4),
        provider: data?.provider || "B.AI",
        model: data?.model || "deepseek-v4-flash",
        keyMasked: data?.api_key_last4 ? `••••${data.api_key_last4}` : null,
        updatedAt: data?.updated_at || null,
      });
    }

    if (action === "ai-global-save") {
      const apiKey = String(body?.apiKey || "").trim();
      if (apiKey.length < 16 || apiKey.length > 600) {
        return json({ error: "API key inválida." }, 400);
      }

      await validateBaiKey(apiKey);
      const ciphertext = await encrypt(apiKey);
      const now = new Date().toISOString();
      const last4 = apiKey.slice(-4);

      const { data: saved, error } = await db.from("msk_ai_settings").upsert(
        {
          id: "default",
          provider: "B.AI",
          model: "deepseek-v4-flash",
          api_base_url: "https://api.b.ai/v1/chat/completions",
          api_key_ciphertext: ciphertext,
          api_key_last4: last4,
          active: true,
          updated_by: admin.id,
          updated_at: now,
        },
        { onConflict: "id" },
      ).select("id,provider,model,api_key_ciphertext,api_key_last4,active,updated_at").single();
      if (error) throw error;
      if (!saved?.active || !saved.api_key_ciphertext || saved.api_key_last4 !== last4) {
        const persistenceError = new Error("A chave foi validada, mas o banco não confirmou a gravação. Tente novamente.");
        (persistenceError as any).status = 500;
        throw persistenceError;
      }

      return json({
        ok: true,
        configured: true,
        provider: saved.provider || "B.AI",
        model: saved.model || "deepseek-v4-flash",
        keyMasked: `••••${saved.api_key_last4}`,
        updatedAt: saved.updated_at || now,
      });
    }

    if (action === "ai-global-delete") {
      const { error } = await db.from("msk_ai_settings").delete().eq("id", "default");
      if (error) throw error;
      return json({ ok: true, configured: false });
    }

    return json({ error: "Ação não reconhecida." }, 400);
  } catch (error: any) {
    console.error("msk-ai-settings", error?.message || error);
    const status = Number(error?.status || 500);
    return json(
      { error: String(error?.message || "Falha interna ao configurar a IA.").slice(0, 500) },
      status >= 400 && status <= 599 ? status : 500,
    );
  }
});
