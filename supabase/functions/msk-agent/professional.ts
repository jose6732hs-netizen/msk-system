import { encodePromptEnvelope, isComplexCommand } from "./prompt-builder.ts";

// Mantido apenas para chamadas legadas/semânticas. As edições novas usam PromptBuilder.
export const MSK_ENGINEERING_PROFILE = [
  "Você é um assistente técnico de edição de código.",
  "Responda somente no formato solicitado pela etapa atual.",
].join("\n");

export const normalizeRepo = (value: string) => String(value || "")
  .trim()
  .replace(/^https:\/\/github\.com\//i, "")
  .replace(/\.git$/i, "")
  .replace(/^\/+|\/+$/g, "")
  .toLowerCase();

export const isHighRiskCommand = (command: string) => /\b(auth|login|senha|password|token|sess[aã]o|rls|supabase|banco|database|migration|checkout|pagamento|pix|cart[aã]o|webhook|licen[cç]a|assinatura|tenant|admin|service.?role|api.?key|secret)\b/i.test(command);

export const selectionPrompt = (command: string, paths: string[], repository: string) =>
  encodePromptEnvelope({
    operation: "interpretation",
    command,
    repository,
    candidates: paths,
  });

export const editPrompt = (
  command: string,
  repository: string,
  files: Array<{ path: string; content: string }>,
  highRisk: boolean,
) => encodePromptEnvelope({
  operation: "edit",
  command,
  repository,
  files,
  highRisk,
  complex: isComplexCommand(command, files, highRisk),
});

const ALLOWED_NEW = /^(src|app|pages|components|lib|server|api|supabase|public|scripts|tests?)\//i;
const ALLOWED_EXT = /\.(tsx?|jsx?|css|scss|html|json|sql|md|mjs|cjs)$/i;
const PLACEHOLDER = /(TODO\s*:?\s*(implement|implementar)|FIXME|restante do c[oó]digo|existing code|previous code|same as before|\.\.\.\s*(rest|restante)|seu c[oó]digo aqui)/i;

export function validateChanges(rawChanges: any[], files: Array<{ path: string; content: string }>, allPaths: string[]) {
  const existing = new Map(allPaths.map(p => [p.toLowerCase(), p]));
  const analyzed = new Map(files.map(f => [f.path.toLowerCase(), f]));
  const seen = new Set<string>();
  const result: Array<{ path: string; content: string; create: boolean }> = [];

  for (const raw of Array.isArray(rawChanges) ? rawChanges : []) {
    const requested = String(raw?.path || "").trim().replace(/\\/g, "/");
    const lower = requested.toLowerCase();
    if (!requested || requested.startsWith("/") || requested.includes("..") || seen.has(lower)) continue;

    const content = typeof raw?.content === "string" ? raw.content : "";
    if (!content.trim() || PLACEHOLDER.test(content)) continue;

    const canonical = existing.get(lower);
    if (canonical) {
      const original = analyzed.get(lower);
      if (!original || content === original.content) continue;
      if (original.content.length > 800 && content.length < Math.max(200, Math.floor(original.content.length * .25))) continue;
      if (content.length > Math.max(250000, original.content.length * 6)) continue;
      seen.add(lower);
      result.push({ path: canonical, content, create: false });
      continue;
    }

    if (raw?.create !== true || !ALLOWED_NEW.test(requested) || !ALLOWED_EXT.test(requested)) continue;
    if (/(^|\/)(\.env|node_modules|dist|build|coverage)(\/|$)/i.test(requested)) continue;
    if (/package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/i.test(requested)) continue;

    seen.add(lower);
    result.push({ path: requested, content, create: true });
    if (result.filter(x => x.create).length >= 4) break;
  }

  return result.slice(0, 12);
}

export const professionalSummary = (summary: string, repository: string, files: string[], commitSha = "") =>
  `${String(summary || "Alteração concluída").replace(/\s+/g, " ").trim().slice(0, 800)}` +
  `${files.length ? ` | Arquivos: ${files.slice(0, 8).join(", ")}` : ""}` +
  `${repository ? ` | Repositório: ${repository}` : ""}` +
  `${commitSha ? ` | Commit: ${commitSha.slice(0, 12)}` : ""}`;
