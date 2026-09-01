import { db } from "./common.ts";
import { looksLikeDatabaseError, mapDatabaseErrorDescriptor } from "./database-errors.ts";

export type AgentStage =
  | "request"
  | "auth"
  | "repository"
  | "locking"
  | "locating_files"
  | "analyzing"
  | "editing"
  | "self_correcting"
  | "validating"
  | "committing"
  | "verifying"
  | "finalizing"
  | "unknown";

export type AgentErrorContext = Record<string, unknown>;

export class AgentError extends Error {
  code: string;
  stage: AgentStage;
  retryable: boolean;
  httpStatus: number;
  context: AgentErrorContext;
  originalError?: unknown;

  constructor(
    code: string,
    message: string,
    options: {
      stage?: AgentStage;
      retryable?: boolean;
      httpStatus?: number;
      context?: AgentErrorContext;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.stage = options.stage || "unknown";
    this.retryable = options.retryable === true;
    this.httpStatus = options.httpStatus || 500;
    this.context = options.context || {};
    this.originalError = options.cause;
  }
}

const rawMessage = (error: unknown) => error instanceof Error ? error.message : String(error || "Falha inesperada");

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .slice(0, 2400);
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      if (/(authorization|api.?key|secret|token|password|private.?key|signature|session|ciphertext)/i.test(key)) out[key] = "[redacted]";
      else out[key] = sanitizeValue(child, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 1000);
}

export function sanitizedContext(context: AgentErrorContext = {}) {
  return sanitizeValue(context) as AgentErrorContext;
}

export function logStructured(
  level: "info" | "warn" | "error",
  event: string,
  data: Record<string, unknown> = {},
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "msk-agent",
    event,
    ...sanitizedContext(data),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export function mapDatabaseError(error: unknown, stage: AgentStage = "request"): AgentError {
  const mapped = mapDatabaseErrorDescriptor(error);
  return new AgentError(mapped.code, mapped.message, {
    stage,
    httpStatus: mapped.httpStatus,
    retryable: mapped.retryable,
    context: mapped.context,
    cause: error,
  });
}

export function mapErrorToAgentError(error: unknown, stage: AgentStage = "unknown"): AgentError {
  if (error instanceof AgentError) {
    if (error.code === "TASK_PERSISTENCE_FAILED" && error.originalError) {
      const mapped = mapDatabaseError(error.originalError, stage === "unknown" ? "request" : stage);
      mapped.context = {
        ...mapped.context,
        wrapped_by: "TASK_PERSISTENCE_FAILED",
      };
      return mapped;
    }
    if (error.stage === "unknown" && stage !== "unknown") error.stage = stage;
    return error;
  }

  if (looksLikeDatabaseError(error)) return mapDatabaseError(error, stage === "unknown" ? "request" : stage);

  const raw = rawMessage(error);
  const upper = raw.toUpperCase();

  const exact: Array<[RegExp, string, string, number, boolean]> = [
    [/STATE_INVALID|STATE_EXPIRED/, "OAUTH_STATE_INVALID", "A autorização do GitHub expirou ou não é mais válida.", 401, false],
    [/GITHUB_APP_CREDENTIALS_INVALID/, "GITHUB_APP_CREDENTIALS_INVALID", "A credencial interna do GitHub App está inválida.", 503, false],
    [/GITHUB_PROJECT_BIND_FAILED|GITHUB_INSTALLATION_BIND_FAILED/, "GITHUB_BIND_FAILED", "Não foi possível vincular o projeto à instalação do GitHub.", 500, false],
    [/GITHUB_REQUEST_TIMEOUT/, "GITHUB_API_TIMEOUT", "O GitHub demorou além do limite seguro de resposta.", 503, true],
    [/GITHUB_INSTALLATION_TOKEN_FAILED/, "GITHUB_TOKEN_FAILED", "Não foi possível obter um token válido da instalação do GitHub.", 503, true],
    [/GITHUB_RATE_LIMIT|GITHUB 429/, "GITHUB_RATE_LIMIT", "O GitHub limitou temporariamente as requisições do agente.", 503, true],
    [/GITHUB_CONFLICT|GITHUB (409|422)/, "GITHUB_CONFLICT", "O repositório mudou durante a edição e o commit entrou em conflito.", 409, true],
    [/GITHUB (401)/, "GITHUB_AUTH_FAILED", "A autorização do GitHub foi recusada.", 401, false],
    [/GITHUB (403)/, "GITHUB_PERMISSION_DENIED", "O GitHub recusou a operação por falta de permissão.", 403, false],
    [/GITHUB (404)/, "GITHUB_RESOURCE_NOT_FOUND", "O recurso necessário não foi encontrado no GitHub.", 404, false],
    [/GITHUB (500|502|503|504)/, "GITHUB_API_UNAVAILABLE", "O GitHub ficou temporariamente indisponível.", 503, true],
    [/MSK_AI_TIMEOUT/, "AI_REQUEST_TIMEOUT", "A IA demorou além do limite seguro de resposta.", 503, true],
    [/MSK_AI_NETWORK_UNAVAILABLE/, "AI_NETWORK_UNAVAILABLE", "A conexão com a IA ficou temporariamente indisponível.", 503, true],
    [/MSK_AI_UPSTREAM_429/, "AI_RATE_LIMIT", "A IA limitou temporariamente as requisições do agente.", 503, true],
    [/MSK_AI_UPSTREAM_(408|409|425|500|502|503|504)/, "AI_UPSTREAM_UNAVAILABLE", "O provedor de IA ficou temporariamente indisponível.", 503, true],
    [/MSK_AI_JSON_INVALID/, "AI_RESPONSE_PARSE_ERROR", "A IA retornou uma resposta que não pôde ser interpretada com segurança.", 422, true],
    [/MSK_AI_EMPTY_RESPONSE/, "AI_EMPTY_RESPONSE", "A IA respondeu sem conteúdo utilizável.", 422, true],
    [/MSK_AI_UNAVAILABLE_INTERNAL|MSK_AI_ENCRYPTION_KEY_UNAVAILABLE|BAI_API_KEY/, "AI_CONFIGURATION_ERROR", "A configuração interna da IA não está disponível.", 503, false],
    [/MSK_NO_EDITABLE_FILES/, "AGENT_NO_EDITABLE_FILES", "Não encontrei arquivos editáveis compatíveis no repositório.", 422, false],
    [/MSK_NO_SAFE_TARGET_FILES/, "AGENT_TARGET_NOT_FOUND", "Não consegui identificar com segurança o arquivo alvo do pedido.", 422, true],
    [/MSK_AI_NO_VALID_CHANGES/, "NO_CHANGES_APPLIED", "Nenhuma alteração válida foi produzida para o pedido.", 422, true],
    [/MSK_REVIEW_REJECTED/, "VALIDATION_FAILED", "A alteração foi recusada na validação porque não correspondeu ao pedido com segurança.", 422, true],
    [/PRECOMMIT_VALIDATION_FAILED/, "PRECOMMIT_VALIDATION_FAILED", "A alteração falhou nas verificações obrigatórias antes do commit.", 422, true],
    [/COMMIT_VERIFICATION_FAILED/, "COMMIT_VERIFICATION_FAILED", "O commit foi criado, mas não pôde ser confirmado como estado atual do branch.", 409, true],
    [/LOCK_ACQUISITION_FAILED/, "LOCK_ACQUISITION_FAILED", "Já existe outra edição ativa neste repositório e branch.", 409, true],
    [/EDITOR_OPERATION_FAILED/, "EDITOR_OPERATION_FAILED", "A operação de edição não pôde ser aplicada ao conteúdo atual do arquivo.", 422, true],
  ];

  for (const [pattern, code, message, httpStatus, retryable] of exact) {
    if (pattern.test(upper)) return new AgentError(code, message, { stage, httpStatus, retryable, cause: error });
  }

  return new AgentError(
    "INTERNAL_ERROR",
    "O agente encontrou uma falha interna inesperada. Nenhuma conclusão foi registrada sem prova de execução.",
    { stage, httpStatus: 500, retryable: false, cause: error },
  );
}

export async function recordAgentError(input: {
  error: unknown;
  stage: AgentStage;
  taskId?: string;
  userId?: string;
  projectId?: string;
  repository?: string;
  branchName?: string;
  attempt?: number;
  context?: AgentErrorContext;
}) {
  const mapped = mapErrorToAgentError(input.error, input.stage);
  const stack = input.error instanceof Error
    ? String(input.error.stack || "").slice(0, 12000)
    : input.error && typeof input.error === "object"
      ? String(new Error(rawMessage((input.error as any)?.message || input.error)).stack || "").slice(0, 12000)
      : "";
  const originalError = input.error instanceof AgentError ? input.error.originalError : input.error;
  const context = sanitizedContext({
    ...mapped.context,
    ...(input.context || {}),
    original_error: originalError || undefined,
  });

  logStructured("error", "agent_failure", {
    task_id: input.taskId || null,
    user_id: input.userId || null,
    lovable_project_id: input.projectId || null,
    repository: input.repository || null,
    branch_name: input.branchName || null,
    stage: mapped.stage,
    code: mapped.code,
    retryable: mapped.retryable,
    attempt: Math.max(0, Number(input.attempt || 0)),
    context,
    stack: stack || null,
  });

  const { data, error } = await db.from("msk_agent_errors").insert({
    task_id: input.taskId || null,
    user_id: input.userId || null,
    lovable_project_id: input.projectId || null,
    repository: input.repository || null,
    branch_name: input.branchName || null,
    stage: mapped.stage,
    code: mapped.code,
    message: mapped.message,
    stack: stack || null,
    retryable: mapped.retryable,
    attempt: Math.max(0, Number(input.attempt || 0)),
    context,
  }).select("id").maybeSingle();

  if (error) {
    const fallback = mapDatabaseErrorDescriptor(error);
    logStructured("error", "agent_error_log_persistence_failed", {
      mapped_code: fallback.code,
      database: fallback.context,
      original_agent_code: mapped.code,
      task_id: input.taskId || null,
    });
  }
  return { mapped, errorId: String(data?.id || "") };
}

export async function acquireRepoLock(repoBranch: string, taskId: string, userId: string, ttlSeconds = 180) {
  const now = new Date();
  await db.from("msk_agent_locks").delete().eq("repo_branch", repoBranch).lt("expires_at", now.toISOString());
  const expires = new Date(now.getTime() + Math.max(60, ttlSeconds) * 1000).toISOString();
  const { error } = await db.from("msk_agent_locks").insert({ repo_branch: repoBranch, task_id: taskId, user_id: userId, expires_at: expires });
  if (!error) return true;
  if (String((error as any)?.code || "") === "23505") return false;
  throw new AgentError("LOCK_ACQUISITION_FAILED", "Não foi possível adquirir o lock de edição.", { stage: "locking", httpStatus: 409, retryable: true, cause: error });
}

export async function releaseRepoLock(repoBranch: string, taskId: string) {
  if (!repoBranch || !taskId) return;
  const { error } = await db.from("msk_agent_locks").delete().eq("repo_branch", repoBranch).eq("task_id", taskId);
  if (error) logStructured("warn", "repo_lock_release_failed", { repo_branch: repoBranch, task_id: taskId, error });
}
