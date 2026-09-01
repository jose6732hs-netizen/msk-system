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

const normalizeCommand = (value: string) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

function isVisualOnlyRequest(command: string) {
  const q = normalizeCommand(command);
  const visualProperty = /\b(cor|color|text[oi]|texto|text|copy|fonte|font|fundo|background|layout|estilo|style|tamanho|borda|sombra|hover|azul|asul|vermelh[oa]?|verde|roxo|rosa|preto|branco|cinza|amarelo|laranja|claro|escuro)\b/.test(q);
  const editVerb = /\b(mud[ea]|mudar|troqu[ea]|trocar|alter[ea]|alterar|deix[ea]|deixar|coloqu[ea]|colocar|ajust[ea]|ajustar)\b/.test(q);
  const technicalSensitive = /\b(api|webhook|token|senha|password|secret|chave secreta|rls|migration|banco|database|supabase|service.?role|credencial)\b/.test(q);
  return visualProperty && editVerb && !technicalSensitive;
}

export const isHighRiskCommand = (command: string) => {
  if (isVisualOnlyRequest(command)) return false;
  return /\b(auth|login|senha|password|token|sess[aã]o|rls|supabase|banco|database|migration|checkout|pagamento|pix|cart[aã]o|webhook|licen[cç]a|assinatura|tenant|admin|service.?role|api.?key|secret)\b/i.test(command);
};

function shortlistCandidates(paths: string[], command: string, max = 80) {
  const terms = normalizeCommand(command)
    .split(/[^a-z0-9_-]+/)
    .filter((term) => term.length >= 3);

  return paths
    .filter((path) => !/(^|\/)(node_modules|dist|build|coverage)(\/|$)/i.test(path))
    .map((path) => {
      const p = path.toLowerCase();
      let score = 0;
      for (const term of terms) if (p.includes(term)) score += 12;
      if (/src\/(routes|pages)\//.test(p)) score += 8;
      if (/src\/components\//.test(p)) score += 6;
      if (/\.(tsx|jsx|css|scss|ts|js)$/.test(p)) score += 4;
      if (/(index|home|landing|hero|app|main|layout|styles?|theme)/.test(p)) score += 4;
      if (/readme|lock\.json$|\.test\.|\.spec\./.test(p)) score -= 10;
      return { path, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, max)
    .map((item) => item.path);
}

export const selectionPrompt = (command: string, paths: string[], repository: string) =>
  encodePromptEnvelope({
    operation: "interpretation",
    command,
    repository,
    candidates: shortlistCandidates(paths, command),
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

function firstString(raw: any, keys: string[]) {
  for (const key of keys) if (typeof raw?.[key] === "string") return raw[key] as string;
  return undefined;
}

function countOccurrences(content: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let at = 0;
  while ((at = content.indexOf(needle, at)) >= 0) {
    count += 1;
    at += Math.max(1, needle.length);
    if (count > 2) break;
  }
  return count;
}

export function validateChanges(rawChanges: any[], files: Array<{ path: string; content: string }>, allPaths: string[]) {
  const existing = new Map(allPaths.map(p => [p.toLowerCase(), p]));
  const analyzed = new Map(files.map(f => [f.path.toLowerCase(), f]));
  const seen = new Set<string>();
  const result: Array<{ path: string; content: string; create: boolean }> = [];

  for (const raw of Array.isArray(rawChanges) ? rawChanges : []) {
    const requested = String(raw?.path || raw?.file || raw?.file_path || raw?.filename || "").trim().replace(/\\/g, "/");
    const lower = requested.toLowerCase();
    if (!requested || requested.startsWith("/") || requested.includes("..") || seen.has(lower)) continue;

    const canonical = existing.get(lower);
    if (canonical) {
      const original = analyzed.get(lower);
      if (!original) continue;

      let content = typeof raw?.content === "string" ? raw.content : "";
      if (!content.trim()) {
        const find = firstString(raw, ["find", "search", "old", "before", "from"]);
        const replace = firstString(raw, ["replace", "replacement", "new", "after", "to"]);
        if (typeof find !== "string" || typeof replace !== "string" || !find || find === replace) continue;
        if (countOccurrences(original.content, find) !== 1) continue;
        content = original.content.replace(find, replace);
      }

      if (!content.trim() || PLACEHOLDER.test(content) || content === original.content) continue;
      if (original.content.length > 800 && content.length < Math.max(200, Math.floor(original.content.length * .25))) continue;
      if (content.length > Math.max(250000, original.content.length * 6)) continue;
      seen.add(lower);
      result.push({ path: canonical, content, create: false });
      continue;
    }

    const content = typeof raw?.content === "string" ? raw.content : "";
    if (!content.trim() || PLACEHOLDER.test(content)) continue;
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
