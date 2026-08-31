import { supabaseServer } from "@/integrations/supabase/client.server";

export type GlobalTrainingRow = {
  id: string;
  version: number;
  title: string;
  instruction: string;
  category: string;
  priority: number;
  published_at?: string | null;
};

const MAX_GLOBAL_TRAINING_CHARS = 16000;

export function compileGlobalTraining(rows: GlobalTrainingRow[] | null | undefined) {
  const active = Array.isArray(rows) ? rows : [];
  if (!active.length) return { text: "", versions: [] as number[], count: 0 };

  const blocks: string[] = [];
  const versions: number[] = [];
  let used = 0;

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

  if (!blocks.length) return { text: "", versions: [] as number[], count: 0 };

  return {
    text: [
      "TREINAMENTO GLOBAL MSK — CONTEXTO OPERACIONAL PERSISTENTE",
      "As instruções abaixo foram publicadas pelo Super Admin e devem orientar todas as respostas e execuções do MSK.",
      "Elas complementam o pedido específico do cliente; não substituem autenticação, isolamento entre usuários, proteção de segredos, integridade, validações de segurança ou políticas da plataforma.",
      "Quando duas instruções globais conflitarem, priorize a de menor número de prioridade e, em seguida, a versão mais recente aplicável.",
      "",
      ...blocks,
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
    return { text: "", versions: [] as number[], count: 0 };
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
    "Aponte também qualquer ambiguidade ou conflito de segurança. Segurança, autenticação, RLS, isolamento multiusuário e proteção de segredos sempre prevalecem.",
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
