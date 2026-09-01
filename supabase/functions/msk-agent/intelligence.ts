export type AgentSourceFile = {
  path: string;
  content: string;
};

export type DependencyEdge = {
  from: string;
  to: string;
  kind: 'import' | 'require';
};

export type SymbolInfo = {
  name: string;
  kind: 'function' | 'class' | 'component' | 'variable' | 'type' | 'interface';
  filePath: string;
};

export type CodeAnalysisResult = {
  framework: string;
  importsByFile: Record<string, string[]>;
  exportsByFile: Record<string, string[]>;
  symbols: SymbolInfo[];
  dependencyEdges: DependencyEdge[];
  conventions: string[];
};

export type ImpactReport = {
  affectedFiles: string[];
  affectedSymbols: string[];
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
};

const uniq = <T>(items: T[]) => [...new Set(items)];

function resolveRelativeImport(fromPath: string, specifier: string, files: AgentSourceFile[]) {
  if (!specifier.startsWith('.')) return '';
  const parts = fromPath.split('/');
  parts.pop();
  for (const segment of specifier.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  const base = parts.join('/');
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`,
    `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.jsx`,
  ];
  const lower = new Map(files.map(file => [file.path.toLowerCase(), file.path]));
  for (const candidate of candidates) {
    const found = lower.get(candidate.toLowerCase());
    if (found) return found;
  }
  return '';
}

export function analyzeCode(files: AgentSourceFile[]): CodeAnalysisResult {
  const importsByFile: Record<string, string[]> = {};
  const exportsByFile: Record<string, string[]> = {};
  const dependencyEdges: DependencyEdge[] = [];
  const symbols: SymbolInfo[] = [];
  let reactSignals = 0;
  let nextSignals = 0;
  let viteSignals = 0;
  let tanstackSignals = 0;

  for (const file of files) {
    const source = String(file.content || '');
    const imports = [...source.matchAll(/(?:import[\s\S]*?from\s*|import\s*|require\s*\()(["'])([^"']+)\1/g)]
      .map(match => String(match[2] || '').trim())
      .filter(Boolean);
    importsByFile[file.path] = uniq(imports);

    for (const specifier of importsByFile[file.path]) {
      if (/react/i.test(specifier)) reactSignals++;
      if (/next\//i.test(specifier) || specifier === 'next') nextSignals++;
      if (/tanstack|@tanstack/i.test(specifier)) tanstackSignals++;
      if (/vite/i.test(specifier)) viteSignals++;
      const target = resolveRelativeImport(file.path, specifier, files);
      if (target) dependencyEdges.push({ from: file.path, to: target, kind: source.includes(`require(${JSON.stringify(specifier)}`) ? 'require' : 'import' });
    }

    const exported = [...source.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface)\s+([A-Za-z_$][\w$]*)/g)]
      .map(match => String(match[1] || ''));
    exportsByFile[file.path] = uniq(exported);

    for (const match of source.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
      const name = String(match[1] || '');
      symbols.push({ name, kind: /^[A-Z]/.test(name) ? 'component' : 'function', filePath: file.path });
    }
    for (const match of source.matchAll(/(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g)) symbols.push({ name: String(match[1] || ''), kind: 'class', filePath: file.path });
    for (const match of source.matchAll(/(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g)) symbols.push({ name: String(match[1] || ''), kind: 'interface', filePath: file.path });
    for (const match of source.matchAll(/(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/g)) symbols.push({ name: String(match[1] || ''), kind: 'type', filePath: file.path });
    for (const match of source.matchAll(/(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
      const name = String(match[1] || '');
      symbols.push({ name, kind: /^[A-Z]/.test(name) ? 'component' : 'variable', filePath: file.path });
    }
  }

  let framework = 'unknown';
  if (tanstackSignals) framework = 'TanStack/React';
  else if (nextSignals) framework = 'Next.js/React';
  else if (viteSignals && reactSignals) framework = 'Vite/React';
  else if (reactSignals) framework = 'React';

  const conventions: string[] = [];
  if (files.some(file => /\.tsx$/.test(file.path))) conventions.push('TypeScript + JSX/TSX');
  if (files.some(file => /tailwind|className=/.test(file.content))) conventions.push('Tailwind/className styling');
  if (files.some(file => /supabase/i.test(file.content))) conventions.push('Supabase integration');
  if (files.some(file => /createFileRoute|createRoute|@tanstack\/react-router/i.test(file.content))) conventions.push('File/router conventions');

  return {
    framework,
    importsByFile,
    exportsByFile,
    symbols: symbols.filter(symbol => symbol.name),
    dependencyEdges,
    conventions,
  };
}

export function createImpactReport(command: string, files: AgentSourceFile[], analysis = analyzeCode(files)): ImpactReport {
  const normalized = String(command || '').toLowerCase();
  const affectedFiles = new Set<string>();
  const affectedSymbols = new Set<string>();
  const reasons: string[] = [];

  for (const file of files) {
    const haystack = `${file.path}\n${file.content}`.toLowerCase();
    const commandTerms = normalized.split(/[^a-z0-9_À-ÿ-]+/i).filter(term => term.length >= 4);
    if (commandTerms.some(term => haystack.includes(term))) affectedFiles.add(file.path);
  }

  for (const symbol of analysis.symbols) {
    if (normalized.includes(symbol.name.toLowerCase())) {
      affectedSymbols.add(symbol.name);
      affectedFiles.add(symbol.filePath);
    }
  }

  for (const edge of analysis.dependencyEdges) {
    if (affectedFiles.has(edge.to)) {
      affectedFiles.add(edge.from);
      reasons.push(`${edge.from} depende de ${edge.to}`);
    }
  }

  const highRisk = /\b(auth|login|senha|token|rls|supabase|banco|database|migration|checkout|pagamento|pix|cart[aã]o|webhook|licen[cç]a|secret|api.?key)\b/i.test(command);
  const riskLevel: ImpactReport['riskLevel'] = highRisk || affectedFiles.size > 5 ? 'high' : affectedFiles.size > 2 ? 'medium' : 'low';
  if (highRisk) reasons.push('Pedido toca área sensível e exige revisão extra de segurança/compatibilidade.');
  if (!reasons.length) reasons.push('Impacto estimado pelo conteúdo e relações dos arquivos analisados.');

  return {
    affectedFiles: [...affectedFiles],
    affectedSymbols: [...affectedSymbols],
    riskLevel,
    reasons: uniq(reasons).slice(0, 8),
  };
}

export function buildIntelligenceContext(command: string, files: AgentSourceFile[]) {
  const analysis = analyzeCode(files);
  const impact = createImpactReport(command, files, analysis);
  const imports = Object.entries(analysis.importsByFile)
    .filter(([, values]) => values.length)
    .slice(0, 12)
    .map(([path, values]) => `${path}: ${values.slice(0, 12).join(', ')}`);
  const edges = analysis.dependencyEdges.slice(0, 20).map(edge => `${edge.from} -> ${edge.to}`);
  const symbols = analysis.symbols.slice(0, 40).map(symbol => `${symbol.name} (${symbol.kind}) @ ${symbol.filePath}`);

  return [
    'ANÁLISE ESTRUTURAL DO CÓDIGO — use como contexto, não como autorização para ampliar escopo.',
    `Framework/padrão detectado: ${analysis.framework}.`,
    analysis.conventions.length ? `Convenções detectadas: ${analysis.conventions.join('; ')}.` : '',
    imports.length ? `Imports relevantes:\n${imports.join('\n')}` : '',
    edges.length ? `Relações entre arquivos:\n${edges.join('\n')}` : '',
    symbols.length ? `Símbolos detectados:\n${symbols.join('\n')}` : '',
    `Impacto estimado: ${impact.riskLevel}. Arquivos potencialmente afetados: ${impact.affectedFiles.join(', ') || 'somente os arquivos fornecidos'}.`,
    impact.reasons.length ? `Motivos de impacto: ${impact.reasons.join(' | ')}` : '',
    'PLANEJAMENTO: para mudança complexa, organize mentalmente em etapas dependentes; aplique primeiro pré-requisitos (tipos/serviços), depois consumidores/imports, e valide cada etapa contra o código real.',
    'SELF-HEALING: se a primeira edição falhar validação, corrija somente a causa do erro, preservando o pedido original; não use a correção como desculpa para refatorar ou ampliar escopo.',
    'TEMPLATES: reutilize padrões já existentes neste projeto antes de inventar boilerplate novo.',
    'BANCO: qualquer mudança de schema deve ser representada por migration segura e compatível com o padrão já usado no projeto; nunca editar produção diretamente como substituto de migration.',
  ].filter(Boolean).join('\n');
}
