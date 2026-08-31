import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enc = new TextEncoder();
const dec = new TextDecoder();
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(supabaseUrl, serviceRole);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const base64UrlToBytes = (value: string) => Uint8Array.from(
  atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")),
  c => c.charCodeAt(0),
);

async function encryptionMaterial() {
  const configured = (Deno.env.get("MSK_TOKEN_ENCRYPTION_KEY") || "").trim();
  if (configured) {
    const candidate = /^[A-Za-z0-9_-]{43,44}$/.test(configured) ? base64UrlToBytes(configured) : enc.encode(configured);
    if (candidate.length === 32) return candidate;
  }
  const serverSecret = (Deno.env.get("MSK_STATE_SECRET") || serviceRole || "").trim();
  if (!serverSecret) throw new Error("MSK_AI_ENCRYPTION_KEY_UNAVAILABLE");
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`msk-ai-settings:v1:${serverSecret}`)));
}

async function decryptSetting(value: string) {
  const raw = /^\\x/.test(value)
    ? dec.decode(Uint8Array.from((value.slice(2).match(/.{2}/g) || []).map(x => parseInt(x, 16))))
    : value;
  const packed = base64UrlToBytes(raw);
  const iv = packed.slice(0, 12);
  const cipher = packed.slice(12);
  const key = await crypto.subtle.importKey("raw", await encryptionMaterial(), "AES-GCM", false, ["decrypt"]);
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher));
}

async function baiKey() {
  const { data } = await db.from("msk_ai_settings")
    .select("api_key_ciphertext,active")
    .eq("id", "default")
    .maybeSingle();
  if (data?.api_key_ciphertext && data.active !== false) {
    try { return await decryptSetting(String(data.api_key_ciphertext)); } catch {}
  }
  const fallback = Deno.env.get("BAI_API_KEY") || "";
  if (!fallback) throw new Error("MSK_AI_UNAVAILABLE_INTERNAL");
  return fallback;
}

type Attachment = {
  id?: string;
  name?: string;
  mime?: string;
  kind?: string;
  size?: number;
  text?: string;
  data_url?: string;
};

const cleanName = (value: unknown) => String(value || "anexo").replace(/[\\/\\\\\u0000-\u001f]/g, "_").slice(0, 180);
const cleanMime = (value: unknown) => String(value || "application/octet-stream").toLowerCase().slice(0, 120);
const safeDataUrl = (value: unknown) => {
  const text = String(value || "");
  return /^data:[a-z0-9.+/-]+;base64,[a-z0-9+/=\r\n]+$/i.test(text) ? text : "";
};
const base64Only = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1).replace(/\s+/g, "");
const audioFormat = (mime: string, name: string) => {
  if (/wav/.test(mime) || /\.wav$/i.test(name)) return "wav";
  if (/mpeg|mp3/.test(mime) || /\.mp3$/i.test(name)) return "mp3";
  if (/mp4|m4a/.test(mime) || /\.m4a$/i.test(name)) return "m4a";
  if (/ogg/.test(mime) || /\.ogg$/i.test(name)) return "ogg";
  if (/webm/.test(mime) || /\.webm$/i.test(name)) return "webm";
  return "wav";
};

function normalizeAttachments(raw: unknown) {
  if (!Array.isArray(raw)) return [] as Attachment[];
  let totalDataChars = 0;
  let totalTextChars = 0;
  const result: Attachment[] = [];
  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const name = cleanName((item as any).name);
    const mime = cleanMime((item as any).mime);
    const text = typeof (item as any).text === "string" ? String((item as any).text).slice(0, 220_000) : "";
    const dataUrl = safeDataUrl((item as any).data_url);
    if (!text && !dataUrl) continue;
    totalTextChars += text.length;
    totalDataChars += dataUrl.length;
    if (totalTextChars > 500_000 || totalDataChars > 15_000_000) throw new Error("MSK_ATTACHMENT_PAYLOAD_TOO_LARGE");
    result.push({
      id: String((item as any).id || crypto.randomUUID()).slice(0, 100),
      name,
      mime,
      kind: String((item as any).kind || "file").slice(0, 30),
      size: Math.max(0, Number((item as any).size || 0)) || 0,
      ...(text ? { text } : {}),
      ...(dataUrl ? { data_url: dataUrl } : {}),
    });
  }
  return result;
}

function localTextContext(attachments: Attachment[]) {
  const blocks = attachments
    .filter(x => x.text)
    .map(x => `--- ${x.name} (${x.mime})\n${String(x.text).slice(0, 180_000)}`);
  return blocks.join("\n\n").slice(0, 450_000);
}

function multimodalPrompt(command: string, textContext: string, attachments: Attachment[]) {
  const list = attachments.map((a, i) => `${i + 1}. ${a.name} · ${a.mime} · ${a.size || 0} bytes`).join("\n");
  return [
    "Você é a camada multimodal do MSK Desenvolvedor.",
    "Analise os anexos APENAS para gerar contexto factual que outro agente de programação usará.",
    "Para screenshot/imagem: leia textos visíveis, mensagens de erro, estados da interface e elementos relevantes. Não invente conteúdo que não esteja visível.",
    "Para áudio: transcreva fielmente em português quando possível e destaque o pedido técnico do cliente. Não invente falas inaudíveis.",
    "Para PDF/documento: extraia apenas fatos, requisitos, mensagens, código, tabelas ou instruções úteis ao desenvolvimento.",
    "Para arquivos de texto/código: preserve nomes de arquivos, símbolos, erros e trechos essenciais; não reescreva o arquivo inteiro na resposta.",
    "Nunca diga que código foi alterado. Esta etapa somente observa e interpreta anexos.",
    "Responda SOMENTE JSON válido: {\"summary\":\"resumo factual\",\"items\":[{\"name\":\"arquivo\",\"observations\":[\"fato\"],\"transcript\":\"quando houver áudio\"}],\"actionable_context\":\"contexto objetivo para o desenvolvedor\"}.",
    `PEDIDO DO CLIENTE: ${command || "Analise os anexos no contexto de desenvolvimento do projeto."}`,
    `ANEXOS:\n${list}`,
    textContext ? `CONTEÚDO TEXTUAL JÁ EXTRAÍDO LOCALMENTE:\n${textContext}` : "",
  ].filter(Boolean).join("\n\n");
}

function chatParts(prompt: string, attachments: Attachment[]) {
  const parts: any[] = [{ type: "text", text: prompt }];
  for (const item of attachments) {
    if (!item.data_url) continue;
    const mime = item.mime || "";
    if (mime.startsWith("image/")) {
      parts.push({ type: "image_url", image_url: { url: item.data_url, detail: "high" } });
    } else if (mime.startsWith("audio/")) {
      parts.push({
        type: "input_audio",
        input_audio: { data: base64Only(item.data_url), format: audioFormat(mime, item.name || "") },
      });
    } else {
      parts.push({ type: "file", file: { filename: item.name || "arquivo", file_data: item.data_url } });
    }
  }
  return parts;
}

function responseParts(prompt: string, attachments: Attachment[]) {
  const parts: any[] = [{ type: "input_text", text: prompt }];
  for (const item of attachments) {
    if (!item.data_url) continue;
    if ((item.mime || "").startsWith("image/")) {
      parts.push({ type: "input_image", image_url: item.data_url, detail: "high" });
    } else {
      parts.push({ type: "input_file", filename: item.name || "arquivo", file_data: item.data_url });
    }
  }
  return parts;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 65_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function stripFence(value: string) {
  return String(value || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}
function parseJson(value: string) {
  const clean = stripFence(value);
  const attempts = [clean];
  const a = clean.indexOf("{");
  const b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) attempts.push(clean.slice(a, b + 1));
  for (const candidate of attempts) {
    try { return JSON.parse(candidate); } catch {}
  }
  return null;
}

async function analyzeWithModel(key: string, model: string, prompt: string, attachments: Attachment[]) {
  const endpoint = "https://api.b.ai/v1/chat/completions";
  const body = {
    model,
    messages: [{ role: "user", content: chatParts(prompt, attachments) }],
    temperature: 0,
    max_tokens: 7000,
    response_format: { type: "json_object" },
    stream: false,
  };
  let response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) {
    const data = await response.json();
    const text = String(data?.choices?.[0]?.message?.content || "");
    const parsed = parseJson(text);
    if (parsed) return parsed;
  }

  if ([400, 404, 415, 422].includes(response.status)) {
    const responsesBody = {
      model,
      input: [{ role: "user", content: responseParts(prompt, attachments) }],
      max_output_tokens: 7000,
      temperature: 0,
    };
    response = await fetchWithTimeout("https://api.b.ai/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(responsesBody),
    });
    if (response.ok) {
      const data = await response.json();
      const text = (Array.isArray(data?.output) ? data.output : [])
        .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
        .map((part: any) => String(part?.text || part?.output_text || ""))
        .filter(Boolean)
        .join("\n");
      const parsed = parseJson(text);
      if (parsed) return parsed;
    }
  }
  const detail = await response.text().catch(() => "");
  throw new Error(`MSK_MULTIMODAL_UPSTREAM_${response.status}:${detail.slice(0, 300)}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "POST" && new URL(req.url).searchParams.get("action") === "health") {
    return json({ ok: true, service: "msk-attachment-analyze", version: "1.0.0" });
  }
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);

  const token = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!serviceRole || token !== serviceRole) return json({ ok: false, code: "INTERNAL_AUTH_REQUIRED" }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    const command = String(body?.command || "").trim().slice(0, 20_000);
    const attachments = normalizeAttachments(body?.attachments);
    if (!attachments.length) return json({ ok: true, context: "", items: [], attachment_count: 0 });

    const textContext = localTextContext(attachments);
    const binary = attachments.filter(x => x.data_url);
    if (!binary.length) {
      const context = [
        "ANEXOS LIDOS LOCALMENTE PELO MSK:",
        textContext,
      ].filter(Boolean).join("\n\n");
      return json({ ok: true, context, items: attachments.map(x => ({ name: x.name, mime: x.mime })), attachment_count: attachments.length, multimodal: false });
    }

    const key = await baiKey();
    const prompt = multimodalPrompt(command, textContext, attachments);
    let analysis: any = null;
    let lastError = "";
    for (const model of ["gemini-3.5-flash-lite", "gemini-3-flash"]) {
      try {
        analysis = await analyzeWithModel(key, model, prompt, attachments);
        if (analysis) break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e || "");
        await sleep(250);
      }
    }
    if (!analysis) throw new Error(lastError || "MSK_MULTIMODAL_ANALYSIS_FAILED");

    const summary = String(analysis?.summary || "").trim().slice(0, 12_000);
    const actionable = String(analysis?.actionable_context || "").trim().slice(0, 30_000);
    const itemText = Array.isArray(analysis?.items)
      ? analysis.items.slice(0, 8).map((item: any) => {
          const observations = Array.isArray(item?.observations) ? item.observations.slice(0, 20).map((x: any) => String(x).slice(0, 1500)).join("; ") : "";
          const transcript = String(item?.transcript || "").trim().slice(0, 25_000);
          return [`Arquivo: ${cleanName(item?.name)}`, observations ? `Observações: ${observations}` : "", transcript ? `Transcrição: ${transcript}` : ""].filter(Boolean).join("\n");
        }).join("\n\n")
      : "";
    const context = [
      "CONTEXTO DOS ANEXOS ANALISADOS PELO MSK:",
      summary ? `Resumo: ${summary}` : "",
      itemText,
      actionable ? `Contexto técnico acionável: ${actionable}` : "",
      textContext ? `Conteúdo textual extraído:\n${textContext}` : "",
    ].filter(Boolean).join("\n\n").slice(0, 480_000);

    return json({
      ok: true,
      context,
      summary,
      items: Array.isArray(analysis?.items) ? analysis.items.slice(0, 8) : [],
      attachment_count: attachments.length,
      multimodal: true,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e || "");
    console.error("MSK attachment internal", raw);
    const large = /PAYLOAD_TOO_LARGE/i.test(raw);
    return json({
      ok: false,
      code: large ? "MSK_ATTACHMENT_TOO_LARGE" : "MSK_ATTACHMENT_ANALYSIS_FAILED",
      error: large
        ? "Os anexos ultrapassaram o limite seguro de leitura. Envie menos arquivos ou reduza o tamanho."
        : "O MSK não conseguiu ler um dos anexos agora. Tente novamente ou envie o arquivo em outro formato.",
    }, large ? 413 : 502);
  }
});