import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = [
  "Você é o MSK Agente, o agente técnico oficial do MSK SISTEM.",
  "Responda sempre em português do Brasil, de forma curta, técnica e profissional.",
  "Seu papel: ajudar o usuário a entender, planejar e preparar alterações no projeto dele.",
  "Nunca afirme que editou, publicou, fez merge ou executou qualquer ação: você apenas planeja e explica.",
  "Ações destrutivas, merge ou publicação exigem confirmação explícita do usuário e execução pelo backend.",
  "Se faltar informação, peça o que precisa em vez de supor.",
].join("\n");

type ChatMessage = { role: "user" | "assistant"; content: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/agent/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        if (!token) return json({ error: "Sessão não encontrada. Entre novamente." }, 401);

        const SUPABASE_URL = process.env["SUPABASE_URL"];
        const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return json({ error: "Backend indisponível no momento." }, 500);
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (
                SUPABASE_PUBLISHABLE_KEY.startsWith("sb_") &&
                headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
              ) {
                headers.delete("Authorization");
              }
              headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
              if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) {
          return json({ error: "Sessão inválida ou expirada." }, 401);
        }
        const userId = userData.user.id;

        // Licença ativa OU papel administrativo liberam o agente.
        const [licenses, roles] = await Promise.all([
          supabase
            .from("licenses")
            .select("id, status, expires_at")
            .eq("user_id", userId)
            .eq("status", "active")
            .limit(1),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);

        const isAdmin = (roles.data ?? []).some((r: { role: string }) =>
          ["admin", "super_admin"].includes(r.role),
        );
        const hasLicense = (licenses.data ?? []).length > 0;
        if (!hasLicense && !isAdmin) {
          return json(
            { error: "Seu plano atual não inclui o MSK Agente.", requiresPlan: true },
            403,
          );
        }

        let payload: { messages?: ChatMessage[] };
        try {
          payload = (await request.json()) as { messages?: ChatMessage[] };
        } catch {
          return json({ error: "Requisição inválida." }, 400);
        }

        const messages = (payload.messages ?? [])
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim().length > 0,
          )
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

        if (messages.length === 0) return json({ error: "Envie uma mensagem." }, 400);

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return json(
            { error: "Provider de IA pendente de configuração. O chat será liberado em breve." },
            503,
          );
        }

        const aiRes = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          }),
        });

        if (!aiRes.ok) {
          let message = `Falha na IA (HTTP ${aiRes.status}).`;
          if (aiRes.status === 429) message = "Muitas solicitações. Aguarde alguns segundos.";
          if (aiRes.status === 402) message = "Créditos de IA esgotados. Avise o administrador.";
          return json({ error: message }, aiRes.status === 429 ? 429 : 502);
        }

        const data = (await aiRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (!reply) return json({ error: "O agente não retornou resposta." }, 502);

        return json({ reply });
      },
    },
  },
});
