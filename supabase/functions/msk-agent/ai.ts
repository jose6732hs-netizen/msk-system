import { db, enc, dec, unb64, globalTraining } from "./common.ts";
import { gh } from "./github.ts";
import { AgentError } from "./errors.ts";
import { PromptBuilder, decodePromptEnvelope, normalizeOperationResponse, type BuiltPrompt } from "./prompt-builder.ts";

async function material() {
  const configured = (Deno.env.get("MSK_TOKEN_ENCRYPTION_KEY") || "").trim();
  if (configured) {
    const candidate = /^[A-Za-z0-9_-]{43,44}$/.test(configured) ? unb64(configured) : enc.encode(configured);
    if (candidate.length === 32) return candidate;
  }
  const serverSecret = (Deno.env.get("MSK_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!serverSecret) throw new AgentError("AI_CONFIGURATION_ERROR", "A chave interna de criptografia da IA não está disponível.", { stage: "auth", httpStatus: 503 });
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`msk-ai-settings:v1:${serverSecret}`)));
}

async function decrypt(v: string) {
  const raw = /^\\x/.test(v) ? dec.decode(Uint8Array.from((v.slice(2).match(/.{2}/g) || []).map((x: string) => parseInt(x, 16)))) : v;
  const p = unb64(raw), iv = p.slice(0, 12), cipher = p.slice(12), k = await crypto.subtle.importKey("raw", await material(), "AES-GCM", false, ["decrypt"]);
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, k, cipher));
}

import {
  buildProviderConfig,
  buildProviderRequest,
  extractProviderText,
  normalizeProviderId,
  type ChatMessage,
  type ProviderConfig,
} from "./providers.ts";

async function decryptKey(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return await decrypt(raw);
  } catch (error) {
    console.warn("MSK AI key decrypt failed", error instanceof Error ? error.name : "invalid");
    return "";
  }
}

/** Linhas reservadas de controle dentro de public.msk_ai_settings. */
const RESERVED_ROWS = new Set(["default", "__primary__"]);

type AiSettingsRow = {
  id?: string | null;
  provider?: string | null;
  model?: string | null;
  api_base_url?: string | null;
  api_key_ciphertext?: string | null;
  active?: boolean | null;
  updated_at?: string | null;
};

const rowId = (row: AiSettingsRow) => String(row?.id || "").trim().toLowerCase();
const usableRow = (row: AiSettingsRow | undefined | null) =>
  !!row && row.active !== false && !!String(row.api_key_ciphertext || "").trim();

async function configFromRow(row: AiSettingsRow): Promise<ProviderConfig | null> {
  const apiKey = await decryptKey(row.api_key_ciphertext);
  if (!apiKey) return null;
  const id = rowId(row);
  return buildProviderConfig({
    provider: RESERVED_ROWS.has(id) ? row.provider : (row.provider || id),
    apiKey,
    model: row.model,
    baseUrl: row.api_base_url,
  });
}

/**
 * Resolve TODAS as IAs utilizáveis de public.msk_ai_settings, em ordem de
 * preferência: a principal do Super Admin primeiro e as demais como reserva.
 * O revezamento só acontece quando a IA anterior falha (fora do ar, sem chave,
 * limite atingido, resposta inválida) — nenhuma chamada extra é feita "para
 * testar", então a busca pela IA que consegue atender não gasta créditos.
 */
async function resolveCandidates(): Promise<ProviderConfig[]> {
  const { data, error } = await db
    .from("msk_ai_settings")
    .select("id,provider,model,api_base_url,api_key_ciphertext,active,updated_at");
  if (error) {
    throw new AgentError("AI_CONFIGURATION_ERROR", "Não foi possível ler a configuração de IA do Super Admin.", { stage: "auth", httpStatus: 503, cause: error });
  }

  const rows: AiSettingsRow[] = Array.isArray(data) ? data : [];
  const byId = new Map(rows.map((row) => [rowId(row), row]));
  const providerRows = rows.filter((row) => !RESERVED_ROWS.has(rowId(row)));

  const ordered: AiSettingsRow[] = [];

  // 1) Ponteiro __primary__ (aponta para o provedor escolhido no Super Admin).
  const pointer = byId.get("__primary__");
  if (pointer) {
    const target = String(pointer.provider || pointer.model || "").trim();
    if (target) {
      const wanted = normalizeProviderId(target);
      const match = providerRows.find((row) => normalizeProviderId(row.provider || row.id) === wanted);
      if (match) ordered.push(match);
    }
    if (usableRow(pointer)) ordered.push(pointer);
  }

  // 2) Provedores marcados como ativos.
  ordered.push(...providerRows.filter((row) => row.active === true));

  // 3) Demais provedores com chave salva (reserva automática).
  ordered.push(...providerRows.filter((row) => row.active !== true));

  // 4) Linha legada "default".
  const legacy = byId.get("default");
  if (legacy) ordered.push(legacy);

  const configs: ProviderConfig[] = [];
  const seen = new Set<string>();
  for (const row of ordered) {
    if (!usableRow(row)) continue;
    const cfg = await configFromRow(row);
    if (!cfg?.apiKey) continue;
    const key = `${cfg.provider}::${cfg.model}::${cfg.endpoint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    configs.push(cfg);
  }

  if (!configs.length) {
    throw new AgentError("AI_CONFIGURATION_ERROR", "Nenhuma IA está ativa no Super Admin do MSK.", { stage: "auth", httpStatus: 503 });
  }
  return configs;
}

type AiPool = { configs: ProviderConfig[]; preferred: number };

/** Uma única resolução do conjunto de IAs por execução/requisição. */
const AI_PER_REQUEST = new WeakMap<Request, Promise<AiPool>>();

function aiPool(r: Request): Promise<AiPool> {
  const cached = AI_PER_REQUEST.get(r);
  if (cached) return cached;
  const pending = resolveCandidates().then((configs) => ({ configs, preferred: 0 }));
  AI_PER_REQUEST.set(r, pending);
  pending.catch(() => AI_PER_REQUEST.delete(r));
  return pending;
}

/** Ordem de tentativa: a última IA que funcionou primeiro, depois as demais. */
function attemptOrder(pool: AiPool): ProviderConfig[] {
  const list = pool.configs;
  const start = Math.min(Math.max(pool.preferred, 0), Math.max(list.length - 1, 0));
  return [...list.slice(start), ...list.slice(0, start)];
}

/** Falha que justifica trocar de IA em vez de devolver erro ao cliente. */
function shouldFailover(error: unknown) {
  if (!(error instanceof AgentError)) return true;
  return error.code.startsWith("AI_");
}

/**
 * Executa a operação na IA preferida e, se ela falhar por qualquer motivo,
 * reveza automaticamente para a próxima IA disponível. O erro só volta para o
 * cliente quando NENHUMA IA conseguiu atender.
 */
async function withFailover<T>(r: Request, run: (cfg: ProviderConfig) => Promise<T>): Promise<T> {
  const pool = await aiPool(r);
  const order = attemptOrder(pool);
  let lastError: unknown = null;
  for (const cfg of order) {
    try {
      const result = await run(cfg);
      pool.preferred = pool.configs.indexOf(cfg);
      return result;
    } catch (error) {
      lastError = error;
      if (!shouldFailover(error)) throw error;
      console.warn("MSK AI failover", cfg.provider, cfg.model, error instanceof AgentError ? error.code : "unknown");
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AgentError("AI_UPSTREAM_UNAVAILABLE", "Nenhuma IA disponível conseguiu atender ao pedido.", { stage: "analyzing", retryable: true, httpStatus: 503 });
}



const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const retryable = (status: number) => [408, 409, 425, 429, 500, 502, 503, 504].includes(status);

async function requestAI(cfg: ProviderConfig, messages: ChatMessage[], maxTokens: number, jsonMode: boolean, timeoutMs = 26000, forceReasoningStyle = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const built = buildProviderRequest(cfg, { messages, maxTokens, jsonMode, forceReasoningStyle });
    return await fetch(built.url, {
      method: "POST",
      headers: built.headers,
      body: JSON.stringify(built.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AgentError("AI_REQUEST_TIMEOUT", `A IA ${cfg.label} demorou além do limite seguro de resposta.`, { stage: "analyzing", retryable: true, httpStatus: 503, cause: error });
    }
    if (error instanceof AgentError) throw error;
    throw new AgentError("AI_NETWORK_UNAVAILABLE", `A conexão com ${cfg.label} ficou indisponível.`, { stage: "analyzing", retryable: true, httpStatus: 503, cause: error });
  } finally {
    clearTimeout(timer);
  }
}


/**
 * Executa a chamada SOMENTE na IA ativa. Retry exponencial apenas para falhas
 * transitórias (429/5xx) do mesmo provedor — nunca troca de IA.
 */
async function resilientAI(cfg: ProviderConfig, messages: ChatMessage[], maxTokens: number, jsonMode: boolean) {
  let mode = jsonMode;
  // Alguns modelos (gpt-5.x e afins) recusam temperature/max_tokens: nesse caso
  // repetimos a MESMA IA com o payload de modelos de raciocínio.
  let reasoningStyle = false;
  let lastStatus = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let x = await requestAI(cfg, messages, maxTokens, mode, 26000, reasoningStyle);
      if (!x.ok && [400, 422].includes(x.status) && !reasoningStyle) {
        const probe = await x.clone().text().catch(() => "");
        if (/temperature|max_tokens|max_completion_tokens|unsupported/i.test(probe)) {
          reasoningStyle = true;
          x = await requestAI(cfg, messages, maxTokens, mode, 26000, true);
        }
      }
      if (mode && [400, 404, 422].includes(x.status)) {
        mode = false;
        x = await requestAI(cfg, messages, maxTokens, false, 26000, reasoningStyle);
      }
      if (x.ok) return x;
      lastStatus = x.status;
      const detail = await x.text().catch(() => "");
      lastError = detail.slice(0, 500);

      if (!retryable(x.status) || attempt === 3) break;
    } catch (error) {
      const mapped = error instanceof AgentError ? error : new AgentError("AI_NETWORK_UNAVAILABLE", `A conexão com ${cfg.label} falhou.`, { stage: "analyzing", retryable: true, httpStatus: 503, cause: error });
      lastError = mapped.code;
      if (!mapped.retryable || attempt === 3) throw mapped;
    }
    await sleep(350 * (2 ** (attempt - 1)));
  }

  const context = { provider: cfg.provider, model: cfg.model, upstreamStatus: lastStatus, detail: lastError };
  if (lastStatus === 429) throw new AgentError("AI_RATE_LIMIT", `${cfg.label} limitou temporariamente as requisições do agente.`, { stage: "analyzing", retryable: true, httpStatus: 503, context });
  if (lastStatus === 401 || lastStatus === 403) throw new AgentError("AI_CONFIGURATION_ERROR", `${cfg.label} recusou a API Key configurada no Super Admin.`, { stage: "auth", retryable: false, httpStatus: 502, context });
  if (retryable(lastStatus)) throw new AgentError("AI_UPSTREAM_UNAVAILABLE", `${cfg.label} ficou temporariamente indisponível.`, { stage: "analyzing", retryable: true, httpStatus: 503, context });
  throw new AgentError("AI_UPSTREAM_REJECTED", `${cfg.label} recusou a solicitação.`, { stage: "analyzing", retryable: false, httpStatus: 502, context });
}

async function runPrompt(cfg: ProviderConfig, messages: ChatMessage[], maxTokens: number, jsonMode: boolean) {
  const x = await resilientAI(cfg, messages, maxTokens, jsonMode);
  let d: any;
  try { d = await x.json(); }
  catch (error) { throw new AgentError("AI_RESPONSE_PARSE_ERROR", `A resposta de ${cfg.label} não era JSON HTTP válido.`, { stage: "analyzing", retryable: true, httpStatus: 422, cause: error }); }
  const extracted = extractProviderText(cfg, d);
  const truncated = /length|max_tokens|max_output_tokens/i.test(extracted.finishReason);
  if (!extracted.text) {
    throw new AgentError(
      "AI_EMPTY_RESPONSE",
      truncated
        ? `${cfg.label} (${cfg.model}) esgotou o limite de tokens antes de escrever a resposta. Reduza o escopo do pedido ou use um modelo com menos raciocínio interno.`
        : `${cfg.label} respondeu sem conteúdo utilizável.`,
      { stage: "analyzing", retryable: true, httpStatus: 422, context: { provider: cfg.provider, model: cfg.model, finishReason: extracted.finishReason } },
    );
  }
  if (truncated) {
    throw new AgentError("AI_RESPONSE_TRUNCATED", `${cfg.label} (${cfg.model}) cortou a resposta no limite de tokens — nenhuma operação completa foi gerada.`, { stage: "analyzing", retryable: true, httpStatus: 422, context: { provider: cfg.provider, model: cfg.model, finishReason: extracted.finishReason, preview: extracted.text.slice(0, 300) } });
  }
  return extracted;
}

async function callBuiltPrompt(r: Request, built: BuiltPrompt, max = 4000) {
  const messages: ChatMessage[] = [{ role: "system", content: built.system }];
  if (built.assistantContext) messages.push({ role: "assistant", content: built.assistantContext });
  messages.push({ role: "user", content: built.user });

  return withFailover(r, async (cfg) => {
    const { id, text: rawText } = await runPrompt(cfg, messages, max, built.jsonMode);
    let text: string;
    try {
      text = normalizeOperationResponse(rawText, built.operation);
    } catch (error) {
      throw new AgentError("AI_RESPONSE_PARSE_ERROR", `${cfg.label} retornou dados fora do schema esperado para esta etapa.`, { stage: built.operation === "edit" || built.operation === "self_healing" ? "editing" : "analyzing", retryable: true, httpStatus: 422, cause: error, context: { operation: built.operation, provider: cfg.provider, model: cfg.model, preview: String(rawText).slice(0, 300) } });
    }
    if (built.operation === "edit" || built.operation === "self_healing") {
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      if (!parsed || !Array.isArray(parsed.changes) || parsed.changes.length === 0) {
        const reply = String(parsed?.reply || parsed?.summary || "").slice(0, 600);
        throw new AgentError(
          "AI_NO_OPERATIONS",
          `${cfg.label} (${cfg.model}) respondeu sem nenhuma operação de arquivo.${reply ? ` Retorno da IA: ${reply}` : ""}`,
          { stage: "editing", retryable: true, httpStatus: 422, context: { operation: built.operation, provider: cfg.provider, model: cfg.model, preview: String(rawText).slice(0, 300) } },
        );
      }
    }
    return { id, text, provider: cfg.provider, model: cfg.model, label: cfg.label };
  });
}




function legacyValidationPrompt(prompt: string): BuiltPrompt | null {
  if (!prompt.includes("VALIDAÇÃO SEMÂNTICA PRÉ-COMMIT")) return null;
  const repo = prompt.match(/(?:Repositório|Repo):\s*([^\n]+)/i)?.[1]?.trim() || "";
  const commandMatch = prompt.match(/Pedido:\s*([\s\S]*?)(?=\n--- ANTES|$)/i);
  const command = commandMatch?.[1]?.trim() || "";
  const marker = prompt.indexOf("--- ANTES");
  const beforeAfter = marker >= 0 ? prompt.slice(marker) : prompt;
  return PromptBuilder.validation(command, repo, beforeAfter);
}

function legacyChatPrompt(prompt: string): BuiltPrompt | null {
  if (!prompt.includes("MODO CONSULTA")) return null;
  const match = prompt.match(/Cliente(?:\/contexto)?:\s*([\s\S]*)$/i);
  return PromptBuilder.chat(match?.[1]?.trim() || prompt);
}

/**
 * Identificação da IA preferida no momento (sem expor a API Key), usada nas
 * respostas e nos checkpoints enviados para a extensão. Se houver revezamento,
 * passa a refletir a IA que efetivamente atendeu.
 */
export async function activeProviderInfo(r: Request) {
  try {
    const pool = await aiPool(r);
    const cfg = pool.configs[Math.min(pool.preferred, pool.configs.length - 1)]!;
    return { provider: cfg.provider, model: cfg.model, label: cfg.label, available: pool.configs.length };
  } catch {
    return { provider: "", model: "", label: "", available: 0 };
  }
}


export async function ask(r: Request, prompt: string, jsonMode = false, max = 4000) {
  const decoded = decodePromptEnvelope(prompt);
  if (decoded) {
    if (decoded.envelope.operation === "interpretation") return callBuiltPrompt(r, PromptBuilder.interpretation(decoded.envelope), Math.min(max, 3000));
    if (decoded.extra) return callBuiltPrompt(r, PromptBuilder.selfHealing(decoded.envelope, decoded.extra), max);
    let plan: string | undefined;
    if (decoded.envelope.complex) plan = (await callBuiltPrompt(r, PromptBuilder.planning(decoded.envelope), 2600)).text;
    return callBuiltPrompt(r, PromptBuilder.edit(decoded.envelope, plan), max);
  }

  const validation = legacyValidationPrompt(prompt);
  if (validation) return callBuiltPrompt(r, validation, Math.min(max, 2800));
  const chat = legacyChatPrompt(prompt);
  if (chat) return callBuiltPrompt(r, chat, max);

  // Compatibilidade apenas para chamadas antigas ainda fora do novo pipeline.
  const training = await globalTraining(r);
  const effectivePrompt = training ? `${training}\n\n${prompt}` : prompt;
  const cfg = await activeAI(r);
  return runPrompt(cfg, [{ role: "user", content: effectivePrompt }], max, jsonMode);
}


const stripFence = (s: string) => s.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
export const parse = (s: string) => {
  const clean = stripFence(String(s || ""));
  const attempts = [clean];
  const firstObj = clean.indexOf("{");
  const lastObj = clean.lastIndexOf("}");
  if (firstObj >= 0 && lastObj > firstObj) attempts.push(clean.slice(firstObj, lastObj + 1));
  const firstArr = clean.indexOf("[");
  const lastArr = clean.lastIndexOf("]");
  if (firstArr >= 0 && lastArr > firstArr) attempts.push(clean.slice(firstArr, lastArr + 1));
  for (const candidate of attempts) {
    try {
      const parsed: any = JSON.parse(candidate);
      if (Array.isArray(parsed)) return { files: parsed };
      if (parsed && typeof parsed === "object") {
        if (!Array.isArray(parsed.files)) {
          const alias = parsed.target_files || parsed.file_paths || parsed.paths || parsed.arquivos || parsed.selected_files || parsed.selectedFiles;
          if (Array.isArray(alias)) parsed.files = alias;
        }
        if (!Array.isArray(parsed.changes)) {
          const alias = parsed.edits || parsed.updates || parsed.alteracoes || parsed.alterações;
          if (Array.isArray(alias)) parsed.changes = alias;
        }
        return parsed;
      }
    } catch {}
  }
  throw new AgentError("AI_RESPONSE_PARSE_ERROR", "A IA retornou uma instrução que não pôde ser interpretada com segurança.", { stage: "editing", retryable: true, httpStatus: 422 });
};

export const b64utf = (s: string) => { const b = enc.encode(s); let x = ""; for (let i = 0; i < b.length; i += 32768) x += String.fromCharCode(...b.subarray(i, i + 32768)); return btoa(x); };

const encodedBranch = (branch: string) => encodeURIComponent(branch).replace(/%2F/g, "/");
const branchProtectionText = (error: unknown) => {
  const mapped = error instanceof AgentError ? error : null;
  return `${mapped?.message || (error instanceof Error ? error.message : String(error || ""))} ${String(mapped?.context?.detail || "")}`;
};
const isBranchProtectionError = (error: unknown) => /protected branch|branch protection|protected branch hook declined|required status check|repository rule|ruleset|changes must be made through a pull request|pull request is required|review is required|GH006|GH013/i.test(branchProtectionText(error));

async function liveDefaultBranch(t: string, o: string, r: string, fallback: string) {
  const repo = await gh(t, `/repos/${o}/${r}`);
  const branch = String(repo?.default_branch || fallback || "").trim();
  if (!branch) throw new AgentError("GITHUB_RESOURCE_NOT_FOUND", "O repositório não informou um branch padrão válido.", { stage: "repository", httpStatus: 404 });
  try {
    await db.from("msk_projects").update({ github_default_branch: branch, updated_at: new Date().toISOString() }).eq("github_owner", o).eq("github_repo", r);
  } catch (error) {
    console.warn("MSK default branch cache update failed", error instanceof Error ? error.message : String(error));
  }
  return branch;
}

async function createBlobs(t: string, o: string, r: string, changes: any[]) {
  const entries: any[] = [];
  for (const change of changes) {
    const blob = await gh(t, `/repos/${o}/${r}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: String(change.content || ""), encoding: "utf-8" }),
    });
    if (!blob?.sha) throw new AgentError("GITHUB_API_ERROR", "O GitHub não confirmou a criação de um blob da edição.", { stage: "committing", httpStatus: 502 });
    entries.push({ path: String(change.path), mode: "100644", type: "blob", sha: String(blob.sha) });
  }
  return entries;
}

async function createCommitFromParent(t: string, o: string, r: string, parentSha: string, entries: any[], msg: string) {
  const parent = await gh(t, `/repos/${o}/${r}/git/commits/${parentSha}`);
  if (!parent?.tree?.sha) throw new AgentError("GITHUB_RESOURCE_NOT_FOUND", "O commit pai não possui uma árvore válida.", { stage: "committing", httpStatus: 404 });
  const tree = await gh(t, `/repos/${o}/${r}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }),
  });
  const commit = await gh(t, `/repos/${o}/${r}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: msg, tree: tree.sha, parents: [parentSha] }),
  });
  if (!commit?.sha) throw new AgentError("GITHUB_API_ERROR", "O GitHub não retornou o SHA do commit criado.", { stage: "committing", httpStatus: 502 });
  return commit;
}

async function verifyBranchHead(t: string, o: string, r: string, branch: string, expected: string) {
  const ref = await gh(t, `/repos/${o}/${r}/git/ref/heads/${encodedBranch(branch)}`);
  const head = String(ref?.object?.sha || "");
  return { ok: !!head && head === expected, head };
}

async function protectedBranchFallback(t: string, o: string, r: string, branch: string, entries: any[], msg: string) {
  const baseRef = await gh(t, `/repos/${o}/${r}/git/ref/heads/${encodedBranch(branch)}`);
  const baseSha = String(baseRef?.object?.sha || "");
  if (!baseSha) throw new AgentError("GITHUB_RESOURCE_NOT_FOUND", "Não foi possível ler o SHA atual do branch protegido.", { stage: "committing", httpStatus: 404 });

  const fallbackBranch = `msk-direct/${crypto.randomUUID().slice(0, 8)}`;
  await gh(t, `/repos/${o}/${r}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${fallbackBranch}`, sha: baseSha }),
  });

  try {
    const commit = await createCommitFromParent(t, o, r, baseSha, entries, msg);
    await gh(t, `/repos/${o}/${r}/git/refs/heads/${encodedBranch(fallbackBranch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    const branchCheck = await verifyBranchHead(t, o, r, fallbackBranch, String(commit.sha));
    if (!branchCheck.ok) throw new AgentError("COMMIT_VERIFICATION_FAILED", "O commit do fallback protegido não ficou no topo do branch temporário.", { stage: "verifying", retryable: true, httpStatus: 409, context: { expected: commit.sha, actual: branchCheck.head } });

    const pr = await gh(t, `/repos/${o}/${r}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: msg,
        head: fallbackBranch,
        base: branch,
        body: "Fallback automático do MSK Agente porque o branch padrão exige Pull Request. O merge será feito imediatamente por squash.",
      }),
    });
    const number = Number(pr?.number || 0);
    if (!number) throw new AgentError("GITHUB_API_ERROR", "O GitHub não retornou o número do Pull Request de fallback.", { stage: "committing", httpStatus: 502 });

    const merged = await gh(t, `/repos/${o}/${r}/pulls/${number}/merge`, {
      method: "PUT",
      body: JSON.stringify({ commit_title: msg, merge_method: "squash" }),
    });
    if (!merged?.merged || !merged?.sha) throw new AgentError("GITHUB_MERGE_REJECTED", String(merged?.message || "O GitHub não permitiu o merge automático do fallback protegido."), { stage: "committing", httpStatus: 409, context: { pull_request_url: pr?.html_url || "" } });

    const mergeSha = String(merged.sha);
    let verifiedHead = "";
    for (let attempt = 1; attempt <= 4; attempt++) {
      const check = await verifyBranchHead(t, o, r, branch, mergeSha);
      verifiedHead = check.head;
      if (check.ok && verifiedHead !== baseSha) {
        return {
          sha: mergeSha,
          html_url: `https://github.com/${o}/${r}/commit/${mergeSha}`,
          branch,
          previous_sha: baseSha,
          head_sha: verifiedHead,
          commit_attempt: attempt,
          preview_pending: true,
          fallback_pr: true,
          pull_request_url: String(pr?.html_url || ""),
        };
      }
      await sleep(250 * attempt);
    }
    throw new AgentError("COMMIT_VERIFICATION_FAILED", "O Pull Request foi mesclado, mas o SHA do branch padrão não confirmou o commit resultante.", { stage: "verifying", retryable: true, httpStatus: 409, context: { expected: mergeSha, actual: verifiedHead, previous: baseSha } });
  } finally {
    try {
      await gh(t, `/repos/${o}/${r}/git/refs/heads/${encodedBranch(fallbackBranch)}`, { method: "DELETE" });
    } catch {}
  }
}

export async function directCommit(t: string, o: string, r: string, b: string, changes: any[], msg: string) {
  if (!Array.isArray(changes) || !changes.length) throw new AgentError("PRECOMMIT_VALIDATION_FAILED", "Nenhuma alteração válida foi fornecida para commit.", { stage: "committing", httpStatus: 422 });

  // O branch usado pelo Lovable é sempre relido diretamente do repositório antes do commit.
  const branch = await liveDefaultBranch(t, o, r, b);
  const entries = await createBlobs(t, o, r, changes);
  let initialHead = "";
  let lastHead = "";
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 4; attempt++) {
    const ref = await gh(t, `/repos/${o}/${r}/git/ref/heads/${encodedBranch(branch)}`);
    const parentSha = String(ref?.object?.sha || "");
    if (!parentSha) throw new AgentError("GITHUB_RESOURCE_NOT_FOUND", "O branch padrão não possui SHA válido.", { stage: "committing", httpStatus: 404 });
    if (!initialHead) initialHead = parentSha;

    const commit = await createCommitFromParent(t, o, r, parentSha, entries, msg);
    try {
      await gh(t, `/repos/${o}/${r}/git/refs/heads/${encodedBranch(branch)}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
    } catch (error) {
      if (isBranchProtectionError(error)) return protectedBranchFallback(t, o, r, branch, entries, msg);
      const mapped = error instanceof AgentError ? error : new AgentError("GITHUB_API_ERROR", "O GitHub recusou a atualização do branch.", { stage: "committing", cause: error });
      if (mapped.code !== "GITHUB_CONFLICT") throw mapped;
      lastError = mapped;
      await sleep(250 * attempt);
      continue;
    }

    const verified = await verifyBranchHead(t, o, r, branch, String(commit.sha));
    lastHead = verified.head;
    if (verified.ok && verified.head !== initialHead) {
      return {
        ...commit,
        branch,
        previous_sha: initialHead,
        head_sha: verified.head,
        commit_attempt: attempt,
        preview_pending: true,
        fallback_pr: false,
      };
    }

    lastError = new AgentError("COMMIT_VERIFICATION_FAILED", "O SHA do branch mudou antes da confirmação final; o MSK tentará novamente sobre o pai atualizado.", { stage: "verifying", retryable: true, httpStatus: 409, context: { expected: String(commit.sha), actual: verified.head, initial: initialHead } });
    await sleep(250 * attempt);
  }

  throw new AgentError("GITHUB_DIRECT_COMMIT_EXHAUSTED", "O branch mudou repetidamente durante o commit. A tarefa não será concluída sem SHA confirmado no branch padrão.", { stage: "verifying", retryable: true, httpStatus: 409, cause: lastError, context: { branch, initial_head: initialHead, last_head: lastHead } });
}
