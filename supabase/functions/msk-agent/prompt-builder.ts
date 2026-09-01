export type PromptOperation = "interpretation" | "planning" | "edit" | "self_healing" | "validation" | "chat";

export type PromptFile = { path: string; content: string };

export type PromptEnvelope = {
  version: 1;
  operation: "interpretation" | "edit";
  command: string;
  repository?: string;
  candidates?: string[];
  files?: PromptFile[];
  highRisk?: boolean;
  complex?: boolean;
};

export type BuiltPrompt = {
  operation: PromptOperation;
  system: string;
  user: string;
  assistantContext?: string;
  jsonMode: boolean;
};

const PREFIX = "__MSK_PROMPT_V1__";
const clean = (value: unknown, max = 120000) => String(value ?? "").trim().slice(0, max);

export function isComplexCommand(command: string, files: PromptFile[] = [], highRisk = false) {
  const text = clean(command, 12000).toLowerCase();
  if (highRisk || files.length > 2) return true;
  if (text.split(/\s+/).length > 28) return true;
  return /\b(criar|implementar|adicionar|integrar|checkout|login|autentica|banco|database|migration|webhook|api|dashboard|pagina|página|fluxo|sistema|feature|funcionalidade)\b/i.test(text);
}

export function encodePromptEnvelope(input: Omit<PromptEnvelope, "version">) {
  const envelope: PromptEnvelope = { version: 1, ...input };
  return `${PREFIX}${JSON.stringify(envelope)}`;
}

export function decodePromptEnvelope(raw: string): { envelope: PromptEnvelope; extra: string } | null {
  const text = String(raw || "");
  if (!text.startsWith(PREFIX)) return null;
  const lineEnd = text.indexOf("\n");
  const encoded = (lineEnd >= 0 ? text.slice(PREFIX.length, lineEnd) : text.slice(PREFIX.length)).trim();
  try {
    const envelope = JSON.parse(encoded) as PromptEnvelope;
    if (envelope?.version !== 1 || !envelope.command || !["interpretation", "edit"].includes(envelope.operation)) return null;
    return { envelope, extra: lineEnd >= 0 ? text.slice(lineEnd + 1).trim() : "" };
  } catch {
    return null;
  }
}

function filesBlock(files: PromptFile[] = []) {
  return files.map((file) => `Arquivo: ${file.path}\n${file.content}`).join("\n\n").slice(0, 120000);
}

function candidatesBlock(candidates: string[] = []) {
  return candidates.slice(0, 100).join("\n");
}

function retryError(extra: string) {
  const text = clean(extra, 6000);
  const inline = text.match(/Corrija somente:\s*([\s\S]+)$/i)?.[1]?.trim();
  if (inline) return inline.slice(0, 5000);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines[0]?.toUpperCase().includes("AUTO-CORREÇÃO") || lines[0]?.toUpperCase().includes("AUTO-CORRECAO")) lines.shift();
  return lines.join("\n").slice(0, 5000) || "A saída anterior não passou na validação do backend.";
}

export class PromptBuilder {
  static interpretation(envelope: PromptEnvelope): BuiltPrompt {
    return {
      operation: "interpretation",
      jsonMode: true,
      system: [
        "Você interpreta pedidos de edição de código.",
        "Retorne somente JSON com intent, confidence, requires_input, question, options, summary, target_files, edits e validation.",
      ].join("\n"),
      user: `Comando: ${clean(envelope.command, 12000)}\nCandidatos:\n${candidatesBlock(envelope.candidates)}`,
    };
  }

  static planning(envelope: PromptEnvelope): BuiltPrompt {
    const paths = (envelope.files || []).map((file) => file.path).join("\n");
    return {
      operation: "planning",
      jsonMode: true,
      system: [
        "Gere um plano mínimo de edição em JSON para implementar exatamente o pedido.",
        "Retorne somente {\"steps\":[{\"action\":\"...\",\"files\":[\"...\"]}],\"summary\":\"...\"}.",
      ].join("\n"),
      user: `Comando: ${clean(envelope.command, 12000)}\nArquivos relevantes:\n${paths}`,
    };
  }

  static edit(envelope: PromptEnvelope, plan?: string): BuiltPrompt {
    return {
      operation: "edit",
      jsonMode: true,
      system: [
        "Você executa edição de código apenas para atender ao comando, usando os arquivos fornecidos e criando novos somente quando indispensável.",
        "Retorne somente JSON: {\"summary\":\"...\",\"reply\":\"...\",\"changes\":[{\"path\":\"...\",\"content\":\"arquivo completo\",\"create\":false}]}.",
        "Não use markdown, TODO, placeholders ou conteúdo truncado.",
      ].join("\n"),
      assistantContext: plan ? clean(plan, 7000) : undefined,
      user: `Comando: ${clean(envelope.command, 12000)}\n${filesBlock(envelope.files)}`,
    };
  }

  static selfHealing(envelope: PromptEnvelope, validationError: string): BuiltPrompt {
    return {
      operation: "self_healing",
      jsonMode: true,
      system: [
        "Corrija somente a causa do erro de validação mantendo o pedido e o alvo originais.",
        "Retorne novas mudanças no mesmo JSON de edição, sem ampliar o escopo.",
      ].join("\n"),
      user: `Erro: ${retryError(validationError)}\nComando original: ${clean(envelope.command, 12000)}\n${filesBlock(envelope.files)}`,
    };
  }

  static validation(command: string, repository: string, beforeAfter: string): BuiltPrompt {
    return {
      operation: "validation",
      jsonMode: true,
      system: [
        "Compare o pedido com o antes/depois e verifique apenas correspondência semântica e escopo.",
        "Retorne somente JSON {\"ok\":true,\"issues\":[]} ou {\"ok\":false,\"issues\":[\"motivo\"]}.",
      ].join("\n"),
      user: `Comando: ${clean(command, 12000)}\nRepositório: ${clean(repository, 300)}\n${clean(beforeAfter, 70000)}`,
    };
  }

  static chat(message: string): BuiltPrompt {
    return {
      operation: "chat",
      jsonMode: false,
      system: [
        "Você é o assistente técnico do MSK Agente.",
        "Responda em português do Brasil e não afirme que editou ou commitou código em uma chamada de conversa.",
      ].join("\n"),
      user: clean(message, 12000),
    };
  }
}

function parseJson(text: string): any {
  const cleanText = String(text || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const attempts = [cleanText];
  const first = cleanText.indexOf("{");
  const last = cleanText.lastIndexOf("}");
  if (first >= 0 && last > first) attempts.push(cleanText.slice(first, last + 1));
  for (const candidate of attempts) {
    try { return JSON.parse(candidate); } catch {}
  }
  throw new Error("PROMPT_RESPONSE_JSON_INVALID");
}

const strArray = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];

export function normalizeOperationResponse(text: string, operation: PromptOperation) {
  if (operation === "chat") return clean(text, 30000);
  const raw = parseJson(text);

  if (operation === "interpretation") {
    const targets = strArray(raw?.target_files || raw?.files || raw?.paths).slice(0, 12);
    const confidence = Math.max(0, Math.min(1, Number(raw?.confidence ?? (targets.length ? 0.75 : 0.35))));
    return JSON.stringify({
      intent: clean(raw?.intent || raw?.summary || "edit", 500),
      confidence,
      requires_input: raw?.requires_input === true,
      question: raw?.question ? clean(raw.question, 800) : null,
      options: strArray(raw?.options).slice(0, 8),
      summary: clean(raw?.summary || raw?.intent || "", 1000),
      target_files: targets,
      files: targets,
      edits: Array.isArray(raw?.edits) ? raw.edits.slice(0, 20) : [],
      validation: raw?.validation && typeof raw.validation === "object" ? raw.validation : {},
    });
  }

  if (operation === "planning") {
    const steps = Array.isArray(raw?.steps) ? raw.steps.slice(0, 12).map((step: any) => ({
      action: clean(step?.action || step?.description || "edit", 800),
      files: strArray(step?.files).slice(0, 12),
    })) : [];
    return JSON.stringify({ steps, summary: clean(raw?.summary || "", 1200) });
  }

  if (operation === "validation") {
    return JSON.stringify({ ok: raw?.ok === true, issues: strArray(raw?.issues).slice(0, 8) });
  }

  const changes = Array.isArray(raw?.changes || raw?.edits || raw?.updates) ? (raw.changes || raw.edits || raw.updates).slice(0, 20) : [];
  return JSON.stringify({
    summary: clean(raw?.summary || "Alteração preparada.", 1200),
    reply: clean(raw?.reply || raw?.summary || "", 1600),
    changes,
  });
}
