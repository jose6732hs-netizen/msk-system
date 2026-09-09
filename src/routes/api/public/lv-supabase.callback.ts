import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptToken } from "@/lib/license.server";

const CALLBACK_URL = "https://msksystem.online/api/public/lv-supabase/callback";
const TOKEN_URL = "https://api.supabase.com/v1/oauth/token";

function byteaToText(value: unknown) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("\\x")) return value;
  const hex = value.slice(2);
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder().decode(bytes);
}

function textToBytea(value: string) {
  return `\\x${Array.from(new TextEncoder().encode(value)).map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function page(title: string, message: string, ok = false) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{margin:0;background:#050507;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh}.card{width:min(440px,88vw);padding:30px;border-radius:22px;background:#101015;border:1px solid ${ok ? "#39ff88" : "#ff5d7d"};box-shadow:0 20px 80px #0008}h1{font-size:22px;margin:0 0 12px;color:${ok ? "#39ff88" : "#ff7a91"}}p{color:#c6c7cd;line-height:1.55}.small{font-size:12px;color:#777}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p><p class="small">Você pode fechar esta aba e voltar ao MSK Agente.</p></div></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const Route = createFileRoute("/api/public/lv-supabase/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = String(url.searchParams.get("code") || "");
        const state = String(url.searchParams.get("state") || "");
        const oauthError = String(url.searchParams.get("error_description") || url.searchParams.get("error") || "");
        if (oauthError) return page("Autorização cancelada", oauthError, false);
        if (!code || !state) return page("Autorização inválida", "O retorno do Supabase não contém os dados esperados.", false);

        const { data: pending } = await (supabaseAdmin as any)
          .from("agent_connections")
          .select("id,user_id,credential_ciphertext,provider_user_id,created_at")
          .eq("connector_id", "supabase_pending")
          .eq("provider_user_id", state)
          .maybeSingle();
        if (!pending) return page("Sessão expirada", "Inicie novamente a conexão pelo botão Conectar Supabase.", false);

        const encrypted = byteaToText((pending as any).credential_ciphertext);
        const plain = await decryptToken(encrypted);
        let verifier = "", createdAt = 0;
        try { const parsed = JSON.parse(plain || "{}"); verifier = String(parsed.verifier || ""); createdAt = Number(parsed.createdAt || 0); } catch (_) {}
        if (!verifier || !createdAt || Date.now() - createdAt > 10 * 60_000) {
          await (supabaseAdmin as any).from("agent_connections").delete().eq("id", (pending as any).id);
          return page("Sessão expirada", "A autorização demorou demais. Inicie novamente pelo MSK Agente.", false);
        }

        const clientId = String(process.env["SUPABASE_OAUTH_CLIENT_ID"] || "").trim();
        const clientSecret = String(process.env["SUPABASE_OAUTH_CLIENT_SECRET"] || "").trim();
        if (!clientId || !clientSecret) return page("Integração indisponível", "O OAuth do Supabase ainda não foi cadastrado no servidor MSK.", false);

        const tokenResponse = await fetch(TOKEN_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: CALLBACK_URL, code_verifier: verifier }),
        });
        const tokenData = await tokenResponse.json().catch(() => ({})) as any;
        if (!tokenResponse.ok || !tokenData.access_token) {
          return page("Falha ao conectar", String(tokenData.error_description || tokenData.error || `OAuth HTTP ${tokenResponse.status}`), false);
        }
        const credential = {
          access_token: String(tokenData.access_token),
          refresh_token: String(tokenData.refresh_token || ""),
          expires_at: Date.now() + Math.max(60, Number(tokenData.expires_in || 3600)) * 1000,
          selectedProjectRef: null,
        };
        const secured = await encryptToken(JSON.stringify(credential));
        await (supabaseAdmin as any)
          .from("agent_connections")
          .update({ connector_id: "supabase", credential_ciphertext: textToBytea(secured), provider_user_id: null, last_validated_at: new Date().toISOString(), updated_at: new Date().toISOString(), revoked_at: null } as never)
          .eq("id", (pending as any).id);
        await (supabaseAdmin as any)
          .from("agent_connections")
          .update({ revoked_at: new Date().toISOString() } as never)
          .eq("user_id", (pending as any).user_id)
          .eq("connector_id", "supabase")
          .neq("id", (pending as any).id)
          .is("revoked_at", null);
        return page("Supabase conectado", "Sua conta foi autorizada com sucesso. Volte ao MSK Agente para escolher o projeto.", true);
      },
    },
  },
});
