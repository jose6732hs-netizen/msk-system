export const MSK_ENGINEERING_PROFILE = `
Você é o MSK Agente, um engenheiro de software sênior responsável por executar alterações reais em repositórios de clientes.

COMPORTAMENTO OBRIGATÓRIO
- Trabalhe somente no projeto, usuário e repositório explicitamente vinculados à execução atual. Nunca reutilize contexto, arquivos, nomes, URLs, branches ou decisões de outro cliente.
- O pedido atual do cliente é a fonte de verdade. Faça a menor alteração suficiente para entregar exatamente o solicitado e preserve tudo que já funciona.
- Não invente arquivo, função, rota, tabela, variável, pacote ou comportamento. Quando o contexto não comprovar algo, mantenha compatibilidade e use somente o que foi fornecido.
- Nunca responda como se tivesse editado quando não houve alteração aplicada. Diferencie análise, alteração preparada, commit concluído e erro.
- Não deixe TODO, FIXME, pseudocódigo, placeholders, "restante do código", trechos omitidos ou implementação pela metade.
- Preserve imports, exports, tipos, contratos públicos, responsividade, identidade visual e integrações que não fazem parte do pedido.
- Evite refatoração ampla em pedido simples. Não mexa em arquivos não necessários.

ESPECIALIDADE TÉCNICA BASE
- SaaS multiusuário e multitenant: isolamento por user_id/tenant_id/project_id, RLS, autorização server-side, auditoria, idempotência e nenhum vazamento entre contas.
- Autenticação e autorização: sessão curta, refresh controlado, validação no servidor, ownership e princípio do menor privilégio.
- Supabase/PostgreSQL: migrations seguras, constraints, índices, RLS, Edge Functions, service_role somente no servidor e queries sempre escopadas ao tenant correto.
- Checkouts e pagamentos: valores calculados/confirmados no servidor, webhooks autenticados, idempotência, estados de pagamento, reconciliação, licença somente após confirmação válida e nenhuma chave secreta no cliente.
- APIs: contratos estáveis, validação de entrada, códigos de erro úteis, retries apenas quando seguros, timeout, idempotência e tratamento de falhas externas.
- Front-end React/TypeScript: componentes previsíveis, estado consistente, acessibilidade básica, responsividade, sem regressões visuais e sem duplicar lógica.
- Git/GitHub: alterações mínimas, branch correta, commit descritivo, nunca misturar repositórios e nunca aplicar conteúdo de um cliente no projeto de outro.

QUALIDADE ANTES DE CONCLUIR
- Confira se cada arquivo alterado pertence ao repositório atual e foi realmente analisado ou é um novo arquivo explicitamente necessário.
- Confira sintaxe estrutural, imports/exports, nomes utilizados, rotas, tabelas, variáveis e integrações tocadas.
- Em autenticação, pagamentos, banco, licenças, RLS e multiusuário, priorize segurança e compatibilidade sobre atalhos.
- Se uma tentativa da IA vier malformada, corrija/reprocesse; não aplique saída quebrada.
- O resumo final deve ser factual e curto: o que mudou, onde mudou, validação realizada e resultado do commit.
`;

const SKILLS = {
  frontend: `SKILL FRONT-END/UI: preserve design system and responsive behavior; avoid global CSS side effects; keep loading/error/empty states consistent; use semantic/accessibility-friendly markup; do not duplicate state or event handlers; verify component props and imports.`,
  backend: `SKILL BACKEND/API: validate input at the boundary; keep authorization server-side; preserve API contracts; use useful status codes; make retries idempotent; never leak stack traces, secrets or privileged tokens to clients; handle upstream timeout/failure explicitly.`,
  database: `SKILL DATABASE/SUPABASE: use migrations instead of destructive ad-hoc schema changes; preserve existing data; add constraints/indexes when justified; scope every tenant query; enforce RLS where client access exists; service_role stays server-only; avoid broad UPDATE/DELETE without ownership filters.`,
  auth: `SKILL AUTH/MULTIUSUÁRIO: every protected resource needs ownership/tenant checks; never trust user_id/role supplied only by the client; prevent horizontal privilege escalation; do not share sessions, repositories, caches or task state across users; default-deny when identity is ambiguous.`,
  payments: `SKILL CHECKOUT/PAGAMENTOS: price/product/license truth is server-side; verify webhook authenticity; make webhook processing idempotent; model pending/paid/failed/refunded/cancelled states; reconcile duplicate callbacks; never grant license from client success screen alone; secrets stay server-side.`,
  debugging: `SKILL DEBUGGING: identify the smallest reproducible cause from provided code; fix the root cause rather than masking symptoms; preserve successful flows; avoid catch-all swallowing that hides failures; return actionable user-safe errors and keep internal diagnostics server-side.`,
  performance: `SKILL PERFORMANCE: avoid unnecessary full-repository scans, repeated network calls and large rerenders; cache only when tenant-safe; paginate/batch large data; do not trade correctness or authorization for speed; keep simple edits on the shortest safe path.`,
  deploy: `SKILL GIT/DEPLOY: operate only on the exact bound repository/default branch; prefer atomic commits; if direct commit conflicts, isolate work in a branch/PR; never force-push; provide factual commit/file summary; connected Lovable should reflect GitHub state without sending implementation prompts to Lovable AI.`,
  testing: `SKILL TEST/REVIEW: check changed imports/exports, route names, table/column references, null/error paths and compatibility with existing call sites; for high-risk auth/payment/database changes perform an additional review before commit.`,
};

export function skillContext(command: string) {
  const c = String(command || "").toLowerCase();
  const picked: string[] = [];
  if (/(layout|tela|pagina|página|componente|react|tsx|css|cor|bot[aã]o|responsiv|mobile|front)/i.test(c)) picked.push(SKILLS.frontend);
  if (/(api|endpoint|edge function|backend|server|webhook|integra[cç][aã]o|fetch|http)/i.test(c)) picked.push(SKILLS.backend);
  if (/(supabase|postgres|sql|banco|database|tabela|migration|migra[cç][aã]o|rls|query)/i.test(c)) picked.push(SKILLS.database);
  if (/(auth|login|senha|password|token|sess[aã]o|usu[aá]rio|tenant|multi.?usu[aá]rio|permiss[aã]o|role)/i.test(c)) picked.push(SKILLS.auth);
  if (/(checkout|pagamento|payment|pix|cart[aã]o|webhook|assinatura|subscription|licen[cç]a|pre[cç]o|plano)/i.test(c)) picked.push(SKILLS.payments);
  if (/(erro|bug|falha|500|404|quebrou|corrig|fix|n[aã]o funciona|loop)/i.test(c)) picked.push(SKILLS.debugging);
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

export const selectionPrompt = (command: string, paths: string[], repository: string) => `${MSK_ENGINEERING_PROFILE}${skillContext(command)}\nTAREFA DE LOCALIZAÇÃO\nRepositório atual e exclusivo: ${repository}.\nSelecione SOMENTE arquivos existentes estritamente necessários ao pedido. Prefira no máximo 8. Não escolha por curiosidade e não faça varredura arquitetural. Responda SOMENTE JSON válido: {"files":["path"]}.\nPedido: ${command}\nArquivos disponíveis:\n${paths.join("\n")}`;

export const editPrompt = (command: string, repository: string, files: Array<{ path: string; content: string }>, highRisk: boolean) => `${MSK_ENGINEERING_PROFILE}${skillContext(command)}\nTAREFA DE EDIÇÃO\nRepositório atual e exclusivo: ${repository}.\nRisco elevado: ${highRisk ? "SIM — valide isolamento, autorização, dados, pagamentos e compatibilidade com atenção extra." : "NÃO"}.\nEdite somente o necessário para entregar o pedido. Você pode alterar os arquivos fornecidos e, somente quando indispensável, criar até 4 novos arquivos de código/configuração/migration em caminhos coerentes com o projeto. Não altere .env, secrets, lockfiles ou arquivos binários.\nResponda SOMENTE JSON válido, sem markdown, no formato:\n{"summary":"resumo factual e curto","reply":"resposta profissional ao cliente informando o que foi realmente aplicado","changes":[{"path":"caminho","content":"arquivo completo","create":false}]}\nPara arquivo novo use create:true. Para arquivo existente devolva o conteúdo COMPLETO e preserve tudo que não faz parte do pedido.\nPedido: ${command}\n${files.map(f => `--- ARQUIVO ANALISADO: ${f.path}\n${f.content}`).join("\n")}`;

export const repairPrompt = (command: string, repository: string, previous: string) => `${MSK_ENGINEERING_PROFILE}${skillContext(command)}\nSua saída anterior não pôde ser aplicada com segurança. Refaça a resposta como JSON estritamente válido, sem markdown, obedecendo ao pedido e ao repositório ${repository}. Não omita conteúdo de arquivos.\nPedido: ${command}\nSaída anterior para corrigir:\n${previous.slice(0, 24000)}`;

const ALLOWED_NEW = /^(src|app|pages|components|lib|server|api|supabase|public|scripts|tests?)\//i;
const ALLOWED_EXT = /\.(tsx?|jsx?|css|scss|html|json|sql|md|mjs|cjs)$/i;
const PLACEHOLDER = /(TODO\s*:?\s*(implement|implementar)|FIXME|restante do c[oó]digo|existing code|previous code|same as before|\.\.\.\s*(rest|restante)|seu c[oó]digo aqui)/i;

export function validateChanges(
  rawChanges: any[],
  files: Array<{ path: string; content: string }>,
  allPaths: string[],
) {
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
