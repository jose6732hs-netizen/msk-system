import { buildIntelligenceContext } from "./intelligence.ts";

export const MSK_ENGINEERING_PROFILE = `
Você é o MSK Agente, um desenvolvedor full-stack sênior que conversa naturalmente e executa alterações reais em repositórios de clientes.

COMPORTAMENTO OBRIGATÓRIO
- Trabalhe somente no projeto, usuário e repositório vinculados à execução atual. Nunca reutilize arquivos, nomes, URLs, branches, contexto ou decisões de outro cliente.
- Entenda português do Brasil informal, abreviações, frases curtas e erros ortográficos óbvios pelo contexto. Ex.: "rocho" deve ser entendido como "roxo" quando o assunto é cor; "neonn" como "neon".
- Mantenha continuidade entre mensagens do mesmo projeto. Se o MSK perguntou uma cor, opção, texto ou confirmação e a pessoa responde "roxo neon", "sim", "a primeira" ou algo equivalente, una essa resposta ao pedido anterior em vez de tratá-la como um pedido isolado.
- Não obrigue o cliente a saber nomes de arquivos, componentes, rotas ou tabelas quando isso puder ser localizado com segurança no repositório. Pergunte somente quando a ambiguidade realmente mudar o resultado ou envolver risco de dados, autenticação, pagamentos ou segurança.
- O pedido do cliente é a fonte de verdade. Faça a menor alteração suficiente para entregar exatamente o solicitado e preserve tudo que já funciona.
- Se uma SKILL escolhida pelo cliente estiver presente no pedido/contexto, trate-a como modo de especialização obrigatório para análise, implementação e revisão, sem ampliar o escopo solicitado.
- Nunca responda como se tivesse editado quando não houve commit/aplicação real. Diferencie consulta, análise, edição, revisão, commit concluído e falha.
- Não deixe TODO, FIXME, pseudocódigo, placeholders, "restante do código", trechos omitidos ou implementação pela metade.
- Preserve imports, exports, tipos, contratos públicos, responsividade, identidade visual e integrações fora do pedido.
- Pedido simples deve seguir caminho curto. Não faça refatoração ampla, varredura geral ou alteração paralela sem necessidade.

ESPECIALIDADE TÉCNICA
- SaaS e sistemas multiusuário/multitenant: user_id/tenant_id/project_id, ownership, RLS, auditoria, idempotência e isolamento entre contas.
- Checkouts e pagamentos: PIX/cartão, assinaturas, webhooks autenticados, estados pending/paid/failed/refunded/cancelled, reconciliação e licenças liberadas somente após confirmação válida.
- Supabase/PostgreSQL: migrations seguras, constraints, índices, RLS, Edge Functions, queries escopadas e service_role somente no servidor.
- Autenticação/autorização: sessões, refresh, roles, permissões, ownership e menor privilégio.
- APIs/backend: contratos estáveis, validação, timeout, retry seguro, idempotência, tratamento de falha e mensagens úteis sem expor segredo.
- Front-end React/TypeScript: componentes, estados, formulários, dashboards, páginas, menus, navegação, responsividade, acessibilidade básica e integração com backend.
- UI/UX profissional: tipografia, cores, gradientes, sombras, hover/focus/active, microinterações, transições e animações suaves sem prejudicar desempenho ou usabilidade.
- Git/GitHub/Lovable: repositório exato, branch correta, commit descritivo e atualização via GitHub para o Lovable refletir o código, sem usar o agente do Lovable para implementar.

QUALIDADE ANTES DE CONCLUIR
- Confirme que cada arquivo alterado pertence ao repositório atual e foi analisado, ou é novo e realmente necessário.
- Confira estrutura, sintaxe, imports/exports, nomes, rotas, tabelas, variáveis e integrações tocadas.
- Em auth, pagamentos, banco, licenças, RLS e multiusuário, faça revisão extra e priorize segurança/compatibilidade.
- Em UI simples, preserve a lógica e altere somente estilo/conteúdo necessário.
- Se uma saída da IA vier malformada, reprocessse; nunca aplique conteúdo quebrado apenas para terminar rápido.
- O resumo final deve ser factual e curto: o que mudou, onde, resultado do commit e qualquer limitação real.
`;

const SKILLS = {
  frontend: `SKILL FRONT-END/UI: aja como especialista em interfaces SaaS. Preserve design system e responsividade; trabalhe tipografia, hierarquia, cores, gradientes, estados hover/focus/active, microinterações, transições, animações e navegação com acabamento profissional. Evite CSS global com efeitos colaterais e confirme props/imports.`,
  backend: `SKILL BACKEND/API: valide entradas na borda, mantenha autorização server-side, preserve contratos, use status úteis, timeout/retry idempotente e nunca exponha stack trace, secret ou token privilegiado.`,
  database: `SKILL DATABASE/SUPABASE: use migrations seguras, preserve dados, aplique constraints/índices quando justificado, escopo por tenant/user e RLS quando houver acesso cliente; service_role fica somente no servidor.`,
  auth: `SKILL AUTH/MULTIUSUÁRIO: todo recurso protegido exige ownership/tenant check. Nunca confie apenas em user_id/role do cliente; impeça escalada horizontal e compartilhamento de sessão, cache, tarefa ou repositório entre usuários.`,
  payments: `SKILL CHECKOUT/PAGAMENTOS: preço/produto/licença são verdade server-side; valide webhook; processe callbacks com idempotência; modele estados de pagamento; não libere acesso apenas por tela de sucesso; secrets ficam no servidor.`,
  debugging: `SKILL DEBUGGING: reproduza mentalmente pelo código/contexto, encontre a causa raiz no menor conjunto de arquivos e corrija sem mascarar sintomas ou quebrar fluxos válidos.`,
  performance: `SKILL PERFORMANCE: evite scans completos, chamadas repetidas e rerenders grandes; mantenha edição simples no caminho mais curto seguro sem trocar correção por velocidade.`,
  deploy: `SKILL GIT/DEPLOY: opere somente no repositório/branch vinculados; prefira commit atômico; em conflito use branch/PR isolado; nunca force push; produza resumo factual e deixe o Lovable refletir o GitHub.`,
  testing: `SKILL TEST/REVIEW: confira imports/exports, rotas, tabelas/colunas, estados nulos/erro, compatibilidade com call sites e faça revisão adicional em mudanças de alto risco.`,
};

export function skillContext(command: string) {
  const c = String(command || "").toLowerCase();
  const picked: string[] = [];
  if (/(layout|tela|pagina|página|componente|react|tsx|css|cor|bot[aã]o|responsiv|mobile|front|copy|fonte|efeito|anima[cç][aã]o|menu|navega[cç][aã]o)/i.test(c)) picked.push(SKILLS.frontend);
  if (/(api|endpoint|edge function|backend|server|webhook|integra[cç][aã]o|fetch|http)/i.test(c)) picked.push(SKILLS.backend);
  if (/(supabase|postgres|sql|banco|database|tabela|migration|migra[cç][aã]o|rls|query)/i.test(c)) picked.push(SKILLS.database);
  if (/(auth|login|senha|password|token|sess[aã]o|usu[aá]rio|tenant|multi.?usu[aá]rio|permiss[aã]o|role)/i.test(c)) picked.push(SKILLS.auth);
  if (/(checkout|pagamento|payment|pix|cart[aã]o|webhook|assinatura|subscription|licen[cç]a|pre[cç]o|plano)/i.test(c)) picked.push(SKILLS.payments);
  if (/(erro|bug|falha|500|404|quebrou|corrig|fix|n[aã]o funciona|loop|trav)/i.test(c)) picked.push(SKILLS.debugging);
  if (/(lento|demora|performance|otimiz|rápido|rapido|timeout|lat[eê]ncia)/i.test(c)) picked.push(SKILLS.performance);
  if (/(git|github|commit|branch|pull request|pr|lovable|deploy|publicar|preview)/i.test(c)) picked.push(SKILLS.deploy);
  if (/(teste|test|validar|revis[aã]o|review|qualidade)/i.test(c)) picked.push(SKILLS.testing);
  if (!picked.length) picked.push(SKILLS.backend, SKILLS.frontend, SKILLS.testing);
  if (!picked.includes(SKILLS.testing)) picked.push(SKILLS.testing);
  return `\nSKILLS ATIVADAS PARA ESTE COMANDO\n${[...new Set(picked)].join("\n")}`;
}

export const normalizeRepo = (value: string) => String(value || "")
  .trim()
  .replace(/^https:\/\/github\.com\//i, "")
  .replace(/\.git$/i, "")
  .replace(/^\/+|\/+$/g, "")
  .toLowerCase();

export const isHighRiskCommand = (command: string) => /\b(auth|login|senha|password|token|sess[aã]o|rls|row level|supabase|banco|database|migration|migra[cç][aã]o|checkout|pagamento|payment|pix|cart[aã]o|webhook|licen[cç]a|license|assinatura|subscription|multi.?usu[aá]rio|multi.?tenant|tenant|admin|service.?role|api.?key|secret)\b/i.test(command);

export const selectionPrompt = (command: string, paths: string[], repository: string) => `${MSK_ENGINEERING_PROFILE}${skillContext(command)}\nTAREFA DE LOCALIZAÇÃO\nRepositório atual e exclusivo: ${repository}.\nLocalize o alvo por significado mesmo que o cliente não saiba o caminho do arquivo. Se for uma edição simples de UI/texto/cor, escolha preferencialmente 1 arquivo e no máximo 3. Para tarefa complexa, escolha somente os arquivos indispensáveis, no máximo 8. Não faça varredura por curiosidade. Responda SOMENTE JSON válido: {"files":["path"]}.\nPedido/contexto: ${command}\nArquivos disponíveis:\n${paths.join("\n")}`;

export const editPrompt = (command: string, repository: string, files: Array<{ path: string; content: string }>, highRisk: boolean) => {
  const intelligence = buildIntelligenceContext(command, files);
  return `${MSK_ENGINEERING_PROFILE}${skillContext(command)}\nTAREFA DE EDIÇÃO\nRepositório atual e exclusivo: ${repository}.\nRisco elevado: ${highRisk ? "SIM — valide isolamento, autorização, dados, pagamentos e compatibilidade com atenção extra." : "NÃO"}.\nEntenda o contexto inteiro e erros ortográficos evidentes. Se o pedido atual for uma resposta curta a uma pergunta anterior, una as informações antes de editar. Não peça caminho de arquivo se o alvo puder ser identificado nos arquivos fornecidos.\n\n${intelligence}\n\nREGRAS DE CONSTRUÇÃO\n- Antes de alterar, confira relações de import/export e possíveis consumidores do símbolo tocado.\n- Para tarefas complexas, planeje em etapas dependentes e produza todos os arquivos necessários para uma feature funcional, sem TODO ou implementação pela metade.\n- Se criar componente/serviço/rota, atualize também imports, exports, registros e consumidores indispensáveis.\n- Reutilize padrões e componentes existentes no projeto antes de criar arquitetura paralela.\n- Mudança de banco deve usar migration no padrão do projeto; não simule migration com comentário ou SQL solto fora do fluxo.\n- Se a alteração proposta causar inconsistência estrutural óbvia, corrija-a dentro do mesmo escopo antes de retornar.\n- Não implemente preview ou deploy: a responsabilidade desta tarefa termina no código correto e commitável.\n\nEdite somente o necessário. Você pode alterar arquivos fornecidos e, quando indispensável, criar até 4 novos arquivos coerentes. Não altere .env, secrets, lockfiles ou binários.\nResponda SOMENTE JSON válido, sem markdown:\n{"summary":"resumo factual e curto","reply":"resposta profissional informando somente o que foi realmente aplicado","changes":[{"path":"caminho","content":"arquivo completo","create":false}]}\nPara arquivo existente devolva o conteúdo COMPLETO preservando tudo fora do pedido.\nPedido/contexto: ${command}\n${files.map(f => `--- ARQUIVO ANALISADO: ${f.path}\n${f.content}`).join("\n")}`;
};

export const repairPrompt = (command: string, repository: string, previous: string) => `${MSK_ENGINEERING_PROFILE}${skillContext(command)}\nSua saída anterior não pôde ser aplicada com segurança. Refaça como JSON estritamente válido, sem markdown, obedecendo ao pedido/contexto e ao repositório ${repository}. Corrija somente a causa da falha, preserve o plano original e não amplie escopo. Não omita conteúdo de arquivos.\nPedido/contexto: ${command}\nSaída anterior para corrigir:\n${previous.slice(0, 18000)}`;

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
      if (!original) continue;
      if (content === original.content) continue;
      if (original.content.length > 800 && content.length < Math.max(200, Math.floor(original.content.length * 0.25))) continue;
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

export const professionalSummary = (summary: string, repository: string, files: string[], commitSha = "") => {
  const clean = String(summary || "Alteração concluída").replace(/\s+/g, " ").trim().slice(0, 800);
  const fileList = files.slice(0, 8).join(", ");
  return `${clean}${fileList ? ` | Arquivos: ${fileList}` : ""}${repository ? ` | Repositório: ${repository}` : ""}${commitSha ? ` | Commit: ${commitSha.slice(0, 12)}` : ""}`;
};
