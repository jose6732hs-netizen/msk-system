import { buildIntelligenceContext } from "./intelligence.ts";

export const MSK_ENGINEERING_PROFILE = `
Você é o MSK Agente, desenvolvedor full-stack sênior que executa alterações reais no repositório vinculado.

REGRAS OBRIGATÓRIAS
- Trabalhe somente no usuário, projeto, repositório e branch atuais. Nunca misture contexto entre clientes.
- Entenda português informal, abreviações e erros ortográficos óbvios pelo contexto.
- Respostas curtas como "sim", "a primeira", "roxo neon" podem complementar a mesma tarefa; preserve o contexto confirmado.
- Não obrigue o cliente a saber arquivos/componentes quando o alvo puder ser localizado com segurança.
- Pedido simples = menor diff possível. Não refatore, renomeie, troque dependências ou amplie escopo sem necessidade.
- Nunca afirme que editou/concluiu sem mudança real e commit/verificação comprovados pelo backend.
- Nunca use TODO, FIXME, pseudocódigo, placeholders, trechos omitidos ou "restante do código".
- Preserve imports, exports, contratos públicos, responsividade, identidade visual, dados e integrações fora do pedido.
- Auth, multiusuário, RLS, banco, pagamentos, licenças, secrets e webhooks exigem revisão extra de segurança e compatibilidade.
- Service role, secrets e credenciais ficam somente no servidor.
- GitHub é a fonte de verdade da edição; Lovable apenas reflete/sincroniza o código e não deve ser usado como agente de implementação.

CRITÉRIO DE QUALIDADE
- Confirme alvo, conteúdo atual, relações necessárias e resultado esperado antes de concluir.
- Alteração tecnicamente válida mas semanticamente diferente do pedido é falha.
- Em saída malformada da IA, reprocessse; nunca aplique conteúdo quebrado só para terminar rápido.
- Resumo final deve ser factual: arquivos, resultado, commit/verificação ou falha real.
`;

const SKILLS = {
  frontend: "FRONT-END/UI: preserve design system e responsividade; altere somente estilo/conteúdo necessário; confirme props/imports e estados de interação.",
  backend: "BACKEND/API: valide entradas, autorização server-side, contratos, timeout/retry idempotente e erros seguros.",
  database: "DATABASE/SUPABASE: migration segura, dados preservados, ownership/RLS, constraints/índices quando necessários; service_role apenas servidor.",
  auth: "AUTH/MULTIUSUÁRIO: todo recurso protegido exige ownership/tenant check; nunca confie só em user_id/role enviado pelo cliente.",
  payments: "PAGAMENTOS: preço/produto/licença são verdade server-side; webhook autenticado/idempotente; acesso só após confirmação válida.",
  debugging: "DEBUGGING: encontre causa raiz no menor conjunto de arquivos; não masque sintomas nem altere áreas não relacionadas.",
  performance: "PERFORMANCE: evite scans/chamadas repetidas sem necessidade; preserve correção e segurança antes de velocidade.",
  git: "GIT/GITHUB: repositório e branch exatos, commit atômico, sem force push; conflito deve ser isolado com branch/PR.",
  testing: "TEST/REVIEW: valide sintaxe, imports/exports, contratos, estados nulos/erro, call sites e áreas de alto risco.",
};

export function skillContext(command: string) {
  const c = String(command || "").toLowerCase(); const picked: string[] = [];
  if (/(layout|tela|pagina|página|componente|react|tsx|css|cor|bot[aã]o|responsiv|mobile|front|copy|fonte|efeito|anima[cç][aã]o|menu)/i.test(c)) picked.push(SKILLS.frontend);
  if (/(api|endpoint|edge function|backend|server|webhook|integra[cç][aã]o|fetch|http)/i.test(c)) picked.push(SKILLS.backend);
  if (/(supabase|postgres|sql|banco|database|tabela|migration|migra[cç][aã]o|rls|query)/i.test(c)) picked.push(SKILLS.database);
  if (/(auth|login|senha|password|token|sess[aã]o|usu[aá]rio|tenant|multi.?usu[aá]rio|permiss[aã]o|role)/i.test(c)) picked.push(SKILLS.auth);
  if (/(checkout|pagamento|payment|pix|cart[aã]o|assinatura|subscription|licen[cç]a|pre[cç]o|plano)/i.test(c)) picked.push(SKILLS.payments);
  if (/(erro|bug|falha|500|404|quebrou|corrig|fix|n[aã]o funciona|loop|trav)/i.test(c)) picked.push(SKILLS.debugging);
  if (/(lento|demora|performance|otimiz|timeout|lat[eê]ncia)/i.test(c)) picked.push(SKILLS.performance);
  if (/(git|github|commit|branch|pull request|pr|lovable)/i.test(c)) picked.push(SKILLS.git);
  picked.push(SKILLS.testing);
  return `\nSKILLS ATIVADAS\n${[...new Set(picked)].join("\n")}`;
}

export const normalizeRepo = (value: string) => String(value || "").trim().replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "").toLowerCase();
export const isHighRiskCommand = (command: string) => /\b(auth|login|senha|password|token|sess[aã]o|rls|supabase|banco|database|migration|checkout|pagamento|pix|cart[aã]o|webhook|licen[cç]a|assinatura|tenant|admin|service.?role|api.?key|secret)\b/i.test(command);

export const selectionPrompt = (command: string, paths: string[], repository: string) => `${MSK_ENGINEERING_PROFILE}${skillContext(command)}\nLOCALIZAÇÃO DE ALVO\nRepositório exclusivo: ${repository}.\nLocalize pelo significado e evidência do pedido. UI simples: preferencialmente 1 arquivo, máximo normal 2. Tarefa complexa: somente arquivos indispensáveis, máximo 8. Não escolha aleatoriamente quando houver ambiguidade real. Responda SOMENTE JSON válido: {"files":["path"]}.\nPedido: ${command}\nArquivos:\n${paths.join("\n")}`;

export const editPrompt = (command: string, repository: string, files: Array<{ path: string; content: string }>, highRisk: boolean) => {
  const intelligence = buildIntelligenceContext(command, files);
  return `${MSK_ENGINEERING_PROFILE}${skillContext(command)}\nEDIÇÃO REAL\nRepositório exclusivo: ${repository}.\nRisco elevado: ${highRisk ? "SIM — faça revisão extra de segurança/compatibilidade." : "NÃO"}.\n${intelligence}\n\n- Confirme que o alvo existe no conteúdo fornecido antes de editá-lo.\n- Para tarefa complexa, planeje etapas por dependência e entregue a feature conectada, não pela metade.\n- Se criar componente/serviço/rota/tipo, conecte imports, exports, registros e consumidores indispensáveis.\n- Reutilize padrões existentes antes de criar arquitetura paralela.\n- Não implemente preview/deploy.\n- Pode criar até 4 arquivos novos quando indispensável. Não altere .env, secrets, lockfiles ou binários.\n- Para arquivo existente, devolva conteúdo COMPLETO preservando tudo fora do pedido.\nResponda SOMENTE JSON válido: {"summary":"resumo factual","reply":"resposta curta","changes":[{"path":"caminho","content":"arquivo completo","create":false}]}.\nPedido/contexto: ${command}\n${files.map(f => `--- ARQUIVO ANALISADO: ${f.path}\n${f.content}`).join("\n")}`;
};

const ALLOWED_NEW = /^(src|app|pages|components|lib|server|api|supabase|public|scripts|tests?)\//i;
const ALLOWED_EXT = /\.(tsx?|jsx?|css|scss|html|json|sql|md|mjs|cjs)$/i;
const PLACEHOLDER = /(TODO\s*:?\s*(implement|implementar)|FIXME|restante do c[oó]digo|existing code|previous code|same as before|\.\.\.\s*(rest|restante)|seu c[oó]digo aqui)/i;

export function validateChanges(rawChanges: any[], files: Array<{ path: string; content: string }>, allPaths: string[]) {
  const existing = new Map(allPaths.map(p => [p.toLowerCase(), p]));
  const analyzed = new Map(files.map(f => [f.path.toLowerCase(), f]));
  const seen = new Set<string>(); const result: Array<{ path: string; content: string; create: boolean }> = [];
  for (const raw of Array.isArray(rawChanges) ? rawChanges : []) {
    const requested = String(raw?.path || "").trim().replace(/\\/g, "/"); const lower = requested.toLowerCase();
    if (!requested || requested.startsWith("/") || requested.includes("..") || seen.has(lower)) continue;
    const content = typeof raw?.content === "string" ? raw.content : "";
    if (!content.trim() || PLACEHOLDER.test(content)) continue;
    const canonical = existing.get(lower);
    if (canonical) {
      const original = analyzed.get(lower); if (!original || content === original.content) continue;
      if (original.content.length > 800 && content.length < Math.max(200, Math.floor(original.content.length * .25))) continue;
      if (content.length > Math.max(250000, original.content.length * 6)) continue;
      seen.add(lower); result.push({ path: canonical, content, create: false }); continue;
    }
    if (raw?.create !== true || !ALLOWED_NEW.test(requested) || !ALLOWED_EXT.test(requested)) continue;
    if (/(^|\/)(\.env|node_modules|dist|build|coverage)(\/|$)/i.test(requested) || /package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/i.test(requested)) continue;
    seen.add(lower); result.push({ path: requested, content, create: true }); if (result.filter(x => x.create).length >= 4) break;
  }
  return result.slice(0, 12);
}

export const professionalSummary = (summary: string, repository: string, files: string[], commitSha = "") => `${String(summary || "Alteração concluída").replace(/\s+/g, " ").trim().slice(0, 800)}${files.length ? ` | Arquivos: ${files.slice(0, 8).join(", ")}` : ""}${repository ? ` | Repositório: ${repository}` : ""}${commitSha ? ` | Commit: ${commitSha.slice(0, 12)}` : ""}`;
