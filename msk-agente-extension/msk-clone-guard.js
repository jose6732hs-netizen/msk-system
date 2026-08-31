// MSK Clone Guard v1 — fail-closed command gate + remote device block.
const MSK_GUARD_BASE_FETCH = globalThis.fetch.bind(globalThis);
const MSK_GUARD_ORIGIN = 'https://msksystem.online';
const MSK_GUARD_LOCK_KEY = 'mskCloneProtectionV1';
const MSK_GUARD_STATUS_KEY = 'mskCloneGuardStatusV1';
const MSK_GUARD_ALARM = 'msk-clone-guard-poll';
const MSK_GUARD_VERIFY_TTL = 20_000;
const MSK_GUARD_HARD_CODES = new Set([
  'BUILD_NOT_APPROVED','INTEGRITY_BUILD_NOT_APPROVED','INTEGRITY_CHECK_FAILED','SECURITY_ENROLLMENT_REJECTED',
  'DEVICE_KEY_MISMATCH','BUILD_FINGERPRINT_MISMATCH','EXTENSION_ID_MISMATCH','SECURITY_SIGNATURE_INVALID',
  'SECURITY_REPLAY_BLOCKED','INSTALLATION_OWNERSHIP_MISMATCH',
]);
let mskGuardLockMemory = null;
let mskGuardStatusMemory = null;
let mskGuardRefreshPromise = null;

const mskGuardBlockedNetwork = (url) => {
  const host = String(url?.hostname || '').toLowerCase();
  const path = String(url?.pathname || '');
  if (host === 'iybjfmhqbblrppqoodyf.supabase.co' && path.startsWith('/functions/v1/msk-agent')) return true;
  if (host === 'api.lovable.dev' || host === 'lovable-api.com' || host.endsWith('.lovable-api.com')) return true;
  return false;
};
const mskGuardJsonResponse = (code, message, status = 423) => new Response(JSON.stringify({ ok:false, blocked:true, code, error:message, message }), {
  status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});
async function mskGuardLoadLock(){
  if(mskGuardLockMemory?.blocked)return mskGuardLockMemory;
  try{const value=(await chrome.storage.local.get(MSK_GUARD_LOCK_KEY))[MSK_GUARD_LOCK_KEY]||null;mskGuardLockMemory=value;return value;}catch{return mskGuardLockMemory;}
}
async function mskGuardLoadStatus(){
  if(mskGuardStatusMemory)return mskGuardStatusMemory;
  try{const value=(await chrome.storage.local.get(MSK_GUARD_STATUS_KEY))[MSK_GUARD_STATUS_KEY]||null;mskGuardStatusMemory=value;return value;}catch{return mskGuardStatusMemory;}
}
async function mskGuardSetLock(input={}){
  const installationId=String(input.installationId||(await chrome.storage.local.get('mskInstallationId')).mskInstallationId||'').trim();
  const lock={blocked:true,source:String(input.source||'security'),code:String(input.code||'MSK_CLONE_BLOCKED'),reason:String(input.reason||'Esta instalação foi bloqueada pela segurança MSK.').slice(0,500),detectedAt:Number(input.detectedAt||Date.now()),installationId,deviceRef:installationId?installationId.slice(-10):''};
  mskGuardLockMemory=lock;
  try{await chrome.storage.local.set({[MSK_GUARD_LOCK_KEY]:lock});await chrome.storage.session.remove(['mskSecuritySessionV1','mskIntegrityGateV2']).catch(()=>{});}catch{}
  return lock;
}
async function mskGuardClearRemoteLock(){
  const current=await mskGuardLoadLock();if(!current?.blocked||current.source!=='remote')return current;
  mskGuardLockMemory=null;try{await chrome.storage.local.remove(MSK_GUARD_LOCK_KEY);}catch{}return null;
}
async function mskGuardRecordStatus(status){mskGuardStatusMemory=status;try{await chrome.storage.local.set({[MSK_GUARD_STATUS_KEY]:status});}catch{}return status;}
async function mskGuardIdentity(){
  const saved=await chrome.storage.local.get(['mskLicense','mskInstallationId']);const license=saved?.mskLicense||null;
  const token=String(license?.token||'').trim(),installationId=String(saved?.mskInstallationId||'').trim(),version=String(chrome.runtime.getManifest().version||'').trim(),extensionId=String(chrome.runtime.id||'').trim();
  if(!token||!installationId||!version||!extensionId)return null;return{token,installationId,version,extensionId};
}
async function mskGuardRefreshRemote({force=false}={}){
  if(mskGuardRefreshPromise)return mskGuardRefreshPromise;
  mskGuardRefreshPromise=(async()=>{
    const previousStatus=await mskGuardLoadStatus();
    if(!force&&previousStatus?.verifiedAt&&Date.now()-Number(previousStatus.verifiedAt)<MSK_GUARD_VERIFY_TTL)return{ok:true,verified:true,status:previousStatus,lock:await mskGuardLoadLock()};
    const identity=await mskGuardIdentity();if(!identity)return{ok:false,verified:false,code:'MSK_GUARD_IDENTITY_PENDING',lock:await mskGuardLoadLock()};
    const url=`${MSK_GUARD_ORIGIN}/api/extension/control?installation_id=${encodeURIComponent(identity.installationId)}&version=${encodeURIComponent(identity.version)}`;
    let response;try{response=await MSK_GUARD_BASE_FETCH(url,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${identity.token}`,'X-MSK-Installation-Id':identity.installationId,'X-MSK-Extension-Version':identity.version,'X-MSK-Extension-Id':identity.extensionId},cache:'no-store'});}catch(error){return{ok:false,verified:false,code:'MSK_SECURITY_UNAVAILABLE',error:String(error?.message||error),lock:await mskGuardLoadLock()};}
    const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{};}catch{}const code=String(payload?.code||'');
    if(!response.ok){
      if(code==='INSTALLATION_BLOCKED'){const lock=await mskGuardSetLock({source:'remote',code,reason:payload?.message||payload?.error||'Instalação bloqueada pela segurança MSK.',installationId:identity.installationId});return{ok:false,verified:true,blocked:true,code,lock};}
      if(MSK_GUARD_HARD_CODES.has(code)){const lock=await mskGuardSetLock({source:'security',code,reason:payload?.message||payload?.error||'Cópia não autorizada detectada.',installationId:identity.installationId});return{ok:false,verified:true,blocked:true,code,lock};}
      return{ok:false,verified:false,code:code||'MSK_SECURITY_UNAVAILABLE',lock:await mskGuardLoadLock()};
    }
    if(payload?.control?.blocked===true){
      const lock=await mskGuardSetLock({source:'remote',code:'INSTALLATION_BLOCKED',reason:payload?.control?.message||payload?.control?.reason||'Instalação bloqueada pela segurança MSK.',installationId:identity.installationId});
      await mskGuardRecordStatus({verifiedAt:Date.now(),suspicious:!!payload?.integrity?.suspicious,suspicionReason:payload?.integrity?.reason||null,blocked:true});
      return{ok:false,verified:true,blocked:true,code:'INSTALLATION_BLOCKED',lock};
    }
    await mskGuardClearRemoteLock();
    const status=await mskGuardRecordStatus({verifiedAt:Date.now(),suspicious:payload?.integrity?.suspicious===true,suspicionReason:payload?.integrity?.reason||null,blocked:false,installationId:identity.installationId,deviceRef:identity.installationId.slice(-10)});
    const lock=await mskGuardLoadLock();return{ok:!lock?.blocked,verified:true,status,lock};
  })().finally(()=>{mskGuardRefreshPromise=null;});
  return mskGuardRefreshPromise;
}
async function mskGuardAssert({force=false}={}){
  let lock=await mskGuardLoadLock();if(lock?.blocked&&lock.source!=='remote')return{ok:false,blocked:true,lock};
  const refreshed=await mskGuardRefreshRemote({force:force||!!lock?.blocked});lock=await mskGuardLoadLock();
  if(lock?.blocked)return{ok:false,blocked:true,lock,code:lock.code};
  if(!refreshed?.verified)return{ok:false,blocked:false,verified:false,code:refreshed?.code||'MSK_SECURITY_UNAVAILABLE',error:'Não foi possível confirmar a segurança MSK agora. Tente novamente em instantes.'};
  return{ok:true,verified:true,status:refreshed.status||await mskGuardLoadStatus()};
}
globalThis.__MSK_CLONE_GUARD_LOCK__=mskGuardSetLock;
globalThis.__MSK_CLONE_GUARD_ASSERT__=mskGuardAssert;
globalThis.__MSK_CLONE_GUARD_REFRESH__=mskGuardRefreshRemote;
globalThis.fetch=async function mskCloneGuardFetch(input,init){
  let request;try{request=new Request(input,init);}catch{return MSK_GUARD_BASE_FETCH(input,init);}let url;try{url=new URL(request.url);}catch{return MSK_GUARD_BASE_FETCH(request);}
  if(mskGuardBlockedNetwork(url)){const lock=await mskGuardLoadLock();if(lock?.blocked)return mskGuardJsonResponse(lock.code||'MSK_CLONE_BLOCKED','Esta instalação foi bloqueada pela segurança MSK.');}
  return MSK_GUARD_BASE_FETCH(request);
};
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(message?.type==='MSK_CLONE_GUARD_STATUS'){Promise.all([mskGuardLoadLock(),mskGuardLoadStatus()]).then(([lock,status])=>sendResponse({ok:true,blocked:!!lock?.blocked,lock,status})).catch(()=>sendResponse({ok:false}));return true;}
  if(message?.type==='MSK_CLONE_GUARD_REFRESH'){mskGuardRefreshRemote({force:true}).then(async result=>sendResponse({...result,blocked:!!(await mskGuardLoadLock())?.blocked,lock:await mskGuardLoadLock()})).catch(()=>sendResponse({ok:false,verified:false}));return true;}
  if(message?.type==='MSK_CLONE_GUARD_OPEN_PLANS'){chrome.tabs.create({url:MSK_GUARD_ORIGIN,active:true}).then(()=>sendResponse({ok:true}),()=>sendResponse({ok:false}));return true;}
  return undefined;
});
try{
  chrome.alarms.create(MSK_GUARD_ALARM,{periodInMinutes:1});
  chrome.alarms.onAlarm.addListener(alarm=>{if(alarm?.name===MSK_GUARD_ALARM)mskGuardRefreshRemote({force:true}).catch(()=>{});});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes?.mskLicense)mskGuardRefreshRemote({force:true}).catch(()=>{});});
}catch{}
void mskGuardRefreshRemote({force:true}).catch(()=>{});
