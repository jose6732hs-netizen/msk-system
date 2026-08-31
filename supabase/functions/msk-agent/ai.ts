import { db, enc, dec, unb64, identity } from "./common.ts";
import { gh } from "./github.ts";

async function material() {
  const configured = (Deno.env.get("MSK_TOKEN_ENCRYPTION_KEY") || "").trim();
  if (configured) {
    const candidate = /^[A-Za-z0-9_-]{43,44}$/.test(configured) ? unb64(configured) : enc.encode(configured);
    if (candidate.length === 32) return candidate;
  }
  const serverSecret = (Deno.env.get("MSK_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!serverSecret) throw new Error("MSK_AI_ENCRYPTION_KEY_UNAVAILABLE");
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
    if (data?.connection_key_ciphertext && !data.revoked_at) try { return await decrypt(String(data.connection_key_ciphertext)); } catch {}
  }
  const { data: g } = await db.from("msk_ai_settings").select("api_key_ciphertext,active").eq("id", "default").maybeSingle();
  if (g?.api_key_ciphertext && g.active !== false) try { return await decrypt(String(g.api_key_ciphertext)); } catch {}
  const f = Deno.env.get("BAI_API_KEY");
  if (!f) throw new Error("MSK_AI_UNAVAILABLE_INTERNAL");
  return f;
}

async function requestAI(r: Request, body: any) {
  return fetch("https://api.b.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${await key(r)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function ask(r: Request, prompt: string, jsonMode = false, max = 4000) {
  const base: any = {
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: prompt }],
    max_tokens: max,
    temperature: 0,
    stream: false,
  };
  let body: any = jsonMode ? { ...base, response_format: { type: "json_object" } } : base;
  let x = await requestAI(r, body);
  if (jsonMode && [400, 404, 422].includes(x.status)) {
    body = base;
    x = await requestAI(r, body);
  }
  if (!x.ok) throw new Error(`MSK_AI_UPSTREAM_${x.status}`);
  const d = await x.json();
  const text = String(d.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("MSK_AI_EMPTY_RESPONSE");
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
          const alias = parsed.file_paths || parsed.paths || parsed.arquivos || parsed.selected_files || parsed.selectedFiles;
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
  throw new Error("MSK_AI_JSON_INVALID");
};

export const b64utf = (s: string) => { const b = enc.encode(s); let x = ""; for (let i = 0; i < b.length; i += 32768) x += String.fromCharCode(...b.subarray(i, i + 32768)); return btoa(x); };
export async function directCommit(t: string, o: string, r: string, b: string, changes: any[], msg: string) {
  const bp = encodeURIComponent(b).replace(/%2F/g, "/"), ref = await gh(t, `/repos/${o}/${r}/git/ref/heads/${bp}`), ps = String(ref?.object?.sha || ""), parent = await gh(t, `/repos/${o}/${r}/git/commits/${ps}`), entries = [];
  for (const c of changes) { const blob = await gh(t, `/repos/${o}/${r}/git/blobs`, { method: "POST", body: JSON.stringify({ content: c.content, encoding: "utf-8" }) }); entries.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha }); }
  const tree = await gh(t, `/repos/${o}/${r}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }) }), commit = await gh(t, `/repos/${o}/${r}/git/commits`, { method: "POST", body: JSON.stringify({ message: msg, tree: tree.sha, parents: [ps] }) });
  await gh(t, `/repos/${o}/${r}/git/refs/heads/${bp}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  return commit;
}
