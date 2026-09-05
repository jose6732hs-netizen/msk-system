import { MSK_AGENT_PERSONA, MSK_SECURITY_RULES, MSK_CHAT_RULES, featureBlueprint } from "./behavior.ts";

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
  /** Contexto técnico determinístico montado pelo backend (projeto, repo, branch, skill). */
  context?: string;
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

function exactClientCommand(command: string) {
  return clean(command, 12000);
}

const EDIT_FORMAT = [
  "Retorne JSON com summary, reply e changes. changes NUNCA pode ser vazio.",
  "Use exatamente um dos caminhos de arquivo enviados no contexto, sem inventar caminho.",
  "Para alteração pequena em arquivo existente, prefira change com {path, find, replace}; find deve ser copiado LITERALMENTE do conteúdo enviado (mesma indentação) e ser único no arquivo.",
  "Se não tiver certeza de que o find é literal e único, devolva {path, content, create:false} com o arquivo COMPLETO já alterado.",
  "Para novo arquivo use {path, content, create:true}.",
  "O conteúdo final precisa ser diferente do original. Não use markdown, diff, TODO, reticências ou conteúdo truncado.",
].join("\n");

const EXECUTOR_RULES = [
  MSK_AGENT_PERSONA,
  MSK_SECURITY_RULES,
  "Você é o executor técnico do MSK System.",
  "Execute exatamente o pedido do cliente, modificando somente o necessário.",
  "Preserve toda a lógica existente e não remova funcionalidades não relacionadas.",
  "Não invente arquivos e não altere a arquitetura sem necessidade.",
  "Não altere banco, autenticação, pagamentos ou APIs se o pedido não envolver isso.",
  "Prefira editar arquivo existente. O projeto precisa continuar compilável.",
  "Não explique como fazer nem diga que vai fazer: gere operações executáveis.",
  "Em 'reply', escreva 1 a 3 frases em português do Brasil explicando ao cliente o que ficou pronto.",
].join("\n");

const executorSystem = (envelope: PromptEnvelope, extra = "") => {
  const blueprint = featureBlueprint(envelope.command);
  return [EXECUTOR_RULES, blueprint, extra, EDIT_FORMAT].filter(Boolean).join("\n");
};


const withContext = (envelope: PromptEnvelope, ...blocks: Array<string | undefined | false>) =>
  [envelope.context ? `CONTEXTO TÉCNICO MSK:\n${clean(envelope.context, 4000)}` : "", ...blocks]
    .filter(Boolean)
    .join("\n\n") || undefined;

export class PromptBuilder {
  static interpretation(envelope: PromptEnvelope): BuiltPrompt {
    return {
      operation: "interpretation",
      jsonMode: true,
      system: [
        "Interprete o pedido de edição e retorne somente JSON.",
        "Campos: intent, confidence, requires_input, question, options, summary, target_files, edits, validation.",
        "Erros ortográficos simples não devem impedir a identificação do alvo quando o contexto estiver claro.",
      ].join("\n"),
      assistantContext: withContext(envelope, envelope.candidates?.length ? `Arquivos candidatos:\n${candidatesBlock(envelope.candidates)}` : ""),
      user: exactClientCommand(envelope.command),
    };
  }

  static planning(envelope: PromptEnvelope): BuiltPrompt {
    const paths = (envelope.files || []).map((file) => file.path).join("\n");
    return {
      operation: "planning",
      jsonMode: true,
      system: "Gere um plano mínimo em JSON para executar exatamente o pedido.",
      assistantContext: withContext(envelope, paths ? `Arquivos relevantes:\n${paths}` : ""),
      user: exactClientCommand(envelope.command),
    };
  }

  static edit(envelope: PromptEnvelope, plan?: string): BuiltPrompt {
    return {
      operation: "edit",
      jsonMode: true,
      system: executorSystem(envelope),
      assistantContext: withContext(
        envelope,
        plan ? `Plano técnico:\n${clean(plan, 7000)}` : "",
        `CONTEÚDO RELEVANTE:\n${filesBlock(envelope.files)}`,
      ),
      user: exactClientCommand(envelope.command),
    };
  }

  static selfHealing(envelope: PromptEnvelope, validationError: string): BuiltPrompt {
    return {
      operation: "self_healing",
      jsonMode: true,
      system: `${EXECUTOR_RULES}\nCorrija somente o erro detectado, sem ampliar o escopo.\n${EDIT_FORMAT}`,
      assistantContext: withContext(
        envelope,
        `Erro de validação:\n${retryError(validationError)}`,
        `CONTEÚDO RELEVANTE:\n${filesBlock(envelope.files)}`,
      ),
      user: exactClientCommand(envelope.command),
    };
  }

  static validation(command: string, repository: string, beforeAfter: string): BuiltPrompt {
    return {
      operation: "validation",
      jsonMode: true,
      system: "Verifique se a alteração corresponde ao pedido e ao escopo. Retorne somente JSON com ok e issues.",
      assistantContext: `Repositório: ${clean(repository, 300)}\n${clean(beforeAfter, 70000)}`,
      user: exactClientCommand(command),
    };
  }

  static chat(message: string): BuiltPrompt {
    return {
      operation: "chat",
      jsonMode: false,
      system: "Responda em português do Brasil. Não afirme que editou código em uma chamada apenas de conversa.",
      user: exactClientCommand(message),
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

  const rawChanges =
    raw?.changes || raw?.edits || raw?.updates || raw?.operations || raw?.patches ||
    raw?.actions || raw?.modifications || raw?.alteracoes || raw?.["alterações"];
  const changes = (Array.isArray(rawChanges) ? rawChanges : [])
    .map((item: any) => normalizeChange(item))
    .filter(Boolean)
    .slice(0, 20);
  return JSON.stringify({
    summary: clean(raw?.summary || "Alteração preparada.", 1200),
    reply: clean(raw?.reply || raw?.summary || "", 1600),
    changes,
  });
}

/**
 * Converte a saída de QUALQUER provedor para o formato interno único:
 * { path, content?, find?, replace?, create?, delete? }.
 */
function normalizeChange(item: any) {
  if (!item || typeof item !== "object") return null;
  const path = String(item.path || item.file || item.filename || item.file_path || item.filePath || "").trim();
  if (!path || path.includes("..")) return null;

  const action = String(item.action || item.type || item.op || item.operation || "").trim().toLowerCase();
  if (action === "delete" || action === "remove" || item.delete === true) return { path, delete: true };

  const find = item.find ?? item.search ?? item.old_content ?? item.oldContent ?? item.old_string ?? item.target;
  const replaceWith = item.replace ?? item.replacement ?? item.new_content ?? item.newContent ?? item.new_string;
  if (typeof find === "string" && find.length > 0 && typeof replaceWith === "string") {
    return { path, find, replace: replaceWith };
  }

  const content = item.content ?? item.code ?? item.new_content ?? item.newContent ?? item.body ?? item.text;
  if (typeof content !== "string") return null;
  const create = item.create === true || action === "create" || action === "write" || action === "add";
  return { path, content, create };
}

