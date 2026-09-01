const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license, x-msk-installation-id, x-msk-extension-version, x-msk-extension-id, x-msk-build-id, x-msk-integrity-root, x-msk-build-fingerprint, x-msk-device-session, x-msk-proof-version, x-msk-timestamp, x-msk-counter, x-msk-body-sha256, x-msk-signature, x-msk-target, x-msk-action",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha = async (value: string) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
const proofHeaders = ["x-msk-installation-id", "x-msk-extension-version", "x-msk-extension-id", "x-msk-build-id", "x-msk-integrity-root", "x-msk-build-fingerprint", "x-msk-device-session", "x-msk-proof-version", "x-msk-timestamp", "x-msk-counter", "x-msk-body-sha256", "x-msk-signature", "x-msk-target", "x-msk-action"];

async function verifyOriginalDevice(req: Request, rawBody: string) {
  const buildId = String(req.headers.get("x-msk-build-id") || "").trim();
  if (!buildId) return { ok: true, legacy: true };
  const auth = req.headers.get("authorization") || req.headers.get("x-msk-license") || "";
  if (!auth || proofHeaders.some(name => !req.headers.get(name))) return { ok: false, status: 401, code: "DEVICE_IDENTITY_REQUIRED" };
  const bodyHash = await sha(rawBody);
  if (bodyHash !== req.headers.get("x-msk-body-sha256")) return { ok: false, status: 401, code: "SECURITY_BODY_MISMATCH" };
  const headers: Record<string, string> = { Authorization: auth, "Content-Type": "application/json" };
  for (const name of proofHeaders) headers[name] = String(req.headers.get(name) || "");
  try {
    const response = await fetch("https://msksystem.online/api/extension/device-authorize", { method: "POST", headers, body: JSON.stringify({ body_sha256: bodyHash }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.device_authorized) return { ok: true };
    if (data?.blocked || data?.code === "INSTALLATION_BLOCKED") return { ok: false, status: 403, code: "INSTALLATION_BLOCKED" };
    return { ok: false, status: response.status || 403, code: String(data?.code || "MSK_SECURITY_REJECTED") };
  } catch {
    return { ok: false, status: 503, code: "MSK_SECURITY_UNAVAILABLE" };
  }
}

const attachmentArray = (value: unknown) => Array.isArray(value) ? value.slice(0, 8) : [];
const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const hasEditIntent = (value: unknown) => {
  const text = normalize(value);
  return /\b(mud|troc|alter|corrig|adicion|remov|cri|fac|implement|edit|ajust|coloc|tir|exclu|delet|renome|configur|integr|conect|desenvolv|mont|atualiz|apliqu|substitu|arrum|consert|ger|refator|otimiz|migr|prote|bloque|liber|salv|cadastr|instal|import|usar)\w*/.test(text)
    || /\b(quero|preciso)\b.{0,80}\b(checkout|carrinho|pix|pagamento|api|webhook|site|pagina|sistema|dashboard|banco|login|componente|efeito|fundo|animacao)\b/.test(text);
};
const looksLikeDocumentation = (value: string) => /(?:documenta[cç][aã]o|endpoint|headers?|payload|response|request|webhook|bearer|oauth|api key|\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/)/i.test(value);

async function analyzeAttachments(supabaseUrl: string, command: string, attachments: any[]) {
  if (!attachments.length) return { ok: true, context: "", attachment_count: 0 } as any;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!serviceRole) return { ok: false, status: 503, code: "MSK_ATTACHMENT_SERVICE_UNAVAILABLE", error: "O leitor seguro de documentação está indisponível." };
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/msk-attachment-analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json" },
      body: JSON.stringify({ command, attachments }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) return { ok: false, status: response.status, code: String(data?.code || "MSK_ATTACHMENT_ANALYSIS_FAILED"), error: String(data?.error || "Não foi possível analisar a documentação.") };
    return data;
  } catch {
    return { ok: false, status: 503, code: "MSK_ATTACHMENT_ANALYSIS_FAILED", error: "Não foi possível analisar a documentação agora." };
  }
}

function internalHeaders(req: Request) {
  const out: Record<string, string> = { "Content-Type": "application/json" };
  for (const name of ["authorization", "apikey", "x-msk-session", "x-msk-license"]) {
    const value = req.headers.get(name);
    if (value) out[name] = value;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "status";
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!supabaseUrl) return json({ ok: false, code: "MSK_UNAVAILABLE", error: "O MSK está temporariamente indisponível." }, 503);

  try {
    const rawBody = await req.text();
    const device = await verifyOriginalDevice(req, rawBody);
    if (!device.ok) return json({ ok: false, code: device.code, stage: "transport", error: device.code === "INSTALLATION_BLOCKED" ? "Esta instalação foi bloqueada pela segurança MSK." : "A autorização segura desta instalação foi recusada." }, device.status || 403);

    let parsed: any = {};
    try { parsed = rawBody ? JSON.parse(rawBody) : {}; } catch { return json({ ok: false, code: "INVALID_JSON", error: "O corpo da solicitação é inválido." }, 400); }

    let upstreamAction = action;
    if (action === "run" || action === "chat") {
      const originalCommand = String(parsed?.client_original_command || parsed?.original_command || parsed?.message || parsed?.command || "").trim();
      const attachments = attachmentArray(parsed?.attachments);
      const longDocumentation = action === "run" && originalCommand.length > 9000 && looksLikeDocumentation(originalCommand);
      const analysisAttachments = [...attachments];
      if (longDocumentation) {
        analysisAttachments.push({ id: "inline_documentation", name: "documentacao-colada.md", mime: "text/markdown", kind: "text", size: originalCommand.length, text: originalCommand });
      }

      let context = "";
      let attachmentCount = 0;
      if (analysisAttachments.length) {
        const analyzed = await analyzeAttachments(supabaseUrl, originalCommand.slice(0, 4000), analysisAttachments);
        if (!analyzed?.ok) return json({ ok: false, code: analyzed.code || "MSK_ATTACHMENT_ANALYSIS_FAILED", stage: "analyzing", retryable: true, error: analyzed.error || "Não foi possível analisar a documentação." }, Number(analyzed.status || 422));
        context = String(analyzed?.context || "").trim();
        attachmentCount = Number(analyzed?.attachment_count || analysisAttachments.length);
      }

      const baseOriginal = longDocumentation ? originalCommand.slice(0, 4300) : originalCommand;
      const maxContext = Math.max(0, 11600 - baseOriginal.length - 2);
      const compactContext = context.slice(0, maxContext);
      const executionCommand = compactContext ? `${baseOriginal}\n\n${compactContext}`.trim() : baseOriginal;

      parsed.client_original_command = originalCommand;
      parsed.command = executionCommand;
      parsed.original_command = executionCommand;
      parsed.documentation_compacted = longDocumentation;
      parsed.attachment_context_used = !!context;
      parsed.attachment_count = attachmentCount;
      delete parsed.attachments;
      delete parsed.history;
      delete parsed.active_skill;
      delete parsed.reinforced_command;

      if (action === "run" && !hasEditIntent(originalCommand)) {
        upstreamAction = "chat";
        parsed.message = executionCommand || originalCommand;
      }
    }

    const upstream = await fetch(`${supabaseUrl}/functions/v1/msk-agent?action=${encodeURIComponent(upstreamAction)}`, {
      method: "POST",
      headers: internalHeaders(req),
      body: JSON.stringify(parsed),
    });
    const text = await upstream.text();
    if (upstream.status === 546) return json({ ok: false, code: "MSK_EXECUTION_TIMEOUT", stage: "transport", retryable: true, task_id: parsed?.task_id, error: "A execução excedeu a janela de resposta. A tarefa pode continuar e deve ser reconciliada pelo task_id." }, 504);
    return new Response(text, { status: upstream.status, headers: { ...cors, "Content-Type": upstream.headers.get("content-type") || "application/json" } });
  } catch (error) {
    console.error("MSK public transport gateway", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, code: "MSK_TEMPORARILY_UNAVAILABLE", stage: "transport", retryable: true, error: "A comunicação com o agente ficou temporariamente indisponível. A MSK deve confirmar a tarefa pelo task_id antes de exibir falha." }, 503);
  }
});