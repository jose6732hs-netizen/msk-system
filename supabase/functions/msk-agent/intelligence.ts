export type AgentSourceFile = { path: string; content: string };
type Edge = { from: string; to: string };
type SymbolInfo = { name: string; kind: string; filePath: string };

const uniq = <T>(items: T[]) => [...new Set(items)];
const words = (value: string) => String(value || "").toLowerCase().split(/[^a-z0-9_À-ÿ-]+/i).filter(x => x.length >= 4);

function resolveRelative(from: string, spec: string, files: AgentSourceFile[]) {
  if (!spec.startsWith(".")) return "";
  const parts = from.split("/"); parts.pop();
  for (const segment of spec.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop(); else parts.push(segment);
  }
  const base = parts.join("/");
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.jsx`];
  const byLower = new Map(files.map(f => [f.path.toLowerCase(), f.path]));
  return candidates.map(c => byLower.get(c.toLowerCase())).find(Boolean) || "";
}

export function analyzeCode(files: AgentSourceFile[]) {
  const importsByFile: Record<string, string[]> = {};
  const symbols: SymbolInfo[] = [];
  const edges: Edge[] = [];
  let react = 0, next = 0, tanstack = 0, vite = 0;
  for (const file of files) {
    const src = String(file.content || "");
    const imports = [...src.matchAll(/(?:import[\s\S]*?from\s*|import\s*|require\s*\()(["'])([^"']+)\1/g)].map(m => String(m[2] || "")).filter(Boolean);
    importsByFile[file.path] = uniq(imports);
    for (const spec of importsByFile[file.path]) {
      if (/react/i.test(spec)) react++; if (/next/i.test(spec)) next++; if (/tanstack/i.test(spec)) tanstack++; if (/vite/i.test(spec)) vite++;
      const target = resolveRelative(file.path, spec, files); if (target) edges.push({ from: file.path, to: target });
    }
    for (const m of src.matchAll(/(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|const|let|var|type|interface)\s+([A-Za-z_$][\w$]*)/g)) {
      const name = String(m[2] || "");
      symbols.push({ name, kind: /^[A-Z]/.test(name) ? "component" : String(m[1] || "symbol"), filePath: file.path });
    }
  }
  const framework = tanstack ? "TanStack/React" : next ? "Next.js/React" : vite && react ? "Vite/React" : react ? "React" : "unknown";
  const conventions = [files.some(f => /\.tsx$/.test(f.path)) ? "TypeScript/TSX" : "", files.some(f => /className=|tailwind/i.test(f.content)) ? "Tailwind/className" : "", files.some(f => /supabase/i.test(f.content)) ? "Supabase" : ""].filter(Boolean);
  return { framework, importsByFile, symbols, edges, conventions };
}

export function buildIntelligenceContext(command: string, files: AgentSourceFile[]) {
  const analysis = analyzeCode(files);
  const terms = words(command);
  const affected = new Set<string>();
  const reasons: string[] = [];
  for (const file of files) if (terms.some(term => `${file.path}\n${file.content}`.toLowerCase().includes(term))) affected.add(file.path);
  for (const symbol of analysis.symbols) if (String(command).toLowerCase().includes(symbol.name.toLowerCase())) affected.add(symbol.filePath);
  for (const edge of analysis.edges) if (affected.has(edge.to)) { affected.add(edge.from); reasons.push(`${edge.from} depende de ${edge.to}`); }
  const highRisk = /\b(auth|login|senha|token|rls|supabase|banco|database|migration|checkout|pagamento|pix|cart[aã]o|webhook|licen[cç]a|secret|api.?key)\b/i.test(command);
  const risk = highRisk || affected.size > 5 ? "high" : affected.size > 2 ? "medium" : "low";
  const imports = Object.entries(analysis.importsByFile).filter(([, x]) => x.length).slice(0, 10).map(([p, x]) => `${p}: ${x.slice(0, 10).join(", ")}`);
  const edges = analysis.edges.slice(0, 16).map(x => `${x.from} -> ${x.to}`);
  const symbols = analysis.symbols.slice(0, 30).map(x => `${x.name} (${x.kind}) @ ${x.filePath}`);
  const database = /\b(banco|database|schema|migration|migra[cç][aã]o|tabela|coluna|rls|policy|postgres|supabase)\b/i.test(command);
  return [
    "ANÁLISE ESTRUTURAL — contexto, nunca autorização para ampliar escopo.",
    `Framework: ${analysis.framework}. Convenções: ${analysis.conventions.join(", ") || "não determinadas"}.`,
    imports.length ? `Imports:\n${imports.join("\n")}` : "",
    edges.length ? `Dependências locais:\n${edges.join("\n")}` : "",
    symbols.length ? `Símbolos:\n${symbols.join("\n")}` : "",
    `Impacto estimado: ${risk}. Arquivos relacionados: ${[...affected].join(", ") || "somente os fornecidos"}.`,
    reasons.length ? `Relações de impacto: ${uniq(reasons).slice(0, 8).join(" | ")}.` : "",
    "PLANO: em tarefa complexa, aplique pré-requisitos/tipos/schema primeiro, serviços depois, consumidores/UI por último, validando cada etapa.",
    "SELF-HEALING: corrija somente o erro real, preserve pedido e alvo e não transforme correção em refatoração.",
    "TEMPLATES: reutilize padrões, componentes e contratos já existentes antes de criar boilerplate paralelo.",
    database ? "BANCO: use migration compatível com o padrão do projeto, preserve dados, RLS/ownership, constraints e índices; nunca exponha service_role/secrets no cliente." : "",
    "PARALELISMO: somente arquivos comprovadamente independentes podem ser tratados em paralelo; dependências respeitam ordem.",
  ].filter(Boolean).join("\n");
}
