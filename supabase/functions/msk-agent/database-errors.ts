export type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
};

export type DatabaseErrorDescriptor = {
  code: string;
  message: string;
  httpStatus: number;
  retryable: boolean;
  context: Record<string, unknown>;
};

const text = (value: unknown) => String(value ?? "").trim();

export function looksLikeDatabaseError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as DatabaseErrorLike;
  return !!(value.code || value.details || value.hint) || /postgres|postgrest|supabase|relation|column|constraint|row-level security/i.test(text(value.message));
}

export function mapDatabaseErrorDescriptor(error: unknown): DatabaseErrorDescriptor {
  const value = (error && typeof error === "object" ? error : {}) as DatabaseErrorLike;
  const pgCode = text(value.code).toUpperCase();
  const message = text(value.message);
  const details = text(value.details);
  const hint = text(value.hint);
  const combined = `${pgCode} ${message} ${details} ${hint}`.toUpperCase();
  const context = {
    database_code: pgCode || null,
    database_message: message.slice(0, 1200) || null,
    database_details: details.slice(0, 1200) || null,
    database_hint: hint.slice(0, 800) || null,
  };

  if (pgCode === "42501" || /ROW[- ]LEVEL SECURITY|RLS/.test(combined)) {
    return { code: "RLS_VIOLATION", message: "O banco recusou a operação pela política de acesso.", httpStatus: 403, retryable: false, context };
  }
  if (pgCode === "23502") {
    return { code: "NOT_NULL_VIOLATION", message: "Um campo obrigatório da tarefa não foi preenchido.", httpStatus: 422, retryable: false, context };
  }
  if (pgCode === "42P01" || /RELATION .* DOES NOT EXIST/.test(combined)) {
    return { code: "TABLE_NOT_FOUND", message: "A tabela necessária para registrar a tarefa não existe.", httpStatus: 500, retryable: false, context };
  }
  if (pgCode === "42703" || pgCode === "PGRST204" || /COLUMN .* DOES NOT EXIST/.test(combined)) {
    return { code: "DATABASE_SCHEMA_MISMATCH", message: "O schema do banco não corresponde à versão atual do agente.", httpStatus: 500, retryable: false, context };
  }
  if (pgCode === "23503") {
    return { code: "FOREIGN_KEY_VIOLATION", message: "A tarefa referencia um projeto ou registro que não existe mais.", httpStatus: 409, retryable: false, context };
  }
  if (pgCode === "23505") {
    return { code: "UNIQUE_VIOLATION", message: "O identificador da tarefa entrou em conflito com um registro existente.", httpStatus: 409, retryable: true, context };
  }
  if (pgCode === "22P02") {
    return { code: "DATABASE_VALUE_INVALID", message: "Um valor enviado para o banco possui formato inválido.", httpStatus: 422, retryable: false, context };
  }
  if (["40001", "40P01", "53300", "57P01", "57P02", "57P03"].includes(pgCode)) {
    return { code: "DATABASE_TEMPORARILY_UNAVAILABLE", message: "O banco está temporariamente ocupado ou indisponível.", httpStatus: 503, retryable: true, context };
  }
  if (/FETCH FAILED|NETWORK|TIMEOUT|CONNECTION|ECONN|SOCKET/.test(combined)) {
    return { code: "DATABASE_NETWORK_UNAVAILABLE", message: "A conexão com o banco ficou temporariamente indisponível.", httpStatus: 503, retryable: true, context };
  }
  if (pgCode.startsWith("PGRST")) {
    return { code: "POSTGREST_ERROR", message: "A API do banco recusou a operação de persistência.", httpStatus: 502, retryable: false, context };
  }

  return { code: "DATABASE_PERSISTENCE_ERROR", message: "O banco recusou o registro da tarefa.", httpStatus: 500, retryable: false, context };
}
