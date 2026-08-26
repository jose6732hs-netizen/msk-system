import type { SupabaseClient } from "@supabase/supabase-js";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

/**
 * Reads the signed-in user's own data using the authenticated client (RLS applies).
 * Read-only: never mutates state and never touches the service role.
 */
export async function buildUserContext(supabase: SupabaseClient<any>, userId: string) {
  const [profile, roles, licenses, plans] = await Promise.all([
    supabase.from("profiles").select("name, email, phone, created_at").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("licenses")
      .select("status, type, token_last4, activated_at, expires_at, max_devices, activation_count, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("plans")
      .select("name, price, duration_days, description")
      .eq("is_active", true)
      .limit(20),
  ]);

  return {
    perfil: profile.data ?? null,
    papeis: (roles.data ?? []).map((r: any) => r.role),
    licencas: licenses.data ?? [],
    planos_disponiveis: plans.data ?? [],
  };
}

function systemPrompt(context: unknown) {
  return [
    "Você é o Assistente MSK, o suporte virtual dentro do painel do MSK SISTEM.",
    "Responda sempre em português do Brasil, de forma curta, objetiva e cordial.",
    "Use apenas os dados do contexto abaixo para falar sobre a conta do usuário. Nunca invente valores, datas ou status.",
    "Você não executa ações: para gerar licença, sacar comissão, comprar plano ou aprovar afiliado, oriente o usuário a usar os botões do painel.",
    "Nunca revele tokens completos, chaves, senhas ou dados de outros usuários.",
    "Se a informação não estiver no contexto, diga que não tem acesso e sugira o caminho no painel ou o suporte no WhatsApp.",
    "",
    "CONTEXTO DO USUÁRIO (JSON):",
    JSON.stringify(context),
  ].join("\n");
}

export async function askAssistant(params: {
  apiKey: string;
  messages: AssistantMessage[];
  context: unknown;
}): Promise<{ ok: true; reply: string } | { ok: false; status: number; error: string }> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt(params.context) },
        ...params.messages.slice(-12),
      ],
    }),
  });

  if (!res.ok) {
    let message = `Falha na IA (HTTP ${res.status}).`;
    try {
      const body = (await res.json()) as { message?: string; error?: { message?: string } };
      message = body.message ?? body.error?.message ?? message;
    } catch {
      /* mantém a mensagem padrão */
    }
    if (res.status === 429) message = "Muitas solicitações agora. Aguarde alguns segundos e tente de novo.";
    if (res.status === 402) message = "Os créditos de IA da plataforma acabaram. Avise o administrador.";
    return { ok: false, status: res.status, error: message };
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) return { ok: false, status: 502, error: "A IA não retornou resposta. Tente novamente." };
  return { ok: true, reply };
}
