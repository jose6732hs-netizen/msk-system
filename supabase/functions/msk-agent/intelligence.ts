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

export type EditPlanStep = {
  id: string;
  description: string;
  files: string[];
  dependsOn: string[];
  validation: string[];
};

export type TemplateSuggestion = {
  templateId: string;
  reason: string;
  reuseFiles: string[];
};

export type DatabasePlan = {
  required: boolean;
  migrationStyle: 'supabase_sql' | 'prisma' | 'knex' | 'unknown';
  migrationFiles: string[];
  safetyChecks: string[];
};

export type ParallelGroup = {
  id: string;
  files: string[];
  safeToParallelize: boolean;
  reason: string;
};

const uniq = <T>(items: T[]) => [...new Set(items)];
const terms = (value: string) => String(value || '').toLowerCase().split(/[^a-z0-9_À-ÿ-]+/i).filter(term => term.length >= 4);

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
      if (target) {
        const requirePattern = new RegExp(`require\\s*\\(\\s*["']${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\s*\\)`);
        dependencyEdges.push({ from: file.path, to: target, kind: requirePattern.test(source) ? 'require' : 'import' });
      }
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
  const commandTerms = terms(command);

  for (const file of files) {
    const haystack = `${file.path}\n${file.content}`.toLowerCase();
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

export function buildEditPlanSteps(command: string, files: AgentSourceFile[], analysis = analyzeCode(files)): EditPlanStep[] {
  const impact = createImpactReport(command, files, analysis);
  const steps: EditPlanStep[] = [];
  const schemaFiles = files.filter(file => /migration|schema|prisma|supabase\/migrations/i.test(file.path)).map(file => file.path);
  const typeFiles = files.filter(file => /types?|schema|contracts?/i.test(file.path)).map(file => file.path);
  const serviceFiles = files.filter(file => /service|server|api|functions?|lib\//i.test(file.path)).map(file => file.path);
  const uiFiles = files.filter(file => /components?|pages?|routes?|\.tsx$|\.jsx$/i.test(file.path)).map(file => file.path);

  if (schemaFiles.length && /banco|database|schema|migration|tabela|coluna|rls/i.test(command)) {
    steps.push({ id: 'schema', description: 'Preparar alteração de schema/migration preservando dados e segurança.', files: schemaFiles, dependsOn: [], validation: ['migration syntax', 'RLS/ownership', 'backward compatibility'] });
  }
  if (typeFiles.length) steps.push({ id: 'types', description: 'Atualizar contratos/tipos necessários antes dos consumidores.', files: uniq(typeFiles), dependsOn: schemaFiles.length ? ['schema'] : [], validation: ['type consistency', 'public contract compatibility'] });
  if (serviceFiles.length) steps.push({ id: 'services', description: 'Atualizar lógica de serviço/backend e integrações necessárias.', files: uniq(serviceFiles), dependsOn: steps.some(step => step.id === 'types') ? ['types'] : steps.some(step => step.id === 'schema') ? ['schema'] : [], validation: ['imports/exports', 'auth/ownership', 'error handling'] });
  if (uiFiles.length) steps.push({ id: 'ui', description: 'Atualizar interface/rotas/consumidores mantendo o design e o fluxo existentes.', files: uniq(uiFiles), dependsOn: steps.some(step => step.id === 'services') ? ['services'] : steps.some(step => step.id === 'types') ? ['types'] : [], validation: ['render path', 'imports', 'responsive behavior'] });
  if (!steps.length) steps.push({ id: 'edit', description: 'Aplicar a menor mudança suficiente nos arquivos diretamente relacionados.', files: impact.affectedFiles.length ? impact.affectedFiles : files.map(file => file.path), dependsOn: [], validation: ['semantic result', 'syntax', 'scope'] });
  steps.push({ id: 'final-validation', description: 'Validar o resultado completo contra o pedido original.', files: impact.affectedFiles.length ? impact.affectedFiles : files.map(file => file.path), dependsOn: steps.filter(step => step.id !== 'final-validation').map(step => step.id), validation: ['expected result', 'diff scope', 'build/typecheck/tests when applicable'] });
  return steps.slice(0, 6);
}

export function suggestTemplate(command: string, files: AgentSourceFile[]): TemplateSuggestion | null {
  const normalized = String(command || '').toLowerCase();
  const matching = files.filter(file => terms(command).some(term => `${file.path}\n${file.content}`.toLowerCase().includes(term))).slice(0, 5).map(file => file.path);
  if (/dashboard|painel/.test(normalized)) return { templateId: 'existing-dashboard-pattern', reason: 'Reutilizar estrutura de dashboard já existente em vez de criar arquitetura paralela.', reuseFiles: matching };
  if (/crud|listar|cadastro|tabela/.test(normalized)) return { templateId: 'existing-crud-pattern', reason: 'Reutilizar padrão CRUD do projeto, inclusive validação e estados.', reuseFiles: matching };
  if (/login|auth|cadastro de usu/.test(normalized)) return { templateId: 'existing-auth-pattern', reason: 'Seguir o fluxo de autenticação/ownership já implementado.', reuseFiles: matching };
  if (/checkout|pagamento|pix|cart[aã]o/.test(normalized)) return { templateId: 'existing-checkout-pattern', reason: 'Reutilizar contratos e estados financeiros já existentes no projeto.', reuseFiles: matching };
  return null;
}

export function planDatabaseChanges(command: string, files: AgentSourceFile[]): DatabasePlan {
  const required = /\b(banco|database|schema|migration|migra[cç][aã]o|tabela|coluna|indice|índice|rls|policy|postgres|supabase)\b/i.test(command);
  let migrationStyle: DatabasePlan['migrationStyle'] = 'unknown';
  if (files.some(file => /supabase\/migrations|create table|alter table/i.test(`${file.path}\n${file.content}`))) migrationStyle = 'supabase_sql';
  else if (files.some(file => /prisma\/schema\.prisma|model\s+\w+/i.test(`${file.path}\n${file.content}`))) migrationStyle = 'prisma';
  else if (files.some(file => /knex/i.test(`${file.path}\n${file.content}`))) migrationStyle = 'knex';
  const migrationFiles = files.filter(file => /migration|schema\.prisma|supabase\/migrations/i.test(file.path)).map(file => file.path);
  return {
    required,
    migrationStyle,
    migrationFiles,
    safetyChecks: required ? ['preserve existing data', 'ownership/RLS', 'constraints/indexes', 'backward compatibility', 'no secrets in client'] : [],
  };
}

export function planParallelGroups(files: AgentSourceFile[], analysis = analyzeCode(files)): ParallelGroup[] {
  const dependent = new Set<string>();
  for (const edge of analysis.dependencyEdges) {
    dependent.add(edge.from);
    dependent.add(edge.to);
  }
  const independent = files.filter(file => !dependent.has(file.path)).map(file => file.path);
  const groups: ParallelGroup[] = [];
  if (independent.length > 1) groups.push({ id: 'independent', files: independent, safeToParallelize: true, reason: 'Nenhuma relação de import local foi detectada entre estes arquivos analisados.' });
  for (const edge of analysis.dependencyEdges.slice(0, 12)) groups.push({ id: `dep:${edge.from}`, files: uniq([edge.to, edge.from]), safeToParallelize: false, reason: `${edge.from} depende de ${edge.to}; respeitar ordem de aplicação.` });
  return groups.slice(0, 8);
}

export function buildSelfHealingInstruction(errors: string[]) {
  const clean = errors.map(error => String(error || '').trim()).filter(Boolean).slice(0, 10);
  return clean.length
    ? `SELF-HEALING DIRECIONADO: corrija somente estas falhas reais, preserve o pedido original e revalide: ${clean.join(' | ')}`
    : 'SELF-HEALING: se houver falha de validação, use apenas o erro real para uma correção mínima; não refatore fora do escopo.';
}

export function buildIntelligenceContext(command: string, files: AgentSourceFile[]) {
  const analysis = analyzeCode(files);
  const impact = createImpactReport(command, files, analysis);
  const plan = buildEditPlanSteps(command, files, analysis);
  const template = suggestTemplate(command, files);
  const database = planDatabaseChanges(command, files);
  const parallel = planParallelGroups(files, analysis);
  const imports = Object.entries(analysis.importsByFile)
    .filter(([, values]) => values.length)
    .slice(0, 12)
    .map(([path, values]) => `${path}: ${values.slice(0, 12).join(', ')}`);
  const edges = analysis.dependencyEdges.slice(0, 20).map(edge => `${edge.from} -> ${edge.to}`);
  const symbols = analysis.symbols.slice(0, 40).map(symbol => `${symbol.name} (${symbol.kind}) @ ${symbol.filePath}`);
  const steps = plan.map(step => `${step.id}: ${step.description} [${step.files.join(', ')}] depende de [${step.dependsOn.join(', ') || 'nada'}]`);
  const parallelNotes = parallel.map(group => `${group.safeToParallelize ? 'PARALELO OK' : 'ORDEM OBRIGATÓRIA'}: ${group.files.join(', ')} — ${group.reason}`);

  return [
    'ANÁLISE ESTRUTURAL DO CÓDIGO — use como contexto, não como autorização para ampliar escopo.',
    `Framework/padrão detectado: ${analysis.framework}.`,
    analysis.conventions.length ? `Convenções detectadas: ${analysis.conventions.join('; ')}.` : '',
    imports.length ? `Imports relevantes:\n${imports.join('\n')}` : '',
    edges.length ? `Relações entre arquivos:\n${edges.join('\n')}` : '',
    symbols.length ? `Símbolos detectados:\n${symbols.join('\n')}` : '',
    `Impacto estimado: ${impact.riskLevel}. Arquivos potencialmente afetados: ${impact.affectedFiles.join(', ') || 'somente os arquivos fornecidos'}.`,
    impact.reasons.length ? `Motivos de impacto: ${impact.reasons.join(' | ')}` : '',
    steps.length ? `PLANO EM ETAPAS SUGERIDO:\n${steps.join('\n')}` : '',
    template ? `TEMPLATE/PADRÃO RECOMENDADO: ${template.templateId}. ${template.reason} Reutilizar: ${template.reuseFiles.join(', ') || 'padrões encontrados nos arquivos analisados'}.` : 'TEMPLATES: reutilize padrões já existentes neste projeto antes de inventar boilerplate novo.',
    database.required ? `PLANO DE BANCO: mudança de schema detectada. Estilo: ${database.migrationStyle}. Arquivos conhecidos: ${database.migrationFiles.join(', ') || 'nenhum migration analisado ainda'}. Checagens: ${database.safetyChecks.join(', ')}.` : '',
    parallelNotes.length ? `DEPENDÊNCIAS/PARALELISMO:\n${parallelNotes.join('\n')}` : '',
    buildSelfHealingInstruction([]),
    'BANCO: qualquer mudança de schema deve ser representada por migration segura e compatível com o padrão já usado no projeto; nunca editar produção diretamente como substituto de migration.',
  ].filter(Boolean).join('\n');
}
