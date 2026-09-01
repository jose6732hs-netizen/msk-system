import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(SUPABASE_URL, SERVICE_ROLE);
const enc = new TextEncoder();
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-msk-license, x-msk-session",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const authToken = req => (req.headers.get("authorization") || req.headers.get("x-msk-license") || "").replace(/^Bearer\s+/i, "").trim();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64bytes = value => Uint8Array.from(atob(value.replace(/\s/g, "")), c => c.charCodeAt(0));
const derLen = n => n < 128 ? new Uint8Array([n]) : (() => { const a=[]; for(let v=n;v>0;v>>>=8)a.unshift(v&255); return new Uint8Array([128|a.length,...a]); })();
const join=(...parts)=>{const out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const wrap=(tag,value)=>join(new Uint8Array([tag]),derLen(value.length),value);
const pkcs1=raw=>wrap(48,join(new Uint8Array([2,1,0]),new Uint8Array([48,13,6,9,42,134,72,134,247,13,1,1,1,5,0]),wrap(4,raw)));

async function identity(req){
  const token=authToken(req); if(!token||token.startsWith("sb_publishable_")) return null;
  const direct=await db.auth.getUser(token); if(!direct.error&&direct.data.user) return {id:direct.data.user.id};
  for(const origin of ["https://msksystem.online","https://msk-system.lovable.app"]){
    try{const r=await fetch(`${origin}/api/extension/license-identity`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:"{}"});const d=await r.json().catch(()=>({}));if(r.ok&&d?.ok&&d?.active&&/^[0-9a-f-]{36}$/i.test(String(d.user_id||"")))return{id:String(d.user_id)};}catch{}
  }
  return null;
}
async function appKey(){
  const value=(Deno.env.get("GITHUB_APP_PRIVATE_KEY")||"").trim().replace(/\\r\\n/g,"\n").replace(/\\n/g,"\n");
  const m=value.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/); if(!m) throw new Error("GITHUB_APP_CREDENTIALS_INVALID");
  const raw=b64bytes(m[2]); return crypto.subtle.importKey("pkcs8",m[1]==="RSA PRIVATE KEY"?pkcs1(raw):raw,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
}
async function appJwt(){const now=Math.floor(Date.now()/1000),h=b64(enc.encode(JSON.stringify({alg:"RS256",typ:"JWT"}))),p=b64(enc.encode(JSON.stringify({iat:now-30,exp:now+540,iss:Deno.env.get("GITHUB_APP_ID")||""}))),u=`${h}.${p}`,sig=b64(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",await appKey(),enc.encode(u))));return `${u}.${sig}`;}
async function installationToken(id){const r=await fetch(`https://api.github.com/app/installations/${id}/access_tokens`,{method:"POST",headers:{Authorization:`Bearer ${await appJwt()}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});if(!r.ok)throw new Error(`GITHUB_TOKEN_${r.status}`);return String((await r.json()).token||"");}
async function gh(token,path){const r=await fetch(`https://api.github.com${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch{}if(!r.ok)throw new Error(`GITHUB_${r.status}`);return data;}
const safeRepo=value=>/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value||""))?String(value):"";

async function contextFor(req, body){
  const user=await identity(req); if(!user) return {error:json({ok:false,code:"AUTH_REQUIRED",error:"Valide sua licença MSK."},401)};
  const projectId=String(body?.lovable_project_id||"").trim(); const taskId=String(body?.task_id||"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(projectId)||!(/^[0-9a-f-]{36}$/i.test(taskId))) return {error:json({ok:false,code:"TASK_CONTEXT_INVALID",error:"Projeto ou tarefa inválidos."},400)};
  const {data:project}=await db.from("msk_projects").select("lovable_project_id,user_id,github_installation_id,github_owner,github_repo,github_default_branch").eq("lovable_project_id",projectId).maybeSingle();
  if(!project||String(project.user_id||"")!==user.id) return {error:json({ok:false,code:"PROJECT_OWNERSHIP_MISMATCH",error:"O projeto não pertence à conta MSK atual."},403)};
  const {data:task}=await db.from("msk_tasks").select("id,user_id,lovable_project_id,status,summary,branch_name,error,error_code,error_stage,retry_count,updated_at").eq("id",taskId).eq("lovable_project_id",projectId).eq("user_id",user.id).maybeSingle();
  if(!task) return {error:json({ok:false,code:"TASK_NOT_FOUND",error:"A tarefa não foi encontrada."},404)};
  return {user,project,task,projectId,taskId};
}

async function verifyProof(req, body){
  const ctx=await contextFor(req,body); if(ctx.error)return ctx.error; const {user,project,task,projectId,taskId}=ctx;
  if(String(task.status)==="completed_no_change") return json({ok:true,proof_verified:true,no_change_needed:true,task_id:taskId,status:task.status,summary:task.summary||"Nenhuma mudança era necessária."});
  if(String(task.status)!=="completed") return json({ok:false,code:"TASK_NOT_COMPLETED",status:task.status,task_id:taskId,error:"A tarefa ainda não possui estado final de conclusão."},409);
  const repository=safeRepo(`${project.github_owner||""}/${project.github_repo||""}`); const branch=String(task.branch_name||project.github_default_branch||"main");
  const summary=String(task.summary||""); const candidate=String(body?.commit_sha||summary.match(/\bCommit:\s*([0-9a-f]{7,40})\b/i)?.[1]||"").trim();
  if(!repository||!project.github_installation_id||!candidate) return json({ok:false,code:"COMPLETION_PROOF_MISSING",task_id:taskId,error:"Faltam dados para confirmar o commit final."},409);
  const token=await installationToken(Number(project.github_installation_id));
  const commit=await gh(token,`/repos/${repository}/commits/${encodeURIComponent(candidate)}`); const fullSha=String(commit?.sha||"");
  const compare=await gh(token,`/repos/${repository}/compare/${encodeURIComponent(fullSha)}...${encodeURIComponent(branch)}`);
  const branchContains=String(compare?.status||"")==="identical" || (String(compare?.merge_base_commit?.sha||"")===fullSha && ["ahead","identical"].includes(String(compare?.status||"")));
  const files=Array.isArray(commit?.files)?commit.files.map(f=>String(f?.filename||"")).filter(Boolean).slice(0,300):[];
  const {data:checkpoints}=await db.from("msk_agent_checkpoints").select("to_status,occurred_at").eq("task_id",taskId).order("occurred_at",{ascending:true});
  const states=(checkpoints||[]).map(row=>String(row.to_status||""));
  const semantic=states.includes("validating") && states.some(s=>["finalizing","committing","verifying","completed"].includes(s));
  const commitVerified=!!fullSha && files.length>0 && branchContains;
  const validation={content_changed:files.length>0,semantic,commit_verified:commitVerified,branch_contains_commit:branchContains,checkpoint_count:states.length};
  if(!commitVerified||!semantic) return json({ok:false,code:"COMPLETION_PROOF_FAILED",task_id:taskId,repository,branch,commit_sha:fullSha||candidate,files_changed_count:files.length,validation,error:"A conclusão ainda não possui todas as provas exigidas."},409);
  const commitUrl=String(commit?.html_url||`https://github.com/${repository}/commit/${fullSha}`);
  await db.from("msk_task_proofs").upsert({task_id:taskId,user_id:user.id,lovable_project_id:projectId,repository,branch_name:branch,commit_sha:fullSha,commit_url:commitUrl,files_changed_count:files.length,files,validation,commit_verified:true,branch_contains_commit:true,verified_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"task_id"});
  return json({ok:true,proof_verified:true,execution_verified:true,commit_verified:true,task_id:taskId,repository,branch,commit_sha:fullSha,commit_url:commitUrl,files_changed_count:files.length,files,validation,summary:task.summary||"Alteração confirmada."});
}

async function skillCheck(req,body){
  const user=await identity(req); if(!user)return json({ok:false,code:"AUTH_REQUIRED"},401);
  const command=String(body?.command||body?.original_command||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"").slice(0,50000);
  const {data}=await db.from("msk_agent_skill_catalog").select("skill_key,label,detector_regex,dependency_hints,validation_rules,risk_level").eq("enabled",true);
  const matches=[]; for(const skill of data||[]){try{if(new RegExp(skill.detector_regex,"i").test(command))matches.push({skill_key:skill.skill_key,label:skill.label,dependency_hints:skill.dependency_hints,validation_rules:skill.validation_rules,risk_level:skill.risk_level});}catch{}}
  return json({ok:true,skills:matches,primary:matches[0]||null,sanitized_length:command.length});
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors}); if(req.method!=="POST")return json({ok:false,code:"METHOD_NOT_ALLOWED"},405);
  const action=new URL(req.url).searchParams.get("action")||"proof"; const body=await req.json().catch(()=>({}));
  try{
    if(action==="proof")return await verifyProof(req,body);
    if(action==="skill-check")return await skillCheck(req,body);
    if(action==="health"){const user=await identity(req);if(!user)return json({ok:false,code:"AUTH_REQUIRED"},401);const {data,error}=await db.rpc("msk_agent_health_snapshot");if(error)return json({ok:false,code:"HEALTH_SNAPSHOT_FAILED"},500);return json({ok:true,health:data});}
    return json({ok:false,code:"ACTION_NOT_SUPPORTED"},400);
  }catch(error){console.error("MSK proof service",error instanceof Error?error.message:"unknown");return json({ok:false,code:"PROOF_SERVICE_UNAVAILABLE",retryable:true,error:"A prova final ficou temporariamente indisponível."},503);}
});
