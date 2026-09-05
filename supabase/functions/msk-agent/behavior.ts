/**
 * MSK Agent — camada de comportamento (estilo assistente de produto completo).
 *
 * Responsável por: classificação de intenção sem gastar créditos, respostas de
 * conversa/saudação, perguntas de esclarecimento para pedidos vagos, blueprints
 * de criação completa (login, checkout, dashboard, CRUD...), regras de segurança
 * e reversão de alterações.
 */

export type AgentIntentKind = "greeting" | "smalltalk" | "question" | "revert" | "status" | "edit";

export type AgentIntent = {
  kind: AgentIntentKind;
  confidence: number;
  reason: string;
};

const norm = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const RE_GREETING = /^(oi+|ola+|opa+|eai+|e ai|salve|bom dia|boa tarde|boa noite|hey+|hi+|hello+|tudo bem\??|beleza\??|blz\??)[\s!.,?]*$/;
const RE_SMALLTALK = /^(obrigad[oa]|valeu|vlw|ok+|okay|blz|show|perfeito|top|legal|massa|kk+|haha+|entendi|isso|certo|bom trabalho|parabens|de nada|boa)[\s!.,?]*$/;
const RE_REVERT = /\b(desfaz(er)?|desfa[cç]a|revert(er|a)?|volt(a|e|ar)|restaur(a|e|ar)|cancel(a|e|ar) (a )?(ultima|alteracao)|como (era|estava) antes|do jeito que estava|remov(a|er) (a )?(ultima|essa) (alteracao|mudanca))\b/;
const RE_QUESTION = /^(o que|oque|qual|quais|quando|onde|como|por que|porque|pra que|para que|tem como|da pra|voce (pode|consegue)|cade|explica|explique|me explica|analis(a|e|ar)|revis(a|e|ar)|verific(a|e|ar)|confer(e|ir)|diagnostic)/;
const RE_EDIT_VERB = /\b(mud(a|e|ar)|troc(a|e|ar)|alter(a|e|ar)|ajust(a|e|ar)|coloc(a|e|ar)|adicion(a|e|ar)|cri(a|e|ar)|implement(a|e|ar)|remov(a|er)|apag(a|ue|ar)|corrig(e|ir|a)|arrum(a|e|ar)|deix(a|e|ar)|aument(a|e|ar)|diminu(i|a|ir)|traduz(a|ir)|renome(ia|ar)|refator(a|e|ar)|integr(a|e|ar)|conect(a|e|ar))\b/;

export function classifyIntent(command: string): AgentIntent {
  const q = norm(command);
  if (!q) return { kind: "edit", confidence: 0, reason: "vazio" };
  if (RE_GREETING.test(q)) return { kind: "greeting", confidence: 0.98, reason: "saudação" };
  if (q.length <= 40 && RE_SMALLTALK.test(q)) return { kind: "smalltalk", confidence: 0.95, reason: "conversa curta" };
  if (RE_REVERT.test(q) && !/\bcri(a|e|ar)\b/.test(q)) return { kind: "revert", confidence: 0.9, reason: "pedido de reversão" };
  if (/\b(status|andamento|ja terminou|terminou\??|acabou\??|em que pe)\b/.test(q) && q.length <= 60) {
    return { kind: "status", confidence: 0.8, reason: "consulta de andamento" };
  }
  if (RE_QUESTION.test(q) && !RE_EDIT_VERB.test(q)) return { kind: "question", confidence: 0.85, reason: "pergunta/análise" };
  return { kind: "edit", confidence: RE_EDIT_VERB.test(q) ? 0.9 : 0.6, reason: "pedido de execução" };
}

/** Resposta determinística (sem custo de IA) para saudação e conversa curta. */
export function conversationalReply(command: string, intent: AgentIntent, ctx: { repository?: string; lastSummary?: string } = {}) {
  const repo = ctx.repository ? ` no repositório **${ctx.repository}**` : "";
  if (intent.kind === "greeting") {
    return [
      `Olá! Eu sou o agente MSK e já estou conectado${repo}.`,
      "",
      "Posso, por exemplo:",
      "• criar páginas completas (login, checkout, painel, landing) com rotas, validação e estados;",
      "• alterar visual (cores, textos, fontes, espaçamentos e responsividade);",
      "• corrigir erros, revisar código e analisar o projeto;",
      "• desfazer e voltar exatamente como estava antes.",
      "",
      "É só me dizer o que você quer que eu faça.",
    ].join("\n");
  }
  const tail = ctx.lastSummary ? `\n\nÚltima alteração aplicada: ${ctx.lastSummary}` : "";
  return `Combinado! Estou aqui${repo} quando quiser a próxima alteração.${tail}`;
}

/** Perguntas de esclarecimento para pedidos vagos — evita edição errada e retrabalho. */
export function clarificationFor(command: string): { question: string; options: string[] } | null {
  const q = norm(command);
  if (q.split(" ").length > 10) return null;

  const hasColorValue = /\b(azul|vermelh|verde|amarel|laranja|roxo|rosa|preto|branco|cinza|bege|dourad|prata|escur|clar|#[0-9a-f]{3,8}|rgb)\b/.test(q);
  const hasTarget = /\b(fundo|background|botao|botoes|texto|titulo|menu|header|cabecalho|rodape|footer|card|hero|barra|link|borda|icone|sidebar|pagina|tela)\b/.test(q);

  if (/\bcor\b/.test(q) && !hasColorValue && !hasTarget) {
    return {
      question: "Consigo fazer agora. Só me confirme qual cor e onde: o que exatamente deve mudar de cor?",
      options: ["Cor de fundo da página", "Cor dos botões", "Cor dos textos/títulos", "Cor do menu/cabeçalho"],
    };
  }
  if (/^(muda|mude|troca|troque|altera|altere|ajusta|ajuste)\b/.test(q) && q.split(" ").length <= 3) {
    return {
      question: "Me diga o que devo alterar e qual o resultado esperado (elemento + mudança).",
      options: ["Alterar cor", "Alterar texto", "Alterar tamanho/espaçamento", "Corrigir um erro"],
    };
  }
  return null;
}

/** Requisitos de entrega completa por tipo de pedido (comportamento "faz tudo"). */
export function featureBlueprint(command: string): string {
  const q = norm(command);
  const blocks: string[] = [];
  const wants = (re: RegExp) => re.test(q);

  if (wants(/\b(login|autentica|cadastro|sign ?in|sign ?up|conta)\b/)) {
    blocks.push(
      "ENTREGA COMPLETA DE LOGIN/CADASTRO: rota real da página, formulário com e-mail e senha, validação de campos, mensagens de erro claras, estado de carregamento, botão desabilitado durante envio, link de cadastro/recuperação, redirecionamento após entrar e proteção da rota privada. Nada de tela decorativa sem funcionamento.",
    );
  }
  if (wants(/\b(checkout|pagamento|carrinho|assinatura|plano)\b/)) {
    blocks.push(
      "ENTREGA COMPLETA DE CHECKOUT: resumo dos itens, cálculo de total, campos de dados do cliente com validação, seleção de forma de pagamento, estados de carregando/sucesso/erro, tela de confirmação e tratamento de falha. Não invente credenciais nem chaves.",
    );
  }
  if (wants(/\b(dashboard|painel|admin|relatorio|grafico)\b/)) {
    blocks.push(
      "ENTREGA COMPLETA DE PAINEL: layout responsivo, cartões de métricas, listagem com estados de vazio/carregando/erro e navegação funcional.",
    );
  }
  if (wants(/\b(crud|listagem|cadastr(o|ar) de|tabela de)\b/)) {
    blocks.push(
      "ENTREGA COMPLETA DE CRUD: listar, criar, editar e excluir com confirmação, validação e feedback visual em cada ação.",
    );
  }
  if (wants(/\b(landing|site institucional|pagina inicial|home)\b/)) {
    blocks.push(
      "ENTREGA COMPLETA DE PÁGINA: seção principal, blocos de conteúdo, chamada para ação, responsividade e textos coerentes com o produto.",
    );
  }
  if (wants(/\b(formulario|contato|newsletter)\b/)) {
    blocks.push("ENTREGA COMPLETA DE FORMULÁRIO: validação por campo, estado de envio, mensagem de sucesso e de erro.");
  }
  return blocks.join("\n");
}

/** Regras permanentes de comportamento e segurança aplicadas a toda execução. */
export const MSK_AGENT_PERSONA = [
  "IDENTIDADE: você é o agente do MSK System. Fala português do Brasil, é objetivo, educado e profissional.",
  "ENTREGA: quando o cliente pede algo, você executa de ponta a ponta e entrega funcionando — nunca entrega esqueleto, rascunho, TODO ou instrução de como fazer.",
  "ESCOPO: altere somente o necessário para atender o pedido; preserve o restante do projeto exatamente como está.",
  "CONSISTÊNCIA: siga os padrões, estilos, idioma e bibliotecas que já existem no projeto em vez de introduzir novos sem necessidade.",
  "QUALIDADE: o resultado precisa compilar, manter imports válidos, não duplicar declarações e não quebrar rotas existentes.",
  "RESPONSIVIDADE E ACESSIBILIDADE: telas novas devem funcionar em celular e desktop, com rótulos e contraste adequados.",
  "ESTADOS: telas com dados precisam de estado de carregando, vazio e erro.",
].join("\n");

export const MSK_SECURITY_RULES = [
  "SEGURANÇA: nunca escreva chaves, tokens, senhas ou segredos no código; use variáveis de ambiente.",
  "SEGURANÇA: não desative autenticação, licença, validação de permissão, RLS ou verificação de pagamento.",
  "SEGURANÇA: não apague arquivos de configuração, migrações existentes, lockfiles ou pastas protegidas.",
  "SEGURANÇA: não envie dados sensíveis para serviços externos e não adicione dependências desnecessárias.",
  "SEGURANÇA: se o pedido exigir mexer em autenticação, banco ou pagamento, faça a alteração mínima e mantenha as proteções existentes.",
].join("\n");

export const MSK_CHAT_RULES = [
  MSK_AGENT_PERSONA,
  "MODO CONVERSA: nesta resposta nenhum arquivo é alterado. Nunca afirme que editou, criou ou publicou algo.",
  "Responda de forma direta e útil. Se o cliente descreveu uma alteração, confirme em uma frase o que você fará e peça o 'pode fazer'.",
  "Se faltar informação essencial, faça no máximo uma pergunta curta com opções.",
  "Nunca devolva mensagem de erro seca: explique em linguagem simples e ofereça o próximo passo.",
].join("\n");
