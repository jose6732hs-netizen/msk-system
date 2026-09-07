import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptToken, findLicenseByToken } from "@/lib/license.server";
import { resolveLicenseScope } from "@/lib/license-scope.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function randomString(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let raw = "";
  for (const byte of data) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function page(title: string, message: string, ok = true) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{margin:0;background:#050507;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh}.card{width:min(460px,88vw);padding:30px;border-radius:22px;background:#101015;border:1px solid ${ok ? "#39ff88" : "#ff5d7d"};box-shadow:0 20px 80px #0008}h1{margin:0 0 12px;color:${ok ? "#39ff88" : "#ff7a91"};font-size:22px}p{color:#c7c8cd;line-height:1.55}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p><p>Você pode fechar esta aba e voltar ao MSK Agente.</p></div></body></html>`, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function validate(body: any) {
  const token = String(body?.license || body?.token || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  if (!token || !email) return { ok: false as const, status: 401, error: "LICENSE_REQUIRED" };
  const license = (await findLicenseByToken(token)) as any;
  if (!license || String(license.status || "").toLowerCase() !== "active") {
    return { ok: false as const, status: 403, error: "LICENSE_INVALID" };
  }
  if (license.expires_at && new Date(license.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, status: 403, error: "LICENSE_EXPIRED" };
  }
  const scope = await resolveLicenseScope(license, "agent");
  if (scope.scope !== "agent" && scope.scope !== "extension") {
    return { ok: false as const, status: 403, error: "LICENSE_PRODUCT_MISMATCH" };
  }
  const { data } = await supabaseAdmin.auth.admin.getUserById(String(license.user_id));
  const accountEmail = String(data?.user?.email || "").trim().toLowerCase();
  if (accountEmail && accountEmail !== email) {
    return { ok: false as const, status: 403, error: "LICENSE_EMAIL_MISMATCH" };
  }
  return { ok: true as const, userId: String(license.user_id) };
}

export const Route = createFileRoute("/api/public/msk-cloud-bridge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const claim = String(new URL(request.url).searchParams.get("claim") || "");
        if (!claim) return page("Vinculação inválida", "Esse link não contém uma autorização válida.", false);

        const { data: row } = await supabaseAdmin
          .from("msk_oauth_connections")
          .select("id,metadata")
          .eq("provider", "lovable_cloud")
          .eq("state", claim)
          .is("revoked_at", null)
          .maybeSingle();

        if (!row) return page("Vinculação expirada", "Esse link já foi usado ou expirou. Volte ao MSK Agente e tente novamente.", false);

        const metadata = {
          ...(((row as any).metadata || {}) as Record<string, unknown>),
          claimed: true,
          claimedAt: new Date().toISOString(),
        };
        await supabaseAdmin
          .from("msk_oauth_connections")
          .update({ state: null, metadata, updated_at: new Date().toISOString() } as never)
          .eq("id", (row as any).id);

        return page("Lovable Cloud conectado", "A conexão entre o projeto Lovable Cloud e o MSK foi confirmada com sucesso.", true);
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as any;
        const auth = await validate(body);
        if (!auth.ok) return respond({ ok: false, error: auth.error }, auth.status);

        const action = String(body.action || "status").toLowerCase();
        const projectId = String(body.projectId || "").trim();

        if (action === "link") {
          if (!projectId) return respond({ ok: false, error: "PROJECT_REQUIRED" }, 400);
          const claim = randomString(32);
          const ref = String(body.ref || "");
          const projectName = String(body.projectName || "Lovable Cloud");

          await supabaseAdmin
            .from("msk_oauth_connections")
            .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
            .eq("user_id", auth.userId)
            .eq("provider", "lovable_cloud")
            .contains("metadata", { projectId })
            .is("revoked_at", null);

          const encrypted = await encryptToken(JSON.stringify({ projectId, ref, managed: !!body.managed }));
          const { error } = await supabaseAdmin.from("msk_oauth_connections").insert({
            user_id: auth.userId,
            provider: "lovable_cloud",
            state: claim,
            encrypted_value: encrypted,
            metadata: { projectId, projectName, ref, managed: !!body.managed, claimed: false },
          } as never);
          if (error) return respond({ ok: false, error: "LINK_STORE_FAILED", message: error.message }, 500);

          return respond({
            ok: true,
            linked: true,
            claimed: false,
            claimUrl: `https://msksystem.online/api/public/msk-cloud-bridge?claim=${encodeURIComponent(claim)}`,
          });
        }

        if (action === "status") {
          if (!projectId) return respond({ ok: false, error: "PROJECT_REQUIRED" }, 400);
          const { data } = await supabaseAdmin
            .from("msk_oauth_connections")
            .select("id,metadata,updated_at")
            .eq("user_id", auth.userId)
            .eq("provider", "lovable_cloud")
            .contains("metadata", { projectId })
            .is("revoked_at", null)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return respond({ ok: true, linked: !!data, claimed: !!((data as any)?.metadata?.claimed), projectId });
        }

        if (action === "disconnect") {
          let query: any = supabaseAdmin
            .from("msk_oauth_connections")
            .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
            .eq("user_id", auth.userId)
            .eq("provider", "lovable_cloud")
            .is("revoked_at", null);
          if (projectId) query = query.contains("metadata", { projectId });
          await query;
          return respond({ ok: true, linked: false });
        }

        return respond({ ok: false, error: "UNKNOWN_ACTION" }, 400);
      },
    },
  },
});
