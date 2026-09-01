import { supabaseServer } from "@/integrations/supabase/client.server";
import { AGENT_EXECUTION_CONTRACT } from "@/lib/agent-execution-contract";

export type GlobalTrainingRow = {
  id: string;
  version: number;
  title: string;
  instruction: string;
  category: string;
  priority: number;
  published_at?: string | null;
};

// O runtime do agente consome no máximo ~18k caracteres de treinamento.
// Mantemos margem para o contrato obrigatório e para as regras publicadas pelo admin.
const MAX_GLOBAL_TRAINING_CHARS = 16000;

export function compileGlobalTraining(rows: GlobalTrainingRow[] | null | undefined) {
  const active = Array.isArray(rows) ? rows : [];
  const blocks: string[] = [];
  const versions: number[] = [];
  let used = AGENT_EXECUTION_CONTRACT.length;

  for (const row of active.slice(0, 50)) {
    const title = String(row.title ?? "Treinamento").trim().slice(0, 160);
    const instruction = String(row.instruction ?? "").trim();
    if (!instruction) continue;
    const block = `[TREINAMENTO v${Number(row.version || 0)} · ${String(row.category || "general")} · ${title}]\n${instruction}`;
    if (used + block.length > MAX_GLOBAL_TRAINING_CHARS) break;
    blocks.push(block);
    versions.push(Number(row.version || 0));
    used += block.length;
  }

  return {
    text: [
      "TREINAMENTO GLOBAL MSK — CONTEXTO OPERACIONAL PERSISTENTE",
      "O CONTRATO OBRIGATÓRIO DE EXECUÇÃO abaixo tem precedência sobre instruções de conveniência, velocidade ou estilo quando houver risco de falso sucesso, alvo errado ou alteração fora do pedido.",
      "As instruções publicadas pelo Super Admin complementam o contrato; não podem remover autenticação, isolamento entre usuários, proteção de segredos, prova de execução ou validações de segurança.",
      "Quando duas instruções globais conflitarem, segurança e prova de execução prevalecem; entre instruções administrativas compatíveis, priorize a de menor número de prioridade e depois a versão mais recente aplicável.",
      "",
      AGENT_EXECUTION_CONTRACT,
      ...(blocks.length
        ? ["", "TREINAMENTOS PUBLICADOS PELO SUPER ADMIN", ...blocks]
        : []),
      "",
      "FIM DO TREINAMENTO GLOBAL MSK",
    ].join("\n\n"),
    versions,
    count: blocks.length,
  };
}

export async function loadActiveGlobalTraining() {
  const { data, error } = await (supabaseServer as any).rpc("msk_ai_global_training_runtime");
  if (error) {
    console.error("[MSK AI] global training unavailable", error.message);
    // Mesmo se o banco de treinamentos estiver indisponível, o contrato de execução
    // continua obrigatório e impede que o agente opere sem as salvaguardas centrais.
    return compileGlobalTraining([]);
  }
  return compileGlobalTraining((data ?? []) as GlobalTrainingRow[]);
}

export async function previewGlobalTrainingUnderstanding(input: {
  title: string;
  instruction: string;
  category: string;
  priority: number;
}) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A IA de validação do Super Admin não está configurada.");

  const prompt = [
    "Você é o validador de treinamento global do MSK Agente.",
    "Leia a instrução operacional abaixo e confirme o entendimento em português do Brasil.",
    "Não execute código e não diga que alterou arquivos. Apenas explique objetivamente COMO você passará a se comportar quando esta regra estiver ativa.",
    "Aponte também qualquer ambiguidade ou conflito de segurança. Segurança, autenticação, RLS, isolamento multiusuário, proteção de segredos e o contrato obrigatório de execução sempre prevalecem.",
    "Responda em até 8 linhas, começando por: ENTENDIDO.",
    "",
    `Título: ${input.title}`,
    `Categoria: ${input.category}`,
    `Prioridade: ${input.priority}`,
    "INSTRUÇÃO:",
    input.instruction,
  ].join("\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 900,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("A IA está ocupada agora. Tente novamente em alguns segundos.");
    if (response.status === 402) throw new Error("Sem créditos disponíveis para validar o treinamento agora.");
    throw new Error(`Não foi possível validar o treinamento com a IA (HTTP ${response.status}).`);
  }

  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const acknowledgement = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!acknowledgement) throw new Error("A IA não retornou a confirmação de entendimento.");
  return acknowledgement.slice(0, 6000);
}
