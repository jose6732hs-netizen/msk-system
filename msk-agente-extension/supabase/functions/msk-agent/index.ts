import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-session, x-msk-license",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ausente: ${name}`);
  return value;
};
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), c => c.charCodeAt(0));
const sha256 = async (value: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
const licenseIdentityFromToken = async (token: string) => {
  const origins = [
    "https://msksystem.online",
    "https://msk-system.lovable.app",
    "https://id-preview--2763a21e-c47d-4e62-bc58-ab51fe5dc2d5.lovable.app",
  ];
  for (const origin of origins) {
    try {
      const response = await fetch(`${origin}/api/extension/license-identity`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!response.ok) continue;
      const identity = await response.json().catch(() => null);
      const userId = String(identity?.user_id || "").trim();
      if (identity?.ok === true && identity?.active === true && /^[0-9a-f-]{36}$/i.test(userId)) {
        return { id: userId, license_id: String(identity?.license_id || "") };
      }
    } catch {}
  }
  return null;
};
const userFromRequest = async (req: Request) => {
  const token = (req.headers.get("authorization") || req.headers.get("x-msk-license") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.startsWith("sb_publishable_")) return null;
  const { data, error } = await db.auth.getUser(token);
  if (!error && data.user) return data.user;
  return await licenseIdentityFromToken(token);
};
const encryptionKey = async () => {
  const rawValue = env("MSK_TOKEN_ENCRYPTION_KEY").trim();
  const raw = /^[A-Za-z0-9_-]{43,44}$/.test(rawValue) ? fromB64url(rawValue) : encoder.encode(rawValue);
  if (raw.length !== 32) throw new Error("MSK_TOKEN_ENCRYPTION_KEY deve possuir exatamente 32 bytes.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
};
const byteaText = (value: unknown) => {
  if (value instanceof Uint8Array) return decoder.decode(value);
  const text = String(value || "");
  if (text.startsWith("\\x")) {
    const pairs = text.slice(2).match(/.{1,2}/g) || [];
    return decoder.decode(Uint8Array.from(pairs.map(pair => Number.parseInt(pair, 16))));
  }
  return text;
};
const decrypt = async (value: string) => {
  const packed = fromB64url(value); const iv = packed.slice(0, 12); const cipher = packed.slice(12);
  return decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await encryptionKey(), cipher));
};
const aiApiKeyForRequest = async (req: Request) => {
  const user = await userFromRequest(req);
  if (user) {
    const { data } = await db.from("app_user_connections").select("connection_key_ciphertext,revoked_at").eq("user_id", user.id).eq("connector_id", "ai_bai").maybeSingle();
    if (data?.connection_key_ciphertext && !data.revoked_at) {
      try { return { key: await decrypt(byteaText(data.connection_key_ciphertext)), source: "user" as const }; } catch (error) { console.warn("MSK: não foi possível abrir a chave de IA do usuário; usando fallback.", error); }
    }
  }
  const { data: globalSettings } = await db
    .from("msk_ai_settings")
    .select("api_key_ciphertext,active")
    .eq("id", "default")
    .maybeSingle();
  if (globalSettings?.api_key_ciphertext && globalSettings?.active !== false) {
    try {
      return { key: await decrypt(byteaText(globalSettings.api_key_ciphertext)), source: "system-db" as const };
    } catch (error) {
      console.warn("MSK: não foi possível abrir a API global cadastrada no SaaS; usando fallback de ambiente.", error);
    }
  }
  const fallback = String(Deno.env.get("BAI_API_KEY") || "").trim();
  if (!fallback) throw new Error("Nenhuma API da IA foi configurada no MSK. Cadastre a chave no painel do SaaS.");
  return { key: fallback, source: "system-env" as const };
};
const utf8Base64 = (value: string) => {
  const bytes = encoder.encode(value); let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const hmac = async (value: string) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(env("MSK_STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
};
const makeState = async (projectId: string, returnUrl: string, repository = "", userId = "") => {
  const payload = b64url(encoder.encode(JSON.stringify({ projectId, returnUrl, repository, userId, exp: Date.now() + 15 * 60_000 })));
  return `${payload}.${await hmac(payload)}`;
};
const readState = async (state: string) => {
  const [payload, signature] = state.split(".");
  if (!payload || signature !== await hmac(payload)) throw new Error("Estado inválido.");
  const raw = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
  if (data.exp < Date.now() || !/^https:\/\/lovable\.dev\/projects\//.test(data.returnUrl)) throw new Error("Estado expirado.");
  return data as { projectId: string; returnUrl: string; repository?: string; userId?: string };
};
const derLength = (length: number) => {
  if (length < 128) return new Uint8Array([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>>= 8) bytes.unshift(value & 255);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
};
const derJoin = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
};
const derWrap = (tag: number, value: Uint8Array) => derJoin(new Uint8Array([tag]), derLength(value.length), value);
const pkcs1ToPkcs8 = (pkcs1: Uint8Array) => {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const rsaAlgorithm = new Uint8Array([0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00]);
  return derWrap(0x30, derJoin(version, rsaAlgorithm, derWrap(0x04, pkcs1)));
};
const decodeBase64Bytes = (value: string) => Uint8Array.from(atob(value.replace(/\s/g, "")), c => c.charCodeAt(0));
const normalizeGithubPrivateKeySecret = () => {
  let value = env("GITHUB_APP_PRIVATE_KEY").trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    if (value.startsWith('"')) { try { value = JSON.parse(value); } catch { value = value.slice(1, -1); } }
    else value = value.slice(1, -1);
  }
  value = value.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) {
    try { const decoded = decoder.decode(decodeBase64Bytes(value)).trim(); if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(decoded)) value = decoded; } catch {}
  }
  return value;
};
const importGithubPrivateKey = async (der: Uint8Array, forcePkcs1 = false) => {
  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
  const tryImport = async (bytes: Uint8Array) => crypto.subtle.importKey("pkcs8", bytes, algorithm, false, ["sign"]);
  if (!forcePkcs1) { try { return await tryImport(der); } catch {} }
  return await tryImport(pkcs1ToPkcs8(der));
};
const pemKey = async () => {
  try {
    const secret = normalizeGithubPrivateKeySecret();
    const pemMatch = secret.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
    if (pemMatch) {
      const label = String(pemMatch[1] || ""); const raw = decodeBase64Bytes(String(pemMatch[2] || ""));
      if (!raw.length) throw new Error("empty-key"); return await importGithubPrivateKey(raw, label === "RSA PRIVATE KEY");
    }
    const raw = decodeBase64Bytes(secret); if (!raw.length) throw new Error("empty-key"); return await importGithubPrivateKey(raw, false);
  } catch (error) {
    console.error("MSK GitHub App: falha ao importar a chave privada (conteúdo ocultado).", error instanceof Error ? error.name : "PRIVATE_KEY_IMPORT_FAILED");
    throw new Error("A chave privada da GitHub App não pôde ser validada no servidor. Gere uma nova chave na GitHub App e salve o PEM completo em GITHUB_APP_PRIVATE_KEY.");
  }
};
const githubAppJwt = async () => {
  const now = Math.floor(Date.now()/1000); const header = b64url(encoder.encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const payload = b64url(encoder.encode(JSON.stringify({iat:now-30,exp:now+540,iss:env("GITHUB_APP_ID")}))); const unsigned=`${header}.${payload}`;
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",await pemKey(),encoder.encode(unsigned)); return `${unsigned}.${b64url(new Uint8Array(signature))}`;
};
const getActiveInstallation = async (installationId:number) => { const response=await fetch(`https://api.github.com/app/installations/${installationId}`,{headers:{Authorization:`Bearer ${await githubAppJwt()}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}}); if(response.status===404)return null; if(!response.ok)throw new Error(`Não foi possível validar a instalação GitHub (${response.status}).`); const installation=await response.json(); return installation?.suspended_at?null:installation; };
const findInstallationForRepository = async (fullName:string) => { if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName))return null; const response=await fetch(`https://api.github.com/repos/${fullName}/installation`,{headers:{Authorization:`Bearer ${await githubAppJwt()}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}}); if(response.status===404)return null; if(!response.ok)throw new Error(`Não foi possível localizar a instalação do repositório (${response.status}).`); const installation=await response.json(); return installation?.suspended_at?null:installation; };
const installationToken = async (installationId:number) => { const response=await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`,{method:"POST",headers:{Authorization:`Bearer ${await githubAppJwt()}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}}); if(!response.ok)throw new Error("Falha ao gerar token temporário do GitHub App."); return (await response.json()).token as string; };
const github = async (token:string,path:string,init:RequestInit={}) => { const response=await fetch(`https://api.github.com${path}`,{...init,headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28",...(init.headers||{})}}); if(!response.ok)throw new Error(`GitHub ${response.status}: ${await response.text()}`); return response.status===204?null:response.json(); };
const validSession = async (projectId:string,token:string) => { if(!token)return false; const {data}=await db.from("msk_projects").select("session_token_hash").eq("lovable_project_id",projectId).maybeSingle(); return !!data?.session_token_hash&&data.session_token_hash===await sha256(token); };
const chooseRepository = async (installationId:number,projectName="",preferredFullName="") => { const token=await installationToken(installationId); const data=await github(token,"/installation/repositories?per_page=100"); const repos=data.repositories||[]; const preferred=preferredFullName.toLowerCase().replace(/^https:\/\/github\.com\//,"").replace(/\.git$/,"").replace(/^\/+|\/+$/g,""); const wanted=projectName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); const exact=preferred?repos.find((r:any)=>String(r.full_name||"").toLowerCase()===preferred):null; const repo=exact||(repos.length===1?repos[0]:repos.find((r:any)=>r.name.toLowerCase()===wanted||(wanted&&r.name.toLowerCase().includes(wanted)))); return {token,repo,candidates:repos.map((r:any)=>r.full_name)}; };
const normalizeSkill=(value:any)=>{if(!value||typeof value!=="object")return null;const name=String(value.name||"").trim().slice(0,60);const prompt=String(value.prompt||"").trim().slice(0,1800);return name&&prompt?{name,prompt,custom:!!value.custom}:null;};
const focusRulesFor=(command:string)=>{const text=String(command||"").toLowerCase();if(/(seguran|auth|autentic|token|sess[aã]o|permiss|rls|api key|secret|credencial|xss|csrf|vulner)/i.test(text))return"Segurança: confirme riscos reais, use privilégio mínimo, valide no servidor e nunca exponha credenciais no frontend/extensão. Preserve autenticação/RLS existentes.";if(/(cor|fundo|bot[aã]o|layout|visual|css|tema|fonte|espa[cç]|design|responsiv|mobile|tablet)/i.test(text))return"Visual/UI: altere somente o componente/estilo relacionado, preserve toda a lógica e mantenha responsividade sem redesenhar áreas não pedidas.";if(/(erro|bug|corrig|quebr|falha|n[aã]o funciona|loop|trav|consert)/i.test(text))return"Correção: localize a causa raiz, aplique o menor patch seguro e valide o fluxo relacionado sem refatorações paralelas.";if(/(crie|criar|adicione|adicionar|implemente|implementar|fun[cç][aã]o|recurso|feature)/i.test(text))return"Funcionalidade: siga o padrão atual, reutilize componentes/contratos existentes e preserve recursos prontos fora do escopo.";return"Execução: vá direto aos arquivos relacionados, faça a menor alteração suficiente e preserve tudo que já funciona.";};
const buildExecutionCommand=(clientCommand:string,skill:ReturnType<typeof normalizeSkill>)=>{const skillBlock=skill?`SKILL ATIVA: ${skill.name}\nInstrução auxiliar: ${skill.prompt}\nA Skill é contexto auxiliar. Se houver qualquer conflito, o pedido do cliente tem prioridade absoluta.`:"SKILL ATIVA: nenhuma.";return["MSK — COMANDO PROFISSIONAL · FAST_EDIT","","PEDIDO DO CLIENTE — PRIORIDADE MÁXIMA:",clientCommand,"",skillBlock,"","REGRAS OBRIGATÓRIAS:","- Não invente requisitos nem amplie o escopo solicitado.","- Vá direto aos arquivos estritamente necessários; não faça varredura geral sem necessidade.","- Preserve tudo que já funciona e não altere banco, licenças, rotas, integrações ou áreas não citadas.","- Se faltar informação essencial e for arriscado adivinhar, peça esclarecimento antes de editar.",`- ${focusRulesFor(clientCommand)}`,"- Valide a alteração antes de concluir e evite efeitos colaterais óbvios.","","OBJETIVO FINAL:","Executar exatamente o pedido do cliente com acabamento profissional e alteração mínima segura."].join("\n");};
const deepseek=async(prompt:string,options:{jsonMode?:boolean;maxTokens?:number}={},apiKey="")=>{const makeBody=(withJsonMode:boolean):Record<string,unknown>=>{const body:Record<string,unknown>={model:"deepseek-v4-flash",messages:[{role:"user",content:prompt}],max_tokens:options.maxTokens||4000};if(withJsonMode&&options.jsonMode)body.response_format={type:"json_object"};return body;};const call=(withJsonMode:boolean)=>fetch("https://api.b.ai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${apiKey||env("BAI_API_KEY")}`,"Content-Type":"application/json"},body:JSON.stringify(makeBody(withJsonMode))});let response=await call(true);if(!response.ok&&options.jsonMode&&[400,404,422].includes(response.status))response=await call(false);if(!response.ok)throw new Error(`B.AI ${response.status}: ${await response.text()}`);const data=await response.json();return{id:String(data.id||""),text:String(data.choices?.[0]?.message?.content||""),usage:data.usage||null};};
const parseJsonOutput=(text:string)=>JSON.parse(String(text||"").replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/i,"").trim());
const commitChangesDirect=async(token:string,owner:string,repo:string,branch:string,changes:any[],message:string)=>{const branchPath=encodeURIComponent(branch).replace(/%2F/g,"/");const ref=await github(token,`/repos/${owner}/${repo}/git/ref/heads/${branchPath}`);const parentSha=String(ref?.object?.sha||"");if(!parentSha)throw new Error("Não foi possível identificar o commit atual da branch.");const parent=await github(token,`/repos/${owner}/${repo}/git/commits/${parentSha}`);const treeEntries=[];for(const change of changes){const blob=await github(token,`/repos/${owner}/${repo}/git/blobs`,{method:"POST",body:JSON.stringify({content:change.content,encoding:"utf-8"})});treeEntries.push({path:change.path,mode:"100644",type:"blob",sha:blob.sha});}const tree=await github(token,`/repos/${owner}/${repo}/git/trees`,{method:"POST",body:JSON.stringify({base_tree:parent.tree.sha,tree:treeEntries})});const commit=await github(token,`/repos/${owner}/${repo}/git/commits`,{method:"POST",body:JSON.stringify({message,tree:tree.sha,parents:[parentSha]})});await github(token,`/repos/${owner}/${repo}/git/refs/heads/${branchPath}`,{method:"PATCH",body:JSON.stringify({sha:commit.sha,force:false})});return commit;};
const bindInstallationOwner=async(userId:string,installationId:number)=>{const existing=await db.from("msk_github_installations").select("user_id,revoked_at").eq("installation_id",installationId).maybeSingle();if(existing.data?.user_id&&String(existing.data.user_id)!==userId)throw new Error("Esta instalação GitHub pertence a outra conta MSK.");const now=new Date().toISOString();await db.from("msk_github_installations").upsert({user_id:userId,installation_id:installationId,revoked_at:null,last_validated_at:now,updated_at:now},{onConflict:"installation_id"});};
const assertProjectOwner=async(projectId:string,userId:string)=>{const {data}=await db.from("msk_projects").select("user_id").eq("lovable_project_id",projectId).maybeSingle();if(data?.user_id&&String(data.user_id)!==userId)throw new Error("Este projeto está vinculado a outra conta MSK.");};

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});const url=new URL(req.url);let activeTaskId="";
  try{
    if(req.method==="POST"&&url.searchParams.get("action")==="health")return json({ok:true,service:"msk-agent",auth:"bai-deepseek-github-project-session",version:"2.4.2-license-bind-existing"});
    if(req.method==="GET"&&url.searchParams.get("installation_id")&&url.searchParams.get("state")){
      const state=await readState(url.searchParams.get("state")!);const installationId=Number(url.searchParams.get("installation_id"));
      if(!Number.isInteger(installationId)||installationId<=0)throw new Error("Instalação GitHub inválida.");
      const stateUserId=String(state.userId||"");const hasStateUser=/^[0-9a-f-]{36}$/i.test(stateUserId);
      if(hasStateUser)await assertProjectOwner(state.projectId,stateUserId);
      const installation=await getActiveInstallation(installationId);if(!installation)throw new Error("A instalação GitHub não está ativa.");
      if(hasStateUser){const existing=await db.from("msk_github_installations").select("user_id").eq("installation_id",installationId).maybeSingle();if(existing.data?.user_id&&String(existing.data.user_id)!==stateUserId)throw new Error("Esta instalação GitHub pertence a outra conta MSK.");}
      const session=crypto.randomUUID()+crypto.randomUUID();const binding:Record<string,unknown>={lovable_project_id:state.projectId,...(hasStateUser?{user_id:stateUserId}:{}),github_installation_id:installationId,session_token_hash:await sha256(session),connected_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      if(state.repository&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(state.repository)){const token=await installationToken(installationId);const repos=await github(token,"/installation/repositories?per_page=100");const matched=(repos.repositories||[]).find((r:any)=>String(r.full_name||"").toLowerCase()===state.repository!.toLowerCase());if(matched){binding.github_owner=matched.owner.login;binding.github_repo=matched.name;binding.github_default_branch=matched.default_branch;}}
      await db.from("msk_projects").upsert(binding);
      if(hasStateUser){const now=new Date().toISOString();await db.from("msk_github_installations").upsert({user_id:stateUserId,installation_id:installationId,account_login:String(installation?.account?.login||"")||null,account_type:String(installation?.account?.type||"")||null,revoked_at:null,last_validated_at:now,updated_at:now},{onConflict:"installation_id"});}
      return Response.redirect(`${state.returnUrl.split("#")[0]}#msk_session=${encodeURIComponent(session)}`,302);
    }
    if(req.method!=="POST")return json({error:"Método inválido."},405);const action=url.searchParams.get("action")||"status";const body=await req.json();const projectId=String(body.lovable_project_id||"");if(!/^[0-9a-f-]{36}$/i.test(projectId))return json({error:"ID de projeto inválido."},400);
    if(action==="bind-existing"){
      const installationId=Number(body.installation_id||0);if(!Number.isInteger(installationId)||installationId<=0)return json({connected:false,error:"Instalação GitHub inválida."},400);
      const recoveryState=String(body.recovery_state||"").trim();if(!recoveryState)return json({connected:false,error:"Confirmação segura da conexão ausente.",code:"RECOVERY_STATE_REQUIRED"},401);
      let recovery:{projectId:string;returnUrl:string;repository?:string;userId?:string};try{recovery=await readState(recoveryState);}catch{return json({connected:false,error:"A confirmação segura do GitHub expirou. Clique em conectar novamente.",code:"RECOVERY_STATE_INVALID"},401);}if(recovery.projectId!==projectId)return json({connected:false,error:"Projeto da confirmação GitHub não corresponde ao projeto atual.",code:"PROJECT_MISMATCH"},409);
      const requestUser=await userFromRequest(req);const recoveryUserId=String(recovery.userId||"").trim();if(recoveryUserId&&requestUser?.id&&recoveryUserId!==String(requestUser.id))return json({connected:false,error:"Esta autorização GitHub foi iniciada por outra conta MSK.",code:"MSK_USER_MISMATCH"},403);const effectiveUserId=/^[0-9a-f-]{36}$/i.test(recoveryUserId)?recoveryUserId:String(requestUser?.id||"");
      if(effectiveUserId){const existingInstall=await db.from("msk_github_installations").select("user_id").eq("installation_id",installationId).maybeSingle();if(existingInstall.data?.user_id&&String(existingInstall.data.user_id)!==effectiveUserId)return json({connected:false,error:"Essa instalação GitHub já pertence a outra conta MSK.",code:"GITHUB_INSTALLATION_OWNERSHIP_MISMATCH"},403);}
      const installation=await getActiveInstallation(installationId);if(!installation)return json({connected:false,error:"A instalação GitHub não está ativa."},404);
      const {data:project}=await db.from("msk_projects").select("github_installation_id,github_owner,github_repo,github_default_branch,project_name").eq("lovable_project_id",projectId).maybeSingle();if(project?.github_installation_id&&Number(project.github_installation_id)!==installationId)return json({connected:false,error:"Esta instalação GitHub não é a instalação já vinculada a este projeto.",code:"INSTALLATION_MISMATCH"},409);
      const patch:Record<string,unknown>={lovable_project_id:projectId,github_installation_id:installationId,...(effectiveUserId?{user_id:effectiveUserId}:{}),project_name:String(body.project_name||project?.project_name||"").slice(0,200)||null,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()};let repository=String(recovery.repository||body.repository_url||"").replace(/^https:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/^\/+|\/+$/g,"");if(!repository&&project?.github_owner&&project?.github_repo)repository=`${project.github_owner}/${project.github_repo}`;
      if(!project?.github_installation_id&&!repository)return json({connected:false,error:"Não consegui confirmar qual repositório pertence a este projeto. Abra o projeto conectado ao GitHub e tente novamente.",code:"REPOSITORY_REQUIRED_FOR_RECOVERY"},409);
      if(repository&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)){const token=await installationToken(installationId);const repos=await github(token,"/installation/repositories?per_page=100");const matched=(repos.repositories||[]).find((r:any)=>String(r.full_name||"").toLowerCase()===repository.toLowerCase());if(!matched)return json({connected:false,error:"A instalação GitHub não possui acesso ao repositório deste projeto.",code:"REPOSITORY_NOT_AUTHORIZED"},403);patch.github_owner=matched.owner.login;patch.github_repo=matched.name;patch.github_default_branch=matched.default_branch;repository=matched.full_name;}else if(project?.github_owner&&project?.github_repo){patch.github_owner=project.github_owner;patch.github_repo=project.github_repo;patch.github_default_branch=project.github_default_branch||null;}
      const session=crypto.randomUUID()+crypto.randomUUID();patch.session_token_hash=await sha256(session);await db.from("msk_projects").upsert(patch);if(effectiveUserId){const now=new Date().toISOString();await db.from("msk_github_installations").upsert({user_id:effectiveUserId,installation_id:installationId,account_login:String(installation?.account?.login||"")||null,account_type:String(installation?.account?.type||"")||null,revoked_at:null,last_validated_at:now,updated_at:now},{onConflict:"installation_id"});}
      return json({ok:true,connected:true,recovered_existing_installation:true,session_token:session,repository:repository||(project?.github_owner&&project?.github_repo?`${project.github_owner}/${project.github_repo}`:"")});
    }
    if(action==="connect"){
      const returnUrl=/^https:\/\/lovable\.dev\/projects\//.test(body.page_url||"")?body.page_url:`https://lovable.dev/projects/${projectId}`;const requestUser=await userFromRequest(req);const requestUserId=String(requestUser?.id||"");const {data}=await db.from("msk_projects").select("user_id,github_installation_id,session_token_hash,github_owner,github_repo").eq("lovable_project_id",projectId).maybeSingle();if(data?.user_id&&requestUserId&&String(data.user_id)!==requestUserId)return json({connected:false,error:"Este projeto pertence a outra conta MSK.",code:"PROJECT_OWNERSHIP_MISMATCH"},403);const currentSession=req.headers.get("x-msk-session")||"";if(data?.github_installation_id&&currentSession&&await validSession(projectId,currentSession))return json({connected:true,repository:data.github_owner&&data.github_repo?`${data.github_owner}/${data.github_repo}`:""});
      const repositoryUrl=String(body.repository_url||"");const requestedRepository=repositoryUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/?#]+)/i)?.[1]?.replace(/\.git$/i,"")||"";const boundRepository=data?.github_owner&&data?.github_repo?`${data.github_owner}/${data.github_repo}`:"";const repository=boundRepository||requestedRepository;const state=await makeState(projectId,returnUrl,repository,requestUserId);
      if(data?.github_installation_id){const installationId=Number(data.github_installation_id);const installation=await getActiveInstallation(installationId);if(installation){if(body.check_only)return json({connected:false,installation_known:true,needs_session_recovery:true,repository});return json({connected:false,installation_known:true,needs_session_recovery:true,existing_installation_id:installationId,recovery_state:state,repository,authorize_url:`https://github.com/settings/installations/${installationId}`});}await db.from("msk_projects").update({github_installation_id:null,session_token_hash:null,updated_at:new Date().toISOString()}).eq("lovable_project_id",projectId);}
      if(body.check_only)return json({connected:false,requires_github_authorization:true});return json({connected:false,requires_github_authorization:true,recovery_state:state,authorize_url:`https://github.com/apps/${env("GITHUB_APP_SLUG")}/installations/new?state=${encodeURIComponent(state)}`});
    }
    if(action==="status"){
      const requestUser=await userFromRequest(req);const requestUserId=String(requestUser?.id||"");const {data:project}=await db.from("msk_projects").select("user_id,github_installation_id,github_owner,github_repo,project_name").eq("lovable_project_id",projectId).maybeSingle();if(project?.user_id&&requestUserId&&String(project.user_id)!==requestUserId)return json({connected:false,error:"Este projeto pertence a outra conta MSK.",code:"PROJECT_OWNERSHIP_MISMATCH"},403);if(!project?.github_installation_id)return json({connected:false});const installation=await getActiveInstallation(Number(project.github_installation_id));if(!installation){await db.from("msk_projects").update({github_installation_id:null,session_token_hash:null,updated_at:new Date().toISOString()}).eq("lovable_project_id",projectId);return json({connected:false});}const session=req.headers.get("x-msk-session")||"";const repository=project.github_owner&&project.github_repo?`${project.github_owner}/${project.github_repo}`:"";if(!session||!await validSession(projectId,session))return json({connected:false,installation_known:true,needs_session_recovery:true,repository});const selected=await chooseRepository(Number(project.github_installation_id),body.project_name||project.project_name||"",repository||String(body.repository_url||""));if(!selected.repo)return json({connected:false,requires_repository_selection:true,repositories:selected.candidates});return json({connected:true,repository:selected.repo.full_name});
    }
    let aiKeyContext:{key:string;source:"user"|"system-db"|"system-env"}|null=null;const ai=async(prompt:string,options:{jsonMode?:boolean;maxTokens?:number}={})=>{if(!aiKeyContext)aiKeyContext=await aiApiKeyForRequest(req);return deepseek(prompt,options,aiKeyContext.key);};
    if(action==="chat"){const message=String(body.message||body.command||"").trim();if(!message)return json({error:"Mensagem vazia."},400);const history=Array.isArray(body.history)?body.history.slice(-20):[];const historyText=history.map((item:any)=>{const role=item?.role==="assistant"?"MSK":"Cliente";const content=String(item?.content||item?.message||"").slice(0,8000);return content?`${role}: ${content}`:"";}).filter(Boolean).join("\n");const response=await ai(`Você é o MSK Agente dentro da extensão do Lovable. Responda em português do Brasil, de forma objetiva, profissional e útil. O chat deve continuar funcionando mesmo quando a autorização de escrita do GitHub ainda não estiver disponível. Não diga que uma alteração foi aplicada se você apenas respondeu em conversa. Projeto Lovable atual: ${projectId}. Nome: ${String(body.project_name||"não informado").slice(0,200)}.\n\nHistórico recente:\n${historyText||"(sem histórico)"}\n\nCliente: ${message}\nMSK:`,{maxTokens:3000});const messageText=response.text.trim();return json({ok:true,connected:true,mode:"chat",no_edit:true,assistant_message:messageText||"Recebi sua mensagem. Como posso ajudar neste projeto?",message:messageText||"Recebi sua mensagem. Como posso ajudar neste projeto?",response_id:response.id,model:"deepseek-v4-flash"});}
    let effectiveCommand="";if(action==="run"){const rawCommand=String(body.original_command||body.message||body.command||"").trim();if(!rawCommand)return json({error:"Comando vazio."},400);const skill=normalizeSkill(body.active_skill);const history=Array.isArray(body.history)?body.history.slice(-20):[];const historyText=history.map((item:any)=>{const role=item?.role==="assistant"?"MSK":"Cliente";const content=String(item?.content||item?.message||"").slice(0,8000);return content?`${role}: ${content}`:"";}).filter(Boolean).join("\n");let decision:any={intent:"edit",effective_command:rawCommand,reply:""};try{const preflight=await ai(`Você é o cérebro do MSK Agente. Responda SOMENTE JSON válido no formato {"intent":"edit|question|clarify","effective_command":"...","reply":"..."}. Pedido atual tem prioridade máxima. Projeto ${projectId}. Histórico:\n${historyText||"(sem histórico)"}\nSkill auxiliar:\n${skill?`${skill.name}: ${skill.prompt}`:"(nenhuma)"}\nMensagem atual:\n${rawCommand}`,{jsonMode:true,maxTokens:2500});const parsed=parseJsonOutput(preflight.text);const intent=["edit","question","clarify"].includes(String(parsed.intent))?String(parsed.intent):"edit";decision={intent,effective_command:String(parsed.effective_command||rawCommand).trim()||rawCommand,reply:String(parsed.reply||"").trim(),response_id:preflight.id};}catch(preflightError){console.warn("MSK preflight indisponível; seguindo como edição.",preflightError);}if(decision.intent==="question")return json({ok:true,mode:"chat",no_edit:true,assistant_message:decision.reply||"Posso ajudar com este projeto.",message:decision.reply||"Posso ajudar com este projeto.",response_id:decision.response_id||"",model:"deepseek-v4-flash"});if(decision.intent==="clarify")return json({ok:true,mode:"clarification",requires_input:true,no_edit:true,assistant_message:decision.reply||"Preciso de mais uma informação antes de editar o projeto.",message:decision.reply||"Preciso de mais uma informação antes de editar o projeto.",response_id:decision.response_id||"",model:"deepseek-v4-flash"});effectiveCommand=buildExecutionCommand(decision.effective_command||rawCommand,skill);}
    const requestUser=await userFromRequest(req);const requestUserId=String(requestUser?.id||"");if(!requestUserId)return json({error:"Valide uma licença MSK ativa para editar.",code:"LICENSE_REQUIRED",connected:false},401);const {data:owned}=await db.from("msk_projects").select("user_id,github_installation_id").eq("lovable_project_id",projectId).maybeSingle();if(owned?.user_id&&owned.user_id!==requestUserId)return json({error:"Este projeto não está conectado ao GitHub desta licença MSK.",code:"PROJECT_OWNERSHIP_MISMATCH",connected:false},403);if(owned?.github_installation_id){const installationOwner=await db.from("msk_github_installations").select("user_id,revoked_at").eq("installation_id",Number(owned.github_installation_id)).maybeSingle();if(installationOwner.data?.user_id&&installationOwner.data.user_id!==requestUserId)return json({error:"Conecte novamente o GitHub desta licença MSK.",code:"GITHUB_RECONNECT_REQUIRED",connected:false},401);if(installationOwner.data?.revoked_at)return json({error:"Conecte novamente o GitHub desta licença MSK.",code:"GITHUB_RECONNECT_REQUIRED",connected:false},401);}
    const session=req.headers.get("x-msk-session")||"";if(!await validSession(projectId,session))return json({error:"Sessão de edição MSK ainda não autorizada.",code:"MSK_SESSION_REQUIRED",connected:false},401);
    if(action==="task-status"){const taskId=String(body.task_id||"");if(!/^[0-9a-f-]{36}$/i.test(taskId))return json({error:"Tarefa inválida."},400);const {data:task}=await db.from("msk_tasks").select("id,user_id,status,summary,error,branch_name,pull_request_url,updated_at").eq("id",taskId).eq("lovable_project_id",projectId).maybeSingle();if(task?.user_id&&task.user_id!==requestUserId)return json({error:"Esta tarefa pertence a outra conta MSK."},403);return task?json({ok:true,task}):json({ok:false,error:"Tarefa ainda não iniciada."},404);}
    const {data:project}=await db.from("msk_projects").select("*").eq("lovable_project_id",projectId).single();if(!project?.github_installation_id)return json({connected:false});const requestedRepository=String(body.repository_url||body.repository||"").replace(/^https:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/^\/+|\/+$/g,"");const boundRepository=project.github_owner&&project.github_repo?`${project.github_owner}/${project.github_repo}`:"";const selected=await chooseRepository(project.github_installation_id,body.project_name||project.project_name||"",boundRepository||requestedRepository);if(!selected.repo)return json({connected:false,requires_repository_selection:true,repositories:selected.candidates});await db.from("msk_projects").update({project_name:body.project_name||project.project_name,github_owner:selected.repo.owner.login,github_repo:selected.repo.name,github_default_branch:selected.repo.default_branch,updated_at:new Date().toISOString()}).eq("lovable_project_id",projectId);
    if(action==="approve"){const taskId=String(body.task_id||"");if(!/^[0-9a-f-]{36}$/i.test(taskId))return json({error:"Tarefa inválida."},400);const {data:task}=await db.from("msk_tasks").select("id,user_id,status,pull_request_url,summary").eq("id",taskId).eq("lovable_project_id",projectId).maybeSingle();if(task?.user_id&&task.user_id!==requestUserId)return json({error:"Esta tarefa pertence a outra conta MSK."},403);if(!task?.pull_request_url)return json({error:"Pull Request da tarefa não encontrado."},404);if(task.status==="completed")return json({ok:true,completed:true,message:"Alteração já aplicada."});const pullNumber=Number(task.pull_request_url.match(/\/pull\/(\d+)/)?.[1]);if(!pullNumber)return json({error:"Número do Pull Request inválido."},400);const merged=await github(selected.token,`/repos/${selected.repo.owner.login}/${selected.repo.name}/pulls/${pullNumber}/merge`,{method:"PUT",body:JSON.stringify({commit_title:`MSK: ${String(task.summary||"alteração aprovada").slice(0,70)}`,merge_method:"squash"})});if(!merged?.merged)return json({error:merged?.message||"O GitHub não permitiu aplicar o Pull Request."},409);await db.from("msk_tasks").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",taskId).eq("lovable_project_id",projectId);return json({ok:true,completed:true,message:"Alteração aplicada no repositório."});}
    const command=effectiveCommand||buildExecutionCommand(String(body.original_command||body.command||"").trim(),normalizeSkill(body.active_skill));if(!command)return json({error:"Comando vazio."},400);const requestedTaskId=String(body.task_id||"");activeTaskId=/^[0-9a-f-]{36}$/i.test(requestedTaskId)?requestedTaskId:crypto.randomUUID();const {data:task,error:taskError}=await db.from("msk_tasks").insert({id:activeTaskId,lovable_project_id:projectId,user_id:requestUserId,command,status:"analyzing"}).select().single();if(taskError||!task)throw new Error(taskError?.message||"Não foi possível iniciar a tarefa.");const owner=selected.repo.owner.login,repo=selected.repo.name,branch=selected.repo.default_branch;const tree=await github(selected.token,`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);const paths=(tree.tree||[]).filter((x:any)=>x.type==="blob"&&/\.(tsx?|jsx?|css|json|md|sql)$/.test(x.path)).slice(0,600).map((x:any)=>x.path);const selector=await ai(`Você é o agente de código MSK em MODO FAST_EDIT. Selecione até 12 arquivos estritamente necessários para executar o comando. Responda somente JSON: {"files":["path"],"plan":"resumo"}.\nComando: ${command}\nArquivos:\n${paths.join("\n")}`,{jsonMode:true,maxTokens:2000});const selection=parseJsonOutput(selector.text);const chosen=(selection.files||[]).filter((p:string)=>paths.includes(p)).slice(0,12);if(!chosen.length)throw new Error("O agente não encontrou arquivos seguros para alterar.");const files=await Promise.all(chosen.map(async(path:string)=>{const item=await github(selected.token,`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g,"/")}?ref=${encodeURIComponent(branch)}`);return{path,sha:item.sha,content:new TextDecoder().decode(Uint8Array.from(atob(item.content.replace(/\n/g,"")),c=>c.charCodeAt(0)))};}));await db.from("msk_tasks").update({status:"editing",updated_at:new Date().toISOString()}).eq("id",task.id).eq("lovable_project_id",projectId);const edit=await ai(`Você é o executor de código MSK em MODO FAST_EDIT. Edite apenas o necessário. Preserve tudo que funciona. Responda somente JSON: {"summary":"resumo","reply":"resposta ao cliente","changes":[{"path":"...","content":"arquivo completo"}]}.\nComando: ${command}\nArquivos:\n${files.map(f=>`--- ${f.path}\n${f.content}`).join("\n")}`,{jsonMode:true,maxTokens:50000});const result=parseJsonOutput(edit.text);const changes=(result.changes||[]).filter((c:any)=>typeof c.path==="string"&&typeof c.content==="string"&&!c.path.includes("..")).slice(0,12);if(!changes.length)throw new Error("Nenhuma alteração válida foi produzida.");const commitMessage=`MSK: ${String(result.summary||command).slice(0,70)}`;
    if(body.direct_commit!==false){try{const commit=await commitChangesDirect(selected.token,owner,repo,branch,changes,commitMessage);await db.from("msk_tasks").update({status:"completed",branch_name:branch,summary:result.summary,openai_response_id:edit.id,updated_at:new Date().toISOString()}).eq("id",task.id);return json({ok:true,completed:true,direct_commit:true,message:"Alteração aplicada diretamente no repositório.",assistant_message:String(result.reply||result.summary||"Alteração preparada com sucesso.").trim(),summary:String(result.summary||"").trim(),model:"deepseek-v4-flash",provider:"B.AI",task_id:task.id,repository:`${owner}/${repo}`,branch,files:changes.map((change:any)=>change.path),commit_sha:commit.sha,commit_url:commit.html_url||`https://github.com/${owner}/${repo}/commit/${commit.sha}`});}catch(directError){console.warn("MSK direct commit indisponível; usando Pull Request seguro.",directError);}}
    const branchName=`msk/${task.id.slice(0,8)}`;const ref=await github(selected.token,`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g,"/")}`);await github(selected.token,`/repos/${owner}/${repo}/git/refs`,{method:"POST",body:JSON.stringify({ref:`refs/heads/${branchName}`,sha:ref.object.sha})});for(const change of changes){const existing=files.find(f=>f.path===change.path);await github(selected.token,`/repos/${owner}/${repo}/contents/${encodeURIComponent(change.path).replace(/%2F/g,"/")}`,{method:"PUT",body:JSON.stringify({message:commitMessage,content:utf8Base64(change.content),branch:branchName,...(existing?.sha?{sha:existing.sha}:{})})});}const pr=await github(selected.token,`/repos/${owner}/${repo}/pulls`,{method:"POST",body:JSON.stringify({title:commitMessage,head:branchName,base:branch,body:`Alteração preparada pelo MSK Agente.\n\n${result.summary||""}\n\nRevise antes de mesclar.`})});await db.from("msk_tasks").update({status:"awaiting_approval",branch_name:branchName,pull_request_url:pr.html_url,summary:result.summary,openai_response_id:edit.id,updated_at:new Date().toISOString()}).eq("id",task.id);return json({ok:true,requires_approval:true,message:`Alteração preparada em Pull Request: ${pr.html_url}`,assistant_message:String(result.reply||result.summary||"A alteração foi preparada e aguarda aprovação no GitHub.").trim(),summary:String(result.summary||"").trim(),model:"deepseek-v4-flash",provider:"B.AI",repository:`${owner}/${repo}`,branch:branchName,files:changes.map((change:any)=>change.path),task_id:task.id,pull_request_url:pr.html_url});
  }catch(error){console.error(error);const rawMessage=error instanceof Error?error.message:"Falha inesperada.";const privateKeyFailure=/PRIVATE|ASN\.?1|pkcs|rsa|constructed|incorrect length/i.test(rawMessage);const safeMessage=privateKeyFailure?"A conexão GitHub está configurada, mas a chave privada da GitHub App precisa ser corrigida no servidor MSK.":rawMessage;if(activeTaskId)await db.from("msk_tasks").update({status:"failed",error:safeMessage,updated_at:new Date().toISOString()}).eq("id",activeTaskId);return json({error:safeMessage,code:privateKeyFailure?"GITHUB_APP_PRIVATE_KEY_INVALID":"MSK_AGENT_ERROR"},500);}
});