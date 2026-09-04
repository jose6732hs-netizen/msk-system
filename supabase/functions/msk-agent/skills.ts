import { db } from "./common.ts";

/**
 * Catálogo determinístico de skills do MSK.
 * A classificação acontece ANTES de qualquer chamada de IA, para que o backend
 * localize somente os arquivos necessários e gaste o mínimo possível de tokens.
 */
export type SkillRisk = "low" | "medium" | "high";

export type Skill = {
  id: string;
  label: string;
  detector: RegExp;
  /** Padrões de arquivos prováveis, em ordem de prioridade. */
  filePatterns: RegExp[];
  instructions: string;
  validation: string;
  risk: SkillRisk;
  maxFiles: number;
};

export const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const SKILL_CATALOG: Skill[] = [
  {
    id: "theme_edit",
    label: "Tema / cores / estilo",
    detector: /\b(cor|cores|color|fundo|background|tema|theme|dark|light|escuro|claro|gradiente|paleta|estilo|style|css|tailwind|fonte|font|sombra|borda)\b/,
    filePatterns: [
      /(^|\/)(globals?|styles?|app|index|theme|tokens)\.(css|scss)$/i,
      /(^|\/)tailwind\.config\.(t|j)s$/i,
      /\.(css|scss)$/i,
      /src\/(routes|pages|components)\/.+\.(tsx|jsx)$/i,
    ],
    instructions: "Altere apenas tokens/classes visuais. Não mexa em lógica, dados, rotas ou estado.",
    validation: "A alteração deve tocar apenas propriedades visuais (cor, fundo, fonte, espaçamento, borda, sombra).",
    risk: "low",
    maxFiles: 3,
  },
  {
    id: "copy_edit",
    label: "Texto / copy",
    detector: /\b(texto|title|titulo|copy|frase|palavra|escrit[ao]|label|descricao|subtitulo|botao|button|mensagem|chamada)\b/,
    filePatterns: [
      /src\/(routes|pages)\/.+\.(tsx|jsx)$/i,
      /src\/components\/.+\.(tsx|jsx)$/i,
      /\.(tsx|jsx|html|md)$/i,
    ],
    instructions: "Troque somente o texto exibido. Preserve JSX, props, componentes e acessibilidade.",
    validation: "Somente strings visíveis podem mudar; nenhuma estrutura de componente pode ser removida.",
    risk: "low",
    maxFiles: 3,
  },
  {
    id: "image_edit",
    label: "Imagem / logo / banner",
    detector: /\b(imagem|imagens|logo|logotipo|banner|foto|icone|favicon|avatar|thumbnail)\b/,
    filePatterns: [
      /src\/(routes|pages|components)\/.+\.(tsx|jsx)$/i,
      /(^|\/)(index|app)\.html$/i,
    ],
    instructions: "Troque somente a referência de imagem (src/import/alt). Não gere binários.",
    validation: "Somente atributos de imagem podem mudar.",
    risk: "low",
    maxFiles: 3,
  },
  {
    id: "bug_fix",
    label: "Correção de erro",
    detector: /\b(erro|error|bug|nao funciona|não funciona|quebrou|travou|falha|exception|crash|corrig|conserta)\b/,
    filePatterns: [
      /src\/.+\.(tsx|ts|jsx|js)$/i,
    ],
    instructions: "Corrija a causa do erro com a menor alteração possível e preserve o restante do comportamento.",
    validation: "O arquivo precisa continuar compilável e nenhuma funcionalidade não relacionada pode sumir.",
    risk: "medium",
    maxFiles: 4,
  },
  {
    id: "payment_edit",
    label: "Pagamentos",
    detector: /\b(pagamento|pagamentos|pix|cartao|checkout|stripe|paddle|mercado ?pago|gateway|assinatura|cobranca)\b/,
    filePatterns: [
      /(checkout|payment|pagamento|stripe|paddle|billing|subscription)/i,
      /src\/(lib|routes|server)\/.+\.(ts|tsx)$/i,
    ],
    instructions: "Altere somente o provedor/fluxo de pagamento citado. Nunca exponha segredos no cliente.",
    validation: "Nenhuma chave secreta pode ir para código cliente; o fluxo existente precisa continuar íntegro.",
    risk: "high",
    maxFiles: 4,
  },
  {
    id: "api_config",
    label: "API / integração",
    detector: /\b(api|endpoint|integracao|integração|secret|chave|key|webhook|token|rota|route|http|fetch)\b/,
    filePatterns: [
      /src\/(lib|routes|server|integrations)\/.+\.(ts|tsx)$/i,
      /(config|env|client)\.(ts|tsx|js)$/i,
    ],
    instructions: "Ajuste somente a integração citada. Chaves ficam em variáveis de ambiente, nunca no código.",
    validation: "Segredos não podem ser literais; contratos de outras integrações não podem mudar.",
    risk: "high",
    maxFiles: 4,
  },
  {
    id: "github_edit",
    label: "Repositório / arquivos",
    detector: /\b(repositorio|repositório|branch|commit|readme|gitignore|workflow)\b/,
    filePatterns: [/\.(md|ya?ml|json)$/i, /src\/.+\.(ts|tsx)$/i],
    instructions: "Altere somente os arquivos de repositório citados.",
    validation: "Nenhum arquivo de código de produto pode ser alterado sem pedido explícito.",
    risk: "medium",
    maxFiles: 3,
  },
  {
    id: "generic_edit",
    label: "Alteração geral",
    detector: /.*/,
    filePatterns: [
      /src\/(routes|pages)\/.+\.(tsx|jsx)$/i,
      /src\/components\/.+\.(tsx|jsx)$/i,
      /src\/.+\.(ts|tsx|css)$/i,
    ],
    instructions: "Execute exatamente o pedido, com a menor alteração possível.",
    validation: "Preserve toda a lógica não relacionada ao pedido.",
    risk: "medium",
    maxFiles: 5,
  },
];

const GENERIC = SKILL_CATALOG[SKILL_CATALOG.length - 1];

/** Overrides opcionais persistidos pelo Super Admin (tabela pode não existir). */
export async function loadSkillOverrides(): Promise<Record<string, Partial<Skill>>> {
  try {
    const { data, error } = await db.from("msk_agent_skill_catalog").select("*");
    if (error || !Array.isArray(data)) return {};
    const map: Record<string, Partial<Skill>> = {};
    for (const row of data as any[]) {
      const id = String(row?.id || row?.skill_id || "").trim();
      if (!id) continue;
      map[id] = {
        instructions: row?.instructions ? String(row.instructions) : undefined,
        validation: row?.validation ? String(row.validation) : undefined,
        risk: ["low", "medium", "high"].includes(String(row?.risk)) ? (String(row.risk) as SkillRisk) : undefined,
        maxFiles: Number.isFinite(Number(row?.max_files)) ? Number(row.max_files) : undefined,
      };
    }
    return map;
  } catch {
    return {};
  }
}

export function classifySkill(command: string, overrides: Record<string, Partial<Skill>> = {}): Skill {
  const q = normalizeText(command);
  const found = SKILL_CATALOG.find((skill) => skill.id !== "generic_edit" && skill.detector.test(q)) || GENERIC;
  const patch = overrides[found.id] || {};
  return {
    ...found,
    instructions: patch.instructions ?? found.instructions,
    validation: patch.validation ?? found.validation,
    risk: patch.risk ?? found.risk,
    maxFiles: Math.max(1, Math.min(8, patch.maxFiles ?? found.maxFiles)),
  };
}

/** Strings literais citadas pelo cliente ("Seja Bem-vindo", 'Comprar agora'). */
export function literalTargets(command: string): string[] {
  const out: string[] = [];
  const quoted = String(command).match(/["'“”'']([^"'“”'']{2,80})["'“”'']/g) || [];
  for (const raw of quoted) {
    const value = raw.slice(1, -1).trim();
    if (value.length >= 2) out.push(value);
  }
  if (!out.length) {
    const after = String(command).match(/\b(?:texto|titulo|título|frase|copy|bot[aã]o|label)\s+(?:de\s+|do\s+|da\s+)?([A-Za-zÀ-ÿ0-9 ]{3,60})/i)?.[1];
    if (after) out.push(after.trim());
  }
  return [...new Set(out)].slice(0, 3);
}

const IGNORED = /(^|\/)(node_modules|dist|build|coverage|\.git)(\/|$)|routeTree\.gen|\.test\.|\.spec\.|lock\.json$|package-lock|yarn\.lock|pnpm-lock/i;

/**
 * Localização determinística: pontua caminhos pela skill + termos do comando.
 * Não envia o repositório inteiro para a IA.
 */
export function locateFiles(paths: string[], command: string, skill: Skill): string[] {
  const q = normalizeText(command);
  const terms = q.split(/[^a-z0-9_-]+/).filter((t) => t.length >= 4);
  const scored = paths
    .filter((path) => !IGNORED.test(path))
    .map((path) => {
      const p = normalizeText(path);
      let score = 0;
      skill.filePatterns.forEach((pattern, index) => {
        if (pattern.test(path)) score += 40 - index * 8;
      });
      for (const term of terms) if (p.includes(term)) score += 14;
      if (/src\/routes\/(index|home)(\.|\/)/.test(p)) score += 16;
      if (/(^|\/)(index|home|landing|hero|app|main|layout)\.(tsx?|jsx?)$/.test(p)) score += 10;
      if (/readme|\.md$|package\.json$/.test(p)) score -= 20;
      return { path, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.path.localeCompare(b.path));
  return scored.slice(0, skill.maxFiles).map((item) => item.path);
}

/**
 * Busca literal no repositório via GitHub code search. Quando o cliente cita um
 * texto exato, o arquivo certo é encontrado sem gastar tokens de IA.
 */
export async function searchLiteral(
  ghFetch: (path: string) => Promise<any>,
  owner: string,
  repo: string,
  literals: string[],
  knownPaths: string[],
): Promise<string[]> {
  const known = new Map(knownPaths.map((p) => [p.toLowerCase(), p]));
  const hits: string[] = [];
  for (const literal of literals.slice(0, 2)) {
    try {
      const query = encodeURIComponent(`"${literal}" repo:${owner}/${repo}`);
      const data = await ghFetch(`/search/code?q=${query}&per_page=5`);
      for (const item of data?.items || []) {
        const canonical = known.get(String(item?.path || "").toLowerCase());
        if (canonical && !hits.includes(canonical)) hits.push(canonical);
      }
    } catch {
      // Code search é um acelerador, nunca um bloqueio.
    }
  }
  return hits.slice(0, 3);
}

export type TaskContext = {
  projectId: string;
  projectName: string;
  repository: string;
  branch: string;
  skillId: string;
  skillLabel: string;
  risk: SkillRisk;
  instructions: string;
  validation: string;
};

/** Bloco técnico injetado no prompt interno enviado à IA ativa. */
export function contextBlock(ctx: TaskContext) {
  return [
    `PROJETO: ${ctx.projectName || ctx.projectId}`,
    `LOVABLE PROJECT ID: ${ctx.projectId}`,
    `REPOSITÓRIO: ${ctx.repository}`,
    `BRANCH: ${ctx.branch}`,
    `TIPO DE TAREFA: ${ctx.skillLabel} (${ctx.skillId}, risco ${ctx.risk})`,
    `REGRAS DA SKILL: ${ctx.instructions}`,
    `VALIDAÇÃO EXIGIDA: ${ctx.validation}`,
  ].join("\n");
}
