import { db, enc, dec, unb64, identity, globalTraining } from "./common.ts";
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

async function key(r: Request) {
  const u = await identity(r);
  if (u) {
    const { data } = await db.from("app_user_connections").select("connection_key_ciphertext,revoked_at").eq("user_id", u.id).eq("connector_id", "ai_bai").maybeSingle();
    if (data?.connection_key_ciphertext && !data.revoked_at) {
      try { return await decrypt(String(data.connection_key_ciphertext)); } catch (error) { console.warn("MSK user AI key decrypt failed", error instanceof Error ? error.name : "invalid"); }
    }
  }
  const { data: g } = await db.from("msk_ai_settings").select("api_key_ciphertext,active").eq("id", "default").maybeSingle();
  if (g?.api_key_ciphertext && g.active !== false) {
    try { return await decrypt(String(g.api_key_ciphertext)); } catch (error) { console.warn("MSK global AI key decrypt failed", error instanceof Error ? error.name : "invalid"); }
  }
  const f = Deno.env.get("BAI_API_KEY");
  if (!f) throw new AgentError("AI_CONFIGURATION_ERROR", "A API da inteligência MSK não está configurada.", { stage: "auth", httpStatus: 503 });
  return f;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const retryable = (status: number) => [408, 409, 425, 429, 500, 502, 503, 504].includes(status);

async function requestAI(r: Request, body: any, timeoutMs = 26000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch("https://api.b.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${await key(r)}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AgentError("AI_REQUEST_TIMEOUT", "A IA demorou além do limite seguro de resposta.", { stage: "analyzing", retryable: true, httpStatus: 503, cause: error });
    }
    throw new AgentError("AI_NETWORK_UNAVAILABLE", "A conexão com o provedor de IA ficou indisponível.", { stage: "analyzing", retryable: true, httpStatus: 503, cause: error });
  } finally {
    clearTimeout(timer);
  }
}

async function resilientAI(r: Request, base: any, jsonMode: boolean) {
  let mode = jsonMode;
  let lastStatus = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const body = mode ? { ...base, response_format: { type: "json_object" } } : base;
      let x = await requestAI(r, body);
      if (mode && [400, 404, 422].includes(x.status)) {
        mode = false;
        x = await requestAI(r, base);
      }
      if (x.ok) return x;
      lastStatus = x.status;
      const detail = await x.text().catch(() => "");
      lastError = detail.slice(0, 500);
      if (!retryable(x.status) || attempt === 3) break;
    } catch (error) {
      const mapped = error instanceof AgentError ? error : new AgentError("AI_NETWORK_UNAVAILABLE", "A conexão com a IA falhou.", { stage: "analyzing", retryable: true, httpStatus: 503, cause: error });
      lastError = mapped.code;
      if (!mapped.retryable || attempt === 3) throw mapped;
    }
    await sleep(350 * (2 ** (attempt - 1)));
  }

  if (lastStatus === 429) throw new AgentError("AI_RATE_LIMIT", "A IA limitou temporariamente as requisições do agente.", { stage: "analyzing", retryable: true, httpStatus: 503, context: { upstreamStatus: lastStatus } });
  if (retryable(lastStatus)) throw new AgentError("AI_UPSTREAM_UNAVAILABLE", "O provedor de IA ficou temporariamente indisponível.", { stage: "analyzing", retryable: true, httpStatus: 503, context: { upstreamStatus: lastStatus } });
  throw new AgentError("AI_UPSTREAM_REJECTED", "O provedor de IA recusou a solicitação.", { stage: "analyzing", retryable: false, httpStatus: 502, context: { upstreamStatus: lastStatus, detail: lastError } });
}

async function callBuiltPrompt(r: Request, built: BuiltPrompt, max = 4000) {
  const messages: Array<{ role: "system" | "assistant" | "user"; content: string }> = [
    { role: "system", content: built.system },
  ];
  if (built.assistantContext) messages.push({ role: "assistant", content: built.assistantContext });
  messages.push({ role: "user", content: built.user });

  const base: any = {
    model: "deepseek-v4-flash",
    messages,
    max_tokens: Math.max(256, Math.min(Number(max || 4000), 18000)),
    temperature: 0,
    stream: false,
  };
  const x = await resilientAI(r, base, built.jsonMode);
  let d: any;
  try { d = await x.json(); }
  catch (error) { throw new AgentError("AI_RESPONSE_PARSE_ERROR", "A resposta da IA não era JSON HTTP válido.", { stage: "analyzing", retryable: true, httpStatus: 422, cause: error }); }
  const rawText = String(d.choices?.[0]?.message?.content || "").trim();
  if (!rawText) throw new AgentError("AI_EMPTY_RESPONSE", "A IA respondeu sem conteúdo utilizável.", { stage: "analyzing", retryable: true, httpStatus: 422 });

  try {
    return { id: String(d.id || ""), text: normalizeOperationResponse(rawText, built.operation) };
  } catch (error) {
    throw new AgentError("AI_RESPONSE_PARSE_ERROR", "A IA retornou dados fora do schema esperado para esta etapa.", { stage: built.operation === "edit" || built.operation === "self_healing" ? "editing" : "analyzing", retryable: true, httpStatus: 422, cause: error, context: { operation: built.operation } });
  }
}

function legacyValidationPrompt(prompt: string): BuiltPrompt | null {
  if (!prompt.includes("VALIDAÇÃO SEMÂNTICA PRÉ-COMMIT")) return null;
  const repo = prompt.match(/Repositório:\s*([^\n]+)/i)?.[1]?.trim() || "";
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

export async function ask(r: Request, prompt: string, jsonMode = false, max = 4000) {
  const decoded = decodePromptEnvelope(prompt);
  if (decoded) {
    if (decoded.envelope.operation === "interpretation") {
      return callBuiltPrompt(r, PromptBuilder.interpretation(decoded.envelope), Math.min(max, 3000));
    }

    if (decoded.extra) {
      return callBuiltPrompt(r, PromptBuilder.selfHealing(decoded.envelope, decoded.extra), max);
    }

    let plan: string | undefined;
    if (decoded.envelope.complex) {
      const planned = await callBuiltPrompt(r, PromptBuilder.planning(decoded.envelope), 2600);
      plan = planned.text;
    }
    return callBuiltPrompt(r, PromptBuilder.edit(decoded.envelope, plan), max);
  }

  const validation = legacyValidationPrompt(prompt);
  if (validation) return callBuiltPrompt(r, validation, Math.min(max, 2800));

  const chat = legacyChatPrompt(prompt);
  if (chat) return callBuiltPrompt(r, chat, max);

  // Compatibilidade para chamadas antigas que ainda não usam PromptBuilder.
  // O treinamento global permanece apenas nesse caminho legado e não é injetado nas edições novas.
  const training = await globalTraining(r);
  const effectivePrompt = training ? `${training}\n\n${prompt}` : prompt;
  const base: any = {
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: effectivePrompt }],
    max_tokens: Math.max(256, Math.min(Number(max || 4000), 18000)),
    temperature: 0,
    stream: false,
  };
  const x = await resilientAI(r, base, jsonMode);
  let d: any;
  try { d = await x.json(); }
  catch (error) { throw new AgentError("AI_RESPONSE_PARSE_ERROR", "A resposta da IA não era JSON HTTP válido.", { stage: "analyzing", retryable: true, httpStatus: 422, cause: error }); }
  const text = String(d.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new AgentError("AI_EMPTY_RESPONSE", "A IA respondeu sem conteúdo utilizável.", { stage: "analyzing", retryable: true, httpStatus: 422 });
  return { id: String(d.id || ""), text };
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

export async function directCommit(t: string, o: string, r: string, b: string, changes: any[], msg: string) {
  if (!Array.isArray(changes) || !changes.length) throw new AgentError("PRECOMMIT_VALIDATION_FAILED", "Nenhuma alteração válida foi fornecida para commit.", { stage: "committing", httpStatus: 422 });
  const bp = encodeURIComponent(b).replace(/%2F/g, "/");
  const ref = await gh(t, `/repos/${o}/${r}/git/ref/heads/${bp}`);
  const ps = String(ref?.object?.sha || "");
  if (!ps) throw new AgentError("GITHUB_RESOURCE_NOT_FOUND", "O branch base não possui SHA válido.", { stage: "committing", httpStatus: 404 });
  const parent = await gh(t, `/repos/${o}/${r}/git/commits/${ps}`);
  const entries = [];
  for (const c of changes) {
    const blob = await gh(t, `/repos/${o}/${r}/git/blobs`, { method: "POST", body: JSON.stringify({ content: c.content, encoding: "utf-8" }) });
    entries.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await gh(t, `/repos/${o}/${r}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }) });
  const commit = await gh(t, `/repos/${o}/${r}/git/commits`, { method: "POST", body: JSON.stringify({ message: msg, tree: tree.sha, parents: [ps] }) });
  await gh(t, `/repos/${o}/${r}/git/refs/heads/${bp}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  return commit;
}
